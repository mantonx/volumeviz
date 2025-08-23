// Package providers implements alert delivery providers
package providers

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/mantonx/volumeviz/internal/core/interfaces"
	"github.com/mantonx/volumeviz/internal/models"
)

// WebhookProvider implements alert delivery via HTTP webhooks
type WebhookProvider struct {
	httpClient  *http.Client
	renderer    interfaces.TemplateRenderer
	maxBodySize int
	timeout     time.Duration
}

// WebhookConfig defines configuration for webhook destinations
type WebhookConfig struct {
	URL            string            `json:"url" validate:"required,url"`
	Method         string            `json:"method,omitempty" validate:"omitempty,oneof=GET POST PUT PATCH"`
	Headers        map[string]string `json:"headers,omitempty"`
	ContentType    string            `json:"content_type,omitempty"`
	Template       string            `json:"template,omitempty"`
	TimeoutSeconds int               `json:"timeout_seconds,omitempty" validate:"omitempty,min=1,max=300"`
	Username       string            `json:"username,omitempty"`
	Password       string            `json:"password,omitempty"`
	InsecureSSL    bool              `json:"insecure_ssl,omitempty"`
	MaxRetries     int               `json:"max_retries,omitempty" validate:"omitempty,min=0,max=10"`
}

// WebhookPayload defines the default webhook payload structure
type WebhookPayload struct {
	Alert       AlertInfo         `json:"alert"`
	Rule        RuleInfo          `json:"rule"`
	Timestamp   time.Time         `json:"timestamp"`
	Status      string            `json:"status"`
	Value       *float64          `json:"value,omitempty"`
	Labels      map[string]string `json:"labels,omitempty"`
	Annotations map[string]string `json:"annotations,omitempty"`
}

// AlertInfo contains alert-specific information
type AlertInfo struct {
	ID         int64      `json:"id"`
	EntityID   string     `json:"entity_id"`
	EntityType string     `json:"entity_type"`
	StartsAt   time.Time  `json:"starts_at"`
	EndsAt     *time.Time `json:"ends_at,omitempty"`
}

// RuleInfo contains rule-specific information
type RuleInfo struct {
	ID          int64   `json:"id"`
	Name        string  `json:"name"`
	Description *string `json:"description,omitempty"`
	Query       string  `json:"query"`
	Condition   string  `json:"condition"`
	Threshold   float64 `json:"threshold"`
}

// NewWebhookProvider creates a new webhook provider
func NewWebhookProvider(renderer interfaces.TemplateRenderer) *WebhookProvider {
	return &WebhookProvider{
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
		renderer:    renderer,
		maxBodySize: 1024 * 1024, // 1MB max payload size
		timeout:     30 * time.Second,
	}
}

// GetType returns the provider type identifier
func (w *WebhookProvider) GetType() string {
	return models.ProviderTypeWebhook
}

// Validate validates the webhook configuration
func (w *WebhookProvider) Validate(config map[string]interface{}) error {
	var webhookConfig WebhookConfig

	// Convert map to struct
	configJSON, err := json.Marshal(config)
	if err != nil {
		return fmt.Errorf("failed to marshal webhook config: %w", err)
	}

	if err := json.Unmarshal(configJSON, &webhookConfig); err != nil {
		return fmt.Errorf("failed to unmarshal webhook config: %w", err)
	}

	// Validate required fields
	if webhookConfig.URL == "" {
		return fmt.Errorf("webhook URL is required")
	}

	// Set defaults
	if webhookConfig.Method == "" {
		webhookConfig.Method = "POST"
	}

	if webhookConfig.ContentType == "" && webhookConfig.Method != "GET" {
		webhookConfig.ContentType = "application/json"
	}

	// Validate method
	validMethods := map[string]bool{
		"GET": true, "POST": true, "PUT": true, "PATCH": true,
	}
	if !validMethods[webhookConfig.Method] {
		return fmt.Errorf("invalid HTTP method: %s", webhookConfig.Method)
	}

	// Validate template if provided
	if webhookConfig.Template != "" {
		if err := w.renderer.ValidateTemplate(webhookConfig.Template); err != nil {
			return fmt.Errorf("invalid template: %w", err)
		}
	}

	// Validate timeout
	if webhookConfig.TimeoutSeconds < 0 || webhookConfig.TimeoutSeconds > 300 {
		return fmt.Errorf("timeout must be between 1 and 300 seconds")
	}

	return nil
}

// Send delivers an alert via webhook
func (w *WebhookProvider) Send(ctx context.Context, destination *models.AlertDestination, alert *models.Alert) error {
	var webhookConfig WebhookConfig

	// Parse configuration
	configJSON, err := json.Marshal(destination.Config)
	if err != nil {
		return fmt.Errorf("failed to marshal webhook config: %w", err)
	}

	if err := json.Unmarshal(configJSON, &webhookConfig); err != nil {
		return fmt.Errorf("failed to parse webhook config: %w", err)
	}

	// Create payload
	payload, err := w.createPayload(alert, &webhookConfig)
	if err != nil {
		return fmt.Errorf("failed to create payload: %w", err)
	}

	// Send request
	return w.sendRequest(ctx, &webhookConfig, payload)
}

// Test sends a test message to verify the webhook configuration
func (w *WebhookProvider) Test(ctx context.Context, destination *models.AlertDestination, message string) error {
	var webhookConfig WebhookConfig

	// Parse configuration
	configJSON, err := json.Marshal(destination.Config)
	if err != nil {
		return fmt.Errorf("failed to marshal webhook config: %w", err)
	}

	if err := json.Unmarshal(configJSON, &webhookConfig); err != nil {
		return fmt.Errorf("failed to parse webhook config: %w", err)
	}

	// Create test payload
	testPayload := map[string]interface{}{
		"test":      true,
		"message":   message,
		"timestamp": time.Now(),
		"destination": map[string]interface{}{
			"id":   destination.ID,
			"name": destination.Name,
			"type": destination.Type,
		},
	}

	// Send test request
	return w.sendRequest(ctx, &webhookConfig, testPayload)
}

// createPayload creates the webhook payload
func (w *WebhookProvider) createPayload(alert *models.Alert, config *WebhookConfig) (interface{}, error) {
	// If custom template is provided, use it
	if config.Template != "" {
		alertContext := &models.AlertContext{
			Alert:       alert,
			Rule:        alert.Rule,
			Value:       alert.Value,
			Labels:      alert.Labels,
			Annotations: alert.Annotations,
		}

		rendered, err := w.renderer.Render(config.Template, alertContext)
		if err != nil {
			return nil, fmt.Errorf("failed to render template: %w", err)
		}

		// Try to parse as JSON, otherwise return as string
		var jsonPayload interface{}
		if err := json.Unmarshal([]byte(rendered), &jsonPayload); err == nil {
			return jsonPayload, nil
		}

		return map[string]interface{}{
			"message": rendered,
		}, nil
	}

	// Use default payload structure
	payload := WebhookPayload{
		Alert: AlertInfo{
			ID:         alert.ID,
			EntityID:   alert.EntityID,
			EntityType: alert.EntityType,
			StartsAt:   alert.StartsAt,
			EndsAt:     alert.EndsAt,
		},
		Timestamp:   time.Now(),
		Status:      alert.Status,
		Value:       alert.Value,
		Labels:      alert.Labels,
		Annotations: alert.Annotations,
	}

	// Add rule information if available
	if alert.Rule != nil {
		payload.Rule = RuleInfo{
			ID:          alert.Rule.ID,
			Name:        alert.Rule.Name,
			Description: alert.Rule.Description,
			Query:       alert.Rule.Query,
			Condition:   alert.Rule.Condition,
			Threshold:   alert.Rule.Threshold,
		}
	}

	return payload, nil
}

// sendRequest sends the HTTP request
func (w *WebhookProvider) sendRequest(ctx context.Context, config *WebhookConfig, payload interface{}) error {
	// Set timeout from config or use default
	timeout := w.timeout
	if config.TimeoutSeconds > 0 {
		timeout = time.Duration(config.TimeoutSeconds) * time.Second
	}

	// Create context with timeout
	ctx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()

	var req *http.Request
	var err error

	// Create request based on method
	if config.Method == "GET" {
		req, err = http.NewRequestWithContext(ctx, "GET", config.URL, nil)
		if err != nil {
			return fmt.Errorf("failed to create GET request: %w", err)
		}
	} else {
		// Marshal payload to JSON
		payloadBytes, err := json.Marshal(payload)
		if err != nil {
			return fmt.Errorf("failed to marshal payload: %w", err)
		}

		// Check payload size
		if len(payloadBytes) > w.maxBodySize {
			return fmt.Errorf("payload too large: %d bytes (max: %d)", len(payloadBytes), w.maxBodySize)
		}

		req, err = http.NewRequestWithContext(ctx, config.Method, config.URL, bytes.NewReader(payloadBytes))
		if err != nil {
			return fmt.Errorf("failed to create request: %w", err)
		}

		// Set content type
		contentType := config.ContentType
		if contentType == "" {
			contentType = "application/json"
		}
		req.Header.Set("Content-Type", contentType)
	}

	// Set custom headers
	for key, value := range config.Headers {
		req.Header.Set(key, value)
	}

	// Set basic auth if configured
	if config.Username != "" {
		req.SetBasicAuth(config.Username, config.Password)
	}

	// Send request
	client := w.httpClient
	if config.TimeoutSeconds > 0 {
		client = &http.Client{
			Timeout: time.Duration(config.TimeoutSeconds) * time.Second,
		}
	}

	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	// Check response status
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("webhook returned HTTP %d: %s", resp.StatusCode, resp.Status)
	}

	return nil
}

// SetHTTPClient allows setting a custom HTTP client for testing
func (w *WebhookProvider) SetHTTPClient(client *http.Client) {
	w.httpClient = client
}

// SetMaxBodySize sets the maximum payload size
func (w *WebhookProvider) SetMaxBodySize(size int) {
	w.maxBodySize = size
}

// SetDefaultTimeout sets the default timeout
func (w *WebhookProvider) SetDefaultTimeout(timeout time.Duration) {
	w.timeout = timeout
}
