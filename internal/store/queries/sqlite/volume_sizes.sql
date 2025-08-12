-- Volume sizes (scan stats) operations

-- name: InsertVolumeSize :one
INSERT INTO volume_sizes (
    volume_id, total_size, file_count, directory_count, 
    largest_file, scan_method, scan_duration, filesystem_type,
    checksum_md5, is_valid, error_message
)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
RETURNING id, created_at, updated_at;

-- name: GetLatestVolumeSize :one
SELECT id, volume_id, total_size, file_count, directory_count, 
       largest_file, scan_method, scan_duration, filesystem_type,
       checksum_md5, is_valid, error_message, created_at, updated_at
FROM volume_sizes 
WHERE volume_id = ? AND is_valid = 1
ORDER BY created_at DESC
LIMIT 1;

-- name: GetVolumeSizesByVolumeID :many
SELECT id, volume_id, total_size, file_count, directory_count, 
       largest_file, scan_method, scan_duration, filesystem_type,
       checksum_md5, is_valid, error_message, created_at, updated_at
FROM volume_sizes 
WHERE volume_id = ?
ORDER BY created_at DESC
LIMIT ?;

-- name: GetVolumeSizeStats :one
SELECT 
    COUNT(*) as total_scans,
    AVG(total_size) as avg_size,
    MAX(total_size) as max_size,
    AVG(file_count) as avg_file_count,
    AVG(scan_duration) as avg_scan_duration
FROM volume_sizes
WHERE volume_id = ? AND is_valid = 1;

-- name: DeleteOldVolumeSizes :exec
DELETE FROM volume_sizes 
WHERE created_at < ?;