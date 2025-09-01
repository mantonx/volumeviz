-- Essential statistics queries for SQLite

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
SET calculated_at = datetime(calculated_at, '-1 year')
WHERE volume_id = sqlc.arg(volume_id) AND calculated_at < datetime('now', '-1 day');

-- name: InsertVolumeSize :exec
INSERT OR REPLACE INTO volume_sizes (
    volume_id, total_size, file_count, directory_count, largest_file_size,
    smallest_file_size, average_file_size, median_file_size, type_distribution,
    extension_distribution, calculated_at
) VALUES (
    sqlc.arg(volume_id), sqlc.arg(total_size), sqlc.arg(file_count), 
    sqlc.arg(directory_count), sqlc.arg(largest_file_size), sqlc.arg(smallest_file_size),
    sqlc.arg(average_file_size), sqlc.arg(median_file_size), sqlc.arg(type_distribution),
    sqlc.arg(extension_distribution), sqlc.arg(calculated_at)
);

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