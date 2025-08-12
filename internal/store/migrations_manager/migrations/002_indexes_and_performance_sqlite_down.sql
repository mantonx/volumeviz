-- Migration: 002_indexes_and_performance_sqlite
-- Description: Remove comprehensive indexing strategy (SQLite version)
-- Down Migration

-- Drop all indexes created in the up migration
-- Note: ORDER MATTERS - drop dependent indexes first

-- Volume composite indexes
DROP INDEX IF EXISTS idx_volume_sizes_volume_latest;
DROP INDEX IF EXISTS idx_volume_mounts_active;
DROP INDEX IF EXISTS idx_scan_jobs_active;
DROP INDEX IF EXISTS idx_volume_metrics_timeseries;
DROP INDEX IF EXISTS idx_scan_cache_valid;

-- Volume indexes
DROP INDEX IF EXISTS idx_volumes_volume_id;
DROP INDEX IF EXISTS idx_volumes_name;
DROP INDEX IF EXISTS idx_volumes_driver;
DROP INDEX IF EXISTS idx_volumes_is_active;
DROP INDEX IF EXISTS idx_volumes_last_scanned;
DROP INDEX IF EXISTS idx_volumes_created_at;
DROP INDEX IF EXISTS idx_volumes_labels;
DROP INDEX IF EXISTS idx_volumes_options;

-- Volume sizes indexes
DROP INDEX IF EXISTS idx_volume_sizes_volume_id;
DROP INDEX IF EXISTS idx_volume_sizes_created_at;
DROP INDEX IF EXISTS idx_volume_sizes_total_size;
DROP INDEX IF EXISTS idx_volume_sizes_scan_method;
DROP INDEX IF EXISTS idx_volume_sizes_is_valid;

-- Container indexes
DROP INDEX IF EXISTS idx_containers_container_id;
DROP INDEX IF EXISTS idx_containers_name;
DROP INDEX IF EXISTS idx_containers_state;
DROP INDEX IF EXISTS idx_containers_is_active;
DROP INDEX IF EXISTS idx_containers_started_at;
DROP INDEX IF EXISTS idx_containers_labels;

-- Volume mounts indexes
DROP INDEX IF EXISTS idx_volume_mounts_volume_id;
DROP INDEX IF EXISTS idx_volume_mounts_container_id;
DROP INDEX IF EXISTS idx_volume_mounts_is_active;

-- Scan jobs indexes
DROP INDEX IF EXISTS idx_scan_jobs_scan_id;
DROP INDEX IF EXISTS idx_scan_jobs_volume_id;
DROP INDEX IF EXISTS idx_scan_jobs_status;
DROP INDEX IF EXISTS idx_scan_jobs_created_at;

-- Volume metrics indexes
DROP INDEX IF EXISTS idx_volume_metrics_volume_id;
DROP INDEX IF EXISTS idx_volume_metrics_timestamp;
DROP INDEX IF EXISTS idx_volume_metrics_total_size;

-- System health indexes
DROP INDEX IF EXISTS idx_system_health_component;
DROP INDEX IF EXISTS idx_system_health_status;
DROP INDEX IF EXISTS idx_system_health_last_check;
DROP INDEX IF EXISTS idx_system_health_metadata;

-- Scan cache indexes
DROP INDEX IF EXISTS idx_scan_cache_cache_key;
DROP INDEX IF EXISTS idx_scan_cache_volume_id;
DROP INDEX IF EXISTS idx_scan_cache_expires_at;
DROP INDEX IF EXISTS idx_scan_cache_is_valid;