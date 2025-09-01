-- Tracking Rules Engine Queries (SQLite version)
-- SQLC queries for tracking rules operations

-- =============================================================================
-- TRACKING RULES
-- =============================================================================

-- name: CreateTrackingRule :one
INSERT INTO tracking_rules (
    name, description, action, priority, is_enabled, 
    conditions, created_by
) VALUES (
    ?, ?, ?, ?, ?, ?, ?
) RETURNING *;

-- name: GetTrackingRule :one
SELECT * FROM tracking_rules
WHERE id = ?;

-- name: GetTrackingRuleByName :one
SELECT * FROM tracking_rules
WHERE name = ?;

-- name: ListTrackingRules :many
SELECT * FROM tracking_rules
ORDER BY priority ASC, id ASC
LIMIT ? OFFSET ?;

-- name: ListEnabledTrackingRules :many
SELECT * FROM tracking_rules
WHERE is_enabled = 1
ORDER BY priority ASC, id ASC;

-- name: UpdateTrackingRule :one
UPDATE tracking_rules
SET name = ?,
    description = ?,
    action = ?,
    priority = ?,
    is_enabled = ?,
    conditions = ?,
    updated_at = CURRENT_TIMESTAMP
WHERE id = ?
RETURNING *;

-- name: UpdateTrackingRuleStats :exec
UPDATE tracking_rules
SET match_count = match_count + ?,
    last_matched_at = CASE WHEN ? THEN CURRENT_TIMESTAMP ELSE last_matched_at END,
    last_evaluation_at = CURRENT_TIMESTAMP,
    updated_at = CURRENT_TIMESTAMP
WHERE id = ?;

-- name: DeleteTrackingRule :exec
DELETE FROM tracking_rules
WHERE id = ?;

-- =============================================================================
-- RULE EVALUATIONS
-- =============================================================================

-- name: CreateTrackingRuleEvaluation :one
INSERT INTO tracking_rule_evaluations (
    rule_id, evaluation_type, triggered_by, status,
    mounts_evaluated, mounts_matched, mounts_included, mounts_excluded,
    execution_time_ms, error_message, error_details, started_at, completed_at
) VALUES (
    ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
) RETURNING *;

-- name: GetTrackingRuleEvaluation :one
SELECT * FROM tracking_rule_evaluations
WHERE id = ?;

-- name: ListRuleEvaluations :many
SELECT * FROM tracking_rule_evaluations
WHERE rule_id = ?
ORDER BY started_at DESC
LIMIT ? OFFSET ?;

-- name: GetLatestRuleEvaluation :one
SELECT * FROM tracking_rule_evaluations
WHERE rule_id = ?
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
    ?, ?, ?, ?, ?, ?, ?, ?, ?
) RETURNING *;

-- name: GetMountTrackingAssignment :one
SELECT * FROM mount_tracking_assignments
WHERE id = ?;

-- name: GetActiveMountAssignment :one
SELECT * FROM mount_tracking_assignments
WHERE mount_catalog_id = ? AND is_active = 1;

-- name: ListMountAssignments :many
SELECT * FROM mount_tracking_assignments
WHERE mount_catalog_id = ?
ORDER BY assigned_at DESC
LIMIT ? OFFSET ?;

-- name: ListActiveAssignments :many
SELECT * FROM mount_tracking_assignments
WHERE is_active = 1
ORDER BY assigned_at DESC;

-- name: DeactivateMountAssignment :exec
UPDATE mount_tracking_assignments
SET is_active = 0,
    updated_at = CURRENT_TIMESTAMP
WHERE mount_catalog_id = ? AND is_active = 1;

-- name: ExpireOldAssignments :exec
UPDATE mount_tracking_assignments
SET is_active = 0,
    updated_at = CURRENT_TIMESTAMP
WHERE expires_at < CURRENT_TIMESTAMP AND is_active = 1;

-- =============================================================================
-- RULE CONDITIONS
-- =============================================================================

-- name: CreateTrackingRuleCondition :one
INSERT INTO tracking_rule_conditions (
    rule_id, field_name, operator, value, values, 
    is_case_sensitive, description
) VALUES (
    ?, ?, ?, ?, ?, ?, ?
) RETURNING *;

-- name: GetRuleConditions :many
SELECT * FROM tracking_rule_conditions
WHERE rule_id = ?
ORDER BY id;

-- name: UpdateConditionStats :exec
UPDATE tracking_rule_conditions
SET match_count = match_count + 1,
    last_matched_at = CURRENT_TIMESTAMP,
    updated_at = CURRENT_TIMESTAMP
WHERE id = ?;

-- name: DeleteRuleConditions :exec
DELETE FROM tracking_rule_conditions
WHERE rule_id = ?;

-- =============================================================================
-- RULE TEMPLATES
-- =============================================================================

-- name: GetTrackingRuleTemplate :one
SELECT * FROM tracking_rule_templates
WHERE id = ?;

-- name: GetTrackingRuleTemplateByName :one
SELECT * FROM tracking_rule_templates
WHERE name = ?;

-- name: ListTrackingRuleTemplates :many
SELECT * FROM tracking_rule_templates
ORDER BY category, name
LIMIT ? OFFSET ?;

-- name: ListTemplatesByCategory :many
SELECT * FROM tracking_rule_templates
WHERE category = ?
ORDER BY name;

-- name: ListBuiltinTemplates :many
SELECT * FROM tracking_rule_templates
WHERE is_builtin = 1
ORDER BY category, name;

-- name: UpdateTemplateUsage :exec
UPDATE tracking_rule_templates
SET usage_count = usage_count + 1,
    last_used_at = CURRENT_TIMESTAMP,
    updated_at = CURRENT_TIMESTAMP
WHERE id = ?;

-- name: CreateTrackingRuleTemplate :one
INSERT INTO tracking_rule_templates (
    name, description, category, template_data, is_builtin, tags
) VALUES (
    ?, ?, ?, ?, ?, ?
) RETURNING *;

-- name: UpdateTrackingRuleTemplate :one
UPDATE tracking_rule_templates
SET description = ?,
    category = ?,
    template_data = ?,
    tags = ?,
    updated_at = CURRENT_TIMESTAMP
WHERE id = ?
RETURNING *;

-- name: DeleteTrackingRuleTemplate :exec
DELETE FROM tracking_rule_templates
WHERE id = ? AND is_builtin = 0;