-- File management queries for PostgreSQL

-- name: GetFileByID :one
SELECT * FROM files WHERE id = $1;

-- name: ListFilesByFolder :many
SELECT * FROM files WHERE folder_id = $1 ORDER BY name LIMIT $2 OFFSET $3;

-- name: ListFilesByVolume :many  
SELECT * FROM files WHERE volume_id = $1 ORDER BY path LIMIT $2 OFFSET $3;

-- name: ListFilesByVolumeAndOrganization :many  
SELECT * FROM files WHERE volume_id = $1 AND organization_id = $2 ORDER BY path LIMIT $3 OFFSET $4;

-- name: GetRecentFiles :many
SELECT * FROM files WHERE volume_id = $1 AND modified_at >= $2 ORDER BY modified_at DESC LIMIT $3;

-- name: GetFilesModifiedSince :many
SELECT * FROM files WHERE volume_id = $1 AND modified_at >= $2 ORDER BY modified_at DESC;

-- name: GetFilesBySize :many
SELECT * FROM files WHERE volume_id = $1 AND size_bytes BETWEEN $2 AND $3 ORDER BY size_bytes DESC LIMIT $4;

-- name: GetDuplicateFiles :many
SELECT files.* FROM files WHERE files.volume_id = $1 AND files.content_hash IS NOT NULL AND files.content_hash IN (
    SELECT f.content_hash FROM files f WHERE f.volume_id = $1 AND f.content_hash IS NOT NULL
    GROUP BY f.content_hash HAVING COUNT(*) > 1
) ORDER BY files.content_hash, files.path;

-- name: UpsertFile :one
INSERT INTO files (
    volume_id, folder_id, path, path_hash, name, extension, mime, 
    size_bytes, modified_at, accessed_at, mode, owner_uid, owner_gid, 
    content_hash, is_text, is_binary, media_kind, organization_id
) VALUES (
    $1, $2, $3, $4, $5, $6, $7, 
    $8, $9, $10, $11, $12, $13, 
    $14, $15, $16, $17, $18
) ON CONFLICT (volume_id, path_hash) DO UPDATE SET
    folder_id = EXCLUDED.folder_id,
    name = EXCLUDED.name,
    extension = EXCLUDED.extension,
    mime = EXCLUDED.mime,
    size_bytes = EXCLUDED.size_bytes,
    modified_at = EXCLUDED.modified_at,
    accessed_at = EXCLUDED.accessed_at,
    mode = EXCLUDED.mode,
    owner_uid = EXCLUDED.owner_uid,
    owner_gid = EXCLUDED.owner_gid,
    content_hash = EXCLUDED.content_hash,
    is_text = EXCLUDED.is_text,
    is_binary = EXCLUDED.is_binary,
    media_kind = EXCLUDED.media_kind,
    organization_id = EXCLUDED.organization_id
RETURNING *;

-- name: UpdateFileSystemMetadata :exec
UPDATE files SET 
    size_bytes = $2,
    modified_at = $3,
    accessed_at = $4,
    mode = $5,
    owner_uid = $6,
    owner_gid = $7
WHERE id = $1;

-- name: UpdateFileHash :exec
UPDATE files SET content_hash = $2 WHERE id = $1;

-- name: UpdateFileMime :exec
UPDATE files SET 
    mime = $2,
    media_kind = $3,
    is_text = $4,
    is_binary = $5
WHERE id = $1;

-- name: CountFilesByFolder :one
SELECT COUNT(*) FROM files WHERE folder_id = $1;

-- name: GetFileStats :one
SELECT 
    COUNT(*) as total_files,
    COALESCE(SUM(size_bytes), 0) as total_size,
    COALESCE(AVG(size_bytes), 0) as avg_file_size,
    COALESCE(MAX(size_bytes), 0) as largest_file,
    COUNT(DISTINCT extension) as unique_extensions,
    COUNT(DISTINCT media_kind) as unique_media_kinds,
    COUNT(content_hash) as hashed_files
FROM files WHERE volume_id = $1;

-- name: GetMediaKindStats :many
SELECT 
    media_kind,
    COUNT(*) as file_count,
    COALESCE(SUM(size_bytes), 0) as total_size,
    COALESCE(AVG(size_bytes), 0) as avg_size
FROM files 
WHERE volume_id = $1 AND media_kind IS NOT NULL
GROUP BY media_kind
ORDER BY file_count DESC;

-- name: GetExtensionStats :many
SELECT 
    extension,
    COUNT(*) as file_count,
    COALESCE(SUM(size_bytes), 0) as total_size,
    COALESCE(AVG(size_bytes), 0) as avg_size
FROM files 
WHERE volume_id = $1 AND extension IS NOT NULL
GROUP BY extension
ORDER BY file_count DESC
LIMIT $2;

-- name: BulkInsertFiles :copyfrom
INSERT INTO files (
    volume_id, folder_id, path, path_hash, name, extension, mime, 
    size_bytes, modified_at, accessed_at, mode, owner_uid, owner_gid, 
    content_hash, is_text, is_binary, media_kind
) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17);

-- name: CreateFile :one
INSERT INTO files (
    volume_id, folder_id, path, path_hash, name, extension, mime, 
    size_bytes, modified_at, accessed_at, mode, owner_uid, owner_gid, 
    content_hash, is_text, is_binary, media_kind
) VALUES (
    $1, $2, $3, $4, $5, $6, $7, 
    $8, $9, $10, $11, $12, $13, 
    $14, $15, $16, $17
) RETURNING *;

-- name: GetFile :one
SELECT * FROM files WHERE id = $1;

-- name: GetFileByPath :one
SELECT * FROM files WHERE volume_id = $1 AND path = $2;

-- name: ListFiles :many
SELECT * FROM files 
WHERE volume_id = $1
ORDER BY path
LIMIT $2 OFFSET $3;

-- name: UpdateFile :one
UPDATE files 
SET 
    size_bytes = $2,
    modified_at = $3,
    accessed_at = $4,
    content_hash = $5,
    last_scan_at = NOW()
WHERE id = $1
RETURNING *;

-- name: DeleteFile :exec
DELETE FROM files WHERE id = $1;

-- name: DeleteFilesByVolume :exec
DELETE FROM files WHERE volume_id = $1;

-- name: CountFilesByVolume :one
SELECT COUNT(*) FROM files WHERE volume_id = $1;

-- name: GetTotalSizeByVolume :one
SELECT COALESCE(SUM(size_bytes), 0) as total_size FROM files WHERE volume_id = $1;

-- name: GetLargestFiles :many
SELECT id, volume_id, path, name, size_bytes, modified_at
FROM files 
WHERE volume_id = $1
ORDER BY size_bytes DESC
LIMIT $2;

-- name: GetDuplicateFilesBySize :many
SELECT size_bytes, COUNT(*) as count, array_agg(path) as paths
FROM files 
WHERE volume_id = $1 AND size_bytes > 0
GROUP BY size_bytes
HAVING COUNT(*) > 1
ORDER BY size_bytes DESC
LIMIT $2;

-- name: GetFilesByExtension :many
SELECT extension, COUNT(*) as count, COALESCE(SUM(size_bytes), 0) as total_size
FROM files 
WHERE volume_id = $1 AND extension IS NOT NULL
GROUP BY extension
ORDER BY count DESC
LIMIT $2;

-- name: GetDistinctMimeTypes :many
SELECT mime as mime_type, COUNT(*) as count
FROM files 
WHERE volume_id = $1 AND mime IS NOT NULL
GROUP BY mime
ORDER BY count DESC;

-- name: GetDistinctMediaKinds :many
SELECT media_kind, COUNT(*) as count
FROM files 
WHERE volume_id = $1 AND media_kind IS NOT NULL
GROUP BY media_kind
ORDER BY count DESC;

-- name: GetDistinctExtensions :many
SELECT extension, COUNT(*) as count
FROM files 
WHERE volume_id = $1 AND extension IS NOT NULL
GROUP BY extension
ORDER BY count DESC
LIMIT $2;

-- name: SearchFilesByName :many
SELECT * FROM files
WHERE volume_id = $1 AND name ILIKE '%' || $2 || '%'
ORDER BY name
LIMIT $3 OFFSET $4;

-- name: GetFilesByMimeType :many
SELECT * FROM files
WHERE volume_id = $1 AND mime = $2
ORDER BY path
LIMIT $3 OFFSET $4;

-- name: GetFilesByExtensionFiles :many
SELECT * FROM files
WHERE volume_id = $1 AND extension = $2
ORDER BY path
LIMIT $3 OFFSET $4;

-- name: GetDuplicateFilesContent :many
SELECT files.* FROM files WHERE files.volume_id = $1 AND files.content_hash IS NOT NULL AND files.content_hash IN (
    SELECT f.content_hash FROM files f WHERE f.volume_id = $1 AND f.content_hash IS NOT NULL
    GROUP BY f.content_hash HAVING COUNT(*) > 1
) ORDER BY files.content_hash, files.path;

-- name: GetFilesByMediaKind :many
SELECT * FROM files
WHERE volume_id = $1 AND media_kind = $2
ORDER BY path
LIMIT $3 OFFSET $4;

-- Retention queries for cleanup
-- name: DeleteOldFiles :exec
DELETE FROM files 
WHERE last_scan_at < $1
  AND last_scan_at IS NOT NULL;

-- name: CountOldFiles :one
SELECT COUNT(*) FROM files 
WHERE last_scan_at < $1
  AND last_scan_at IS NOT NULL;