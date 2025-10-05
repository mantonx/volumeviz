package repo

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgtype"
	"github.com/mantonx/volumeviz/internal/db/sqlc"
	sqlcSQLite "github.com/mantonx/volumeviz/internal/db/sqlc-sqlite"
	"github.com/mantonx/volumeviz/internal/models"
)

// AlertsRepo handles alerts system operations
// This repo accepts sqlc.Queries (injected by store) and returns domain models
type AlertsRepo interface {
	// Alert Rules
	CreateAlertRule(ctx context.Context, params models.CreateAlertRuleParams) (*models.AlertRule, error)
	GetAlertRule(ctx context.Context, id int64) (*models.AlertRule, error)
	GetAlertRuleByName(ctx context.Context, name string) (*models.AlertRule, error)
	ListAlertRules(ctx context.Context, limit, offset int32) ([]*models.AlertRule, error)
	ListEnabledAlertRules(ctx context.Context) ([]*models.AlertRule, error)
	UpdateAlertRule(ctx context.Context, params models.UpdateAlertRuleParams) error
	DeleteAlertRule(ctx context.Context, id int64) error
	CountAlertRules(ctx context.Context) (int64, error)

	// Alerts
	CreateAlert(ctx context.Context, alert *models.Alert) (*models.Alert, error)
	GetAlert(ctx context.Context, id int64) (*models.Alert, error)
	GetAlertByDedupe(ctx context.Context, ruleID int64, entityID, dedupeKey string) (*models.Alert, error)
	ListAlerts(ctx context.Context, limit, offset int32) ([]*models.Alert, error)
	ListAlertsByRule(ctx context.Context, ruleID int64, limit, offset int32) ([]*models.Alert, error)
	ListActiveAlerts(ctx context.Context, limit, offset int32) ([]*models.Alert, error)
	UpdateAlertStatus(ctx context.Context, id int64, status string, endsAt *time.Time) error
	ResolveAlert(ctx context.Context, ruleID int64, entityID, dedupeKey string) error
	DeleteAlert(ctx context.Context, id int64) error
	CountAlerts(ctx context.Context) (int64, error)
	CountActiveAlerts(ctx context.Context) (int64, error)

	// Alert Destinations
	CreateAlertDestination(ctx context.Context, params models.CreateAlertDestinationParams) (*models.AlertDestination, error)
	GetAlertDestination(ctx context.Context, id int64) (*models.AlertDestination, error)
	GetAlertDestinationByName(ctx context.Context, name string) (*models.AlertDestination, error)
	ListAlertDestinations(ctx context.Context, limit, offset int32) ([]*models.AlertDestination, error)
	ListEnabledAlertDestinations(ctx context.Context) ([]*models.AlertDestination, error)
	UpdateAlertDestination(ctx context.Context, params models.UpdateAlertDestinationParams) error
	DeleteAlertDestination(ctx context.Context, id int64) error
	CountAlertDestinations(ctx context.Context) (int64, error)

	// Alert Routes
	CreateAlertRoute(ctx context.Context, params models.CreateAlertRouteParams) (*models.AlertRoute, error)
	GetAlertRoute(ctx context.Context, id int64) (*models.AlertRoute, error)
	GetAlertRouteByName(ctx context.Context, name string) (*models.AlertRoute, error)
	ListAlertRoutes(ctx context.Context, limit, offset int32) ([]*models.AlertRoute, error)
	ListEnabledAlertRoutes(ctx context.Context) ([]*models.AlertRoute, error)
	ListRoutesByDestination(ctx context.Context, destinationID int64) ([]*models.AlertRoute, error)
	UpdateAlertRoute(ctx context.Context, params models.UpdateAlertRouteParams) error
	DeleteAlertRoute(ctx context.Context, id int64) error
	CountAlertRoutes(ctx context.Context) (int64, error)

	// Alert Deliveries
	CreateAlertDelivery(ctx context.Context, alertID, destinationID, routeID int64, maxAttempts int32) (*models.AlertDelivery, error)
	GetAlertDelivery(ctx context.Context, id int64) (*models.AlertDelivery, error)
	ListAlertDeliveries(ctx context.Context, limit, offset int32) ([]*models.AlertDelivery, error)
	ListDeliveriesByAlert(ctx context.Context, alertID int64) ([]*models.AlertDelivery, error)
	ListDeliveriesByDestination(ctx context.Context, destinationID int64, limit, offset int32) ([]*models.AlertDelivery, error)
	ListPendingDeliveries(ctx context.Context, limit int32) ([]*models.AlertDelivery, error)
	UpdateDeliveryAttempt(ctx context.Context, id int64, status string, attemptCount int32, nextAttemptAt *time.Time, errorMessage, requestPayload, responsePayload *string, responseStatus *int32) error
	MarkDeliveryDelivered(ctx context.Context, id int64, requestPayload, responsePayload *string, responseStatus *int32) error
	MarkDeliveryFailed(ctx context.Context, id int64, errorMessage, requestPayload, responsePayload *string, responseStatus *int32) error
	DeleteAlertDelivery(ctx context.Context, id int64) error
	CountAlertDeliveries(ctx context.Context) (int64, error)
	CountDeliveriesByStatus(ctx context.Context, status string) (int64, error)

	// Statistics
	GetAlertStats(ctx context.Context) (*AlertsStats, error)
	GetDeliveryStats(ctx context.Context) (*DeliveryStats, error)
	GetDestinationDeliveryStats(ctx context.Context, destinationID int64) (*DeliveryStats, error)
}

// AlertsStats represents overall alerts statistics
type AlertsStats struct {
	TotalAlerts      int64 `json:"total_alerts"`
	FiringAlerts     int64 `json:"firing_alerts"`
	ResolvedAlerts   int64 `json:"resolved_alerts"`
	ActiveRules      int64 `json:"active_rules"`
	AffectedEntities int64 `json:"affected_entities"`
}

// DeliveryStats represents delivery statistics
type DeliveryStats struct {
	TotalDeliveries      int64   `json:"total_deliveries"`
	SuccessfulDeliveries int64   `json:"successful_deliveries"`
	FailedDeliveries     int64   `json:"failed_deliveries"`
	PendingDeliveries    int64   `json:"pending_deliveries"`
	AvgAttempts          float64 `json:"avg_attempts"`
	DestinationsUsed     *int64  `json:"destinations_used,omitempty"`
}

type alertsRepo struct {
	queries *sqlc.Queries
}

// NewAlertsRepo creates a new alerts repository
func NewAlertsRepo(queries *sqlc.Queries) AlertsRepo {
	return &alertsRepo{queries: queries}
}

// NewSQLiteAlertsRepo creates a new SQLite alerts repository
func NewSQLiteAlertsRepo(queries *sqlcSQLite.Queries) AlertsRepo {
	// TODO: Implement SQLite-specific version
	return &alertsRepo{queries: nil}
}

// =============================================================================
// ALERT RULES IMPLEMENTATION
// =============================================================================

func (r *alertsRepo) CreateAlertRule(ctx context.Context, params models.CreateAlertRuleParams) (*models.AlertRule, error) {
	// Map domain model to database schema
	// Database schema is simpler - it has rule_type, metric_name, condition_operator, threshold_value
	// Domain model has query, condition, threshold with more complex semantics

	// For now, we'll map the query to metric_name and use "threshold" as rule_type
	ruleType := "threshold"
	metricName := params.Query // Simplified mapping
	conditionOp := mapConditionToOperator(params.Condition)

	// Convert interval to minutes
	intervalMinutes := int32(params.Interval.Minutes())
	if intervalMinutes < 1 {
		intervalMinutes = 1
	}

	// Convert For duration to minutes (for cooldown)
	cooldownMinutes := int32(60) // default
	if params.For != nil {
		cooldownMinutes = int32((*params.For).Minutes())
	}

	description := ""
	if params.Description != nil {
		description = *params.Description
	}

	rule, err := r.queries.CreateAlertRule(ctx, sqlc.CreateAlertRuleParams{
		Name:                params.Name,
		Description:         pgtype.Text{String: description, Valid: params.Description != nil},
		RuleType:            ruleType,
		MetricName:          metricName,
		ConditionOperator:   conditionOp,
		ThresholdValue:      float64ToPgNumeric(params.Threshold),
		TimeWindowMinutes:   pgtype.Int4{Int32: intervalMinutes, Valid: true},
		MinOccurrences:      pgtype.Int4{Int32: 1, Valid: true},
		IsEnabled:           pgtype.Bool{Bool: params.IsEnabled, Valid: true},
		Severity:            "medium",
		CooldownMinutes:     pgtype.Int4{Int32: cooldownMinutes, Valid: true},
	})
	if err != nil {
		return nil, fmt.Errorf("failed to create alert rule: %w", err)
	}

	return convertAlertRuleToModel(&rule, params.Labels), nil
}

func (r *alertsRepo) GetAlertRule(ctx context.Context, id int64) (*models.AlertRule, error) {
	rule, err := r.queries.GetAlertRule(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("failed to get alert rule: %w", err)
	}
	return convertAlertRuleToModel(&rule, nil), nil
}

func (r *alertsRepo) GetAlertRuleByName(ctx context.Context, name string) (*models.AlertRule, error) {
	rule, err := r.queries.GetAlertRuleByName(ctx, name)
	if err != nil {
		return nil, fmt.Errorf("failed to get alert rule by name: %w", err)
	}
	return convertAlertRuleToModel(&rule, nil), nil
}

func (r *alertsRepo) ListAlertRules(ctx context.Context, limit, offset int32) ([]*models.AlertRule, error) {
	rules, err := r.queries.ListAlertRules(ctx, sqlc.ListAlertRulesParams{
		Limit:  limit,
		Offset: offset,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to list alert rules: %w", err)
	}
	return convertAlertRulesToModels(rules), nil
}

func (r *alertsRepo) ListEnabledAlertRules(ctx context.Context) ([]*models.AlertRule, error) {
	rules, err := r.queries.ListEnabledAlertRules(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to list enabled alert rules: %w", err)
	}
	return convertAlertRulesToModels(rules), nil
}

func (r *alertsRepo) UpdateAlertRule(ctx context.Context, params models.UpdateAlertRuleParams) error {
	ruleType := "threshold"
	metricName := params.Query
	conditionOp := mapConditionToOperator(params.Condition)
	intervalMinutes := int32(params.Interval.Minutes())
	if intervalMinutes < 1 {
		intervalMinutes = 1
	}
	cooldownMinutes := int32(60)
	if params.For != nil {
		cooldownMinutes = int32((*params.For).Minutes())
	}
	description := ""
	if params.Description != nil {
		description = *params.Description
	}

	return r.queries.UpdateAlertRule(ctx, sqlc.UpdateAlertRuleParams{
		ID:                  params.ID,
		Name:                params.Name,
		Description:         pgtype.Text{String: description, Valid: params.Description != nil},
		RuleType:            ruleType,
		MetricName:          metricName,
		ConditionOperator:   conditionOp,
		ThresholdValue:      float64ToPgNumeric(params.Threshold),
		TimeWindowMinutes:   pgtype.Int4{Int32: intervalMinutes, Valid: true},
		MinOccurrences:      pgtype.Int4{Int32: 1, Valid: true},
		IsEnabled:           pgtype.Bool{Bool: params.IsEnabled, Valid: true},
		Severity:            "medium",
		CooldownMinutes:     pgtype.Int4{Int32: cooldownMinutes, Valid: true},
	})
}

func (r *alertsRepo) DeleteAlertRule(ctx context.Context, id int64) error {
	return r.queries.DeleteAlertRule(ctx, id)
}

func (r *alertsRepo) CountAlertRules(ctx context.Context) (int64, error) {
	return r.queries.CountAlertRules(ctx)
}

// =============================================================================
// ALERTS IMPLEMENTATION
// =============================================================================

func (r *alertsRepo) CreateAlert(ctx context.Context, alert *models.Alert) (*models.Alert, error) {
	// Map domain model to database - database schema is simpler
	// Database has: rule_id, volume_id, severity, title, message, context_data, is_resolved, resolved_at, organization_id
	// Domain model has: RuleID, EntityID (as volume_id), Status, Value, Labels, Annotations, StartsAt, EndsAt

	// Extract title and message from annotations if present
	title := "Alert"
	message := "Alert triggered"
	if alert.Annotations != nil {
		if t, ok := alert.Annotations["title"]; ok {
			title = t
		}
		if m, ok := alert.Annotations["message"]; ok {
			message = m
		}
	}

	// Determine severity from labels
	severity := "medium"
	if alert.Labels != nil {
		if s, ok := alert.Labels["severity"]; ok {
			severity = s
		}
	}

	// Serialize context data
	contextData, _ := json.Marshal(map[string]interface{}{
		"value":       alert.Value,
		"labels":      alert.Labels,
		"annotations": alert.Annotations,
		"starts_at":   alert.StartsAt,
		"ends_at":     alert.EndsAt,
		"entity_type": alert.EntityType,
		"dedupe_key":  alert.DedupeKey,
	})

	isResolved := alert.Status == "resolved"
	var resolvedAt pgtype.Timestamptz
	if alert.EndsAt != nil {
		resolvedAt = pgtype.Timestamptz{Time: *alert.EndsAt, Valid: true}
	}

	// Organization ID - extract from context or set to null
	var orgID pgtype.Int8
	// For now, leave as null - proper multi-tenancy would extract from context

	row, err := r.queries.CreateAlert(ctx, sqlc.CreateAlertParams{
		RuleID:         alert.RuleID,
		VolumeID:       pgtype.Text{String: alert.EntityID, Valid: alert.EntityID != ""},
		Severity:       severity,
		Title:          title,
		Message:        message,
		ContextData:    contextData,
		IsResolved:     pgtype.Bool{Bool: isResolved, Valid: true},
		ResolvedAt:     resolvedAt,
		OrganizationID: orgID,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to create alert: %w", err)
	}

	alert.ID = row.ID
	alert.CreatedAt = row.CreatedAt
	return alert, nil
}

func (r *alertsRepo) GetAlert(ctx context.Context, id int64) (*models.Alert, error) {
	row, err := r.queries.GetAlert(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("failed to get alert: %w", err)
	}
	return convertAlertToModel(&row), nil
}

func (r *alertsRepo) GetAlertByDedupe(ctx context.Context, ruleID int64, entityID, dedupeKey string) (*models.Alert, error) {
	// Use GetAlertByRuleAndVolume as a simplified dedupe lookup
	row, err := r.queries.GetAlertByRuleAndVolume(ctx, sqlc.GetAlertByRuleAndVolumeParams{
		RuleID:   ruleID,
		VolumeID: pgtype.Text{String: entityID, Valid: true},
	})
	if err != nil {
		return nil, fmt.Errorf("failed to get alert by dedupe: %w", err)
	}
	return convertAlertToModel(&row), nil
}

func (r *alertsRepo) ListAlerts(ctx context.Context, limit, offset int32) ([]*models.Alert, error) {
	rows, err := r.queries.ListAlerts(ctx, sqlc.ListAlertsParams{
		Limit:  limit,
		Offset: offset,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to list alerts: %w", err)
	}
	return convertAlertsToModels(rows), nil
}

func (r *alertsRepo) ListAlertsByRule(ctx context.Context, ruleID int64, limit, offset int32) ([]*models.Alert, error) {
	rows, err := r.queries.ListAlertsByRule(ctx, sqlc.ListAlertsByRuleParams{
		RuleID: ruleID,
		Limit:  limit,
		Offset: offset,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to list alerts by rule: %w", err)
	}
	return convertAlertsToModels(rows), nil
}

func (r *alertsRepo) ListActiveAlerts(ctx context.Context, limit, offset int32) ([]*models.Alert, error) {
	rows, err := r.queries.ListActiveAlerts(ctx, sqlc.ListActiveAlertsParams{
		Limit:  limit,
		Offset: offset,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to list active alerts: %w", err)
	}
	return convertAlertsToModels(rows), nil
}

func (r *alertsRepo) UpdateAlertStatus(ctx context.Context, id int64, status string, endsAt *time.Time) error {
	isResolved := status == "resolved"
	var resolvedAt pgtype.Timestamptz
	if endsAt != nil {
		resolvedAt = pgtype.Timestamptz{Time: *endsAt, Valid: true}
	}
	return r.queries.UpdateAlertResolved(ctx, sqlc.UpdateAlertResolvedParams{
		ID:         id,
		IsResolved: pgtype.Bool{Bool: isResolved, Valid: true},
		ResolvedAt: resolvedAt,
	})
}

func (r *alertsRepo) ResolveAlert(ctx context.Context, ruleID int64, entityID, dedupeKey string) error {
	return r.queries.ResolveAlertByRuleAndVolume(ctx, sqlc.ResolveAlertByRuleAndVolumeParams{
		RuleID:   ruleID,
		VolumeID: pgtype.Text{String: entityID, Valid: true},
	})
}

func (r *alertsRepo) DeleteAlert(ctx context.Context, id int64) error {
	return r.queries.DeleteAlert(ctx, id)
}

func (r *alertsRepo) CountAlerts(ctx context.Context) (int64, error) {
	return r.queries.CountAlerts(ctx)
}

func (r *alertsRepo) CountActiveAlerts(ctx context.Context) (int64, error) {
	return r.queries.CountActiveAlerts(ctx)
}

// =============================================================================
// ALERT DESTINATIONS IMPLEMENTATION
// =============================================================================

func (r *alertsRepo) CreateAlertDestination(ctx context.Context, params models.CreateAlertDestinationParams) (*models.AlertDestination, error) {
	configJSON, err := json.Marshal(params.Config)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal config: %w", err)
	}

	row, err := r.queries.CreateAlertDestination(ctx, sqlc.CreateAlertDestinationParams{
		Name:          params.Name,
		Type:          params.Type,
		Configuration: configJSON,
		IsEnabled:     pgtype.Bool{Bool: params.IsEnabled, Valid: true},
	})
	if err != nil {
		return nil, fmt.Errorf("failed to create alert destination: %w", err)
	}

	return convertAlertDestinationToModel(&row), nil
}

func (r *alertsRepo) GetAlertDestination(ctx context.Context, id int64) (*models.AlertDestination, error) {
	row, err := r.queries.GetAlertDestination(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("failed to get alert destination: %w", err)
	}
	return convertAlertDestinationToModel(&row), nil
}

func (r *alertsRepo) GetAlertDestinationByName(ctx context.Context, name string) (*models.AlertDestination, error) {
	row, err := r.queries.GetAlertDestinationByName(ctx, name)
	if err != nil {
		return nil, fmt.Errorf("failed to get alert destination by name: %w", err)
	}
	return convertAlertDestinationToModel(&row), nil
}

func (r *alertsRepo) ListAlertDestinations(ctx context.Context, limit, offset int32) ([]*models.AlertDestination, error) {
	rows, err := r.queries.ListAlertDestinations(ctx, sqlc.ListAlertDestinationsParams{
		Limit:  limit,
		Offset: offset,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to list alert destinations: %w", err)
	}
	return convertAlertDestinationsToModels(rows), nil
}

func (r *alertsRepo) ListEnabledAlertDestinations(ctx context.Context) ([]*models.AlertDestination, error) {
	rows, err := r.queries.ListEnabledAlertDestinations(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to list enabled alert destinations: %w", err)
	}
	return convertAlertDestinationsToModels(rows), nil
}

func (r *alertsRepo) UpdateAlertDestination(ctx context.Context, params models.UpdateAlertDestinationParams) error {
	configJSON, err := json.Marshal(params.Config)
	if err != nil {
		return fmt.Errorf("failed to marshal config: %w", err)
	}

	return r.queries.UpdateAlertDestination(ctx, sqlc.UpdateAlertDestinationParams{
		ID:            params.ID,
		Name:          params.Name,
		Type:          params.Type,
		Configuration: configJSON,
		IsEnabled:     pgtype.Bool{Bool: params.IsEnabled, Valid: true},
	})
}

func (r *alertsRepo) DeleteAlertDestination(ctx context.Context, id int64) error {
	return r.queries.DeleteAlertDestination(ctx, id)
}

func (r *alertsRepo) CountAlertDestinations(ctx context.Context) (int64, error) {
	return r.queries.CountAlertDestinations(ctx)
}

// =============================================================================
// ALERT ROUTES IMPLEMENTATION
// =============================================================================

func (r *alertsRepo) CreateAlertRoute(ctx context.Context, params models.CreateAlertRouteParams) (*models.AlertRoute, error) {
	// Database schema has: rule_id, destination_id, severity_filter
	// Domain model has: name, matchers, destination_id, priority
	// For now, we'll use a simplified mapping

	severityFilter := ""
	if params.Matchers != nil {
		if sev, ok := params.Matchers["severity"]; ok {
			severityFilter = sev
		}
	}

	row, err := r.queries.CreateAlertRoute(ctx, sqlc.CreateAlertRouteParams{
		RuleID:         0, // TODO: Extract from matchers or pass separately
		DestinationID:  params.DestinationID,
		SeverityFilter: pgtype.Text{String: severityFilter, Valid: severityFilter != ""},
	})
	if err != nil {
		return nil, fmt.Errorf("failed to create alert route: %w", err)
	}

	return convertAlertRouteToModel(&row, params.Name, params.Matchers, params.Priority), nil
}

func (r *alertsRepo) GetAlertRoute(ctx context.Context, id int64) (*models.AlertRoute, error) {
	row, err := r.queries.GetAlertRoute(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("failed to get alert route: %w", err)
	}
	return convertAlertRouteToModel(&row, "", nil, 0), nil
}

func (r *alertsRepo) GetAlertRouteByName(ctx context.Context, name string) (*models.AlertRoute, error) {
	// Database doesn't have name field, return error
	return nil, fmt.Errorf("GetAlertRouteByName not supported with current schema")
}

func (r *alertsRepo) ListAlertRoutes(ctx context.Context, limit, offset int32) ([]*models.AlertRoute, error) {
	rows, err := r.queries.ListAlertRoutes(ctx, sqlc.ListAlertRoutesParams{
		Limit:  limit,
		Offset: offset,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to list alert routes: %w", err)
	}
	return convertAlertRoutesToModels(rows), nil
}

func (r *alertsRepo) ListEnabledAlertRoutes(ctx context.Context) ([]*models.AlertRoute, error) {
	// Database doesn't have is_enabled field, return all routes
	rows, err := r.queries.ListAlertRoutes(ctx, sqlc.ListAlertRoutesParams{
		Limit:  1000,
		Offset: 0,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to list enabled alert routes: %w", err)
	}
	return convertAlertRoutesToModels(rows), nil
}

func (r *alertsRepo) ListRoutesByDestination(ctx context.Context, destinationID int64) ([]*models.AlertRoute, error) {
	rows, err := r.queries.ListRoutesByDestination(ctx, destinationID)
	if err != nil {
		return nil, fmt.Errorf("failed to list routes by destination: %w", err)
	}
	return convertAlertRoutesToModels(rows), nil
}

func (r *alertsRepo) UpdateAlertRoute(ctx context.Context, params models.UpdateAlertRouteParams) error {
	// Database schema doesn't support full update, return error
	return fmt.Errorf("UpdateAlertRoute not fully supported with current schema")
}

func (r *alertsRepo) DeleteAlertRoute(ctx context.Context, id int64) error {
	return r.queries.DeleteAlertRoute(ctx, id)
}

func (r *alertsRepo) CountAlertRoutes(ctx context.Context) (int64, error) {
	return r.queries.CountAlertRoutes(ctx)
}

// =============================================================================
// ALERT DELIVERIES IMPLEMENTATION
// =============================================================================

func (r *alertsRepo) CreateAlertDelivery(ctx context.Context, alertID, destinationID, routeID int64, maxAttempts int32) (*models.AlertDelivery, error) {
	row, err := r.queries.CreateAlertDelivery(ctx, sqlc.CreateAlertDeliveryParams{
		AlertID:       alertID,
		DestinationID: destinationID,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to create alert delivery: %w", err)
	}

	return convertAlertDeliveryToModel(&row, routeID, maxAttempts), nil
}

func (r *alertsRepo) GetAlertDelivery(ctx context.Context, id int64) (*models.AlertDelivery, error) {
	row, err := r.queries.GetAlertDelivery(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("failed to get alert delivery: %w", err)
	}
	return convertAlertDeliveryToModel(&row, 0, 3), nil
}

func (r *alertsRepo) ListAlertDeliveries(ctx context.Context, limit, offset int32) ([]*models.AlertDelivery, error) {
	rows, err := r.queries.ListAlertDeliveries(ctx, sqlc.ListAlertDeliveriesParams{
		Limit:  limit,
		Offset: offset,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to list alert deliveries: %w", err)
	}
	return convertAlertDeliveriesToModels(rows), nil
}

func (r *alertsRepo) ListDeliveriesByAlert(ctx context.Context, alertID int64) ([]*models.AlertDelivery, error) {
	rows, err := r.queries.ListDeliveriesByAlert(ctx, alertID)
	if err != nil {
		return nil, fmt.Errorf("failed to list deliveries by alert: %w", err)
	}
	return convertAlertDeliveriesToModels(rows), nil
}

func (r *alertsRepo) ListDeliveriesByDestination(ctx context.Context, destinationID int64, limit, offset int32) ([]*models.AlertDelivery, error) {
	rows, err := r.queries.ListDeliveriesByDestination(ctx, sqlc.ListDeliveriesByDestinationParams{
		DestinationID: destinationID,
		Limit:         limit,
		Offset:        offset,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to list deliveries by destination: %w", err)
	}
	return convertAlertDeliveriesToModels(rows), nil
}

func (r *alertsRepo) ListPendingDeliveries(ctx context.Context, limit int32) ([]*models.AlertDelivery, error) {
	rows, err := r.queries.ListPendingDeliveries(ctx, limit)
	if err != nil {
		return nil, fmt.Errorf("failed to list pending deliveries: %w", err)
	}
	return convertAlertDeliveriesToModels(rows), nil
}

func (r *alertsRepo) UpdateDeliveryAttempt(ctx context.Context, id int64, status string, attemptCount int32, nextAttemptAt *time.Time, errorMessage, requestPayload, responsePayload *string, responseStatus *int32) error {
	var errMsg string
	if errorMessage != nil {
		errMsg = *errorMessage
	}

	var responseData []byte
	if responsePayload != nil {
		responseData = []byte(*responsePayload)
	}

	return r.queries.UpdateDeliveryAttempt(ctx, sqlc.UpdateDeliveryAttemptParams{
		ID:           id,
		Status:       status,
		AttemptCount: pgtype.Int4{Int32: attemptCount, Valid: true},
		ErrorMessage: pgtype.Text{String: errMsg, Valid: errorMessage != nil},
		ResponseData: responseData,
	})
}

func (r *alertsRepo) MarkDeliveryDelivered(ctx context.Context, id int64, requestPayload, responsePayload *string, responseStatus *int32) error {
	var responseData []byte
	if responsePayload != nil {
		responseData = []byte(*responsePayload)
	}

	return r.queries.MarkDeliveryDelivered(ctx, sqlc.MarkDeliveryDeliveredParams{
		ID:           id,
		ResponseData: responseData,
	})
}

func (r *alertsRepo) MarkDeliveryFailed(ctx context.Context, id int64, errorMessage, requestPayload, responsePayload *string, responseStatus *int32) error {
	errMsg := pgtype.Text{}
	if errorMessage != nil {
		errMsg = pgtype.Text{String: *errorMessage, Valid: true}
	}

	var responseData []byte
	if responsePayload != nil {
		responseData = []byte(*responsePayload)
	}

	return r.queries.MarkDeliveryFailed(ctx, sqlc.MarkDeliveryFailedParams{
		ID:           id,
		ErrorMessage: errMsg,
		ResponseData: responseData,
	})
}

func (r *alertsRepo) DeleteAlertDelivery(ctx context.Context, id int64) error {
	return r.queries.DeleteAlertDelivery(ctx, id)
}

func (r *alertsRepo) CountAlertDeliveries(ctx context.Context) (int64, error) {
	return r.queries.CountAlertDeliveries(ctx)
}

func (r *alertsRepo) CountDeliveriesByStatus(ctx context.Context, status string) (int64, error) {
	return r.queries.CountDeliveriesByStatus(ctx, status)
}

// =============================================================================
// STATISTICS IMPLEMENTATION
// =============================================================================

func (r *alertsRepo) GetAlertStats(ctx context.Context) (*AlertsStats, error) {
	row, err := r.queries.GetAlertStats(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to get alert stats: %w", err)
	}

	return &AlertsStats{
		TotalAlerts:      row.TotalAlerts,
		FiringAlerts:     row.FiringAlerts,
		ResolvedAlerts:   row.ResolvedAlerts,
		ActiveRules:      row.ActiveRules,
		AffectedEntities: row.AffectedEntities,
	}, nil
}

func (r *alertsRepo) GetDeliveryStats(ctx context.Context) (*DeliveryStats, error) {
	row, err := r.queries.GetDeliveryStats(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to get delivery stats: %w", err)
	}

	avgAttempts := 0.0
	if row.AvgAttempts != nil {
		if val, ok := row.AvgAttempts.(float64); ok {
			avgAttempts = val
		}
	}

	return &DeliveryStats{
		TotalDeliveries:      row.TotalDeliveries,
		SuccessfulDeliveries: row.SuccessfulDeliveries,
		FailedDeliveries:     row.FailedDeliveries,
		PendingDeliveries:    row.PendingDeliveries,
		AvgAttempts:          avgAttempts,
		DestinationsUsed:     &row.DestinationsUsed,
	}, nil
}

func (r *alertsRepo) GetDestinationDeliveryStats(ctx context.Context, destinationID int64) (*DeliveryStats, error) {
	row, err := r.queries.GetDestinationDeliveryStats(ctx, destinationID)
	if err != nil {
		return nil, fmt.Errorf("failed to get destination delivery stats: %w", err)
	}

	avgAttempts := 0.0
	if row.AvgAttempts != nil {
		if val, ok := row.AvgAttempts.(float64); ok {
			avgAttempts = val
		}
	}

	return &DeliveryStats{
		TotalDeliveries:      row.TotalDeliveries,
		SuccessfulDeliveries: row.SuccessfulDeliveries,
		FailedDeliveries:     row.FailedDeliveries,
		PendingDeliveries:    row.PendingDeliveries,
		AvgAttempts:          avgAttempts,
	}, nil
}

// =============================================================================
// CONVERSION HELPERS
// =============================================================================

func mapConditionToOperator(condition string) string {
	switch condition {
	case "gt":
		return ">"
	case "gte":
		return ">="
	case "lt":
		return "<"
	case "lte":
		return "<="
	case "eq":
		return "=="
	case "ne":
		return "!="
	default:
		return ">"
	}
}

func convertAlertRuleToModel(row *sqlc.AlertRules, labels map[string]string) *models.AlertRule {
	var description *string
	if row.Description.Valid {
		description = &row.Description.String
	}

	// Convert database schema back to domain model
	interval := time.Duration(row.TimeWindowMinutes.Int32) * time.Minute
	var forDuration *time.Duration
	if row.CooldownMinutes.Valid {
		d := time.Duration(row.CooldownMinutes.Int32) * time.Minute
		forDuration = &d
	}

	return &models.AlertRule{
		ID:          row.ID,
		Name:        row.Name,
		Description: description,
		Query:       row.MetricName,        // Map metric_name back to query
		Condition:   row.ConditionOperator, // Map operator back to condition
		Threshold:   pgNumericToFloat64(row.ThresholdValue),
		Interval:    interval,
		For:         forDuration,
		Labels:      labels,
		IsEnabled:   row.IsEnabled.Bool,
		CreatedAt:   row.CreatedAt,
		UpdatedAt:   row.UpdatedAt,
	}
}

func convertAlertRulesToModels(rows []sqlc.AlertRules) []*models.AlertRule {
	result := make([]*models.AlertRule, len(rows))
	for i, row := range rows {
		result[i] = convertAlertRuleToModel(&row, nil)
	}
	return result
}

func convertAlertToModel(row *sqlc.Alerts) *models.Alert {
	// Deserialize context data
	var contextData map[string]interface{}
	json.Unmarshal(row.ContextData, &contextData)

	var value *float64
	var labels map[string]string
	var annotations map[string]string
	var startsAt time.Time
	var endsAt *time.Time
	var entityType string
	var dedupeKey string

	if contextData != nil {
		if v, ok := contextData["value"].(float64); ok {
			value = &v
		}
		if l, ok := contextData["labels"].(map[string]interface{}); ok {
			labels = make(map[string]string)
			for k, v := range l {
				if s, ok := v.(string); ok {
					labels[k] = s
				}
			}
		}
		if a, ok := contextData["annotations"].(map[string]interface{}); ok {
			annotations = make(map[string]string)
			for k, v := range a {
				if s, ok := v.(string); ok {
					annotations[k] = s
				}
			}
		}
		if s, ok := contextData["starts_at"].(string); ok {
			startsAt, _ = time.Parse(time.RFC3339, s)
		}
		if e, ok := contextData["ends_at"].(string); ok {
			t, _ := time.Parse(time.RFC3339, e)
			endsAt = &t
		}
		if et, ok := contextData["entity_type"].(string); ok {
			entityType = et
		}
		if dk, ok := contextData["dedupe_key"].(string); ok {
			dedupeKey = dk
		}
	}

	status := "firing"
	if row.IsResolved.Bool {
		status = "resolved"
	}

	entityID := ""
	if row.VolumeID.Valid {
		entityID = row.VolumeID.String
	}

	alert := &models.Alert{
		ID:          row.ID,
		RuleID:      row.RuleID,
		EntityID:    entityID,
		EntityType:  entityType,
		DedupeKey:   dedupeKey,
		Status:      status,
		Value:       value,
		Labels:      labels,
		Annotations: annotations,
		StartsAt:    startsAt,
		EndsAt:      endsAt,
		CreatedAt:   row.CreatedAt,
		UpdatedAt:   row.CreatedAt, // Database doesn't have updated_at
	}

	if row.ResolvedAt.Valid {
		alert.EndsAt = &row.ResolvedAt.Time
	}

	return alert
}

func convertAlertsToModels(rows []sqlc.Alerts) []*models.Alert {
	result := make([]*models.Alert, len(rows))
	for i, row := range rows {
		result[i] = convertAlertToModel(&row)
	}
	return result
}

func convertAlertDestinationToModel(row *sqlc.AlertDestinations) *models.AlertDestination {
	var config map[string]interface{}
	json.Unmarshal(row.Configuration, &config)

	return &models.AlertDestination{
		ID:        row.ID,
		Name:      row.Name,
		Type:      row.Type,
		Config:    config,
		IsEnabled: row.IsEnabled.Bool,
		CreatedAt: row.CreatedAt,
		UpdatedAt: row.UpdatedAt,
	}
}

func convertAlertDestinationsToModels(rows []sqlc.AlertDestinations) []*models.AlertDestination {
	result := make([]*models.AlertDestination, len(rows))
	for i, row := range rows {
		result[i] = convertAlertDestinationToModel(&row)
	}
	return result
}

func convertAlertRouteToModel(row *sqlc.AlertRoutes, name string, matchers map[string]string, priority int32) *models.AlertRoute {
	if matchers == nil {
		matchers = make(map[string]string)
		if row.SeverityFilter.Valid {
			matchers["severity"] = row.SeverityFilter.String
		}
	}

	if name == "" {
		name = fmt.Sprintf("route_%d", row.ID)
	}

	return &models.AlertRoute{
		ID:            row.ID,
		Name:          name,
		Matchers:      matchers,
		DestinationID: row.DestinationID,
		Priority:      priority,
		IsEnabled:     true, // Database doesn't have this field
		CreatedAt:     row.CreatedAt,
		UpdatedAt:     row.CreatedAt, // Database doesn't have updated_at
	}
}

func convertAlertRoutesToModels(rows []sqlc.AlertRoutes) []*models.AlertRoute {
	result := make([]*models.AlertRoute, len(rows))
	for i, row := range rows {
		result[i] = convertAlertRouteToModel(&row, "", nil, 0)
	}
	return result
}

func convertAlertDeliveryToModel(row *sqlc.AlertDeliveries, routeID int64, maxAttempts int32) *models.AlertDelivery {
	var lastAttemptAt *time.Time
	if row.LastAttemptAt.Valid {
		lastAttemptAt = &row.LastAttemptAt.Time
	}

	var deliveredAt *time.Time
	if row.DeliveredAt.Valid {
		deliveredAt = &row.DeliveredAt.Time
	}

	var errorMessage *string
	if row.ErrorMessage.Valid {
		errorMessage = &row.ErrorMessage.String
	}

	attemptCount := int32(0)
	if row.AttemptCount.Valid {
		attemptCount = row.AttemptCount.Int32
	}

	return &models.AlertDelivery{
		ID:            row.ID,
		AlertID:       row.AlertID,
		DestinationID: row.DestinationID,
		RouteID:       routeID,
		Status:        row.Status,
		AttemptCount:  attemptCount,
		MaxAttempts:   maxAttempts,
		LastAttemptAt: lastAttemptAt,
		DeliveredAt:   deliveredAt,
		ErrorMessage:  errorMessage,
		CreatedAt:     row.CreatedAt,
		UpdatedAt:     row.CreatedAt, // Database doesn't have updated_at
	}
}

func convertAlertDeliveriesToModels(rows []sqlc.AlertDeliveries) []*models.AlertDelivery {
	result := make([]*models.AlertDelivery, len(rows))
	for i, row := range rows {
		result[i] = convertAlertDeliveryToModel(&row, 0, 3)
	}
	return result
}
