-- =============================================================================
-- VOLUMEVIZ STATISTICS QUERIES - CONSOLIDATED
-- =============================================================================
-- This file consolidates usage_snapshots.sql, metrics.sql, and volume_sizes.sql
-- All query names and functionality are preserved exactly as they were
-- =============================================================================

-- =============================================================================
-- USAGE SNAPSHOTS OPERATIONS
-- =============================================================================
-- Handles historical usage snapshots for volume growth tracking and trends

-- name: CreateUsageSnapshot :one
INSERT INTO usage_snapshots (
    volume_id, snapshot_date, snapshot_type, total_size, file_count, 
    directory_count, largest_file, growth_bytes, growth_files, 
    growth_rate_bytes_per_day, scan_method, scan_duration_ms
) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12
) RETURNING *;

-- name: GetLatestSnapshot :one
SELECT * FROM usage_snapshots 
WHERE volume_id = $1 AND snapshot_type = $2 
ORDER BY snapshot_date DESC 
LIMIT 1;

-- name: GetSnapshotsByVolume :many
SELECT * FROM usage_snapshots 
WHERE volume_id = $1 AND snapshot_type = $2 
ORDER BY snapshot_date DESC 
LIMIT $3;

-- name: GetSnapshotsByDateRange :many
SELECT * FROM usage_snapshots 
WHERE volume_id = $1 AND snapshot_type = $2 
AND snapshot_date BETWEEN $3 AND $4 
ORDER BY snapshot_date DESC;

-- name: GetVolumeGrowthTrend :many
SELECT 
    snapshot_date,
    total_size,
    growth_bytes,
    growth_rate_bytes_per_day,
    file_count,
    growth_files
FROM usage_snapshots 
WHERE volume_id = $1 AND snapshot_type = $2 
AND snapshot_date >= $3 
ORDER BY snapshot_date ASC;

-- name: GetGrowthDeltas :one
WITH recent_snapshots AS (
    SELECT 
        snapshot_date,
        total_size,
        file_count,
        LAG(total_size) OVER (ORDER BY snapshot_date) as prev_size,
        LAG(file_count) OVER (ORDER BY snapshot_date) as prev_files,
        LAG(snapshot_date) OVER (ORDER BY snapshot_date) as prev_date
    FROM usage_snapshots 
    WHERE volume_id = $1 AND snapshot_type = $2 
    ORDER BY snapshot_date DESC 
    LIMIT $3
),
deltas AS (
    SELECT 
        snapshot_date,
        total_size,
        file_count,
        CASE 
            WHEN prev_size IS NOT NULL THEN total_size - prev_size 
            ELSE 0 
        END as size_delta,
        CASE 
            WHEN prev_files IS NOT NULL THEN file_count - prev_files 
            ELSE 0 
        END as files_delta,
        CASE 
            WHEN prev_date IS NOT NULL THEN 
                EXTRACT(days FROM (snapshot_date - prev_date))
            ELSE 0 
        END as days_diff
    FROM recent_snapshots
)
SELECT 
    COALESCE(SUM(size_delta), 0) as total_size_change,
    COALESCE(SUM(files_delta), 0) as total_files_change,
    COALESCE(AVG(CASE WHEN days_diff > 0 THEN size_delta / days_diff ELSE 0 END), 0) as avg_size_change_per_day,
    COALESCE(AVG(CASE WHEN days_diff > 0 THEN files_delta / days_diff ELSE 0 END), 0) as avg_files_change_per_day,
    COUNT(*) as snapshot_count,
    MIN(snapshot_date) as period_start,
    MAX(snapshot_date) as period_end
FROM deltas;

-- name: GetVolumeStepSeries :many
SELECT 
    snapshot_date as date,
    total_size,
    file_count,
    growth_rate_bytes_per_day as growth_rate
FROM usage_snapshots 
WHERE volume_id = $1 AND snapshot_type = $2 
AND snapshot_date >= $3 
ORDER BY snapshot_date ASC;

-- name: Get7DayTrend :one
SELECT 
    COALESCE(AVG(growth_rate_bytes_per_day), 0) as avg_growth_rate,
    COALESCE(SUM(growth_bytes), 0) as total_growth,
    COUNT(*) as data_points,
    MIN(snapshot_date) as period_start,
    MAX(snapshot_date) as period_end
FROM usage_snapshots 
WHERE volume_id = $1 AND snapshot_type = 'daily' 
AND snapshot_date >= (CURRENT_DATE - INTERVAL '7 days');

-- name: Get30DayTrend :one
SELECT 
    COALESCE(AVG(growth_rate_bytes_per_day), 0) as avg_growth_rate,
    COALESCE(SUM(growth_bytes), 0) as total_growth,
    COUNT(*) as data_points,
    MIN(snapshot_date) as period_start,
    MAX(snapshot_date) as period_end
FROM usage_snapshots 
WHERE volume_id = $1 AND snapshot_type = 'daily' 
AND snapshot_date >= (CURRENT_DATE - INTERVAL '30 days');

-- name: GetTrendSlope :one
WITH trend_data AS (
    SELECT 
        snapshot_date,
        total_size,
        ROW_NUMBER() OVER (ORDER BY snapshot_date) as x_val,
        COUNT(*) OVER () as n
    FROM usage_snapshots 
    WHERE volume_id = $1 AND snapshot_type = $2 
    AND snapshot_date >= $3 
    ORDER BY snapshot_date
),
slope_calc AS (
    SELECT 
        n,
        SUM(x_val) as sum_x,
        SUM(total_size) as sum_y,
        SUM(x_val * total_size) as sum_xy,
        SUM(x_val * x_val) as sum_x2
    FROM trend_data
    GROUP BY n
)
SELECT 
    CASE 
        WHEN n * sum_x2 - sum_x * sum_x = 0 THEN 0
        ELSE (n * sum_xy - sum_x * sum_y) / (n * sum_x2 - sum_x * sum_x)::DOUBLE PRECISION
    END as slope,
    n as data_points
FROM slope_calc;

-- name: DeleteOldDailySnapshots :exec
DELETE FROM usage_snapshots 
WHERE snapshot_type = 'daily' 
AND snapshot_date < (CURRENT_DATE - INTERVAL '90 days');

-- name: DeleteOldWeeklySnapshots :exec
DELETE FROM usage_snapshots 
WHERE snapshot_type = 'weekly' 
AND snapshot_date < (CURRENT_DATE - INTERVAL '1 year');

-- name: CompactDailyToWeekly :exec
WITH weekly_averages AS (
    SELECT 
        volume_id,
        DATE_TRUNC('week', snapshot_date)::DATE as week_start,
        AVG(total_size)::BIGINT as avg_total_size,
        AVG(file_count)::BIGINT as avg_file_count,
        AVG(directory_count)::BIGINT as avg_directory_count,
        MAX(largest_file) as max_largest_file,
        SUM(growth_bytes) as total_growth_bytes,
        SUM(growth_files) as total_growth_files,
        AVG(growth_rate_bytes_per_day) as avg_growth_rate,
        STRING_AGG(DISTINCT scan_method, ',') as scan_methods,
        AVG(scan_duration_ms)::BIGINT as avg_scan_duration
    FROM usage_snapshots 
    WHERE snapshot_type = 'daily' 
    AND snapshot_date >= (CURRENT_DATE - INTERVAL '90 days')
    AND snapshot_date < (CURRENT_DATE - INTERVAL '7 days')
    GROUP BY volume_id, DATE_TRUNC('week', snapshot_date)
)
INSERT INTO usage_snapshots (
    volume_id, snapshot_date, snapshot_type, total_size, file_count,
    directory_count, largest_file, growth_bytes, growth_files,
    growth_rate_bytes_per_day, scan_method, scan_duration_ms
)
SELECT 
    volume_id, week_start, 'weekly', avg_total_size, avg_file_count,
    avg_directory_count, max_largest_file, total_growth_bytes, total_growth_files,
    avg_growth_rate, scan_methods, avg_scan_duration
FROM weekly_averages
ON CONFLICT (volume_id, snapshot_date, snapshot_type) DO UPDATE SET
    total_size = EXCLUDED.total_size,
    file_count = EXCLUDED.file_count,
    directory_count = EXCLUDED.directory_count,
    largest_file = EXCLUDED.largest_file,
    growth_bytes = EXCLUDED.growth_bytes,
    growth_files = EXCLUDED.growth_files,
    growth_rate_bytes_per_day = EXCLUDED.growth_rate_bytes_per_day,
    scan_method = EXCLUDED.scan_method,
    scan_duration_ms = EXCLUDED.scan_duration_ms,
    updated_at = CURRENT_TIMESTAMP;

-- =============================================================================
-- VOLUME METRICS OPERATIONS
-- =============================================================================
-- Handles real-time volume metrics collection and analysis

-- name: SaveVolumeMetrics :exec
INSERT INTO volume_metrics (
    volume_id, metric_timestamp, total_size, file_count, directory_count,
    growth_rate, access_frequency, container_count, created_at, updated_at
) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
ON CONFLICT (volume_id, metric_timestamp) 
DO UPDATE SET
    total_size = EXCLUDED.total_size,
    file_count = EXCLUDED.file_count,
    directory_count = EXCLUDED.directory_count,
    growth_rate = EXCLUDED.growth_rate,
    access_frequency = volume_metrics.access_frequency + 1,
    container_count = EXCLUDED.container_count,
    updated_at = EXCLUDED.updated_at;

-- name: GetVolumeMetrics :many
SELECT id, created_at, updated_at, volume_id, metric_timestamp,
       total_size, file_count, directory_count, growth_rate,
       access_frequency, container_count
FROM volume_metrics
WHERE volume_id = $1 AND metric_timestamp BETWEEN $2 AND $3
ORDER BY metric_timestamp DESC
LIMIT $4;

-- name: GetLatestVolumeMetric :one
SELECT total_size, metric_timestamp
FROM volume_metrics
WHERE volume_id = $1
ORDER BY metric_timestamp DESC
LIMIT 1;

-- name: GetVolumeMetricsTrends :many
SELECT volume_id,
       AVG(growth_rate) as avg_growth_rate,
       MIN(total_size) as min_size,
       MAX(total_size) as max_size,
       COUNT(*) as data_points
FROM volume_metrics
WHERE volume_id = ANY($1) AND metric_timestamp >= $2
GROUP BY volume_id;

-- name: GetAllActiveVolumeIDs :many
SELECT DISTINCT volume_id
FROM volume_metrics
WHERE metric_timestamp >= $1
ORDER BY volume_id;

-- name: GetContainerCountForVolume :one
SELECT COUNT(DISTINCT container_id)
FROM volume_mounts
WHERE volume_id = $1 AND is_active = true;

-- name: DeleteOldVolumeMetrics :exec
DELETE FROM volume_metrics 
WHERE metric_timestamp < $1;

-- =============================================================================
-- VOLUME SIZES (SCAN STATS) OPERATIONS
-- =============================================================================
-- Handles volume size tracking from scan operations with validation

-- name: InsertVolumeSize :one
INSERT INTO volume_sizes (
    volume_id, total_size, file_count, directory_count, 
    largest_file, scan_method, scan_duration, filesystem_type,
    checksum_md5, is_valid, error_message
)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
RETURNING id, created_at, updated_at;

-- name: GetLatestVolumeSize :one
SELECT id, volume_id, total_size, file_count, directory_count, 
       largest_file, scan_method, scan_duration, filesystem_type,
       checksum_md5, is_valid, error_message, created_at, updated_at
FROM volume_sizes 
WHERE volume_id = $1 AND is_valid = true
ORDER BY created_at DESC
LIMIT 1;

-- name: GetVolumeSizesByVolumeID :many
SELECT id, volume_id, total_size, file_count, directory_count, 
       largest_file, scan_method, scan_duration, filesystem_type,
       checksum_md5, is_valid, error_message, created_at, updated_at
FROM volume_sizes 
WHERE volume_id = $1
ORDER BY created_at DESC
LIMIT $2;

-- name: GetVolumeSizeStats :one
SELECT 
    COUNT(*) as total_scans,
    AVG(total_size) as avg_size,
    MAX(total_size) as max_size,
    AVG(file_count) as avg_file_count,
    AVG(scan_duration) as avg_scan_duration
FROM volume_sizes
WHERE volume_id = $1 AND is_valid = true;

-- name: DeleteOldVolumeSizes :exec
DELETE FROM volume_sizes 
WHERE created_at < $1;