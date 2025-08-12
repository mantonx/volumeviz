-- Migration: 002_indexes_and_performance
-- Description: Rollback comprehensive indexing strategy
-- Down Migration

-- Drop all performance indexes (keep base table indexes)
DROP INDEX CONCURRENTLY IF EXISTS idx_scan_cache_valid;
DROP INDEX CONCURRENTLY IF EXISTS idx_scan_cache_is_valid;
DROP INDEX CONCURRENTLY IF EXISTS idx_scan_cache_expires_at;
DROP INDEX CONCURRENTLY IF EXISTS idx_scan_cache_volume_id;
DROP INDEX CONCURRENTLY IF EXISTS idx_scan_cache_cache_key;
DROP INDEX CONCURRENTLY IF EXISTS idx_system_health_metadata_gin;
DROP INDEX CONCURRENTLY IF EXISTS idx_system_health_last_check;
DROP INDEX CONCURRENTLY IF EXISTS idx_system_health_status;
DROP INDEX CONCURRENTLY IF EXISTS idx_system_health_component;
DROP INDEX CONCURRENTLY IF EXISTS idx_volume_metrics_timeseries;
DROP INDEX CONCURRENTLY IF EXISTS idx_volume_metrics_total_size;
DROP INDEX CONCURRENTLY IF EXISTS idx_volume_metrics_timestamp;
DROP INDEX CONCURRENTLY IF EXISTS idx_volume_metrics_volume_id;
DROP INDEX CONCURRENTLY IF EXISTS idx_scan_jobs_active;
DROP INDEX CONCURRENTLY IF EXISTS idx_scan_jobs_created_at;
DROP INDEX CONCURRENTLY IF EXISTS idx_scan_jobs_status;
DROP INDEX CONCURRENTLY IF EXISTS idx_scan_jobs_volume_id;
DROP INDEX CONCURRENTLY IF EXISTS idx_scan_jobs_scan_id;
DROP INDEX CONCURRENTLY IF EXISTS idx_volume_mounts_active;
DROP INDEX CONCURRENTLY IF EXISTS idx_volume_mounts_is_active;
DROP INDEX CONCURRENTLY IF EXISTS idx_volume_mounts_container_id;
DROP INDEX CONCURRENTLY IF EXISTS idx_volume_mounts_volume_id;
DROP INDEX CONCURRENTLY IF EXISTS idx_containers_labels_gin;
DROP INDEX CONCURRENTLY IF EXISTS idx_containers_started_at;
DROP INDEX CONCURRENTLY IF EXISTS idx_containers_is_active;
DROP INDEX CONCURRENTLY IF EXISTS idx_containers_state;
DROP INDEX CONCURRENTLY IF EXISTS idx_containers_name;
DROP INDEX CONCURRENTLY IF EXISTS idx_containers_container_id;
DROP INDEX CONCURRENTLY IF EXISTS idx_volume_sizes_volume_latest;
DROP INDEX CONCURRENTLY IF EXISTS idx_volume_sizes_is_valid;
DROP INDEX CONCURRENTLY IF EXISTS idx_volume_sizes_scan_method;
DROP INDEX CONCURRENTLY IF EXISTS idx_volume_sizes_total_size;
DROP INDEX CONCURRENTLY IF EXISTS idx_volume_sizes_created_at;
DROP INDEX CONCURRENTLY IF EXISTS idx_volume_sizes_volume_id;
DROP INDEX CONCURRENTLY IF EXISTS idx_volumes_options_gin;
DROP INDEX CONCURRENTLY IF EXISTS idx_volumes_labels_gin;
DROP INDEX CONCURRENTLY IF EXISTS idx_volumes_created_at;
DROP INDEX CONCURRENTLY IF EXISTS idx_volumes_last_scanned;
DROP INDEX CONCURRENTLY IF EXISTS idx_volumes_is_active;
DROP INDEX CONCURRENTLY IF EXISTS idx_volumes_driver;
DROP INDEX CONCURRENTLY IF EXISTS idx_volumes_name;
DROP INDEX CONCURRENTLY IF EXISTS idx_volumes_volume_id;