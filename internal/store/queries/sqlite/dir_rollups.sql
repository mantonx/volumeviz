-- name: GetDirRollup :one
SELECT id, dir_id, size_bytes, file_count, computed_at, created_at
FROM dir_rollups 
WHERE id = ?;

-- name: GetLatestDirRollup :one
SELECT id, dir_id, size_bytes, file_count, computed_at, created_at
FROM dir_rollups 
WHERE dir_id = ?
ORDER BY computed_at DESC
LIMIT 1;

-- name: GetDirRollupHistory :many
SELECT id, dir_id, size_bytes, file_count, computed_at, created_at
FROM dir_rollups 
WHERE dir_id = ?
ORDER BY computed_at DESC
LIMIT ?;

-- name: GetDirRollupsInTimeRange :many
SELECT id, dir_id, size_bytes, file_count, computed_at, created_at
FROM dir_rollups 
WHERE dir_id = ? AND computed_at >= ? AND computed_at <= ?
ORDER BY computed_at DESC;

-- name: CreateDirRollup :one
INSERT INTO dir_rollups (
    dir_id, size_bytes, file_count, computed_at
) VALUES (
    ?, ?, ?, ?
) RETURNING id, dir_id, size_bytes, file_count, computed_at, created_at;

-- name: BulkInsertDirRollup :exec
INSERT INTO dir_rollups (
    dir_id, size_bytes, file_count, computed_at
) VALUES (
    ?, ?, ?, ?
);

-- name: DeleteOldRollups :exec
DELETE FROM dir_rollups WHERE computed_at < ?;

-- name: DeleteRollupsByDirId :exec
DELETE FROM dir_rollups WHERE dir_id = ?;

-- name: CountRollupsByDirId :one
SELECT COUNT(*) FROM dir_rollups WHERE dir_id = ?;

-- name: GetRollupStats :one
SELECT 
    COUNT(*) as total_rollups,
    COUNT(DISTINCT dir_id) as directories_with_rollups,
    MIN(computed_at) as oldest_rollup,
    MAX(computed_at) as newest_rollup
FROM dir_rollups;