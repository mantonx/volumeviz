-- Retention queries for data lifecycle management

-- name: PruneVolumeMetrics :exec
DELETE FROM volume_metrics 
WHERE metric_timestamp < NOW() - INTERVAL '1 day' * $1;

-- name: CountVolumeMetrics :one
SELECT COUNT(*) FROM volume_metrics 
WHERE metric_timestamp < NOW() - INTERVAL '1 day' * $1;

-- name: PruneScanJobs :exec  
DELETE FROM scan_jobs 
WHERE (status = 'completed' OR status = 'failed' OR status = 'cancelled')
AND created_at < NOW() - INTERVAL '1 day' * $1;

-- name: CountOldScanJobs :one
SELECT COUNT(*) FROM scan_jobs 
WHERE (status = 'completed' OR status = 'failed' OR status = 'cancelled')
AND created_at < NOW() - INTERVAL '1 day' * $1;

-- name: PruneDailyStats :exec
DELETE FROM stats_daily 
WHERE date < CURRENT_DATE - INTERVAL '1 day' * $1;

-- name: CountOldDailyStats :one
SELECT COUNT(*) FROM stats_daily 
WHERE date < CURRENT_DATE - INTERVAL '1 day' * $1;

-- name: PruneFileMetadata :exec
DELETE FROM file_metadata 
WHERE enriched_at < NOW() - INTERVAL '1 day' * $1;

-- name: CountOldFileMetadata :one
SELECT COUNT(*) FROM file_metadata 
WHERE enriched_at < NOW() - INTERVAL '1 day' * $1;

-- name: PruneInactiveFolders :exec
DELETE FROM folders 
WHERE volume_id NOT IN (SELECT volume_id FROM volumes WHERE is_active = true)
AND updated_at < NOW() - INTERVAL '1 day' * $1;

-- name: CountInactiveFolders :one  
SELECT COUNT(*) FROM folders 
WHERE volume_id NOT IN (SELECT volume_id FROM volumes WHERE is_active = true)
AND updated_at < NOW() - INTERVAL '1 day' * $1;

-- name: PruneInactiveFiles :exec
DELETE FROM files 
WHERE volume_id NOT IN (SELECT volume_id FROM volumes WHERE is_active = true)
AND updated_at < NOW() - INTERVAL '1 day' * $1;

-- name: CountInactiveFiles :one
SELECT COUNT(*) FROM files 
WHERE volume_id NOT IN (SELECT volume_id FROM volumes WHERE is_active = true)
AND updated_at < NOW() - INTERVAL '1 day' * $1;

-- name: VacuumAnalyze :exec
VACUUM ANALYZE;