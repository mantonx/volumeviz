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

-- name: BulkInsertFileEntry :exec
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
) ON CONFLICT (volume_id, path_hash) DO UPDATE SET
    parent_dir_id = excluded.parent_dir_id,
    name = excluded.name,
    size_bytes = excluded.size_bytes,
    mtime = excluded.mtime,
    ctime = excluded.ctime,
    inode = excluded.inode,
    uid = excluded.uid,
    gid = excluded.gid,
    type = excluded.type,
    hidden = excluded.hidden,
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
    COUNT(CASE WHEN type = 'file' THEN 1 END) as regular_files,
    COUNT(CASE WHEN type = 'dir' THEN 1 END) as directories,
    COUNT(CASE WHEN hidden = 1 THEN 1 END) as hidden_files
FROM file_entries 
WHERE volume_id = ?;