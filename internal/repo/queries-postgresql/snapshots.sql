-- Volume snapshot queries for incremental scanning

-- name: CreateVolumeSnapshot :one
INSERT INTO volume_snapshots (
    volume_id,
    scan_id,
    snapshot_time,
    scan_method,
    total_size,
    file_count,
    folder_count,
    root_mtime,
    content_hash,
    scan_duration_ms,
    indexing_duration_ms
) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11
)
RETURNING *;

-- name: GetLatestSnapshotForVolume :one
SELECT * FROM volume_snapshots
WHERE volume_id = $1
ORDER BY snapshot_time DESC
LIMIT 1;

-- name: GetSnapshotByScanID :one
SELECT * FROM volume_snapshots
WHERE scan_id = $1
LIMIT 1;

-- name: GetSnapshotsForVolume :many
SELECT * FROM volume_snapshots
WHERE volume_id = $1
ORDER BY snapshot_time DESC
LIMIT $2;

-- name: DeleteOldSnapshots :execrows
DELETE FROM volume_snapshots
WHERE created_at < $1;

-- name: DeleteSnapshotsByVolume :exec
DELETE FROM volume_snapshots
WHERE volume_id = $1;

-- name: CountSnapshotsForVolume :one
SELECT COUNT(*) FROM volume_snapshots
WHERE volume_id = $1;

-- Directory snapshot queries

-- name: CreateDirectorySnapshot :one
INSERT INTO volume_directory_snapshots (
    snapshot_id,
    volume_id,
    dir_path,
    dir_mtime,
    dir_size,
    file_count,
    subdir_count,
    content_hash
) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8
)
RETURNING *;

-- name: GetDirectorySnapshotsForSnapshot :many
SELECT * FROM volume_directory_snapshots
WHERE snapshot_id = $1
ORDER BY dir_path;

-- name: GetDirectorySnapshotByPath :one
SELECT * FROM volume_directory_snapshots
WHERE snapshot_id = $1 AND dir_path = $2
LIMIT 1;

-- name: GetChangedDirectories :many
-- Get directories that changed between two snapshots (prev_snapshot_id, curr_snapshot_id)
WITH prev_dirs AS (
    SELECT dir_path, dir_mtime, content_hash
    FROM volume_directory_snapshots
    WHERE volume_directory_snapshots.snapshot_id = sqlc.arg(prev_snapshot_id)
),
curr_dirs AS (
    SELECT dir_path, dir_mtime, content_hash
    FROM volume_directory_snapshots
    WHERE volume_directory_snapshots.snapshot_id = sqlc.arg(curr_snapshot_id)
)
SELECT
    COALESCE(curr_dirs.dir_path, prev_dirs.dir_path) as dir_path,
    CASE
        WHEN prev_dirs.dir_path IS NULL THEN 'added'
        WHEN curr_dirs.dir_path IS NULL THEN 'deleted'
        WHEN curr_dirs.dir_mtime > prev_dirs.dir_mtime THEN 'modified'
        WHEN curr_dirs.content_hash != prev_dirs.content_hash THEN 'modified'
        ELSE 'unchanged'
    END as change_type
FROM curr_dirs
FULL OUTER JOIN prev_dirs ON curr_dirs.dir_path = prev_dirs.dir_path
WHERE
    prev_dirs.dir_path IS NULL OR
    curr_dirs.dir_path IS NULL OR
    curr_dirs.dir_mtime > prev_dirs.dir_mtime OR
    curr_dirs.content_hash != prev_dirs.content_hash;

-- name: GetSnapshotStats :one
SELECT
    COUNT(*) as total_snapshots,
    COUNT(DISTINCT volume_id) as total_volumes,
    SUM(total_size) as total_size_tracked,
    SUM(file_count) as total_files_tracked,
    AVG(scan_duration_ms) as avg_scan_duration_ms
FROM volume_snapshots
WHERE created_at > NOW() - INTERVAL '30 days';
