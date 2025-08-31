-- Scan job management queries for SQLite

-- name: CreateScanJob :one
INSERT INTO scan_jobs (
    scan_id, volume_id, status, started_at
) VALUES (
    ?, ?, ?, ?
) RETURNING *;

-- name: GetScanJobByScanID :one
SELECT * FROM scan_jobs WHERE scan_id = ?;

-- name: ListScanJobs :many
SELECT * FROM scan_jobs
ORDER BY started_at DESC
LIMIT ? OFFSET ?;

-- name: ListScanJobsByVolume :many
SELECT * FROM scan_jobs
WHERE volume_id = ?
ORDER BY started_at DESC
LIMIT ? OFFSET ?;

-- name: ListScanJobsByStatus :many
SELECT * FROM scan_jobs
WHERE status = ?
ORDER BY started_at DESC
LIMIT ? OFFSET ?;

-- name: UpdateScanJobStatus :exec
UPDATE scan_jobs
SET 
    status = ?1,
    error_message = CASE WHEN ?1 = 'failed' THEN ?2 ELSE error_message END,
    completed_at = CASE WHEN ?1 IN ('completed', 'failed', 'cancelled') THEN datetime('now') ELSE completed_at END,
    updated_at = datetime('now')
WHERE scan_id = ?3;

-- name: UpdateScanJobProgress :exec
UPDATE scan_jobs
SET 
    scanned_files = ?2,
    scanned_bytes = ?3,
    updated_at = datetime('now')
WHERE scan_id = ?1;

-- name: CompleteScanJob :exec
UPDATE scan_jobs
SET 
    status = 'completed',
    completed_at = datetime('now'),
    updated_at = datetime('now')
WHERE scan_id = ?1;

-- name: FailScanJob :exec
UPDATE scan_jobs
SET 
    status = 'failed',
    error_message = ?2,
    completed_at = datetime('now'),
    updated_at = datetime('now')
WHERE scan_id = ?1;

-- name: CancelScanJob :exec
UPDATE scan_jobs
SET 
    status = 'cancelled',
    completed_at = datetime('now'),
    updated_at = datetime('now')
WHERE scan_id = ?1;

-- name: GetActiveScanJobs :many
SELECT * FROM scan_jobs
WHERE status IN ('pending', 'running')
ORDER BY started_at ASC;

-- name: GetCompletedScanJobs :many
SELECT * FROM scan_jobs
WHERE status = 'completed'
AND completed_at >= ?
ORDER BY completed_at DESC
LIMIT ?;

-- name: DeleteOldScanJobs :exec
DELETE FROM scan_jobs
WHERE completed_at < ?
AND status IN ('completed', 'failed', 'cancelled');

-- name: CountScanJobsByStatus :one
SELECT COUNT(*) FROM scan_jobs WHERE status = ?;

-- name: MarkStaleScanJobsAsFailed :many
UPDATE scan_jobs
SET 
    status = 'failed',
    error_message = 'Scan job marked as stale after timeout',
    completed_at = datetime('now'),
    updated_at = datetime('now')
WHERE status = 'running'
  AND started_at < datetime('now', '-' || ? || ' seconds')
  AND started_at IS NOT NULL
RETURNING scan_id;

-- name: MarkInFlightJobsAsPaused :many
UPDATE scan_jobs
SET 
    status = 'paused',
    error_message = ?,
    updated_at = datetime('now')
WHERE status IN ('running', 'pending')
RETURNING scan_id;