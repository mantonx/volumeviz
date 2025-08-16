-- folders.sql: Folder tree operations
-- This file contains all SQLC queries for folder management

-- =======================
-- FOLDER OPERATIONS
-- =======================

-- name: CreateFolder :one
INSERT INTO folders (
    parent_id, volume_id, name, path, path_hash, depth, mtime, ctime, uid, gid, mode, is_symlink, symlink_target
) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13
) RETURNING id, created_at, updated_at;

-- name: GetFolderByID :one
SELECT id, parent_id, volume_id, name, path, path_hash, size_bytes_recursive, disk_usage_bytes_recursive,
       file_count, dir_count, depth, mtime, ctime, uid, gid, mode, is_symlink, symlink_target,
       created_at, updated_at
FROM folders
WHERE id = $1;

-- name: GetFolderByPath :one
SELECT id, parent_id, volume_id, name, path, path_hash, size_bytes_recursive, disk_usage_bytes_recursive,
       file_count, dir_count, depth, mtime, ctime, uid, gid, mode, is_symlink, symlink_target,
       created_at, updated_at
FROM folders
WHERE volume_id = $1 AND path_hash = $2;

-- name: ListFoldersByVolume :many
SELECT id, parent_id, volume_id, name, path, path_hash, size_bytes_recursive, disk_usage_bytes_recursive,
       file_count, dir_count, depth, mtime, ctime, uid, gid, mode, is_symlink, symlink_target,
       created_at, updated_at
FROM folders
WHERE volume_id = $1
ORDER BY path
LIMIT $2 OFFSET $3;

-- name: ListFoldersByParent :many
SELECT id, parent_id, volume_id, name, path, path_hash, size_bytes_recursive, disk_usage_bytes_recursive,
       file_count, dir_count, depth, mtime, ctime, uid, gid, mode, is_symlink, symlink_target,
       created_at, updated_at
FROM folders
WHERE volume_id = $1 AND parent_id = $2
ORDER BY name;

-- name: GetRootFolders :many
SELECT id, parent_id, volume_id, name, path, path_hash, size_bytes_recursive, disk_usage_bytes_recursive,
       file_count, dir_count, depth, mtime, ctime, uid, gid, mode, is_symlink, symlink_target,
       created_at, updated_at
FROM folders
WHERE volume_id = $1 AND parent_id IS NULL
ORDER BY name;

-- name: GetFoldersByDepth :many
SELECT id, parent_id, volume_id, name, path, path_hash, size_bytes_recursive, disk_usage_bytes_recursive,
       file_count, dir_count, depth, mtime, ctime, uid, gid, mode, is_symlink, symlink_target,
       created_at, updated_at
FROM folders
WHERE volume_id = $1 AND depth = $2
ORDER BY path;

-- name: GetLargestFolders :many
SELECT id, parent_id, volume_id, name, path, path_hash, size_bytes_recursive, disk_usage_bytes_recursive,
       file_count, dir_count, depth, mtime, ctime, uid, gid, mode, is_symlink, symlink_target,
       created_at, updated_at
FROM folders
WHERE volume_id = $1
ORDER BY size_bytes_recursive DESC
LIMIT $2;

-- name: GetFoldersWithMostFiles :many
SELECT id, parent_id, volume_id, name, path, path_hash, size_bytes_recursive, disk_usage_bytes_recursive,
       file_count, dir_count, depth, mtime, ctime, uid, gid, mode, is_symlink, symlink_target,
       created_at, updated_at
FROM folders
WHERE volume_id = $1
ORDER BY file_count DESC
LIMIT $2;

-- name: UpdateFolderStats :exec
UPDATE folders
SET 
    size_bytes_recursive = $2,
    disk_usage_bytes_recursive = $3,
    file_count = $4,
    dir_count = $5,
    updated_at = CURRENT_TIMESTAMP
WHERE id = $1;

-- name: UpdateFolderMetadata :exec
UPDATE folders
SET 
    mtime = $2,
    ctime = $3,
    uid = $4,
    gid = $5,
    mode = $6,
    updated_at = CURRENT_TIMESTAMP
WHERE id = $1;

-- name: DeleteFolder :exec
DELETE FROM folders WHERE id = $1;

-- name: DeleteFoldersByVolume :exec
DELETE FROM folders WHERE volume_id = $1;

-- name: CountFoldersByVolume :one
SELECT COUNT(*) FROM folders WHERE volume_id = $1;

-- name: GetFolderStats :one
SELECT 
    COUNT(*) as total_folders,
    COUNT(*) FILTER (WHERE parent_id IS NULL) as root_folders,
    COALESCE(MAX(depth), 0)::integer as max_depth,
    COALESCE(AVG(file_count), 0.0)::double precision as avg_files_per_folder,
    COALESCE(SUM(size_bytes_recursive), 0)::bigint as total_size,
    COALESCE(MAX(size_bytes_recursive), 0)::bigint as largest_folder_size
FROM folders
WHERE volume_id = $1;

-- name: UpsertFolder :one
INSERT INTO folders (
    parent_id, volume_id, name, path, path_hash, depth, mtime, ctime, uid, gid, mode, is_symlink, symlink_target
) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13
)
ON CONFLICT (volume_id, path_hash)
DO UPDATE SET
    parent_id = EXCLUDED.parent_id,
    name = EXCLUDED.name,
    path = EXCLUDED.path,
    depth = EXCLUDED.depth,
    mtime = EXCLUDED.mtime,
    ctime = EXCLUDED.ctime,
    uid = EXCLUDED.uid,
    gid = EXCLUDED.gid,
    mode = EXCLUDED.mode,
    is_symlink = EXCLUDED.is_symlink,
    symlink_target = EXCLUDED.symlink_target,
    updated_at = CURRENT_TIMESTAMP
RETURNING id, created_at, updated_at;

-- name: BulkInsertFolders :copyfrom
INSERT INTO folders (
    parent_id, volume_id, name, path, path_hash, depth, mtime, ctime, uid, gid, mode, is_symlink, symlink_target
) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13
);

-- name: GetFolderTree :many
SELECT f.id, f.parent_id, f.volume_id, f.name, f.path, f.path_hash, f.size_bytes_recursive, f.disk_usage_bytes_recursive,
       f.file_count, f.dir_count, f.depth, f.mtime, f.ctime, f.uid, f.gid, f.mode, f.is_symlink, f.symlink_target,
       f.created_at, f.updated_at
FROM folders f
WHERE f.volume_id = (SELECT f2.volume_id FROM folders f2 WHERE f2.id = $1)
  AND f.depth >= (SELECT f3.depth FROM folders f3 WHERE f3.id = $1)
  AND f.depth <= (SELECT f4.depth FROM folders f4 WHERE f4.id = $1) + $2
ORDER BY f.depth, f.name;

-- name: GetFolderPath :many
SELECT f.id, f.parent_id, f.volume_id, f.name, f.path, f.depth
FROM folders f
WHERE f.volume_id = (SELECT f2.volume_id FROM folders f2 WHERE f2.id = $1)
  AND f.depth <= (SELECT f3.depth FROM folders f3 WHERE f3.id = $1)
ORDER BY f.depth;