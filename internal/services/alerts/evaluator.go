// Package alerts implements alert evaluation logic
package alerts

import (
	"context"
	"fmt"
	"log"
	"strconv"
	"strings"
	"time"

	"github.com/mantonx/volumeviz/internal/core/interfaces"
	"github.com/mantonx/volumeviz/internal/models"
	"github.com/mantonx/volumeviz/internal/store"
)

// AlertEvaluator evaluates alert rules against metrics
type AlertEvaluator struct {
	store        store.Store
	deduplicator interfaces.Deduplicator
	router       interfaces.AlertRouter
	delivery     interfaces.AlertDeliveryService
}

// NewAlertEvaluator creates a new alert evaluator
func NewAlertEvaluator(
	store store.Store,
	deduplicator interfaces.Deduplicator,
	router interfaces.AlertRouter,
	delivery interfaces.AlertDeliveryService,
) interfaces.AlertEvaluator {
	return &AlertEvaluator{
		store:        store,
		deduplicator: deduplicator,
		router:       router,
		delivery:     delivery,
	}
}

// EvaluateRules evaluates all enabled alert rules
func (e *AlertEvaluator) EvaluateRules(ctx context.Context) error {
	rules, err := e.store.Alerts().ListEnabledAlertRules(ctx)
	if err != nil {
		return fmt.Errorf("failed to fetch enabled alert rules: %w", err)
	}

	log.Printf("Evaluating %d alert rules", len(rules))

	for _, rule := range rules {
		if err := e.EvaluateRule(ctx, rule); err != nil {
			log.Printf("Failed to evaluate rule %s: %v", rule.Name, err)
			// Continue evaluating other rules
		}
	}

	return nil
}

// EvaluateRule evaluates a single alert rule
func (e *AlertEvaluator) EvaluateRule(ctx context.Context, rule *models.AlertRule) error {
	// Execute the rule's query to get metrics
	metrics, err := e.executeQuery(ctx, rule.Query)
	if err != nil {
		return fmt.Errorf("failed to execute query for rule %s: %w", rule.Name, err)
	}

	// Check each metric result against the rule's condition
	for _, metric := range metrics {
		if err := e.evaluateMetric(ctx, rule, metric); err != nil {
			log.Printf("Failed to evaluate metric %v for rule %s: %v", metric, rule.Name, err)
			// Continue with other metrics
		}
	}

	return nil
}

// MetricResult represents a single metric result
type MetricResult struct {
	EntityType string            `json:"entity_type"`
	EntityID   string            `json:"entity_id"`
	Value      float64           `json:"value"`
	Timestamp  time.Time         `json:"timestamp"`
	Labels     map[string]string `json:"labels,omitempty"`
}

// executeQuery executes a metric query and returns results
func (e *AlertEvaluator) executeQuery(ctx context.Context, query string) ([]*MetricResult, error) {
	// This is a simplified implementation
	// In a real system, this would integrate with your metrics backend
	// For now, we'll simulate some metrics based on the query

	var results []*MetricResult

	// Parse the query to determine what metrics to fetch
	queryLower := strings.ToLower(query)

	switch {
	case strings.Contains(queryLower, "volume_usage"):
		// Simulate volume usage metrics
		results = e.simulateVolumeUsageMetrics(ctx)
	case strings.Contains(queryLower, "disk_space"):
		// Simulate disk space metrics
		results = e.simulateDiskSpaceMetrics(ctx)
	case strings.Contains(queryLower, "file_count"):
		// Simulate file count metrics
		results = e.simulateFileCountMetrics(ctx)
	default:
		// Generic simulation
		results = e.simulateGenericMetrics(ctx, query)
	}

	return results, nil
}

// simulateVolumeUsageMetrics simulates volume usage metrics for demonstration
func (e *AlertEvaluator) simulateVolumeUsageMetrics(ctx context.Context) []*MetricResult {
	// This would typically query your metrics database or time series DB
	// For demonstration, we'll return some sample data
	return []*MetricResult{
		{
			EntityType: "volume",
			EntityID:   "vol_123",
			Value:      85.5,
			Timestamp:  time.Now(),
			Labels: map[string]string{
				"volume_name": "data-volume",
				"mount_point": "/data",
				"severity":    "warning",
			},
		},
		{
			EntityType: "volume",
			EntityID:   "vol_456",
			Value:      95.2,
			Timestamp:  time.Now(),
			Labels: map[string]string{
				"volume_name": "logs-volume",
				"mount_point": "/var/log",
				"severity":    "critical",
			},
		},
	}
}

// simulateDiskSpaceMetrics simulates disk space metrics
func (e *AlertEvaluator) simulateDiskSpaceMetrics(ctx context.Context) []*MetricResult {
	return []*MetricResult{
		{
			EntityType: "volume",
			EntityID:   "vol_789",
			Value:      78.3,
			Timestamp:  time.Now(),
			Labels: map[string]string{
				"volume_name": "backup-volume",
				"mount_point": "/backup",
				"severity":    "warning",
			},
		},
	}
}

// simulateFileCountMetrics simulates file count metrics
func (e *AlertEvaluator) simulateFileCountMetrics(ctx context.Context) []*MetricResult {
	return []*MetricResult{
		{
			EntityType: "directory",
			EntityID:   "dir_tmp",
			Value:      15000,
			Timestamp:  time.Now(),
			Labels: map[string]string{
				"directory": "/tmp",
				"severity":  "info",
			},
		},
	}
}

// simulateGenericMetrics simulates generic metrics based on query
func (e *AlertEvaluator) simulateGenericMetrics(ctx context.Context, query string) []*MetricResult {
	return []*MetricResult{
		{
			EntityType: "system",
			EntityID:   "localhost",
			Value:      42.0,
			Timestamp:  time.Now(),
			Labels: map[string]string{
				"query":    query,
				"severity": "info",
			},
		},
	}
}

// evaluateMetric evaluates a single metric against a rule's condition
func (e *AlertEvaluator) evaluateMetric(ctx context.Context, rule *models.AlertRule, metric *MetricResult) error {
	// Check if the metric violates the rule's condition
	shouldFire, err := e.evaluateCondition(rule, metric.Value)
	if err != nil {
		return fmt.Errorf("failed to evaluate condition: %w", err)
	}

	if !shouldFire {
		// Check if we need to resolve an existing alert
		return e.checkResolveAlert(ctx, rule, metric)
	}

	// Generate deduplication key
	dedupeKey := e.deduplicator.GenerateKey(rule, metric.EntityID, metric.EntityType, &metric.Value, metric.Labels)

	// Check if this alert should be suppressed (deduplicated)
	shouldSuppress, err := e.deduplicator.ShouldSuppress(ctx, &models.Alert{
		RuleID:     rule.ID,
		EntityID:   metric.EntityID,
		EntityType: metric.EntityType,
		DedupeKey:  dedupeKey,
		Status:     models.AlertStatusFiring,
	})
	if err != nil {
		return fmt.Errorf("failed to check deduplication: %w", err)
	}

	if shouldSuppress {
		log.Printf("Alert suppressed due to deduplication: rule=%s, entity=%s", rule.Name, metric.EntityID)
		return nil
	}

	// Create and fire the alert
	alert := &models.Alert{
		RuleID:      rule.ID,
		EntityID:    metric.EntityID,
		EntityType:  metric.EntityType,
		DedupeKey:   dedupeKey,
		Status:      models.AlertStatusFiring,
		Value:       &metric.Value,
		StartsAt:    metric.Timestamp,
		Labels:      metric.Labels,
		Annotations: e.generateAnnotations(rule, metric),
		Rule:        rule, // Include rule for routing
	}

	// Create alert in database
	createdAlert, err := e.store.Alerts().CreateAlert(ctx, alert)
	if err != nil {
		return fmt.Errorf("failed to create alert: %w", err)
	}

	log.Printf("Alert fired: rule=%s, entity=%s, value=%.2f", rule.Name, metric.EntityID, metric.Value)

	// Route and deliver the alert
	if err := e.routeAndDeliverAlert(ctx, createdAlert); err != nil {
		log.Printf("Failed to route/deliver alert: %v", err)
		// Don't return error as the alert was created successfully
	}

	return nil
}

// evaluateCondition evaluates if a metric value meets the alert condition
func (e *AlertEvaluator) evaluateCondition(rule *models.AlertRule, value float64) (bool, error) {
	switch rule.Condition {
	case models.AlertConditionGreater:
		return value > rule.Threshold, nil
	case models.AlertConditionGreaterEqual:
		return value >= rule.Threshold, nil
	case models.AlertConditionLess:
		return value < rule.Threshold, nil
	case models.AlertConditionLessEqual:
		return value <= rule.Threshold, nil
	case models.AlertConditionEqual:
		return value == rule.Threshold, nil
	case models.AlertConditionNotEqual:
		return value != rule.Threshold, nil
	default:
		return false, fmt.Errorf("unknown condition: %s", rule.Condition)
	}
}

// checkResolveAlert checks if an existing alert should be resolved
func (e *AlertEvaluator) checkResolveAlert(ctx context.Context, rule *models.AlertRule, metric *MetricResult) error {
	// Generate the same deduplication key to find existing alerts
	dedupeKey := e.deduplicator.GenerateKey(rule, metric.EntityID, metric.EntityType, &metric.Value, metric.Labels)

	// Try to resolve any existing firing alert with this dedupe key
	err := e.store.Alerts().ResolveAlert(ctx, rule.ID, metric.EntityID, dedupeKey)
	if err != nil {
		// It's okay if no alert was found to resolve
		log.Printf("No alert to resolve for rule=%s, entity=%s", rule.Name, metric.EntityID)
	} else {
		log.Printf("Alert resolved: rule=%s, entity=%s, value=%.2f", rule.Name, metric.EntityID, metric.Value)
	}

	return nil
}

// generateAnnotations generates annotations for an alert
func (e *AlertEvaluator) generateAnnotations(rule *models.AlertRule, metric *MetricResult) map[string]string {
	annotations := make(map[string]string)

	// Add basic annotations
	annotations["summary"] = fmt.Sprintf("Alert %s triggered", rule.Name)
	annotations["description"] = e.generateDescription(rule, metric)
	annotations["runbook_url"] = fmt.Sprintf("/alerts/rules/%d/runbook", rule.ID)
	annotations["dashboard_url"] = fmt.Sprintf("/volumes/%s", metric.EntityID)

	// Add rule-specific annotations
	if rule.Description != nil {
		annotations["rule_description"] = *rule.Description
	}

	// Add value information
	annotations["current_value"] = fmt.Sprintf("%.2f", metric.Value)
	annotations["threshold"] = fmt.Sprintf("%.2f", rule.Threshold)
	annotations["condition"] = rule.Condition

	// Add timestamp
	annotations["fired_at"] = metric.Timestamp.Format(time.RFC3339)

	return annotations
}

// generateDescription generates a human-readable description for an alert
func (e *AlertEvaluator) generateDescription(rule *models.AlertRule, metric *MetricResult) string {
	return fmt.Sprintf(
		"Alert '%s' has been triggered. The current value is %.2f, which %s the threshold of %.2f for %s '%s'.",
		rule.Name,
		metric.Value,
		e.getConditionDescription(rule.Condition),
		rule.Threshold,
		metric.EntityType,
		metric.EntityID,
	)
}

// getConditionDescription returns a human-readable condition description
func (e *AlertEvaluator) getConditionDescription(condition string) string {
	switch condition {
	case models.AlertConditionGreater:
		return "exceeds"
	case models.AlertConditionGreaterEqual:
		return "meets or exceeds"
	case models.AlertConditionLess:
		return "is below"
	case models.AlertConditionLessEqual:
		return "is at or below"
	case models.AlertConditionEqual:
		return "equals"
	case models.AlertConditionNotEqual:
		return "does not equal"
	default:
		return "meets the condition relative to"
	}
}

// routeAndDeliverAlert routes an alert to appropriate destinations and queues deliveries
func (e *AlertEvaluator) routeAndDeliverAlert(ctx context.Context, alert *models.Alert) error {
	// Find matching routes for this alert
	routes, err := e.router.Route(ctx, alert)
	if err != nil {
		return fmt.Errorf("failed to route alert: %w", err)
	}

	if len(routes) == 0 {
		log.Printf("No routes found for alert: rule=%s, entity=%s", alert.Rule.Name, alert.EntityID)
		return nil
	}

	log.Printf("Found %d routes for alert: rule=%s, entity=%s", len(routes), alert.Rule.Name, alert.EntityID)

	// Create deliveries for each matching route
	for _, route := range routes {
		if err := e.delivery.QueueDelivery(ctx, alert.ID, route.DestinationID, route.ID); err != nil {
			log.Printf("Failed to queue delivery for route %s: %v", route.Name, err)
			// Continue with other routes
		}
	}

	return nil
}

// EvaluationStats provides statistics about rule evaluation
type EvaluationStats struct {
	RulesEvaluated   int           `json:"rules_evaluated"`
	MetricsProcessed int           `json:"metrics_processed"`
	AlertsFired      int           `json:"alerts_fired"`
	AlertsResolved   int           `json:"alerts_resolved"`
	AlertsSuppressed int           `json:"alerts_suppressed"`
	EvaluationTime   time.Duration `json:"evaluation_time"`
	Errors           []string      `json:"errors,omitempty"`
}

// EvaluateRulesWithStats evaluates all rules and returns statistics
func (e *AlertEvaluator) EvaluateRulesWithStats(ctx context.Context) (*EvaluationStats, error) {
	startTime := time.Now()
	stats := &EvaluationStats{}

	rules, err := e.store.Alerts().ListEnabledAlertRules(ctx)
	if err != nil {
		return stats, fmt.Errorf("failed to fetch enabled alert rules: %w", err)
	}

	stats.RulesEvaluated = len(rules)

	for _, rule := range rules {
		if err := e.EvaluateRule(ctx, rule); err != nil {
			stats.Errors = append(stats.Errors, fmt.Sprintf("Rule %s: %v", rule.Name, err))
		}
	}

	stats.EvaluationTime = time.Since(startTime)
	return stats, nil
}

// TestRule tests a rule against current metrics without creating alerts
func (e *AlertEvaluator) TestRule(ctx context.Context, rule *models.AlertRule) (interface{}, error) {
	metrics, err := e.executeQuery(ctx, rule.Query)
	if err != nil {
		return nil, fmt.Errorf("failed to execute query for rule test: %w", err)
	}

	// Add evaluation results to metrics
	for _, metric := range metrics {
		shouldFire, err := e.evaluateCondition(rule, metric.Value)
		if err != nil {
			log.Printf("Failed to evaluate condition for test: %v", err)
			continue
		}

		// Add evaluation result to labels
		if metric.Labels == nil {
			metric.Labels = make(map[string]string)
		}
		metric.Labels["would_fire"] = strconv.FormatBool(shouldFire)
		metric.Labels["threshold"] = fmt.Sprintf("%.2f", rule.Threshold)
		metric.Labels["condition"] = rule.Condition
	}

	return metrics, nil
}

// ValidateRuleQuery validates that a rule's query is well-formed
func (e *AlertEvaluator) ValidateRuleQuery(ctx context.Context, query string) error {
	// Basic validation - check for dangerous patterns
	queryLower := strings.ToLower(query)

	// Block potentially dangerous queries
	dangerousPatterns := []string{
		"drop ", "delete ", "truncate ", "alter ",
		"insert ", "update ", "create ", "grant ",
		"exec ", "execute ", "call ", "procedure ",
	}

	for _, pattern := range dangerousPatterns {
		if strings.Contains(queryLower, pattern) {
			return fmt.Errorf("query contains dangerous pattern: %s", pattern)
		}
	}

	// Test execute the query to ensure it's valid
	_, err := e.executeQuery(ctx, query)
	if err != nil {
		return fmt.Errorf("query validation failed: %w", err)
	}

	return nil
}
