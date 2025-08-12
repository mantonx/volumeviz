-- Migration: 005_scan_tables_sqlite
-- Description: Remove scan_runs and volume_stats tables (SQLite version)
-- Down Migration

-- Drop triggers first
DROP TRIGGER IF EXISTS update_scan_runs_updated_at;
DROP TRIGGER IF EXISTS update_volume_stats_updated_at;

-- Drop indexes
DROP INDEX IF EXISTS idx_scan_runs_volume_id;
DROP INDEX IF EXISTS idx_scan_runs_status;
DROP INDEX IF EXISTS idx_scan_runs_started_at;
DROP INDEX IF EXISTS idx_volume_stats_volume_name;
DROP INDEX IF EXISTS idx_volume_stats_ts;

-- Drop tables
DROP TABLE IF EXISTS scan_runs;
DROP TABLE IF EXISTS volume_stats;