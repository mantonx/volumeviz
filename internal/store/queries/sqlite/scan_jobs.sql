-- Scan job operations (SQLite)

-- name: CreateScanJob :one
INSERT INTO scan_jobs (scan_id, volume_id, status, progress, method, started_at, completed_at, error_message, result_id, estimated_duration)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
RETURNING id, created_at, updated_at;

-- name: GetScanJobByID :one
SELECT id, scan_id, volume_id, status, progress, method, started_at, completed_at, error_message, result_id, estimated_duration, created_at, updated_at
FROM scan_jobs 
WHERE id = ?;

-- name: GetScanJobByScanID :one
SELECT id, scan_id, volume_id, status, progress, method, started_at, completed_at, error_message, result_id, estimated_duration, created_at, updated_at
FROM scan_jobs 
WHERE scan_id = ?;

-- name: GetLatestScanJobByVolumeID :one
SELECT id, scan_id, volume_id, status, progress, method, started_at, completed_at, error_message, result_id, estimated_duration, created_at, updated_at
FROM scan_jobs 
WHERE volume_id = ?
ORDER BY created_at DESC
LIMIT 1;

-- name: GetActiveScanJobs :many
SELECT id, scan_id, volume_id, status, progress, method, started_at, completed_at, error_message, result_id, estimated_duration, created_at, updated_at
FROM scan_jobs 
WHERE status IN ('queued', 'running')
ORDER BY created_at ASC;

-- name: ListScanJobs :many
SELECT id, scan_id, volume_id, status, progress, method, started_at, completed_at, error_message, result_id, estimated_duration, created_at, updated_at
FROM scan_jobs
ORDER BY created_at DESC
LIMIT ? OFFSET ?;

-- name: UpdateScanJobStatus :one
UPDATE scan_jobs 
SET status = ?, progress = ?, error_message = ?, updated_at = CURRENT_TIMESTAMP
WHERE id = ?
RETURNING updated_at;

-- name: UpdateScanJobProgress :exec
UPDATE scan_jobs 
SET progress = ?, updated_at = CURRENT_TIMESTAMP
WHERE scan_id = ?;

-- name: CompleteScanJob :one
UPDATE scan_jobs 
SET status = ?, progress = 100, completed_at = ?, result_id = ?, updated_at = CURRENT_TIMESTAMP
WHERE scan_id = ?
RETURNING id, updated_at;

-- name: FailScanJob :one
UPDATE scan_jobs 
SET status = 'failed', error_message = ?, completed_at = ?, updated_at = CURRENT_TIMESTAMP
WHERE scan_id = ?
RETURNING id, updated_at;

-- name: GetScanJobStats :one
SELECT 
    COUNT(*) as total_jobs,
    COALESCE(SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END), 0) as completed_jobs,
    COALESCE(SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END), 0) as failed_jobs,
    COALESCE(SUM(CASE WHEN status IN ('queued', 'running') THEN 1 ELSE 0 END), 0) as active_jobs,
    AVG(CASE WHEN completed_at IS NOT NULL AND started_at IS NOT NULL 
        THEN CAST((julianday(completed_at) - julianday(started_at)) * 24 * 3600 AS INTEGER) 
        ELSE NULL END) as avg_duration_seconds
FROM scan_jobs;

-- name: GetRecentScanJobs :many
SELECT id, scan_id, volume_id, status, progress, method, started_at, completed_at, error_message, result_id, estimated_duration, created_at, updated_at
FROM scan_jobs
WHERE created_at >= ?
ORDER BY created_at DESC
LIMIT ?;

-- name: DeleteOldScanJobs :exec
DELETE FROM scan_jobs 
WHERE created_at < ? AND status IN ('completed', 'failed');

-- name: UpdateScanJobStatusAndProgress :one
UPDATE scan_jobs 
SET status = ?, progress = ?, updated_at = CURRENT_TIMESTAMP
WHERE scan_id = ?
RETURNING id, updated_at;

-- name: StartScanJob :one
UPDATE scan_jobs 
SET status = 'running', started_at = ?, updated_at = CURRENT_TIMESTAMP
WHERE scan_id = ?
RETURNING id, updated_at;