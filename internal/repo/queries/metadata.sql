-- Metadata Queries
-- Get distinct values for filter dropdowns

-- name: GetDistinctMimeTypes :many
SELECT DISTINCT mime AS mime_type, COUNT(*) as file_count
FROM files 
WHERE mime IS NOT NULL AND mime != ''
GROUP BY mime
ORDER BY file_count DESC, mime ASC;

-- name: GetDistinctMediaKinds :many
SELECT DISTINCT media_kind, COUNT(*) as file_count
FROM files 
WHERE media_kind IS NOT NULL AND media_kind != ''
GROUP BY media_kind
ORDER BY file_count DESC, media_kind ASC;

-- name: GetDistinctExtensions :many
SELECT DISTINCT extension, COUNT(*) as file_count
FROM files 
WHERE extension IS NOT NULL AND extension != ''
GROUP BY extension
ORDER BY file_count DESC, extension ASC
LIMIT 50; -- Limit to top 50 most common extensions