-- Volume metrics operations (SQLite)

-- name: SaveVolumeMetrics :exec
INSERT INTO volume_metrics (
    volume_id, metric_timestamp, total_size, file_count, directory_count,
    growth_rate, access_frequency, container_count, created_at, updated_at
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
WHERE volume_id = ? AND metric_timestamp BETWEEN ? AND ?
ORDER BY metric_timestamp DESC
LIMIT ?;

-- name: GetLatestVolumeMetric :one
SELECT total_size, metric_timestamp
FROM volume_metrics
WHERE volume_id = ?
ORDER BY metric_timestamp DESC
LIMIT 1;

-- name: GetVolumeMetricsTrends :many
SELECT volume_id,
       AVG(growth_rate) as avg_growth_rate,
       MIN(total_size) as min_size,
       MAX(total_size) as max_size,
       COUNT(*) as data_points
FROM volume_metrics
WHERE volume_id IN (SELECT value FROM json_each(?)) AND metric_timestamp >= ?
GROUP BY volume_id;

-- name: GetAllActiveVolumeIDs :many
SELECT DISTINCT volume_id
FROM volume_metrics
WHERE metric_timestamp >= ?
ORDER BY volume_id;

-- name: GetContainerCountForVolume :one
SELECT COUNT(DISTINCT container_id)
FROM volume_mounts
WHERE volume_id = ? AND is_active = 1;

-- name: DeleteOldVolumeMetrics :exec
DELETE FROM volume_metrics 
WHERE metric_timestamp < ?;