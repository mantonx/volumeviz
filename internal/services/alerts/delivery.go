// Package alerts implements alert delivery service
package alerts

import (
	"context"
	"fmt"
	"log"
	"sync"
	"time"

	"github.com/mantonx/volumeviz/internal/core/interfaces"
	"github.com/mantonx/volumeviz/internal/models"
	"github.com/mantonx/volumeviz/internal/store"
)

// AlertDeliveryService manages alert deliveries and retries
type AlertDeliveryService struct {
	store        store.Store
	providers    map[string]interfaces.AlertProvider
	renderer     interfaces.TemplateRenderer
	retryManager *RetryManager

	// Delivery processing
	workers       int
	workerStop    chan struct{}
	workerWg      sync.WaitGroup
	deliveryQueue chan int64 // Channel for delivery IDs

	// Statistics
	statsLock     sync.RWMutex
	deliveryStats *DeliveryServiceStats
}

// DeliveryServiceStats tracks delivery service statistics
type DeliveryServiceStats struct {
	TotalProcessed   int64     `json:"total_processed"`
	SuccessfulSent   int64     `json:"successful_sent"`
	Failed           int64     `json:"failed"`
	Retries          int64     `json:"retries"`
	CurrentlyPending int64     `json:"currently_pending"`
	AverageLatency   float64   `json:"average_latency_ms"`
	LastProcessedAt  time.Time `json:"last_processed_at"`
	WorkersRunning   int       `json:"workers_running"`
}

// NewAlertDeliveryService creates a new alert delivery service
func NewAlertDeliveryService(
	store store.Store,
	providers map[string]interfaces.AlertProvider,
	renderer interfaces.TemplateRenderer,
	retryConfig *RetryConfig,
	workers int,
) interfaces.AlertDeliveryService {
	if workers <= 0 {
		workers = 3 // Default worker count
	}

	return &AlertDeliveryService{
		store:         store,
		providers:     providers,
		renderer:      renderer,
		retryManager:  NewRetryManager(retryConfig),
		workers:       workers,
		workerStop:    make(chan struct{}),
		deliveryQueue: make(chan int64, 1000), // Buffered channel for delivery queue
		deliveryStats: &DeliveryServiceStats{
			WorkersRunning: workers,
		},
	}
}

// Start starts the delivery service workers
func (ds *AlertDeliveryService) Start(ctx context.Context) error {
	log.Printf("Starting alert delivery service with %d workers", ds.workers)

	// Start worker goroutines
	for i := 0; i < ds.workers; i++ {
		ds.workerWg.Add(1)
		go ds.deliveryWorker(ctx, i)
	}

	// Start pending delivery processor
	ds.workerWg.Add(1)
	go ds.pendingDeliveryProcessor(ctx)

	return nil
}

// Stop stops the delivery service workers
func (ds *AlertDeliveryService) Stop() error {
	log.Printf("Stopping alert delivery service")

	close(ds.workerStop)
	ds.workerWg.Wait()

	log.Printf("Alert delivery service stopped")
	return nil
}

// QueueDelivery queues a new delivery for processing
func (ds *AlertDeliveryService) QueueDelivery(ctx context.Context, alertID, destinationID, routeID int64) error {
	// Get the alert
	_, err := ds.store.Alerts().GetAlert(ctx, alertID)
	if err != nil {
		return fmt.Errorf("failed to get alert: %w", err)
	}

	// Get the destination
	destination, err := ds.store.Alerts().GetAlertDestination(ctx, destinationID)
	if err != nil {
		return fmt.Errorf("failed to get destination: %w", err)
	}

	// Create the delivery record
	delivery, err := ds.store.Alerts().CreateAlertDelivery(ctx, alertID, destinationID, routeID, int32(ds.retryManager.config.MaxRetries))
	if err != nil {
		return fmt.Errorf("failed to create delivery: %w", err)
	}

	log.Printf("Queued delivery: alert=%d, destination=%s, delivery=%d", alertID, destination.Name, delivery.ID)

	// Queue the delivery for processing
	select {
	case ds.deliveryQueue <- delivery.ID:
		return nil
	default:
		// Queue is full - this shouldn't happen with a large buffer, but handle gracefully
		log.Printf("Delivery queue is full, processing delivery synchronously: %d", delivery.ID)
		return ds.processDelivery(ctx, delivery.ID)
	}
}

// ProcessPendingDeliveries processes all pending deliveries
func (ds *AlertDeliveryService) ProcessPendingDeliveries(ctx context.Context) error {
	deliveries, err := ds.store.Alerts().ListPendingDeliveries(ctx, 100) // Limit to prevent memory issues
	if err != nil {
		return fmt.Errorf("failed to list pending deliveries: %w", err)
	}

	log.Printf("Processing %d pending deliveries", len(deliveries))

	for _, delivery := range deliveries {
		// Check if delivery is ready for retry
		if delivery.NextAttemptAt != nil && delivery.NextAttemptAt.After(time.Now()) {
			continue // Not ready for retry yet
		}

		// Queue the delivery
		select {
		case ds.deliveryQueue <- delivery.ID:
			// Queued successfully
		default:
			// Queue is full, process synchronously
			if err := ds.processDelivery(ctx, delivery.ID); err != nil {
				log.Printf("Failed to process delivery %d: %v", delivery.ID, err)
			}
		}
	}

	return nil
}

// TestDelivery tests a delivery to a destination without creating a delivery record
func (ds *AlertDeliveryService) TestDelivery(ctx context.Context, destinationID int64, message string) error {
	destination, err := ds.store.Alerts().GetAlertDestination(ctx, destinationID)
	if err != nil {
		return fmt.Errorf("failed to get destination: %w", err)
	}

	provider, exists := ds.providers[destination.Type]
	if !exists {
		return fmt.Errorf("no provider found for destination type: %s", destination.Type)
	}

	return provider.Test(ctx, destination, message)
}

// deliveryWorker processes deliveries from the queue
func (ds *AlertDeliveryService) deliveryWorker(ctx context.Context, workerID int) {
	defer ds.workerWg.Done()

	log.Printf("Delivery worker %d started", workerID)

	for {
		select {
		case <-ds.workerStop:
			log.Printf("Delivery worker %d stopping", workerID)
			return
		case <-ctx.Done():
			log.Printf("Delivery worker %d stopping due to context cancellation", workerID)
			return
		case deliveryID := <-ds.deliveryQueue:
			if err := ds.processDelivery(ctx, deliveryID); err != nil {
				log.Printf("Worker %d failed to process delivery %d: %v", workerID, deliveryID, err)
			}
		}
	}
}

// pendingDeliveryProcessor periodically processes pending deliveries
func (ds *AlertDeliveryService) pendingDeliveryProcessor(ctx context.Context) {
	defer ds.workerWg.Done()

	ticker := time.NewTicker(30 * time.Second) // Check every 30 seconds
	defer ticker.Stop()

	log.Printf("Pending delivery processor started")

	for {
		select {
		case <-ds.workerStop:
			log.Printf("Pending delivery processor stopping")
			return
		case <-ctx.Done():
			log.Printf("Pending delivery processor stopping due to context cancellation")
			return
		case <-ticker.C:
			if err := ds.ProcessPendingDeliveries(ctx); err != nil {
				log.Printf("Failed to process pending deliveries: %v", err)
			}
		}
	}
}

// processDelivery processes a single delivery
func (ds *AlertDeliveryService) processDelivery(ctx context.Context, deliveryID int64) error {
	startTime := time.Now()

	// Update stats
	ds.updateStatsStart()
	defer func() {
		ds.updateStatsEnd(time.Since(startTime))
	}()

	// Get the delivery
	delivery, err := ds.store.Alerts().GetAlertDelivery(ctx, deliveryID)
	if err != nil {
		return fmt.Errorf("failed to get delivery: %w", err)
	}

	// Get the alert
	alert, err := ds.store.Alerts().GetAlert(ctx, delivery.AlertID)
	if err != nil {
		return fmt.Errorf("failed to get alert: %w", err)
	}

	// Get the destination
	destination, err := ds.store.Alerts().GetAlertDestination(ctx, delivery.DestinationID)
	if err != nil {
		return fmt.Errorf("failed to get destination: %w", err)
	}

	// Get the provider
	provider, exists := ds.providers[destination.Type]
	if !exists {
		err := fmt.Errorf("no provider found for destination type: %s", destination.Type)
		ds.markDeliveryFailed(ctx, delivery, err, nil, nil, nil)
		return err
	}

	log.Printf("Processing delivery: id=%d, alert=%d, destination=%s, attempt=%d",
		delivery.ID, alert.ID, destination.Name, delivery.AttemptCount+1)

	// Prepare the delivery payload
	payload, err := ds.preparePayload(ctx, alert, destination)
	if err != nil {
		ds.markDeliveryFailed(ctx, delivery, err, nil, nil, nil)
		return fmt.Errorf("failed to prepare payload: %w", err)
	}

	// Attempt delivery
	err = provider.Send(ctx, destination, alert)

	// Update delivery attempt count and next attempt time
	delivery.AttemptCount++
	nextAttemptAt := ds.retryManager.CalculateNextAttempt(delivery)

	if err != nil {
		// Delivery failed
		ds.updateStatsFailure()

		// Check if we should retry
		if ds.retryManager.ShouldRetry(delivery, err) {
			// Schedule retry
			ds.updateStatsRetry()

			errorMsg := err.Error()
			if updateErr := ds.store.Alerts().UpdateDeliveryAttempt(
				ctx, delivery.ID, models.DeliveryStatusPending, delivery.AttemptCount,
				&nextAttemptAt, &errorMsg, &payload, nil, nil,
			); updateErr != nil {
				log.Printf("Failed to update delivery for retry: %v", updateErr)
			}

			log.Printf("Delivery failed, scheduled for retry: id=%d, attempt=%d, next_at=%v, error=%v",
				delivery.ID, delivery.AttemptCount, nextAttemptAt, err)
		} else {
			// Mark as permanently failed
			ds.markDeliveryFailed(ctx, delivery, err, &payload, nil, nil)
			log.Printf("Delivery permanently failed: id=%d, error=%v", delivery.ID, err)
		}

		return err
	}

	// Delivery succeeded
	ds.updateStatsSuccess()

	if err := ds.store.Alerts().MarkDeliveryDelivered(ctx, delivery.ID, &payload, nil, nil); err != nil {
		log.Printf("Failed to mark delivery as delivered: %v", err)
	}

	log.Printf("Delivery successful: id=%d, alert=%d, destination=%s",
		delivery.ID, alert.ID, destination.Name)

	return nil
}

// preparePayload prepares the delivery payload using templates
func (ds *AlertDeliveryService) preparePayload(ctx context.Context, alert *models.Alert, destination *models.AlertDestination) (string, error) {
	// Use default template if none specified in destination config
	template := `Alert: {{.Alert.Rule.Name}}
Status: {{.Alert.Status}}
Entity: {{.Alert.EntityType}} {{.Alert.EntityID}}
{{if .Alert.Value}}Value: {{.Alert.Value}}{{end}}
{{if .Alert.Annotations.description}}Description: {{.Alert.Annotations.description}}{{end}}
Started: {{.Alert.StartsAt}}
{{if .Alert.Labels}}Labels: {{range $k, $v := .Alert.Labels}}{{$k}}={{$v}} {{end}}{{end}}`

	// Check if destination has a custom template
	if destination.Config != nil {
		if customTemplate, exists := destination.Config["template"]; exists {
			if templateStr, ok := customTemplate.(string); ok && templateStr != "" {
				template = templateStr
			}
		}
	}

	// Create alert context for rendering
	alertContext := &models.AlertContext{
		Alert:       alert,
		Rule:        alert.Rule,
		Value:       alert.Value,
		Labels:      alert.Labels,
		Annotations: alert.Annotations,
	}

	// Render the template
	payload, err := ds.renderer.Render(template, alertContext)
	if err != nil {
		return "", fmt.Errorf("failed to render template: %w", err)
	}

	return payload, nil
}

// markDeliveryFailed marks a delivery as permanently failed
func (ds *AlertDeliveryService) markDeliveryFailed(ctx context.Context, delivery *models.AlertDelivery, err error, requestPayload, responsePayload *string, responseStatus *int32) {
	errorMessage := err.Error()
	if markErr := ds.store.Alerts().MarkDeliveryFailed(ctx, delivery.ID, &errorMessage, requestPayload, responsePayload, responseStatus); markErr != nil {
		log.Printf("Failed to mark delivery as failed: %v", markErr)
	}
}

// updateStatsStart updates statistics when starting delivery processing
func (ds *AlertDeliveryService) updateStatsStart() {
	ds.statsLock.Lock()
	defer ds.statsLock.Unlock()

	ds.deliveryStats.TotalProcessed++
	ds.deliveryStats.LastProcessedAt = time.Now()
}

// updateStatsEnd updates statistics when ending delivery processing
func (ds *AlertDeliveryService) updateStatsEnd(duration time.Duration) {
	ds.statsLock.Lock()
	defer ds.statsLock.Unlock()

	// Update average latency (simple moving average)
	latencyMs := float64(duration.Nanoseconds()) / 1000000.0
	if ds.deliveryStats.AverageLatency == 0 {
		ds.deliveryStats.AverageLatency = latencyMs
	} else {
		ds.deliveryStats.AverageLatency = (ds.deliveryStats.AverageLatency * 0.9) + (latencyMs * 0.1)
	}
}

// updateStatsSuccess updates statistics for successful delivery
func (ds *AlertDeliveryService) updateStatsSuccess() {
	ds.statsLock.Lock()
	defer ds.statsLock.Unlock()

	ds.deliveryStats.SuccessfulSent++
}

// updateStatsFailure updates statistics for failed delivery
func (ds *AlertDeliveryService) updateStatsFailure() {
	ds.statsLock.Lock()
	defer ds.statsLock.Unlock()

	ds.deliveryStats.Failed++
}

// updateStatsRetry updates statistics for retry
func (ds *AlertDeliveryService) updateStatsRetry() {
	ds.statsLock.Lock()
	defer ds.statsLock.Unlock()

	ds.deliveryStats.Retries++
}

// GetStats returns current delivery service statistics
func (ds *AlertDeliveryService) GetStats() interface{} {
	ds.statsLock.RLock()
	defer ds.statsLock.RUnlock()

	// Make a copy to avoid race conditions
	stats := *ds.deliveryStats
	return &stats
}

// GetQueueSize returns the current queue size
func (ds *AlertDeliveryService) GetQueueSize() int {
	return len(ds.deliveryQueue)
}

// ForceProcessDelivery forces immediate processing of a specific delivery
func (ds *AlertDeliveryService) ForceProcessDelivery(ctx context.Context, deliveryID int64) error {
	return ds.processDelivery(ctx, deliveryID)
}

// CancelDelivery cancels a pending delivery
func (ds *AlertDeliveryService) CancelDelivery(ctx context.Context, deliveryID int64) error {
	return ds.store.Alerts().MarkDeliveryFailed(ctx, deliveryID, stringPtr("cancelled"), nil, nil, nil)
}

// GetDeliveryInfo returns detailed information about a delivery
func (ds *AlertDeliveryService) GetDeliveryInfo(ctx context.Context, deliveryID int64) (*DeliveryInfo, error) {
	delivery, err := ds.store.Alerts().GetAlertDelivery(ctx, deliveryID)
	if err != nil {
		return nil, err
	}

	alert, err := ds.store.Alerts().GetAlert(ctx, delivery.AlertID)
	if err != nil {
		return nil, err
	}

	destination, err := ds.store.Alerts().GetAlertDestination(ctx, delivery.DestinationID)
	if err != nil {
		return nil, err
	}

	retryInfo := ds.retryManager.GetRetryInfo(delivery)

	return &DeliveryInfo{
		Delivery:    delivery,
		Alert:       alert,
		Destination: destination,
		RetryInfo:   retryInfo,
		QueueSize:   ds.GetQueueSize(),
	}, nil
}

// DeliveryInfo provides comprehensive information about a delivery
type DeliveryInfo struct {
	Delivery    *models.AlertDelivery    `json:"delivery"`
	Alert       *models.Alert            `json:"alert"`
	Destination *models.AlertDestination `json:"destination"`
	RetryInfo   *RetryInfo               `json:"retry_info"`
	QueueSize   int                      `json:"queue_size"`
}

// Helper function to create string pointer
func stringPtr(s string) *string {
	return &s
}
