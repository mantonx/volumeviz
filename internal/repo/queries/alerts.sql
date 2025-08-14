-- Alerts system SQL queries

-- =============================================================================
-- ALERT RULES
-- =============================================================================

-- name: CreateAlertRule :one
INSERT INTO alert_rules (
    name, description, query, condition, threshold, 
    interval_seconds, for_seconds, labels, is_enabled
) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8, $9
) RETURNING id, created_at, updated_at;

-- name: GetAlertRule :one
SELECT id, name, description, query, condition, threshold,
       interval_seconds, for_seconds, labels, is_enabled,
       created_at, updated_at
FROM alert_rules 
WHERE id = $1;

-- name: GetAlertRuleByName :one
SELECT id, name, description, query, condition, threshold,
       interval_seconds, for_seconds, labels, is_enabled,
       created_at, updated_at
FROM alert_rules 
WHERE name = $1;

-- name: ListAlertRules :many
SELECT id, name, description, query, condition, threshold,
       interval_seconds, for_seconds, labels, is_enabled,
       created_at, updated_at
FROM alert_rules
ORDER BY created_at DESC
LIMIT $1 OFFSET $2;

-- name: ListEnabledAlertRules :many
SELECT id, name, description, query, condition, threshold,
       interval_seconds, for_seconds, labels, is_enabled,
       created_at, updated_at
FROM alert_rules
WHERE is_enabled = true
ORDER BY created_at DESC;

-- name: UpdateAlertRule :exec
UPDATE alert_rules 
SET name = $2, description = $3, query = $4, condition = $5, 
    threshold = $6, interval_seconds = $7, for_seconds = $8, 
    labels = $9, is_enabled = $10
WHERE id = $1;

-- name: DeleteAlertRule :exec
DELETE FROM alert_rules WHERE id = $1;

-- name: CountAlertRules :one
SELECT COUNT(*) FROM alert_rules;

-- =============================================================================
-- ALERTS
-- =============================================================================

-- name: CreateAlert :one
INSERT INTO alerts (
    rule_id, entity_id, entity_type, dedupe_key, status, 
    value, labels, annotations, starts_at
) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8, $9
) RETURNING id, created_at, updated_at;

-- name: GetAlert :one
SELECT id, rule_id, entity_id, entity_type, dedupe_key, status,
       value, labels, annotations, starts_at, ends_at,
       created_at, updated_at
FROM alerts 
WHERE id = $1;

-- name: GetAlertByDedupe :one
SELECT id, rule_id, entity_id, entity_type, dedupe_key, status,
       value, labels, annotations, starts_at, ends_at,
       created_at, updated_at
FROM alerts 
WHERE rule_id = $1 AND entity_id = $2 AND dedupe_key = $3;

-- name: ListAlerts :many
SELECT id, rule_id, entity_id, entity_type, dedupe_key, status,
       value, labels, annotations, starts_at, ends_at,
       created_at, updated_at
FROM alerts
ORDER BY starts_at DESC
LIMIT $1 OFFSET $2;

-- name: ListAlertsByRule :many
SELECT id, rule_id, entity_id, entity_type, dedupe_key, status,
       value, labels, annotations, starts_at, ends_at,
       created_at, updated_at
FROM alerts
WHERE rule_id = $1
ORDER BY starts_at DESC
LIMIT $2 OFFSET $3;

-- name: ListActiveAlerts :many
SELECT id, rule_id, entity_id, entity_type, dedupe_key, status,
       value, labels, annotations, starts_at, ends_at,
       created_at, updated_at
FROM alerts
WHERE status = 'firing'
ORDER BY starts_at DESC
LIMIT $1 OFFSET $2;

-- name: UpdateAlertStatus :exec
UPDATE alerts 
SET status = $2, ends_at = $3
WHERE id = $1;

-- name: ResolveAlert :exec
UPDATE alerts 
SET status = 'resolved', ends_at = NOW()
WHERE rule_id = $1 AND entity_id = $2 AND dedupe_key = $3;

-- name: DeleteAlert :exec
DELETE FROM alerts WHERE id = $1;

-- name: CountAlerts :one
SELECT COUNT(*) FROM alerts;

-- name: CountActiveAlerts :one
SELECT COUNT(*) FROM alerts WHERE status = 'firing';

-- =============================================================================
-- ALERT DESTINATIONS
-- =============================================================================

-- name: CreateAlertDestination :one
INSERT INTO alert_destinations (name, type, config, is_enabled)
VALUES ($1, $2, $3, $4)
RETURNING id, created_at, updated_at;

-- name: GetAlertDestination :one
SELECT id, name, type, config, is_enabled, created_at, updated_at
FROM alert_destinations 
WHERE id = $1;

-- name: GetAlertDestinationByName :one
SELECT id, name, type, config, is_enabled, created_at, updated_at
FROM alert_destinations 
WHERE name = $1;

-- name: ListAlertDestinations :many
SELECT id, name, type, config, is_enabled, created_at, updated_at
FROM alert_destinations
ORDER BY created_at DESC
LIMIT $1 OFFSET $2;

-- name: ListEnabledAlertDestinations :many
SELECT id, name, type, config, is_enabled, created_at, updated_at
FROM alert_destinations
WHERE is_enabled = true
ORDER BY created_at DESC;

-- name: UpdateAlertDestination :exec
UPDATE alert_destinations 
SET name = $2, type = $3, config = $4, is_enabled = $5
WHERE id = $1;

-- name: DeleteAlertDestination :exec
DELETE FROM alert_destinations WHERE id = $1;

-- name: CountAlertDestinations :one
SELECT COUNT(*) FROM alert_destinations;

-- =============================================================================
-- ALERT ROUTES
-- =============================================================================

-- name: CreateAlertRoute :one
INSERT INTO alert_routes (name, matchers, destination_id, priority, is_enabled)
VALUES ($1, $2, $3, $4, $5)
RETURNING id, created_at, updated_at;

-- name: GetAlertRoute :one
SELECT id, name, matchers, destination_id, priority, is_enabled, 
       created_at, updated_at
FROM alert_routes 
WHERE id = $1;

-- name: GetAlertRouteByName :one
SELECT id, name, matchers, destination_id, priority, is_enabled, 
       created_at, updated_at
FROM alert_routes 
WHERE name = $1;

-- name: ListAlertRoutes :many
SELECT id, name, matchers, destination_id, priority, is_enabled, 
       created_at, updated_at
FROM alert_routes
ORDER BY priority ASC, created_at DESC
LIMIT $1 OFFSET $2;

-- name: ListEnabledAlertRoutes :many
SELECT id, name, matchers, destination_id, priority, is_enabled, 
       created_at, updated_at
FROM alert_routes
WHERE is_enabled = true
ORDER BY priority ASC, created_at DESC;

-- name: ListRoutesByDestination :many
SELECT id, name, matchers, destination_id, priority, is_enabled, 
       created_at, updated_at
FROM alert_routes
WHERE destination_id = $1
ORDER BY priority ASC, created_at DESC;

-- name: UpdateAlertRoute :exec
UPDATE alert_routes 
SET name = $2, matchers = $3, destination_id = $4, priority = $5, is_enabled = $6
WHERE id = $1;

-- name: DeleteAlertRoute :exec
DELETE FROM alert_routes WHERE id = $1;

-- name: CountAlertRoutes :one
SELECT COUNT(*) FROM alert_routes;

-- =============================================================================
-- ALERT DELIVERIES
-- =============================================================================

-- name: CreateAlertDelivery :one
INSERT INTO alert_deliveries (
    alert_id, destination_id, route_id, status, max_attempts
) VALUES (
    $1, $2, $3, $4, $5
) RETURNING id, created_at, updated_at;

-- name: GetAlertDelivery :one
SELECT id, alert_id, destination_id, route_id, status, attempt_count,
       max_attempts, next_attempt_at, last_attempt_at, error_message,
       delivered_at, request_payload, response_payload, response_status,
       created_at, updated_at
FROM alert_deliveries 
WHERE id = $1;

-- name: ListAlertDeliveries :many
SELECT id, alert_id, destination_id, route_id, status, attempt_count,
       max_attempts, next_attempt_at, last_attempt_at, error_message,
       delivered_at, request_payload, response_payload, response_status,
       created_at, updated_at
FROM alert_deliveries
ORDER BY created_at DESC
LIMIT $1 OFFSET $2;

-- name: ListDeliveriesByAlert :many
SELECT id, alert_id, destination_id, route_id, status, attempt_count,
       max_attempts, next_attempt_at, last_attempt_at, error_message,
       delivered_at, request_payload, response_payload, response_status,
       created_at, updated_at
FROM alert_deliveries
WHERE alert_id = $1
ORDER BY created_at DESC;

-- name: ListDeliveriesByDestination :many
SELECT id, alert_id, destination_id, route_id, status, attempt_count,
       max_attempts, next_attempt_at, last_attempt_at, error_message,
       delivered_at, request_payload, response_payload, response_status,
       created_at, updated_at
FROM alert_deliveries
WHERE destination_id = $1
ORDER BY created_at DESC
LIMIT $2 OFFSET $3;

-- name: ListPendingDeliveries :many
SELECT id, alert_id, destination_id, route_id, status, attempt_count,
       max_attempts, next_attempt_at, last_attempt_at, error_message,
       delivered_at, request_payload, response_payload, response_status,
       created_at, updated_at
FROM alert_deliveries
WHERE status IN ('pending', 'retrying')
  AND (next_attempt_at IS NULL OR next_attempt_at <= NOW())
ORDER BY next_attempt_at ASC NULLS FIRST, created_at ASC
LIMIT $1;

-- name: UpdateDeliveryAttempt :exec
UPDATE alert_deliveries 
SET status = $2, attempt_count = $3, last_attempt_at = NOW(), 
    next_attempt_at = $4, error_message = $5,
    request_payload = $6, response_payload = $7, response_status = $8
WHERE id = $1;

-- name: MarkDeliveryDelivered :exec
UPDATE alert_deliveries 
SET status = 'delivered', delivered_at = NOW(), 
    request_payload = $2, response_payload = $3, response_status = $4
WHERE id = $1;

-- name: MarkDeliveryFailed :exec
UPDATE alert_deliveries 
SET status = 'failed', last_attempt_at = NOW(), 
    error_message = $2, request_payload = $3, response_payload = $4, response_status = $5
WHERE id = $1;

-- name: DeleteAlertDelivery :exec
DELETE FROM alert_deliveries WHERE id = $1;

-- name: CountAlertDeliveries :one
SELECT COUNT(*) FROM alert_deliveries;

-- name: CountDeliveriesByStatus :one
SELECT COUNT(*) FROM alert_deliveries WHERE status = $1;

-- =============================================================================
-- JOINED QUERIES
-- =============================================================================

-- name: GetAlertWithRule :one
SELECT 
    a.id, a.rule_id, a.entity_id, a.entity_type, a.dedupe_key, a.status,
    a.value, a.labels, a.annotations, a.starts_at, a.ends_at,
    a.created_at, a.updated_at,
    r.name as rule_name, r.description as rule_description,
    r.query as rule_query, r.condition as rule_condition, r.threshold as rule_threshold
FROM alerts a
JOIN alert_rules r ON a.rule_id = r.id
WHERE a.id = $1;

-- name: GetDeliveryWithDetails :one
SELECT 
    d.id, d.alert_id, d.destination_id, d.route_id, d.status, d.attempt_count,
    d.max_attempts, d.next_attempt_at, d.last_attempt_at, d.error_message,
    d.delivered_at, d.request_payload, d.response_payload, d.response_status,
    d.created_at, d.updated_at,
    dest.name as destination_name, dest.type as destination_type,
    r.name as route_name
FROM alert_deliveries d
JOIN alert_destinations dest ON d.destination_id = dest.id
JOIN alert_routes r ON d.route_id = r.id
WHERE d.id = $1;

-- name: ListRoutesByPriority :many
SELECT 
    r.id, r.name, r.matchers, r.destination_id, r.priority, r.is_enabled,
    r.created_at, r.updated_at,
    d.name as destination_name, d.type as destination_type, d.is_enabled as destination_enabled
FROM alert_routes r
JOIN alert_destinations d ON r.destination_id = d.id
WHERE r.is_enabled = true AND d.is_enabled = true
ORDER BY r.priority ASC, r.created_at DESC;

-- =============================================================================
-- STATISTICS AND ANALYTICS
-- =============================================================================

-- name: GetAlertStats :one
SELECT 
    COUNT(*) as total_alerts,
    COUNT(*) FILTER (WHERE status = 'firing') as firing_alerts,
    COUNT(*) FILTER (WHERE status = 'resolved') as resolved_alerts,
    COUNT(DISTINCT rule_id) as active_rules,
    COUNT(DISTINCT entity_id) as affected_entities
FROM alerts;

-- name: GetDeliveryStats :one
SELECT 
    COUNT(*) as total_deliveries,
    COUNT(*) FILTER (WHERE status = 'delivered') as successful_deliveries,
    COUNT(*) FILTER (WHERE status = 'failed') as failed_deliveries,
    COUNT(*) FILTER (WHERE status IN ('pending', 'retrying')) as pending_deliveries,
    AVG(attempt_count) as avg_attempts,
    COUNT(DISTINCT destination_id) as destinations_used
FROM alert_deliveries;

-- name: GetDestinationDeliveryStats :one
SELECT 
    COUNT(*) as total_deliveries,
    COUNT(*) FILTER (WHERE status = 'delivered') as successful_deliveries,
    COUNT(*) FILTER (WHERE status = 'failed') as failed_deliveries,
    COUNT(*) FILTER (WHERE status IN ('pending', 'retrying')) as pending_deliveries,
    AVG(attempt_count) as avg_attempts
FROM alert_deliveries
WHERE destination_id = $1;

-- name: GetRuleActivityStats :many
SELECT 
    r.id, r.name,
    COUNT(a.id) as total_alerts,
    COUNT(a.id) FILTER (WHERE a.status = 'firing') as firing_alerts,
    COUNT(a.id) FILTER (WHERE a.status = 'resolved') as resolved_alerts,
    MAX(a.starts_at) as last_alert_time
FROM alert_rules r
LEFT JOIN alerts a ON r.id = a.rule_id
GROUP BY r.id, r.name
ORDER BY total_alerts DESC, last_alert_time DESC;

-- =============================================================================
-- CLEANUP QUERIES
-- =============================================================================

-- name: CleanupOldAlerts :exec
DELETE FROM alerts 
WHERE status = 'resolved' 
  AND ends_at < NOW() - INTERVAL '30 days';

-- name: CleanupOldDeliveries :exec
DELETE FROM alert_deliveries 
WHERE status IN ('delivered', 'failed')
  AND created_at < NOW() - INTERVAL '7 days';