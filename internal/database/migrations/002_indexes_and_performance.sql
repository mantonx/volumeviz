-- Migration: 002_indexes_and_performance
-- Description: Add comprehensive indexing strategy for query performance optimization
-- Up Migration

-- Primary performance indexes for volumes table
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_volumes_volume_id ON volumes(volume_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_volumes_name ON volumes(name);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_volumes_driver ON volumes(driver);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_volumes_is_active ON volumes(is_active) WHERE is_active = true;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_volumes_last_scanned ON volumes(last_scanned);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_volumes_created_at ON volumes(created_at);

-- GIN indexes for JSONB columns
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_volumes_labels_gin ON volumes USING GIN(labels);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_volumes_options_gin ON volumes USING GIN(options);

-- Volume sizes indexes for performance
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_volume_sizes_volume_id ON volume_sizes(volume_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_volume_sizes_created_at ON volume_sizes(created_at);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_volume_sizes_total_size ON volume_sizes(total_size);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_volume_sizes_scan_method ON volume_sizes(scan_method);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_volume_sizes_is_valid ON volume_sizes(is_valid) WHERE is_valid = true;

-- Composite index for latest scan results
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_volume_sizes_volume_latest 
    ON volume_sizes(volume_id, created_at DESC, is_valid) WHERE is_valid = true;

-- Container indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_containers_container_id ON containers(container_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_containers_name ON containers(name);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_containers_state ON containers(state);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_containers_is_active ON containers(is_active) WHERE is_active = true;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_containers_started_at ON containers(started_at);

-- GIN index for container labels
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_containers_labels_gin ON containers USING GIN(labels);

-- Volume mounts indexes for relationships
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_volume_mounts_volume_id ON volume_mounts(volume_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_volume_mounts_container_id ON volume_mounts(container_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_volume_mounts_is_active ON volume_mounts(is_active) WHERE is_active = true;

-- Composite index for active mounts
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_volume_mounts_active 
    ON volume_mounts(volume_id, container_id) WHERE is_active = true;

-- Scan jobs indexes for async operations
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_scan_jobs_scan_id ON scan_jobs(scan_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_scan_jobs_volume_id ON scan_jobs(volume_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_scan_jobs_status ON scan_jobs(status);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_scan_jobs_created_at ON scan_jobs(created_at);

-- Composite index for active scans
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_scan_jobs_active 
    ON scan_jobs(volume_id, status, created_at DESC) 
    WHERE status IN ('queued', 'running');

-- Volume metrics indexes for analytics
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_volume_metrics_volume_id ON volume_metrics(volume_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_volume_metrics_timestamp ON volume_metrics(metric_timestamp);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_volume_metrics_total_size ON volume_metrics(total_size);

-- Composite index for time-series queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_volume_metrics_timeseries 
    ON volume_metrics(volume_id, metric_timestamp DESC);

-- System health indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_system_health_component ON system_health(component);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_system_health_status ON system_health(status);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_system_health_last_check ON system_health(last_check_at);

-- GIN index for system health metadata
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_system_health_metadata_gin ON system_health USING GIN(metadata);

-- Scan cache indexes for performance
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_scan_cache_cache_key ON scan_cache(cache_key);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_scan_cache_volume_id ON scan_cache(volume_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_scan_cache_expires_at ON scan_cache(expires_at);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_scan_cache_is_valid ON scan_cache(is_valid) WHERE is_valid = true;

-- Composite index for valid cache entries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_scan_cache_valid 
    ON scan_cache(volume_id, expires_at DESC) WHERE is_valid = true;