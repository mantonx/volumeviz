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
-- ATOMIC CLAIM AND WORKER HARDENING OPERATIONS
-- =============================================================================

-- name: ClaimNextScanJob :one
-- Atomically claim the next available scan job using SKIP LOCKED
UPDATE scan_jobs 
SET status = 'running', started_at = $1, updated_at = CURRENT_TIMESTAMP
WHERE id IN (
    SELECT id 
    FROM scan_jobs
    WHERE status = 'queued'
    ORDER BY created_at ASC
    FOR UPDATE SKIP LOCKED
    LIMIT 1
)
RETURNING id, scan_id, volume_id, status, progress, method, started_at, completed_at, error_message, result_id, estimated_duration, created_at, updated_at;

-- name: UpdateScanJobHeartbeat :exec
-- Update heartbeat timestamp for an active scan job
UPDATE scan_jobs 
SET updated_at = CURRENT_TIMESTAMP, progress = $2
WHERE scan_id = $1 AND status = 'running';

-- name: MarkStaleScanJobsAsFailed :many
-- Mark scan jobs as failed if they haven't been updated within the timeout period
-- This is the watchdog functionality
WITH stale_jobs AS (
    UPDATE scan_jobs 
    SET status = 'failed', 
        error_message = 'Scan job timed out - no heartbeat received within ' || $1 || ' seconds',
        completed_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
    WHERE status = 'running' 
    AND updated_at < (CURRENT_TIMESTAMP - INTERVAL '1 second' * $1)
    RETURNING scan_id
),
failed_phases AS (
    UPDATE scan_phases
    SET status = 'failed',
        error_message = 'Scan job timed out - no heartbeat received within ' || $1 || ' seconds',
        completed_at = CURRENT_TIMESTAMP,
        duration_ms = EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - started_at)) * 1000,
        updated_at = CURRENT_TIMESTAMP
    WHERE scan_id IN (SELECT scan_id FROM stale_jobs)
    AND status IN ('running', 'pending')
    RETURNING scan_id
)
SELECT scan_id FROM stale_jobs;

-- name: MarkInFlightJobsAsFailed :many
-- Mark all running scan jobs as failed (used during graceful restart)
WITH failed_jobs AS (
    UPDATE scan_jobs 
    SET status = 'failed',
        error_message = $1,
        completed_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP  
    WHERE status = 'running'
    RETURNING scan_id
),
failed_phases AS (
    UPDATE scan_phases
    SET status = 'failed',
        error_message = $1,
        completed_at = CURRENT_TIMESTAMP,
        duration_ms = EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - started_at)) * 1000,
        updated_at = CURRENT_TIMESTAMP
    WHERE scan_id IN (SELECT scan_id FROM failed_jobs)
    AND status IN ('running', 'pending')
    RETURNING scan_id
)
SELECT scan_id FROM failed_jobs;

-- name: MarkInFlightJobsAsPaused :many
-- Mark all running scan jobs as paused (used during graceful restart/shutdown)
WITH paused_jobs AS (
    UPDATE scan_jobs 
    SET status = 'paused',
        error_message = $1,
        updated_at = CURRENT_TIMESTAMP  
    WHERE status = 'running'
    RETURNING scan_id
),
paused_phases AS (
    UPDATE scan_phases
    SET status = 'paused',
        pause_reason = $1,
        updated_at = CURRENT_TIMESTAMP
    WHERE scan_id IN (SELECT scan_id FROM paused_jobs)
    AND status IN ('running', 'pending')
    RETURNING scan_id
)
SELECT scan_id FROM paused_jobs;

-- name: GetQueueDepth :one
-- Get current queue depth for metrics
SELECT COUNT(*) as queue_depth 
FROM scan_jobs 
WHERE status = 'queued';

-- name: GetActiveScanCount :one  
-- Get current active scan count for metrics
SELECT COUNT(*) as active_count
FROM scan_jobs 
WHERE status = 'running';

-- name: GetScanJobsByVolume :many
-- Get all scan jobs for a specific volume (for volume concurrency check)
SELECT id, scan_id, volume_id, status, progress, method, started_at, completed_at, error_message, result_id, estimated_duration, created_at, updated_at
FROM scan_jobs 
WHERE volume_id = $1 
ORDER BY created_at DESC
LIMIT $2;

-- name: HasActiveScanForVolume :one
-- Check if there's already an active scan for a volume (enforces max 1 per volume)
SELECT EXISTS(
    SELECT 1 FROM scan_jobs 
    WHERE volume_id = $1 AND status IN ('queued', 'running')
) as has_active_scan;

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