// Package alerts implements template rendering for alert notifications
package alerts

import (
	"bytes"
	"fmt"
	"reflect"
	"strings"
	"text/template"
	"time"

	"github.com/mantonx/volumeviz/internal/core/interfaces"
	"github.com/mantonx/volumeviz/internal/models"
)

// SafeTemplateRenderer implements safe template rendering for alerts
type SafeTemplateRenderer struct {
	safeFields map[string]bool
	funcMap    template.FuncMap
}

// NewSafeTemplateRenderer creates a new safe template renderer
func NewSafeTemplateRenderer() interfaces.TemplateRenderer {
	renderer := &SafeTemplateRenderer{
		safeFields: make(map[string]bool),
		funcMap:    make(template.FuncMap),
	}

	// Define safe fields that can be accessed in templates
	renderer.defineSafeFields()

	// Define safe template functions
	renderer.defineSafeFunctions()

	return renderer
}

// Render renders a template with the given alert context
func (r *SafeTemplateRenderer) Render(templateStr string, context *models.AlertContext) (string, error) {
	// Create and parse template
	tmpl, err := template.New("alert").Funcs(r.funcMap).Parse(templateStr)
	if err != nil {
		return "", fmt.Errorf("failed to parse template: %w", err)
	}

	// Create safe context
	safeContext, err := r.createSafeContext(context)
	if err != nil {
		return "", fmt.Errorf("failed to create safe context: %w", err)
	}

	// Execute template
	var buf bytes.Buffer
	if err := tmpl.Execute(&buf, safeContext); err != nil {
		return "", fmt.Errorf("failed to execute template: %w", err)
	}

	return buf.String(), nil
}

// ValidateTemplate validates a template for syntax errors
func (r *SafeTemplateRenderer) ValidateTemplate(templateStr string) error {
	// Try to parse the template
	_, err := template.New("validation").Funcs(r.funcMap).Parse(templateStr)
	if err != nil {
		return fmt.Errorf("template syntax error: %w", err)
	}

	// Try to execute with a dummy context to catch runtime errors
	dummyContext := r.createDummyContext()
	tmpl, _ := template.New("validation").Funcs(r.funcMap).Parse(templateStr)

	var buf bytes.Buffer
	if err := tmpl.Execute(&buf, dummyContext); err != nil {
		// Check if it's a safe field access error
		if strings.Contains(err.Error(), "can't evaluate field") {
			return fmt.Errorf("template references unsafe field: %w", err)
		}
		return fmt.Errorf("template execution error: %w", err)
	}

	return nil
}

// GetSafeFields returns the list of safe fields available in templates
func (r *SafeTemplateRenderer) GetSafeFields() []string {
	var fields []string
	for field := range r.safeFields {
		fields = append(fields, field)
	}
	return fields
}

// defineSafeFields defines which fields are safe to access in templates
func (r *SafeTemplateRenderer) defineSafeFields() {
	// Alert fields
	r.safeFields["Alert.ID"] = true
	r.safeFields["Alert.EntityID"] = true
	r.safeFields["Alert.EntityType"] = true
	r.safeFields["Alert.Status"] = true
	r.safeFields["Alert.Value"] = true
	r.safeFields["Alert.StartsAt"] = true
	r.safeFields["Alert.EndsAt"] = true

	// Rule fields
	r.safeFields["Rule.ID"] = true
	r.safeFields["Rule.Name"] = true
	r.safeFields["Rule.Description"] = true
	r.safeFields["Rule.Query"] = true
	r.safeFields["Rule.Condition"] = true
	r.safeFields["Rule.Threshold"] = true
	r.safeFields["Rule.Interval"] = true

	// Labels and annotations (these are maps, so we allow access)
	r.safeFields["Labels"] = true
	r.safeFields["Annotations"] = true
	r.safeFields["Value"] = true
}

// defineSafeFunctions defines safe template functions
func (r *SafeTemplateRenderer) defineSafeFunctions() {
	r.funcMap["upper"] = strings.ToUpper
	r.funcMap["lower"] = strings.ToLower
	r.funcMap["title"] = strings.Title
	r.funcMap["trim"] = strings.TrimSpace
	r.funcMap["join"] = strings.Join

	// Time formatting functions
	r.funcMap["formatTime"] = r.formatTime
	r.funcMap["formatDuration"] = r.formatDuration
	r.funcMap["timeAgo"] = r.timeAgo
	r.funcMap["now"] = time.Now

	// Numeric functions
	r.funcMap["round"] = r.round
	r.funcMap["printf"] = fmt.Sprintf

	// Conditional functions
	r.funcMap["eq"] = r.eq
	r.funcMap["ne"] = r.ne
	r.funcMap["gt"] = r.gt
	r.funcMap["ge"] = r.ge
	r.funcMap["lt"] = r.lt
	r.funcMap["le"] = r.le

	// String functions
	r.funcMap["contains"] = strings.Contains
	r.funcMap["hasPrefix"] = strings.HasPrefix
	r.funcMap["hasSuffix"] = strings.HasSuffix
	r.funcMap["replace"] = strings.Replace

	// Safety functions
	r.funcMap["safeHTML"] = r.safeHTML
	r.funcMap["truncate"] = r.truncate
}

// createSafeContext creates a safe context from the alert context
func (r *SafeTemplateRenderer) createSafeContext(context *models.AlertContext) (map[string]interface{}, error) {
	if context == nil {
		return map[string]interface{}{}, nil
	}

	safeContext := make(map[string]interface{})

	// Add safe alert fields
	if context.Alert != nil {
		safeContext["Alert"] = map[string]interface{}{
			"ID":         context.Alert.ID,
			"EntityID":   context.Alert.EntityID,
			"EntityType": context.Alert.EntityType,
			"Status":     context.Alert.Status,
			"Value":      context.Alert.Value,
			"StartsAt":   context.Alert.StartsAt,
			"EndsAt":     context.Alert.EndsAt,
		}
	}

	// Add safe rule fields
	if context.Rule != nil {
		safeContext["Rule"] = map[string]interface{}{
			"ID":          context.Rule.ID,
			"Name":        context.Rule.Name,
			"Description": context.Rule.Description,
			"Query":       context.Rule.Query,
			"Condition":   context.Rule.Condition,
			"Threshold":   context.Rule.Threshold,
			"Interval":    context.Rule.Interval,
		}
	}

	// Add labels and annotations (sanitized)
	if context.Labels != nil {
		safeContext["Labels"] = r.sanitizeStringMap(context.Labels)
	}

	if context.Annotations != nil {
		safeContext["Annotations"] = r.sanitizeStringMap(context.Annotations)
	}

	// Add value
	safeContext["Value"] = context.Value

	return safeContext, nil
}

// createDummyContext creates a dummy context for template validation
func (r *SafeTemplateRenderer) createDummyContext() map[string]interface{} {
	now := time.Now()
	return map[string]interface{}{
		"Alert": map[string]interface{}{
			"ID":         int64(1),
			"EntityID":   "test-entity",
			"EntityType": "volume",
			"Status":     "firing",
			"Value":      float64(100.5),
			"StartsAt":   now,
			"EndsAt":     &now,
		},
		"Rule": map[string]interface{}{
			"ID":          int64(1),
			"Name":        "Test Rule",
			"Description": stringPtr("Test rule description"),
			"Query":       "test query",
			"Condition":   "gt",
			"Threshold":   50.0,
			"Interval":    time.Duration(5 * time.Minute),
		},
		"Labels": map[string]string{
			"env": "test",
		},
		"Annotations": map[string]string{
			"summary": "Test alert",
		},
		"Value": float64(100.5),
	}
}

// sanitizeStringMap sanitizes a string map for safe template use
func (r *SafeTemplateRenderer) sanitizeStringMap(m map[string]string) map[string]string {
	sanitized := make(map[string]string)
	for key, value := range m {
		// Basic sanitization - prevent script injection
		sanitizedKey := r.sanitizeString(key)
		sanitizedValue := r.sanitizeString(value)
		sanitized[sanitizedKey] = sanitizedValue
	}
	return sanitized
}

// sanitizeString performs basic string sanitization
func (r *SafeTemplateRenderer) sanitizeString(s string) string {
	// Remove potentially dangerous characters
	s = strings.ReplaceAll(s, "<script", "&lt;script")
	s = strings.ReplaceAll(s, "</script>", "&lt;/script&gt;")
	s = strings.ReplaceAll(s, "javascript:", "")
	s = strings.ReplaceAll(s, "vbscript:", "")
	s = strings.ReplaceAll(s, "onload=", "")
	s = strings.ReplaceAll(s, "onerror=", "")
	return s
}

// Template function implementations

func (r *SafeTemplateRenderer) formatTime(t time.Time, layout string) string {
	return t.Format(layout)
}

func (r *SafeTemplateRenderer) formatDuration(d time.Duration) string {
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

func (r *SafeTemplateRenderer) timeAgo(t time.Time) string {
	return r.formatDuration(time.Since(t))
}

func (r *SafeTemplateRenderer) round(f float64) int {
	if f < 0 {
		return int(f - 0.5)
	}
	return int(f + 0.5)
}

func (r *SafeTemplateRenderer) eq(a, b interface{}) bool {
	return reflect.DeepEqual(a, b)
}

func (r *SafeTemplateRenderer) ne(a, b interface{}) bool {
	return !reflect.DeepEqual(a, b)
}

func (r *SafeTemplateRenderer) gt(a, b interface{}) bool {
	return r.compare(a, b) > 0
}

func (r *SafeTemplateRenderer) ge(a, b interface{}) bool {
	return r.compare(a, b) >= 0
}

func (r *SafeTemplateRenderer) lt(a, b interface{}) bool {
	return r.compare(a, b) < 0
}

func (r *SafeTemplateRenderer) le(a, b interface{}) bool {
	return r.compare(a, b) <= 0
}

func (r *SafeTemplateRenderer) compare(a, b interface{}) int {
	va := reflect.ValueOf(a)
	vb := reflect.ValueOf(b)

	// Handle numeric comparisons
	if va.Kind() == reflect.Float64 && vb.Kind() == reflect.Float64 {
		af, bf := va.Float(), vb.Float()
		if af < bf {
			return -1
		} else if af > bf {
			return 1
		}
		return 0
	}

	// Handle string comparisons
	if va.Kind() == reflect.String && vb.Kind() == reflect.String {
		return strings.Compare(va.String(), vb.String())
	}

	return 0
}

func (r *SafeTemplateRenderer) safeHTML(s string) string {
	// Basic HTML escaping for safety
	s = strings.ReplaceAll(s, "&", "&amp;")
	s = strings.ReplaceAll(s, "<", "&lt;")
	s = strings.ReplaceAll(s, ">", "&gt;")
	s = strings.ReplaceAll(s, "\"", "&quot;")
	s = strings.ReplaceAll(s, "'", "&#39;")
	return s
}

func (r *SafeTemplateRenderer) truncate(s string, length int) string {
	if len(s) <= length {
		return s
	}

	if length <= 3 {
		return s[:length]
	}

	return s[:length-3] + "..."
}
