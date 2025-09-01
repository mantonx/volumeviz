-- Drop alerts system tables and related objects

-- Drop triggers first
DROP TRIGGER IF EXISTS update_alert_deliveries_updated_at ON alert_deliveries;
DROP TRIGGER IF EXISTS update_alert_routes_updated_at ON alert_routes;  
DROP TRIGGER IF EXISTS update_alert_destinations_updated_at ON alert_destinations;
DROP TRIGGER IF EXISTS update_alerts_updated_at ON alerts;
DROP TRIGGER IF EXISTS update_alert_rules_updated_at ON alert_rules;

-- Drop indexes (they'll be dropped automatically with tables, but explicit for clarity)
DROP INDEX IF EXISTS idx_alert_deliveries_retry_queue;
DROP INDEX IF EXISTS idx_alert_deliveries_stats;
DROP INDEX IF EXISTS idx_alerts_timeline;
DROP INDEX IF EXISTS idx_alert_routes_matchers_gin;
DROP INDEX IF EXISTS idx_alert_destinations_config_gin;
DROP INDEX IF EXISTS idx_alerts_annotations_gin;
DROP INDEX IF EXISTS idx_alerts_labels_gin;
DROP INDEX IF EXISTS idx_alert_rules_labels_gin;
DROP INDEX IF EXISTS idx_alert_deliveries_created_at;
DROP INDEX IF EXISTS idx_alert_deliveries_next_attempt;
DROP INDEX IF EXISTS idx_alert_deliveries_status;
DROP INDEX IF EXISTS idx_alert_deliveries_route_id;
DROP INDEX IF EXISTS idx_alert_deliveries_destination_id;
DROP INDEX IF EXISTS idx_alert_deliveries_alert_id;
DROP INDEX IF EXISTS idx_alert_routes_enabled;
DROP INDEX IF EXISTS idx_alert_routes_priority;
DROP INDEX IF EXISTS idx_alert_routes_destination_id;
DROP INDEX IF EXISTS idx_alert_destinations_enabled;
DROP INDEX IF EXISTS idx_alert_destinations_type;
DROP INDEX IF EXISTS idx_alerts_active;
DROP INDEX IF EXISTS idx_alerts_dedupe;
DROP INDEX IF EXISTS idx_alerts_starts_at;
DROP INDEX IF EXISTS idx_alerts_status;
DROP INDEX IF EXISTS idx_alerts_entity;
DROP INDEX IF EXISTS idx_alerts_rule_id;
DROP INDEX IF EXISTS idx_alert_rules_created_at;
DROP INDEX IF EXISTS idx_alert_rules_enabled;

-- Drop tables in reverse dependency order
DROP TABLE IF EXISTS alert_deliveries;
DROP TABLE IF EXISTS alert_routes;
DROP TABLE IF EXISTS alert_destinations;
DROP TABLE IF EXISTS alerts;
DROP TABLE IF EXISTS alert_rules;

-- Drop the update function if no other tables use it
-- Note: Only drop if this is the only migration using this function
-- DROP FUNCTION IF EXISTS update_updated_at_column();