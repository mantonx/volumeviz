-- Enhanced Explorer queries for SQLite - feature parity with PostgreSQL
-- Uses subqueries and CTEs instead of LATERAL joins for SQLite compatibility

-- =============================================================================
-- DIRECTORY CHILDREN QUERIES (Drill-down navigation) 
-- =============================================================================

-- name: GetDirectoryChildren :many
-- Get immediate children (subdirectories and files) of a directory with rollup data
-- Returns mixed result set with directories first, then files
SELECT 
    'dir' as entry_type,
    dn.id as entry_id,
    dn.name,
    dn.full_path,
    COALESCE(
        (SELECT dr.size_bytes FROM dir_rollups dr 
         WHERE dr.dir_id = dn.id 
         ORDER BY dr.computed_at DESC LIMIT 1),
        dn.latest_size_bytes
    ) as size_bytes,
    COALESCE(
        (SELECT dr.file_count FROM dir_rollups dr 
         WHERE dr.dir_id = dn.id 
         ORDER BY dr.computed_at DESC LIMIT 1),
        dn.latest_file_count  
    ) as file_count,
    dn.depth,
    dn.updated_at as last_modified,
    NULL as inode,
    NULL as uid, 
    NULL as gid,
    0 as hidden
FROM dir_nodes dn
WHERE dn.volume_id = @volume_id 
  AND dn.parent_dir_id = @parent_dir_id
  AND (@min_size_bytes IS NULL OR 
       COALESCE((SELECT dr.size_bytes FROM dir_rollups dr WHERE dr.dir_id = dn.id ORDER BY dr.computed_at DESC LIMIT 1), dn.latest_size_bytes) >= @min_size_bytes)

UNION ALL

SELECT 
    'file' as entry_type,
    fe.id as entry_id,
    fe.name,
    '' as full_path, -- Files don't have full_path in this context
    fe.size_bytes,
    1 as file_count, -- Files always count as 1
    0 as depth, -- Files don't have depth  
    fe.mtime as last_modified,
    fe.inode,
    fe.uid,
    fe.gid,
    fe.hidden
FROM file_entries fe
WHERE fe.volume_id = @volume_id 
  AND fe.parent_dir_id = @parent_dir_id
  AND fe.type = 'file'
  AND (@min_size_bytes IS NULL OR fe.size_bytes >= @min_size_bytes)
  AND (@include_hidden IS NULL OR fe.hidden = @include_hidden)

ORDER BY 
    entry_type DESC, -- 'dir' comes before 'file' (directories first)
    size_bytes DESC, -- Largest first within each type
    name ASC; -- Deterministic secondary sort

-- name: GetDirectoryChildrenPaginated :many  
-- Paginated version for large directories with deterministic sorting
SELECT 
    'dir' as entry_type,
    dn.id as entry_id,
    dn.name,
    dn.full_path,
    COALESCE(
        (SELECT dr.size_bytes FROM dir_rollups dr 
         WHERE dr.dir_id = dn.id 
         ORDER BY dr.computed_at DESC LIMIT 1),
        dn.latest_size_bytes
    ) as size_bytes,
    COALESCE(
        (SELECT dr.file_count FROM dir_rollups dr 
         WHERE dr.dir_id = dn.id 
         ORDER BY dr.computed_at DESC LIMIT 1),
        dn.latest_file_count
    ) as file_count,
    dn.depth,
    dn.updated_at as last_modified,
    NULL as inode,
    NULL as uid,
    NULL as gid,
    0 as hidden
FROM dir_nodes dn
WHERE dn.volume_id = @volume_id 
  AND dn.parent_dir_id = @parent_dir_id

UNION ALL

SELECT 
    'file' as entry_type,
    fe.id as entry_id,
    fe.name,
    '' as full_path,
    fe.size_bytes,
    1 as file_count,
    0 as depth,
    fe.mtime as last_modified,
    fe.inode,
    fe.uid,
    fe.gid,
    fe.hidden
FROM file_entries fe
WHERE fe.volume_id = @volume_id 
  AND fe.parent_dir_id = @parent_dir_id
  AND fe.type = 'file'

ORDER BY 
    entry_type DESC,
    size_bytes DESC,
    name ASC
LIMIT @limit_count OFFSET @offset_count;

-- name: GetDirectoryChildrenCount :one
-- Get total count of children for pagination
SELECT 
    (SELECT COUNT(*) FROM dir_nodes dn WHERE dn.volume_id = @volume_id AND dn.parent_dir_id = @parent_dir_id) +
    (SELECT COUNT(*) FROM file_entries fe WHERE fe.volume_id = @volume_id AND fe.parent_dir_id = @parent_dir_id AND fe.type = 'file') 
    as total_count;

-- =============================================================================
-- ROOT LEVEL QUERIES (Volume root navigation)
-- =============================================================================

-- name: GetVolumeRootChildren :many
-- Get top-level directories and files in a volume (parent_dir_id IS NULL)
SELECT 
    'dir' as entry_type,
    dn.id as entry_id,
    dn.name,
    dn.full_path,
    COALESCE(
        (SELECT dr.size_bytes FROM dir_rollups dr 
         WHERE dr.dir_id = dn.id 
         ORDER BY dr.computed_at DESC LIMIT 1),
        dn.latest_size_bytes
    ) as size_bytes,
    COALESCE(
        (SELECT dr.file_count FROM dir_rollups dr 
         WHERE dr.dir_id = dn.id 
         ORDER BY dr.computed_at DESC LIMIT 1),
        dn.latest_file_count
    ) as file_count,
    dn.depth,
    dn.updated_at as last_modified,
    NULL as inode,
    NULL as uid,
    NULL as gid,
    0 as hidden
FROM dir_nodes dn
WHERE dn.volume_id = @volume_id 
  AND dn.parent_dir_id IS NULL

UNION ALL

SELECT 
    'file' as entry_type,
    fe.id as entry_id,
    fe.name,
    '' as full_path,
    fe.size_bytes,
    1 as file_count,
    0 as depth,
    fe.mtime as last_modified,
    fe.inode,
    fe.uid,
    fe.gid,
    fe.hidden
FROM file_entries fe
WHERE fe.volume_id = @volume_id 
  AND fe.parent_dir_id IS NULL
  AND fe.type = 'file'

ORDER BY 
    entry_type DESC,
    size_bytes DESC,
    name ASC
LIMIT @limit_count;

-- =============================================================================
-- TOP-N HEAVY HITTERS QUERIES
-- =============================================================================

-- name: GetTopDirectoriesBySize :many
-- Get top N largest directories in a volume with rollup data
SELECT 
    dn.id,
    dn.name,
    dn.full_path,
    dn.depth,
    COALESCE(
        (SELECT dr.size_bytes FROM dir_rollups dr 
         WHERE dr.dir_id = dn.id 
         ORDER BY dr.computed_at DESC LIMIT 1),
        dn.latest_size_bytes
    ) as size_bytes,
    COALESCE(
        (SELECT dr.file_count FROM dir_rollups dr 
         WHERE dr.dir_id = dn.id 
         ORDER BY dr.computed_at DESC LIMIT 1),
        dn.latest_file_count
    ) as file_count,
    dn.updated_at as last_updated,
    (SELECT dr.computed_at FROM dir_rollups dr 
     WHERE dr.dir_id = dn.id 
     ORDER BY dr.computed_at DESC LIMIT 1) as rollup_date
FROM dir_nodes dn
WHERE dn.volume_id = @volume_id
  AND (@path_prefix IS NULL OR dn.full_path LIKE @path_prefix || '%') -- Path prefix filter
  AND (@min_size_bytes IS NULL OR 
       COALESCE((SELECT dr.size_bytes FROM dir_rollups dr WHERE dr.dir_id = dn.id ORDER BY dr.computed_at DESC LIMIT 1), dn.latest_size_bytes) >= @min_size_bytes) -- Min size filter
ORDER BY 
    COALESCE((SELECT dr.size_bytes FROM dir_rollups dr WHERE dr.dir_id = dn.id ORDER BY dr.computed_at DESC LIMIT 1), dn.latest_size_bytes) DESC,
    dn.full_path ASC -- Deterministic secondary sort
LIMIT @limit_count;

-- name: GetTopFilesBySize :many
-- Get top N largest files in a volume
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
    dn.full_path as parent_path
FROM file_entries fe
LEFT JOIN dir_nodes dn ON fe.parent_dir_id = dn.id
WHERE fe.volume_id = @volume_id
  AND fe.type = 'file'
  AND (@path_prefix IS NULL OR dn.full_path LIKE @path_prefix || '%') -- Path prefix filter  
  AND (@min_size_bytes IS NULL OR fe.size_bytes >= @min_size_bytes) -- Min size filter
  AND (@include_hidden IS NULL OR fe.hidden = @include_hidden) -- Hidden filter
ORDER BY 
    fe.size_bytes DESC,
    fe.name ASC -- Deterministic secondary sort
LIMIT @limit_count;

-- name: GetTopFilesByCount :many
-- Get directories with the most files (useful for identifying directories with many small files)
SELECT 
    dn.id,
    dn.name,
    dn.full_path,
    dn.depth,
    COALESCE(
        (SELECT dr.size_bytes FROM dir_rollups dr 
         WHERE dr.dir_id = dn.id 
         ORDER BY dr.computed_at DESC LIMIT 1),
        dn.latest_size_bytes
    ) as size_bytes,
    COALESCE(
        (SELECT dr.file_count FROM dir_rollups dr 
         WHERE dr.dir_id = dn.id 
         ORDER BY dr.computed_at DESC LIMIT 1),
        dn.latest_file_count
    ) as file_count,
    -- Calculate average file size
    CASE 
        WHEN COALESCE((SELECT dr.file_count FROM dir_rollups dr WHERE dr.dir_id = dn.id ORDER BY dr.computed_at DESC LIMIT 1), dn.latest_file_count) > 0 
        THEN COALESCE((SELECT dr.size_bytes FROM dir_rollups dr WHERE dr.dir_id = dn.id ORDER BY dr.computed_at DESC LIMIT 1), dn.latest_size_bytes) / 
             COALESCE((SELECT dr.file_count FROM dir_rollups dr WHERE dr.dir_id = dn.id ORDER BY dr.computed_at DESC LIMIT 1), dn.latest_file_count)
        ELSE 0 
    END as avg_file_size,
    dn.updated_at as last_updated
FROM dir_nodes dn
WHERE dn.volume_id = @volume_id
  AND (@path_prefix IS NULL OR dn.full_path LIKE @path_prefix || '%') -- Path prefix filter
  AND (@min_file_count IS NULL OR 
       COALESCE((SELECT dr.file_count FROM dir_rollups dr WHERE dr.dir_id = dn.id ORDER BY dr.computed_at DESC LIMIT 1), dn.latest_file_count) >= @min_file_count) -- Min file count
ORDER BY 
    COALESCE((SELECT dr.file_count FROM dir_rollups dr WHERE dr.dir_id = dn.id ORDER BY dr.computed_at DESC LIMIT 1), dn.latest_file_count) DESC,
    dn.full_path ASC
LIMIT @limit_count;

-- =============================================================================
-- SUMMARY AND "OTHER" BUCKET CALCULATIONS
-- =============================================================================

-- name: GetDirectorySummary :one
-- Get summary statistics for a directory including "other" calculations
-- Used for showing Top-N + "Other" bucket in UI
SELECT 
    dn.id,
    dn.name,
    dn.full_path,
    dn.parent_dir_id,
    COALESCE(
        (SELECT dr.size_bytes FROM dir_rollups dr 
         WHERE dr.dir_id = dn.id 
         ORDER BY dr.computed_at DESC LIMIT 1),
        dn.latest_size_bytes
    ) as total_size,
    COALESCE(
        (SELECT dr.file_count FROM dir_rollups dr 
         WHERE dr.dir_id = dn.id 
         ORDER BY dr.computed_at DESC LIMIT 1),
        dn.latest_file_count
    ) as total_files,
    (SELECT COUNT(*) FROM dir_nodes WHERE parent_dir_id = dn.id) as subdirectory_count,
    (SELECT COUNT(*) FROM file_entries WHERE parent_dir_id = dn.id AND type = 'file') as direct_file_count
FROM dir_nodes dn
WHERE dn.volume_id = @volume_id AND dn.id = @dir_id;

-- name: GetTopNChildrenWithOther :many
-- Get top N children with "other" bucket calculation
-- Returns top N directories and files with consistent sorting
SELECT 
    'dir' as entry_type,
    dn.id as entry_id,
    dn.name,
    dn.full_path,
    COALESCE(
        (SELECT dr.size_bytes FROM dir_rollups dr 
         WHERE dr.dir_id = dn.id 
         ORDER BY dr.computed_at DESC LIMIT 1),
        dn.latest_size_bytes
    ) as size_bytes,
    COALESCE(
        (SELECT dr.file_count FROM dir_rollups dr 
         WHERE dr.dir_id = dn.id 
         ORDER BY dr.computed_at DESC LIMIT 1),
        dn.latest_file_count
    ) as file_count
FROM dir_nodes dn
WHERE dn.volume_id = @volume_id AND dn.parent_dir_id = @parent_dir_id

UNION ALL

SELECT 
    'file' as entry_type,
    fe.id as entry_id,
    fe.name,
    '' as full_path,
    fe.size_bytes,
    1 as file_count
FROM file_entries fe
WHERE fe.volume_id = @volume_id 
  AND fe.parent_dir_id = @parent_dir_id
  AND fe.type = 'file'

ORDER BY 
    size_bytes DESC,
    name ASC
LIMIT @limit_count;

-- =============================================================================
-- PATH-BASED NAVIGATION QUERIES  
-- =============================================================================

-- name: GetDirectoryByPath :one
-- Find a directory by its full path
SELECT 
    id,
    name,
    full_path,
    parent_dir_id,
    depth,
    latest_size_bytes,
    latest_file_count,
    updated_at
FROM dir_nodes 
WHERE volume_id = @volume_id AND full_path = @full_path;

-- name: GetDirectoryHierarchy :many
-- Get the full hierarchy path from root to a specific directory
-- Returns all ancestor directories in order from root to target
WITH RECURSIVE hierarchy AS (
    -- Base case: the target directory
    SELECT 
        dn.id, dn.parent_dir_id, dn.name, dn.full_path, dn.depth, 0 as level
    FROM dir_nodes dn 
    WHERE dn.volume_id = @volume_id AND dn.id = @dir_id
    
    UNION ALL
    
    -- Recursive case: find parent directories
    SELECT 
        dn.id, dn.parent_dir_id, dn.name, dn.full_path, dn.depth, h.level + 1
    FROM dir_nodes dn
    JOIN hierarchy h ON dn.id = h.parent_dir_id
    WHERE dn.volume_id = @volume_id
)
SELECT 
    id,
    parent_dir_id,
    name,
    full_path,
    depth
FROM hierarchy 
ORDER BY level DESC; -- Root first, target last

-- =============================================================================
-- SEARCH AND FILTER QUERIES
-- =============================================================================

-- name: SearchFilesByName :many
-- Search for files by name pattern (supports LIKE patterns)
SELECT 
    fe.id,
    fe.name,
    fe.size_bytes,
    fe.type,
    fe.mtime as last_modified,
    fe.hidden,
    dn.full_path as parent_path,
    dn.name as parent_name
FROM file_entries fe
LEFT JOIN dir_nodes dn ON fe.parent_dir_id = dn.id
WHERE fe.volume_id = @volume_id
  AND fe.name LIKE @name_pattern COLLATE NOCASE -- Case-insensitive pattern matching
  AND (@file_type IS NULL OR fe.type = @file_type) -- Type filter
  AND (@min_size_bytes IS NULL OR fe.size_bytes >= @min_size_bytes) -- Min size filter
ORDER BY 
    fe.size_bytes DESC,
    fe.name ASC
LIMIT @limit_count;

-- name: SearchDirectoriesByName :many
-- Search for directories by name pattern
SELECT 
    dn.id,
    dn.name,
    dn.full_path,
    dn.depth,
    COALESCE(
        (SELECT dr.size_bytes FROM dir_rollups dr 
         WHERE dr.dir_id = dn.id 
         ORDER BY dr.computed_at DESC LIMIT 1),
        dn.latest_size_bytes
    ) as size_bytes,
    COALESCE(
        (SELECT dr.file_count FROM dir_rollups dr 
         WHERE dr.dir_id = dn.id 
         ORDER BY dr.computed_at DESC LIMIT 1),
        dn.latest_file_count
    ) as file_count
FROM dir_nodes dn
WHERE dn.volume_id = @volume_id
  AND dn.name LIKE @name_pattern COLLATE NOCASE -- Case-insensitive pattern matching  
  AND (@max_depth IS NULL OR dn.depth <= @max_depth) -- Max depth filter
ORDER BY 
    COALESCE((SELECT dr.size_bytes FROM dir_rollups dr WHERE dr.dir_id = dn.id ORDER BY dr.computed_at DESC LIMIT 1), dn.latest_size_bytes) DESC,
    dn.full_path ASC
LIMIT @limit_count;

-- =============================================================================
-- DIRECTORY TREE QUERIES
-- =============================================================================

-- name: GetDirectoryTree :many
-- Get directory tree with optional depth limiting for SQLite
WITH RECURSIVE dir_tree AS (
    -- Base case: start with root directories
    SELECT d.id, d.volume_id, d.parent_dir_id, d.name, d.full_path, d.depth, d.latest_size_bytes, d.latest_file_count, d.created_at, d.updated_at
    FROM dir_nodes d
    WHERE d.volume_id = @volume_id AND d.parent_dir_id IS NULL
    
    UNION ALL
    
    -- Recursive case: get children
    SELECT d.id, d.volume_id, d.parent_dir_id, d.name, d.full_path, d.depth, d.latest_size_bytes, d.latest_file_count, d.created_at, d.updated_at
    FROM dir_nodes d
    INNER JOIN dir_tree dt ON d.parent_dir_id = dt.id
    WHERE d.volume_id = dt.volume_id AND d.depth <= @max_depth  -- Limit depth to prevent runaway queries
)
SELECT id, volume_id, parent_dir_id, name, full_path, depth, latest_size_bytes, latest_file_count, created_at, updated_at
FROM dir_tree
ORDER BY depth, full_path;