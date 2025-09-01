-- Preview management queries for PostgreSQL

-- name: CreatePreview :one
INSERT INTO file_previews (
    file_id, preview_type, file_path, file_size,
    width, height, format, status, generated_at
) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8, $9
) RETURNING *;

-- name: GetPreview :one
SELECT * FROM file_previews WHERE id = $1;

-- name: GetPreviewByFileID :one
SELECT * FROM file_previews WHERE file_id = $1 AND preview_type = $2;

-- name: ListPreviews :many
SELECT * FROM file_previews
WHERE file_id = ANY($1::bigint[])
ORDER BY generated_at DESC NULLS LAST
LIMIT $2 OFFSET $3;

-- name: UpdatePreview :one
UPDATE file_previews
SET 
    file_path = $2,
    file_size = $3,
    width = $4,
    height = $5,
    format = $6,
    status = $7,
    generated_at = $8
WHERE id = $1
RETURNING *;

-- name: DeletePreview :exec
DELETE FROM file_previews WHERE id = $1;

-- name: DeletePreviewsByFileID :exec
DELETE FROM file_previews WHERE file_id = $1;

-- name: GetStaleFailedPreviews :many
SELECT * FROM file_previews
WHERE status = 'failed'
AND generated_at < NOW() - INTERVAL '30 days'
ORDER BY generated_at ASC NULLS LAST
LIMIT $1;

-- name: ListPreviewsByStatus :many
SELECT * FROM file_previews
WHERE status = $1
ORDER BY generated_at DESC NULLS LAST
LIMIT $2 OFFSET $3;

-- name: CountPreviewsByStatus :one
SELECT COUNT(*) FROM file_previews WHERE status = $1;

-- name: GetPreviewStats :one
SELECT 
    COUNT(*) as total_previews,
    COUNT(*) FILTER (WHERE status = 'completed') as completed_previews,
    COUNT(*) FILTER (WHERE status = 'failed') as failed_previews,
    COUNT(*) FILTER (WHERE status = 'pending') as pending_previews,
    COALESCE(SUM(file_size), 0) as total_size
FROM file_previews;

-- name: CleanupStalePreviews :exec
DELETE FROM file_previews
WHERE status = 'failed'
AND generated_at < NOW() - INTERVAL '30 days';