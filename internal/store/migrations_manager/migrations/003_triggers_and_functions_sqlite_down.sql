-- Migration: 003_triggers_and_functions_sqlite
-- Description: Remove database triggers (SQLite version)
-- Down Migration

-- Drop all triggers created in the up migration
DROP TRIGGER IF EXISTS update_volumes_updated_at;
DROP TRIGGER IF EXISTS update_volume_sizes_updated_at;
DROP TRIGGER IF EXISTS update_containers_updated_at;
DROP TRIGGER IF EXISTS update_volume_mounts_updated_at;
DROP TRIGGER IF EXISTS update_scan_jobs_updated_at;
DROP TRIGGER IF EXISTS update_volume_metrics_updated_at;
DROP TRIGGER IF EXISTS update_system_health_updated_at;
DROP TRIGGER IF EXISTS update_scan_cache_updated_at;
DROP TRIGGER IF EXISTS update_volume_scanned_trigger;