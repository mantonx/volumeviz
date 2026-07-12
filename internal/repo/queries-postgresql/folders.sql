-- Folder management queries for PostgreSQL

-- name: CreateFolder :one
INSERT INTO folders (
    volume_id, parent_id, path, name, path_hash,
    size_bytes, size_bytes_recursive, file_count, file_count_recursive,
    subfolder_count, media_file_count, has_media_files,
    modified_at, accessed_at, organization_id
) VALUES (
    $1, $2, $3, $4, $5,
    $6, $7, $8, $9,
    $10, $11, $12,
    $13, $14, $15
) RETURNING *;

-- name: GetFolder :one
SELECT * FROM folders WHERE id = $1;

-- name: GetFolderByPath :one
SELECT * FROM folders WHERE volume_id = $1 AND path = $2;

-- name: ListFolders :many
SELECT * FROM folders 
WHERE volume_id = $1
ORDER BY path
LIMIT $2 OFFSET $3;

-- name: ListFoldersByOrganization :many
SELECT * FROM folders 
WHERE volume_id = $1 AND organization_id = $2
ORDER BY path
LIMIT $3 OFFSET $4;

-- name: ListSubfolders :many
SELECT * FROM folders
WHERE parent_id = $1
ORDER BY name;

-- name: UpdateFolder :one
UPDATE folders
SET 
    size_bytes = $2,
    size_bytes_recursive = $3,
    file_count = $4,
    file_count_recursive = $5,
    subfolder_count = $6,
    media_file_count = $7,
    has_media_files = $8,
    modified_at = $9,
    accessed_at = $10
WHERE id = $1
RETURNING *;

-- name: DeleteFolder :exec
DELETE FROM folders WHERE id = $1;

-- name: DeleteFoldersByVolume :exec
DELETE FROM folders WHERE volume_id = $1;

-- name: GetLargestFolders :many
SELECT id, volume_id, path, name, size_bytes_recursive
FROM folders
WHERE volume_id = $1
ORDER BY size_bytes_recursive DESC NULLS LAST
LIMIT $2;

-- name: GetFolderByID :one
SELECT * FROM folders WHERE id = $1;

-- name: ListFoldersByVolume :many
SELECT * FROM folders 
WHERE volume_id = $1
ORDER BY path
LIMIT $2 OFFSET $3;

-- name: ListFoldersByParent :many
SELECT * FROM folders
WHERE parent_id = $1
ORDER BY name
LIMIT $2 OFFSET $3;

-- name: GetRootFolders :many
SELECT * FROM folders
WHERE volume_id = $1 AND parent_id IS NULL
ORDER BY name;

-- name: GetFoldersWithMostFiles :many
SELECT * FROM folders
WHERE volume_id = $1
ORDER BY file_count_recursive DESC NULLS LAST
LIMIT $2;

-- name: UpsertFolder :one
INSERT INTO folders (
    volume_id, parent_id, path, name, path_hash,
    size_bytes, size_bytes_recursive, file_count, file_count_recursive,
    subfolder_count, media_file_count, has_media_files,
    modified_at, accessed_at
) VALUES (
    $1, $2, $3, $4, $5,
    $6, $7, $8, $9,
    $10, $11, $12,
    $13, $14
) ON CONFLICT (volume_id, path) DO UPDATE SET
    parent_id = EXCLUDED.parent_id,
    name = EXCLUDED.name,
    path_hash = EXCLUDED.path_hash,
    size_bytes = EXCLUDED.size_bytes,
    size_bytes_recursive = EXCLUDED.size_bytes_recursive,
    file_count = EXCLUDED.file_count,
    file_count_recursive = EXCLUDED.file_count_recursive,
    subfolder_count = EXCLUDED.subfolder_count,
    media_file_count = EXCLUDED.media_file_count,
    has_media_files = EXCLUDED.has_media_files,
    modified_at = EXCLUDED.modified_at,
    accessed_at = EXCLUDED.accessed_at
RETURNING *;

-- name: CountFoldersByVolume :one
SELECT COUNT(*) FROM folders WHERE volume_id = $1;

-- name: GetFolderStats :one
SELECT 
    COUNT(*) as total_folders,
    COALESCE(SUM(size_bytes_recursive), 0) as total_size,
    COALESCE(AVG(size_bytes_recursive), 0) as avg_folder_size,
    COALESCE(MAX(size_bytes_recursive), 0) as largest_folder,
    COALESCE(SUM(file_count_recursive), 0) as total_files
FROM folders WHERE volume_id = $1;

-- name: GetFolderTree :many
SELECT * FROM folders
WHERE parent_id = $1 AND volume_id = $2
ORDER BY name
LIMIT $3;

-- name: GetFolderPath :many
SELECT * FROM folders WHERE id = $1;

-- name: UpdateFolderStats :exec
UPDATE folders SET
    size_bytes = $2,
    size_bytes_recursive = $3,
    file_count = $4,
    file_count_recursive = $5,
    subfolder_count = $6
WHERE id = $1;

-- name: UpdateFolderMetadata :exec
UPDATE folders SET
    modified_at = $2,
    accessed_at = $3
WHERE id = $1;

-- name: BulkInsertFolders :execrows
INSERT INTO folders (
    volume_id, parent_id, path, name, path_hash,
    size_bytes, size_bytes_recursive, file_count, file_count_recursive,
    subfolder_count, media_file_count, has_media_files,
    modified_at, accessed_at
) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14);

-- name: SearchFoldersByName :many
SELECT * FROM folders
WHERE volume_id = $1 AND name ILIKE '%' || $2 || '%'
ORDER BY name
LIMIT $3 OFFSET $4;