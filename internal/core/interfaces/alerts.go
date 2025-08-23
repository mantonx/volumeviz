// Package interfaces defines core interfaces for the alerts system
package interfaces

import (
	"context"

	"github.com/mantonx/volumeviz/internal/models"
)

// AlertProvider defines the interface for alert delivery providers
type AlertProvider interface {
	// GetType returns the provider type identifier
	GetType() string

	// Validate validates the provider configuration
	Validate(config map[string]interface{}) error

	// Send delivers an alert to the destination
	Send(ctx context.Context, destination *models.AlertDestination, alert *models.Alert) error

	// Test sends a test message to verify the destination configuration
	Test(ctx context.Context, destination *models.AlertDestination, message string) error
}

// AlertEvaluator defines the interface for evaluating alert rules
type AlertEvaluator interface {
	// EvaluateRules evaluates all enabled alert rules
	EvaluateRules(ctx context.Context) error

	// EvaluateRule evaluates a specific alert rule
	EvaluateRule(ctx context.Context, rule *models.AlertRule) error

	// TestRule tests a rule against current metrics without creating alerts
	TestRule(ctx context.Context, rule *models.AlertRule) (interface{}, error)

	// ValidateRuleQuery validates that a rule's query is well-formed
	ValidateRuleQuery(ctx context.Context, query string) error
}

// AlertRouter defines the interface for routing alerts to destinations
type AlertRouter interface {
	// Route determines which destinations should receive an alert
	Route(ctx context.Context, alert *models.Alert) ([]*models.AlertRoute, error)

	// MatchesRoute checks if an alert matches a specific route
	MatchesRoute(alert *models.Alert, route *models.AlertRoute) bool

	// ValidateRouteMatchers validates that route matchers are well-formed
	ValidateRouteMatchers(matchers map[string]string) error
}

// AlertDeliveryService defines the interface for managing alert deliveries
type AlertDeliveryService interface {
	// Start starts the delivery service workers
	Start(ctx context.Context) error

	// Stop stops the delivery service workers
	Stop() error

	// QueueDelivery queues a new delivery for processing
	QueueDelivery(ctx context.Context, alertID, destinationID, routeID int64) error

	// ProcessPendingDeliveries processes all pending delivery attempts
	ProcessPendingDeliveries(ctx context.Context) error

	// TestDelivery tests a delivery to a destination without creating a delivery record
	TestDelivery(ctx context.Context, destinationID int64, message string) error

	// GetStats returns delivery service statistics
	GetStats() interface{}

	// GetQueueSize returns the current queue size
	GetQueueSize() int
}

// TemplateRenderer defines the interface for rendering alert templates
type TemplateRenderer interface {
	// Render renders a template with the given context
	Render(template string, context *models.AlertContext) (string, error)

	// ValidateTemplate validates a template for syntax errors
	ValidateTemplate(template string) error

	// GetSafeFields returns the list of safe fields available in templates
	GetSafeFields() []string
}

// AlertEngine defines the main alerts engine interface
type AlertEngine interface {
	// Start starts the alerts engine
	Start(ctx context.Context) error

	// Stop stops the alerts engine
	Stop() error

	// IsEnabled returns whether the engine is enabled
	IsEnabled() bool

	// TriggerEvaluation manually triggers alert evaluation
	TriggerEvaluation(ctx context.Context) error

	// GetStats returns comprehensive engine statistics
	GetStats(ctx context.Context) (interface{}, error)

	// ValidateDestination validates a destination configuration
	ValidateDestination(ctx context.Context, destination *models.AlertDestination) error

	// TestDestination tests a destination by sending a test message
	TestDestination(ctx context.Context, destinationID int64, message string) error

	// GetEvaluator returns the evaluator service
	GetEvaluator() AlertEvaluator

	// GetRouter returns the router service
	GetRouter() AlertRouter

	// GetDelivery returns the delivery service
	GetDelivery() AlertDeliveryService
}

// Deduplicator defines the interface for alert deduplication
type Deduplicator interface {
	// GenerateKey generates a deduplication key for an alert
	GenerateKey(rule *models.AlertRule, entityID, entityType string, value *float64, labels map[string]string) string

	// ShouldSuppress checks if an alert should be suppressed due to deduplication
	ShouldSuppress(ctx context.Context, alert *models.Alert) (bool, error)
}
