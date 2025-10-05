-- Checkpoint repository queries for scan resume capability

-- name: CreateCheckpoint :one
INSERT INTO scan_checkpoints (
    scan_id,
    volume_id,
    checkpoint_type,
    phase,
    progress,
    items_processed,
    bytes_processed,
    errors_count,
    last_path,
    last_depth,
    last_folder_id,
    resume_data
) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12
)
ON CONFLICT (scan_id, checkpoint_type)
DO UPDATE SET
    phase = EXCLUDED.phase,
    progress = EXCLUDED.progress,
    items_processed = EXCLUDED.items_processed,
    bytes_processed = EXCLUDED.bytes_processed,
    errors_count = EXCLUDED.errors_count,
    last_path = EXCLUDED.last_path,
    last_depth = EXCLUDED.last_depth,
    last_folder_id = EXCLUDED.last_folder_id,
    resume_data = EXCLUDED.resume_data,
    updated_at = NOW()
RETURNING *;

-- name: GetCheckpoint :one
SELECT * FROM scan_checkpoints
WHERE scan_id = $1 AND checkpoint_type = $2
ORDER BY updated_at DESC
LIMIT 1;

-- name: GetLatestCheckpointForScan :one
SELECT * FROM scan_checkpoints
WHERE scan_id = $1
ORDER BY updated_at DESC
LIMIT 1;

-- name: GetAllCheckpointsForScan :many
SELECT * FROM scan_checkpoints
WHERE scan_id = $1
ORDER BY checkpoint_type, updated_at DESC;

-- name: GetCheckpointsByVolume :many
SELECT * FROM scan_checkpoints
WHERE volume_id = $1
ORDER BY updated_at DESC
LIMIT $2;

-- name: DeleteCheckpoint :exec
DELETE FROM scan_checkpoints
WHERE scan_id = $1 AND checkpoint_type = $2;

-- name: DeleteAllCheckpointsForScan :exec
DELETE FROM scan_checkpoints
WHERE scan_id = $1;

-- name: DeleteOldCheckpoints :execrows
DELETE FROM scan_checkpoints
WHERE created_at < $1;

-- name: CountCheckpointsByScan :one
SELECT COUNT(*) FROM scan_checkpoints
WHERE scan_id = $1;

-- name: GetCheckpointStats :one
SELECT
    COUNT(*) as total_checkpoints,
    COUNT(DISTINCT scan_id) as total_scans,
    COUNT(DISTINCT volume_id) as total_volumes,
    AVG(progress) as avg_progress,
    SUM(items_processed) as total_items_processed,
    SUM(bytes_processed) as total_bytes_processed
FROM scan_checkpoints
WHERE created_at > NOW() - INTERVAL '24 hours';
