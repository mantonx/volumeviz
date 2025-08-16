-- files.sql: File record operations
-- This file contains all SQLC queries for file management

-- =======================
-- FILE OPERATIONS
-- =======================

-- name: CreateFile :one
INSERT INTO files (
    folder_id, volume_id, name, path, extension, size_bytes, disk_usage_bytes,
    mtime, ctime, birthtime, uid, gid, mode, inode, device,
    is_symlink, symlink_target, mime, media_kind, encoding, hash_algo, hash, path_hash
) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23
) RETURNING id, created_at, updated_at;

-- name: GetFileByID :one
SELECT id, folder_id, volume_id, name, path, extension, size_bytes, disk_usage_bytes,
       mtime, ctime, birthtime, uid, gid, mode, inode, device,
       is_symlink, symlink_target, mime, media_kind, encoding, hash_algo, hash, path_hash,
       created_at, updated_at
FROM files
WHERE id = $1;

-- name: GetFileByPath :one
SELECT id, folder_id, volume_id, name, path, extension, size_bytes, disk_usage_bytes,
       mtime, ctime, birthtime, uid, gid, mode, inode, device,
       is_symlink, symlink_target, mime, media_kind, encoding, hash_algo, hash, path_hash,
       created_at, updated_at
FROM files
WHERE volume_id = $1 AND path_hash = $2;

-- name: ListFilesByFolder :many
SELECT id, folder_id, volume_id, name, path, extension, size_bytes, disk_usage_bytes,
       mtime, ctime, birthtime, uid, gid, mode, inode, device,
       is_symlink, symlink_target, mime, media_kind, encoding, hash_algo, hash, path_hash,
       created_at, updated_at
FROM files
WHERE folder_id = $1
ORDER BY name
LIMIT $2 OFFSET $3;

-- name: ListFilesByVolume :many
SELECT id, folder_id, volume_id, name, path, extension, size_bytes, disk_usage_bytes,
       mtime, ctime, birthtime, uid, gid, mode, inode, device,
       is_symlink, symlink_target, mime, media_kind, encoding, hash_algo, hash, path_hash,
       created_at, updated_at
FROM files
WHERE volume_id = $1
ORDER BY path
LIMIT $2 OFFSET $3;

-- name: GetLargestFiles :many
SELECT id, folder_id, volume_id, name, path, extension, size_bytes, disk_usage_bytes,
       mtime, ctime, birthtime, uid, gid, mode, inode, device,
       is_symlink, symlink_target, mime, media_kind, encoding, hash_algo, hash, path_hash,
       created_at, updated_at
FROM files
WHERE volume_id = $1
ORDER BY size_bytes DESC
LIMIT $2;

-- name: GetFilesByMediaKind :many
SELECT id, folder_id, volume_id, name, path, extension, size_bytes, disk_usage_bytes,
       mtime, ctime, birthtime, uid, gid, mode, inode, device,
       is_symlink, symlink_target, mime, media_kind, encoding, hash_algo, hash, path_hash,
       created_at, updated_at
FROM files
WHERE volume_id = $1 AND media_kind = $2
ORDER BY size_bytes DESC
LIMIT $3 OFFSET $4;

-- name: GetFilesByExtension :many
SELECT id, folder_id, volume_id, name, path, extension, size_bytes, disk_usage_bytes,
       mtime, ctime, birthtime, uid, gid, mode, inode, device,
       is_symlink, symlink_target, mime, media_kind, encoding, hash_algo, hash, path_hash,
       created_at, updated_at
FROM files
WHERE volume_id = $1 AND extension = $2
ORDER BY size_bytes DESC
LIMIT $3 OFFSET $4;

-- name: GetFilesByMimeType :many
SELECT id, folder_id, volume_id, name, path, extension, size_bytes, disk_usage_bytes,
       mtime, ctime, birthtime, uid, gid, mode, inode, device,
       is_symlink, symlink_target, mime, media_kind, encoding, hash_algo, hash, path_hash,
       created_at, updated_at
FROM files
WHERE volume_id = $1 AND mime = $2
ORDER BY size_bytes DESC
LIMIT $3 OFFSET $4;

-- name: GetDuplicateFiles :many
SELECT f.id, f.folder_id, f.volume_id, f.name, f.path, f.extension, f.size_bytes, f.disk_usage_bytes,
       f.mtime, f.ctime, f.birthtime, f.uid, f.gid, f.mode, f.inode, f.device,
       f.is_symlink, f.symlink_target, f.mime, f.media_kind, f.encoding, f.hash_algo, f.hash, f.path_hash,
       f.created_at, f.updated_at
FROM files f
WHERE f.volume_id = $1 AND f.hash_algo = $2 AND f.hash IS NOT NULL
  AND f.hash IN (
    SELECT f2.hash
    FROM files f2
    WHERE f2.volume_id = $1 AND f2.hash_algo = $2 AND f2.hash IS NOT NULL
    GROUP BY f2.hash
    HAVING COUNT(*) > 1
  )
ORDER BY f.hash, f.size_bytes DESC;

-- name: GetRecentFiles :many
SELECT id, folder_id, volume_id, name, path, extension, size_bytes, disk_usage_bytes,
       mtime, ctime, birthtime, uid, gid, mode, inode, device,
       is_symlink, symlink_target, mime, media_kind, encoding, hash_algo, hash, path_hash,
       created_at, updated_at
FROM files
WHERE volume_id = $1 AND mtime > $2
ORDER BY mtime DESC
LIMIT $3;

-- name: UpdateFileMetadata :exec
UPDATE files
SET
    size_bytes = $2,
    disk_usage_bytes = $3,
    mtime = $4,
    ctime = $5,
    birthtime = $6,
    uid = $7,
    gid = $8,
    mode = $9,
    updated_at = CURRENT_TIMESTAMP
WHERE id = $1;

-- name: UpdateFileHash :exec
UPDATE files
SET
    hash_algo = $2,
    hash = $3,
    updated_at = CURRENT_TIMESTAMP
WHERE id = $1;

-- name: UpdateFileMime :exec
UPDATE files
SET
    mime = $2,
    media_kind = $3,
    encoding = $4,
    updated_at = CURRENT_TIMESTAMP
WHERE id = $1;

-- name: DeleteFile :exec
DELETE FROM files WHERE id = $1;

-- name: DeleteFilesByFolder :exec
DELETE FROM files WHERE folder_id = $1;

-- name: DeleteFilesByVolume :exec
DELETE FROM files WHERE volume_id = $1;

-- name: CountFilesByVolume :one
SELECT COUNT(*) FROM files WHERE volume_id = $1;

-- name: CountFilesByFolder :one
SELECT COUNT(*) FROM files WHERE folder_id = $1;

-- name: GetFileStats :one
SELECT
    COUNT(*) as total_files,
    COALESCE(SUM(size_bytes), 0)::bigint as total_size,
    COALESCE(AVG(size_bytes), 0.0)::double precision as avg_file_size,
    COALESCE(MAX(size_bytes), 0)::bigint as largest_file,
    COUNT(DISTINCT extension) as unique_extensions,
    COUNT(DISTINCT media_kind) as unique_media_kinds,
    COUNT(*) FILTER (WHERE hash IS NOT NULL) as hashed_files
FROM files
WHERE volume_id = $1;

-- name: GetMediaKindStats :many
SELECT
    media_kind,
    COUNT(*) as file_count,
    SUM(size_bytes) as total_size,
    AVG(size_bytes) as avg_size
FROM files
WHERE volume_id = $1 AND media_kind IS NOT NULL
GROUP BY media_kind
ORDER BY total_size DESC;

-- name: GetExtensionStats :many
SELECT
    extension,
    COUNT(*) as file_count,
    SUM(size_bytes) as total_size,
    AVG(size_bytes) as avg_size
FROM files
WHERE volume_id = $1 AND extension IS NOT NULL
GROUP BY extension
ORDER BY total_size DESC
LIMIT $2;

-- name: UpsertFile :one
INSERT INTO files (
    folder_id, volume_id, name, path, extension, size_bytes, disk_usage_bytes,
    mtime, ctime, birthtime, uid, gid, mode, inode, device,
    is_symlink, symlink_target, mime, media_kind, encoding, hash_algo, hash, path_hash
) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23
)
ON CONFLICT (volume_id, path_hash)
DO UPDATE SET
    folder_id = EXCLUDED.folder_id,
    name = EXCLUDED.name,
    path = EXCLUDED.path,
    extension = EXCLUDED.extension,
    size_bytes = EXCLUDED.size_bytes,
    disk_usage_bytes = EXCLUDED.disk_usage_bytes,
    mtime = EXCLUDED.mtime,
    ctime = EXCLUDED.ctime,
    birthtime = EXCLUDED.birthtime,
    uid = EXCLUDED.uid,
    gid = EXCLUDED.gid,
    mode = EXCLUDED.mode,
    inode = EXCLUDED.inode,
    device = EXCLUDED.device,
    is_symlink = EXCLUDED.is_symlink,
    symlink_target = EXCLUDED.symlink_target,
    mime = EXCLUDED.mime,
    media_kind = EXCLUDED.media_kind,
    encoding = EXCLUDED.encoding,
    hash_algo = EXCLUDED.hash_algo,
    hash = EXCLUDED.hash,
    updated_at = CURRENT_TIMESTAMP
RETURNING id, created_at, updated_at;

-- name: BulkInsertFiles :copyfrom
INSERT INTO files (
    folder_id, volume_id, name, path, extension, size_bytes, disk_usage_bytes,
    mtime, ctime, birthtime, uid, gid, mode, inode, device,
    is_symlink, symlink_target, mime, media_kind, encoding, hash_algo, hash, path_hash
) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23
);

-- name: GetFilesModifiedSince :many
SELECT id, folder_id, volume_id, name, path, extension, size_bytes, disk_usage_bytes,
       mtime, ctime, birthtime, uid, gid, mode, inode, device,
       is_symlink, symlink_target, mime, media_kind, encoding, hash_algo, hash, path_hash,
       created_at, updated_at
FROM files
WHERE volume_id = $1 AND (mtime > $2 OR ctime > $2)
ORDER BY mtime DESC;

-- name: SearchFilesByName :many
SELECT id, folder_id, volume_id, name, path, extension, size_bytes, disk_usage_bytes,
       mtime, ctime, birthtime, uid, gid, mode, inode, device,
       is_symlink, symlink_target, mime, media_kind, encoding, hash_algo, hash, path_hash,
       created_at, updated_at
FROM files
WHERE volume_id = $1 AND name ILIKE $2
ORDER BY name
LIMIT $3;

-- name: GetFilesBySize :many
SELECT id, folder_id, volume_id, name, path, extension, size_bytes, disk_usage_bytes,
       mtime, ctime, birthtime, uid, gid, mode, inode, device,
       is_symlink, symlink_target, mime, media_kind, encoding, hash_algo, hash, path_hash,
       created_at, updated_at
FROM files
WHERE volume_id = $1 AND size_bytes >= $2 AND size_bytes <= $3
ORDER BY size_bytes DESC
LIMIT $4;
