-- name: PruneVolumeMetrics :execrows
-- Removes volume_metrics entries older than the specified date
DELETE FROM volume_metrics 
WHERE metric_timestamp < (CURRENT_TIMESTAMP - INTERVAL '@ttl_days days');

-- name: PruneVolumeSizes :execrows
-- Removes volume_sizes entries older than the specified date
DELETE FROM volume_sizes 
WHERE created_at < (CURRENT_TIMESTAMP - INTERVAL '@ttl_days days');

-- name: PruneScanJobs :execrows
-- Removes completed/failed scan_jobs entries older than the specified date
DELETE FROM scan_jobs 
WHERE created_at < (CURRENT_TIMESTAMP - INTERVAL '@ttl_days days')
  AND status IN ('completed', 'failed', 'canceled');

-- name: CreateDailyRollupTable :exec
-- Creates the daily rollup table if it doesn't exist
CREATE TABLE IF NOT EXISTS volume_metrics_daily (
    id SERIAL PRIMARY KEY,
    volume_id VARCHAR(255) NOT NULL,
    day DATE NOT NULL,
    total_size_avg BIGINT,
    file_count_avg BIGINT,
    directory_count_avg BIGINT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(volume_id, day)
);

-- name: RollupDailyMetrics :exec
-- Creates or updates daily aggregates for the last 7 days
INSERT INTO volume_metrics_daily (volume_id, day, total_size_avg, file_count_avg, directory_count_avg)
SELECT volume_id,
       DATE(metric_timestamp) AS day,
       AVG(total_size)::BIGINT,
       AVG(file_count)::BIGINT,
       AVG(directory_count)::BIGINT
FROM volume_metrics
WHERE metric_timestamp >= (CURRENT_DATE - INTERVAL '7 days')
GROUP BY volume_id, DATE(metric_timestamp)
ON CONFLICT (volume_id, day) DO UPDATE SET
  total_size_avg = EXCLUDED.total_size_avg,
  file_count_avg = EXCLUDED.file_count_avg,
  directory_count_avg = EXCLUDED.directory_count_avg;