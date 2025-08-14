-- Daily Stats Queries
-- Purpose: Analytics and trend tracking for volumes, folders, and media kinds

-- name: CreateDailyStat :one
INSERT INTO stats_daily (
    date, volume_id, folder_id, media_kind,
    files_count, total_bytes, added_bytes, removed_bytes,
    added_files, removed_files, computed_at, scan_id, job_duration_ms
) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13
) ON CONFLICT (date, volume_id, folder_id, media_kind) 
DO UPDATE SET
    files_count = EXCLUDED.files_count,
    total_bytes = EXCLUDED.total_bytes,
    added_bytes = EXCLUDED.added_bytes,
    removed_bytes = EXCLUDED.removed_bytes,
    added_files = EXCLUDED.added_files,
    removed_files = EXCLUDED.removed_files,
    computed_at = EXCLUDED.computed_at,
    scan_id = EXCLUDED.scan_id,
    job_duration_ms = EXCLUDED.job_duration_ms
RETURNING id, computed_at;

-- name: GetDailyStatsForDate :many
SELECT * FROM stats_daily 
WHERE volume_id = $1 AND date = $2
ORDER BY 
    CASE WHEN folder_id IS NULL THEN 0 ELSE 1 END, -- Volume-level first
    CASE WHEN media_kind IS NULL THEN 0 ELSE 1 END, -- All-media first
    folder_id NULLS FIRST,
    media_kind NULLS FIRST;

-- name: GetVolumeStatsHistory :many
SELECT * FROM stats_daily 
WHERE volume_id = $1 
    AND date >= $2 
    AND date <= $3
    AND folder_id IS NULL -- Volume-level only
ORDER BY date DESC, media_kind NULLS FIRST;

-- name: GetFolderGrowthTrends :many
SELECT 
    sd.folder_id,
    f.name as folder_name,
    f.path as folder_path,
    sd.date,
    sd.total_bytes,
    sd.files_count,
    sd.added_bytes,
    sd.removed_bytes,
    sd.added_files,
    sd.removed_files
FROM stats_daily sd
JOIN folders f ON f.id = sd.folder_id
WHERE sd.volume_id = $1
    AND sd.date >= $2
    AND sd.folder_id IS NOT NULL
    AND sd.media_kind IS NULL -- Folder totals
ORDER BY sd.date DESC, sd.added_bytes DESC
LIMIT $3;

-- name: GetTopGrowingFolders :many
SELECT 
    sd.folder_id,
    f.name as folder_name,
    f.path as folder_path,
    SUM(sd.added_bytes) as total_added_bytes,
    SUM(sd.added_files) as total_added_files,
    AVG(sd.added_bytes) as avg_daily_added_bytes,
    COUNT(*) as days_tracked
FROM stats_daily sd
JOIN folders f ON f.id = sd.folder_id
WHERE sd.volume_id = $1
    AND sd.date >= $2
    AND sd.folder_id IS NOT NULL
    AND sd.media_kind IS NULL
    AND sd.added_bytes > 0
GROUP BY sd.folder_id, f.name, f.path
ORDER BY total_added_bytes DESC
LIMIT $3;

-- name: GetMediaKindComposition :many
SELECT 
    sd.media_kind,
    sd.date,
    sd.files_count,
    sd.total_bytes,
    -- Calculate percentage of volume total
    ROUND((sd.total_bytes * 100.0 / NULLIF(vol.total_bytes, 0))::numeric, 2) as percent_of_volume
FROM stats_daily sd
JOIN (
    SELECT vt.date, vt.volume_id, vt.total_bytes 
    FROM stats_daily vt
    WHERE vt.volume_id = $1 AND vt.folder_id IS NULL AND vt.media_kind IS NULL
) vol ON vol.date = sd.date AND vol.volume_id = sd.volume_id
WHERE sd.volume_id = $1
    AND sd.date >= $2
    AND sd.date <= $3
    AND sd.folder_id IS NULL
    AND sd.media_kind IS NOT NULL
ORDER BY sd.date DESC, sd.total_bytes DESC;

-- name: GetTrendAnalysis :many
SELECT 
    date,
    volume_id,
    folder_id,
    media_kind,
    files_count,
    total_bytes,
    added_bytes,
    removed_bytes,
    bytes_change_7d,
    files_change_7d,
    bytes_change_30d,
    files_change_30d,
    bytes_growth_rate_7d,
    bytes_growth_rate_30d,
    computed_at
FROM stats_daily_trends
WHERE volume_id = $1 
    AND date >= $2 
    AND date <= $3
ORDER BY date DESC;

-- name: GetLatestVolumeStats :one
SELECT * FROM stats_daily
WHERE volume_id = $1 
    AND folder_id IS NULL 
    AND media_kind IS NULL
ORDER BY date DESC
LIMIT 1;

-- name: ComputeVolumeDailyStats :exec
-- Compute daily aggregates for a volume on a specific date
WITH folder_stats AS (
    SELECT 
        f.id as folder_id,
        COALESCE(f.media_kind, 'other') as media_kind,
        COUNT(fi.id) as files_count,
        COALESCE(SUM(fi.size_bytes), 0) as total_bytes
    FROM folders f
    LEFT JOIN files fi ON fi.folder_id = f.id
    WHERE f.volume_id = $1
    GROUP BY f.id, f.media_kind
),
volume_totals AS (
    SELECT 
        NULL::BIGINT as folder_id,
        NULL::TEXT as media_kind,
        SUM(files_count) as files_count,
        SUM(total_bytes) as total_bytes
    FROM folder_stats
    UNION ALL
    SELECT 
        folder_id,
        NULL::TEXT as media_kind,
        files_count,
        total_bytes
    FROM folder_stats
    UNION ALL
    SELECT 
        NULL::BIGINT as folder_id,
        media_kind,
        SUM(files_count) as files_count,
        SUM(total_bytes) as total_bytes
    FROM folder_stats
    GROUP BY media_kind
),
previous_day_stats AS (
    SELECT 
        folder_id,
        media_kind,
        files_count as prev_files_count,
        total_bytes as prev_total_bytes
    FROM stats_daily
    WHERE volume_id = $1 AND date = $2 - INTERVAL '1 day'
)
INSERT INTO stats_daily (
    date, volume_id, folder_id, media_kind,
    files_count, total_bytes, added_bytes, removed_bytes,
    added_files, removed_files, computed_at, scan_id
)
SELECT 
    $2::DATE,
    $1,
    vt.folder_id,
    vt.media_kind,
    vt.files_count,
    vt.total_bytes,
    GREATEST(0, vt.total_bytes - COALESCE(prev.prev_total_bytes, 0)) as added_bytes,
    GREATEST(0, COALESCE(prev.prev_total_bytes, 0) - vt.total_bytes) as removed_bytes,
    GREATEST(0, vt.files_count - COALESCE(prev.prev_files_count, 0)) as added_files,
    GREATEST(0, COALESCE(prev.prev_files_count, 0) - vt.files_count) as removed_files,
    NOW(),
    $3
FROM volume_totals vt
LEFT JOIN previous_day_stats prev ON (
    prev.folder_id IS NOT DISTINCT FROM vt.folder_id
    AND prev.media_kind IS NOT DISTINCT FROM vt.media_kind
)
ON CONFLICT (date, volume_id, folder_id, media_kind) 
DO UPDATE SET
    files_count = EXCLUDED.files_count,
    total_bytes = EXCLUDED.total_bytes,
    added_bytes = EXCLUDED.added_bytes,
    removed_bytes = EXCLUDED.removed_bytes,
    added_files = EXCLUDED.added_files,
    removed_files = EXCLUDED.removed_files,
    computed_at = EXCLUDED.computed_at,
    scan_id = EXCLUDED.scan_id;

-- name: GetMissingStatsDates :many
-- Find dates that are missing stats for a volume within a date range
SELECT generate_series($2::date, $3::date, interval '1 day')::date as missing_date
EXCEPT 
SELECT DISTINCT date 
FROM stats_daily 
WHERE volume_id = $1 
    AND date >= $2 
    AND date <= $3
    AND folder_id IS NULL 
    AND media_kind IS NULL;

-- name: DeleteStatsForDate :exec
DELETE FROM stats_daily 
WHERE volume_id = $1 AND date = $2;

-- name: RefreshDailySummaryView :exec
REFRESH MATERIALIZED VIEW stats_daily_summary;

-- Job tracking queries

-- name: CreateStatsJob :one
INSERT INTO stats_jobs (
    job_type, volume_id, started_at, status
) VALUES ($1, $2, $3, $4)
RETURNING id;

-- name: UpdateStatsJob :exec
UPDATE stats_jobs SET
    completed_at = $2,
    duration_ms = $3,
    status = $4,
    error_message = $5,
    processed_dates = $6,
    records_created = $7,
    records_updated = $8
WHERE id = $1;

-- name: GetJobStatus :one
SELECT * FROM stats_jobs WHERE id = $1;

-- name: GetRecentJobs :many
SELECT * FROM stats_jobs
WHERE job_type = $1
    AND ($2::TEXT IS NULL OR volume_id = $2)
ORDER BY started_at DESC
LIMIT $3;

-- name: GetJobMetrics :one
SELECT 
    COUNT(*) as total_jobs,
    COUNT(CASE WHEN status = 'completed' THEN 1 END) as successful_jobs,
    COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_jobs,
    AVG(duration_ms) FILTER (WHERE status = 'completed') as avg_duration_ms,
    MAX(started_at) as last_job_started,
    MAX(completed_at) FILTER (WHERE status = 'completed') as last_success
FROM stats_jobs
WHERE job_type = $1
    AND started_at >= $2;