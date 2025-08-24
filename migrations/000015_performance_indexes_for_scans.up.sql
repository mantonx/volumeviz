-- Performance Indexes for Scan Operations
-- Optimizes critical queries used during large volume scans

-- =======================================
-- Critical Indexes for Media Enrichment
-- =======================================

-- Optimize GetUnenrichedFiles queries (most critical for media enrichment performance)
-- This compound index covers the main filtering conditions for unenriched files
CREATE INDEX IF NOT EXISTS idx_files_unenriched_optimized ON files(volume_id, mime) 
WHERE (
    -- Video/audio files missing duration or codec info
    (mime LIKE 'video/%' OR mime LIKE 'audio/%') AND (duration_ms IS NULL OR video_codec IS NULL OR audio_codec IS NULL)
    OR
    -- Image files missing dimensions or EXIF data
    mime LIKE 'image/%' AND (width IS NULL OR height IS NULL OR capture_datetime IS NULL)
    OR
    -- Subtitle files missing subtitle info
    mime IN ('text/vtt', 'application/x-subrip', 'text/x-ssa', 'text/x-ass') AND subtitle_language IS NULL
);

-- Specialized index for pagination performance on large result sets
CREATE INDEX IF NOT EXISTS idx_files_unenriched_pagination ON files(volume_id, size_bytes DESC, id)
WHERE mime IN (
    'video/mp4', 'video/x-msvideo', 'video/x-matroska', 'video/quicktime', 'video/x-ms-wmv', 'video/x-flv', 'video/webm',
    'audio/mpeg', 'audio/flac', 'audio/wav', 'audio/aac', 'audio/ogg', 'audio/mp4',
    'image/jpeg', 'image/png', 'image/tiff', 'image/bmp', 'image/webp', 'image/heic',
    'text/vtt', 'application/x-subrip', 'text/x-ssa', 'text/x-ass'
) AND (
    (mime LIKE 'video/%' OR mime LIKE 'audio/%') AND (duration_ms IS NULL OR video_codec IS NULL OR audio_codec IS NULL)
    OR
    mime LIKE 'image/%' AND (width IS NULL OR height IS NULL OR capture_datetime IS NULL)
    OR
    mime IN ('text/vtt', 'application/x-subrip', 'text/x-ssa', 'text/x-ass') AND subtitle_language IS NULL
);

-- Count index for GetUnenrichedFileCount performance
CREATE INDEX IF NOT EXISTS idx_files_unenriched_count ON files(volume_id)
WHERE mime IN (
    'video/mp4', 'video/x-msvideo', 'video/x-matroska', 'video/quicktime', 'video/x-ms-wmv', 'video/x-flv', 'video/webm',
    'audio/mpeg', 'audio/flac', 'audio/wav', 'audio/aac', 'audio/ogg', 'audio/mp4',
    'image/jpeg', 'image/png', 'image/tiff', 'image/bmp', 'image/webp', 'image/heic',
    'text/vtt', 'application/x-subrip', 'text/x-ssa', 'text/x-ass'
) AND (
    (mime LIKE 'video/%' OR mime LIKE 'audio/%') AND (duration_ms IS NULL OR video_codec IS NULL OR audio_codec IS NULL)
    OR
    mime LIKE 'image/%' AND (width IS NULL OR height IS NULL OR capture_datetime IS NULL)
    OR
    mime IN ('text/vtt', 'application/x-subrip', 'text/x-ssa', 'text/x-ass') AND subtitle_language IS NULL
);

-- =======================================
-- Optimized File Metadata Indexes
-- =======================================

-- Bulk insert performance for file_metadata during enrichment streaming
CREATE INDEX IF NOT EXISTS idx_file_metadata_bulk_insert ON file_metadata(file_id, kind, enriched_at);

-- File metadata lookup by volume (for progress tracking)
CREATE INDEX IF NOT EXISTS idx_file_metadata_volume_stats ON file_metadata(kind, enriched_at)
WHERE kind IN ('video', 'audio', 'image', 'subtitle');

-- JSONB query optimization for detailed metadata searches
CREATE INDEX IF NOT EXISTS idx_file_metadata_jsonb_duration ON file_metadata USING GIN (data_json)
WHERE kind IN ('video', 'audio');

CREATE INDEX IF NOT EXISTS idx_file_metadata_jsonb_resolution ON file_metadata USING GIN (data_json)
WHERE kind IN ('video', 'image');

-- =======================================
-- Scan Progress Tracking Indexes
-- =======================================

-- Critical for frequent progress updates during scans
CREATE INDEX IF NOT EXISTS idx_scan_phases_active_updates ON scan_phases(scan_id, phase_name, updated_at)
WHERE status IN ('pending', 'running');

-- Progress query optimization for real-time WebSocket updates
CREATE INDEX IF NOT EXISTS idx_scan_phases_comprehensive_progress ON scan_phases(scan_id, phase_order, status, progress)
WHERE status != 'skipped';

-- Error tracking during intensive scan phases
CREATE INDEX IF NOT EXISTS idx_scan_errors_recent_by_phase ON scan_errors(scan_id, phase_name, occurred_at DESC, severity);

-- Progress items tracking for detailed scan monitoring
CREATE INDEX IF NOT EXISTS idx_scan_progress_items_active_tracking ON scan_progress_items(scan_id, phase_name, status, updated_at)
WHERE status IN ('pending', 'processing');

-- =======================================
-- File System Performance Indexes
-- =======================================

-- Folder tree traversal optimization (used during filesystem indexing)
CREATE INDEX IF NOT EXISTS idx_folders_hierarchy_performance ON folders(parent_id, depth, size_bytes_recursive DESC)
WHERE parent_id IS NOT NULL;

-- File folder relationship for bulk operations
CREATE INDEX IF NOT EXISTS idx_files_folder_volume_performance ON files(folder_id, volume_id, size_bytes DESC);

-- Path-based lookups during filesystem scanning
CREATE INDEX IF NOT EXISTS idx_folders_path_lookup ON folders(volume_id, path);
CREATE INDEX IF NOT EXISTS idx_files_path_lookup ON files(volume_id, path);

-- =======================================
-- Volume and Scan Job Performance
-- =======================================

-- Active scan monitoring
CREATE INDEX IF NOT EXISTS idx_scan_jobs_active_monitoring ON scan_jobs(status, current_phase, updated_at)
WHERE status IN ('queued', 'scanning', 'running');

-- Volume scan history and metrics
CREATE INDEX IF NOT EXISTS idx_scan_jobs_volume_history ON scan_jobs(volume_id, completed_at DESC, status)
WHERE completed_at IS NOT NULL;

-- =======================================
-- Specialized Enrichment Indexes
-- =======================================

-- HDR content queries (becomes important for large media libraries)
CREATE INDEX IF NOT EXISTS idx_files_hdr_content ON files(volume_id, hdr_format, width DESC, height DESC)
WHERE hdr_format != 'none';

-- GPS-enabled content queries
CREATE INDEX IF NOT EXISTS idx_files_gps_content ON files(volume_id, capture_datetime DESC)
WHERE gps_latitude IS NOT NULL AND gps_longitude IS NOT NULL;

-- Audio/Video codec distribution analysis
CREATE INDEX IF NOT EXISTS idx_files_codec_analysis ON files(volume_id, video_codec, audio_codec, duration_ms DESC)
WHERE duration_ms IS NOT NULL;

-- Subtitle language distribution
CREATE INDEX IF NOT EXISTS idx_files_subtitle_distribution ON files(volume_id, subtitle_language, cue_count)
WHERE subtitle_language IS NOT NULL;

-- =======================================
-- Performance Views for Complex Queries
-- =======================================

-- Materialized view for expensive enrichment statistics (refreshed periodically)
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_volume_enrichment_stats AS
SELECT 
    v.volume_id,
    v.name as volume_name,
    COUNT(f.id) as total_files,
    COUNT(f.id) FILTER (WHERE f.duration_ms IS NOT NULL OR f.capture_datetime IS NOT NULL OR f.subtitle_language IS NOT NULL) as enriched_files,
    COUNT(f.id) FILTER (WHERE f.mime LIKE 'video/%') as video_files,
    COUNT(f.id) FILTER (WHERE f.mime LIKE 'audio/%') as audio_files,
    COUNT(f.id) FILTER (WHERE f.mime LIKE 'image/%') as image_files,
    COUNT(f.id) FILTER (WHERE f.subtitle_language IS NOT NULL) as subtitle_files,
    COALESCE(SUM(f.duration_ms) / 1000.0 / 3600.0, 0) as total_duration_hours,
    COUNT(f.id) FILTER (WHERE f.hdr_format != 'none') as hdr_files,
    COUNT(f.id) FILTER (WHERE f.gps_latitude IS NOT NULL AND f.gps_longitude IS NOT NULL) as gps_files,
    MAX(f.updated_at) as last_updated
FROM volumes v
LEFT JOIN files f ON v.volume_id = f.volume_id
GROUP BY v.volume_id, v.name;

-- Index on the materialized view for fast lookups
CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_volume_enrichment_stats_volume_id ON mv_volume_enrichment_stats(volume_id);
CREATE INDEX IF NOT EXISTS idx_mv_volume_enrichment_stats_enrichment_ratio ON mv_volume_enrichment_stats((enriched_files::float / NULLIF(total_files, 0)) DESC);

-- Function to refresh the materialized view (can be called after large enrichment operations)
CREATE OR REPLACE FUNCTION refresh_volume_enrichment_stats() RETURNS VOID AS $$
BEGIN
    REFRESH MATERIALIZED VIEW mv_volume_enrichment_stats;
END;
$$ LANGUAGE plpgsql;

-- =======================================
-- Query Analysis and Statistics
-- =======================================

-- Function to analyze GetUnenrichedFiles performance
CREATE OR REPLACE FUNCTION analyze_unenriched_files_performance(p_volume_id TEXT DEFAULT NULL)
RETURNS TABLE (
    volume_id TEXT,
    total_files BIGINT,
    video_unenriched BIGINT,
    audio_unenriched BIGINT, 
    image_unenriched BIGINT,
    subtitle_unenriched BIGINT,
    estimated_enrichment_time_hours DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        f.volume_id,
        COUNT(*) as total_files,
        COUNT(*) FILTER (WHERE f.mime LIKE 'video/%' AND (f.duration_ms IS NULL OR f.video_codec IS NULL)) as video_unenriched,
        COUNT(*) FILTER (WHERE f.mime LIKE 'audio/%' AND (f.duration_ms IS NULL OR f.audio_codec IS NULL)) as audio_unenriched,
        COUNT(*) FILTER (WHERE f.mime LIKE 'image/%' AND (f.width IS NULL OR f.height IS NULL OR f.capture_datetime IS NULL)) as image_unenriched,
        COUNT(*) FILTER (WHERE f.mime IN ('text/vtt', 'application/x-subrip', 'text/x-ssa', 'text/x-ass') AND f.subtitle_language IS NULL) as subtitle_unenriched,
        -- Estimate enrichment time based on file types (video: 2s, audio: 1s, image: 0.5s, subtitle: 0.1s)
        ROUND(
            (COUNT(*) FILTER (WHERE f.mime LIKE 'video/%' AND (f.duration_ms IS NULL OR f.video_codec IS NULL)) * 2.0 +
             COUNT(*) FILTER (WHERE f.mime LIKE 'audio/%' AND (f.duration_ms IS NULL OR f.audio_codec IS NULL)) * 1.0 +
             COUNT(*) FILTER (WHERE f.mime LIKE 'image/%' AND (f.width IS NULL OR f.height IS NULL OR f.capture_datetime IS NULL)) * 0.5 +
             COUNT(*) FILTER (WHERE f.mime IN ('text/vtt', 'application/x-subrip', 'text/x-ssa', 'text/x-ass') AND f.subtitle_language IS NULL) * 0.1
            ) / 3600.0, 2
        ) as estimated_enrichment_time_hours
    FROM files f
    WHERE (p_volume_id IS NULL OR f.volume_id = p_volume_id)
    AND f.mime IN (
        'video/mp4', 'video/x-msvideo', 'video/x-matroska', 'video/quicktime', 'video/x-ms-wmv', 'video/x-flv', 'video/webm',
        'audio/mpeg', 'audio/flac', 'audio/wav', 'audio/aac', 'audio/ogg', 'audio/mp4',
        'image/jpeg', 'image/png', 'image/tiff', 'image/bmp', 'image/webp', 'image/heic',
        'text/vtt', 'application/x-subrip', 'text/x-ssa', 'text/x-ass'
    )
    GROUP BY f.volume_id;
END;
$$ LANGUAGE plpgsql;

-- =======================================
-- Index Monitoring and Maintenance
-- =======================================

-- View to monitor index usage and effectiveness
CREATE OR REPLACE VIEW index_usage_stats AS
SELECT 
    schemaname,
    relname as tablename,
    indexrelname as indexname,
    idx_scan,
    idx_tup_read,
    idx_tup_fetch,
    pg_size_pretty(pg_relation_size(indexrelid)) as index_size
FROM pg_stat_user_indexes 
WHERE schemaname = 'public'
AND relname IN ('files', 'file_metadata', 'scan_phases', 'scan_progress_items', 'scan_errors', 'folders')
ORDER BY idx_scan DESC, idx_tup_read DESC;

-- Function to get recommendations for unused indexes (run periodically)
CREATE OR REPLACE FUNCTION get_unused_index_recommendations()
RETURNS TABLE (
    schema_name TEXT,
    table_name TEXT,
    index_name TEXT,
    index_size TEXT,
    scans BIGINT,
    tuples_read BIGINT,
    recommendation TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        schemaname::TEXT,
        relname::TEXT as table_name,
        indexrelname::TEXT as index_name,
        pg_size_pretty(pg_relation_size(indexrelid))::TEXT,
        idx_scan,
        idx_tup_read,
        CASE 
            WHEN idx_scan = 0 THEN 'Consider dropping - never used'
            WHEN idx_scan < 10 AND pg_relation_size(indexrelid) > 1024*1024 THEN 'Consider dropping - rarely used and large'
            WHEN idx_tup_read / GREATEST(idx_scan, 1) < 2 THEN 'Review usage - low efficiency'
            ELSE 'Keep - good usage pattern'
        END::TEXT as recommendation
    FROM pg_stat_user_indexes 
    WHERE schemaname = 'public'
    AND relname IN ('files', 'file_metadata', 'scan_phases', 'scan_progress_items', 'scan_errors', 'folders')
    ORDER BY 
        CASE 
            WHEN idx_scan = 0 THEN 1
            WHEN idx_scan < 10 AND pg_relation_size(indexrelid) > 1024*1024 THEN 2
            ELSE 3
        END,
        pg_relation_size(indexrelid) DESC;
END;
$$ LANGUAGE plpgsql;