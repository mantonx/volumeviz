-- Consolidated queries for scan jobs and health/diagnostic operations
-- This file consolidates queries from scan_jobs.sql and health.sql

-- =============================================================================
-- SCAN JOB OPERATIONS
-- =============================================================================

-- name: CreateScanJob :one
INSERT INTO scan_jobs (scan_id, volume_id, status, progress, method, started_at, completed_at, error_message, result_id, estimated_duration)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
RETURNING id, created_at, updated_at;

-- name: GetScanJobByID :one
SELECT id, scan_id, volume_id, status, progress, method, started_at, completed_at, error_message, result_id, estimated_duration, created_at, updated_at
FROM scan_jobs 
WHERE id = $1;

-- name: GetScanJobByScanID :one
SELECT id, scan_id, volume_id, status, progress, method, started_at, completed_at, error_message, result_id, estimated_duration, created_at, updated_at
FROM scan_jobs 
WHERE scan_id = $1;

-- name: GetLatestScanJobByVolumeID :one
SELECT id, scan_id, volume_id, status, progress, method, started_at, completed_at, error_message, result_id, estimated_duration, created_at, updated_at
FROM scan_jobs 
WHERE volume_id = $1
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
LIMIT $1 OFFSET $2;

-- name: UpdateScanJobStatus :one
UPDATE scan_jobs 
SET status = $2, progress = $3, error_message = $4, updated_at = CURRENT_TIMESTAMP
WHERE id = $1
RETURNING updated_at;

-- name: UpdateScanJobProgress :exec
UPDATE scan_jobs 
SET progress = $2, updated_at = CURRENT_TIMESTAMP
WHERE scan_id = $1;

-- name: CompleteScanJob :one
UPDATE scan_jobs 
SET status = $2, progress = 100, completed_at = $3, result_id = $4, updated_at = CURRENT_TIMESTAMP
WHERE scan_id = $1
RETURNING id, updated_at;

-- name: FailScanJob :one
UPDATE scan_jobs 
SET status = 'failed', error_message = $2, completed_at = $3, updated_at = CURRENT_TIMESTAMP
WHERE scan_id = $1
RETURNING id, updated_at;

-- name: GetScanJobStats :one
SELECT 
    COUNT(*) as total_jobs,
    COALESCE(COUNT(*) FILTER (WHERE status = 'completed'), 0) as completed_jobs,
    COALESCE(COUNT(*) FILTER (WHERE status = 'failed'), 0) as failed_jobs,
    COALESCE(COUNT(*) FILTER (WHERE status IN ('queued', 'running')), 0) as active_jobs,
    AVG(EXTRACT(EPOCH FROM (completed_at - started_at))) as avg_duration_seconds
FROM scan_jobs;

-- name: GetRecentScanJobs :many
SELECT id, scan_id, volume_id, status, progress, method, started_at, completed_at, error_message, result_id, estimated_duration, created_at, updated_at
FROM scan_jobs
WHERE created_at >= $1
ORDER BY created_at DESC
LIMIT $2;

-- name: DeleteOldScanJobs :exec
DELETE FROM scan_jobs 
WHERE created_at < $1 AND status IN ('completed', 'failed');

-- name: UpdateScanJobStatusAndProgress :one
UPDATE scan_jobs 
SET status = $2, progress = $3, updated_at = CURRENT_TIMESTAMP
WHERE scan_id = $1
RETURNING id, updated_at;

-- name: StartScanJob :one
UPDATE scan_jobs 
SET status = 'running', started_at = $2, updated_at = CURRENT_TIMESTAMP
WHERE scan_id = $1
RETURNING id, updated_at;

-- =============================================================================
-- HEALTH AND DIAGNOSTIC OPERATIONS
-- =============================================================================

-- name: HealthCheck :one
SELECT 1 as status;

-- name: GetTotalVolumeCount :one
SELECT COUNT(*) FROM volumes;

-- name: GetTotalScanJobCount :one  
SELECT COUNT(*) FROM scan_jobs;

-- name: GetTotalMetricsCount :one
SELECT COUNT(*) FROM volume_metrics;