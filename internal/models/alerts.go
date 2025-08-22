// Package models contains domain models for the alerts system
package models

import (
	"encoding/json"
	"time"
)

// ==============================================================================
// ALERT SYSTEM CONSTANTS
// ==============================================================================

// Alert condition types
const (
	AlertConditionGreater      = "gt"
	AlertConditionGreaterEqual = "gte"
	AlertConditionLess         = "lt"
	AlertConditionLessEqual    = "lte"
	AlertConditionEqual        = "eq"
	AlertConditionNotEqual     = "ne"
)

// ==============================================================================
// ALERT SYSTEM DOMAIN MODELS
// ==============================================================================

// AlertRule represents a rule that triggers alerts based on conditions
type AlertRule struct {
	ID          int64             `json:"id"`
	Name        string            `json:"name"`
	Description *string           `json:"description,omitempty"`
	Query       string            `json:"query"`
	Condition   string            `json:"condition"` // e.g., "gt", "lt", "eq"
	Threshold   float64           `json:"threshold"`
	Interval    time.Duration     `json:"interval" swaggertype:"integer" format:"int64" example:"300000000000"`    // How often to evaluate (nanoseconds)
	For         *time.Duration    `json:"for,omitempty" swaggertype:"integer" format:"int64" example:"600000000000"` // How long condition must persist (nanoseconds)
	Labels      map[string]string `json:"labels,omitempty"`
	IsEnabled   bool              `json:"is_enabled"`
	CreatedAt   time.Time         `json:"created_at"`
	UpdatedAt   time.Time         `json:"updated_at"`
}

// Alert represents a triggered alert instance
type Alert struct {
	ID          int64             `json:"id"`
	RuleID      int64             `json:"rule_id"`
	EntityID    string            `json:"entity_id"` // e.g., volume_id, container_id
	EntityType  string            `json:"entity_type"` // e.g., "volume", "container"
	DedupeKey   string            `json:"dedupe_key"` // For deduplication
	Status      string            `json:"status"` // "firing", "resolved"
	Value       *float64          `json:"value,omitempty"`
	Labels      map[string]string `json:"labels,omitempty"`
	Annotations map[string]string `json:"annotations,omitempty"`
	StartsAt    time.Time         `json:"starts_at"`
	EndsAt      *time.Time        `json:"ends_at,omitempty"`
	CreatedAt   time.Time         `json:"created_at"`
	UpdatedAt   time.Time         `json:"updated_at"`
	
	// Relationships
	Rule *AlertRule `json:"rule,omitempty"`
}

// AlertDestination represents a notification destination
type AlertDestination struct {
	ID         int64                  `json:"id"`
	Name       string                 `json:"name"`
	Type       string                 `json:"type"` // "webhook", "slack", "pushover"
	Config     map[string]interface{} `json:"config"`
	IsEnabled  bool                   `json:"is_enabled"`
	CreatedAt  time.Time              `json:"created_at"`
	UpdatedAt  time.Time              `json:"updated_at"`
}

// AlertRoute represents routing rules for alerts to destinations
type AlertRoute struct {
	ID            int64             `json:"id"`
	Name          string            `json:"name"`
	Matchers      map[string]string `json:"matchers"` // Label matchers
	DestinationID int64             `json:"destination_id"`
	Priority      int32             `json:"priority"` // Lower number = higher priority
	IsEnabled     bool              `json:"is_enabled"`
	CreatedAt     time.Time         `json:"created_at"`
	UpdatedAt     time.Time         `json:"updated_at"`
	
	// Relationships
	Destination *AlertDestination `json:"destination,omitempty"`
}

// AlertDelivery represents a delivery attempt to a destination
type AlertDelivery struct {
	ID               int64      `json:"id"`
	AlertID          int64      `json:"alert_id"`
	DestinationID    int64      `json:"destination_id"`
	RouteID          int64      `json:"route_id"`
	Status           string     `json:"status"` // "pending", "delivered", "failed", "retrying"
	AttemptCount     int32      `json:"attempt_count"`
	MaxAttempts      int32      `json:"max_attempts"`
	NextAttemptAt    *time.Time `json:"next_attempt_at,omitempty"`
	LastAttemptAt    *time.Time `json:"last_attempt_at,omitempty"`
	ErrorMessage     *string    `json:"error_message,omitempty"`
	DeliveredAt      *time.Time `json:"delivered_at,omitempty"`
	RequestPayload   *string    `json:"request_payload,omitempty"`
	ResponsePayload  *string    `json:"response_payload,omitempty"`
	ResponseStatus   *int32     `json:"response_status,omitempty"`
	CreatedAt        time.Time  `json:"created_at"`
	UpdatedAt        time.Time  `json:"updated_at"`
	
	// Relationships
	Alert       *Alert            `json:"alert,omitempty"`
	Destination *AlertDestination `json:"destination,omitempty"`
	Route       *AlertRoute       `json:"route,omitempty"`
}

// ==============================================================================
// CREATE/UPDATE PARAMETERS
// ==============================================================================

// CreateAlertRuleParams represents parameters for creating an alert rule
type CreateAlertRuleParams struct {
	Name        string            `json:"name" validate:"required,min=1,max=100"`
	Description *string           `json:"description,omitempty" validate:"omitempty,max=500"`
	Query       string            `json:"query" validate:"required"`
	Condition   string            `json:"condition" validate:"required,oneof=gt lt eq ne gte lte"`
	Threshold   float64           `json:"threshold" validate:"required"`
	Interval    time.Duration     `json:"interval" validate:"required,min=1m" swaggertype:"integer" format:"int64" example:"300000000000"`
	For         *time.Duration    `json:"for,omitempty" validate:"omitempty,min=0" swaggertype:"integer" format:"int64" example:"600000000000"`
	Labels      map[string]string `json:"labels,omitempty"`
	IsEnabled   bool              `json:"is_enabled"`
}

// UpdateAlertRuleParams represents parameters for updating an alert rule
type UpdateAlertRuleParams struct {
	ID          int64             `json:"id"`
	Name        string            `json:"name" validate:"required,min=1,max=100"`
	Description *string           `json:"description,omitempty" validate:"omitempty,max=500"`
	Query       string            `json:"query" validate:"required"`
	Condition   string            `json:"condition" validate:"required,oneof=gt lt eq ne gte lte"`
	Threshold   float64           `json:"threshold" validate:"required"`
	Interval    time.Duration     `json:"interval" validate:"required,min=1m" swaggertype:"integer" format:"int64" example:"300000000000"`
	For         *time.Duration    `json:"for,omitempty" validate:"omitempty,min=0" swaggertype:"integer" format:"int64" example:"600000000000"`
	Labels      map[string]string `json:"labels,omitempty"`
	IsEnabled   bool              `json:"is_enabled"`
}

// CreateAlertDestinationParams represents parameters for creating a destination
type CreateAlertDestinationParams struct {
	Name      string                 `json:"name" validate:"required,min=1,max=100"`
	Type      string                 `json:"type" validate:"required,oneof=webhook slack pushover"`
	Config    map[string]interface{} `json:"config" validate:"required"`
	IsEnabled bool                   `json:"is_enabled"`
}

// UpdateAlertDestinationParams represents parameters for updating a destination
type UpdateAlertDestinationParams struct {
	ID        int64                  `json:"id"`
	Name      string                 `json:"name" validate:"required,min=1,max=100"`
	Type      string                 `json:"type" validate:"required,oneof=webhook slack pushover"`
	Config    map[string]interface{} `json:"config" validate:"required"`
	IsEnabled bool                   `json:"is_enabled"`
}

// CreateAlertRouteParams represents parameters for creating a route
type CreateAlertRouteParams struct {
	Name          string            `json:"name" validate:"required,min=1,max=100"`
	Matchers      map[string]string `json:"matchers" validate:"required"`
	DestinationID int64             `json:"destination_id" validate:"required"`
	Priority      int32             `json:"priority" validate:"min=0"`
	IsEnabled     bool              `json:"is_enabled"`
}

// UpdateAlertRouteParams represents parameters for updating a route
type UpdateAlertRouteParams struct {
	ID            int64             `json:"id"`
	Name          string            `json:"name" validate:"required,min=1,max=100"`
	Matchers      map[string]string `json:"matchers" validate:"required"`
	DestinationID int64             `json:"destination_id" validate:"required"`
	Priority      int32             `json:"priority" validate:"min=0"`
	IsEnabled     bool              `json:"is_enabled"`
}

// ==============================================================================
// HELPER TYPES AND CONSTANTS
// ==============================================================================

// Alert status constants
const (
	AlertStatusFiring   = "firing"
	AlertStatusResolved = "resolved"
)

// Alert delivery status constants
const (
	DeliveryStatusPending   = "pending"
	DeliveryStatusDelivered = "delivered"
	DeliveryStatusFailed    = "failed" 
	DeliveryStatusRetrying  = "retrying"
)

// Alert condition constants
const (
	ConditionGreaterThan      = "gt"
	ConditionLessThan         = "lt"
	ConditionEqual            = "eq"
	ConditionNotEqual         = "ne"
	ConditionGreaterThanEqual = "gte"
	ConditionLessThanEqual    = "lte"
)

// Provider type constants
const (
	ProviderTypeWebhook  = "webhook"
	ProviderTypeSlack    = "slack"
	ProviderTypePushover = "pushover"
)

// TestDeliveryRequest represents a request to test a destination
type TestDeliveryRequest struct {
	DestinationID int64  `json:"destination_id" validate:"required"`
	Message       string `json:"message" validate:"required,max=1000"`
}

// TestDeliveryResponse represents the response from testing a destination
type TestDeliveryResponse struct {
	Success        bool    `json:"success"`
	Message        string  `json:"message"`
	ResponseStatus *int32  `json:"response_status,omitempty"`
	ResponseBody   *string `json:"response_body,omitempty"`
	ErrorMessage   *string `json:"error_message,omitempty"`
}

// AlertContext represents the template context for alerts
type AlertContext struct {
	Alert       *Alert            `json:"alert"`
	Rule        *AlertRule        `json:"rule"`
	Value       *float64          `json:"value,omitempty"`
	Labels      map[string]string `json:"labels,omitempty"`
	Annotations map[string]string `json:"annotations,omitempty"`
}

// Helper methods for JSON marshaling/unmarshaling
func (ar *AlertRule) MarshalLabels() ([]byte, error) {
	return json.Marshal(ar.Labels)
}

func (ar *AlertRule) UnmarshalLabels(data []byte) error {
	return json.Unmarshal(data, &ar.Labels)
}

func (a *Alert) MarshalLabels() ([]byte, error) {
	return json.Marshal(a.Labels)
}

func (a *Alert) UnmarshalLabels(data []byte) error {
	return json.Unmarshal(data, &a.Labels)
}

func (a *Alert) MarshalAnnotations() ([]byte, error) {
	return json.Marshal(a.Annotations)
}

func (a *Alert) UnmarshalAnnotations(data []byte) error {
	return json.Unmarshal(data, &a.Annotations)
}

func (ad *AlertDestination) MarshalConfig() ([]byte, error) {
	return json.Marshal(ad.Config)
}

func (ad *AlertDestination) UnmarshalConfig(data []byte) error {
	return json.Unmarshal(data, &ad.Config)
}

func (ar *AlertRoute) MarshalMatchers() ([]byte, error) {
	return json.Marshal(ar.Matchers)
}

func (ar *AlertRoute) UnmarshalMatchers(data []byte) error {
	return json.Unmarshal(data, &ar.Matchers)
}