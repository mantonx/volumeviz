-- Search queries for SQLite

-- name: SearchFiles :many
SELECT f.id, f.volume_id, f.path, f.name, f.extension, f.size_bytes, 
       f.mime, f.media_kind, f.created_at, f.modified_at, f.accessed_at
FROM files f
WHERE 1=1
    AND (sqlc.narg(volume_id) = '' OR f.volume_id = sqlc.narg(volume_id))
    AND (sqlc.narg(search_query) = '' OR f.name LIKE '%' || sqlc.narg(search_query) || '%')
    AND (sqlc.narg(path_prefix) = '' OR f.path LIKE '%' || sqlc.narg(path_prefix) || '%')
    AND (sqlc.narg(extension) = '' OR f.extension = sqlc.narg(extension))
    AND (sqlc.narg(mime_type) = '' OR f.mime = sqlc.narg(mime_type))
    AND (sqlc.narg(media_kind) = '' OR f.media_kind = sqlc.narg(media_kind))
    AND (sqlc.narg(min_size) = 0 OR f.size_bytes >= sqlc.narg(min_size))
    AND (sqlc.narg(max_size) = 0 OR f.size_bytes <= sqlc.narg(max_size))
    AND (sqlc.narg(mtime_from) IS NULL OR f.modified_at >= sqlc.narg(mtime_from))
    AND (sqlc.narg(mtime_to) IS NULL OR f.modified_at <= sqlc.narg(mtime_to))
    AND (sqlc.narg(ctime_from) IS NULL OR f.created_at >= sqlc.narg(ctime_from))
    AND (sqlc.narg(ctime_to) IS NULL OR f.created_at <= sqlc.narg(ctime_to))
ORDER BY f.modified_at DESC
LIMIT sqlc.arg(result_limit) OFFSET sqlc.arg(result_offset);

-- name: SearchFoldersSimple :many
SELECT * FROM folders
WHERE volume_id = sqlc.arg(volume_id)
    AND (sqlc.narg(name_query) = '' OR name LIKE '%' || sqlc.narg(name_query) || '%')
    AND (sqlc.narg(path_query) = '' OR path LIKE '%' || sqlc.narg(path_query) || '%')
ORDER BY path
LIMIT sqlc.arg(result_limit) OFFSET sqlc.arg(result_offset);

-- name: CountSearchFiles :one
SELECT COUNT(*) FROM files f
WHERE 1=1
    AND (sqlc.narg(volume_id) = '' OR f.volume_id = sqlc.narg(volume_id))
    AND (sqlc.narg(search_query) = '' OR f.name LIKE '%' || sqlc.narg(search_query) || '%')
    AND (sqlc.narg(path_prefix) = '' OR f.path LIKE '%' || sqlc.narg(path_prefix) || '%')
    AND (sqlc.narg(extension) = '' OR f.extension = sqlc.narg(extension))
    AND (sqlc.narg(mime_type) = '' OR f.mime = sqlc.narg(mime_type))
    AND (sqlc.narg(media_kind) = '' OR f.media_kind = sqlc.narg(media_kind))
    AND (sqlc.narg(min_size) = 0 OR f.size_bytes >= sqlc.narg(min_size))
    AND (sqlc.narg(max_size) = 0 OR f.size_bytes <= sqlc.narg(max_size))
    AND (sqlc.narg(mtime_from) IS NULL OR f.modified_at >= sqlc.narg(mtime_from))
    AND (sqlc.narg(mtime_to) IS NULL OR f.modified_at <= sqlc.narg(mtime_to))
    AND (sqlc.narg(ctime_from) IS NULL OR f.created_at >= sqlc.narg(ctime_from))
    AND (sqlc.narg(ctime_to) IS NULL OR f.created_at <= sqlc.narg(ctime_to));

-- =============================================================================
-- SAVED SEARCHES QUERIES
-- =============================================================================

-- name: CreateSavedSearch :one
INSERT INTO saved_searches (
    name, description, query, tags, is_public, metadata
) VALUES (
    sqlc.arg(name), 
    sqlc.narg(description),
    sqlc.arg(query),
    sqlc.narg(tags),
    sqlc.narg(is_public),
    sqlc.narg(metadata)
) RETURNING *;

-- name: ListSavedSearches :many
SELECT * FROM saved_searches
WHERE 1=1
    AND (sqlc.narg(filter_tags_json) IS NULL OR 
         EXISTS (
             SELECT 1 FROM json_each(sqlc.narg(filter_tags_json)) AS filter_tag
             WHERE EXISTS (
                 SELECT 1 FROM json_each(saved_searches.tags) AS saved_tag
                 WHERE saved_tag.value = filter_tag.value
             )
         ))
ORDER BY updated_at DESC
LIMIT sqlc.arg(result_limit) OFFSET sqlc.arg(result_offset);

-- name: CountSavedSearches :one
SELECT COUNT(*) FROM saved_searches
WHERE 1=1
    AND (sqlc.narg(filter_tags_json) IS NULL OR 
         EXISTS (
             SELECT 1 FROM json_each(sqlc.narg(filter_tags_json)) AS filter_tag
             WHERE EXISTS (
                 SELECT 1 FROM json_each(saved_searches.tags) AS saved_tag
                 WHERE saved_tag.value = filter_tag.value
             )
         ));

-- name: GetSavedSearch :one
SELECT * FROM saved_searches WHERE id = sqlc.arg(id);

-- name: UpdateSavedSearch :one
UPDATE saved_searches 
SET 
    name = COALESCE(sqlc.narg(name), name),
    description = COALESCE(sqlc.narg(description), description),
    query = COALESCE(sqlc.narg(query), query),
    tags = COALESCE(sqlc.narg(tags), tags),
    is_public = COALESCE(sqlc.narg(is_public), is_public),
    metadata = COALESCE(sqlc.narg(metadata), metadata),
    updated_at = datetime('now')
WHERE id = sqlc.arg(id)
RETURNING *;

-- name: DeleteSavedSearch :exec
DELETE FROM saved_searches WHERE id = sqlc.arg(id);

-- name: UpdateSavedSearchStats :exec
UPDATE saved_searches 
SET 
    run_count = run_count + 1,
    last_run_at = datetime('now'),
    updated_at = datetime('now')
WHERE id = sqlc.arg(id);

-- name: GetSavedSearchQuery :one
SELECT query FROM saved_searches WHERE id = sqlc.arg(id);

