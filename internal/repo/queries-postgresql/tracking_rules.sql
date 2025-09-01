-- Tracking Rules Engine Queries
-- SQLC queries for tracking rules operations

-- =============================================================================
-- TRACKING RULES
-- =============================================================================

-- name: CreateTrackingRule :one
INSERT INTO tracking_rules (
    name, description, action, priority, is_enabled, 
    conditions, created_by
) VALUES (
    $1, $2, $3, $4, $5, $6, $7
) RETURNING *;

-- name: GetTrackingRule :one
SELECT * FROM tracking_rules
WHERE id = $1;

-- name: GetTrackingRuleByName :one
SELECT * FROM tracking_rules
WHERE name = $1;

-- name: ListTrackingRules :many
SELECT * FROM tracking_rules
ORDER BY priority ASC, id ASC
LIMIT $1 OFFSET $2;

-- name: ListEnabledTrackingRules :many
SELECT * FROM tracking_rules
WHERE is_enabled = true
ORDER BY priority ASC, id ASC;

-- name: UpdateTrackingRule :one
UPDATE tracking_rules
SET name = $2,
    description = $3,
    action = $4,
    priority = $5,
    is_enabled = $6,
    conditions = $7,
    updated_at = CURRENT_TIMESTAMP
WHERE id = $1
RETURNING *;

-- name: UpdateTrackingRuleStats :exec
UPDATE tracking_rules
SET match_count = match_count + $2,
    last_matched_at = CASE WHEN $3 THEN CURRENT_TIMESTAMP ELSE last_matched_at END,
    last_evaluation_at = CURRENT_TIMESTAMP,
    updated_at = CURRENT_TIMESTAMP
WHERE id = $1;

-- name: DeleteTrackingRule :exec
DELETE FROM tracking_rules
WHERE id = $1;

-- =============================================================================
-- RULE EVALUATIONS
-- =============================================================================

-- name: CreateTrackingRuleEvaluation :one
INSERT INTO tracking_rule_evaluations (
    rule_id, evaluation_type, triggered_by, status,
    mounts_evaluated, mounts_matched, mounts_included, mounts_excluded,
    execution_time_ms, error_message, error_details, started_at, completed_at
) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13
) RETURNING *;

-- name: GetTrackingRuleEvaluation :one
SELECT * FROM tracking_rule_evaluations
WHERE id = $1;

-- name: ListRuleEvaluations :many
SELECT * FROM tracking_rule_evaluations
WHERE rule_id = $1
ORDER BY started_at DESC
LIMIT $2 OFFSET $3;

-- name: GetLatestRuleEvaluation :one
SELECT * FROM tracking_rule_evaluations
WHERE rule_id = $1
ORDER BY started_at DESC
LIMIT 1;

-- =============================================================================
-- MOUNT TRACKING ASSIGNMENTS
-- =============================================================================

-- name: CreateMountTrackingAssignment :one
INSERT INTO mount_tracking_assignments (
    mount_catalog_id, rule_id, evaluation_id, action, is_active,
    matched_conditions, rule_priority, rule_name, expires_at
) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8, $9
) RETURNING *;

-- name: GetMountTrackingAssignment :one
SELECT * FROM mount_tracking_assignments
WHERE id = $1;

-- name: GetActiveMountAssignment :one
SELECT * FROM mount_tracking_assignments
WHERE mount_catalog_id = $1 AND is_active = true;

-- name: ListMountAssignments :many
SELECT * FROM mount_tracking_assignments
WHERE mount_catalog_id = $1
ORDER BY assigned_at DESC
LIMIT $2 OFFSET $3;

-- name: ListActiveAssignments :many
SELECT * FROM mount_tracking_assignments
WHERE is_active = true
ORDER BY assigned_at DESC;

-- name: DeactivateMountAssignment :exec
UPDATE mount_tracking_assignments
SET is_active = false,
    updated_at = CURRENT_TIMESTAMP
WHERE mount_catalog_id = $1 AND is_active = true;

-- name: ExpireOldAssignments :exec
UPDATE mount_tracking_assignments
SET is_active = false,
    updated_at = CURRENT_TIMESTAMP
WHERE expires_at < CURRENT_TIMESTAMP AND is_active = true;

-- =============================================================================
-- RULE CONDITIONS
-- =============================================================================

-- name: CreateTrackingRuleCondition :one
INSERT INTO tracking_rule_conditions (
    rule_id, field_name, operator, value, values, 
    is_case_sensitive, description
) VALUES (
    $1, $2, $3, $4, $5, $6, $7
) RETURNING *;

-- name: GetRuleConditions :many
SELECT * FROM tracking_rule_conditions
WHERE rule_id = $1
ORDER BY id;

-- name: UpdateConditionStats :exec
UPDATE tracking_rule_conditions
SET match_count = match_count + 1,
    last_matched_at = CURRENT_TIMESTAMP,
    updated_at = CURRENT_TIMESTAMP
WHERE id = $1;

-- name: DeleteRuleConditions :exec
DELETE FROM tracking_rule_conditions
WHERE rule_id = $1;

-- =============================================================================
-- RULE TEMPLATES
-- =============================================================================

-- name: GetTrackingRuleTemplate :one
SELECT * FROM tracking_rule_templates
WHERE id = $1;

-- name: GetTrackingRuleTemplateByName :one
SELECT * FROM tracking_rule_templates
WHERE name = $1;

-- name: ListTrackingRuleTemplates :many
SELECT * FROM tracking_rule_templates
ORDER BY category, name
LIMIT $1 OFFSET $2;

-- name: ListTemplatesByCategory :many
SELECT * FROM tracking_rule_templates
WHERE category = $1
ORDER BY name;

-- name: ListBuiltinTemplates :many
SELECT * FROM tracking_rule_templates
WHERE is_builtin = true
ORDER BY category, name;

-- name: UpdateTemplateUsage :exec
UPDATE tracking_rule_templates
SET usage_count = usage_count + 1,
    last_used_at = CURRENT_TIMESTAMP,
    updated_at = CURRENT_TIMESTAMP
WHERE id = $1;

-- name: CreateTrackingRuleTemplate :one
INSERT INTO tracking_rule_templates (
    name, description, category, template_data, is_builtin, tags
) VALUES (
    $1, $2, $3, $4, $5, $6
) RETURNING *;

-- name: UpdateTrackingRuleTemplate :one
UPDATE tracking_rule_templates
SET description = $2,
    category = $3,
    template_data = $4,
    tags = $5,
    updated_at = CURRENT_TIMESTAMP
WHERE id = $1
RETURNING *;

-- name: DeleteTrackingRuleTemplate :exec
DELETE FROM tracking_rule_templates
WHERE id = $1 AND is_builtin = false;