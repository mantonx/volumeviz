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

-- name: BulkInsertDirNode :exec
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
) ON CONFLICT (volume_id, full_path) DO UPDATE SET
    parent_dir_id = excluded.parent_dir_id,
    name = excluded.name,
    depth = excluded.depth,
    latest_size_bytes = excluded.latest_size_bytes,
    latest_file_count = excluded.latest_file_count,
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

