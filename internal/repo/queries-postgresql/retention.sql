-- Retention and cleanup queries for PostgreSQL
-- These queries help prevent database bloat by removing old data

-- ============================================================================
-- Scan Phases Retention
-- ============================================================================

-- name: CountOldScanPhases :one
SELECT COUNT(*) FROM scan_phases
WHERE updated_at < $1;

-- name: DeleteOldScanPhases :exec
DELETE FROM scan_phases
WHERE updated_at < $1;

-- ============================================================================
-- Scan Errors Retention
-- ============================================================================

-- name: CountOldScanErrors :one
SELECT COUNT(*) FROM scan_errors
WHERE occurred_at < $1;

-- name: DeleteOldScanErrors :exec
DELETE FROM scan_errors
WHERE occurred_at < $1;

-- ============================================================================
-- Scan Performance Metrics Retention
-- ============================================================================

-- name: CountOldScanMetrics :one
SELECT COUNT(*) FROM scan_performance_metrics
WHERE measured_at < $1;

-- name: DeleteOldScanMetrics :exec
DELETE FROM scan_performance_metrics
WHERE measured_at < $1;

-- ============================================================================
-- Retention Statistics
-- Get counts of records eligible for retention by age
-- ============================================================================

-- name: GetRetentionStats :one
SELECT
    (SELECT COUNT(*) FROM scan_phases WHERE scan_phases.updated_at < $1) as old_scan_phases,
    (SELECT COUNT(*) FROM scan_errors WHERE scan_errors.occurred_at < $1) as old_scan_errors,
    (SELECT COUNT(*) FROM scan_performance_metrics WHERE scan_performance_metrics.measured_at < $1) as old_scan_metrics,
    (SELECT COUNT(*) FROM file_metadata WHERE file_metadata.extracted_at < $1) as old_file_metadata,
    (SELECT COUNT(*) FROM files WHERE files.modified_at < $1) as old_files,
    (SELECT COUNT(*) FROM scan_jobs WHERE scan_jobs.completed_at < $1 AND scan_jobs.status IN ('completed', 'failed', 'cancelled')) as old_scan_jobs;
