-- VV-302: Tracking Rules Engine Schema - Down Migration
-- Removes all tracking rules engine tables and types

-- Drop triggers
DROP TRIGGER IF EXISTS tracking_rule_templates_updated_at_trigger ON tracking_rule_templates;
DROP TRIGGER IF EXISTS tracking_rule_conditions_updated_at_trigger ON tracking_rule_conditions;
DROP TRIGGER IF EXISTS mount_tracking_assignments_updated_at_trigger ON mount_tracking_assignments;
DROP TRIGGER IF EXISTS tracking_rules_updated_at_trigger ON tracking_rules;

-- Drop function
DROP FUNCTION IF EXISTS update_tracking_rules_updated_at();

-- Drop indexes
DROP INDEX IF EXISTS idx_rule_templates_builtin;
DROP INDEX IF EXISTS idx_rule_templates_category;
DROP INDEX IF EXISTS idx_rule_conditions_field;
DROP INDEX IF EXISTS idx_rule_conditions_rule_id;
DROP INDEX IF EXISTS idx_mount_assignments_action;
DROP INDEX IF EXISTS idx_mount_assignments_active;
DROP INDEX IF EXISTS idx_mount_assignments_rule_id;
DROP INDEX IF EXISTS idx_mount_assignments_mount_id;
DROP INDEX IF EXISTS idx_rule_evaluations_status;
DROP INDEX IF EXISTS idx_rule_evaluations_started;
DROP INDEX IF EXISTS idx_rule_evaluations_type;
DROP INDEX IF EXISTS idx_rule_evaluations_rule_id;
DROP INDEX IF EXISTS idx_tracking_rules_updated;
DROP INDEX IF EXISTS idx_tracking_rules_enabled;
DROP INDEX IF EXISTS idx_tracking_rules_action;
DROP INDEX IF EXISTS idx_tracking_rules_priority;

-- Drop tables
DROP TABLE IF EXISTS tracking_rule_templates;
DROP TABLE IF EXISTS tracking_rule_conditions;
DROP TABLE IF EXISTS mount_tracking_assignments;
DROP TABLE IF EXISTS tracking_rule_evaluations;
DROP TABLE IF EXISTS tracking_rules;

-- Drop types
DROP TYPE IF EXISTS rule_evaluation_status;
DROP TYPE IF EXISTS rule_operator;
DROP TYPE IF EXISTS rule_action;