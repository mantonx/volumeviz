-- Scan job management queries for PostgreSQL

-- name: CreateScanJob :one
INSERT INTO scan_jobs (
    scan_id, volume_id, status, started_at, organization_id
) VALUES (
    $1, $2, $3, $4, $5
) RETURNING *;

-- name: GetScanJobByScanID :one
SELECT * FROM scan_jobs WHERE scan_id = $1;

-- name: ListScanJobs :many
SELECT * FROM scan_jobs
ORDER BY started_at DESC
LIMIT $1 OFFSET $2;

-- name: ListScanJobsByOrganization :many
SELECT * FROM scan_jobs
WHERE organization_id = $1
ORDER BY started_at DESC
LIMIT $2 OFFSET $3;

-- name: ListScanJobsByVolume :many
SELECT * FROM scan_jobs
WHERE volume_id = $1
ORDER BY started_at DESC
LIMIT $2 OFFSET $3;

-- name: ListScanJobsByVolumeAndOrganization :many
SELECT * FROM scan_jobs
WHERE volume_id = $1 AND organization_id = $2
ORDER BY started_at DESC
LIMIT $3 OFFSET $4;

-- name: ListScanJobsByStatus :many
SELECT * FROM scan_jobs
WHERE status = $1
ORDER BY started_at DESC
LIMIT $2 OFFSET $3;

-- name: UpdateScanJobStatus :exec
UPDATE scan_jobs
SET 
    status = $2,
    error_message = CASE WHEN $2 = 'failed' THEN $3 ELSE error_message END,
    completed_at = CASE WHEN $2 IN ('completed', 'failed', 'cancelled') THEN CURRENT_TIMESTAMP ELSE completed_at END,
    updated_at = CURRENT_TIMESTAMP
WHERE scan_id = $1;

-- name: UpdateScanJobProgress :exec
UPDATE scan_jobs
SET 
    scanned_files = $2,
    scanned_bytes = $3,
    updated_at = CURRENT_TIMESTAMP
WHERE scan_id = $1;

-- name: CompleteScanJob :exec
UPDATE scan_jobs
SET 
    status = 'completed',
    completed_at = CURRENT_TIMESTAMP,
    updated_at = CURRENT_TIMESTAMP
WHERE scan_id = $1;

-- name: FailScanJob :exec
UPDATE scan_jobs
SET 
    status = 'failed',
    error_message = $2,
    completed_at = CURRENT_TIMESTAMP,
    updated_at = CURRENT_TIMESTAMP
WHERE scan_id = $1;

-- name: CancelScanJob :exec
UPDATE scan_jobs
SET 
    status = 'cancelled',
    completed_at = CURRENT_TIMESTAMP,
    updated_at = CURRENT_TIMESTAMP
WHERE scan_id = $1;

-- name: GetActiveScanJobs :many
SELECT * FROM scan_jobs
WHERE status IN ('pending', 'running')
ORDER BY started_at ASC;

-- name: GetActiveScanJobsByOrganization :many
SELECT * FROM scan_jobs
WHERE status IN ('pending', 'running') AND organization_id = $1
ORDER BY started_at ASC;

-- name: GetCompletedScanJobs :many
SELECT * FROM scan_jobs
WHERE status = 'completed'
AND completed_at >= $1
ORDER BY completed_at DESC
LIMIT $2;

-- name: DeleteOldScanJobs :exec
DELETE FROM scan_jobs
WHERE completed_at < $1
AND status IN ('completed', 'failed', 'cancelled');

-- name: CountScanJobsByStatus :one
SELECT COUNT(*) FROM scan_jobs WHERE status = $1;

-- name: MarkStaleScanJobsAsFailed :many
UPDATE scan_jobs
SET 
    status = 'failed',
    error_message = 'Scan job marked as stale after timeout',
    completed_at = CURRENT_TIMESTAMP,
    updated_at = CURRENT_TIMESTAMP
WHERE status = 'running'
  AND started_at < (CURRENT_TIMESTAMP - INTERVAL '1 second' * $1)
  AND started_at IS NOT NULL
RETURNING scan_id;

-- name: MarkInFlightJobsAsPaused :many
UPDATE scan_jobs
SET 
    status = 'paused',
    error_message = $1,
    updated_at = CURRENT_TIMESTAMP
WHERE status IN ('running', 'pending')
RETURNING scan_id;