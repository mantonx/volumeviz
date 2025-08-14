-- =============================================================================
-- LEGACY SCAN-RELATED QUERIES (UPDATED FOR NEW SCHEMA)
-- Updated to use new 'folders' and 'files' tables instead of old schema
-- =============================================================================

-- =============================================================================
-- FILE ENTRIES QUERIES (now mapped to 'files' table)
-- =============================================================================

-- name: GetFileEntry :one
SELECT id, volume_id, folder_id as parent_dir_id, name, size_bytes, mtime, ctime, inode, uid, gid, 
       CASE WHEN is_symlink THEN 'symlink' ELSE 'file' END as type, false as hidden, path_hash, created_at, updated_at
FROM files 
WHERE id = $1 AND volume_id = $2;

-- name: GetFileEntriesByVolumeAndParent :many
SELECT id, volume_id, folder_id as parent_dir_id, name, size_bytes, mtime, ctime, inode, uid, gid,
       CASE WHEN is_symlink THEN 'symlink' ELSE 'file' END as type, false as hidden, path_hash, created_at, updated_at
FROM files 
WHERE volume_id = $1 AND folder_id = $2
ORDER BY name ASC;

-- name: GetLargestFilesLegacy :many
SELECT id, volume_id, folder_id as parent_dir_id, name, size_bytes, mtime, ctime, inode, uid, gid,
       CASE WHEN is_symlink THEN 'symlink' ELSE 'file' END as type, false as hidden, path_hash, created_at, updated_at
FROM files 
WHERE volume_id = $1
ORDER BY size_bytes DESC
LIMIT $2;

-- name: FindFilesByPathHashLegacy :many
SELECT id, volume_id, folder_id as parent_dir_id, name, size_bytes, mtime, ctime, inode, uid, gid,
       CASE WHEN is_symlink THEN 'symlink' ELSE 'file' END as type, false as hidden, path_hash, created_at, updated_at
FROM files 
WHERE volume_id = $1 AND path_hash = $2;

-- =============================================================================
-- DIRECTORY NODES QUERIES (now mapped to 'folders' table)
-- =============================================================================

-- name: GetDirNode :one
SELECT id, volume_id, parent_id as parent_dir_id, name, path as full_path, depth, 
       size_bytes_recursive as latest_size_bytes, file_count as latest_file_count, created_at, updated_at
FROM folders 
WHERE id = $1 AND volume_id = $2;

-- name: GetDirNodesByVolumeAndParent :many
SELECT id, volume_id, parent_id as parent_dir_id, name, path as full_path, depth,
       size_bytes_recursive as latest_size_bytes, file_count as latest_file_count, created_at, updated_at
FROM folders 
WHERE volume_id = $1 AND parent_id = $2
ORDER BY name ASC;

-- name: GetRootDirNodes :many
SELECT id, volume_id, parent_id as parent_dir_id, name, path as full_path, depth,
       size_bytes_recursive as latest_size_bytes, file_count as latest_file_count, created_at, updated_at
FROM folders 
WHERE volume_id = $1 AND parent_id IS NULL
ORDER BY name ASC;

-- name: CreateDirNode :one
INSERT INTO folders (
    volume_id, parent_id, name, path, path_hash, depth
) VALUES (
    $1, $2, $3, $4, gen_random_bytes(32), $5
) RETURNING id, volume_id, parent_id as parent_dir_id, name, path as full_path, depth, 
            size_bytes_recursive as latest_size_bytes, file_count as latest_file_count, created_at, updated_at;

-- name: BulkInsertDirNodes :copyfrom
INSERT INTO folders (
    volume_id, parent_id, name, path, path_hash, depth
) VALUES (
    $1, $2, $3, $4, $5, $6
);

-- name: UpdateDirNodeStats :exec
UPDATE folders 
SET 
    size_bytes_recursive = $2,
    file_count = $3,
    updated_at = CURRENT_TIMESTAMP
WHERE id = $1;

-- name: DeleteDirNodesByVolume :exec
DELETE FROM folders WHERE volume_id = $1;

-- name: CountDirNodesByVolume :one
SELECT COUNT(*) FROM folders WHERE volume_id = $1;

-- name: GetDirNodeStats :one
SELECT 
    COUNT(*) as total_dirs,
    MAX(depth) as max_depth,
    SUM(size_bytes_recursive) as total_size,
    AVG(file_count) as avg_files_per_dir
FROM folders
WHERE volume_id = $1;

-- =============================================================================
-- DIRECTORY ROLLUPS QUERIES (legacy compatibility - not implemented in new schema)
-- =============================================================================

-- Note: Directory rollups are now handled by triggers in the new schema
-- These queries are kept for compatibility but may return empty results

-- name: GetDirRollup :one
SELECT 
    f.id as id,
    f.id as dir_id,
    f.size_bytes_recursive as size_bytes,
    f.file_count as file_count,
    f.updated_at as computed_at,
    f.created_at as created_at
FROM folders f
WHERE f.id = $1;

-- name: CreateDirRollup :one
-- This is a no-op in the new schema since rollups are maintained by triggers
SELECT 
    $1::bigint as id,
    $1::bigint as dir_id,
    0::bigint as size_bytes,
    0::bigint as file_count,
    CURRENT_TIMESTAMP as computed_at,
    CURRENT_TIMESTAMP as created_at;

-- name: GetLatestDirRollups :many
SELECT 
    f.id as id,
    f.id as dir_id,
    f.size_bytes_recursive as size_bytes,
    f.file_count as file_count,
    f.updated_at as computed_at,
    f.created_at as created_at
FROM folders f
WHERE f.volume_id = $1
ORDER BY f.updated_at DESC
LIMIT $2;

-- name: DeleteDirRollupsByVolume :exec
-- This is a no-op in the new schema
SELECT 1 WHERE false;

-- name: CountDirRollupsByVolume :one
SELECT COUNT(*) FROM folders WHERE volume_id = $1;

-- =============================================================================
-- EXPLORER QUERIES (updated for new schema)
-- =============================================================================

-- name: GetExplorerEntry :one
SELECT 
    CASE 
        WHEN f.id IS NOT NULL THEN 'folder'
        WHEN fl.id IS NOT NULL THEN 'file'
        ELSE 'unknown'
    END as type,
    COALESCE(f.id, fl.id) as id,
    COALESCE(f.name, fl.name) as name,
    COALESCE(f.path, fl.path) as path,
    COALESCE(f.size_bytes_recursive, fl.size_bytes) as size_bytes,
    f.file_count,
    f.dir_count,
    fl.extension,
    fl.mime,
    fl.media_kind,
    COALESCE(f.mtime, fl.mtime) as mtime,
    COALESCE(f.created_at, fl.created_at) as created_at
FROM folders f
FULL OUTER JOIN files fl ON false  -- This join will never match, we use UNION instead
WHERE (f.volume_id = $1 AND f.id = $2) OR (fl.volume_id = $1 AND fl.id = $2);

-- name: ListExplorerEntries :many
(
    SELECT 
        'folder' as type,
        f.id,
        f.name,
        f.path,
        f.size_bytes_recursive as size_bytes,
        f.file_count,
        f.dir_count,
        NULL::text as extension,
        NULL::text as mime,
        NULL::text as media_kind,
        f.mtime,
        f.created_at
    FROM folders f
    WHERE f.volume_id = $1 AND f.parent_id = $2
)
UNION ALL
(
    SELECT 
        'file' as type,
        fl.id,
        fl.name,
        fl.path,
        fl.size_bytes,
        NULL::bigint as file_count,
        NULL::bigint as dir_count,
        fl.extension,
        fl.mime,
        fl.media_kind,
        fl.mtime,
        fl.created_at
    FROM files fl
    WHERE fl.volume_id = $1 AND fl.folder_id = $2
)
ORDER BY type, name
LIMIT $3 OFFSET $4;