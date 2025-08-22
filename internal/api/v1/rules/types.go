package rules

import (
	"time"
)

// CreateRuleRequest represents a request to create a new tracking rule
type CreateRuleRequest struct {
	Name        string             `json:"name" validate:"required" example:"Include Docker Volumes" swaggertype:"string"`
	Description *string            `json:"description,omitempty" example:"Include all named Docker volumes for tracking" swaggertype:"string"`
	Action      string             `json:"action" validate:"required,oneof=include exclude" example:"include" enums:"include,exclude"`
	Priority    int32              `json:"priority" example:"100" minimum:"1" maximum:"1000"`
	IsEnabled   bool               `json:"is_enabled" example:"true"`
	Conditions  []ConditionRequest `json:"conditions" validate:"required,min=1"`
	CreatedBy   *string            `json:"created_by,omitempty" example:"admin" swaggertype:"string"`
}

// UpdateRuleRequest represents a request to update a tracking rule
type UpdateRuleRequest struct {
	Name        *string             `json:"name,omitempty"`
	Description *string             `json:"description,omitempty"`
	Action      *string             `json:"action,omitempty" validate:"omitempty,oneof=include exclude"`
	Priority    *int32              `json:"priority,omitempty"`
	IsEnabled   *bool               `json:"is_enabled,omitempty"`
	Conditions  *[]ConditionRequest `json:"conditions,omitempty"`
}

// ConditionRequest represents a rule condition in API requests
type ConditionRequest struct {
	FieldName       string   `json:"field_name" validate:"required" example:"source_type" enums:"source_type,docker_volume_name,host_path,compose_project,compose_service,container_image,container_name,read_only,is_orphaned,driver"`
	Operator        string   `json:"operator" validate:"required,oneof=equals not_equals prefix suffix contains not_contains regex not_regex glob in not_in" example:"equals" enums:"equals,not_equals,prefix,suffix,contains,not_contains,regex,not_regex,glob,in,not_in"`
	Value           *string  `json:"value,omitempty" example:"volume" swaggertype:"string"`
	Values          []string `json:"values,omitempty" example:"volume,bind"`
	IsCaseSensitive bool     `json:"is_case_sensitive" example:"false"`
}

// RuleResponse represents a tracking rule in API responses
type RuleResponse struct {
	ID                int64              `json:"id" example:"1"`
	Name              string             `json:"name" example:"Include Docker Volumes"`
	Description       *string            `json:"description,omitempty" example:"Include all named Docker volumes for tracking" swaggertype:"string"`
	Action            string             `json:"action" example:"include" enums:"include,exclude"`
	Priority          int32              `json:"priority" example:"100" minimum:"1" maximum:"1000"`
	IsEnabled         bool               `json:"is_enabled" example:"true"`
	Conditions        []ConditionRequest `json:"conditions"`
	MatchCount        int32              `json:"match_count" example:"5"`
	LastMatchedAt     *time.Time         `json:"last_matched_at,omitempty" swaggertype:"string" format:"date-time"`
	LastEvaluationAt  *time.Time         `json:"last_evaluation_at,omitempty" swaggertype:"string" format:"date-time"`
	CreatedBy         *string            `json:"created_by,omitempty" example:"admin" swaggertype:"string"`
	CreatedAt         time.Time          `json:"created_at" swaggertype:"string" format:"date-time"`
	UpdatedAt         time.Time          `json:"updated_at" swaggertype:"string" format:"date-time"`
}

// ListRulesResponse represents a response containing multiple rules
type ListRulesResponse struct {
	Rules []*RuleResponse `json:"rules"`
	Total int32           `json:"total"`
}

// RuleTemplate represents a rule template for creating new rules
type RuleTemplate struct {
	ID           int64                  `json:"id"`
	Name         string                 `json:"name"`
	Description  string                 `json:"description"`
	Category     string                 `json:"category"`
	IsBuiltin    bool                   `json:"is_builtin"`
	Tags         []string               `json:"tags"`
	TemplateData map[string]interface{} `json:"template_data"`
	UsageCount   int32                  `json:"usage_count"`
	LastUsedAt   *time.Time             `json:"last_used_at,omitempty"`
	CreatedAt    time.Time              `json:"created_at"`
	UpdatedAt    time.Time              `json:"updated_at"`
}

// ListRuleTemplatesResponse represents a response containing rule templates
type ListRuleTemplatesResponse struct {
	Templates []*RuleTemplate `json:"templates"`
	Total     int32           `json:"total"`
}

// Field definitions for rule conditions
var AvailableFields = []FieldDefinition{
	{
		Name:        "source_type",
		DisplayName: "Mount Type",
		Description: "Type of mount (volume, bind, tmpfs)",
		Type:        "string",
		Values:      []string{"volume", "bind", "tmpfs"},
		Operators:   []string{"equals", "not_equals", "in", "not_in"},
	},
	{
		Name:        "docker_volume_name",
		DisplayName: "Docker Volume Name",
		Description: "Name of the Docker volume (for volume mounts)",
		Type:        "string",
		Operators:   []string{"equals", "not_equals", "prefix", "suffix", "contains", "not_contains", "regex", "not_regex", "glob"},
	},
	{
		Name:        "host_path",
		DisplayName: "Host Path",
		Description: "Host filesystem path (for bind mounts)",
		Type:        "string",
		Operators:   []string{"equals", "not_equals", "prefix", "suffix", "contains", "not_contains", "regex", "not_regex", "glob"},
	},
	{
		Name:        "compose_project",
		DisplayName: "Compose Project",
		Description: "Docker Compose project name",
		Type:        "string",
		Operators:   []string{"equals", "not_equals", "prefix", "suffix", "contains", "not_contains", "regex", "not_regex", "glob", "in", "not_in"},
	},
	{
		Name:        "compose_service",
		DisplayName: "Compose Service",
		Description: "Docker Compose service name",
		Type:        "string",
		Operators:   []string{"equals", "not_equals", "prefix", "suffix", "contains", "not_contains", "regex", "not_regex", "glob", "in", "not_in"},
	},
	{
		Name:        "container_image",
		DisplayName: "Container Image",
		Description: "Docker container image name",
		Type:        "string",
		Operators:   []string{"equals", "not_equals", "prefix", "suffix", "contains", "not_contains", "regex", "not_regex", "glob"},
	},
	{
		Name:        "container_name",
		DisplayName: "Container Name",
		Description: "Docker container name",
		Type:        "string",
		Operators:   []string{"equals", "not_equals", "prefix", "suffix", "contains", "not_contains", "regex", "not_regex", "glob"},
	},
	{
		Name:        "read_only",
		DisplayName: "Read Only",
		Description: "Whether the mount is read-only",
		Type:        "boolean",
		Values:      []string{"true", "false"},
		Operators:   []string{"equals", "not_equals"},
	},
	{
		Name:        "is_orphaned",
		DisplayName: "Is Orphaned",
		Description: "Whether the mount has no active containers",
		Type:        "boolean",
		Values:      []string{"true", "false"},
		Operators:   []string{"equals", "not_equals"},
	},
	{
		Name:        "driver",
		DisplayName: "Volume Driver",
		Description: "Docker volume driver (local, nfs, etc.)",
		Type:        "string",
		Operators:   []string{"equals", "not_equals", "prefix", "suffix", "contains", "not_contains", "in", "not_in"},
	},
}

// FieldDefinition describes available fields for rule conditions
type FieldDefinition struct {
	Name        string   `json:"name"`
	DisplayName string   `json:"display_name"`
	Description string   `json:"description"`
	Type        string   `json:"type"` // string, boolean, number
	Values      []string `json:"values,omitempty"` // For enum-like fields
	Operators   []string `json:"operators"`        // Available operators for this field
}

// OperatorDefinition describes available operators
type OperatorDefinition struct {
	Name        string `json:"name"`
	DisplayName string `json:"display_name"`
	Description string `json:"description"`
	ValueType   string `json:"value_type"` // single, multiple, none
}

// Available operators
var AvailableOperators = []OperatorDefinition{
	{
		Name:        "equals",
		DisplayName: "Equals",
		Description: "Exact match",
		ValueType:   "single",
	},
	{
		Name:        "not_equals",
		DisplayName: "Not Equals",
		Description: "Does not match exactly",
		ValueType:   "single",
	},
	{
		Name:        "prefix",
		DisplayName: "Starts With",
		Description: "Starts with the specified value",
		ValueType:   "single",
	},
	{
		Name:        "suffix",
		DisplayName: "Ends With",
		Description: "Ends with the specified value",
		ValueType:   "single",
	},
	{
		Name:        "contains",
		DisplayName: "Contains",
		Description: "Contains the specified value",
		ValueType:   "single",
	},
	{
		Name:        "not_contains",
		DisplayName: "Does Not Contain",
		Description: "Does not contain the specified value",
		ValueType:   "single",
	},
	{
		Name:        "regex",
		DisplayName: "Regular Expression",
		Description: "Matches the regular expression pattern",
		ValueType:   "single",
	},
	{
		Name:        "not_regex",
		DisplayName: "Not Regular Expression",
		Description: "Does not match the regular expression pattern",
		ValueType:   "single",
	},
	{
		Name:        "glob",
		DisplayName: "Glob Pattern",
		Description: "Matches the glob pattern (* and ? wildcards)",
		ValueType:   "single",
	},
	{
		Name:        "in",
		DisplayName: "In List",
		Description: "Matches any value in the list",
		ValueType:   "multiple",
	},
	{
		Name:        "not_in",
		DisplayName: "Not In List",
		Description: "Does not match any value in the list",
		ValueType:   "multiple",
	},
}

// GetSchemaResponse provides schema information for rule building
type GetSchemaResponse struct {
	Fields    []FieldDefinition    `json:"fields"`
	Operators []OperatorDefinition `json:"operators"`
}

// ValidateRuleRequest represents a request to validate a rule
type ValidateRuleRequest struct {
	Name       string             `json:"name"`
	Action     string             `json:"action"`
	Priority   int32              `json:"priority"`
	Conditions []ConditionRequest `json:"conditions"`
}

// ValidateRuleResponse represents the response from rule validation
type ValidateRuleResponse struct {
	IsValid  bool                    `json:"is_valid"`
	Errors   []ValidationError       `json:"errors,omitempty"`
	Warnings []ValidationWarning     `json:"warnings,omitempty"`
	Preview  *ValidationPreview      `json:"preview,omitempty"`
}

// ValidationError represents a validation error
type ValidationError struct {
	Field   string `json:"field"`
	Message string `json:"message"`
	Code    string `json:"code"`
}

// ValidationWarning represents a validation warning
type ValidationWarning struct {
	Field   string `json:"field"`
	Message string `json:"message"`
	Code    string `json:"code"`
}

// ValidationPreview provides a preview of what the rule would match
type ValidationPreview struct {
	EstimatedMatches int32    `json:"estimated_matches"`
	SampleMounts     []string `json:"sample_mounts,omitempty"`
	Conflicts        []string `json:"conflicts,omitempty"`
}

// TrackingRulesConfigResponse represents the tracking rules configuration
type TrackingRulesConfigResponse struct {
	Rules   []*RuleResponse `json:"rules"`
	Total   int32           `json:"total"`
	Enabled int32           `json:"enabled"`
}

// UpdateTrackingRulesConfigRequest represents a request to update tracking rules configuration
type UpdateTrackingRulesConfigRequest struct {
	Rules []RuleConfigUpdate `json:"rules" validate:"required"`
}

// RuleConfigUpdate represents an update to a rule's configuration
type RuleConfigUpdate struct {
	ID        int64 `json:"id" validate:"required"`
	Priority  int32 `json:"priority"`
	IsEnabled bool  `json:"is_enabled"`
}

// CreateMountOverrideRequest represents a request to create a mount tracking override
type CreateMountOverrideRequest struct {
	MountID   string  `json:"mount_id" validate:"required"`
	Action    string  `json:"action" validate:"required,oneof=include exclude"`
	Reason    *string `json:"reason,omitempty"`
	CreatedBy *string `json:"created_by,omitempty"`
}

// MountOverrideResponse represents a mount tracking override in API responses
type MountOverrideResponse struct {
	ID        int64     `json:"id"`
	MountID   string    `json:"mount_id"`
	Action    string    `json:"action"`
	Reason    *string   `json:"reason,omitempty"`
	CreatedBy *string   `json:"created_by,omitempty"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// ListMountOverridesResponse represents a response containing mount overrides
type ListMountOverridesResponse struct {
	Overrides []*MountOverrideResponse `json:"overrides"`
	Total     int32                    `json:"total"`
}

// ApplyTrackingRulesRequest represents a request to apply tracking rules
type ApplyTrackingRulesRequest struct {
	DryRun bool `json:"dry_run"`
}

// ApplyTrackingRulesResponse represents the response from applying tracking rules
type ApplyTrackingRulesResponse struct {
	DryRun       bool               `json:"dry_run"`
	ChangesCount int32              `json:"changes_count"`
	Changes      []*TrackingChange  `json:"changes"`
	AppliedAt    *time.Time         `json:"applied_at,omitempty"`
}

// TrackingChange represents a change in mount tracking status
type TrackingChange struct {
	MountID       string  `json:"mount_id"`
	MountName     *string `json:"mount_name,omitempty"`
	MountType     string  `json:"mount_type"`
	OldAction     string  `json:"old_action"`
	NewAction     string  `json:"new_action"`
	RuleName      *string `json:"rule_name,omitempty"`
	RulePriority  *int32  `json:"rule_priority,omitempty"`
}