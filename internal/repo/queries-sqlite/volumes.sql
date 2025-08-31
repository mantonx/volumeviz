-- Volume management queries for SQLite

-- name: CreateVolume :one
INSERT INTO volumes (
    volume_id, display_name, mount_point, container_names, is_active,
    total_size_bytes, used_size_bytes, free_size_bytes, filesystem_type,
    container_count, first_seen_at, last_scan_at, last_modified_at
) VALUES (
    ?, ?, ?, ?, ?,
    ?, ?, ?, ?,
    ?, ?, ?, ?
) RETURNING *;

-- name: GetVolume :one
SELECT * FROM volumes WHERE volume_id = ?;

-- name: ListVolumes :many
SELECT * FROM volumes 
ORDER BY volume_id
LIMIT ? OFFSET ?;

-- name: ListActiveVolumes :many
SELECT * FROM volumes 
WHERE is_active = 1
ORDER BY volume_id;

-- name: UpdateVolume :one
UPDATE volumes
SET 
    display_name = ?,
    mount_point = ?,
    container_names = ?,
    is_active = ?,
    total_size_bytes = ?,
    used_size_bytes = ?,
    free_size_bytes = ?,
    filesystem_type = ?,
    container_count = ?,
    last_scan_at = ?,
    last_modified_at = ?,
    updated_at = CURRENT_TIMESTAMP
WHERE volume_id = ?
RETURNING *;

-- name: UpdateVolumeStats :one
UPDATE volumes
SET 
    total_size_bytes = ?,
    used_size_bytes = ?,
    free_size_bytes = ?,
    last_scan_at = CURRENT_TIMESTAMP,
    updated_at = CURRENT_TIMESTAMP
WHERE volume_id = ?
RETURNING *;

-- name: DeleteVolume :exec
DELETE FROM volumes WHERE volume_id = ?;

-- name: CountVolumes :one
SELECT COUNT(*) FROM volumes;

-- name: CountActiveVolumes :one
SELECT COUNT(*) FROM volumes WHERE is_active = 1;

-- name: UpdateLastScanned :exec
UPDATE volumes 
SET last_scan_at = ?, updated_at = datetime('now')
WHERE volume_id = ?;

-- Volume mount operations (using docker_mount_catalog)
-- name: CreateVolumeMount :one
INSERT INTO docker_mount_catalog (
    mount_id, mount_type, source_path, container_count
) VALUES (
    ?, ?, ?, ?
) RETURNING *;

-- name: UpsertVolumeMount :one
INSERT INTO docker_mount_catalog (
    mount_id, mount_type, source_path, container_count
) VALUES (
    ?, ?, ?, ?
) ON CONFLICT (mount_id) DO UPDATE SET
    container_count = excluded.container_count,
    last_seen_at = CURRENT_TIMESTAMP,
    updated_at = CURRENT_TIMESTAMP
RETURNING *;

-- name: GetVolumeMountsByVolume :many
SELECT * FROM docker_mount_catalog WHERE volume_name = ?;