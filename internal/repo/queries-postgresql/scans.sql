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
ORDER BY COALESCE(started_at, created_at) DESC NULLS LAST
LIMIT $1 OFFSET $2;

-- name: ListScanJobsByOrganization :many
SELECT * FROM scan_jobs
WHERE organization_id = $1
ORDER BY started_at DESC
LIMIT $2 OFFSET $3;

-- name: ListScanJobsByVolume :many
SELECT * FROM scan_jobs
WHERE volume_id = $1
ORDER BY started_at DESC NULLS LAST
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
    error_message = 'Scan job marked as stale after timeout (no heartbeat)',
    completed_at = CURRENT_TIMESTAMP,
    updated_at = CURRENT_TIMESTAMP
WHERE status = 'running'
  AND updated_at < (CURRENT_TIMESTAMP - INTERVAL '1 second' * $1)
RETURNING scan_id;

-- name: MarkInFlightJobsAsPaused :many
UPDATE scan_jobs
SET
    status = 'paused',
    error_message = $1,
    updated_at = CURRENT_TIMESTAMP
WHERE status IN ('running', 'pending')
RETURNING scan_id;

-- name: MarkInFlightJobsAsFailed :many
UPDATE scan_jobs
SET
    status = 'failed',
    error_message = $1,
    completed_at = CURRENT_TIMESTAMP,
    updated_at = CURRENT_TIMESTAMP
WHERE status IN ('running', 'pending')
RETURNING scan_id;

-- name: ClaimNextScanJob :one
UPDATE scan_jobs
SET
    status = 'running',
    started_at = $1,
    updated_at = CURRENT_TIMESTAMP
WHERE scan_id = (
    SELECT scan_id
    FROM scan_jobs
    WHERE status = 'pending'
    ORDER BY started_at ASC NULLS FIRST, scan_id ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED
)
RETURNING *;

-- name: UpdateScanJobHeartbeat :exec
UPDATE scan_jobs
SET updated_at = CURRENT_TIMESTAMP
WHERE scan_id = $1;

-- ============================================================================
-- Database View Queries
-- ============================================================================
-- These queries access the monitoring views created in migration 000008

-- name: GetActiveScans :many
SELECT * FROM active_scans
ORDER BY started_at DESC;

-- name: GetActiveScansByOrganization :many
SELECT a.* FROM active_scans a
JOIN volumes v ON a.volume_id = v.id
WHERE v.organization_id = $1
ORDER BY a.started_at DESC;

-- name: GetActiveScanByID :one
SELECT * FROM active_scans
WHERE scan_id = $1;

-- name: GetScanProgressSummary :many
SELECT * FROM scan_progress_summary
WHERE scan_id = $1
ORDER BY phase_started_at ASC;

-- name: GetScanProgressSummaryByVolume :many
SELECT s.* FROM scan_progress_summary s
JOIN volumes v ON s.volume_id = v.id
WHERE s.volume_id = $1 AND v.organization_id = $2
ORDER BY s.scan_started_at DESC, s.phase_started_at ASC
LIMIT $3 OFFSET $4;

-- name: GetRecentScanErrors :many
SELECT * FROM recent_scan_errors
ORDER BY occurred_at DESC
LIMIT $1 OFFSET $2;

-- name: GetRecentScanErrorsByOrganization :many
SELECT r.* FROM recent_scan_errors r
JOIN volumes v ON r.volume_id = v.id
WHERE v.organization_id = $1
ORDER BY r.occurred_at DESC
LIMIT $2 OFFSET $3;

-- name: GetRecentScanErrorsByScanID :many
SELECT * FROM recent_scan_errors
WHERE scan_id = $1
ORDER BY occurred_at DESC;

-- name: GetScanHistory :many
SELECT * FROM scan_history
LIMIT $1 OFFSET $2;

-- name: GetScanHistoryByOrganization :many
SELECT s.* FROM scan_history s
JOIN volumes v ON s.volume_id = v.id
WHERE v.organization_id = $1
ORDER BY s.completed_at DESC
LIMIT $2 OFFSET $3;

-- name: GetScanHistoryByVolume :many
SELECT * FROM scan_history
WHERE volume_id = $1
ORDER BY completed_at DESC
LIMIT $2 OFFSET $3;

-- name: GetVolumeScanStats :many
SELECT * FROM volume_scan_stats
ORDER BY last_scan_started DESC;

-- name: GetVolumeScanStatsByOrganization :many
SELECT v.* FROM volume_scan_stats v
JOIN volumes vol ON v.volume_id = vol.id
WHERE vol.organization_id = $1
ORDER BY v.last_scan_started DESC;

-- name: GetVolumeScanStatsByVolumeID :one
SELECT * FROM volume_scan_stats
WHERE volume_id = $1;