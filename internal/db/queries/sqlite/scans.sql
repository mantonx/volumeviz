-- =============================================================================
-- SCAN-RELATED QUERIES CONSOLIDATED
-- Consolidated from: file_entries.sql, dir_nodes.sql, dir_rollups.sql, explorer.sql
-- SQLite-compatible version
-- =============================================================================

-- =============================================================================
-- FILE ENTRIES QUERIES
-- =============================================================================

-- name: GetFileEntry :one
SELECT id, volume_id, parent_dir_id, name, size_bytes, mtime, ctime, inode, uid, gid, type, hidden, path_hash, created_at, updated_at
FROM file_entries 
WHERE id = ? AND volume_id = ?;

-- name: GetFileEntriesByVolumeAndParent :many
SELECT id, volume_id, parent_dir_id, name, size_bytes, mtime, ctime, inode, uid, gid, type, hidden, path_hash, created_at, updated_at
FROM file_entries 
WHERE volume_id = ? AND parent_dir_id = ?
ORDER BY name ASC;

-- name: GetLargestFiles :many
SELECT id, volume_id, parent_dir_id, name, size_bytes, mtime, ctime, inode, uid, gid, type, hidden, path_hash, created_at, updated_at
FROM file_entries 
WHERE volume_id = ? AND type = 'file'
ORDER BY size_bytes DESC
LIMIT ?;

-- name: FindFilesByPathHash :many
SELECT id, volume_id, parent_dir_id, name, size_bytes, mtime, ctime, inode, uid, gid, type, hidden, path_hash, created_at, updated_at
FROM file_entries 
WHERE volume_id = ? AND path_hash = ?;

-- name: CreateFileEntry :one
INSERT INTO file_entries (
    volume_id, parent_dir_id, name, size_bytes, mtime, ctime, 
    inode, uid, gid, type, hidden, path_hash
) VALUES (
    ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
) RETURNING id, volume_id, parent_dir_id, name, size_bytes, mtime, ctime, inode, uid, gid, type, hidden, path_hash, created_at, updated_at;

-- name: BulkInsertFileEntries :copyfrom
INSERT INTO file_entries (
    volume_id, parent_dir_id, name, size_bytes, mtime, ctime, 
    inode, uid, gid, type, hidden, path_hash
) VALUES (
    ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
);

-- name: UpsertFileEntry :one
INSERT INTO file_entries (
    volume_id, parent_dir_id, name, size_bytes, mtime, ctime, 
    inode, uid, gid, type, hidden, path_hash
) VALUES (
    ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
) ON CONFLICT(volume_id, path_hash) DO UPDATE SET
    parent_dir_id = EXCLUDED.parent_dir_id,
    name = EXCLUDED.name,
    size_bytes = EXCLUDED.size_bytes,
    mtime = EXCLUDED.mtime,
    ctime = EXCLUDED.ctime,
    inode = EXCLUDED.inode,
    uid = EXCLUDED.uid,
    gid = EXCLUDED.gid,
    type = EXCLUDED.type,
    hidden = EXCLUDED.hidden,
    updated_at = datetime('now')
RETURNING id, volume_id, parent_dir_id, name, size_bytes, mtime, ctime, inode, uid, gid, type, hidden, path_hash, created_at, updated_at;

-- name: DeleteFileEntriesByVolume :exec
DELETE FROM file_entries WHERE volume_id = ?;

-- name: CountFileEntriesByVolume :one
SELECT COUNT(*) FROM file_entries WHERE volume_id = ?;

-- name: GetVolumeFileStats :one
SELECT 
    COUNT(*) as total_files,
    COALESCE(SUM(size_bytes), 0) as total_size,
    SUM(CASE WHEN type = 'file' THEN 1 ELSE 0 END) as regular_files,
    SUM(CASE WHEN type = 'dir' THEN 1 ELSE 0 END) as directories,
    SUM(CASE WHEN hidden = true THEN 1 ELSE 0 END) as hidden_files
FROM file_entries 
WHERE volume_id = ?;

-- =============================================================================
-- DIRECTORY NODES QUERIES
-- =============================================================================

-- name: GetDirNode :one
SELECT id, volume_id, parent_dir_id, name, full_path, depth, latest_size_bytes, latest_file_count, created_at, updated_at
FROM dir_nodes 
WHERE id = ? AND volume_id = ?;

-- name: GetDirNodeByPath :one
SELECT id, volume_id, parent_dir_id, name, full_path, depth, latest_size_bytes, latest_file_count, created_at, updated_at
FROM dir_nodes 
WHERE volume_id = ? AND full_path = ?;

-- name: GetChildDirNodes :many
SELECT id, volume_id, parent_dir_id, name, full_path, depth, latest_size_bytes, latest_file_count, created_at, updated_at
FROM dir_nodes 
WHERE volume_id = ? AND parent_dir_id = ?
ORDER BY name ASC;

-- name: GetRootDirNodes :many
SELECT id, volume_id, parent_dir_id, name, full_path, depth, latest_size_bytes, latest_file_count, created_at, updated_at
FROM dir_nodes 
WHERE volume_id = ? AND parent_dir_id IS NULL
ORDER BY name ASC;

-- name: GetLargestDirectories :many
SELECT id, volume_id, parent_dir_id, name, full_path, depth, latest_size_bytes, latest_file_count, created_at, updated_at
FROM dir_nodes 
WHERE volume_id = ?
ORDER BY latest_size_bytes DESC
LIMIT ?;

-- name: CreateDirNode :one
INSERT INTO dir_nodes (
    volume_id, parent_dir_id, name, full_path, depth, 
    latest_size_bytes, latest_file_count
) VALUES (
    ?, ?, ?, ?, ?, ?, ?
) RETURNING id, volume_id, parent_dir_id, name, full_path, depth, latest_size_bytes, latest_file_count, created_at, updated_at;

-- name: BulkInsertDirNodes :copyfrom
INSERT INTO dir_nodes (
    volume_id, parent_dir_id, name, full_path, depth, 
    latest_size_bytes, latest_file_count
) VALUES (
    ?, ?, ?, ?, ?, ?, ?
);

-- name: UpsertDirNode :one
INSERT INTO dir_nodes (
    volume_id, parent_dir_id, name, full_path, depth, 
    latest_size_bytes, latest_file_count
) VALUES (
    ?, ?, ?, ?, ?, ?, ?
) ON CONFLICT(volume_id, full_path) DO UPDATE SET
    parent_dir_id = EXCLUDED.parent_dir_id,
    name = EXCLUDED.name,
    depth = EXCLUDED.depth,
    latest_size_bytes = EXCLUDED.latest_size_bytes,
    latest_file_count = EXCLUDED.latest_file_count,
    updated_at = datetime('now')
RETURNING id, volume_id, parent_dir_id, name, full_path, depth, latest_size_bytes, latest_file_count, created_at, updated_at;

-- name: UpdateDirNodeStats :exec
UPDATE dir_nodes 
SET latest_size_bytes = ?, latest_file_count = ?, updated_at = datetime('now') 
WHERE id = ? AND volume_id = ?;

-- name: DeleteDirNodesByVolume :exec
DELETE FROM dir_nodes WHERE volume_id = ?;

-- name: CountDirNodesByVolume :one
SELECT COUNT(*) FROM dir_nodes WHERE volume_id = ?;

-- =============================================================================
-- DIRECTORY ROLLUPS QUERIES
-- =============================================================================

-- name: GetDirRollup :one
SELECT id, dir_id, size_bytes, file_count, computed_at, created_at
FROM dir_rollups 
WHERE id = ?;

-- name: GetLatestDirRollup :one
SELECT id, dir_id, size_bytes, file_count, computed_at, created_at
FROM dir_rollups 
WHERE dir_id = ?
ORDER BY computed_at DESC
LIMIT 1;

-- name: GetDirRollupHistory :many
SELECT id, dir_id, size_bytes, file_count, computed_at, created_at
FROM dir_rollups 
WHERE dir_id = ?
ORDER BY computed_at DESC
LIMIT ?;

-- name: GetDirRollupsInTimeRange :many
SELECT id, dir_id, size_bytes, file_count, computed_at, created_at
FROM dir_rollups 
WHERE dir_id = ? AND computed_at >= ? AND computed_at <= ?
ORDER BY computed_at DESC;

-- name: CreateDirRollup :one
INSERT INTO dir_rollups (
    dir_id, size_bytes, file_count, computed_at
) VALUES (
    ?, ?, ?, ?
) RETURNING id, dir_id, size_bytes, file_count, computed_at, created_at;

-- name: BulkInsertDirRollups :copyfrom
INSERT INTO dir_rollups (
    dir_id, size_bytes, file_count, computed_at
) VALUES (
    ?, ?, ?, ?
);

-- name: DeleteOldRollups :exec
DELETE FROM dir_rollups WHERE computed_at < ?;

-- name: DeleteRollupsByDirId :exec
DELETE FROM dir_rollups WHERE dir_id = ?;

-- name: CountRollupsByDirId :one
SELECT COUNT(*) FROM dir_rollups WHERE dir_id = ?;

-- name: GetRollupStats :one
SELECT 
    COUNT(*) as total_rollups,
    COUNT(DISTINCT dir_id) as directories_with_rollups,
    MIN(computed_at) as oldest_rollup,
    MAX(computed_at) as newest_rollup
FROM dir_rollups;

-- =============================================================================
-- EXPLORER QUERIES (Drill-down navigation and heavy hitters analysis)
-- Optimized for sub-150ms performance with proper indexing
-- =============================================================================

-- =============================================================================
-- DIRECTORY CHILDREN QUERIES (Drill-down navigation)
-- =============================================================================

-- name: GetDirectoryChildren :many
-- Get immediate children (subdirectories and files) of a directory with rollup data
-- Returns mixed result set with directories first (from rollups), then files
-- Uses UNION ALL for optimal performance with deterministic sorting
-- Note: SQLite doesn't support named parameters with @ syntax, using positional parameters
SELECT 
    'dir' as entry_type,
    dn.id as entry_id,
    dn.name,
    dn.full_path,
    COALESCE(dr.size_bytes, dn.latest_size_bytes) as size_bytes,
    COALESCE(dr.file_count, dn.latest_file_count) as file_count,
    dn.depth,
    dn.updated_at as last_modified,
    NULL as inode,
    NULL as uid,
    NULL as gid,
    0 as hidden
FROM dir_nodes dn
WHERE dn.volume_id = ? 
  AND dn.parent_dir_id = ?
  AND (? IS NULL OR dn.latest_size_bytes >= ?)

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
WHERE fe.volume_id = ? 
  AND fe.parent_dir_id = ?
  AND fe.type = 'file'
  AND (? IS NULL OR fe.size_bytes >= ?)
  AND (? IS NULL OR fe.hidden = ?)

ORDER BY 
    entry_type DESC, -- 'dir' comes before 'file' (directories first)
    size_bytes DESC, -- Largest first within each type
    name ASC; -- Deterministic secondary sort

-- name: GetDirectoryChildrenPaginated :many
-- Paginated version for large directories
-- Uses deterministic sorting for consistent pagination
SELECT 
    'dir' as entry_type,
    dn.id as entry_id,
    dn.name,
    dn.full_path,
    COALESCE(dr.size_bytes, dn.latest_size_bytes) as size_bytes,
    COALESCE(dr.file_count, dn.latest_file_count) as file_count,
    dn.depth,
    dn.updated_at as last_modified,
    NULL as inode,
    NULL as uid,
    NULL as gid,
    0 as hidden
FROM dir_nodes dn
LEFT JOIN (
    SELECT dir_id, size_bytes, file_count 
    FROM dir_rollups dr1
    WHERE dr1.computed_at = (
        SELECT MAX(dr2.computed_at) 
        FROM dir_rollups dr2 
        WHERE dr2.dir_id = dr1.dir_id
    )
) AS dr ON dr.dir_id = dn.id
WHERE dn.volume_id = ? 
  AND dn.parent_dir_id = ?

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
WHERE fe.volume_id = ? 
  AND fe.parent_dir_id = ?
  AND fe.type = 'file'

ORDER BY 
    entry_type DESC,
    size_bytes DESC,
    name ASC
LIMIT ? OFFSET ?;

-- name: GetDirectoryChildrenCount :one
-- Get total count of children for pagination
SELECT 
    (SELECT COUNT(*) FROM dir_nodes dn WHERE dn.volume_id = ? AND dn.parent_dir_id = ?) +
    (SELECT COUNT(*) FROM file_entries fe WHERE fe.volume_id = ? AND fe.parent_dir_id = ? AND fe.type = 'file') 
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
    COALESCE(dr.size_bytes, dn.latest_size_bytes) as size_bytes,
    COALESCE(dr.file_count, dn.latest_file_count) as file_count,
    dn.depth,
    dn.updated_at as last_modified,
    NULL as inode,
    NULL as uid,
    NULL as gid,
    0 as hidden
FROM dir_nodes dn
LEFT JOIN (
    SELECT dir_id, size_bytes, file_count 
    FROM dir_rollups dr1
    WHERE dr1.computed_at = (
        SELECT MAX(dr2.computed_at) 
        FROM dir_rollups dr2 
        WHERE dr2.dir_id = dr1.dir_id
    )
) AS dr ON dr.dir_id = dn.id
WHERE dn.volume_id = ? 
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
WHERE fe.volume_id = ? 
  AND fe.parent_dir_id IS NULL
  AND fe.type = 'file'

ORDER BY 
    entry_type DESC,
    size_bytes DESC,
    name ASC
LIMIT ?;

-- =============================================================================
-- TOP-N HEAVY HITTERS QUERIES
-- =============================================================================

-- name: GetTopDirectoriesBySize :many
-- Get top N largest directories in a volume
-- Uses latest rollup data where available, falls back to dir_nodes data
-- Note: SQLite doesn't support named parameters with @ syntax, using positional parameters
SELECT 
    dn.id,
    dn.name,
    dn.full_path,
    dn.depth,
    dn.latest_size_bytes as size_bytes,
    dn.latest_file_count as file_count,
    dn.updated_at as last_updated,
    dn.updated_at as rollup_date
FROM dir_nodes dn
WHERE dn.volume_id = ?
  AND (? IS NULL OR dn.full_path LIKE ? || '%') -- Path prefix filter
  AND (? IS NULL OR dn.latest_size_bytes >= ?) -- Min size filter
ORDER BY 
    dn.latest_size_bytes DESC,
    dn.full_path ASC -- Deterministic secondary sort
LIMIT ?;

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
WHERE fe.volume_id = ?
  AND fe.type = 'file'
  AND (? IS NULL OR dn.full_path LIKE ? || '%') -- Path prefix filter  
  AND (? IS NULL OR fe.size_bytes >= ?) -- Min size filter
  AND (? IS NULL OR fe.hidden = ?) -- Hidden filter
ORDER BY 
    fe.size_bytes DESC,
    fe.name ASC -- Deterministic secondary sort
LIMIT ?;

-- name: GetTopFilesByCount :many
-- Get directories with the most files (useful for identifying directories with many small files)
SELECT 
    dn.id,
    dn.name,
    dn.full_path,
    dn.depth,
    COALESCE(dr.size_bytes, dn.latest_size_bytes) as size_bytes,
    COALESCE(dr.file_count, dn.latest_file_count) as file_count,
    -- Calculate average file size
    CASE 
        WHEN COALESCE(dr.file_count, dn.latest_file_count) > 0 
        THEN COALESCE(dr.size_bytes, dn.latest_size_bytes) / COALESCE(dr.file_count, dn.latest_file_count)
        ELSE 0 
    END as avg_file_size,
    dn.updated_at as last_updated
FROM dir_nodes dn
LEFT JOIN (
    SELECT dir_id, size_bytes, file_count, computed_at
    FROM dir_rollups dr1
    WHERE dr1.computed_at = (
        SELECT MAX(dr2.computed_at) 
        FROM dir_rollups dr2 
        WHERE dr2.dir_id = dr1.dir_id
    )
) dr ON dr.dir_id = dn.id
WHERE dn.volume_id = ?
  AND (? IS NULL OR dn.full_path LIKE ? || '%') -- Path prefix filter
  AND (? IS NULL OR COALESCE(dr.file_count, dn.latest_file_count) >= ?) -- Min file count
ORDER BY 
    COALESCE(dr.file_count, dn.latest_file_count) DESC,
    dn.full_path ASC
LIMIT ?;

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
    dn.latest_size_bytes as total_size,
    dn.latest_file_count as total_files,
    (SELECT COUNT(*) FROM dir_nodes WHERE parent_dir_id = dn.id) as subdirectory_count,
    (SELECT COUNT(*) FROM file_entries WHERE parent_dir_id = dn.id AND type = 'file') as direct_file_count
FROM dir_nodes dn
WHERE dn.volume_id = ? AND dn.id = ?;

-- name: GetTopNChildrenWithOther :many
-- Get top N children with "other" bucket calculation (simplified version)
-- Returns top N directories and files
SELECT 
    'dir' as entry_type,
    dn.id as entry_id,
    dn.name,
    dn.full_path,
    COALESCE(dr.size_bytes, dn.latest_size_bytes) as size_bytes,
    COALESCE(dr.file_count, dn.latest_file_count) as file_count
FROM dir_nodes dn
LEFT JOIN (
    SELECT dir_id, size_bytes, file_count 
    FROM dir_rollups dr1
    WHERE dr1.computed_at = (
        SELECT MAX(dr2.computed_at) 
        FROM dir_rollups dr2 
        WHERE dr2.dir_id = dr1.dir_id
    )
) AS dr ON dr.dir_id = dn.id
WHERE dn.volume_id = ? AND dn.parent_dir_id = ?

UNION ALL

SELECT 
    'file' as entry_type,
    fe.id as entry_id,
    fe.name,
    '' as full_path,
    fe.size_bytes,
    1 as file_count
FROM file_entries fe
WHERE fe.volume_id = ? 
  AND fe.parent_dir_id = ?
  AND fe.type = 'file'

ORDER BY 
    size_bytes DESC,
    name ASC
LIMIT ?;

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
WHERE volume_id = ? AND full_path = ?;

-- name: GetDirectoryHierarchy :many
-- Get the full hierarchy path from root to a specific directory
-- Returns all ancestor directories in order from root to target
WITH RECURSIVE hierarchy AS (
    -- Base case: the target directory
    SELECT 
        dn.id, dn.parent_dir_id, dn.name, dn.full_path, dn.depth, 0 as level
    FROM dir_nodes dn 
    WHERE dn.volume_id = ? AND dn.id = ?
    
    UNION ALL
    
    -- Recursive case: find parent directories
    SELECT 
        dn.id, dn.parent_dir_id, dn.name, dn.full_path, dn.depth, h.level + 1
    FROM dir_nodes dn
    JOIN hierarchy h ON dn.id = h.parent_dir_id
    WHERE dn.volume_id = ?
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
-- Note: SQLite doesn't support ILIKE, using COLLATE NOCASE with LIKE
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
WHERE fe.volume_id = ?
  AND fe.name LIKE ? COLLATE NOCASE -- Case-insensitive pattern matching
  AND (? IS NULL OR fe.type = ?) -- Type filter
  AND (? IS NULL OR fe.size_bytes >= ?) -- Min size filter
ORDER BY 
    fe.size_bytes DESC,
    fe.name ASC
LIMIT ?;

-- name: SearchDirectoriesByName :many
-- Search for directories by name pattern
SELECT 
    dn.id,
    dn.name,
    dn.full_path,
    dn.depth,
    COALESCE(dr.size_bytes, dn.latest_size_bytes) as size_bytes,
    COALESCE(dr.file_count, dn.latest_file_count) as file_count
FROM dir_nodes dn
LEFT JOIN (
    SELECT dir_id, size_bytes, file_count
    FROM dir_rollups dr1
    WHERE dr1.computed_at = (
        SELECT MAX(dr2.computed_at) 
        FROM dir_rollups dr2 
        WHERE dr2.dir_id = dr1.dir_id
    )
) dr ON dr.dir_id = dn.id
WHERE dn.volume_id = ?
  AND dn.name LIKE ? COLLATE NOCASE -- Case-insensitive pattern matching  
  AND (? IS NULL OR dn.depth <= ?) -- Max depth filter
ORDER BY 
    COALESCE(dr.size_bytes, dn.latest_size_bytes) DESC,
    dn.full_path ASC
LIMIT ?;

-- =============================================================================
-- DIRECTORY TREE QUERIES
-- =============================================================================

-- name: GetDirectoryTree :many
-- Get directory tree with optional depth limiting
WITH RECURSIVE dir_tree AS (
    -- Base case: start with root directories
    SELECT d.id, d.volume_id, d.parent_dir_id, d.name, d.full_path, d.depth, d.latest_size_bytes, d.latest_file_count, d.created_at, d.updated_at
    FROM dir_nodes d
    WHERE d.volume_id = ? AND d.parent_dir_id IS NULL
    
    UNION ALL
    
    -- Recursive case: get children
    SELECT d.id, d.volume_id, d.parent_dir_id, d.name, d.full_path, d.depth, d.latest_size_bytes, d.latest_file_count, d.created_at, d.updated_at
    FROM dir_nodes d
    INNER JOIN dir_tree dt ON d.parent_dir_id = dt.id
    WHERE d.volume_id = dt.volume_id AND d.depth <= ?  -- Limit depth to prevent runaway queries
)
SELECT id, volume_id, parent_dir_id, name, full_path, depth, latest_size_bytes, latest_file_count, created_at, updated_at
FROM dir_tree
ORDER BY depth, full_path;