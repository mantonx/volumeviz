-- Folder management queries for SQLite

-- name: CreateFolder :one
INSERT INTO folders (
    volume_id, parent_id, path, name, path_hash,
    size_bytes, size_bytes_recursive, file_count, file_count_recursive,
    subfolder_count, media_file_count, has_media_files,
    modified_at, accessed_at
) VALUES (
    ?, ?, ?, ?, ?,
    ?, ?, ?, ?,
    ?, ?, ?,
    ?, ?
) RETURNING *;

-- name: GetFolder :one
SELECT * FROM folders WHERE id = ?;

-- name: GetFolderByPath :one
SELECT * FROM folders WHERE volume_id = ? AND path = ?;

-- name: ListFolders :many
SELECT * FROM folders 
WHERE volume_id = ?
ORDER BY path
LIMIT ? OFFSET ?;

-- name: ListSubfolders :many
SELECT * FROM folders
WHERE parent_id = ?
ORDER BY name;

-- name: UpdateFolder :one
UPDATE folders
SET 
    size_bytes = ?,
    size_bytes_recursive = ?,
    file_count = ?,
    file_count_recursive = ?,
    subfolder_count = ?,
    media_file_count = ?,
    has_media_files = ?,
    modified_at = ?,
    accessed_at = ?
WHERE id = ?
RETURNING *;

-- name: DeleteFolder :exec
DELETE FROM folders WHERE id = ?;

-- name: DeleteFoldersByVolume :exec
DELETE FROM folders WHERE volume_id = ?;

-- name: GetLargestFolders :many
SELECT id, volume_id, path, name, size_bytes_recursive
FROM folders
WHERE volume_id = ?
ORDER BY size_bytes_recursive DESC
LIMIT ?;

-- name: GetFolderByID :one
SELECT * FROM folders WHERE id = ?;

-- name: ListFoldersByVolume :many
SELECT * FROM folders 
WHERE volume_id = ?
ORDER BY path
LIMIT ? OFFSET ?;

-- name: ListFoldersByParent :many
SELECT * FROM folders
WHERE parent_id = ?
ORDER BY name
LIMIT ? OFFSET ?;

-- name: GetRootFolders :many
SELECT * FROM folders
WHERE volume_id = ? AND parent_id IS NULL
ORDER BY name;

-- name: GetFoldersWithMostFiles :many
SELECT * FROM folders
WHERE volume_id = ?
ORDER BY file_count_recursive DESC
LIMIT ?;

-- name: UpsertFolder :one
INSERT INTO folders (
    volume_id, parent_id, path, name, path_hash,
    size_bytes, size_bytes_recursive, file_count, file_count_recursive,
    subfolder_count, media_file_count, has_media_files,
    modified_at, accessed_at
) VALUES (
    ?, ?, ?, ?, ?,
    ?, ?, ?, ?,
    ?, ?, ?,
    ?, ?
) ON CONFLICT (volume_id, path_hash) DO UPDATE SET
    parent_id = excluded.parent_id,
    name = excluded.name,
    size_bytes = excluded.size_bytes,
    size_bytes_recursive = excluded.size_bytes_recursive,
    file_count = excluded.file_count,
    file_count_recursive = excluded.file_count_recursive,
    subfolder_count = excluded.subfolder_count,
    media_file_count = excluded.media_file_count,
    has_media_files = excluded.has_media_files,
    modified_at = excluded.modified_at,
    accessed_at = excluded.accessed_at
RETURNING *;

-- name: CountFoldersByVolume :one
SELECT COUNT(*) FROM folders WHERE volume_id = ?;

-- name: GetFolderStats :one
SELECT 
    COUNT(*) as total_folders,
    COALESCE(SUM(size_bytes_recursive), 0) as total_size,
    COALESCE(AVG(size_bytes_recursive), 0) as avg_folder_size,
    COALESCE(MAX(size_bytes_recursive), 0) as largest_folder,
    COALESCE(SUM(file_count_recursive), 0) as total_files
FROM folders WHERE volume_id = ?;

-- name: GetFolderTree :many
SELECT * FROM folders
WHERE parent_id = ? AND volume_id = ?
ORDER BY name
LIMIT ?;

-- name: GetFolderPath :many
SELECT * FROM folders WHERE id = ?;

-- name: UpdateFolderStats :exec
UPDATE folders SET
    size_bytes = ?,
    size_bytes_recursive = ?,
    file_count = ?,
    file_count_recursive = ?,
    subfolder_count = ?
WHERE id = ?;

-- name: UpdateFolderMetadata :exec
UPDATE folders SET
    modified_at = ?,
    accessed_at = ?
WHERE id = ?;

-- name: BulkInsertFolders :execrows
INSERT INTO folders (
    volume_id, parent_id, path, name, path_hash,
    size_bytes, size_bytes_recursive, file_count, file_count_recursive,
    subfolder_count, media_file_count, has_media_files,
    modified_at, accessed_at
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);