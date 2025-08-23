-- name: CreateFileMetadata :one
INSERT INTO file_metadata (
    file_id,
    kind,
    data_json,
    enriched_at
) VALUES (
    $1, $2, $3, $4
) RETURNING *;

-- name: GetFileMetadata :many
SELECT * FROM file_metadata
WHERE file_id = $1
ORDER BY enriched_at DESC;

-- name: GetFileMetadataByKind :one
SELECT * FROM file_metadata
WHERE file_id = $1 AND kind = $2
ORDER BY enriched_at DESC
LIMIT 1;

-- name: BulkInsertFileMetadata :exec
INSERT INTO file_metadata (
    file_id,
    kind,
    data_json,
    enriched_at
) VALUES (
    unnest($1::bigint[]),
    unnest($2::text[]),
    unnest($3::jsonb[]),
    unnest($4::timestamptz[])
);

-- name: DeleteFileMetadataByFileID :exec
DELETE FROM file_metadata WHERE file_id = $1;

-- name: DeleteFileMetadataByVolumeID :exec
DELETE FROM file_metadata
WHERE file_id IN (
    SELECT id FROM files WHERE volume_id = $1
);

-- name: GetEnrichedFilesByVolume :many
SELECT
    f.*,
    CASE
        WHEN f.duration_ms IS NOT NULL THEN 'video/audio'
        WHEN f.capture_datetime IS NOT NULL THEN 'image'
        WHEN f.subtitle_language IS NOT NULL THEN 'subtitle'
        ELSE 'unenriched'
    END as enrichment_status
FROM files f
WHERE f.volume_id = $1
AND (
    f.duration_ms IS NOT NULL OR
    f.capture_datetime IS NOT NULL OR
    f.subtitle_language IS NOT NULL
)
ORDER BY f.path;

-- name: GetFilesByMediaType :many
SELECT * FROM files
WHERE volume_id = $1
AND mime LIKE $2
ORDER BY path;

-- name: GetVideoFilesByResolution :many
SELECT * FROM files
WHERE volume_id = $1
AND mime LIKE 'video/%'
AND width >= $2
AND height >= $3
ORDER BY width DESC, height DESC;

-- name: GetImageFilesByDateRange :many
SELECT * FROM files
WHERE volume_id = $1
AND mime LIKE 'image/%'
AND capture_datetime BETWEEN $2 AND $3
ORDER BY capture_datetime DESC;

-- name: GetFilesByDurationRange :many
SELECT * FROM files
WHERE volume_id = $1
AND duration_ms BETWEEN $2 AND $3
ORDER BY duration_ms DESC;

-- name: GetHDRFiles :many
SELECT * FROM files
WHERE volume_id = $1
AND hdr_format != 'none'
ORDER BY hdr_format, path;

-- name: GetFilesWithGPS :many
SELECT * FROM files
WHERE volume_id = $1
AND gps_latitude IS NOT NULL
AND gps_longitude IS NOT NULL
ORDER BY path;

-- name: GetSubtitleFiles :many
SELECT * FROM files
WHERE volume_id = $1
AND subtitle_language IS NOT NULL
ORDER BY subtitle_language, path;

-- name: GetMediaStatistics :one
SELECT
    COUNT(*) as total_files,
    COUNT(*) FILTER (WHERE
        duration_ms IS NOT NULL OR
        capture_datetime IS NOT NULL OR
        subtitle_language IS NOT NULL
    ) as enriched_files,
    COUNT(*) FILTER (WHERE mime LIKE 'video/%') as video_files,
    COUNT(*) FILTER (WHERE mime LIKE 'audio/%') as audio_files,
    COUNT(*) FILTER (WHERE mime LIKE 'image/%') as image_files,
    COUNT(*) FILTER (WHERE subtitle_language IS NOT NULL) as subtitle_files,
    COALESCE(SUM(duration_ms) / 1000.0 / 3600.0, 0) as total_duration_hours,
    COALESCE(SUM(COALESCE(width, 0)::bigint * COALESCE(height, 0)::bigint), 0) as total_resolution_pixels,
    COUNT(*) FILTER (WHERE hdr_format != 'none') as hdr_files,
    COUNT(*) FILTER (WHERE gps_latitude IS NOT NULL AND gps_longitude IS NOT NULL) as gps_enabled_files
FROM files
WHERE volume_id = $1;

-- name: GetUnenrichedFiles :many
SELECT * FROM files
WHERE volume_id = $1
AND mime IN (
    -- Video types that should be enriched
    'video/mp4', 'video/x-msvideo', 'video/x-matroska', 'video/quicktime', 'video/x-ms-wmv', 'video/x-flv', 'video/webm',
    -- Audio types that should be enriched
    'audio/mpeg', 'audio/flac', 'audio/wav', 'audio/aac', 'audio/ogg', 'audio/mp4',
    -- Image types that should be enriched
    'image/jpeg', 'image/png', 'image/tiff', 'image/bmp', 'image/webp', 'image/heic',
    -- Subtitle types that should be enriched
    'text/vtt', 'application/x-subrip', 'text/x-ssa', 'text/x-ass'
)
AND (
    -- Video/audio files missing duration or codec info
    (mime LIKE 'video/%' OR mime LIKE 'audio/%') AND (duration_ms IS NULL OR video_codec IS NULL OR audio_codec IS NULL)
    OR
    -- Image files missing dimensions or EXIF data
    mime LIKE 'image/%' AND (width IS NULL OR height IS NULL OR capture_datetime IS NULL)
    OR
    -- Subtitle files missing subtitle info
    mime IN ('text/vtt', 'application/x-subrip', 'text/x-ssa', 'text/x-ass') AND subtitle_language IS NULL
)
ORDER BY size_bytes DESC
LIMIT $2;

-- name: GetEnrichmentProgress :one
SELECT
    COUNT(*) as total_enrichable,
    COUNT(*) FILTER (WHERE
        duration_ms IS NOT NULL OR
        capture_datetime IS NOT NULL OR
        subtitle_language IS NOT NULL
    ) as enriched_count,
    COUNT(DISTINCT fm.file_id) as files_with_metadata
FROM files f
LEFT JOIN file_metadata fm ON f.id = fm.file_id
WHERE f.volume_id = $1
AND f.mime IN (
    'video/mp4', 'video/x-msvideo', 'video/x-matroska', 'video/quicktime', 'video/x-ms-wmv', 'video/x-flv', 'video/webm',
    'audio/mpeg', 'audio/flac', 'audio/wav', 'audio/aac', 'audio/ogg', 'audio/mp4',
    'image/jpeg', 'image/jpg', 'image/png', 'image/tiff', 'image/bmp', 'image/webp', 'image/heic',
    'text/vtt', 'application/x-subrip', 'text/x-ssa', 'text/x-ass'
);

-- name: UpdateFileEnrichedColumns :exec
UPDATE files SET
    duration_ms = $2,
    bitrate_kbps = $3,
    width = $4,
    height = $5,
    fps = $6,
    color_primaries = $7,
    transfer_characteristic = $8,
    hdr_format = $9,
    capture_datetime = $10,
    camera_make = $11,
    camera_model = $12,
    lens_model = $13,
    orientation = $14,
    gps_latitude = $15,
    gps_longitude = $16,
    subtitle_language = $17,
    subtitle_format = $18,
    cue_count = $19,
    coverage_percent = $20,
    audio_channels = $21,
    audio_codec = $22,
    audio_sample_rate = $23,
    video_codec = $24,
    video_profile = $25,
    video_level = $26
WHERE id = $1;

-- name: GetFilesByResolution :many
SELECT f.id, f.folder_id, f.volume_id, f.name, f.path, f.extension, f.size_bytes, f.disk_usage_bytes,
       f.mtime, f.ctime, f.birthtime, f.uid, f.gid, f.mode, f.inode, f.device,
       f.is_symlink, f.symlink_target, f.mime, f.media_kind, f.encoding, f.hash_algo, f.hash, f.path_hash,
       f.created_at, f.updated_at
FROM files f
JOIN file_metadata fm ON f.id = fm.file_id
WHERE f.volume_id = $1
  AND (fm.data_json->>'width')::int = $2
  AND (fm.data_json->>'height')::int = $3
ORDER BY f.name
LIMIT $4 OFFSET $5;

-- name: GetFilesByDuration :many
SELECT f.id, f.folder_id, f.volume_id, f.name, f.path, f.extension, f.size_bytes, f.disk_usage_bytes,
       f.mtime, f.ctime, f.birthtime, f.uid, f.gid, f.mode, f.inode, f.device,
       f.is_symlink, f.symlink_target, f.mime, f.media_kind, f.encoding, f.hash_algo, f.hash, f.path_hash,
       f.created_at, f.updated_at
FROM files f
JOIN file_metadata fm ON f.id = fm.file_id
WHERE f.volume_id = $1
  AND (fm.data_json->>'duration')::float >= $2
  AND (fm.data_json->>'duration')::float <= $3
ORDER BY (fm.data_json->>'duration')::float DESC
LIMIT $4 OFFSET $5;

-- name: GetFilesByGPS :many
SELECT f.id, f.folder_id, f.volume_id, f.name, f.path, f.extension, f.size_bytes, f.disk_usage_bytes,
       f.mtime, f.ctime, f.birthtime, f.uid, f.gid, f.mode, f.inode, f.device,
       f.is_symlink, f.symlink_target, f.mime, f.media_kind, f.encoding, f.hash_algo, f.hash, f.path_hash,
       f.created_at, f.updated_at
FROM files f
JOIN file_metadata fm ON f.id = fm.file_id
WHERE f.volume_id = $1
  AND fm.data_json ? 'location'
  AND fm.data_json->>'location' IS NOT NULL
ORDER BY f.name
LIMIT $2 OFFSET $3;
