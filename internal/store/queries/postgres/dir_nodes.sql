-- name: GetDirNode :one
SELECT id, volume_id, parent_dir_id, name, full_path, depth, latest_size_bytes, latest_file_count, created_at, updated_at
FROM dir_nodes 
WHERE id = $1 AND volume_id = $2;

-- name: GetDirNodeByPath :one
SELECT id, volume_id, parent_dir_id, name, full_path, depth, latest_size_bytes, latest_file_count, created_at, updated_at
FROM dir_nodes 
WHERE volume_id = $1 AND full_path = $2;

-- name: GetChildDirNodes :many
SELECT id, volume_id, parent_dir_id, name, full_path, depth, latest_size_bytes, latest_file_count, created_at, updated_at
FROM dir_nodes 
WHERE volume_id = $1 AND parent_dir_id = $2
ORDER BY name ASC;

-- name: GetRootDirNodes :many
SELECT id, volume_id, parent_dir_id, name, full_path, depth, latest_size_bytes, latest_file_count, created_at, updated_at
FROM dir_nodes 
WHERE volume_id = $1 AND parent_dir_id IS NULL
ORDER BY name ASC;

-- name: GetLargestDirectories :many
SELECT id, volume_id, parent_dir_id, name, full_path, depth, latest_size_bytes, latest_file_count, created_at, updated_at
FROM dir_nodes 
WHERE volume_id = $1
ORDER BY latest_size_bytes DESC
LIMIT $2;

-- name: CreateDirNode :one
INSERT INTO dir_nodes (
    volume_id, parent_dir_id, name, full_path, depth, 
    latest_size_bytes, latest_file_count
) VALUES (
    $1, $2, $3, $4, $5, $6, $7
) RETURNING id, volume_id, parent_dir_id, name, full_path, depth, latest_size_bytes, latest_file_count, created_at, updated_at;

-- name: BulkInsertDirNodes :copyfrom
INSERT INTO dir_nodes (
    volume_id, parent_dir_id, name, full_path, depth, 
    latest_size_bytes, latest_file_count
) VALUES (
    $1, $2, $3, $4, $5, $6, $7
);

-- name: UpsertDirNode :one
INSERT INTO dir_nodes (
    volume_id, parent_dir_id, name, full_path, depth, 
    latest_size_bytes, latest_file_count
) VALUES (
    $1, $2, $3, $4, $5, $6, $7
) ON CONFLICT (volume_id, full_path) DO UPDATE SET
    parent_dir_id = EXCLUDED.parent_dir_id,
    name = EXCLUDED.name,
    depth = EXCLUDED.depth,
    latest_size_bytes = EXCLUDED.latest_size_bytes,
    latest_file_count = EXCLUDED.latest_file_count,
    updated_at = CURRENT_TIMESTAMP
RETURNING id, volume_id, parent_dir_id, name, full_path, depth, latest_size_bytes, latest_file_count, created_at, updated_at;

-- name: UpdateDirNodeStats :exec
UPDATE dir_nodes 
SET latest_size_bytes = $3, latest_file_count = $4, updated_at = CURRENT_TIMESTAMP 
WHERE id = $1 AND volume_id = $2;

-- name: DeleteDirNodesByVolume :exec
DELETE FROM dir_nodes WHERE volume_id = $1;

-- name: CountDirNodesByVolume :one
SELECT COUNT(*) FROM dir_nodes WHERE volume_id = $1;

