-- Create aggregate cache table for storing computed aggregate results
CREATE TABLE IF NOT EXISTS aggregate_cache (
    id SERIAL PRIMARY KEY,
    volume_id VARCHAR(255) NOT NULL,
    path VARCHAR(4096) NOT NULL,
    max_depth INT NOT NULL,
    stat_type VARCHAR(50) NOT NULL,
    bucket_type VARCHAR(50),
    cache_key VARCHAR(255) GENERATED ALWAYS AS (
        MD5(CONCAT(volume_id, path, max_depth, stat_type, COALESCE(bucket_type, '')))
    ) STORED,
    result JSONB NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    hit_count INT DEFAULT 0,
    UNIQUE(cache_key)
);

-- Create indexes for efficient cache lookups
CREATE INDEX IF NOT EXISTS idx_aggregate_cache_key ON aggregate_cache(cache_key);
CREATE INDEX IF NOT EXISTS idx_aggregate_cache_expires ON aggregate_cache(expires_at);
CREATE INDEX IF NOT EXISTS idx_aggregate_cache_volume ON aggregate_cache(volume_id);

-- Create partial indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_files_volume_type_size 
ON files(volume_id, type, size) 
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_files_volume_parent_path 
ON files(volume_id, parent_path) 
WHERE deleted_at IS NULL;

-- Create materialized view for folder statistics
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_folder_stats AS
SELECT 
    volume_id,
    parent_path,
    COUNT(*) as item_count,
    SUM(CASE WHEN type = 'file' THEN size ELSE 0 END) as total_size,
    COUNT(CASE WHEN type = 'file' THEN 1 END) as file_count,
    COUNT(CASE WHEN type = 'directory' THEN 1 END) as dir_count,
    MAX(modified) as last_modified,
    MIN(created) as first_created
FROM files
WHERE deleted_at IS NULL
GROUP BY volume_id, parent_path;

-- Create index on materialized view
CREATE INDEX IF NOT EXISTS idx_mv_folder_stats_lookup 
ON mv_folder_stats(volume_id, parent_path);

-- Create function to refresh materialized view
CREATE OR REPLACE FUNCTION refresh_folder_stats()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_folder_stats;
END;
$$ LANGUAGE plpgsql;

-- Add comment for documentation
COMMENT ON TABLE aggregate_cache IS 'Cache for storing pre-computed aggregate file system data for visualizations';
COMMENT ON MATERIALIZED VIEW mv_folder_stats IS 'Pre-aggregated folder statistics for fast retrieval';