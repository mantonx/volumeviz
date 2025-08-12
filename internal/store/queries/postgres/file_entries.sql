-- name: GetFileEntry :one
SELECT id, volume_id, parent_dir_id, name, size_bytes, mtime, ctime, inode, uid, gid, type, hidden, path_hash, created_at, updated_at
FROM file_entries 
WHERE id = $1 AND volume_id = $2;

-- name: GetFileEntriesByVolumeAndParent :many
SELECT id, volume_id, parent_dir_id, name, size_bytes, mtime, ctime, inode, uid, gid, type, hidden, path_hash, created_at, updated_at
FROM file_entries 
WHERE volume_id = $1 AND parent_dir_id = $2
ORDER BY name ASC;

-- name: GetLargestFiles :many
SELECT id, volume_id, parent_dir_id, name, size_bytes, mtime, ctime, inode, uid, gid, type, hidden, path_hash, created_at, updated_at
FROM file_entries 
WHERE volume_id = $1 AND type = 'file'
ORDER BY size_bytes DESC
LIMIT $2;

-- name: FindFilesByPathHash :many
SELECT id, volume_id, parent_dir_id, name, size_bytes, mtime, ctime, inode, uid, gid, type, hidden, path_hash, created_at, updated_at
FROM file_entries 
WHERE volume_id = $1 AND path_hash = $2;

-- name: CreateFileEntry :one
INSERT INTO file_entries (
    volume_id, parent_dir_id, name, size_bytes, mtime, ctime, 
    inode, uid, gid, type, hidden, path_hash
) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12
) RETURNING id, volume_id, parent_dir_id, name, size_bytes, mtime, ctime, inode, uid, gid, type, hidden, path_hash, created_at, updated_at;

-- name: BulkInsertFileEntries :copyfrom
INSERT INTO file_entries (
    volume_id, parent_dir_id, name, size_bytes, mtime, ctime, 
    inode, uid, gid, type, hidden, path_hash
) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12
);

-- name: UpsertFileEntry :one
INSERT INTO file_entries (
    volume_id, parent_dir_id, name, size_bytes, mtime, ctime, 
    inode, uid, gid, type, hidden, path_hash
) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12
) ON CONFLICT (volume_id, path_hash) DO UPDATE SET
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
    updated_at = CURRENT_TIMESTAMP
RETURNING id, volume_id, parent_dir_id, name, size_bytes, mtime, ctime, inode, uid, gid, type, hidden, path_hash, created_at, updated_at;

-- name: DeleteFileEntriesByVolume :exec
DELETE FROM file_entries WHERE volume_id = $1;

-- name: CountFileEntriesByVolume :one
SELECT COUNT(*) FROM file_entries WHERE volume_id = $1;

-- name: GetVolumeFileStats :one
SELECT 
    COUNT(*) as total_files,
    COALESCE(SUM(size_bytes), 0) as total_size,
    COUNT(*) FILTER (WHERE type = 'file') as regular_files,
    COUNT(*) FILTER (WHERE type = 'dir') as directories,
    COUNT(*) FILTER (WHERE hidden = true) as hidden_files
FROM file_entries 
WHERE volume_id = $1;