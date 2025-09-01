-- Preview management queries for SQLite

-- name: CreatePreview :one
INSERT INTO file_previews (
    file_id, preview_type, file_path, file_size,
    width, height, format, status, generated_at
) VALUES (
    ?, ?, ?, ?, ?, ?, ?, ?, ?
) RETURNING *;

-- name: GetPreview :one
SELECT * FROM file_previews WHERE id = ?;

-- name: GetPreviewByFileID :one
SELECT * FROM file_previews WHERE file_id = ? AND preview_type = ?;

-- name: ListPreviews :many
SELECT * FROM file_previews
WHERE file_id IN (SELECT value FROM json_each(?))
ORDER BY generated_at DESC
LIMIT ? OFFSET ?;

-- name: UpdatePreview :one
UPDATE file_previews
SET 
    file_path = ?,
    file_size = ?,
    width = ?,
    height = ?,
    format = ?,
    status = ?,
    generated_at = ?
WHERE id = ?
RETURNING *;

-- name: DeletePreview :exec
DELETE FROM file_previews WHERE id = ?;

-- name: DeletePreviewsByFileID :exec
DELETE FROM file_previews WHERE file_id = ?;

-- name: GetStaleFailedPreviews :many
SELECT * FROM file_previews
WHERE status = 'failed'
AND generated_at < datetime('now', '-30 days')
ORDER BY generated_at ASC
LIMIT ?;

-- name: ListPreviewsByStatus :many
SELECT * FROM file_previews
WHERE status = ?
ORDER BY generated_at DESC
LIMIT ? OFFSET ?;

-- name: CountPreviewsByStatus :one
SELECT COUNT(*) FROM file_previews WHERE status = ?;

-- name: GetPreviewStats :one
SELECT 
    COUNT(*) as total_previews,
    SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_previews,
    SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_previews,
    SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_previews,
    COALESCE(SUM(file_size), 0) as total_size
FROM file_previews;

-- name: CleanupStalePreviews :exec
DELETE FROM file_previews
WHERE status = 'failed'
AND generated_at < datetime('now', '-30 days');