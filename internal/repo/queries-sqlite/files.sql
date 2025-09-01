-- File management queries for SQLite

-- name: GetFileByID :one
SELECT * FROM files WHERE id = ?;

-- name: ListFilesByFolder :many
SELECT * FROM files WHERE folder_id = ? ORDER BY name LIMIT ? OFFSET ?;

-- name: ListFilesByVolume :many  
SELECT * FROM files WHERE volume_id = ? ORDER BY path LIMIT ? OFFSET ?;

-- name: GetRecentFiles :many
SELECT * FROM files WHERE volume_id = ? AND modified_at >= ? ORDER BY modified_at DESC LIMIT ?;

-- name: GetFilesModifiedSince :many
SELECT * FROM files WHERE volume_id = ? AND modified_at >= ? ORDER BY modified_at DESC;

-- name: GetFilesBySize :many
SELECT * FROM files WHERE volume_id = ? AND size_bytes BETWEEN ? AND ? ORDER BY size_bytes DESC LIMIT ?;

-- name: GetDuplicateFiles :many
SELECT files.* FROM files WHERE files.volume_id = ? AND files.content_hash IS NOT NULL AND files.content_hash IN (
    SELECT f.content_hash FROM files f WHERE f.volume_id = ? AND f.content_hash IS NOT NULL
    GROUP BY f.content_hash HAVING COUNT(*) > 1
) ORDER BY files.content_hash, files.path;

-- name: UpsertFile :one
INSERT INTO files (
    volume_id, folder_id, path, path_hash, name, extension, mime, 
    size_bytes, modified_at, accessed_at, mode, owner_uid, owner_gid, 
    content_hash, is_text, is_binary, media_kind
) VALUES (
    ?, ?, ?, ?, ?, ?, ?, 
    ?, ?, ?, ?, ?, ?, 
    ?, ?, ?, ?
) ON CONFLICT (volume_id, path_hash) DO UPDATE SET
    folder_id = excluded.folder_id,
    name = excluded.name,
    extension = excluded.extension,
    mime = excluded.mime,
    size_bytes = excluded.size_bytes,
    modified_at = excluded.modified_at,
    accessed_at = excluded.accessed_at,
    mode = excluded.mode,
    owner_uid = excluded.owner_uid,
    owner_gid = excluded.owner_gid,
    content_hash = excluded.content_hash,
    is_text = excluded.is_text,
    is_binary = excluded.is_binary,
    media_kind = excluded.media_kind
RETURNING *;

-- name: UpdateFileSystemMetadata :exec
UPDATE files SET 
    size_bytes = ?,
    modified_at = ?,
    accessed_at = ?,
    mode = ?,
    owner_uid = ?,
    owner_gid = ?
WHERE id = ?;

-- name: UpdateFileHash :exec
UPDATE files SET content_hash = ? WHERE id = ?;

-- name: UpdateFileMime :exec
UPDATE files SET 
    mime = ?,
    media_kind = ?,
    is_text = ?,
    is_binary = ?
WHERE id = ?;

-- name: CountFilesByFolder :one
SELECT COUNT(*) FROM files WHERE folder_id = ?;

-- name: GetFileStats :one
SELECT 
    COUNT(*) as total_files,
    COALESCE(SUM(size_bytes), 0) as total_size,
    COALESCE(AVG(size_bytes), 0) as avg_file_size,
    COALESCE(MAX(size_bytes), 0) as largest_file,
    COUNT(DISTINCT extension) as unique_extensions,
    COUNT(DISTINCT media_kind) as unique_media_kinds,
    COUNT(content_hash) as hashed_files
FROM files WHERE volume_id = ?;

-- name: GetMediaKindStats :many
SELECT 
    media_kind,
    COUNT(*) as file_count,
    COALESCE(SUM(size_bytes), 0) as total_size,
    COALESCE(AVG(size_bytes), 0) as avg_size
FROM files 
WHERE volume_id = ? AND media_kind IS NOT NULL
GROUP BY media_kind
ORDER BY file_count DESC;

-- name: GetExtensionStats :many
SELECT 
    extension,
    COUNT(*) as file_count,
    COALESCE(SUM(size_bytes), 0) as total_size,
    COALESCE(AVG(size_bytes), 0) as avg_size
FROM files 
WHERE volume_id = ? AND extension IS NOT NULL
GROUP BY extension
ORDER BY file_count DESC
LIMIT ?;

-- name: BulkInsertFiles :execrows
INSERT INTO files (
    volume_id, folder_id, path, path_hash, name, extension, mime, 
    size_bytes, modified_at, accessed_at, mode, owner_uid, owner_gid, 
    content_hash, is_text, is_binary, media_kind
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);

-- name: CreateFile :one
INSERT INTO files (
    volume_id, folder_id, path, path_hash, name, extension, mime, 
    size_bytes, modified_at, accessed_at, mode, owner_uid, owner_gid, 
    content_hash, is_text, is_binary, media_kind
) VALUES (
    ?, ?, ?, ?, ?, ?, ?, 
    ?, ?, ?, ?, ?, ?, 
    ?, ?, ?, ?
) RETURNING *;

-- name: GetFile :one
SELECT * FROM files WHERE id = ?;

-- name: GetFileByPath :one
SELECT * FROM files WHERE volume_id = ? AND path = ?;

-- name: ListFiles :many
SELECT * FROM files 
WHERE volume_id = ?
ORDER BY path
LIMIT ? OFFSET ?;

-- name: UpdateFile :one
UPDATE files 
SET 
    size_bytes = ?,
    modified_at = ?,
    accessed_at = ?,
    content_hash = ?,
    last_scan_at = CURRENT_TIMESTAMP
WHERE id = ?
RETURNING *;

-- name: DeleteFile :exec
DELETE FROM files WHERE id = ?;

-- name: DeleteFilesByVolume :exec
DELETE FROM files WHERE volume_id = ?;

-- name: CountFilesByVolume :one
SELECT COUNT(*) FROM files WHERE volume_id = ?;

-- name: GetTotalSizeByVolume :one
SELECT COALESCE(SUM(size_bytes), 0) as total_size FROM files WHERE volume_id = ?;

-- name: GetLargestFiles :many
SELECT id, volume_id, path, name, size_bytes, modified_at
FROM files 
WHERE volume_id = ?
ORDER BY size_bytes DESC
LIMIT ?;

-- name: GetDuplicateFilesBySize :many
SELECT size_bytes, COUNT(*) as count, GROUP_CONCAT(path) as paths
FROM files 
WHERE volume_id = ? AND size_bytes > 0
GROUP BY size_bytes
HAVING COUNT(*) > 1
ORDER BY size_bytes DESC
LIMIT ?;

-- name: GetFilesByExtension :many
SELECT extension, COUNT(*) as count, COALESCE(SUM(size_bytes), 0) as total_size
FROM files 
WHERE volume_id = ? AND extension IS NOT NULL
GROUP BY extension
ORDER BY count DESC
LIMIT ?;

-- name: GetDistinctMimeTypes :many
SELECT mime as mime_type, COUNT(*) as count
FROM files 
WHERE volume_id = ? AND mime IS NOT NULL
GROUP BY mime
ORDER BY count DESC;

-- name: GetDistinctMediaKinds :many
SELECT media_kind, COUNT(*) as count
FROM files 
WHERE volume_id = ? AND media_kind IS NOT NULL
GROUP BY media_kind
ORDER BY count DESC;

-- name: GetDistinctExtensions :many
SELECT extension, COUNT(*) as count
FROM files 
WHERE volume_id = ? AND extension IS NOT NULL
GROUP BY extension
ORDER BY count DESC
LIMIT ?;

-- name: SearchFilesByName :many
SELECT * FROM files
WHERE volume_id = ? AND name LIKE '%' || ? || '%'
ORDER BY name
LIMIT ? OFFSET ?;

-- name: GetFilesByMimeType :many
SELECT * FROM files
WHERE volume_id = ? AND mime = ?
ORDER BY path
LIMIT ? OFFSET ?;

-- name: GetFilesByExtensionFiles :many
SELECT * FROM files
WHERE volume_id = ? AND extension = ?
ORDER BY path
LIMIT ? OFFSET ?;

-- name: GetDuplicateFilesContent :many
SELECT files.* FROM files WHERE files.volume_id = ? AND files.content_hash IS NOT NULL AND files.content_hash IN (
    SELECT f.content_hash FROM files f WHERE f.volume_id = ? AND f.content_hash IS NOT NULL
    GROUP BY f.content_hash HAVING COUNT(*) > 1
) ORDER BY files.content_hash, files.path;

-- name: GetFilesByMediaKind :many
SELECT * FROM files
WHERE volume_id = ? AND media_kind = ?
ORDER BY path
LIMIT ? OFFSET ?;

-- Retention queries for cleanup
-- name: DeleteOldFiles :exec
DELETE FROM files 
WHERE last_scan_at < ?
  AND last_scan_at IS NOT NULL;

-- name: CountOldFiles :one
SELECT COUNT(*) FROM files 
WHERE last_scan_at < ?
  AND last_scan_at IS NOT NULL;