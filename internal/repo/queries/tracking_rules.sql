-- name: CreateTrackingRule :one
INSERT INTO tracking_rules (
    name, description, action, priority, is_enabled, conditions, created_by
) VALUES (
    $1, $2, $3, $4, $5, $6, $7
) RETURNING *;

-- name: GetTrackingRule :one
SELECT * FROM tracking_rules WHERE id = $1;

-- name: GetTrackingRuleByName :one
SELECT * FROM tracking_rules WHERE name = $1;

-- name: ListTrackingRules :many
SELECT * FROM tracking_rules
ORDER BY priority ASC, id ASC;

-- name: ListEnabledTrackingRules :many
SELECT * FROM tracking_rules
WHERE is_enabled = true
ORDER BY priority ASC, id ASC;

-- name: ListTrackingRulesByAction :many
SELECT * FROM tracking_rules
WHERE action = $1
ORDER BY priority ASC, id ASC;

-- name: UpdateTrackingRule :one
UPDATE tracking_rules
SET name = $2, description = $3, action = $4, priority = $5, 
    is_enabled = $6, conditions = $7, updated_at = NOW()
WHERE id = $1
RETURNING *;

-- name: UpdateTrackingRuleStats :exec
UPDATE tracking_rules
SET match_count = $2, last_matched_at = $3, last_evaluation_at = $4, updated_at = NOW()
WHERE id = $1;

-- name: IncrementRuleMatchCount :exec
UPDATE tracking_rules
SET match_count = match_count + 1, last_matched_at = NOW(), updated_at = NOW()
WHERE id = $1;

-- name: EnableTrackingRule :exec
UPDATE tracking_rules
SET is_enabled = true, updated_at = NOW()
WHERE id = $1;

-- name: DisableTrackingRule :exec
UPDATE tracking_rules
SET is_enabled = false, updated_at = NOW()
WHERE id = $1;

-- name: DeleteTrackingRule :exec
DELETE FROM tracking_rules WHERE id = $1;

-- name: DeleteTrackingRuleByName :exec
DELETE FROM tracking_rules WHERE name = $1;

-- Rule Evaluations
-- name: CreateTrackingRuleEvaluation :one
INSERT INTO tracking_rule_evaluations (
    rule_id, evaluation_type, triggered_by, status, 
    mounts_evaluated, mounts_matched, mounts_included, mounts_excluded,
    execution_time_ms, error_message, error_details, started_at, completed_at
) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13
) RETURNING *;

-- name: GetTrackingRuleEvaluation :one
SELECT * FROM tracking_rule_evaluations WHERE id = $1;

-- name: ListTrackingRuleEvaluations :many
SELECT * FROM tracking_rule_evaluations
WHERE rule_id = $1
ORDER BY started_at DESC
LIMIT $2 OFFSET $3;

-- name: ListRecentTrackingRuleEvaluations :many
SELECT tre.*, tr.name as rule_name
FROM tracking_rule_evaluations tre
JOIN tracking_rules tr ON tre.rule_id = tr.id
ORDER BY tre.started_at DESC
LIMIT $1 OFFSET $2;

-- name: UpdateTrackingRuleEvaluationStatus :exec
UPDATE tracking_rule_evaluations
SET status = $2, completed_at = $3, error_message = $4, error_details = $5
WHERE id = $1;

-- name: UpdateTrackingRuleEvaluationResults :exec
UPDATE tracking_rule_evaluations
SET mounts_evaluated = $2, mounts_matched = $3, mounts_included = $4, 
    mounts_excluded = $5, execution_time_ms = $6, completed_at = $7
WHERE id = $1;

-- name: DeleteOldTrackingRuleEvaluations :exec
DELETE FROM tracking_rule_evaluations
WHERE started_at < $1;

-- Mount Tracking Assignments
-- name: CreateMountTrackingAssignment :one
INSERT INTO mount_tracking_assignments (
    mount_catalog_id, rule_id, evaluation_id, action, is_active,
    matched_conditions, rule_priority, rule_name
) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8
) RETURNING *;

-- name: GetMountTrackingAssignment :one
SELECT * FROM mount_tracking_assignments WHERE id = $1;

-- name: GetActiveMountTrackingAssignment :one
SELECT * FROM mount_tracking_assignments
WHERE mount_catalog_id = $1 AND is_active = true;

-- name: ListMountTrackingAssignments :many
SELECT mta.*, tr.name as current_rule_name
FROM mount_tracking_assignments mta
LEFT JOIN tracking_rules tr ON mta.rule_id = tr.id
WHERE mta.mount_catalog_id = $1
ORDER BY mta.assigned_at DESC;

-- name: ListActiveMountTrackingAssignments :many
SELECT mta.*, tr.name as current_rule_name, dmc.mount_id, dmc.volume_name
FROM mount_tracking_assignments mta
LEFT JOIN tracking_rules tr ON mta.rule_id = tr.id
JOIN docker_mount_catalog dmc ON mta.mount_catalog_id = dmc.id
WHERE mta.is_active = true
ORDER BY mta.assigned_at DESC;

-- name: ListMountTrackingAssignmentsByAction :many
SELECT mta.*, tr.name as current_rule_name, dmc.mount_id, dmc.volume_name
FROM mount_tracking_assignments mta
LEFT JOIN tracking_rules tr ON mta.rule_id = tr.id
JOIN docker_mount_catalog dmc ON mta.mount_catalog_id = dmc.id
WHERE mta.is_active = true AND mta.action = $1
ORDER BY mta.assigned_at DESC;

-- name: UpdateMountTrackingAssignment :one
UPDATE mount_tracking_assignments
SET rule_id = $2, evaluation_id = $3, action = $4, 
    matched_conditions = $5, rule_priority = $6, rule_name = $7, updated_at = NOW()
WHERE id = $1
RETURNING *;

-- name: DeactivateMountTrackingAssignment :exec
UPDATE mount_tracking_assignments
SET is_active = false, updated_at = NOW()
WHERE id = $1;

-- name: DeactivateAllMountTrackingAssignments :exec
UPDATE mount_tracking_assignments
SET is_active = false, updated_at = NOW()
WHERE mount_catalog_id = $1;

-- name: DeleteMountTrackingAssignment :exec
DELETE FROM mount_tracking_assignments WHERE id = $1;

-- name: DeleteExpiredMountTrackingAssignments :exec
DELETE FROM mount_tracking_assignments
WHERE expires_at IS NOT NULL AND expires_at < NOW();

-- Rule Conditions
-- name: CreateTrackingRuleCondition :one
INSERT INTO tracking_rule_conditions (
    rule_id, field_name, operator, value, values, is_case_sensitive, description
) VALUES (
    $1, $2, $3, $4, $5, $6, $7
) RETURNING *;

-- name: GetTrackingRuleCondition :one
SELECT * FROM tracking_rule_conditions WHERE id = $1;

-- name: ListTrackingRuleConditions :many
SELECT * FROM tracking_rule_conditions
WHERE rule_id = $1
ORDER BY id ASC;

-- name: UpdateTrackingRuleCondition :one
UPDATE tracking_rule_conditions
SET field_name = $2, operator = $3, value = $4, values = $5,
    is_case_sensitive = $6, description = $7, updated_at = NOW()
WHERE id = $1
RETURNING *;

-- name: UpdateTrackingRuleConditionStats :exec
UPDATE tracking_rule_conditions
SET match_count = $2, last_matched_at = $3, updated_at = NOW()
WHERE id = $1;

-- name: IncrementConditionMatchCount :exec
UPDATE tracking_rule_conditions
SET match_count = match_count + 1, last_matched_at = NOW(), updated_at = NOW()
WHERE id = $1;

-- name: DeleteTrackingRuleCondition :exec
DELETE FROM tracking_rule_conditions WHERE id = $1;

-- name: DeleteTrackingRuleConditionsByRule :exec
DELETE FROM tracking_rule_conditions WHERE rule_id = $1;

-- Rule Templates
-- name: CreateTrackingRuleTemplate :one
INSERT INTO tracking_rule_templates (
    name, description, category, template_data, is_builtin, tags
) VALUES (
    $1, $2, $3, $4, $5, $6
) RETURNING *;

-- name: GetTrackingRuleTemplate :one
SELECT * FROM tracking_rule_templates WHERE id = $1;

-- name: GetTrackingRuleTemplateByName :one
SELECT * FROM tracking_rule_templates WHERE name = $1;

-- name: ListTrackingRuleTemplates :many
SELECT * FROM tracking_rule_templates
ORDER BY category ASC, name ASC;

-- name: ListTrackingRuleTemplatesByCategory :many
SELECT * FROM tracking_rule_templates
WHERE category = $1
ORDER BY name ASC;

-- name: ListBuiltinTrackingRuleTemplates :many
SELECT * FROM tracking_rule_templates
WHERE is_builtin = true
ORDER BY category ASC, name ASC;

-- name: SearchTrackingRuleTemplates :many
SELECT * FROM tracking_rule_templates
WHERE name ILIKE '%' || $1 || '%' OR description ILIKE '%' || $1 || '%'
   OR $1 = ANY(tags)
ORDER BY 
    CASE WHEN name ILIKE $1 || '%' THEN 1
         WHEN name ILIKE '%' || $1 || '%' THEN 2
         WHEN $1 = ANY(tags) THEN 3
         ELSE 4 END,
    name ASC;

-- name: UpdateTrackingRuleTemplate :one
UPDATE tracking_rule_templates
SET name = $2, description = $3, category = $4, template_data = $5,
    tags = $6, updated_at = NOW()
WHERE id = $1
RETURNING *;

-- name: IncrementTemplateUsageCount :exec
UPDATE tracking_rule_templates
SET usage_count = usage_count + 1, last_used_at = NOW(), updated_at = NOW()
WHERE id = $1;

-- name: DeleteTrackingRuleTemplate :exec
DELETE FROM tracking_rule_templates WHERE id = $1;

-- name: DeleteTrackingRuleTemplateByName :exec
DELETE FROM tracking_rule_templates WHERE name = $1;

-- Statistics and Analytics
-- name: GetTrackingRulesStats :one
SELECT 
    COUNT(*) as total_rules,
    COUNT(*) FILTER (WHERE is_enabled = true) as enabled_rules,
    COUNT(*) FILTER (WHERE action = 'include') as include_rules,
    COUNT(*) FILTER (WHERE action = 'exclude') as exclude_rules,
    AVG(match_count) as avg_match_count,
    MAX(last_evaluation_at) as last_evaluation_time
FROM tracking_rules;

-- name: GetMostActiveTrackingRules :many
SELECT id, name, action, priority, match_count, last_matched_at
FROM tracking_rules
WHERE match_count > 0
ORDER BY match_count DESC, last_matched_at DESC
LIMIT $1;

-- name: GetTrackingRuleEvaluationStats :one
SELECT 
    COUNT(*) as total_evaluations,
    COUNT(*) FILTER (WHERE status = 'success') as successful_evaluations,
    COUNT(*) FILTER (WHERE status = 'error') as failed_evaluations,
    AVG(execution_time_ms) as avg_execution_time_ms,
    SUM(mounts_evaluated) as total_mounts_evaluated,
    SUM(mounts_matched) as total_mounts_matched
FROM tracking_rule_evaluations
WHERE started_at >= $1;

-- name: GetMountTrackingAssignmentStats :one
SELECT 
    COUNT(*) as total_assignments,
    COUNT(*) FILTER (WHERE is_active = true) as active_assignments,
    COUNT(*) FILTER (WHERE action = 'include' AND is_active = true) as active_includes,
    COUNT(*) FILTER (WHERE action = 'exclude' AND is_active = true) as active_excludes
FROM mount_tracking_assignments;