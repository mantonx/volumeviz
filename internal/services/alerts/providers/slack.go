// Package providers implements alert delivery providers
package providers

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/mantonx/volumeviz/internal/core/interfaces"
	"github.com/mantonx/volumeviz/internal/models"
)

// SlackProvider implements alert delivery via Slack webhooks
type SlackProvider struct {
	httpClient *http.Client
	renderer   interfaces.TemplateRenderer
}

// SlackConfig defines configuration for Slack destinations
type SlackConfig struct {
	WebhookURL  string            `json:"webhook_url" validate:"required,url"`
	Channel     string            `json:"channel,omitempty"`
	Username    string            `json:"username,omitempty"`
	IconEmoji   string            `json:"icon_emoji,omitempty"`
	IconURL     string            `json:"icon_url,omitempty"`
	Template    string            `json:"template,omitempty"`
	Color       string            `json:"color,omitempty"` // Color for attachment
	Fields      map[string]string `json:"fields,omitempty"` // Additional fields to include
}

// SlackMessage represents a Slack message payload
type SlackMessage struct {
	Channel     string            `json:"channel,omitempty"`
	Username    string            `json:"username,omitempty"`
	IconEmoji   string            `json:"icon_emoji,omitempty"`
	IconURL     string            `json:"icon_url,omitempty"`
	Text        string            `json:"text,omitempty"`
	Attachments []SlackAttachment `json:"attachments,omitempty"`
}

// SlackAttachment represents a Slack message attachment
type SlackAttachment struct {
	Color      string       `json:"color,omitempty"`
	Title      string       `json:"title,omitempty"`
	TitleLink  string       `json:"title_link,omitempty"`
	Text       string       `json:"text,omitempty"`
	Fields     []SlackField `json:"fields,omitempty"`
	Footer     string       `json:"footer,omitempty"`
	Timestamp  int64        `json:"ts,omitempty"`
	MarkdownIn []string     `json:"mrkdwn_in,omitempty"`
}

// SlackField represents a field in a Slack attachment
type SlackField struct {
	Title string `json:"title"`
	Value string `json:"value"`
	Short bool   `json:"short"`
}

// NewSlackProvider creates a new Slack provider
func NewSlackProvider(renderer interfaces.TemplateRenderer) *SlackProvider {
	return &SlackProvider{
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
		renderer: renderer,
	}
}

// GetType returns the provider type identifier
func (s *SlackProvider) GetType() string {
	return models.ProviderTypeSlack
}

// Validate validates the Slack configuration
func (s *SlackProvider) Validate(config map[string]interface{}) error {
	var slackConfig SlackConfig
	
	// Convert map to struct
	configJSON, err := json.Marshal(config)
	if err != nil {
		return fmt.Errorf("failed to marshal Slack config: %w", err)
	}
	
	if err := json.Unmarshal(configJSON, &slackConfig); err != nil {
		return fmt.Errorf("failed to unmarshal Slack config: %w", err)
	}
	
	// Validate required fields
	if slackConfig.WebhookURL == "" {
		return fmt.Errorf("Slack webhook URL is required")
	}
	
	if !strings.HasPrefix(slackConfig.WebhookURL, "https://hooks.slack.com/") {
		return fmt.Errorf("invalid Slack webhook URL format")
	}
	
	// Validate template if provided
	if slackConfig.Template != "" {
		if err := s.renderer.ValidateTemplate(slackConfig.Template); err != nil {
			return fmt.Errorf("invalid template: %w", err)
		}
	}
	
	// Validate channel format if provided
	if slackConfig.Channel != "" && !strings.HasPrefix(slackConfig.Channel, "#") && !strings.HasPrefix(slackConfig.Channel, "@") {
		return fmt.Errorf("channel must start with # or @")
	}
	
	return nil
}

// Send delivers an alert via Slack webhook
func (s *SlackProvider) Send(ctx context.Context, destination *models.AlertDestination, alert *models.Alert) error {
	var slackConfig SlackConfig
	
	// Parse configuration
	configJSON, err := json.Marshal(destination.Config)
	if err != nil {
		return fmt.Errorf("failed to marshal Slack config: %w", err)
	}
	
	if err := json.Unmarshal(configJSON, &slackConfig); err != nil {
		return fmt.Errorf("failed to parse Slack config: %w", err)
	}
	
	// Create message
	message, err := s.createMessage(alert, &slackConfig)
	if err != nil {
		return fmt.Errorf("failed to create Slack message: %w", err)
	}
	
	// Send message
	return s.sendMessage(ctx, &slackConfig, message)
}

// Test sends a test message to verify the Slack configuration
func (s *SlackProvider) Test(ctx context.Context, destination *models.AlertDestination, message string) error {
	var slackConfig SlackConfig
	
	// Parse configuration
	configJSON, err := json.Marshal(destination.Config)
	if err != nil {
		return fmt.Errorf("failed to marshal Slack config: %w", err)
	}
	
	if err := json.Unmarshal(configJSON, &slackConfig); err != nil {
		return fmt.Errorf("failed to parse Slack config: %w", err)
	}
	
	// Create test message
	testMessage := SlackMessage{
		Channel:   slackConfig.Channel,
		Username:  slackConfig.Username,
		IconEmoji: slackConfig.IconEmoji,
		IconURL:   slackConfig.IconURL,
		Text:      fmt.Sprintf("🧪 Test message from VolumeViz: %s", message),
		Attachments: []SlackAttachment{
			{
				Color: "good",
				Fields: []SlackField{
					{
						Title: "Destination",
						Value: destination.Name,
						Short: true,
					},
					{
						Title: "Test Time",
						Value: time.Now().Format(time.RFC3339),
						Short: true,
					},
				},
				Footer:    "VolumeViz Alerts",
				Timestamp: time.Now().Unix(),
			},
		},
	}
	
	// Send test message
	return s.sendMessage(ctx, &slackConfig, &testMessage)
}

// createMessage creates a Slack message from an alert
func (s *SlackProvider) createMessage(alert *models.Alert, config *SlackConfig) (*SlackMessage, error) {
	// If custom template is provided, use it
	if config.Template != "" {
		alertContext := &models.AlertContext{
			Alert:       alert,
			Rule:        alert.Rule,
			Value:       alert.Value,
			Labels:      alert.Labels,
			Annotations: alert.Annotations,
		}
		
		rendered, err := s.renderer.Render(config.Template, alertContext)
		if err != nil {
			return nil, fmt.Errorf("failed to render template: %w", err)
		}
		
		return &SlackMessage{
			Channel:   config.Channel,
			Username:  config.Username,
			IconEmoji: config.IconEmoji,
			IconURL:   config.IconURL,
			Text:      rendered,
		}, nil
	}
	
	// Create default message structure
	message := &SlackMessage{
		Channel:   config.Channel,
		Username:  config.Username,
		IconEmoji: config.IconEmoji,
		IconURL:   config.IconURL,
	}
	
	// Set default username and icon if not configured
	if message.Username == "" {
		message.Username = "VolumeViz"
	}
	
	if message.IconEmoji == "" && message.IconURL == "" {
		message.IconEmoji = ":warning:"
	}
	
	// Determine color based on alert status
	color := s.getColorForStatus(alert.Status, config.Color)
	
	// Create alert title
	title := s.getAlertTitle(alert)
	
	// Create attachment
	attachment := SlackAttachment{
		Color:      color,
		Title:      title,
		Text:       s.getAlertText(alert),
		Fields:     s.getAlertFields(alert, config.Fields),
		Footer:     "VolumeViz Alerts",
		Timestamp:  alert.StartsAt.Unix(),
		MarkdownIn: []string{"text", "fields"},
	}
	
	message.Attachments = []SlackAttachment{attachment}
	
	return message, nil
}

// getColorForStatus returns the appropriate color for an alert status
func (s *SlackProvider) getColorForStatus(status, configColor string) string {
	if configColor != "" {
		return configColor
	}
	
	switch status {
	case models.AlertStatusFiring:
		return "danger"
	case models.AlertStatusResolved:
		return "good"
	default:
		return "warning"
	}
}

// getAlertTitle creates a title for the alert
func (s *SlackProvider) getAlertTitle(alert *models.Alert) string {
	status := "🔥 FIRING"
	if alert.Status == models.AlertStatusResolved {
		status = "✅ RESOLVED"
	}
	
	ruleName := "Unknown Rule"
	if alert.Rule != nil && alert.Rule.Name != "" {
		ruleName = alert.Rule.Name
	}
	
	return fmt.Sprintf("%s - %s", status, ruleName)
}

// getAlertText creates descriptive text for the alert
func (s *SlackProvider) getAlertText(alert *models.Alert) string {
	var parts []string
	
	// Add entity information
	parts = append(parts, fmt.Sprintf("*Entity:* %s (%s)", alert.EntityID, alert.EntityType))
	
	// Add value if available
	if alert.Value != nil {
		parts = append(parts, fmt.Sprintf("*Value:* %.2f", *alert.Value))
	}
	
	// Add rule condition if available
	if alert.Rule != nil {
		condition := fmt.Sprintf("*Condition:* %s %.2f", alert.Rule.Condition, alert.Rule.Threshold)
		parts = append(parts, condition)
	}
	
	// Add duration for firing alerts
	if alert.Status == models.AlertStatusFiring {
		duration := time.Since(alert.StartsAt)
		parts = append(parts, fmt.Sprintf("*Duration:* %s", s.formatDuration(duration)))
	}
	
	return strings.Join(parts, "\n")
}

// getAlertFields creates fields for the Slack attachment
func (s *SlackProvider) getAlertFields(alert *models.Alert, configFields map[string]string) []SlackField {
	var fields []SlackField
	
	// Add rule description if available
	if alert.Rule != nil && alert.Rule.Description != nil && *alert.Rule.Description != "" {
		fields = append(fields, SlackField{
			Title: "Description",
			Value: *alert.Rule.Description,
			Short: false,
		})
	}
	
	// Add labels as fields
	for key, value := range alert.Labels {
		fields = append(fields, SlackField{
			Title: fmt.Sprintf("Label: %s", key),
			Value: value,
			Short: true,
		})
	}
	
	// Add annotations as fields
	for key, value := range alert.Annotations {
		fields = append(fields, SlackField{
			Title: fmt.Sprintf("Annotation: %s", key),
			Value: value,
			Short: true,
		})
	}
	
	// Add custom fields from config
	for key, value := range configFields {
		fields = append(fields, SlackField{
			Title: key,
			Value: value,
			Short: true,
		})
	}
	
	// Add timestamps
	fields = append(fields, SlackField{
		Title: "Started At",
		Value: alert.StartsAt.Format("2006-01-02 15:04:05 UTC"),
		Short: true,
	})
	
	if alert.EndsAt != nil {
		fields = append(fields, SlackField{
			Title: "Ended At", 
			Value: alert.EndsAt.Format("2006-01-02 15:04:05 UTC"),
			Short: true,
		})
	}
	
	return fields
}

// sendMessage sends the Slack message
func (s *SlackProvider) sendMessage(ctx context.Context, config *SlackConfig, message *SlackMessage) error {
	// Marshal message to JSON
	messageBytes, err := json.Marshal(message)
	if err != nil {
		return fmt.Errorf("failed to marshal Slack message: %w", err)
	}
	
	// Create HTTP request
	req, err := http.NewRequestWithContext(ctx, "POST", config.WebhookURL, bytes.NewReader(messageBytes))
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}
	
	req.Header.Set("Content-Type", "application/json")
	
	// Send request
	resp, err := s.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()
	
	// Check response status
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("Slack webhook returned HTTP %d: %s", resp.StatusCode, resp.Status)
	}
	
	return nil
}

// formatDuration formats a duration in a human-readable way
func (s *SlackProvider) formatDuration(d time.Duration) string {
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
func (s *SlackProvider) SetHTTPClient(client *http.Client) {
	s.httpClient = client
}