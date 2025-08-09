-- Migration: 005_scan_tables
-- Description: Remove scan_runs and volume_stats tables
-- Down Migration

-- Drop triggers first
DROP TRIGGER IF EXISTS update_scan_runs_updated_at ON scan_runs;
DROP TRIGGER IF EXISTS update_volume_stats_updated_at ON volume_stats;

-- Drop the update function if no other triggers are using it
-- (Keep it safe by not dropping in case other migrations use it)

-- Drop foreign key constraints
ALTER TABLE volume_stats DROP CONSTRAINT IF EXISTS fk_volume_stats_volume_name;

-- Drop indexes
DROP INDEX IF EXISTS idx_scan_runs_volume_id;
DROP INDEX IF EXISTS idx_scan_runs_status;
DROP INDEX IF EXISTS idx_scan_runs_started_at;
DROP INDEX IF EXISTS idx_volume_stats_volume_name;
DROP INDEX IF EXISTS idx_volume_stats_ts;

-- Drop tables
DROP TABLE IF EXISTS scan_runs;
DROP TABLE IF EXISTS volume_stats;
