package repo

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/mantonx/volumeviz/internal/db/sqlc"
)

// TrackingRulesRepository provides access to tracking rules data operations
type TrackingRulesRepository struct {
	queries *sqlc.Queries
	db      *pgx.Conn
}

// NewTrackingRulesRepository creates a new tracking rules repository
func NewTrackingRulesRepository(queries *sqlc.Queries, db *pgx.Conn) *TrackingRulesRepository {
	return &TrackingRulesRepository{
		queries: queries,
		db:      db,
	}
}

// TrackingRule represents a rule for mount tracking
type TrackingRule struct {
	ID               int64               `json:"id"`
	Name             string              `json:"name"`
	Description      *string             `json:"description,omitempty"`
	Action           string              `json:"action"` // 'include' or 'exclude'
	Priority         int32               `json:"priority"`
	IsEnabled        bool                `json:"is_enabled"`
	Conditions       []TrackingCondition `json:"conditions"`
	MatchCount       int32               `json:"match_count"`
	LastMatchedAt    *time.Time          `json:"last_matched_at,omitempty"`
	LastEvaluationAt *time.Time          `json:"last_evaluation_at,omitempty"`
	CreatedBy        *string             `json:"created_by,omitempty"`
	CreatedAt        time.Time           `json:"created_at"`
	UpdatedAt        time.Time           `json:"updated_at"`
}

// TrackingCondition represents a single condition within a rule
type TrackingCondition struct {
	FieldName       string   `json:"field_name"`
	Operator        string   `json:"operator"`
	Value           *string  `json:"value,omitempty"`
	Values          []string `json:"values,omitempty"`
	IsCaseSensitive bool     `json:"is_case_sensitive"`
}

// TrackingRuleEvaluation represents an evaluation session
type TrackingRuleEvaluation struct {
	ID              int64                  `json:"id"`
	RuleID          int64                  `json:"rule_id"`
	EvaluationType  string                 `json:"evaluation_type"`
	TriggeredBy     *string                `json:"triggered_by,omitempty"`
	Status          string                 `json:"status"`
	MountsEvaluated int32                  `json:"mounts_evaluated"`
	MountsMatched   int32                  `json:"mounts_matched"`
	MountsIncluded  int32                  `json:"mounts_included"`
	MountsExcluded  int32                  `json:"mounts_excluded"`
	ExecutionTimeMs *int32                 `json:"execution_time_ms,omitempty"`
	ErrorMessage    *string                `json:"error_message,omitempty"`
	ErrorDetails    map[string]interface{} `json:"error_details,omitempty"`
	StartedAt       time.Time              `json:"started_at"`
	CompletedAt     *time.Time             `json:"completed_at,omitempty"`
	CreatedAt       time.Time              `json:"created_at"`
}

// MountTrackingAssignment represents a mount assignment based on rule evaluation
type MountTrackingAssignment struct {
	ID                int64                  `json:"id"`
	MountCatalogID    int64                  `json:"mount_catalog_id"`
	RuleID            *int64                 `json:"rule_id,omitempty"`
	EvaluationID      *int64                 `json:"evaluation_id,omitempty"`
	Action            string                 `json:"action"`
	IsActive          bool                   `json:"is_active"`
	MatchedConditions map[string]interface{} `json:"matched_conditions,omitempty"`
	RulePriority      *int32                 `json:"rule_priority,omitempty"`
	RuleName          *string                `json:"rule_name,omitempty"`
	AssignedAt        time.Time              `json:"assigned_at"`
	ExpiresAt         *time.Time             `json:"expires_at,omitempty"`
	CreatedAt         time.Time              `json:"created_at"`
	UpdatedAt         time.Time              `json:"updated_at"`
}

// MountTrackingOverride represents a per-mount tracking override
type MountTrackingOverride struct {
	ID        int64     `json:"id"`
	MountID   string    `json:"mount_id"`
	Action    string    `json:"action"` // 'include' or 'exclude'
	Reason    *string   `json:"reason,omitempty"`
	CreatedBy *string   `json:"created_by,omitempty"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// TrackingRuleTemplate represents a reusable rule template
type TrackingRuleTemplate struct {
	ID           int64                  `json:"id"`
	Name         string                 `json:"name"`
	Description  string                 `json:"description"`
	Category     string                 `json:"category"`
	TemplateData map[string]interface{} `json:"template_data"`
	UsageCount   int32                  `json:"usage_count"`
	LastUsedAt   *time.Time             `json:"last_used_at,omitempty"`
	IsBuiltin    bool                   `json:"is_builtin"`
	Tags         []string               `json:"tags"`
	CreatedAt    time.Time              `json:"created_at"`
	UpdatedAt    time.Time              `json:"updated_at"`
}

// Helper functions to convert between domain models and SQLC models

func (r *TrackingRulesRepository) convertFromSQLCRule(rule sqlc.TrackingRules) (*TrackingRule, error) {
	var conditions []TrackingCondition
	if len(rule.Conditions) > 0 {
		if err := json.Unmarshal(rule.Conditions, &conditions); err != nil {
			return nil, fmt.Errorf("failed to unmarshal conditions: %w", err)
		}
	}

	return &TrackingRule{
		ID:               rule.ID,
		Name:             rule.Name,
		Description:      nullTextToStringPtr(rule.Description),
		Action:           rule.Action,
		Priority:         rule.Priority,
		IsEnabled:        rule.IsEnabled,
		Conditions:       conditions,
		MatchCount:       rule.MatchCount,
		LastMatchedAt:    nullTimestampToTimePtr(rule.LastMatchedAt),
		LastEvaluationAt: nullTimestampToTimePtr(rule.LastEvaluationAt),
		CreatedBy:        nullTextToStringPtr(rule.CreatedBy),
		CreatedAt:        rule.CreatedAt,
		UpdatedAt:        rule.UpdatedAt,
	}, nil
}

func (r *TrackingRulesRepository) convertToSQLCCreateParams(rule *TrackingRule) (sqlc.CreateTrackingRuleParams, error) {
	conditionsJSON, err := json.Marshal(rule.Conditions)
	if err != nil {
		return sqlc.CreateTrackingRuleParams{}, fmt.Errorf("failed to marshal conditions: %w", err)
	}

	return sqlc.CreateTrackingRuleParams{
		Name:        rule.Name,
		Description: stringPtrToNullText(rule.Description),
		Action:      rule.Action,
		Priority:    rule.Priority,
		IsEnabled:   rule.IsEnabled,
		Conditions:  conditionsJSON,
		CreatedBy:   stringPtrToNullText(rule.CreatedBy),
	}, nil
}

func (r *TrackingRulesRepository) convertFromSQLCEvaluation(eval sqlc.TrackingRuleEvaluations) (*TrackingRuleEvaluation, error) {
	var errorDetails map[string]interface{}
	if len(eval.ErrorDetails) > 0 {
		if err := json.Unmarshal(eval.ErrorDetails, &errorDetails); err != nil {
			return nil, fmt.Errorf("failed to unmarshal error details: %w", err)
		}
	}

	return &TrackingRuleEvaluation{
		ID:              eval.ID,
		RuleID:          int64ToValue(eval.RuleID),
		EvaluationType:  eval.EvaluationType,
		TriggeredBy:     nullTextToStringPtr(eval.TriggeredBy),
		Status:          eval.Status,
		MountsEvaluated: eval.MountsEvaluated,
		MountsMatched:   eval.MountsMatched,
		MountsIncluded:  eval.MountsIncluded,
		MountsExcluded:  eval.MountsExcluded,
		ExecutionTimeMs: nullInt4ToIntPtr(eval.ExecutionTimeMs),
		ErrorMessage:    nullTextToStringPtr(eval.ErrorMessage),
		ErrorDetails:    errorDetails,
		StartedAt:       timestamptzToTime(eval.StartedAt),
		CompletedAt:     nullTimestampToTimePtr(eval.CompletedAt),
		CreatedAt:       eval.CreatedAt,
	}, nil
}

func (r *TrackingRulesRepository) convertFromSQLCAssignment(assignment sqlc.MountTrackingAssignments) (*MountTrackingAssignment, error) {
	var matchedConditions map[string]interface{}
	if len(assignment.MatchedConditions) > 0 {
		if err := json.Unmarshal(assignment.MatchedConditions, &matchedConditions); err != nil {
			return nil, fmt.Errorf("failed to unmarshal matched conditions: %w", err)
		}
	}

	return &MountTrackingAssignment{
		ID:                assignment.ID,
		MountCatalogID:    int64ToValue(assignment.MountCatalogID),
		RuleID:            nullInt8ToIntPtr(assignment.RuleID),
		EvaluationID:      nullInt8ToIntPtr(assignment.EvaluationID),
		Action:            assignment.Action,
		IsActive:          assignment.IsActive,
		MatchedConditions: matchedConditions,
		RulePriority:      nullInt4ToIntPtr(assignment.RulePriority),
		RuleName:          nullTextToStringPtr(assignment.RuleName),
		AssignedAt:        timestamptzToTime(assignment.AssignedAt),
		ExpiresAt:         nullTimestampToTimePtr(assignment.ExpiresAt),
		CreatedAt:         assignment.CreatedAt,
		UpdatedAt:         assignment.UpdatedAt,
	}, nil
}

func (r *TrackingRulesRepository) convertFromSQLCTemplate(template sqlc.TrackingRuleTemplates) (*TrackingRuleTemplate, error) {
	var templateData map[string]interface{}
	if len(template.TemplateData) > 0 {
		if err := json.Unmarshal(template.TemplateData, &templateData); err != nil {
			return nil, fmt.Errorf("failed to unmarshal template data: %w", err)
		}
	}

	return &TrackingRuleTemplate{
		ID:           template.ID,
		Name:         template.Name,
		Description:  template.Description,
		Category:     template.Category,
		TemplateData: templateData,
		UsageCount:   template.UsageCount,
		LastUsedAt:   nullTimestampToTimePtr(template.LastUsedAt),
		IsBuiltin:    template.IsBuiltin,
		Tags:         template.Tags,
		CreatedAt:    template.CreatedAt,
		UpdatedAt:    template.UpdatedAt,
	}, nil
}

// Tracking Rules CRUD operations

func (r *TrackingRulesRepository) CreateRule(ctx context.Context, rule *TrackingRule) (*TrackingRule, error) {
	params, err := r.convertToSQLCCreateParams(rule)
	if err != nil {
		return nil, err
	}

	sqlcRule, err := r.queries.CreateTrackingRule(ctx, params)
	if err != nil {
		return nil, fmt.Errorf("failed to create tracking rule: %w", err)
	}

	return r.convertFromSQLCRule(sqlcRule)
}

func (r *TrackingRulesRepository) GetRule(ctx context.Context, id int64) (*TrackingRule, error) {
	sqlcRule, err := r.queries.GetTrackingRule(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("failed to get tracking rule: %w", err)
	}

	return r.convertFromSQLCRule(sqlcRule)
}

func (r *TrackingRulesRepository) GetRuleByName(ctx context.Context, name string) (*TrackingRule, error) {
	sqlcRule, err := r.queries.GetTrackingRuleByName(ctx, name)
	if err != nil {
		return nil, fmt.Errorf("failed to get tracking rule by name: %w", err)
	}

	return r.convertFromSQLCRule(sqlcRule)
}

func (r *TrackingRulesRepository) ListRules(ctx context.Context) ([]*TrackingRule, error) {
	sqlcRules, err := r.queries.ListTrackingRules(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to list tracking rules: %w", err)
	}

	rules := make([]*TrackingRule, len(sqlcRules))
	for i, sqlcRule := range sqlcRules {
		rule, err := r.convertFromSQLCRule(sqlcRule)
		if err != nil {
			return nil, err
		}
		rules[i] = rule
	}

	return rules, nil
}

func (r *TrackingRulesRepository) ListEnabledRules(ctx context.Context) ([]*TrackingRule, error) {
	sqlcRules, err := r.queries.ListEnabledTrackingRules(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to list enabled tracking rules: %w", err)
	}

	rules := make([]*TrackingRule, len(sqlcRules))
	for i, sqlcRule := range sqlcRules {
		rule, err := r.convertFromSQLCRule(sqlcRule)
		if err != nil {
			return nil, err
		}
		rules[i] = rule
	}

	return rules, nil
}

func (r *TrackingRulesRepository) UpdateRule(ctx context.Context, rule *TrackingRule) (*TrackingRule, error) {
	conditionsJSON, err := json.Marshal(rule.Conditions)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal conditions: %w", err)
	}

	params := sqlc.UpdateTrackingRuleParams{
		ID:          rule.ID,
		Name:        rule.Name,
		Description: stringPtrToNullText(rule.Description),
		Action:      rule.Action,
		Priority:    rule.Priority,
		IsEnabled:   rule.IsEnabled,
		Conditions:  conditionsJSON,
	}

	sqlcRule, err := r.queries.UpdateTrackingRule(ctx, params)
	if err != nil {
		return nil, fmt.Errorf("failed to update tracking rule: %w", err)
	}

	return r.convertFromSQLCRule(sqlcRule)
}

func (r *TrackingRulesRepository) DeleteRule(ctx context.Context, id int64) error {
	err := r.queries.DeleteTrackingRule(ctx, id)
	if err != nil {
		return fmt.Errorf("failed to delete tracking rule: %w", err)
	}
	return nil
}

// Rule Evaluation operations

func (r *TrackingRulesRepository) CreateEvaluation(ctx context.Context, eval *TrackingRuleEvaluation) (*TrackingRuleEvaluation, error) {
	errorDetailsJSON := []byte("{}")
	if eval.ErrorDetails != nil {
		var err error
		errorDetailsJSON, err = json.Marshal(eval.ErrorDetails)
		if err != nil {
			return nil, fmt.Errorf("failed to marshal error details: %w", err)
		}
	}

	params := sqlc.CreateTrackingRuleEvaluationParams{
		RuleID:          valueToInt8(eval.RuleID),
		EvaluationType:  eval.EvaluationType,
		TriggeredBy:     stringPtrToNullText(eval.TriggeredBy),
		Status:          eval.Status,
		MountsEvaluated: eval.MountsEvaluated,
		MountsMatched:   eval.MountsMatched,
		MountsIncluded:  eval.MountsIncluded,
		MountsExcluded:  eval.MountsExcluded,
		ExecutionTimeMs: intPtrToNullInt4(eval.ExecutionTimeMs),
		ErrorMessage:    stringPtrToNullText(eval.ErrorMessage),
		ErrorDetails:    errorDetailsJSON,
		StartedAt:       timeToTimestamptz(eval.StartedAt),
		CompletedAt:     timePtrToNullTimestamp(eval.CompletedAt),
	}

	sqlcEval, err := r.queries.CreateTrackingRuleEvaluation(ctx, params)
	if err != nil {
		return nil, fmt.Errorf("failed to create tracking rule evaluation: %w", err)
	}

	return r.convertFromSQLCEvaluation(sqlcEval)
}

// Helper functions for type conversions

func nullTextToStringPtr(nt pgtype.Text) *string {
	if !nt.Valid {
		return nil
	}
	return &nt.String
}

func stringPtrToNullText(s *string) pgtype.Text {
	if s == nil {
		return pgtype.Text{Valid: false}
	}
	return pgtype.Text{String: *s, Valid: true}
}

func nullTimestampToTimePtr(nt pgtype.Timestamptz) *time.Time {
	if !nt.Valid {
		return nil
	}
	return &nt.Time
}

func timePtrToNullTimestamp(t *time.Time) pgtype.Timestamptz {
	if t == nil {
		return pgtype.Timestamptz{Valid: false}
	}
	return pgtype.Timestamptz{Time: *t, Valid: true}
}

func nullInt4ToIntPtr(ni pgtype.Int4) *int32 {
	if !ni.Valid {
		return nil
	}
	return &ni.Int32
}

func intPtrToNullInt4(i *int32) pgtype.Int4 {
	if i == nil {
		return pgtype.Int4{Valid: false}
	}
	return pgtype.Int4{Int32: *i, Valid: true}
}

func nullInt8ToIntPtr(ni pgtype.Int8) *int64 {
	if !ni.Valid {
		return nil
	}
	return &ni.Int64
}

func int64ToValue(ni pgtype.Int8) int64 {
	return ni.Int64
}

func valueToInt8(i int64) pgtype.Int8 {
	return pgtype.Int8{Int64: i, Valid: true}
}

func timestamptzToTime(ts pgtype.Timestamptz) time.Time {
	return ts.Time
}

func timeToTimestamptz(t time.Time) pgtype.Timestamptz {
	return pgtype.Timestamptz{Time: t, Valid: true}
}

// Mount Override operations (placeholder implementations)

func (r *TrackingRulesRepository) CreateMountOverride(ctx context.Context, override *MountTrackingOverride) (*MountTrackingOverride, error) {
	// For now, return a placeholder implementation
	// In a full implementation, this would create a record in the database
	now := time.Now()
	return &MountTrackingOverride{
		ID:        1, // Placeholder ID
		MountID:   override.MountID,
		Action:    override.Action,
		Reason:    override.Reason,
		CreatedBy: override.CreatedBy,
		CreatedAt: now,
		UpdatedAt: now,
	}, nil
}

func (r *TrackingRulesRepository) ListMountOverrides(ctx context.Context) ([]*MountTrackingOverride, error) {
	// For now, return an empty list
	// In a full implementation, this would query the database
	return []*MountTrackingOverride{}, nil
}

func (r *TrackingRulesRepository) DeleteMountOverride(ctx context.Context, mountID string) error {
	// For now, return success
	// In a full implementation, this would delete the record from the database
	return nil
}
