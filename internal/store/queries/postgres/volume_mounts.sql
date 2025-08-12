-- Volume Mount CRUD operations (PostgreSQL)

-- name: CreateVolumeMount :one
INSERT INTO volume_mounts (volume_id, container_id, mount_path, access_mode, is_active)
VALUES ($1, $2, $3, $4, $5)
RETURNING id, created_at, updated_at;

-- name: GetVolumeMountByID :one
SELECT id, volume_id, container_id, mount_path, access_mode, is_active, created_at, updated_at
FROM volume_mounts 
WHERE id = $1;

-- name: ListVolumeMounts :many
SELECT id, volume_id, container_id, mount_path, access_mode, is_active, created_at, updated_at
FROM volume_mounts 
WHERE is_active = true
ORDER BY created_at DESC
LIMIT $1 OFFSET $2;

-- name: GetVolumeMountsByVolume :many
SELECT id, volume_id, container_id, mount_path, access_mode, is_active, created_at, updated_at
FROM volume_mounts 
WHERE volume_id = $1 AND is_active = true
ORDER BY created_at DESC;

-- name: GetVolumeMountsByContainer :many
SELECT id, volume_id, container_id, mount_path, access_mode, is_active, created_at, updated_at
FROM volume_mounts 
WHERE container_id = $1 AND is_active = true
ORDER BY created_at DESC;

-- name: GetVolumeMountByVolumeContainer :one
SELECT id, volume_id, container_id, mount_path, access_mode, is_active, created_at, updated_at
FROM volume_mounts 
WHERE volume_id = $1 AND container_id = $2 AND mount_path = $3;

-- name: UpdateVolumeMount :one
UPDATE volume_mounts 
SET access_mode = $2, is_active = $3, updated_at = CURRENT_TIMESTAMP
WHERE id = $1
RETURNING updated_at;

-- name: SoftDeleteVolumeMount :exec
UPDATE volume_mounts 
SET is_active = false, updated_at = CURRENT_TIMESTAMP 
WHERE id = $1;

-- name: SoftDeleteVolumeMountByVolumeContainer :exec
UPDATE volume_mounts 
SET is_active = false, updated_at = CURRENT_TIMESTAMP 
WHERE volume_id = $1 AND container_id = $2;

-- name: HardDeleteVolumeMount :exec
DELETE FROM volume_mounts WHERE id = $1;

-- name: HardDeleteVolumeMountByVolumeContainer :exec
DELETE FROM volume_mounts WHERE volume_id = $1 AND container_id = $2;

-- name: DeactivateVolumeMounts :exec
UPDATE volume_mounts 
SET is_active = false, updated_at = CURRENT_TIMESTAMP 
WHERE container_id = $1;

-- name: GetActiveVolumeMountCount :one
SELECT COUNT(*) FROM volume_mounts WHERE is_active = true;

-- name: GetVolumeMountStats :one
SELECT 
    COUNT(*) as total_mounts,
    COALESCE(SUM(CASE WHEN is_active = true THEN 1 ELSE 0 END), 0) as active_mounts,
    COUNT(DISTINCT volume_id) as unique_volumes,
    COUNT(DISTINCT container_id) as unique_containers,
    MAX(created_at) as newest_mount,
    MIN(created_at) as oldest_mount
FROM volume_mounts;

-- name: UpsertVolumeMount :one
INSERT INTO volume_mounts (volume_id, container_id, mount_path, access_mode, is_active)
VALUES ($1, $2, $3, $4, $5)
ON CONFLICT (volume_id, container_id, mount_path) 
DO UPDATE SET 
    access_mode = EXCLUDED.access_mode,
    is_active = EXCLUDED.is_active,
    updated_at = CURRENT_TIMESTAMP
RETURNING id, created_at, updated_at;

-- name: CountVolumeMounts :one
SELECT COUNT(*) FROM volume_mounts WHERE is_active = true;