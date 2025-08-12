-- Volume Mount CRUD operations (SQLite)

-- name: CreateVolumeMount :one
INSERT INTO volume_mounts (volume_id, container_id, mount_path, access_mode, is_active)
VALUES (?, ?, ?, ?, ?)
RETURNING id, created_at, updated_at;

-- name: GetVolumeMountByID :one
SELECT id, volume_id, container_id, mount_path, access_mode, is_active, created_at, updated_at
FROM volume_mounts 
WHERE id = ?;

-- name: ListVolumeMounts :many
SELECT id, volume_id, container_id, mount_path, access_mode, is_active, created_at, updated_at
FROM volume_mounts 
WHERE is_active = 1
ORDER BY created_at DESC
LIMIT ? OFFSET ?;

-- name: GetVolumeMountsByVolume :many
SELECT id, volume_id, container_id, mount_path, access_mode, is_active, created_at, updated_at
FROM volume_mounts 
WHERE volume_id = ? AND is_active = 1
ORDER BY created_at DESC;

-- name: GetVolumeMountsByContainer :many
SELECT id, volume_id, container_id, mount_path, access_mode, is_active, created_at, updated_at
FROM volume_mounts 
WHERE container_id = ? AND is_active = 1
ORDER BY created_at DESC;

-- name: GetVolumeMountByVolumeContainer :one
SELECT id, volume_id, container_id, mount_path, access_mode, is_active, created_at, updated_at
FROM volume_mounts 
WHERE volume_id = ? AND container_id = ? AND mount_path = ?;

-- name: UpdateVolumeMount :one
UPDATE volume_mounts 
SET access_mode = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP
WHERE id = ?
RETURNING updated_at;

-- name: SoftDeleteVolumeMount :exec
UPDATE volume_mounts 
SET is_active = 0, updated_at = CURRENT_TIMESTAMP 
WHERE id = ?;

-- name: SoftDeleteVolumeMountByVolumeContainer :exec
UPDATE volume_mounts 
SET is_active = 0, updated_at = CURRENT_TIMESTAMP 
WHERE volume_id = ? AND container_id = ?;

-- name: HardDeleteVolumeMount :exec
DELETE FROM volume_mounts WHERE id = ?;

-- name: HardDeleteVolumeMountByVolumeContainer :exec
DELETE FROM volume_mounts WHERE volume_id = ? AND container_id = ?;

-- name: DeactivateVolumeMounts :exec
UPDATE volume_mounts 
SET is_active = 0, updated_at = CURRENT_TIMESTAMP 
WHERE container_id = ?;

-- name: GetActiveVolumeMountCount :one
SELECT COUNT(*) FROM volume_mounts WHERE is_active = 1;

-- name: GetVolumeMountStats :one
SELECT 
    COUNT(*) as total_mounts,
    COALESCE(SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END), 0) as active_mounts,
    COUNT(DISTINCT volume_id) as unique_volumes,
    COUNT(DISTINCT container_id) as unique_containers,
    MAX(created_at) as newest_mount,
    MIN(created_at) as oldest_mount
FROM volume_mounts;

-- name: UpsertVolumeMount :one
INSERT INTO volume_mounts (volume_id, container_id, mount_path, access_mode, is_active)
VALUES (?, ?, ?, ?, ?)
ON CONFLICT (volume_id, container_id, mount_path) 
DO UPDATE SET 
    access_mode = EXCLUDED.access_mode,
    is_active = EXCLUDED.is_active,
    updated_at = CURRENT_TIMESTAMP
RETURNING id, created_at, updated_at;

-- name: CountVolumeMounts :one
SELECT COUNT(*) FROM volume_mounts WHERE is_active = 1;