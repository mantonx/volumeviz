-- =============================================================================
-- VolumeViz Consolidated Schema Rollback (SQLite Version)
-- Drops all tables, indexes, views, and triggers created by the up migration
-- =============================================================================

-- Drop triggers first
DROP TRIGGER IF EXISTS trigger_update_folder_stats_insert;
DROP TRIGGER IF EXISTS trigger_update_folder_stats_update;
DROP TRIGGER IF EXISTS trigger_update_folder_stats_delete;

-- Drop views
DROP VIEW IF EXISTS volume_summary;
DROP VIEW IF EXISTS unenriched_media_files;

-- Drop tables in reverse dependency order
DROP TABLE IF EXISTS scan_performance_metrics;
DROP TABLE IF EXISTS scan_phase_steps;
DROP TABLE IF EXISTS scan_phases;
DROP TABLE IF EXISTS tracking_rule_evaluations;
DROP TABLE IF EXISTS tracking_rules;
DROP TABLE IF EXISTS tracking_rule_templates;
DROP TABLE IF EXISTS mount_catalog;
DROP TABLE IF EXISTS docker_projects;
DROP TABLE IF EXISTS file_previews;
DROP TABLE IF EXISTS saved_searches;
DROP TABLE IF EXISTS alert_deliveries;
DROP TABLE IF EXISTS alerts;
DROP TABLE IF EXISTS alert_routes;
DROP TABLE IF EXISTS alert_destinations;
DROP TABLE IF EXISTS alert_rules;
DROP TABLE IF EXISTS stats_jobs;
DROP TABLE IF EXISTS stats_daily;
DROP TABLE IF EXISTS file_metadata;
DROP TABLE IF EXISTS files;
DROP TABLE IF EXISTS folders;
DROP TABLE IF EXISTS usage_snapshots;
DROP TABLE IF EXISTS volume_metrics;
DROP TABLE IF EXISTS scan_jobs;
DROP TABLE IF EXISTS volume_sizes;
DROP TABLE IF EXISTS volume_mounts;
DROP TABLE IF EXISTS containers;
DROP TABLE IF EXISTS volumes;