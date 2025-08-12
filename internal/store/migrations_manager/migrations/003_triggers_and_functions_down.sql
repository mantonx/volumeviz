-- Migration: 003_triggers_and_functions
-- Description: Rollback database triggers and functions
-- Down Migration

-- Drop triggers
DROP TRIGGER IF EXISTS update_volume_scanned_trigger ON volume_sizes;
DROP TRIGGER IF EXISTS update_scan_cache_updated_at ON scan_cache;
DROP TRIGGER IF EXISTS update_system_health_updated_at ON system_health;
DROP TRIGGER IF EXISTS update_volume_metrics_updated_at ON volume_metrics;
DROP TRIGGER IF EXISTS update_scan_jobs_updated_at ON scan_jobs;
DROP TRIGGER IF EXISTS update_volume_mounts_updated_at ON volume_mounts;
DROP TRIGGER IF EXISTS update_containers_updated_at ON containers;
DROP TRIGGER IF EXISTS update_volume_sizes_updated_at ON volume_sizes;
DROP TRIGGER IF EXISTS update_volumes_updated_at ON volumes;

-- Drop functions
DROP FUNCTION IF EXISTS calculate_growth_rate(VARCHAR(255), INTEGER);
DROP FUNCTION IF EXISTS update_volume_last_scanned();
DROP FUNCTION IF EXISTS clean_expired_cache();
DROP FUNCTION IF EXISTS update_updated_at_column();