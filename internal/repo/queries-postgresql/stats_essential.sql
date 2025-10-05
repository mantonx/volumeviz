-- Essential statistics queries for PostgreSQL

-- name: CreateDailyStat :one
INSERT INTO daily_stats (
    volume_id, date, total_size_bytes, size_change_bytes, growth_percent,
    total_files, new_files, deleted_files, modified_files
) VALUES (
    sqlc.arg(volume_id), sqlc.arg(date), sqlc.arg(total_size_bytes), 
    sqlc.arg(size_change_bytes), sqlc.narg(growth_percent), sqlc.arg(total_files),
    sqlc.narg(new_files), sqlc.narg(deleted_files), sqlc.narg(modified_files)
) RETURNING *;

-- name: InvalidatePreviousVolumeSizes :exec  
UPDATE volume_sizes 
SET calculated_at = calculated_at - INTERVAL '1 year'
WHERE volume_id = sqlc.arg(volume_id) AND calculated_at < CURRENT_TIMESTAMP - INTERVAL '1 day';

-- name: InsertVolumeSize :exec
INSERT INTO volume_sizes (
    volume_id, total_size, file_count, directory_count, largest_file_size,
    smallest_file_size, average_file_size, median_file_size, type_distribution,
    extension_distribution, calculated_at
) VALUES (
    sqlc.arg(volume_id), sqlc.arg(total_size), sqlc.arg(file_count), 
    sqlc.arg(directory_count), sqlc.arg(largest_file_size), sqlc.arg(smallest_file_size),
    sqlc.arg(average_file_size), sqlc.arg(median_file_size), sqlc.arg(type_distribution),
    sqlc.arg(extension_distribution), sqlc.arg(calculated_at)
) ON CONFLICT (volume_id) DO UPDATE SET
    total_size = EXCLUDED.total_size,
    file_count = EXCLUDED.file_count,
    directory_count = EXCLUDED.directory_count,
    largest_file_size = EXCLUDED.largest_file_size,
    smallest_file_size = EXCLUDED.smallest_file_size,
    average_file_size = EXCLUDED.average_file_size,
    median_file_size = EXCLUDED.median_file_size,
    type_distribution = EXCLUDED.type_distribution,
    extension_distribution = EXCLUDED.extension_distribution,
    calculated_at = EXCLUDED.calculated_at;

-- name: GetLatestVolumeSize :one
SELECT * FROM volume_sizes WHERE volume_id = sqlc.arg(volume_id);

-- name: GetDailyStatsForDate :many
SELECT * FROM daily_stats 
WHERE volume_id = sqlc.arg(volume_id) AND date = sqlc.arg(date)
ORDER BY id DESC
LIMIT sqlc.arg(result_limit) OFFSET sqlc.arg(result_offset);

-- name: GetVolumeStatsHistory :many
SELECT * FROM daily_stats
WHERE volume_id = sqlc.arg(volume_id)
    AND date >= sqlc.arg(date_from)
    AND date <= sqlc.arg(date_to)
ORDER BY date DESC
LIMIT sqlc.arg(result_limit) OFFSET sqlc.arg(result_offset);

-- name: ComputeVolumeFileStatistics :one
-- Computes comprehensive file statistics for a volume including min/max/avg/median file sizes
-- and type/extension distributions
WITH file_stats AS (
    SELECT
        COUNT(*) as file_count,
        COALESCE((SELECT COUNT(*) FROM folders fo WHERE fo.volume_id = sqlc.arg(volume_id)), 0) as directory_count,
        COALESCE(SUM(f.size_bytes), 0) as total_size,
        MIN(f.size_bytes) FILTER (WHERE f.size_bytes > 0) as smallest_file_size,
        MAX(f.size_bytes) as largest_file_size,
        AVG(f.size_bytes) FILTER (WHERE f.size_bytes > 0)::bigint as average_file_size,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY f.size_bytes) FILTER (WHERE f.size_bytes > 0)::bigint as median_file_size
    FROM files f
    WHERE f.volume_id = sqlc.arg(volume_id)
),
extension_dist AS (
    SELECT jsonb_object_agg(
        COALESCE(extension, 'no_extension'),
        jsonb_build_object(
            'count', file_count,
            'total_bytes', total_bytes,
            'avg_size', avg_size
        )
    ) as distribution
    FROM (
        SELECT
            LOWER(SUBSTRING(f.name FROM '\.([^.]+)$')) as extension,
            COUNT(*)::bigint as file_count,
            SUM(f.size_bytes)::bigint as total_bytes,
            AVG(f.size_bytes)::bigint as avg_size
        FROM files f
        WHERE f.volume_id = sqlc.arg(volume_id)
        GROUP BY LOWER(SUBSTRING(f.name FROM '\.([^.]+)$'))
        ORDER BY SUM(f.size_bytes) DESC
        LIMIT 100
    ) ext
),
type_dist AS (
    SELECT jsonb_object_agg(
        file_type,
        jsonb_build_object(
            'count', file_count,
            'total_bytes', total_bytes,
            'avg_size', avg_size
        )
    ) as distribution
    FROM (
        SELECT
            CASE
                WHEN LOWER(SUBSTRING(f.name FROM '\.([^.]+)$')) IN ('jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'webp', 'ico', 'tiff', 'tif') THEN 'image'
                WHEN LOWER(SUBSTRING(f.name FROM '\.([^.]+)$')) IN ('mp4', 'avi', 'mkv', 'mov', 'wmv', 'flv', 'webm', 'm4v', 'mpg', 'mpeg') THEN 'video'
                WHEN LOWER(SUBSTRING(f.name FROM '\.([^.]+)$')) IN ('mp3', 'wav', 'flac', 'aac', 'ogg', 'wma', 'm4a', 'opus') THEN 'audio'
                WHEN LOWER(SUBSTRING(f.name FROM '\.([^.]+)$')) IN ('pdf', 'doc', 'docx', 'txt', 'rtf', 'odt', 'md', 'tex') THEN 'document'
                WHEN LOWER(SUBSTRING(f.name FROM '\.([^.]+)$')) IN ('xls', 'xlsx', 'csv', 'ods', 'tsv') THEN 'spreadsheet'
                WHEN LOWER(SUBSTRING(f.name FROM '\.([^.]+)$')) IN ('ppt', 'pptx', 'odp', 'key') THEN 'presentation'
                WHEN LOWER(SUBSTRING(f.name FROM '\.([^.]+)$')) IN ('zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz', 'tgz', 'tbz2') THEN 'archive'
                WHEN LOWER(SUBSTRING(f.name FROM '\.([^.]+)$')) IN ('js', 'ts', 'py', 'java', 'c', 'cpp', 'h', 'hpp', 'go', 'rs', 'rb', 'php', 'cs', 'swift', 'kt', 'sh', 'sql', 'html', 'css', 'json', 'xml', 'yaml', 'yml') THEN 'code'
                WHEN LOWER(SUBSTRING(f.name FROM '\.([^.]+)$')) IN ('exe', 'dll', 'so', 'dylib', 'bin', 'app', 'apk', 'deb', 'rpm') THEN 'executable'
                WHEN LOWER(SUBSTRING(f.name FROM '\.([^.]+)$')) IN ('iso', 'dmg', 'img', 'vdi', 'vmdk', 'qcow2') THEN 'disk_image'
                ELSE 'other'
            END as file_type,
            COUNT(*)::bigint as file_count,
            SUM(f.size_bytes)::bigint as total_bytes,
            AVG(f.size_bytes)::bigint as avg_size
        FROM files f
        WHERE f.volume_id = sqlc.arg(volume_id)
        GROUP BY (CASE
                WHEN LOWER(SUBSTRING(f.name FROM '\.([^.]+)$')) IN ('jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'webp', 'ico', 'tiff', 'tif') THEN 'image'
                WHEN LOWER(SUBSTRING(f.name FROM '\.([^.]+)$')) IN ('mp4', 'avi', 'mkv', 'mov', 'wmv', 'flv', 'webm', 'm4v', 'mpg', 'mpeg') THEN 'video'
                WHEN LOWER(SUBSTRING(f.name FROM '\.([^.]+)$')) IN ('mp3', 'wav', 'flac', 'aac', 'ogg', 'wma', 'm4a', 'opus') THEN 'audio'
                WHEN LOWER(SUBSTRING(f.name FROM '\.([^.]+)$')) IN ('pdf', 'doc', 'docx', 'txt', 'rtf', 'odt', 'md', 'tex') THEN 'document'
                WHEN LOWER(SUBSTRING(f.name FROM '\.([^.]+)$')) IN ('xls', 'xlsx', 'csv', 'ods', 'tsv') THEN 'spreadsheet'
                WHEN LOWER(SUBSTRING(f.name FROM '\.([^.]+)$')) IN ('ppt', 'pptx', 'odp', 'key') THEN 'presentation'
                WHEN LOWER(SUBSTRING(f.name FROM '\.([^.]+)$')) IN ('zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz', 'tgz', 'tbz2') THEN 'archive'
                WHEN LOWER(SUBSTRING(f.name FROM '\.([^.]+)$')) IN ('js', 'ts', 'py', 'java', 'c', 'cpp', 'h', 'hpp', 'go', 'rs', 'rb', 'php', 'cs', 'swift', 'kt', 'sh', 'sql', 'html', 'css', 'json', 'xml', 'yaml', 'yml') THEN 'code'
                WHEN LOWER(SUBSTRING(f.name FROM '\.([^.]+)$')) IN ('exe', 'dll', 'so', 'dylib', 'bin', 'app', 'apk', 'deb', 'rpm') THEN 'executable'
                WHEN LOWER(SUBSTRING(f.name FROM '\.([^.]+)$')) IN ('iso', 'dmg', 'img', 'vdi', 'vmdk', 'qcow2') THEN 'disk_image'
                ELSE 'other'
            END)
    ) types
)
SELECT
    fs.file_count,
    fs.directory_count,
    fs.total_size,
    fs.smallest_file_size,
    fs.largest_file_size,
    fs.average_file_size,
    fs.median_file_size,
    COALESCE(ed.distribution, '{}'::jsonb) as extension_distribution,
    COALESCE(td.distribution, '{}'::jsonb) as type_distribution
FROM file_stats fs
CROSS JOIN extension_dist ed
CROSS JOIN type_dist td;