-- name: GetDirRollup :one
SELECT id, dir_id, size_bytes, file_count, computed_at, created_at
FROM dir_rollups 
WHERE id = $1;

-- name: GetLatestDirRollup :one
SELECT id, dir_id, size_bytes, file_count, computed_at, created_at
FROM dir_rollups 
WHERE dir_id = $1
ORDER BY computed_at DESC
LIMIT 1;

-- name: GetDirRollupHistory :many
SELECT id, dir_id, size_bytes, file_count, computed_at, created_at
FROM dir_rollups 
WHERE dir_id = $1
ORDER BY computed_at DESC
LIMIT $2;

-- name: GetDirRollupsInTimeRange :many
SELECT id, dir_id, size_bytes, file_count, computed_at, created_at
FROM dir_rollups 
WHERE dir_id = $1 AND computed_at >= $2 AND computed_at <= $3
ORDER BY computed_at DESC;

-- name: CreateDirRollup :one
INSERT INTO dir_rollups (
    dir_id, size_bytes, file_count, computed_at
) VALUES (
    $1, $2, $3, $4
) RETURNING id, dir_id, size_bytes, file_count, computed_at, created_at;

-- name: BulkInsertDirRollups :copyfrom
INSERT INTO dir_rollups (
    dir_id, size_bytes, file_count, computed_at
) VALUES (
    $1, $2, $3, $4
);

-- name: DeleteOldRollups :exec
DELETE FROM dir_rollups WHERE computed_at < $1;

-- name: DeleteRollupsByDirId :exec
DELETE FROM dir_rollups WHERE dir_id = $1;

-- name: CountRollupsByDirId :one
SELECT COUNT(*) FROM dir_rollups WHERE dir_id = $1;

-- name: GetRollupStats :one
SELECT 
    COUNT(*) as total_rollups,
    COUNT(DISTINCT dir_id) as directories_with_rollups,
    MIN(computed_at) as oldest_rollup,
    MAX(computed_at) as newest_rollup
FROM dir_rollups;