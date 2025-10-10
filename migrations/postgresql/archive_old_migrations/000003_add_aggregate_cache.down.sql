-- Drop function
DROP FUNCTION IF EXISTS refresh_folder_stats();

-- Drop materialized view
DROP MATERIALIZED VIEW IF EXISTS mv_folder_stats;

-- Drop indexes
DROP INDEX IF EXISTS idx_aggregate_cache_key;
DROP INDEX IF EXISTS idx_aggregate_cache_expires;
DROP INDEX IF EXISTS idx_aggregate_cache_volume;
DROP INDEX IF EXISTS idx_files_volume_type_size;
DROP INDEX IF EXISTS idx_files_volume_parent_path;
DROP INDEX IF EXISTS idx_mv_folder_stats_lookup;

-- Drop cache table
DROP TABLE IF EXISTS aggregate_cache;