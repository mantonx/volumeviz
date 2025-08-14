// Package providers implements alert delivery providers
package providers

import (
	"context"
	"fmt"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/mantonx/volumeviz/internal/core/interfaces"
	"github.com/mantonx/volumeviz/internal/models"
)

// PushoverProvider implements alert delivery via Pushover
type PushoverProvider struct {
	httpClient *http.Client
	renderer   interfaces.TemplateRenderer
	apiURL     string
}

// PushoverConfig defines configuration for Pushover destinations
type PushoverConfig struct {
	APIToken    string `json:"api_token" validate:"required"`
	UserKey     string `json:"user_key" validate:"required"`
	Device      string `json:"device,omitempty"`
	Priority    int    `json:"priority,omitempty" validate:"min=-2,max=2"`
	Sound       string `json:"sound,omitempty"`
	Title       string `json:"title,omitempty"`
	URL         string `json:"url,omitempty"`
	URLTitle    string `json:"url_title,omitempty"`
	Template    string `json:"template,omitempty"`
	RetryPeriod int    `json:"retry_period,omitempty" validate:"omitempty,min=30"`
	ExpireTime  int    `json:"expire_time,omitempty" validate:"omitempty,min=0,max=10800"`
	HTML        bool   `json:"html,omitempty"`
}

// Priority constants for Pushover
const (
	PushoverPriorityLowest  = -2
	PushoverPriorityLow     = -1
	PushoverPriorityNormal  = 0
	PushoverPriorityHigh    = 1
	PushoverPriorityEmergency = 2
)

// Sound constants for Pushover
var PushoverSounds = []string{
	"pushover", "bike", "bugle", "cashregister", "classical", "cosmic",
	"falling", "gamelan", "incoming", "intermission", "magic", "mechanical",
	"pianobar", "siren", "spacealarm", "tugboat", "alien", "climb",
	"persistent", "echo", "updown", "vibrate", "none",
}

// NewPushoverProvider creates a new Pushover provider
func NewPushoverProvider(renderer interfaces.TemplateRenderer) *PushoverProvider {
	return &PushoverProvider{
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
		renderer: renderer,
		apiURL:   "https://api.pushover.net/1/messages.json",
	}
}

// GetType returns the provider type identifier
func (p *PushoverProvider) GetType() string {
	return models.ProviderTypePushover
}

// Validate validates the Pushover configuration
func (p *PushoverProvider) Validate(config map[string]interface{}) error {
	// Extract and validate configuration
	apiToken, ok := config["api_token"].(string)
	if !ok || apiToken == "" {
		return fmt.Errorf("Pushover API token is required")
	}
	
	userKey, ok := config["user_key"].(string)
	if !ok || userKey == "" {
		return fmt.Errorf("Pushover user key is required")
	}
	
	// Validate API token format (30 characters, alphanumeric)
	if len(apiToken) != 30 {
		return fmt.Errorf("invalid Pushover API token format")
	}
	
	// Validate user key format (30 characters, alphanumeric)
	if len(userKey) != 30 {
		return fmt.Errorf("invalid Pushover user key format")
	}
	
	// Validate priority if provided
	if priority, ok := config["priority"]; ok {
		var priorityInt int
		switch v := priority.(type) {
		case int:
			priorityInt = v
		case float64:
			priorityInt = int(v)
		case string:
			var err error
			priorityInt, err = strconv.Atoi(v)
			if err != nil {
				return fmt.Errorf("invalid priority format: must be integer between -2 and 2")
			}
		default:
			return fmt.Errorf("invalid priority format: must be integer between -2 and 2")
		}
		
		if priorityInt < -2 || priorityInt > 2 {
			return fmt.Errorf("priority must be between -2 and 2")
		}
		
		// Validate emergency priority requirements
		if priorityInt == PushoverPriorityEmergency {
			retryPeriod, hasRetry := config["retry_period"]
			expireTime, hasExpire := config["expire_time"]
			
			if !hasRetry || !hasExpire {
				return fmt.Errorf("emergency priority requires retry_period and expire_time")
			}
			
			// Validate retry period
			var retryInt int
			switch v := retryPeriod.(type) {
			case int:
				retryInt = v
			case float64:
				retryInt = int(v)
			default:
				return fmt.Errorf("retry_period must be integer >= 30")
			}
			
			if retryInt < 30 {
				return fmt.Errorf("retry_period must be at least 30 seconds for emergency priority")
			}
			
			// Validate expire time
			var expireInt int
			switch v := expireTime.(type) {
			case int:
				expireInt = v
			case float64:
				expireInt = int(v)
			default:
				return fmt.Errorf("expire_time must be integer between 0 and 10800")
			}
			
			if expireInt <= 0 || expireInt > 10800 {
				return fmt.Errorf("expire_time must be between 1 and 10800 seconds")
			}
		}
	}
	
	// Validate sound if provided
	if sound, ok := config["sound"].(string); ok && sound != "" {
		validSound := false
		for _, validSnd := range PushoverSounds {
			if sound == validSnd {
				validSound = true
				break
			}
		}
		if !validSound {
			return fmt.Errorf("invalid sound: must be one of %v", PushoverSounds)
		}
	}
	
	// Validate template if provided
	if template, ok := config["template"].(string); ok && template != "" {
		if err := p.renderer.ValidateTemplate(template); err != nil {
			return fmt.Errorf("invalid template: %w", err)
		}
	}
	
	return nil
}

// Send delivers an alert via Pushover
func (p *PushoverProvider) Send(ctx context.Context, destination *models.AlertDestination, alert *models.Alert) error {
	// Create message
	message, err := p.createMessage(alert, destination.Config)
	if err != nil {
		return fmt.Errorf("failed to create Pushover message: %w", err)
	}
	
	// Send message
	return p.sendMessage(ctx, message)
}

// Test sends a test message to verify the Pushover configuration
func (p *PushoverProvider) Test(ctx context.Context, destination *models.AlertDestination, message string) error {
	apiToken, _ := destination.Config["api_token"].(string)
	userKey, _ := destination.Config["user_key"].(string)
	
	// Create test message
	testMessage := url.Values{
		"token":   {apiToken},
		"user":    {userKey},
		"message": {fmt.Sprintf("🧪 Test message from VolumeViz: %s", message)},
		"title":   {"VolumeViz Test"},
	}
	
	// Add optional device if configured
	if device, ok := destination.Config["device"].(string); ok && device != "" {
		testMessage.Set("device", device)
	}
	
	// Send test message
	return p.sendMessage(ctx, testMessage)
}

// createMessage creates a Pushover message from an alert
func (p *PushoverProvider) createMessage(alert *models.Alert, config map[string]interface{}) (url.Values, error) {
	apiToken, _ := config["api_token"].(string)
	userKey, _ := config["user_key"].(string)
	
	// Start with basic message
	message := url.Values{
		"token": {apiToken},
		"user":  {userKey},
	}
	
	// Handle custom template
	if template, ok := config["template"].(string); ok && template != "" {
		alertContext := &models.AlertContext{
			Alert:       alert,
			Rule:        alert.Rule,
			Value:       alert.Value,
			Labels:      alert.Labels,
			Annotations: alert.Annotations,
		}
		
		rendered, err := p.renderer.Render(template, alertContext)
		if err != nil {
			return nil, fmt.Errorf("failed to render template: %w", err)
		}
		
		message.Set("message", rendered)
	} else {
		// Create default message
		messageText := p.createDefaultMessage(alert)
		message.Set("message", messageText)
	}
	
	// Set title
	title := p.getTitle(alert, config)
	message.Set("title", title)
	
	// Set priority based on alert status
	priority := p.getPriority(alert, config)
	message.Set("priority", strconv.Itoa(priority))
	
	// Add optional parameters
	if device, ok := config["device"].(string); ok && device != "" {
		message.Set("device", device)
	}
	
	if sound, ok := config["sound"].(string); ok && sound != "" {
		message.Set("sound", sound)
	}
	
	if urlStr, ok := config["url"].(string); ok && urlStr != "" {
		message.Set("url", urlStr)
		
		if urlTitle, ok := config["url_title"].(string); ok && urlTitle != "" {
			message.Set("url_title", urlTitle)
		}
	}
	
	// Handle emergency priority settings
	if priority == PushoverPriorityEmergency {
		if retryPeriod, ok := config["retry_period"]; ok {
			message.Set("retry", fmt.Sprintf("%v", retryPeriod))
		}
		
		if expireTime, ok := config["expire_time"]; ok {
			message.Set("expire", fmt.Sprintf("%v", expireTime))
		}
	}
	
	// Enable HTML if configured
	if html, ok := config["html"].(bool); ok && html {
		message.Set("html", "1")
	}
	
	return message, nil
}

// createDefaultMessage creates a default message text for an alert
func (p *PushoverProvider) createDefaultMessage(alert *models.Alert) string {
	var parts []string
	
	// Alert status
	status := "FIRING"
	if alert.Status == models.AlertStatusResolved {
		status = "RESOLVED"
	}
	parts = append(parts, fmt.Sprintf("Status: %s", status))
	
	// Entity information
	parts = append(parts, fmt.Sprintf("Entity: %s (%s)", alert.EntityID, alert.EntityType))
	
	// Value if available
	if alert.Value != nil {
		parts = append(parts, fmt.Sprintf("Value: %.2f", *alert.Value))
	}
	
	// Rule condition if available
	if alert.Rule != nil {
		parts = append(parts, fmt.Sprintf("Threshold: %s %.2f", alert.Rule.Condition, alert.Rule.Threshold))
	}
	
	// Duration for firing alerts
	if alert.Status == models.AlertStatusFiring {
		duration := time.Since(alert.StartsAt)
		parts = append(parts, fmt.Sprintf("Duration: %s", p.formatDuration(duration)))
	}
	
	// Labels
	if len(alert.Labels) > 0 {
		var labels []string
		for key, value := range alert.Labels {
			labels = append(labels, fmt.Sprintf("%s=%s", key, value))
		}
		parts = append(parts, fmt.Sprintf("Labels: %s", strings.Join(labels, ", ")))
	}
	
	return strings.Join(parts, "\n")
}

// getTitle determines the message title
func (p *PushoverProvider) getTitle(alert *models.Alert, config map[string]interface{}) string {
	if title, ok := config["title"].(string); ok && title != "" {
		return title
	}
	
	// Default title based on rule name and status
	ruleName := "Unknown Rule"
	if alert.Rule != nil && alert.Rule.Name != "" {
		ruleName = alert.Rule.Name
	}
	
	status := "🔥"
	if alert.Status == models.AlertStatusResolved {
		status = "✅"
	}
	
	return fmt.Sprintf("%s %s", status, ruleName)
}

// getPriority determines the message priority
func (p *PushoverProvider) getPriority(alert *models.Alert, config map[string]interface{}) int {
	// Use configured priority if available
	if priority, ok := config["priority"]; ok {
		switch v := priority.(type) {
		case int:
			return v
		case float64:
			return int(v)
		case string:
			if priorityInt, err := strconv.Atoi(v); err == nil {
				return priorityInt
			}
		}
	}
	
	// Default priority based on alert status
	switch alert.Status {
	case models.AlertStatusFiring:
		return PushoverPriorityHigh
	case models.AlertStatusResolved:
		return PushoverPriorityNormal
	default:
		return PushoverPriorityNormal
	}
}

// sendMessage sends the message to Pushover
func (p *PushoverProvider) sendMessage(ctx context.Context, message url.Values) error {
	// Create HTTP request
	req, err := http.NewRequestWithContext(ctx, "POST", p.apiURL, strings.NewReader(message.Encode()))
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}
	
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	
	// Send request
	resp, err := p.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()
	
	// Check response status
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("Pushover API returned HTTP %d: %s", resp.StatusCode, resp.Status)
	}
	
	return nil
}

// formatDuration formats a duration in a human-readable way
func (p *PushoverProvider) formatDuration(d time.Duration) string {
	if d < time.Minute {
		return fmt.Sprintf("%ds", int(d.Seconds()))
	} else if d < time.Hour {
		return fmt.Sprintf("%dm", int(d.Minutes()))
	} else if d < 24*time.Hour {
		return fmt.Sprintf("%dh %dm", int(d.Hours()), int(d.Minutes())%60)
	} else {
		days := int(d.Hours()) / 24
		hours := int(d.Hours()) % 24
		return fmt.Sprintf("%dd %dh", days, hours)
	}
}

// SetHTTPClient allows setting a custom HTTP client for testing
func (p *PushoverProvider) SetHTTPClient(client *http.Client) {
	p.httpClient = client
}

// SetAPIURL allows setting a custom API URL for testing
func (p *PushoverProvider) SetAPIURL(url string) {
	p.apiURL = url
}