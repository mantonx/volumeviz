-- Search queries for PostgreSQL

-- name: SearchFiles :many
SELECT f.id, f.volume_id, f.path, f.name, f.extension, f.size_bytes, 
       f.mime, f.media_kind, f.created_at, f.modified_at, f.accessed_at
FROM files f
WHERE 1=1
    AND (sqlc.narg(volume_id)::text = '' OR f.volume_id = sqlc.narg(volume_id))
    AND (sqlc.narg(search_query)::text = '' OR f.name ILIKE '%' || sqlc.narg(search_query) || '%')
    AND (sqlc.narg(path_prefix)::text = '' OR f.path ILIKE '%' || sqlc.narg(path_prefix) || '%')
    AND (sqlc.narg(extension)::text = '' OR f.extension = sqlc.narg(extension))
    AND (sqlc.narg(mime_type)::text = '' OR f.mime = sqlc.narg(mime_type))
    AND (sqlc.narg(media_kind)::text = '' OR f.media_kind = sqlc.narg(media_kind))
    AND (sqlc.narg(min_size)::bigint = 0 OR f.size_bytes >= sqlc.narg(min_size))
    AND (sqlc.narg(max_size)::bigint = 0 OR f.size_bytes <= sqlc.narg(max_size))
    AND (sqlc.narg(mtime_from)::timestamptz IS NULL OR f.modified_at >= sqlc.narg(mtime_from))
    AND (sqlc.narg(mtime_to)::timestamptz IS NULL OR f.modified_at <= sqlc.narg(mtime_to))
    AND (sqlc.narg(ctime_from)::timestamptz IS NULL OR f.created_at >= sqlc.narg(ctime_from))
    AND (sqlc.narg(ctime_to)::timestamptz IS NULL OR f.created_at <= sqlc.narg(ctime_to))
ORDER BY f.modified_at DESC NULLS LAST
LIMIT sqlc.arg(result_limit) OFFSET sqlc.arg(result_offset);

-- name: SearchFoldersSimple :many
SELECT * FROM folders
WHERE volume_id = sqlc.arg(volume_id)
    AND (sqlc.narg(name_query)::text = '' OR name ILIKE '%' || sqlc.narg(name_query) || '%')
    AND (sqlc.narg(path_query)::text = '' OR path ILIKE '%' || sqlc.narg(path_query) || '%')
ORDER BY path
LIMIT sqlc.arg(result_limit) OFFSET sqlc.arg(result_offset);

-- name: CountSearchFiles :one
SELECT COUNT(*) FROM files f
WHERE 1=1
    AND (sqlc.narg(volume_id)::text = '' OR f.volume_id = sqlc.narg(volume_id))
    AND (sqlc.narg(search_query)::text = '' OR f.name ILIKE '%' || sqlc.narg(search_query) || '%')
    AND (sqlc.narg(path_prefix)::text = '' OR f.path ILIKE '%' || sqlc.narg(path_prefix) || '%')
    AND (sqlc.narg(extension)::text = '' OR f.extension = sqlc.narg(extension))
    AND (sqlc.narg(mime_type)::text = '' OR f.mime = sqlc.narg(mime_type))
    AND (sqlc.narg(media_kind)::text = '' OR f.media_kind = sqlc.narg(media_kind))
    AND (sqlc.narg(min_size)::bigint = 0 OR f.size_bytes >= sqlc.narg(min_size))
    AND (sqlc.narg(max_size)::bigint = 0 OR f.size_bytes <= sqlc.narg(max_size))
    AND (sqlc.narg(mtime_from)::timestamptz IS NULL OR f.modified_at >= sqlc.narg(mtime_from))
    AND (sqlc.narg(mtime_to)::timestamptz IS NULL OR f.modified_at <= sqlc.narg(mtime_to))
    AND (sqlc.narg(ctime_from)::timestamptz IS NULL OR f.created_at >= sqlc.narg(ctime_from))
    AND (sqlc.narg(ctime_to)::timestamptz IS NULL OR f.created_at <= sqlc.narg(ctime_to));

-- =============================================================================
-- SAVED SEARCHES QUERIES
-- =============================================================================

-- name: CreateSavedSearch :one
INSERT INTO saved_searches (
    name, description, query, tags, is_public, metadata, organization_id
) VALUES (
    sqlc.arg(name), 
    sqlc.narg(description),
    sqlc.arg(query),
    sqlc.narg(tags),
    sqlc.narg(is_public),
    sqlc.narg(metadata),
    sqlc.arg(organization_id)
) RETURNING *;

-- name: ListSavedSearches :many
SELECT * FROM saved_searches
WHERE organization_id = sqlc.arg(organization_id)
    AND (sqlc.narg(filter_tags)::text[] IS NULL OR tags && sqlc.narg(filter_tags)::text[])
ORDER BY updated_at DESC
LIMIT sqlc.arg(result_limit) OFFSET sqlc.arg(result_offset);

-- name: CountSavedSearches :one
SELECT COUNT(*) FROM saved_searches
WHERE organization_id = sqlc.arg(organization_id)
    AND (sqlc.narg(filter_tags)::text[] IS NULL OR tags && sqlc.narg(filter_tags)::text[]);

-- name: GetSavedSearch :one
SELECT * FROM saved_searches WHERE id = sqlc.arg(id) AND organization_id = sqlc.arg(organization_id);

-- name: UpdateSavedSearch :one
UPDATE saved_searches 
SET 
    name = COALESCE(sqlc.narg(name), name),
    description = COALESCE(sqlc.narg(description), description),
    query = COALESCE(sqlc.narg(query), query),
    tags = COALESCE(sqlc.narg(tags), tags),
    is_public = COALESCE(sqlc.narg(is_public), is_public),
    metadata = COALESCE(sqlc.narg(metadata), metadata),
    updated_at = CURRENT_TIMESTAMP
WHERE id = sqlc.arg(id) AND organization_id = sqlc.arg(organization_id)
RETURNING *;

-- name: DeleteSavedSearch :exec
DELETE FROM saved_searches WHERE id = sqlc.arg(id) AND organization_id = sqlc.arg(organization_id);

-- name: UpdateSavedSearchStats :exec
UPDATE saved_searches 
SET 
    run_count = run_count + 1,
    last_run_at = CURRENT_TIMESTAMP,
    updated_at = CURRENT_TIMESTAMP
WHERE id = sqlc.arg(id) AND organization_id = sqlc.arg(organization_id);

-- name: GetSavedSearchQuery :one
SELECT query FROM saved_searches WHERE id = sqlc.arg(id) AND organization_id = sqlc.arg(organization_id);

