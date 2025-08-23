// Package alerts implements alert deduplication logic
package alerts

import (
	"context"
	"crypto/sha256"
	"fmt"
	"sort"
	"strings"

	"github.com/mantonx/volumeviz/internal/core/interfaces"
	"github.com/mantonx/volumeviz/internal/models"
	"github.com/mantonx/volumeviz/internal/store"
)

// AlertDeduplicator implements alert deduplication
type AlertDeduplicator struct {
	store store.Store
}

// NewAlertDeduplicator creates a new alert deduplicator
func NewAlertDeduplicator(store store.Store) interfaces.Deduplicator {
	return &AlertDeduplicator{
		store: store,
	}
}

// GenerateKey generates a deduplication key for an alert
func (d *AlertDeduplicator) GenerateKey(rule *models.AlertRule, entityID, entityType string, value *float64, labels map[string]string) string {
	// Create a deterministic key based on rule, entity, and relevant labels
	var keyParts []string

	// Add rule identifier
	keyParts = append(keyParts, fmt.Sprintf("rule:%d", rule.ID))

	// Add entity information
	keyParts = append(keyParts, fmt.Sprintf("entity:%s:%s", entityType, entityID))

	// Add significant labels (exclude metadata labels)
	if labels != nil {
		var labelPairs []string
		for key, value := range labels {
			// Skip metadata labels that shouldn't affect deduplication
			if d.isSignificantLabel(key) {
				labelPairs = append(labelPairs, fmt.Sprintf("%s=%s", key, value))
			}
		}

		// Sort for consistency
		sort.Strings(labelPairs)
		if len(labelPairs) > 0 {
			keyParts = append(keyParts, "labels:"+strings.Join(labelPairs, ","))
		}
	}

	// Add rule condition for threshold-based alerts
	if value != nil {
		// Group similar values to prevent excessive alert churn
		bucket := d.getValueBucket(rule, *value)
		keyParts = append(keyParts, fmt.Sprintf("bucket:%s", bucket))
	}

	// Create final key
	keyString := strings.Join(keyParts, "|")

	// Hash for consistent length and to avoid key length issues
	hash := sha256.Sum256([]byte(keyString))
	return fmt.Sprintf("%x", hash)
}

// ShouldSuppress checks if an alert should be suppressed due to deduplication
func (d *AlertDeduplicator) ShouldSuppress(ctx context.Context, alert *models.Alert) (bool, error) {
	// Check if there's already an active alert with the same deduplication key
	existingAlert, err := d.store.Alerts().GetAlertByDedupe(ctx, alert.RuleID, alert.EntityID, alert.DedupeKey)
	if err != nil {
		// If no existing alert found, don't suppress
		return false, nil
	}

	// If we found an existing alert, check its status
	if existingAlert.Status == models.AlertStatusFiring {
		// There's already a firing alert with the same dedupe key - suppress this one
		return true, nil
	}

	// If the existing alert is resolved, we can fire a new one
	return false, nil
}

// isSignificantLabel determines if a label should be included in deduplication
func (d *AlertDeduplicator) isSignificantLabel(labelKey string) bool {
	// Exclude metadata labels that are added by the system
	excludedLabels := map[string]bool{
		"alertmanager":  true,
		"__name__":      true,
		"__timestamp__": true,
		"__value__":     true,
		"__interval__":  true,
		"__alert_id__":  true,
		"__rule_id__":   true,
		"source":        false, // Include source as it's significant
		"environment":   false, // Include environment as it's significant
		"service":       false, // Include service as it's significant
		"instance":      false, // Include instance as it's significant
		"job":           false, // Include job as it's significant
	}

	// If explicitly excluded, don't include
	if excluded, exists := excludedLabels[labelKey]; exists && excluded {
		return false
	}

	// Include labels that start with common prefixes
	significantPrefixes := []string{
		"env",
		"service",
		"app",
		"tier",
		"component",
		"cluster",
		"datacenter",
		"region",
		"zone",
	}

	lowerKey := strings.ToLower(labelKey)
	for _, prefix := range significantPrefixes {
		if strings.HasPrefix(lowerKey, prefix) {
			return true
		}
	}

	// Default to including the label
	return true
}

// getValueBucket groups similar values to prevent alert churn
func (d *AlertDeduplicator) getValueBucket(rule *models.AlertRule, value float64) string {
	// For percentage-based metrics, use 5% buckets
	if d.isPercentageMetric(rule.Query) {
		bucket := int(value/5) * 5
		return fmt.Sprintf("pct_%d", bucket)
	}

	// For size-based metrics, use logarithmic buckets
	if d.isSizeMetric(rule.Query) {
		return d.getSizeBucket(value)
	}

	// For count-based metrics, use small buckets for low values, larger for high
	if d.isCountMetric(rule.Query) {
		return d.getCountBucket(value)
	}

	// For other metrics, use the threshold to determine bucket size
	bucketSize := d.calculateBucketSize(rule.Threshold)
	bucket := int(value/bucketSize) * int(bucketSize)
	return fmt.Sprintf("value_%d", bucket)
}

// isPercentageMetric checks if the metric appears to be a percentage
func (d *AlertDeduplicator) isPercentageMetric(query string) bool {
	lowerQuery := strings.ToLower(query)
	return strings.Contains(lowerQuery, "percent") ||
		strings.Contains(lowerQuery, "usage") ||
		strings.Contains(lowerQuery, "utilization") ||
		strings.Contains(lowerQuery, "ratio")
}

// isSizeMetric checks if the metric appears to be a size measurement
func (d *AlertDeduplicator) isSizeMetric(query string) bool {
	lowerQuery := strings.ToLower(query)
	return strings.Contains(lowerQuery, "bytes") ||
		strings.Contains(lowerQuery, "size") ||
		strings.Contains(lowerQuery, "space") ||
		strings.Contains(lowerQuery, "disk") ||
		strings.Contains(lowerQuery, "memory")
}

// isCountMetric checks if the metric appears to be a count
func (d *AlertDeduplicator) isCountMetric(query string) bool {
	lowerQuery := strings.ToLower(query)
	return strings.Contains(lowerQuery, "count") ||
		strings.Contains(lowerQuery, "total") ||
		strings.Contains(lowerQuery, "number") ||
		strings.Contains(lowerQuery, "requests") ||
		strings.Contains(lowerQuery, "errors")
}

// getSizeBucket returns a size bucket for logarithmic grouping
func (d *AlertDeduplicator) getSizeBucket(value float64) string {
	// Convert to MB for easier bucket calculation
	valueMB := value / (1024 * 1024)

	switch {
	case valueMB < 1:
		return "size_sub_mb"
	case valueMB < 10:
		return "size_1_10mb"
	case valueMB < 100:
		return "size_10_100mb"
	case valueMB < 1024:
		return "size_100mb_1gb"
	case valueMB < 10*1024:
		return "size_1_10gb"
	case valueMB < 100*1024:
		return "size_10_100gb"
	case valueMB < 1024*1024:
		return "size_100gb_1tb"
	default:
		return "size_1tb_plus"
	}
}

// getCountBucket returns a count bucket for appropriate grouping
func (d *AlertDeduplicator) getCountBucket(value float64) string {
	switch {
	case value < 10:
		return fmt.Sprintf("count_%d", int(value))
	case value < 100:
		bucket := int(value/10) * 10
		return fmt.Sprintf("count_%d", bucket)
	case value < 1000:
		bucket := int(value/100) * 100
		return fmt.Sprintf("count_%d", bucket)
	case value < 10000:
		bucket := int(value/1000) * 1000
		return fmt.Sprintf("count_%d", bucket)
	default:
		bucket := int(value/10000) * 10000
		return fmt.Sprintf("count_%d", bucket)
	}
}

// calculateBucketSize calculates an appropriate bucket size based on threshold
func (d *AlertDeduplicator) calculateBucketSize(threshold float64) float64 {
	// Use 10% of threshold as bucket size, with minimum of 1
	bucketSize := threshold * 0.1
	if bucketSize < 1 {
		bucketSize = 1
	}
	return bucketSize
}

// GetDedupeInfo returns information about deduplication for debugging
func (d *AlertDeduplicator) GetDedupeInfo(rule *models.AlertRule, entityID, entityType string, value *float64, labels map[string]string) map[string]interface{} {
	dedupeKey := d.GenerateKey(rule, entityID, entityType, value, labels)

	info := map[string]interface{}{
		"dedupe_key":  dedupeKey,
		"rule_id":     rule.ID,
		"entity_id":   entityID,
		"entity_type": entityType,
	}

	if value != nil {
		bucket := d.getValueBucket(rule, *value)
		info["value"] = *value
		info["value_bucket"] = bucket
	}

	if labels != nil {
		significantLabels := make(map[string]string)
		for key, val := range labels {
			if d.isSignificantLabel(key) {
				significantLabels[key] = val
			}
		}
		info["significant_labels"] = significantLabels
	}

	return info
}
