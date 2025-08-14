// Package alerts implements the main alerts engine
package alerts

import (
	"context"
	"fmt"
	"log"
	"sync"
	"time"

	"github.com/mantonx/volumeviz/internal/core/interfaces"
	"github.com/mantonx/volumeviz/internal/models"
	"github.com/mantonx/volumeviz/internal/services/alerts/providers"
	"github.com/mantonx/volumeviz/internal/store"
)

// AlertEngine coordinates alert evaluation, routing, and delivery
type AlertEngine struct {
	store            store.Store
	evaluator        interfaces.AlertEvaluator
	router           interfaces.AlertRouter
	delivery         interfaces.AlertDeliveryService
	deduplicator     interfaces.Deduplicator
	renderer         interfaces.TemplateRenderer
	providers        map[string]interfaces.AlertProvider
	
	// Configuration
	evaluationInterval time.Duration
	enabled            bool
	
	// Control
	stopChan   chan struct{}
	wg         sync.WaitGroup
	mu         sync.RWMutex
}

// EngineConfig holds configuration for the alerts engine
type EngineConfig struct {
	EvaluationInterval time.Duration `json:"evaluation_interval"`
	RetryConfig        *RetryConfig  `json:"retry_config,omitempty"`
	DeliveryWorkers    int           `json:"delivery_workers"`
	Enabled            bool          `json:"enabled"`
}

// DefaultEngineConfig returns default engine configuration
func DefaultEngineConfig() *EngineConfig {
	return &EngineConfig{
		EvaluationInterval: 1 * time.Minute,
		RetryConfig:        DefaultRetryConfig(),
		DeliveryWorkers:    3,
		Enabled:            true,
	}
}

// NewAlertEngine creates a new alerts engine
func NewAlertEngine(store store.Store, config *EngineConfig) interfaces.AlertEngine {
	if config == nil {
		config = DefaultEngineConfig()
	}

	// Initialize template renderer
	renderer := NewSafeTemplateRenderer()

	// Initialize providers
	alertProviders := make(map[string]interfaces.AlertProvider)
	alertProviders["webhook"] = providers.NewWebhookProvider(renderer)
	alertProviders["slack"] = providers.NewSlackProvider(renderer)
	alertProviders["pushover"] = providers.NewPushoverProvider(renderer)

	// Initialize deduplicator
	deduplicator := NewAlertDeduplicator(store)

	// Initialize router
	router := NewAlertRouter(store)

	// Initialize delivery service
	delivery := NewAlertDeliveryService(
		store,
		alertProviders,
		renderer,
		config.RetryConfig,
		config.DeliveryWorkers,
	)

	// Initialize evaluator
	evaluator := NewAlertEvaluator(store, deduplicator, router, delivery)

	return &AlertEngine{
		store:              store,
		evaluator:          evaluator,
		router:             router,
		delivery:           delivery,
		deduplicator:       deduplicator,
		renderer:           renderer,
		providers:          alertProviders,
		evaluationInterval: config.EvaluationInterval,
		enabled:            config.Enabled,
		stopChan:           make(chan struct{}),
	}
}

// Start starts the alerts engine
func (e *AlertEngine) Start(ctx context.Context) error {
	e.mu.Lock()
	defer e.mu.Unlock()

	if !e.enabled {
		log.Printf("Alerts engine is disabled")
		return nil
	}

	log.Printf("Starting alerts engine with evaluation interval: %v", e.evaluationInterval)

	// Start delivery service
	if err := e.delivery.Start(ctx); err != nil {
		return fmt.Errorf("failed to start delivery service: %w", err)
	}

	// Start evaluation loop
	e.wg.Add(1)
	go e.evaluationLoop(ctx)

	// Start delivery processor
	e.wg.Add(1)
	go e.deliveryLoop(ctx)

	log.Printf("Alerts engine started successfully")
	return nil
}

// Stop stops the alerts engine
func (e *AlertEngine) Stop() error {
	e.mu.Lock()
	defer e.mu.Unlock()

	log.Printf("Stopping alerts engine")

	// Signal stop
	close(e.stopChan)

	// Wait for goroutines to finish
	e.wg.Wait()

	// Stop delivery service
	if err := e.delivery.Stop(); err != nil {
		log.Printf("Error stopping delivery service: %v", err)
	}

	log.Printf("Alerts engine stopped")
	return nil
}

// IsEnabled returns whether the engine is enabled
func (e *AlertEngine) IsEnabled() bool {
	e.mu.RLock()
	defer e.mu.RUnlock()
	return e.enabled
}

// SetEnabled enables or disables the engine
func (e *AlertEngine) SetEnabled(enabled bool) {
	e.mu.Lock()
	defer e.mu.Unlock()
	e.enabled = enabled
	log.Printf("Alerts engine enabled: %v", enabled)
}

// GetEvaluationInterval returns the current evaluation interval
func (e *AlertEngine) GetEvaluationInterval() time.Duration {
	e.mu.RLock()
	defer e.mu.RUnlock()
	return e.evaluationInterval
}

// SetEvaluationInterval sets the evaluation interval
func (e *AlertEngine) SetEvaluationInterval(interval time.Duration) {
	e.mu.Lock()
	defer e.mu.Unlock()
	e.evaluationInterval = interval
	log.Printf("Alerts engine evaluation interval set to: %v", interval)
}

// evaluationLoop runs the main evaluation loop
func (e *AlertEngine) evaluationLoop(ctx context.Context) {
	defer e.wg.Done()

	ticker := time.NewTicker(e.evaluationInterval)
	defer ticker.Stop()

	log.Printf("Alert evaluation loop started")

	// Run initial evaluation
	if err := e.runEvaluation(ctx); err != nil {
		log.Printf("Initial evaluation failed: %v", err)
	}

	for {
		select {
		case <-e.stopChan:
			log.Printf("Alert evaluation loop stopping")
			return
		case <-ctx.Done():
			log.Printf("Alert evaluation loop stopping due to context cancellation")
			return
		case <-ticker.C:
			// Update ticker interval if it changed
			e.mu.RLock()
			currentInterval := e.evaluationInterval
			enabled := e.enabled
			e.mu.RUnlock()

			if !enabled {
				continue
			}

			if ticker.C != time.NewTicker(currentInterval).C {
				ticker.Stop()
				ticker = time.NewTicker(currentInterval)
			}

			if err := e.runEvaluation(ctx); err != nil {
				log.Printf("Evaluation failed: %v", err)
			}
		}
	}
}

// deliveryLoop runs the delivery processing loop
func (e *AlertEngine) deliveryLoop(ctx context.Context) {
	defer e.wg.Done()

	ticker := time.NewTicker(10 * time.Second) // Check for pending deliveries every 10 seconds
	defer ticker.Stop()

	log.Printf("Alert delivery loop started")

	for {
		select {
		case <-e.stopChan:
			log.Printf("Alert delivery loop stopping")
			return
		case <-ctx.Done():
			log.Printf("Alert delivery loop stopping due to context cancellation")
			return
		case <-ticker.C:
			if err := e.delivery.ProcessPendingDeliveries(ctx); err != nil {
				log.Printf("Failed to process pending deliveries: %v", err)
			}
		}
	}
}

// runEvaluation runs a single evaluation cycle
func (e *AlertEngine) runEvaluation(ctx context.Context) error {
	err := e.evaluator.EvaluateRules(ctx)
	if err != nil {
		return fmt.Errorf("evaluation failed: %w", err)
	}
	
	log.Printf("Evaluation completed successfully")
	return nil
}

// TriggerEvaluation manually triggers an evaluation cycle
func (e *AlertEngine) TriggerEvaluation(ctx context.Context) error {
	log.Printf("Manual evaluation triggered")
	return e.runEvaluation(ctx)
}

// GetStats returns comprehensive engine statistics
func (e *AlertEngine) GetStats(ctx context.Context) (interface{}, error) {
	// Get alert statistics
	alertStats, err := e.store.Alerts().GetAlertStats(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to get alert stats: %w", err)
	}

	// Get delivery statistics
	deliveryStats, err := e.store.Alerts().GetDeliveryStats(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to get delivery stats: %w", err)
	}

	// Get delivery service statistics
	serviceStats := e.delivery.GetStats()

	// Get rule count
	ruleCount, err := e.store.Alerts().CountAlertRules(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to count rules: %w", err)
	}

	// Get destination count
	destCount, err := e.store.Alerts().CountAlertDestinations(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to count destinations: %w", err)
	}

	// Convert service stats to concrete type
	var serviceStatsData DeliveryServiceStats
	if serviceStats != nil {
		if stats, ok := serviceStats.(*DeliveryServiceStats); ok {
			serviceStatsData = *stats
		}
	}

	// Convert repo stats to engine stats
	engineAlertStats := AlertsStats{
		Total:        alertStats.TotalAlerts,
		Active:       alertStats.FiringAlerts,
		Acknowledged: 0, // Not available from repo
		Resolved:     alertStats.ResolvedAlerts,
	}

	engineDeliveryStats := DeliveryStats{
		Delivered: deliveryStats.SuccessfulDeliveries,
		Failed:    deliveryStats.FailedDeliveries,
		Pending:   deliveryStats.PendingDeliveries,
		Retrying:  0, // Not available from repo
	}

	return &EngineStats{
		Enabled:            e.IsEnabled(),
		EvaluationInterval: e.GetEvaluationInterval(),
		QueueSize:          e.delivery.GetQueueSize(),
		Rules:              ruleCount,
		Destinations:       destCount,
		Alerts:             engineAlertStats,
		Deliveries:         engineDeliveryStats,
		Service:            serviceStatsData,
		ProvidersEnabled:   e.getEnabledProviders(),
	}, nil
}

// AlertsStats provides alert statistics
type AlertsStats struct {
	Total         int64 `json:"total"`
	Active        int64 `json:"active"`
	Acknowledged  int64 `json:"acknowledged"`
	Resolved      int64 `json:"resolved"`
}

// DeliveryStats provides delivery statistics  
type DeliveryStats struct {
	Delivered int64 `json:"delivered"`
	Failed    int64 `json:"failed"`
	Pending   int64 `json:"pending"`
	Retrying  int64 `json:"retrying"`
}

// EngineStats provides comprehensive engine statistics
type EngineStats struct {
	Enabled            bool                  `json:"enabled"`
	EvaluationInterval time.Duration         `json:"evaluation_interval"`
	QueueSize          int                   `json:"queue_size"`
	Rules              int64                 `json:"rules"`
	Destinations       int64                 `json:"destinations"`
	Alerts             AlertsStats           `json:"alerts"`
	Deliveries         DeliveryStats         `json:"deliveries"`
	Service            DeliveryServiceStats  `json:"service"`
	ProvidersEnabled   []string              `json:"providers_enabled"`
}

// getEnabledProviders returns a list of enabled provider types
func (e *AlertEngine) getEnabledProviders() []string {
	var providers []string
	for providerType := range e.providers {
		providers = append(providers, providerType)
	}
	return providers
}

// ValidateDestination validates a destination configuration
func (e *AlertEngine) ValidateDestination(ctx context.Context, destination *models.AlertDestination) error {
	provider, exists := e.providers[destination.Type]
	if !exists {
		return fmt.Errorf("unknown provider type: %s", destination.Type)
	}

	return provider.Validate(destination.Config)
}

// TestDestination tests a destination by sending a test message
func (e *AlertEngine) TestDestination(ctx context.Context, destinationID int64, message string) error {
	return e.delivery.TestDelivery(ctx, destinationID, message)
}

// GetProviders returns available provider types
func (e *AlertEngine) GetProviders() map[string]interfaces.AlertProvider {
	return e.providers
}

// GetEvaluator returns the evaluator service
func (e *AlertEngine) GetEvaluator() interfaces.AlertEvaluator {
	return e.evaluator
}

// GetRouter returns the router service
func (e *AlertEngine) GetRouter() interfaces.AlertRouter {
	return e.router
}

// GetDelivery returns the delivery service
func (e *AlertEngine) GetDelivery() interfaces.AlertDeliveryService {
	return e.delivery
}

// GetDeduplicator returns the deduplicator service
func (e *AlertEngine) GetDeduplicator() interfaces.Deduplicator {
	return e.deduplicator
}

// Health checks the health of the alerts engine
func (e *AlertEngine) Health(ctx context.Context) error {
	if !e.IsEnabled() {
		return fmt.Errorf("alerts engine is disabled")
	}

	// Check if we can access the store
	if _, err := e.store.Alerts().CountAlertRules(ctx); err != nil {
		return fmt.Errorf("store health check failed: %w", err)
	}

	// Check delivery service queue size
	queueSize := e.delivery.GetQueueSize()
	if queueSize > 500 { // Arbitrary threshold
		return fmt.Errorf("delivery queue is overloaded: %d items", queueSize)
	}

	return nil
}

// GetConfig returns the current engine configuration
func (e *AlertEngine) GetConfig() *EngineConfig {
	e.mu.RLock()
	defer e.mu.RUnlock()

	return &EngineConfig{
		EvaluationInterval: e.evaluationInterval,
		Enabled:            e.enabled,
	}
}

// UpdateConfig updates the engine configuration
func (e *AlertEngine) UpdateConfig(config *EngineConfig) error {
	e.mu.Lock()
	defer e.mu.Unlock()

	if config.EvaluationInterval > 0 {
		e.evaluationInterval = config.EvaluationInterval
	}

	e.enabled = config.Enabled

	log.Printf("Engine configuration updated: interval=%v, enabled=%v", 
		e.evaluationInterval, e.enabled)

	return nil
}