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

-- Metadata filtering queries
-- name: GetFilesByResolution :many
SELECT f.id, f.name, f.path, f.size_bytes, f.mime,
       (fm.raw_metadata->>'width')::int as width,
       (fm.raw_metadata->>'height')::int as height
FROM files f
INNER JOIN file_metadata fm ON f.id = fm.file_id
WHERE f.volume_id = $1
  AND fm.raw_metadata ? 'width'
  AND fm.raw_metadata ? 'height'
  AND (sqlc.narg('min_width')::int IS NULL OR (fm.raw_metadata->>'width')::int >= sqlc.narg('min_width')::int)
  AND (sqlc.narg('max_width')::int IS NULL OR (fm.raw_metadata->>'width')::int <= sqlc.narg('max_width')::int)
  AND (sqlc.narg('min_height')::int IS NULL OR (fm.raw_metadata->>'height')::int >= sqlc.narg('min_height')::int)
  AND (sqlc.narg('max_height')::int IS NULL OR (fm.raw_metadata->>'height')::int <= sqlc.narg('max_height')::int)
ORDER BY f.size_bytes DESC
LIMIT $2 OFFSET $3;

-- name: CountFilesByResolution :one
SELECT COUNT(*)
FROM files f
INNER JOIN file_metadata fm ON f.id = fm.file_id
WHERE f.volume_id = $1
  AND fm.raw_metadata ? 'width'
  AND fm.raw_metadata ? 'height'
  AND (sqlc.narg('min_width')::int IS NULL OR (fm.raw_metadata->>'width')::int >= sqlc.narg('min_width')::int)
  AND (sqlc.narg('max_width')::int IS NULL OR (fm.raw_metadata->>'width')::int <= sqlc.narg('max_width')::int)
  AND (sqlc.narg('min_height')::int IS NULL OR (fm.raw_metadata->>'height')::int >= sqlc.narg('min_height')::int)
  AND (sqlc.narg('max_height')::int IS NULL OR (fm.raw_metadata->>'height')::int <= sqlc.narg('max_height')::int);

-- name: GetFilesByDuration :many
SELECT f.id, f.name, f.path, f.size_bytes, f.mime,
       (fm.raw_metadata->>'duration')::float as duration
FROM files f
INNER JOIN file_metadata fm ON f.id = fm.file_id
WHERE f.volume_id = $1
  AND fm.raw_metadata ? 'duration'
  AND (sqlc.narg('min_duration')::float IS NULL OR (fm.raw_metadata->>'duration')::float >= sqlc.narg('min_duration')::float)
  AND (sqlc.narg('max_duration')::float IS NULL OR (fm.raw_metadata->>'duration')::float <= sqlc.narg('max_duration')::float)
ORDER BY (fm.raw_metadata->>'duration')::float DESC
LIMIT $2 OFFSET $3;

-- name: CountFilesByDuration :one
SELECT COUNT(*)
FROM files f
INNER JOIN file_metadata fm ON f.id = fm.file_id
WHERE f.volume_id = $1
  AND fm.raw_metadata ? 'duration'
  AND (sqlc.narg('min_duration')::float IS NULL OR (fm.raw_metadata->>'duration')::float >= sqlc.narg('min_duration')::float)
  AND (sqlc.narg('max_duration')::float IS NULL OR (fm.raw_metadata->>'duration')::float <= sqlc.narg('max_duration')::float);

-- name: GetFilesByLocation :many
SELECT f.id, f.name, f.path, f.size_bytes, f.mime,
       (fm.raw_metadata->>'latitude')::float as latitude,
       (fm.raw_metadata->>'longitude')::float as longitude
FROM files f
INNER JOIN file_metadata fm ON f.id = fm.file_id
WHERE f.volume_id = $1
  AND fm.raw_metadata ? 'latitude'
  AND fm.raw_metadata ? 'longitude'
  AND (fm.raw_metadata->>'latitude')::float IS NOT NULL
  AND (fm.raw_metadata->>'longitude')::float IS NOT NULL
ORDER BY f.path
LIMIT $2 OFFSET $3;

-- name: CountFilesByLocation :one
SELECT COUNT(*)
FROM files f
INNER JOIN file_metadata fm ON f.id = fm.file_id
WHERE f.volume_id = $1
  AND fm.raw_metadata ? 'latitude'
  AND fm.raw_metadata ? 'longitude'
  AND (fm.raw_metadata->>'latitude')::float IS NOT NULL
  AND (fm.raw_metadata->>'longitude')::float IS NOT NULL;

-- Enrichment queries
-- name: GetUnenrichedFiles :many
SELECT f.id, f.volume_id, f.path, f.name, f.mime, f.size_bytes, f.modified_at
FROM files f
LEFT JOIN file_metadata fm ON f.id = fm.file_id
WHERE f.volume_id = $1
  AND fm.id IS NULL
  AND (
    f.mime LIKE 'video/%' OR
    f.mime LIKE 'audio/%' OR
    f.mime LIKE 'image/%' OR
    f.extension IN ('srt', 'vtt', 'ass', 'ssa', 'sub')
  )
ORDER BY f.path
LIMIT $2;

-- name: GetUnenrichedFilesPaginated :many
SELECT f.id, f.volume_id, f.path, f.name, f.mime, f.size_bytes, f.modified_at
FROM files f
LEFT JOIN file_metadata fm ON f.id = fm.file_id
WHERE f.volume_id = $1
  AND fm.id IS NULL
  AND (
    f.mime LIKE 'video/%' OR
    f.mime LIKE 'audio/%' OR
    f.mime LIKE 'image/%' OR
    f.extension IN ('srt', 'vtt', 'ass', 'ssa', 'sub')
  )
ORDER BY f.path
LIMIT $2 OFFSET $3;

-- name: GetUnenrichedFileCount :one
SELECT COUNT(*)
FROM files f
LEFT JOIN file_metadata fm ON f.id = fm.file_id
WHERE f.volume_id = $1
  AND fm.id IS NULL
  AND (
    f.mime LIKE 'video/%' OR
    f.mime LIKE 'audio/%' OR
    f.mime LIKE 'image/%' OR
    f.extension IN ('srt', 'vtt', 'ass', 'ssa', 'sub')
  );