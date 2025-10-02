-- name: CreateAlertRule :one
INSERT INTO alert_rules (
    name,
    description,
    rule_type,
    metric_name,
    condition_operator,
    threshold_value,
    time_window_minutes,
    min_occurrences,
    is_enabled,
    severity,
    cooldown_minutes,
    created_at,
    updated_at
) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW()
) RETURNING *;

-- name: GetAlertRule :one
SELECT * FROM alert_rules WHERE id = $1;

-- name: GetAlertRuleByName :one
SELECT * FROM alert_rules WHERE name = $1;

-- name: ListAlertRules :many
SELECT * FROM alert_rules
ORDER BY created_at DESC
LIMIT $1 OFFSET $2;

-- name: ListEnabledAlertRules :many
SELECT * FROM alert_rules
WHERE is_enabled = true
ORDER BY severity DESC, name ASC;

-- name: UpdateAlertRule :exec
UPDATE alert_rules
SET name = $2,
    description = $3,
    rule_type = $4,
    metric_name = $5,
    condition_operator = $6,
    threshold_value = $7,
    time_window_minutes = $8,
    min_occurrences = $9,
    is_enabled = $10,
    severity = $11,
    cooldown_minutes = $12,
    updated_at = NOW()
WHERE id = $1;

-- name: UpdateAlertRuleTrigger :exec
UPDATE alert_rules
SET last_triggered_at = $2,
    trigger_count = trigger_count + 1,
    updated_at = NOW()
WHERE id = $1;

-- name: DeleteAlertRule :exec
DELETE FROM alert_rules WHERE id = $1;

-- name: CountAlertRules :one
SELECT COUNT(*) FROM alert_rules;

-- name: CountEnabledAlertRules :one
SELECT COUNT(*) FROM alert_rules WHERE is_enabled = true;

-- =============================================================================
-- ALERTS
-- =============================================================================

-- name: CreateAlert :one
INSERT INTO alerts (
    rule_id,
    volume_id,
    severity,
    title,
    message,
    context_data,
    is_resolved,
    resolved_at,
    organization_id,
    created_at
) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8, $9, NOW()
) RETURNING *;

-- name: GetAlert :one
SELECT * FROM alerts WHERE id = $1;

-- name: GetAlertByRuleAndVolume :one
SELECT * FROM alerts
WHERE rule_id = $1
  AND volume_id = $2
  AND is_resolved = false
ORDER BY created_at DESC
LIMIT 1;

-- name: ListAlerts :many
SELECT * FROM alerts
ORDER BY created_at DESC
LIMIT $1 OFFSET $2;

-- name: ListAlertsByRule :many
SELECT * FROM alerts
WHERE rule_id = $1
ORDER BY created_at DESC
LIMIT $2 OFFSET $3;

-- name: ListAlertsByOrganization :many
SELECT * FROM alerts
WHERE organization_id = $1
ORDER BY created_at DESC
LIMIT $2 OFFSET $3;

-- name: ListActiveAlerts :many
SELECT * FROM alerts
WHERE is_resolved = false
ORDER BY severity DESC, created_at DESC
LIMIT $1 OFFSET $2;

-- name: ListActiveAlertsByOrganization :many
SELECT * FROM alerts
WHERE organization_id = $1
  AND is_resolved = false
ORDER BY severity DESC, created_at DESC
LIMIT $2 OFFSET $3;

-- name: UpdateAlertResolved :exec
UPDATE alerts
SET is_resolved = $2,
    resolved_at = $3
WHERE id = $1;

-- name: ResolveAlertByRuleAndVolume :exec
UPDATE alerts
SET is_resolved = true,
    resolved_at = NOW()
WHERE rule_id = $1
  AND volume_id = $2
  AND is_resolved = false;

-- name: DeleteAlert :exec
DELETE FROM alerts WHERE id = $1;

-- name: DeleteAlertsByRule :exec
DELETE FROM alerts WHERE rule_id = $1;

-- name: CountAlerts :one
SELECT COUNT(*) FROM alerts;

-- name: CountAlertsByOrganization :one
SELECT COUNT(*) FROM alerts WHERE organization_id = $1;

-- name: CountActiveAlerts :one
SELECT COUNT(*) FROM alerts WHERE is_resolved = false;

-- name: CountActiveAlertsByOrganization :one
SELECT COUNT(*) FROM alerts
WHERE organization_id = $1
  AND is_resolved = false;

-- =============================================================================
-- ALERT DESTINATIONS
-- =============================================================================

-- name: CreateAlertDestination :one
INSERT INTO alert_destinations (
    name,
    type,
    configuration,
    is_enabled,
    created_at,
    updated_at
) VALUES (
    $1, $2, $3, $4, NOW(), NOW()
) RETURNING *;

-- name: GetAlertDestination :one
SELECT * FROM alert_destinations WHERE id = $1;

-- name: GetAlertDestinationByName :one
SELECT * FROM alert_destinations WHERE name = $1;

-- name: ListAlertDestinations :many
SELECT * FROM alert_destinations
ORDER BY name ASC
LIMIT $1 OFFSET $2;

-- name: ListEnabledAlertDestinations :many
SELECT * FROM alert_destinations
WHERE is_enabled = true
ORDER BY name ASC;

-- name: UpdateAlertDestination :exec
UPDATE alert_destinations
SET name = $2,
    type = $3,
    configuration = $4,
    is_enabled = $5,
    updated_at = NOW()
WHERE id = $1;

-- name: UpdateAlertDestinationLastUsed :exec
UPDATE alert_destinations
SET last_used_at = NOW()
WHERE id = $1;

-- name: DeleteAlertDestination :exec
DELETE FROM alert_destinations WHERE id = $1;

-- name: CountAlertDestinations :one
SELECT COUNT(*) FROM alert_destinations;

-- name: CountEnabledAlertDestinations :one
SELECT COUNT(*) FROM alert_destinations WHERE is_enabled = true;

-- =============================================================================
-- ALERT ROUTES
-- =============================================================================

-- name: CreateAlertRoute :one
INSERT INTO alert_routes (
    rule_id,
    destination_id,
    severity_filter,
    created_at
) VALUES (
    $1, $2, $3, NOW()
) RETURNING *;

-- name: GetAlertRoute :one
SELECT * FROM alert_routes WHERE id = $1;

-- name: ListAlertRoutes :many
SELECT * FROM alert_routes
ORDER BY id ASC
LIMIT $1 OFFSET $2;

-- name: ListRoutesByRule :many
SELECT * FROM alert_routes
WHERE rule_id = $1
ORDER BY id ASC;

-- name: ListRoutesByDestination :many
SELECT * FROM alert_routes
WHERE destination_id = $1
ORDER BY id ASC;

-- name: ListRoutesByRuleAndSeverity :many
SELECT * FROM alert_routes
WHERE rule_id = $1
  AND (severity_filter IS NULL OR severity_filter = $2)
ORDER BY id ASC;

-- name: DeleteAlertRoute :exec
DELETE FROM alert_routes WHERE id = $1;

-- name: DeleteRoutesByRule :exec
DELETE FROM alert_routes WHERE rule_id = $1;

-- name: DeleteRoutesByDestination :exec
DELETE FROM alert_routes WHERE destination_id = $1;

-- name: CountAlertRoutes :one
SELECT COUNT(*) FROM alert_routes;

-- =============================================================================
-- ALERT DELIVERIES
-- =============================================================================

-- name: CreateAlertDelivery :one
INSERT INTO alert_deliveries (
    alert_id,
    destination_id,
    status,
    attempt_count,
    last_attempt_at,
    delivered_at,
    error_message,
    response_data,
    created_at
) VALUES (
    $1, $2, 'pending', 0, NULL, NULL, NULL, '{}'::jsonb, NOW()
) RETURNING *;

-- name: GetAlertDelivery :one
SELECT * FROM alert_deliveries WHERE id = $1;

-- name: ListAlertDeliveries :many
SELECT * FROM alert_deliveries
ORDER BY created_at DESC
LIMIT $1 OFFSET $2;

-- name: ListDeliveriesByAlert :many
SELECT * FROM alert_deliveries
WHERE alert_id = $1
ORDER BY created_at DESC;

-- name: ListDeliveriesByDestination :many
SELECT * FROM alert_deliveries
WHERE destination_id = $1
ORDER BY created_at DESC
LIMIT $2 OFFSET $3;

-- name: ListPendingDeliveries :many
SELECT * FROM alert_deliveries
WHERE status IN ('pending', 'retrying')
ORDER BY created_at ASC
LIMIT $1;

-- name: ListFailedDeliveries :many
SELECT * FROM alert_deliveries
WHERE status = 'failed'
ORDER BY created_at DESC
LIMIT $1 OFFSET $2;

-- name: UpdateDeliveryAttempt :exec
UPDATE alert_deliveries
SET status = $2,
    attempt_count = $3,
    last_attempt_at = NOW(),
    error_message = $4,
    response_data = COALESCE($5, response_data)
WHERE id = $1;

-- name: MarkDeliveryDelivered :exec
UPDATE alert_deliveries
SET status = 'sent',
    delivered_at = NOW(),
    last_attempt_at = NOW(),
    response_data = COALESCE($2, response_data)
WHERE id = $1;

-- name: MarkDeliveryFailed :exec
UPDATE alert_deliveries
SET status = 'failed',
    last_attempt_at = NOW(),
    error_message = $2,
    response_data = COALESCE($3, response_data)
WHERE id = $1;

-- name: DeleteAlertDelivery :exec
DELETE FROM alert_deliveries WHERE id = $1;

-- name: DeleteDeliveriesByAlert :exec
DELETE FROM alert_deliveries WHERE alert_id = $1;

-- name: CountAlertDeliveries :one
SELECT COUNT(*) FROM alert_deliveries;

-- name: CountDeliveriesByStatus :one
SELECT COUNT(*) FROM alert_deliveries WHERE status = $1;

-- =============================================================================
-- STATISTICS
-- =============================================================================

-- name: GetAlertStats :one
SELECT
    COUNT(*) as total_alerts,
    COUNT(*) FILTER (WHERE is_resolved = false) as firing_alerts,
    COUNT(*) FILTER (WHERE is_resolved = true) as resolved_alerts,
    (SELECT COUNT(*) FROM alert_rules WHERE is_enabled = true) as active_rules,
    COUNT(DISTINCT volume_id) FILTER (WHERE volume_id IS NOT NULL) as affected_entities
FROM alerts;

-- name: GetAlertStatsByOrganization :one
SELECT
    COUNT(*) as total_alerts,
    COUNT(*) FILTER (WHERE is_resolved = false) as firing_alerts,
    COUNT(*) FILTER (WHERE is_resolved = true) as resolved_alerts,
    (SELECT COUNT(*) FROM alert_rules WHERE is_enabled = true) as active_rules,
    COUNT(DISTINCT volume_id) FILTER (WHERE volume_id IS NOT NULL) as affected_entities
FROM alerts
WHERE organization_id = $1;

-- name: GetDeliveryStats :one
SELECT
    COUNT(*) as total_deliveries,
    COUNT(*) FILTER (WHERE status = 'sent') as successful_deliveries,
    COUNT(*) FILTER (WHERE status = 'failed') as failed_deliveries,
    COUNT(*) FILTER (WHERE status IN ('pending', 'retrying')) as pending_deliveries,
    COALESCE(AVG(attempt_count), 0) as avg_attempts,
    COUNT(DISTINCT destination_id) as destinations_used
FROM alert_deliveries;

-- name: GetDestinationDeliveryStats :one
SELECT
    COUNT(*) as total_deliveries,
    COUNT(*) FILTER (WHERE status = 'sent') as successful_deliveries,
    COUNT(*) FILTER (WHERE status = 'failed') as failed_deliveries,
    COUNT(*) FILTER (WHERE status IN ('pending', 'retrying')) as pending_deliveries,
    COALESCE(AVG(attempt_count), 0) as avg_attempts
FROM alert_deliveries
WHERE destination_id = $1;

-- name: GetRecentAlertsByRule :many
SELECT * FROM alerts
WHERE rule_id = $1
  AND created_at > $2
ORDER BY created_at DESC;

-- name: GetAlertCountsByRule :many
SELECT
    rule_id,
    COUNT(*) as total,
    COUNT(*) FILTER (WHERE is_resolved = false) as active,
    COUNT(*) FILTER (WHERE is_resolved = true) as resolved
FROM alerts
GROUP BY rule_id
ORDER BY total DESC;

-- name: GetAlertCountsBySeverity :many
SELECT
    severity,
    COUNT(*) as total,
    COUNT(*) FILTER (WHERE is_resolved = false) as active
FROM alerts
GROUP BY severity
ORDER BY
    CASE severity
        WHEN 'critical' THEN 1
        WHEN 'high' THEN 2
        WHEN 'medium' THEN 3
        WHEN 'low' THEN 4
    END;
