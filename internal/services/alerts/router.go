// Package alerts implements alert routing logic
package alerts

import (
	"context"
	"strings"

	"github.com/mantonx/volumeviz/internal/core/interfaces"
	"github.com/mantonx/volumeviz/internal/models"
	"github.com/mantonx/volumeviz/internal/store"
)

// AlertRouter implements alert routing to destinations
type AlertRouter struct {
	store store.Store
}

// NewAlertRouter creates a new alert router
func NewAlertRouter(store store.Store) interfaces.AlertRouter {
	return &AlertRouter{
		store: store,
	}
}

// Route determines which destinations should receive an alert
func (r *AlertRouter) Route(ctx context.Context, alert *models.Alert) ([]*models.AlertRoute, error) {
	// Get all enabled routes ordered by priority
	routes, err := r.store.Alerts().ListEnabledAlertRoutes(ctx)
	if err != nil {
		return nil, err
	}

	var matchedRoutes []*models.AlertRoute

	// Check each route to see if it matches the alert
	for _, route := range routes {
		if r.MatchesRoute(alert, route) {
			matchedRoutes = append(matchedRoutes, route)
		}
	}

	return matchedRoutes, nil
}

// MatchesRoute checks if an alert matches a specific route
func (r *AlertRouter) MatchesRoute(alert *models.Alert, route *models.AlertRoute) bool {
	// If route is disabled, it doesn't match
	if !route.IsEnabled {
		return false
	}

	// Check each matcher in the route
	for matcherKey, matcherValue := range route.Matchers {
		if !r.matchesCriteria(alert, matcherKey, matcherValue) {
			return false
		}
	}

	return true
}

// matchesCriteria checks if an alert matches a specific matching criteria
func (r *AlertRouter) matchesCriteria(alert *models.Alert, key, pattern string) bool {
	switch key {
	case "rule_name":
		return r.matchesPattern(alert.Rule.Name, pattern)
	case "rule_id":
		return r.matchesPattern(string(rune(alert.RuleID)), pattern)
	case "entity_type":
		return r.matchesPattern(alert.EntityType, pattern)
	case "entity_id":
		return r.matchesPattern(alert.EntityID, pattern)
	case "status":
		return r.matchesPattern(alert.Status, pattern)
	case "severity":
		// Check if severity is in labels or annotations
		if severity, exists := alert.Labels["severity"]; exists {
			return r.matchesPattern(severity, pattern)
		}
		if severity, exists := alert.Annotations["severity"]; exists {
			return r.matchesPattern(severity, pattern)
		}
		return false
	default:
		// Check if the key exists in labels
		if value, exists := alert.Labels[key]; exists {
			return r.matchesPattern(value, pattern)
		}
		// Check if the key exists in annotations
		if value, exists := alert.Annotations[key]; exists {
			return r.matchesPattern(value, pattern)
		}
		return false
	}
}

// matchesPattern checks if a value matches a pattern
func (r *AlertRouter) matchesPattern(value, pattern string) bool {
	// Handle special patterns
	switch {
	case pattern == "*":
		// Wildcard matches everything
		return true
	case strings.HasPrefix(pattern, "!"):
		// Negation - match if value does NOT match the pattern (without !)
		return !r.matchesPattern(value, pattern[1:])
	case strings.HasPrefix(pattern, "~"):
		// Regex pattern (simplified - just contains for now)
		return strings.Contains(value, pattern[1:])
	case strings.Contains(pattern, "*"):
		// Simple glob pattern
		return r.matchesGlob(value, pattern)
	case strings.Contains(pattern, "|"):
		// Multiple options separated by |
		options := strings.Split(pattern, "|")
		for _, option := range options {
			if r.matchesPattern(value, strings.TrimSpace(option)) {
				return true
			}
		}
		return false
	default:
		// Exact match (case insensitive)
		return strings.EqualFold(value, pattern)
	}
}

// matchesGlob performs simple glob matching
func (r *AlertRouter) matchesGlob(value, pattern string) bool {
	// Simple implementation for basic glob patterns
	// This could be enhanced with a proper glob library

	if pattern == "*" {
		return true
	}

	if strings.HasPrefix(pattern, "*") && strings.HasSuffix(pattern, "*") {
		// *substring*
		substring := pattern[1 : len(pattern)-1]
		return strings.Contains(strings.ToLower(value), strings.ToLower(substring))
	}

	if strings.HasPrefix(pattern, "*") {
		// *suffix
		suffix := pattern[1:]
		return strings.HasSuffix(strings.ToLower(value), strings.ToLower(suffix))
	}

	if strings.HasSuffix(pattern, "*") {
		// prefix*
		prefix := pattern[:len(pattern)-1]
		return strings.HasPrefix(strings.ToLower(value), strings.ToLower(prefix))
	}

	// No wildcard, exact match
	return strings.EqualFold(value, pattern)
}

// GetRoutesByPriority returns routes sorted by priority for debugging
func (r *AlertRouter) GetRoutesByPriority(ctx context.Context) ([]*models.AlertRoute, error) {
	return r.store.Alerts().ListEnabledAlertRoutes(ctx)
}

// ValidateRouteMatchers validates that route matchers are well-formed
func (r *AlertRouter) ValidateRouteMatchers(matchers map[string]string) error {
	validKeys := map[string]bool{
		"rule_name":   true,
		"rule_id":     true,
		"entity_type": true,
		"entity_id":   true,
		"status":      true,
		"severity":    true,
		// Any other key is assumed to be a label/annotation name
	}

	for key, pattern := range matchers {
		// Check if key is valid (either predefined or a custom label)
		if _, isValid := validKeys[key]; !isValid {
			// Custom label/annotation - just check it's not empty
			if key == "" {
				return &RouteValidationError{
					Field:   "matchers",
					Message: "matcher key cannot be empty",
				}
			}
		}

		// Validate pattern
		if pattern == "" {
			return &RouteValidationError{
				Field:   "matchers." + key,
				Message: "matcher pattern cannot be empty",
			}
		}

		// Check for invalid regex patterns (basic validation)
		if strings.HasPrefix(pattern, "~") {
			regexPattern := pattern[1:]
			if regexPattern == "" {
				return &RouteValidationError{
					Field:   "matchers." + key,
					Message: "regex pattern cannot be empty",
				}
			}
		}
	}

	return nil
}

// RouteValidationError represents a route validation error
type RouteValidationError struct {
	Field   string
	Message string
}

func (e *RouteValidationError) Error() string {
	return e.Field + ": " + e.Message
}

// MatchingInfo provides debugging information about route matching
type MatchingInfo struct {
	Route    *models.AlertRoute `json:"route"`
	Matches  bool               `json:"matches"`
	Criteria []CriteriaMatch    `json:"criteria"`
}

// CriteriaMatch represents the result of matching a single criteria
type CriteriaMatch struct {
	Key     string `json:"key"`
	Pattern string `json:"pattern"`
	Value   string `json:"value"`
	Matches bool   `json:"matches"`
}

// GetMatchingInfo returns detailed information about route matching for debugging
func (r *AlertRouter) GetMatchingInfo(ctx context.Context, alert *models.Alert) ([]*MatchingInfo, error) {
	routes, err := r.store.Alerts().ListEnabledAlertRoutes(ctx)
	if err != nil {
		return nil, err
	}

	var infos []*MatchingInfo

	for _, route := range routes {
		info := &MatchingInfo{
			Route:   route,
			Matches: true,
		}

		// Check each matcher
		for key, pattern := range route.Matchers {
			value := r.getAlertValue(alert, key)
			matches := r.matchesCriteria(alert, key, pattern)

			info.Criteria = append(info.Criteria, CriteriaMatch{
				Key:     key,
				Pattern: pattern,
				Value:   value,
				Matches: matches,
			})

			if !matches {
				info.Matches = false
			}
		}

		infos = append(infos, info)
	}

	return infos, nil
}

// getAlertValue extracts a value from an alert for a given key
func (r *AlertRouter) getAlertValue(alert *models.Alert, key string) string {
	switch key {
	case "rule_name":
		if alert.Rule != nil {
			return alert.Rule.Name
		}
		return ""
	case "rule_id":
		return string(rune(alert.RuleID))
	case "entity_type":
		return alert.EntityType
	case "entity_id":
		return alert.EntityID
	case "status":
		return alert.Status
	case "severity":
		if severity, exists := alert.Labels["severity"]; exists {
			return severity
		}
		if severity, exists := alert.Annotations["severity"]; exists {
			return severity
		}
		return ""
	default:
		// Check labels first
		if value, exists := alert.Labels[key]; exists {
			return value
		}
		// Then check annotations
		if value, exists := alert.Annotations[key]; exists {
			return value
		}
		return ""
	}
}
