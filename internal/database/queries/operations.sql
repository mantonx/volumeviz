-- Operations queries for undo/rollback functionality

-- name: CreateOperation :one
INSERT INTO operations (
    id, type, status, volume_id, description, created_at, metadata
) VALUES (
    $1, $2, $3, $4, $5, $6, $7
) RETURNING *;

-- name: GetOperation :one
SELECT * FROM operations WHERE id = $1;

-- name: GetOperationsByVolume :many
SELECT * FROM operations 
WHERE volume_id = $1
ORDER BY created_at DESC
LIMIT $2 OFFSET $3;

-- name: CountOperationsByVolume :one
SELECT COUNT(*) FROM operations WHERE volume_id = $1;

-- name: UpdateOperationStatus :one
UPDATE operations 
SET status = $2, completed_at = $3
WHERE id = $1
RETURNING *;

-- name: DeleteOperation :exec
DELETE FROM operations WHERE id = $1;

-- name: CreateOperationAction :one
INSERT INTO operation_actions (
    id, operation_id, type, source_path, target_path, file_size, status, backup_path
) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8
) RETURNING *;

-- name: GetOperationActions :many
SELECT * FROM operation_actions 
WHERE operation_id = $1
ORDER BY id;

-- name: UpdateOperationActionStatus :one
UPDATE operation_actions 
SET status = $2, executed_at = $3, error_message = $4
WHERE id = $1
RETURNING *;

-- name: GetOperationAction :one
SELECT * FROM operation_actions WHERE id = $1;

-- name: GetOperationsWithActions :many
SELECT 
    o.*,
    json_agg(
        json_build_object(
            'id', a.id,
            'type', a.type,
            'source_path', a.source_path,
            'target_path', a.target_path,
            'file_size', a.file_size,
            'status', a.status,
            'executed_at', a.executed_at,
            'backup_path', a.backup_path,
            'error_message', a.error_message
        ) ORDER BY a.id
    ) as actions
FROM operations o
LEFT JOIN operation_actions a ON o.id = a.operation_id
WHERE o.volume_id = $1
GROUP BY o.id
ORDER BY o.created_at DESC
LIMIT $2 OFFSET $3;

-- name: CleanupOldOperations :exec
DELETE FROM operations 
WHERE created_at < $1 AND status IN ('completed', 'failed', 'rolled_back');

-- name: GetOperationsByStatus :many
SELECT * FROM operations 
WHERE volume_id = $1 AND status = $2
ORDER BY created_at DESC;

-- name: UpdateOperationMetadata :one
UPDATE operations 
SET metadata = $2
WHERE id = $1
RETURNING *;