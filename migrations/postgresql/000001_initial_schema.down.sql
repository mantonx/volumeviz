-- =============================================================================
-- VolumeViz Consolidated Schema Rollback
-- Drops all tables, indexes, functions, and types created by the consolidated schema
-- =============================================================================

-- Drop materialized views and views first
DROP MATERIALIZED VIEW IF EXISTS volume_summary CASCADE;
DROP VIEW IF EXISTS unenriched_media_files CASCADE;

-- Drop functions
DROP FUNCTION IF EXISTS validate_schema() CASCADE;
DROP FUNCTION IF EXISTS update_folder_stats() CASCADE;
DROP FUNCTION IF EXISTS generate_path_hash(TEXT) CASCADE;

-- Drop all tables in reverse dependency order
DROP TABLE IF EXISTS scan_performance_metrics CASCADE;
DROP TABLE IF EXISTS scan_phase_steps CASCADE;
DROP TABLE IF EXISTS scan_phases CASCADE;
DROP TABLE IF EXISTS tracking_rule_evaluations CASCADE;
DROP TABLE IF EXISTS tracking_rules CASCADE;
DROP TABLE IF EXISTS tracking_rule_templates CASCADE;
DROP TABLE IF EXISTS mount_catalog CASCADE;
DROP TABLE IF EXISTS docker_projects CASCADE;
DROP TABLE IF EXISTS file_previews CASCADE;
DROP TABLE IF EXISTS saved_searches CASCADE;
DROP TABLE IF EXISTS alert_deliveries CASCADE;
DROP TABLE IF EXISTS alerts CASCADE;
DROP TABLE IF EXISTS alert_routes CASCADE;
DROP TABLE IF EXISTS alert_destinations CASCADE;
DROP TABLE IF EXISTS alert_rules CASCADE;
DROP TABLE IF EXISTS stats_jobs CASCADE;
DROP TABLE IF EXISTS stats_daily CASCADE;
DROP TABLE IF EXISTS file_metadata CASCADE;
DROP TABLE IF EXISTS files CASCADE;
DROP TABLE IF EXISTS folders CASCADE;
DROP TABLE IF EXISTS usage_snapshots CASCADE;
DROP TABLE IF EXISTS volume_metrics CASCADE;
DROP TABLE IF EXISTS scan_jobs CASCADE;
DROP TABLE IF EXISTS volume_sizes CASCADE;
DROP TABLE IF EXISTS volume_mounts CASCADE;
DROP TABLE IF EXISTS containers CASCADE;
DROP TABLE IF EXISTS volumes CASCADE;

-- Drop custom types
DROP TYPE IF EXISTS preview_status CASCADE;
DROP TYPE IF EXISTS destination_type CASCADE;
DROP TYPE IF EXISTS alert_severity CASCADE;
DROP TYPE IF EXISTS scan_phase CASCADE;
DROP TYPE IF EXISTS scan_status CASCADE;

-- Drop extensions (only if not used by other databases)
-- DROP EXTENSION IF EXISTS "btree_gin";
-- DROP EXTENSION IF EXISTS "pg_trgm";