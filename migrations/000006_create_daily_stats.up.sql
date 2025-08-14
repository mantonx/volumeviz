-- Migration: Create daily stats tracking
-- Purpose: Track daily aggregates and deltas for analytics and trend analysis

-- Daily stats table for tracking growth, churn, and composition
CREATE TABLE IF NOT EXISTS stats_daily (
    id BIGSERIAL PRIMARY KEY,
    
    -- Dimensions
    date DATE NOT NULL,
    volume_id TEXT NOT NULL,
    folder_id BIGINT NULL, -- NULL for volume-level aggregates
    media_kind TEXT NULL, -- NULL for all-media aggregates
    
    -- Current state metrics
    files_count BIGINT NOT NULL DEFAULT 0,
    total_bytes BIGINT NOT NULL DEFAULT 0,
    
    -- Delta metrics (changes since previous day)
    added_bytes BIGINT NOT NULL DEFAULT 0,
    removed_bytes BIGINT NOT NULL DEFAULT 0,
    added_files BIGINT NOT NULL DEFAULT 0,
    removed_files BIGINT NOT NULL DEFAULT 0,
    
    -- Processing metadata
    computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    scan_id TEXT NULL, -- Link to scan that generated this data
    job_duration_ms BIGINT NULL, -- Time taken to compute
    
    -- Ensure uniqueness per dimension combination
    CONSTRAINT stats_daily_unique_dimension 
        UNIQUE (date, volume_id, folder_id, media_kind),
    
    -- Foreign key constraints
    CONSTRAINT fk_stats_daily_volume 
        FOREIGN KEY (volume_id) REFERENCES volumes(id) ON DELETE CASCADE,
    CONSTRAINT fk_stats_daily_folder 
        FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE CASCADE
);

-- Indexes for efficient querying

-- Primary query patterns: by volume + date range
CREATE INDEX IF NOT EXISTS idx_stats_daily_volume_date 
    ON stats_daily (volume_id, date DESC);

-- Folder-level trends
CREATE INDEX IF NOT EXISTS idx_stats_daily_folder_date 
    ON stats_daily (folder_id, date DESC) 
    WHERE folder_id IS NOT NULL;

-- Media kind analysis
CREATE INDEX IF NOT EXISTS idx_stats_daily_media_kind 
    ON stats_daily (volume_id, media_kind, date DESC) 
    WHERE media_kind IS NOT NULL;

-- Growth analysis - top growing folders
CREATE INDEX IF NOT EXISTS idx_stats_daily_growth 
    ON stats_daily (date DESC, added_bytes DESC) 
    WHERE folder_id IS NOT NULL AND added_bytes > 0;

-- Latest stats lookup
CREATE INDEX IF NOT EXISTS idx_stats_daily_latest 
    ON stats_daily (volume_id, computed_at DESC);

-- Job monitoring index
CREATE INDEX IF NOT EXISTS idx_stats_daily_job_monitoring 
    ON stats_daily (computed_at DESC, job_duration_ms) 
    WHERE scan_id IS NOT NULL;

-- Create a view for easy trend calculations
CREATE OR REPLACE VIEW stats_daily_trends AS
SELECT 
    s.date,
    s.volume_id,
    s.folder_id,
    s.media_kind,
    s.files_count,
    s.total_bytes,
    s.added_bytes,
    s.removed_bytes,
    s.added_files,
    s.removed_files,
    
    -- 7-day trend calculations
    s.total_bytes - COALESCE(s7.total_bytes, 0) as bytes_change_7d,
    s.files_count - COALESCE(s7.files_count, 0) as files_change_7d,
    
    -- 30-day trend calculations  
    s.total_bytes - COALESCE(s30.total_bytes, 0) as bytes_change_30d,
    s.files_count - COALESCE(s30.files_count, 0) as files_change_30d,
    
    -- Growth rates (percentage)
    CASE 
        WHEN COALESCE(s7.total_bytes, 0) > 0 
        THEN ROUND(((s.total_bytes - s7.total_bytes) * 100.0 / s7.total_bytes)::numeric, 2)
        ELSE NULL 
    END as bytes_growth_rate_7d,
    
    CASE 
        WHEN COALESCE(s30.total_bytes, 0) > 0 
        THEN ROUND(((s.total_bytes - s30.total_bytes) * 100.0 / s30.total_bytes)::numeric, 2)
        ELSE NULL 
    END as bytes_growth_rate_30d,
    
    s.computed_at
FROM stats_daily s
LEFT JOIN stats_daily s7 ON (
    s7.volume_id = s.volume_id 
    AND s7.folder_id IS NOT DISTINCT FROM s.folder_id
    AND s7.media_kind IS NOT DISTINCT FROM s.media_kind
    AND s7.date = s.date - INTERVAL '7 days'
)
LEFT JOIN stats_daily s30 ON (
    s30.volume_id = s.volume_id 
    AND s30.folder_id IS NOT DISTINCT FROM s.folder_id
    AND s30.media_kind IS NOT DISTINCT FROM s.media_kind
    AND s30.date = s.date - INTERVAL '30 days'
);

-- Create materialized view for performance on large datasets
CREATE MATERIALIZED VIEW IF NOT EXISTS stats_daily_summary AS
SELECT 
    date,
    volume_id,
    -- Volume totals (folder_id IS NULL, media_kind IS NULL)
    SUM(CASE WHEN folder_id IS NULL AND media_kind IS NULL THEN files_count ELSE 0 END) as volume_files_total,
    SUM(CASE WHEN folder_id IS NULL AND media_kind IS NULL THEN total_bytes ELSE 0 END) as volume_bytes_total,
    SUM(CASE WHEN folder_id IS NULL AND media_kind IS NULL THEN added_bytes ELSE 0 END) as volume_added_bytes,
    SUM(CASE WHEN folder_id IS NULL AND media_kind IS NULL THEN removed_bytes ELSE 0 END) as volume_removed_bytes,
    
    -- Media kind breakdown counts
    COUNT(CASE WHEN folder_id IS NULL AND media_kind IS NOT NULL THEN 1 END) as media_kinds_tracked,
    COUNT(CASE WHEN folder_id IS NOT NULL AND media_kind IS NULL THEN 1 END) as folders_tracked,
    
    -- Aggregation metadata
    MAX(computed_at) as last_computed_at,
    COUNT(*) as total_stats_rows
FROM stats_daily
GROUP BY date, volume_id;

-- Index for materialized view
CREATE UNIQUE INDEX IF NOT EXISTS idx_stats_daily_summary_pk 
    ON stats_daily_summary (date, volume_id);

-- Job status tracking table
CREATE TABLE IF NOT EXISTS stats_jobs (
    id BIGSERIAL PRIMARY KEY,
    job_type TEXT NOT NULL, -- 'scan_completion', 'nightly_reconcile', 'backfill'
    volume_id TEXT NULL, -- NULL for global jobs
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ NULL,
    duration_ms BIGINT NULL,
    status TEXT NOT NULL DEFAULT 'running', -- 'running', 'completed', 'failed'
    error_message TEXT NULL,
    processed_dates INT DEFAULT 0, -- Number of dates processed
    records_created INT DEFAULT 0,
    records_updated INT DEFAULT 0,
    
    CONSTRAINT fk_stats_jobs_volume 
        FOREIGN KEY (volume_id) REFERENCES volumes(id) ON DELETE CASCADE
);

-- Index for job monitoring
CREATE INDEX IF NOT EXISTS idx_stats_jobs_monitoring 
    ON stats_jobs (job_type, status, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_stats_jobs_volume 
    ON stats_jobs (volume_id, started_at DESC) 
    WHERE volume_id IS NOT NULL;