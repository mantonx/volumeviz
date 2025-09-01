-- File metadata queries for PostgreSQL

-- name: CreateFileMetadata :one
INSERT INTO file_metadata (
    file_id, raw_metadata, extracted_at, extractor_version, 
    extraction_duration_ms, error_message
) VALUES (
    $1, $2, $3, $4, $5, $6
) RETURNING *;

-- name: GetFileMetadata :one
SELECT * FROM file_metadata WHERE file_id = $1;

-- name: UpdateFileMetadata :one
UPDATE file_metadata
SET 
    raw_metadata = $2,
    extracted_at = $3,
    extractor_version = $4,
    extraction_duration_ms = $5,
    error_message = $6
WHERE file_id = $1
RETURNING *;

-- name: DeleteFileMetadata :exec
DELETE FROM file_metadata WHERE file_id = $1;

-- name: DeleteFileMetadataByVolume :exec
DELETE FROM file_metadata 
WHERE file_id IN (
    SELECT id FROM files WHERE volume_id = $1
);

-- name: ListFileMetadata :many
SELECT fm.*, f.volume_id, f.path, f.name 
FROM file_metadata fm
JOIN files f ON fm.file_id = f.id
WHERE f.volume_id = $1
ORDER BY f.path
LIMIT $2 OFFSET $3;

-- name: GetFileMetadataWithFile :one
SELECT fm.*, f.volume_id, f.path, f.name, f.size_bytes, f.modified_at
FROM file_metadata fm
JOIN files f ON fm.file_id = f.id
WHERE fm.file_id = $1;

-- Retention queries for cleanup
-- name: DeleteOldFileMetadata :exec
DELETE FROM file_metadata 
WHERE extracted_at < $1
  AND extracted_at IS NOT NULL;

-- name: CountOldFileMetadata :one
SELECT COUNT(*) FROM file_metadata 
WHERE extracted_at < $1
  AND extracted_at IS NOT NULL;