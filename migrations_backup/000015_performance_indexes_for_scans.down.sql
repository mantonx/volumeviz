-- Rollback Performance Indexes for Scan Operations

-- Drop functions
DROP FUNCTION IF EXISTS get_unused_index_recommendations();
DROP FUNCTION IF EXISTS analyze_unenriched_files_performance(TEXT);
DROP FUNCTION IF EXISTS refresh_volume_enrichment_stats();

-- Drop views
DROP VIEW IF EXISTS index_usage_stats;
DROP MATERIALIZED VIEW IF EXISTS mv_volume_enrichment_stats;

-- Drop specialized enrichment indexes
DROP INDEX IF EXISTS idx_files_subtitle_distribution;
DROP INDEX IF EXISTS idx_files_codec_analysis;
DROP INDEX IF EXISTS idx_files_gps_content;
DROP INDEX IF EXISTS idx_files_hdr_content;

-- Drop volume and scan job performance indexes
DROP INDEX IF EXISTS idx_scan_jobs_volume_history;
DROP INDEX IF EXISTS idx_scan_jobs_active_monitoring;

-- Drop file system performance indexes
DROP INDEX IF EXISTS idx_files_path_lookup;
DROP INDEX IF EXISTS idx_folders_path_lookup;
DROP INDEX IF EXISTS idx_files_folder_volume_performance;
DROP INDEX IF EXISTS idx_folders_hierarchy_performance;

-- Drop scan progress tracking indexes
DROP INDEX IF EXISTS idx_scan_progress_items_active_tracking;
DROP INDEX IF EXISTS idx_scan_errors_recent_by_phase;
DROP INDEX IF EXISTS idx_scan_phases_comprehensive_progress;
DROP INDEX IF EXISTS idx_scan_phases_active_updates;

-- Drop file metadata indexes
DROP INDEX IF EXISTS idx_file_metadata_jsonb_resolution;
DROP INDEX IF EXISTS idx_file_metadata_jsonb_duration;
DROP INDEX IF EXISTS idx_file_metadata_volume_stats;
DROP INDEX IF EXISTS idx_file_metadata_bulk_insert;

-- Drop critical media enrichment indexes
DROP INDEX IF EXISTS idx_files_unenriched_count;
DROP INDEX IF EXISTS idx_files_unenriched_pagination;
DROP INDEX IF EXISTS idx_files_unenriched_optimized;