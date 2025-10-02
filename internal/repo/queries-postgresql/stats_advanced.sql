-- Advanced statistics and analytics queries for PostgreSQL

-- =============================================================================
-- FOLDER GROWTH AND TRENDS
-- =============================================================================

-- name: GetFolderGrowthTrends :many
SELECT
    f.id,
    f.volume_id,
    f.path,
    f.size_bytes_recursive as total_size,
    f.file_count_recursive as file_count,
    f.modified_at as updated_at,
    COALESCE(LAG(f.size_bytes_recursive) OVER (PARTITION BY f.path ORDER BY f.modified_at), 0) as previous_size,
    f.size_bytes_recursive - COALESCE(LAG(f.size_bytes_recursive) OVER (PARTITION BY f.path ORDER BY f.modified_at), 0) as size_change
FROM folders f
WHERE f.volume_id = $1
  AND f.modified_at >= $2
ORDER BY size_change DESC
LIMIT $3;

-- name: GetTopGrowingFolders :many
WITH folder_changes AS (
    SELECT
        f.id,
        f.volume_id,
        f.path,
        f.size_bytes_recursive as current_size,
        f.file_count_recursive as file_count,
        f.modified_at as updated_at,
        COALESCE(LAG(f.size_bytes_recursive) OVER (PARTITION BY f.path ORDER BY f.modified_at), f.size_bytes_recursive) as previous_size
    FROM folders f
    WHERE f.volume_id = $1
      AND f.modified_at >= $2
)
SELECT
    id,
    volume_id,
    path,
    current_size,
    file_count,
    updated_at,
    previous_size,
    (current_size - previous_size) as size_change,
    CASE
        WHEN previous_size > 0 THEN ((current_size - previous_size)::float / previous_size::float * 100)
        ELSE 0
    END as growth_percent
FROM folder_changes
WHERE (current_size - previous_size) > 0
ORDER BY (current_size - previous_size) DESC
LIMIT $3;

-- =============================================================================
-- MEDIA AND FILE TYPE ANALYSIS
-- =============================================================================

-- name: GetMediaKindComposition :many
SELECT
    fm.raw_metadata->>'mediaKind' as media_kind,
    COUNT(*) as file_count,
    SUM(fi.size_bytes) as total_bytes,
    AVG(fi.size_bytes)::bigint as avg_size,
    MIN(fi.size_bytes) as min_size,
    MAX(fi.size_bytes) as max_size
FROM file_metadata fm
INNER JOIN files fi ON fm.file_id = fi.id
WHERE fi.volume_id = $1
  AND fm.raw_metadata->>'mediaKind' IS NOT NULL
  AND fm.raw_metadata->>'mediaKind' != ''
GROUP BY fm.raw_metadata->>'mediaKind'
ORDER BY total_bytes DESC;

-- name: GetFileTypeDistribution :many
SELECT
    LOWER(SUBSTRING(fi.name FROM '\.([^.]+)$')) as extension,
    COUNT(*) as file_count,
    SUM(fi.size_bytes) as total_bytes,
    AVG(fi.size_bytes)::bigint as avg_size
FROM files fi
WHERE fi.volume_id = $1
  AND fi.is_dir = false
GROUP BY extension
HAVING COUNT(*) > 0
ORDER BY total_bytes DESC
LIMIT $2;

-- =============================================================================
-- TREND ANALYSIS
-- =============================================================================

-- name: GetTrendAnalysis :one
WITH stats_window AS (
    SELECT
        date,
        total_size_bytes,
        total_files,
        size_change_bytes,
        growth_percent
    FROM daily_stats
    WHERE volume_id = $1
      AND date >= CURRENT_DATE - $2::int
    ORDER BY date DESC
)
SELECT
    $1 as volume_id,
    COUNT(*) as data_points,
    MAX(date) as latest_date,
    SUM(total_files) as total_files,
    SUM(total_size_bytes) as total_bytes,
    AVG(size_change_bytes)::bigint as avg_daily_change,
    AVG(growth_percent)::numeric as avg_growth_rate,
    MAX(size_change_bytes) as max_daily_change,
    MIN(size_change_bytes) as min_daily_change,
    STDDEV(size_change_bytes)::bigint as change_stddev
FROM stats_window;

-- name: GetStorageGrowthTrend :many
SELECT
    date,
    total_size_bytes,
    size_change_bytes,
    growth_percent,
    total_files,
    new_files,
    deleted_files,
    modified_files
FROM daily_stats
WHERE volume_id = $1
  AND date >= $2
  AND date <= $3
ORDER BY date ASC;

-- =============================================================================
-- VOLUME STATISTICS
-- =============================================================================

-- name: GetLatestVolumeStats :one
SELECT
    COUNT(DISTINCT v.volume_id) as total_volumes,
    COUNT(DISTINCT v.volume_id) FILTER (WHERE v.is_active = true) as active_volumes,
    COUNT(DISTINCT v.volume_id) FILTER (WHERE v.last_scan_at IS NOT NULL) as scanned_volumes,
    COALESCE(SUM(v.total_size_bytes), 0) as total_bytes,
    COALESCE(SUM((SELECT COUNT(*) FROM files f WHERE f.volume_id = v.volume_id AND f.is_dir = false)), 0) as total_files
FROM volumes v
WHERE ($1::text IS NULL OR v.volume_id = $1);

-- name: GetVolumeComparison :many
SELECT
    v.volume_id,
    v.display_name as name,
    COALESCE(v.total_size_bytes, 0) as total_bytes,
    COALESCE((SELECT COUNT(*) FROM files f WHERE f.volume_id = v.volume_id AND f.is_dir = false), 0) as total_files,
    v.last_scan_at as last_scanned,
    COALESCE(ds.growth_percent, 0) as growth_rate,
    COALESCE(ds.size_change_bytes, 0) as recent_change
FROM volumes v
LEFT JOIN LATERAL (
    SELECT growth_percent, size_change_bytes
    FROM daily_stats
    WHERE volume_id = v.volume_id
    ORDER BY date DESC
    LIMIT 1
) ds ON true
WHERE v.is_active = true
ORDER BY total_bytes DESC
LIMIT $1;

-- =============================================================================
-- DAILY STATS COMPUTATION
-- =============================================================================

-- name: ComputeVolumeDailyStats :exec
WITH current_stats AS (
    SELECT
        $1::text as volume_id,
        $2::date as date,
        COUNT(*) FILTER (WHERE is_dir = false) as total_files,
        SUM(size_bytes) as total_size
    FROM files
    WHERE volume_id = $1
),
previous_stats AS (
    SELECT
        total_files as prev_files,
        total_size_bytes as prev_size
    FROM daily_stats
    WHERE volume_id = $1
      AND date = $2::date - INTERVAL '1 day'
    LIMIT 1
),
file_changes AS (
    SELECT
        COUNT(*) FILTER (WHERE created_at::date = $2::date) as new_files,
        COUNT(*) FILTER (WHERE updated_at::date = $2::date AND created_at::date != $2::date) as modified_files
    FROM files
    WHERE volume_id = $1
)
INSERT INTO daily_stats (
    volume_id,
    date,
    total_size_bytes,
    total_files,
    size_change_bytes,
    growth_percent,
    new_files,
    modified_files,
    deleted_files
)
SELECT
    cs.volume_id,
    cs.date,
    cs.total_size,
    cs.total_files,
    cs.total_size - COALESCE(ps.prev_size, 0),
    CASE
        WHEN COALESCE(ps.prev_size, 0) > 0
        THEN ((cs.total_size - ps.prev_size)::float / ps.prev_size::float * 100)
        ELSE 0
    END,
    fc.new_files,
    fc.modified_files,
    GREATEST(0, COALESCE(ps.prev_files, 0) - cs.total_files)
FROM current_stats cs
CROSS JOIN file_changes fc
LEFT JOIN previous_stats ps ON true
ON CONFLICT (volume_id, date) DO UPDATE SET
    total_size_bytes = EXCLUDED.total_size_bytes,
    total_files = EXCLUDED.total_files,
    size_change_bytes = EXCLUDED.size_change_bytes,
    growth_percent = EXCLUDED.growth_percent,
    new_files = EXCLUDED.new_files,
    modified_files = EXCLUDED.modified_files,
    deleted_files = EXCLUDED.deleted_files,
    updated_at = CURRENT_TIMESTAMP;

-- name: GetMissingStatsDates :many
WITH date_range AS (
    SELECT generate_series(
        $2::date,
        $3::date,
        '1 day'::interval
    )::date as date
)
SELECT dr.date
FROM date_range dr
LEFT JOIN daily_stats ds ON ds.volume_id = $1 AND ds.date = dr.date
WHERE ds.id IS NULL
ORDER BY dr.date;

-- name: DeleteStatsForDate :exec
DELETE FROM daily_stats
WHERE volume_id = $1
  AND date = $2;

-- =============================================================================
-- CAPACITY PREDICTION
-- =============================================================================

-- name: GetCapacityPrediction :one
SELECT
    $1::text as volume_id,
    v.total_size_bytes as current_bytes,
    COALESCE(AVG(ds.size_change_bytes), 0)::bigint as avg_daily_growth,
    COALESCE(STDDEV(ds.size_change_bytes), 0)::bigint as growth_stddev,
    COUNT(ds.id)::bigint as data_points,
    (v.total_size_bytes + (COALESCE(AVG(ds.size_change_bytes), 0) * $3))::bigint as predicted_size,
    $3::int as days_ahead,
    CURRENT_TIMESTAMP as computed_at
FROM volumes v
LEFT JOIN daily_stats ds ON ds.volume_id = v.volume_id
    AND ds.date >= CURRENT_DATE - $2::int
    AND ds.size_change_bytes > 0
WHERE v.volume_id = $1
GROUP BY v.volume_id, v.total_size_bytes;

-- =============================================================================
-- MATERIALIZED VIEW REFRESH
-- =============================================================================

-- name: RefreshDailySummaryView :exec
-- This would refresh a materialized view if one existed
-- For now, this is a no-op that can be implemented when materialized views are added
SELECT 1;

-- =============================================================================
-- JOB MANAGEMENT
-- =============================================================================

-- name: CreateStatsJob :one
INSERT INTO stats_jobs (
    job_id,
    job_type,
    volume_id,
    status,
    progress,
    organization_id
) VALUES (
    $1, $2, $3, 'pending', 0, $4
) RETURNING *;

-- name: UpdateStatsJob :exec
UPDATE stats_jobs
SET
    status = $2,
    progress = $3,
    error_message = $4,
    updated_at = CURRENT_TIMESTAMP,
    completed_at = CASE WHEN $2 IN ('completed', 'failed', 'cancelled') THEN CURRENT_TIMESTAMP ELSE completed_at END,
    duration_ms = CASE WHEN $2 IN ('completed', 'failed', 'cancelled') THEN EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - started_at)) * 1000 ELSE duration_ms END
WHERE job_id = $1;

-- name: UpdateStatsJobProgress :exec
UPDATE stats_jobs
SET
    progress = $2,
    records_processed = $3,
    updated_at = CURRENT_TIMESTAMP
WHERE job_id = $1;

-- name: GetJobStatus :one
SELECT * FROM stats_jobs
WHERE job_id = $1;

-- name: GetJobStatusByID :one
SELECT * FROM stats_jobs
WHERE id = $1;

-- name: GetRecentJobs :many
SELECT * FROM stats_jobs
ORDER BY created_at DESC
LIMIT $1;

-- name: GetRecentJobsByType :many
SELECT * FROM stats_jobs
WHERE job_type = $1
ORDER BY created_at DESC
LIMIT $2;

-- name: GetJobMetrics :one
SELECT
    COUNT(*) as total_jobs,
    COUNT(*) FILTER (WHERE status = 'completed') as successful_jobs,
    COUNT(*) FILTER (WHERE status = 'failed') as failed_jobs,
    COUNT(*) FILTER (WHERE status = 'running') as running_jobs,
    COUNT(*) FILTER (WHERE status = 'pending') as pending_jobs,
    AVG(duration_ms) FILTER (WHERE status = 'completed')::bigint as avg_duration_ms,
    SUM(records_processed) as total_records_processed
FROM stats_jobs
WHERE job_type = $1
  AND created_at >= CURRENT_TIMESTAMP - ($2 || ' days')::interval;

-- name: CleanupOldJobs :exec
DELETE FROM stats_jobs
WHERE created_at < CURRENT_TIMESTAMP - ($1 || ' days')::interval
  AND status IN ('completed', 'failed', 'cancelled');

-- =============================================================================
-- VOLUME STATISTICS AGGREGATIONS
-- =============================================================================

-- name: GetVolumeStatsSummary :one
SELECT
    v.volume_id,
    v.display_name as name,
    COALESCE(v.total_size_bytes, 0) as total_bytes,
    COALESCE((SELECT COUNT(*) FROM files f WHERE f.volume_id = v.volume_id AND f.is_dir = false), 0) as total_files,
    v.last_scan_at as last_scanned,
    CASE
        WHEN v.is_active THEN 'active'::text
        ELSE 'inactive'::text
    END as status,
    COALESCE(latest.growth_percent, 0) as recent_growth_rate,
    COALESCE(latest.size_change_bytes, 0) as recent_size_change,
    COALESCE(latest.date, CURRENT_DATE) as latest_stats_date
FROM volumes v
LEFT JOIN LATERAL (
    SELECT date, growth_percent, size_change_bytes
    FROM daily_stats
    WHERE volume_id = v.volume_id
    ORDER BY date DESC
    LIMIT 1
) latest ON true
WHERE v.volume_id = $1;

-- name: GetHistoricalStats :many
SELECT
    date,
    total_size_bytes,
    total_files,
    size_change_bytes,
    growth_percent,
    new_files,
    deleted_files,
    modified_files,
    media_files,
    document_files,
    code_files,
    archive_files,
    other_files
FROM daily_stats
WHERE volume_id = $1
  AND date >= $2
  AND date <= $3
ORDER BY date ASC;
