-- Advanced Explorer queries with "Other" bucket calculations
-- Optimized for sub-150ms performance with proper indexing and consistent sums

-- =============================================================================
-- "OTHER" BUCKET CALCULATIONS
-- =============================================================================

-- name: GetDirectoryChildrenWithOtherBucket :many
-- Get top N children plus an "other" bucket with remaining items
-- Ensures sum consistency: top N + other = parent total
SELECT 
    entry_type,
    entry_id,
    name,
    full_path,
    size_bytes,
    file_count,
    depth,
    last_modified,
    inode,
    uid,
    gid,
    hidden,
    is_other_bucket
FROM (
    -- Top N children (directories and files)
    SELECT 
        'dir' as entry_type,
        dn.id::BIGINT as entry_id,
        dn.name,
        dn.full_path,
        COALESCE(dr.size_bytes, dn.latest_size_bytes) as size_bytes,
        COALESCE(dr.file_count, dn.latest_file_count) as file_count,
        dn.depth,
        dn.updated_at as last_modified,
        NULL::BIGINT as inode,
        NULL::INTEGER as uid,
        NULL::INTEGER as gid,
        false as hidden,
        false as is_other_bucket,
        ROW_NUMBER() OVER (ORDER BY COALESCE(dr.size_bytes, dn.latest_size_bytes) DESC, dn.name ASC) as rn
    FROM dir_nodes dn
    LEFT JOIN LATERAL (
        SELECT size_bytes, file_count 
        FROM dir_rollups dr 
        WHERE dr.dir_id = dn.id 
        ORDER BY dr.computed_at DESC 
        LIMIT 1
    ) dr ON true
    WHERE dn.volume_id = @volume_id 
      AND dn.parent_dir_id = @parent_dir_id

    UNION ALL

    SELECT 
        'file' as entry_type,
        fe.id::BIGINT as entry_id,
        fe.name,
        '' as full_path,
        fe.size_bytes,
        1 as file_count,
        0 as depth,
        fe.mtime as last_modified,
        fe.inode,
        fe.uid,
        fe.gid,
        fe.hidden,
        false as is_other_bucket,
        ROW_NUMBER() OVER (ORDER BY fe.size_bytes DESC, fe.name ASC) + 
            (SELECT COUNT(*) FROM dir_nodes WHERE volume_id = @volume_id AND parent_dir_id = @parent_dir_id) as rn
    FROM file_entries fe
    WHERE fe.volume_id = @volume_id 
      AND fe.parent_dir_id = @parent_dir_id
      AND fe.type = 'file'
) ranked_children
WHERE rn <= @top_n

UNION ALL

-- "Other" bucket aggregation
SELECT 
    'other' as entry_type,
    -1::BIGINT as entry_id,
    CASE 
        WHEN other_count = 1 THEN other_name
        ELSE '(' || other_count::TEXT || ' other items)'
    END as name,
    '' as full_path,
    other_total_size as size_bytes,
    other_total_files as file_count,
    0 as depth,
    CURRENT_TIMESTAMP as last_modified,
    NULL::BIGINT as inode,
    NULL::INTEGER as uid,
    NULL::INTEGER as gid,
    false as hidden,
    true as is_other_bucket
FROM (
    SELECT 
        SUM(size_bytes) as other_total_size,
        SUM(file_count) as other_total_files,
        COUNT(*) as other_count,
        MIN(name) as other_name -- For single item "other" bucket
    FROM (
        -- Directories not in top N
        SELECT 
            COALESCE(dr.size_bytes, dn.latest_size_bytes) as size_bytes,
            COALESCE(dr.file_count, dn.latest_file_count) as file_count,
            dn.name,
            ROW_NUMBER() OVER (ORDER BY COALESCE(dr.size_bytes, dn.latest_size_bytes) DESC, dn.name ASC) as rn
        FROM dir_nodes dn
        LEFT JOIN LATERAL (
            SELECT size_bytes, file_count 
            FROM dir_rollups dr 
            WHERE dr.dir_id = dn.id 
            ORDER BY dr.computed_at DESC 
            LIMIT 1
        ) dr ON true
        WHERE dn.volume_id = @volume_id 
          AND dn.parent_dir_id = @parent_dir_id

        UNION ALL

        -- Files not in top N  
        SELECT 
            fe.size_bytes,
            1 as file_count,
            fe.name,
            ROW_NUMBER() OVER (ORDER BY fe.size_bytes DESC, fe.name ASC) + 
                (SELECT COUNT(*) FROM dir_nodes WHERE volume_id = @volume_id AND parent_dir_id = @parent_dir_id) as rn
        FROM file_entries fe
        WHERE fe.volume_id = @volume_id 
          AND fe.parent_dir_id = @parent_dir_id
          AND fe.type = 'file'
    ) all_children
    WHERE rn > @top_n
) other_stats
WHERE other_count > 0

ORDER BY 
    is_other_bucket ASC,  -- Show regular items first, then "other"
    size_bytes DESC,
    name ASC;

-- name: CalculateOtherBucketStats :one
-- Calculate "other" bucket statistics for validation and UI display
-- Returns totals and counts for the "other" items not shown in top N
SELECT 
    total_items,
    top_n_items,
    other_items,
    total_size,
    top_n_size,
    other_size,
    total_files,
    top_n_files,
    other_files,
    -- Validate sum consistency
    (total_size = top_n_size + other_size) as size_sum_valid,
    (total_files = top_n_files + other_files) as files_sum_valid
FROM (
    SELECT 
        -- Total counts
        (SELECT COUNT(*) FROM (
            SELECT 1 FROM dir_nodes dn WHERE dn.volume_id = @volume_id AND dn.parent_dir_id = @parent_dir_id
            UNION ALL
            SELECT 1 FROM file_entries fe WHERE fe.volume_id = @volume_id AND fe.parent_dir_id = @parent_dir_id AND fe.type = 'file'
        ) all_items) as total_items,
        
        LEAST(@top_n, (SELECT COUNT(*) FROM (
            SELECT 1 FROM dir_nodes dn WHERE dn.volume_id = @volume_id AND dn.parent_dir_id = @parent_dir_id
            UNION ALL
            SELECT 1 FROM file_entries fe WHERE fe.volume_id = @volume_id AND fe.parent_dir_id = @parent_dir_id AND fe.type = 'file'
        ) all_items)) as top_n_items,
        
        GREATEST(0, (SELECT COUNT(*) FROM (
            SELECT 1 FROM dir_nodes dn WHERE dn.volume_id = @volume_id AND dn.parent_dir_id = @parent_dir_id
            UNION ALL
            SELECT 1 FROM file_entries fe WHERE fe.volume_id = @volume_id AND fe.parent_dir_id = @parent_dir_id AND fe.type = 'file'
        ) all_items) - @top_n) as other_items,
        
        -- Total size and files
        COALESCE((
            SELECT SUM(COALESCE(dr.size_bytes, dn.latest_size_bytes))
            FROM dir_nodes dn
            LEFT JOIN LATERAL (
                SELECT size_bytes FROM dir_rollups dr WHERE dr.dir_id = dn.id ORDER BY dr.computed_at DESC LIMIT 1
            ) dr ON true
            WHERE dn.volume_id = @volume_id AND dn.parent_dir_id = @parent_dir_id
        ), 0) + COALESCE((
            SELECT SUM(fe.size_bytes)
            FROM file_entries fe
            WHERE fe.volume_id = @volume_id AND fe.parent_dir_id = @parent_dir_id AND fe.type = 'file'
        ), 0) as total_size,
        
        COALESCE((
            SELECT SUM(COALESCE(dr.file_count, dn.latest_file_count))
            FROM dir_nodes dn
            LEFT JOIN LATERAL (
                SELECT file_count FROM dir_rollups dr WHERE dr.dir_id = dn.id ORDER BY dr.computed_at DESC LIMIT 1
            ) dr ON true
            WHERE dn.volume_id = @volume_id AND dn.parent_dir_id = @parent_dir_id
        ), 0) + COALESCE((
            SELECT COUNT(*)
            FROM file_entries fe
            WHERE fe.volume_id = @volume_id AND fe.parent_dir_id = @parent_dir_id AND fe.type = 'file'
        ), 0) as total_files,
        
        -- Top N size and files
        COALESCE((
            SELECT SUM(size_bytes) 
            FROM (
                SELECT COALESCE(dr.size_bytes, dn.latest_size_bytes) as size_bytes,
                       ROW_NUMBER() OVER (ORDER BY COALESCE(dr.size_bytes, dn.latest_size_bytes) DESC, dn.name ASC) as rn
                FROM dir_nodes dn
                LEFT JOIN LATERAL (
                    SELECT size_bytes FROM dir_rollups dr WHERE dr.dir_id = dn.id ORDER BY dr.computed_at DESC LIMIT 1
                ) dr ON true
                WHERE dn.volume_id = @volume_id AND dn.parent_dir_id = @parent_dir_id
                
                UNION ALL
                
                SELECT fe.size_bytes,
                       ROW_NUMBER() OVER (ORDER BY fe.size_bytes DESC, fe.name ASC) + 
                           (SELECT COUNT(*) FROM dir_nodes WHERE volume_id = @volume_id AND parent_dir_id = @parent_dir_id) as rn
                FROM file_entries fe
                WHERE fe.volume_id = @volume_id AND fe.parent_dir_id = @parent_dir_id AND fe.type = 'file'
            ) ranked
            WHERE rn <= @top_n
        ), 0) as top_n_size,
        
        COALESCE((
            SELECT SUM(file_count) 
            FROM (
                SELECT COALESCE(dr.file_count, dn.latest_file_count) as file_count,
                       ROW_NUMBER() OVER (ORDER BY COALESCE(dr.size_bytes, dn.latest_size_bytes) DESC, dn.name ASC) as rn
                FROM dir_nodes dn
                LEFT JOIN LATERAL (
                    SELECT size_bytes, file_count FROM dir_rollups dr WHERE dr.dir_id = dn.id ORDER BY dr.computed_at DESC LIMIT 1
                ) dr ON true
                WHERE dn.volume_id = @volume_id AND dn.parent_dir_id = @parent_dir_id
                
                UNION ALL
                
                SELECT 1 as file_count,
                       ROW_NUMBER() OVER (ORDER BY fe.size_bytes DESC, fe.name ASC) + 
                           (SELECT COUNT(*) FROM dir_nodes WHERE volume_id = @volume_id AND parent_dir_id = @parent_dir_id) as rn
                FROM file_entries fe
                WHERE fe.volume_id = @volume_id AND fe.parent_dir_id = @parent_dir_id AND fe.type = 'file'
            ) ranked
            WHERE rn <= @top_n
        ), 0) as top_n_files
) stats,
LATERAL (
    SELECT 
        (stats.total_size - stats.top_n_size) as other_size,
        (stats.total_files - stats.top_n_files) as other_files
) other_calc;

-- =============================================================================
-- PERFORMANCE OPTIMIZED HEAVY HITTERS WITH "OTHER"
-- =============================================================================

-- name: GetTopDirectoriesWithOther :many
-- Get top N directories by size with "other" bucket for remaining directories
SELECT 
    id,
    name,
    full_path,
    depth,
    size_bytes,
    file_count,
    last_updated,
    rollup_date,
    is_other_bucket
FROM (
    -- Top N directories
    SELECT 
        dn.id,
        dn.name,
        dn.full_path,
        dn.depth,
        COALESCE(dr.size_bytes, dn.latest_size_bytes) as size_bytes,
        COALESCE(dr.file_count, dn.latest_file_count) as file_count,
        dn.updated_at as last_updated,
        dr.computed_at as rollup_date,
        false as is_other_bucket,
        ROW_NUMBER() OVER (ORDER BY COALESCE(dr.size_bytes, dn.latest_size_bytes) DESC, dn.full_path ASC) as rn
    FROM dir_nodes dn
    LEFT JOIN LATERAL (
        SELECT size_bytes, file_count, computed_at
        FROM dir_rollups dr 
        WHERE dr.dir_id = dn.id 
        ORDER BY dr.computed_at DESC 
        LIMIT 1
    ) dr ON true
    WHERE dn.volume_id = @volume_id
      AND (@path_prefix::VARCHAR IS NULL OR dn.full_path LIKE @path_prefix || '%')
      AND (@min_size_bytes::BIGINT IS NULL OR COALESCE(dr.size_bytes, dn.latest_size_bytes) >= @min_size_bytes)
) ranked_dirs
WHERE rn <= @top_n

UNION ALL

-- "Other" bucket for remaining directories
SELECT 
    -1::BIGINT as id,
    CASE 
        WHEN other_count = 1 THEN '(' || other_name || ')'
        ELSE '(' || other_count::TEXT || ' other directories)'
    END as name,
    '' as full_path,
    0 as depth,
    other_total_size as size_bytes,
    other_total_files as file_count,
    CURRENT_TIMESTAMP as last_updated,
    NULL::TIMESTAMP as rollup_date,
    true as is_other_bucket
FROM (
    SELECT 
        SUM(COALESCE(dr.size_bytes, dn.latest_size_bytes)) as other_total_size,
        SUM(COALESCE(dr.file_count, dn.latest_file_count)) as other_total_files,
        COUNT(*) as other_count,
        MIN(dn.name) as other_name
    FROM dir_nodes dn
    LEFT JOIN LATERAL (
        SELECT size_bytes, file_count
        FROM dir_rollups dr 
        WHERE dr.dir_id = dn.id 
        ORDER BY dr.computed_at DESC 
        LIMIT 1
    ) dr ON true
    WHERE dn.volume_id = @volume_id
      AND (@path_prefix::VARCHAR IS NULL OR dn.full_path LIKE @path_prefix || '%')
      AND (@min_size_bytes::BIGINT IS NULL OR COALESCE(dr.size_bytes, dn.latest_size_bytes) >= @min_size_bytes)
      AND (ROW_NUMBER() OVER (ORDER BY COALESCE(dr.size_bytes, dn.latest_size_bytes) DESC, dn.full_path ASC)) > @top_n
) other_stats
WHERE other_count > 0

ORDER BY 
    is_other_bucket ASC,
    size_bytes DESC,
    full_path ASC;

-- name: GetTopFilesWithOther :many
-- Get top N files by size with "other" bucket for remaining files
SELECT 
    id,
    name,
    parent_dir_id,
    size_bytes,
    type,
    last_modified,
    hidden,
    uid,
    gid,
    parent_path,
    is_other_bucket
FROM (
    -- Top N files
    SELECT 
        fe.id,
        fe.name,
        fe.parent_dir_id,
        fe.size_bytes,
        fe.type,
        fe.mtime as last_modified,
        fe.hidden,
        fe.uid,
        fe.gid,
        dn.full_path as parent_path,
        false as is_other_bucket,
        ROW_NUMBER() OVER (ORDER BY fe.size_bytes DESC, fe.name ASC) as rn
    FROM file_entries fe
    LEFT JOIN dir_nodes dn ON fe.parent_dir_id = dn.id
    WHERE fe.volume_id = @volume_id
      AND fe.type = 'file'
      AND (@path_prefix::VARCHAR IS NULL OR dn.full_path LIKE @path_prefix || '%')
      AND (@min_size_bytes::BIGINT IS NULL OR fe.size_bytes >= @min_size_bytes)
      AND (@include_hidden::BOOLEAN IS NULL OR fe.hidden = @include_hidden)
) ranked_files
WHERE rn <= @top_n

UNION ALL

-- "Other" bucket for remaining files
SELECT 
    -1::BIGINT as id,
    CASE 
        WHEN other_count = 1 THEN '(' || other_name || ')'
        ELSE '(' || other_count::TEXT || ' other files)'
    END as name,
    NULL::BIGINT as parent_dir_id,
    other_total_size as size_bytes,
    'file' as type,
    CURRENT_TIMESTAMP as last_modified,
    false as hidden,
    NULL::INTEGER as uid,
    NULL::INTEGER as gid,
    '' as parent_path,
    true as is_other_bucket
FROM (
    SELECT 
        SUM(fe.size_bytes) as other_total_size,
        COUNT(*) as other_count,
        MIN(fe.name) as other_name
    FROM file_entries fe
    LEFT JOIN dir_nodes dn ON fe.parent_dir_id = dn.id
    WHERE fe.volume_id = @volume_id
      AND fe.type = 'file'
      AND (@path_prefix::VARCHAR IS NULL OR dn.full_path LIKE @path_prefix || '%')
      AND (@min_size_bytes::BIGINT IS NULL OR fe.size_bytes >= @min_size_bytes)
      AND (@include_hidden::BOOLEAN IS NULL OR fe.hidden = @include_hidden)
      AND (ROW_NUMBER() OVER (ORDER BY fe.size_bytes DESC, fe.name ASC)) > @top_n
) other_stats
WHERE other_count > 0

ORDER BY 
    is_other_bucket ASC,
    size_bytes DESC,
    name ASC;