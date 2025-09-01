-- File metadata queries for SQLite

-- name: CreateFileMetadata :one
INSERT INTO file_metadata (
    file_id, raw_metadata, extracted_at, extractor_version, 
    extraction_duration_ms, error_message
) VALUES (
    ?, ?, ?, ?, ?, ?
) RETURNING *;

-- name: GetFileMetadata :one
SELECT * FROM file_metadata WHERE file_id = ?;

-- name: UpdateFileMetadata :one
UPDATE file_metadata
SET 
    raw_metadata = ?,
    extracted_at = ?,
    extractor_version = ?,
    extraction_duration_ms = ?,
    error_message = ?
WHERE file_id = ?
RETURNING *;

-- name: DeleteFileMetadata :exec
DELETE FROM file_metadata WHERE file_id = ?;

-- name: DeleteFileMetadataByVolume :exec
DELETE FROM file_metadata 
WHERE file_id IN (
    SELECT id FROM files WHERE volume_id = ?
);

-- name: ListFileMetadata :many
SELECT fm.*, f.volume_id, f.path, f.name 
FROM file_metadata fm
JOIN files f ON fm.file_id = f.id
WHERE f.volume_id = ?
ORDER BY f.path
LIMIT ? OFFSET ?;

-- name: GetFileMetadataWithFile :one
SELECT fm.*, f.volume_id, f.path, f.name, f.size_bytes, f.modified_at
FROM file_metadata fm
JOIN files f ON fm.file_id = f.id
WHERE fm.file_id = ?;

-- Retention queries for cleanup
-- name: DeleteOldFileMetadata :exec
DELETE FROM file_metadata 
WHERE extracted_at < ?
  AND extracted_at IS NOT NULL;

-- name: CountOldFileMetadata :one
SELECT COUNT(*) FROM file_metadata 
WHERE extracted_at < ?
  AND extracted_at IS NOT NULL;