-- name: CreatePreview :one
INSERT INTO previews (
    file_id, type, size, format, width, height, file_size, 
    content_hash, storage_path, time_offset, processing_ms
) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11
) RETURNING *;

-- name: GetPreviewByID :one
SELECT * FROM previews WHERE id = $1;

-- name: GetPreviewByStoragePath :one
SELECT * FROM previews WHERE storage_path = $1;

-- name: GetPreviewByContentHash :one
SELECT * FROM previews WHERE content_hash = $1;

-- name: GetPreviewsForFile :many
SELECT * FROM previews 
WHERE file_id = $1 
ORDER BY type, size;

-- name: GetPreviewForFileByTypeSize :one
SELECT * FROM previews 
WHERE file_id = $1 AND type = $2 AND size = $3 
  AND (time_offset = $4 OR ($4 = 0 AND time_offset IS NULL))
LIMIT 1;

-- name: UpdatePreviewAccessTime :exec
UPDATE previews 
SET accessed_at = CURRENT_TIMESTAMP 
WHERE id = $1;

-- name: UpdatePreviewAccessTimeByPath :exec
UPDATE previews 
SET accessed_at = CURRENT_TIMESTAMP 
WHERE storage_path = $1;

-- name: DeletePreview :exec
DELETE FROM previews WHERE id = $1;

-- name: DeletePreviewByStoragePath :exec
DELETE FROM previews WHERE storage_path = $1;

-- name: DeletePreviewsForFile :exec
DELETE FROM previews WHERE file_id = $1;

-- name: GetOldPreviews :many
SELECT * FROM previews 
WHERE accessed_at < $1 
ORDER BY accessed_at ASC 
LIMIT $2;

-- name: GetPreviewsByType :many
SELECT * FROM previews 
WHERE type = $1 
ORDER BY created_at DESC 
LIMIT $2 OFFSET $3;

-- name: GetPreviewStats :one
SELECT 
    COUNT(*) as total_previews,
    SUM(file_size) as total_size_bytes,
    AVG(processing_ms) as avg_processing_ms,
    MIN(created_at) as oldest_preview,
    MAX(created_at) as newest_preview
FROM previews;

-- name: GetPreviewStatsByType :many
SELECT 
    type,
    size,
    COUNT(*) as count,
    SUM(file_size) as total_size,
    AVG(processing_ms) as avg_processing_ms
FROM previews 
GROUP BY type, size 
ORDER BY type, size;

-- name: GetMostAccessedPreviews :many
SELECT * FROM previews 
ORDER BY accessed_at DESC 
LIMIT $1;

-- name: GetLeastAccessedPreviews :many
SELECT * FROM previews 
ORDER BY accessed_at ASC 
LIMIT $1;

-- name: UpdatePreviewStatsIncrement :exec
UPDATE preview_stats 
SET 
    total_generated = total_generated + $1,
    total_size_bytes = total_size_bytes + $2,
    cache_hits = cache_hits + $3,
    cache_misses = cache_misses + $4,
    recorded_at = CURRENT_TIMESTAMP
WHERE id = 1;

-- name: GetPreviewStatsRecord :one
SELECT * FROM preview_stats WHERE id = 1;

-- name: UpdatePreviewStatsCleanup :exec
UPDATE preview_stats 
SET 
    last_cleanup = CURRENT_TIMESTAMP,
    recorded_at = CURRENT_TIMESTAMP
WHERE id = 1;

-- name: CleanupOrphanedPreviews :exec
DELETE FROM previews 
WHERE file_id NOT IN (SELECT id FROM files);

-- name: GetPreviewsNeedingCleanup :many
SELECT storage_path, file_size FROM previews 
WHERE accessed_at < $1;

-- name: BulkDeletePreviews :exec
DELETE FROM previews 
WHERE storage_path = ANY($1::text[]);

-- name: GetPreviewCountByFileIDs :many
SELECT file_id, COUNT(*) as preview_count 
FROM previews 
WHERE file_id = ANY($1::bigint[])
GROUP BY file_id;