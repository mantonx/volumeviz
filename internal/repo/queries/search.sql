-- Search Queries
-- Advanced file search with filters and sorting

-- name: SearchFiles :many
SELECT f.id, f.volume_id, f.path, f.name, f.size_bytes, f.disk_usage_bytes,
       f.extension, f.mime, f.media_kind, f.mtime, f.ctime,
       f.duration_ms, f.width, f.height, f.video_codec, f.audio_codec,
       f.gps_latitude, f.gps_longitude, f.camera_model, f.capture_datetime,
       f.hash
FROM files f
WHERE 
    -- Text search filter
    (CASE WHEN @search_query::text = '' THEN true 
          ELSE (f.name ILIKE '%' || @search_query || '%' OR f.path ILIKE '%' || @search_query || '%') END)
    -- Path prefix filter  
    AND (CASE WHEN @path_prefix::text = '' THEN true 
              ELSE f.path LIKE @path_prefix || '%' END)
    -- Media kind filter
    AND (CASE WHEN @media_kind::text = '' THEN true 
              ELSE f.media_kind = @media_kind END)
    -- MIME type filter (supports comma-separated values)
    AND (CASE WHEN @mime_type::text = '' THEN true 
              ELSE f.mime = ANY(string_to_array(@mime_type, ',')) END)
    -- Size range filters
    AND (CASE WHEN @min_size::bigint = 0 THEN true 
              ELSE f.size_bytes >= @min_size END)
    AND (CASE WHEN @max_size::bigint = 0 THEN true 
              ELSE f.size_bytes <= @max_size END)
    -- Time range filters
    AND (CASE WHEN @mtime_from::timestamptz IS NULL THEN true 
              ELSE f.mtime >= @mtime_from END)
    AND (CASE WHEN @mtime_to::timestamptz IS NULL THEN true 
              ELSE f.mtime <= @mtime_to END)
    -- Duration filters
    AND (CASE WHEN @duration_from::bigint = 0 THEN true 
              ELSE f.duration_ms >= @duration_from END)
    AND (CASE WHEN @duration_to::bigint = 0 THEN true 
              ELSE f.duration_ms <= @duration_to END)
    -- Dimension filters
    AND (CASE WHEN @min_width::int = 0 THEN true 
              ELSE f.width >= @min_width END)
    AND (CASE WHEN @max_width::int = 0 THEN true 
              ELSE f.width <= @max_width END)
    AND (CASE WHEN @min_height::int = 0 THEN true 
              ELSE f.height >= @min_height END)
    AND (CASE WHEN @max_height::int = 0 THEN true 
              ELSE f.height <= @max_height END)
    -- Boolean filters
    AND (CASE WHEN @has_gps::boolean IS NULL THEN true
              WHEN @has_gps = true THEN (f.gps_latitude IS NOT NULL AND f.gps_longitude IS NOT NULL)
              ELSE (f.gps_latitude IS NULL OR f.gps_longitude IS NULL) END)
    AND (CASE WHEN @has_subs::boolean IS NULL THEN true
              WHEN @has_subs = true THEN f.subtitle_language IS NOT NULL
              ELSE f.subtitle_language IS NULL END)
    AND (CASE WHEN @has_hash::boolean IS NULL THEN true
              WHEN @has_hash = true THEN f.hash IS NOT NULL
              ELSE f.hash IS NULL END)
ORDER BY 
    -- Relevance (search query match quality) - only when we have a search query
    CASE WHEN @sort_field::text = 'relevance' AND @search_query::text != '' AND @sort_order::text = 'desc' THEN 
        (CASE 
            WHEN f.name ILIKE @search_query THEN 100  -- Exact match
            WHEN f.name ILIKE @search_query || '%' THEN 90  -- Starts with query
            WHEN f.name ILIKE '%' || @search_query || '%' THEN 80  -- Contains query
            WHEN f.path ILIKE '%' || @search_query || '%' THEN 70  -- Path contains query
            ELSE 50  -- Default match
        END)
    END DESC,
    
    -- Name sorting
    CASE WHEN @sort_field::text = 'name' AND @sort_order::text = 'asc' THEN f.name END ASC,
    CASE WHEN @sort_field::text = 'name' AND @sort_order::text = 'desc' THEN f.name END DESC,
    
    -- File size sorting
    CASE WHEN @sort_field::text = 'size' AND @sort_order::text = 'asc' THEN f.size_bytes END ASC,
    CASE WHEN @sort_field::text = 'size' AND @sort_order::text = 'desc' THEN f.size_bytes END DESC,
    
    -- Modified time sorting  
    CASE WHEN @sort_field::text = 'mtime' AND @sort_order::text = 'asc' THEN f.mtime END ASC,
    CASE WHEN @sort_field::text = 'mtime' AND @sort_order::text = 'desc' THEN f.mtime END DESC,
    
    -- Created time sorting
    CASE WHEN @sort_field::text = 'ctime' AND @sort_order::text = 'asc' THEN f.ctime END ASC,
    CASE WHEN @sort_field::text = 'ctime' AND @sort_order::text = 'desc' THEN f.ctime END DESC,
    
    -- Duration sorting (for media files)
    CASE WHEN @sort_field::text = 'duration' AND @sort_order::text = 'asc' THEN f.duration_ms END ASC,
    CASE WHEN @sort_field::text = 'duration' AND @sort_order::text = 'desc' THEN f.duration_ms END DESC,
    
    -- File type/extension sorting
    CASE WHEN @sort_field::text = 'type' AND @sort_order::text = 'asc' THEN f.extension END ASC,
    CASE WHEN @sort_field::text = 'type' AND @sort_order::text = 'desc' THEN f.extension END DESC,
    
    -- Media kind sorting  
    CASE WHEN @sort_field::text = 'media_kind' AND @sort_order::text = 'asc' THEN f.media_kind END ASC,
    CASE WHEN @sort_field::text = 'media_kind' AND @sort_order::text = 'desc' THEN f.media_kind END DESC,
    
    -- Default fallback: relevance if search query exists, otherwise name
    CASE WHEN @search_query::text != '' THEN 
        (CASE 
            WHEN f.name ILIKE @search_query THEN 100
            WHEN f.name ILIKE @search_query || '%' THEN 90
            WHEN f.name ILIKE '%' || @search_query || '%' THEN 80
            WHEN f.path ILIKE '%' || @search_query || '%' THEN 70
            ELSE 50
        END)
    END DESC,
    f.name ASC
LIMIT @page_limit OFFSET @page_offset;

-- name: CountSearchFiles :one
SELECT COUNT(*)
FROM files f
WHERE 
    -- Same filters as SearchFiles but without sorting/pagination
    (CASE WHEN @search_query::text = '' THEN true 
          ELSE (f.name ILIKE '%' || @search_query || '%' OR f.path ILIKE '%' || @search_query || '%') END)
    AND (CASE WHEN @path_prefix::text = '' THEN true 
              ELSE f.path LIKE @path_prefix || '%' END)
    AND (CASE WHEN @media_kind::text = '' THEN true 
              ELSE f.media_kind = @media_kind END)
    AND (CASE WHEN @mime_type::text = '' THEN true 
              ELSE f.mime = ANY(string_to_array(@mime_type, ',')) END)
    AND (CASE WHEN @min_size::bigint = 0 THEN true 
              ELSE f.size_bytes >= @min_size END)
    AND (CASE WHEN @max_size::bigint = 0 THEN true 
              ELSE f.size_bytes <= @max_size END)
    AND (CASE WHEN @mtime_from::timestamptz IS NULL THEN true 
              ELSE f.mtime >= @mtime_from END)
    AND (CASE WHEN @mtime_to::timestamptz IS NULL THEN true 
              ELSE f.mtime <= @mtime_to END)
    AND (CASE WHEN @duration_from::bigint = 0 THEN true 
              ELSE f.duration_ms >= @duration_from END)
    AND (CASE WHEN @duration_to::bigint = 0 THEN true 
              ELSE f.duration_ms <= @duration_to END)
    AND (CASE WHEN @min_width::int = 0 THEN true 
              ELSE f.width >= @min_width END)
    AND (CASE WHEN @max_width::int = 0 THEN true 
              ELSE f.width <= @max_width END)
    AND (CASE WHEN @min_height::int = 0 THEN true 
              ELSE f.height >= @min_height END)
    AND (CASE WHEN @max_height::int = 0 THEN true 
              ELSE f.height <= @max_height END)
    AND (CASE WHEN @has_gps::boolean IS NULL THEN true
              WHEN @has_gps = true THEN (f.gps_latitude IS NOT NULL AND f.gps_longitude IS NOT NULL)
              ELSE (f.gps_latitude IS NULL OR f.gps_longitude IS NULL) END)
    AND (CASE WHEN @has_subs::boolean IS NULL THEN true
              WHEN @has_subs = true THEN f.subtitle_language IS NOT NULL
              ELSE f.subtitle_language IS NULL END)
    AND (CASE WHEN @has_hash::boolean IS NULL THEN true
              WHEN @has_hash = true THEN f.hash IS NOT NULL
              ELSE f.hash IS NULL END);

-- Saved Searches CRUD Operations

-- name: CreateSavedSearch :one
INSERT INTO saved_searches (name, description, query, tags, is_public, metadata)
VALUES (@name, @description, @query, @tags, @is_public, @metadata)
RETURNING id, name, description, query, tags, is_public, metadata, 
          created_at, updated_at, last_run_at, run_count;

-- name: ListSavedSearches :many
SELECT id, name, description, query, tags, is_public, metadata,
       created_at, updated_at, last_run_at, run_count
FROM saved_searches
WHERE 
    (CASE WHEN @filter_tags::text[] IS NULL THEN true
          ELSE tags && @filter_tags END)
ORDER BY updated_at DESC
LIMIT @page_limit OFFSET @page_offset;

-- name: CountSavedSearches :one
SELECT COUNT(*)
FROM saved_searches
WHERE 
    (CASE WHEN @filter_tags::text[] IS NULL THEN true
          ELSE tags && @filter_tags END);

-- name: GetSavedSearch :one
SELECT id, name, description, query, tags, is_public, metadata,
       created_at, updated_at, last_run_at, run_count
FROM saved_searches
WHERE id = @id;

-- name: UpdateSavedSearch :one
UPDATE saved_searches 
SET 
    name = COALESCE(@name, name),
    description = COALESCE(@description, description),
    query = COALESCE(@query, query),
    tags = COALESCE(@tags, tags),
    is_public = COALESCE(@is_public, is_public),
    metadata = COALESCE(@metadata, metadata)
WHERE id = @id
RETURNING id, name, description, query, tags, is_public, metadata,
          created_at, updated_at, last_run_at, run_count;

-- name: DeleteSavedSearch :exec
DELETE FROM saved_searches WHERE id = @id;

-- name: UpdateSavedSearchStats :exec
UPDATE saved_searches 
SET last_run_at = NOW(), run_count = run_count + 1
WHERE id = @id;

-- name: GetSavedSearchQuery :one
SELECT query FROM saved_searches WHERE id = @id;