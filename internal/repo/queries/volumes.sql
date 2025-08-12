-- volumes.sql: Docker volume, container, and mount operations
-- This file consolidates all Docker resource management queries

-- =======================
-- VOLUME OPERATIONS
-- =======================

-- name: CreateVolume :one
INSERT INTO volumes (volume_id, name, driver, mountpoint, labels, options, scope, status, is_active)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
RETURNING id, created_at, updated_at;

-- name: GetVolumeByID :one
SELECT id, volume_id, name, driver, mountpoint, labels, options, scope, status, last_scanned, is_active, created_at, updated_at
FROM volumes 
WHERE id = $1;

-- name: GetVolumeByVolumeID :one
SELECT id, volume_id, name, driver, mountpoint, labels, options, scope, status, last_scanned, is_active, created_at, updated_at
FROM volumes 
WHERE volume_id = $1;

-- name: ListVolumes :many
SELECT id, volume_id, name, driver, mountpoint, labels, options, scope, status, last_scanned, is_active, created_at, updated_at
FROM volumes 
WHERE is_active = true
ORDER BY created_at DESC
LIMIT $1 OFFSET $2;

-- name: GetVolumesByDriver :many
SELECT id, volume_id, name, driver, mountpoint, labels, options, scope, status, last_scanned, is_active, created_at, updated_at
FROM volumes 
WHERE driver = $1 AND is_active = true
ORDER BY created_at DESC;

-- name: GetVolumesByLabel :many
SELECT id, volume_id, name, driver, mountpoint, labels, options, scope, status, last_scanned, is_active, created_at, updated_at
FROM volumes 
WHERE labels->$1 = $2 AND is_active = true
ORDER BY created_at DESC;

-- name: UpdateVolume :one
UPDATE volumes 
SET name = $2, driver = $3, mountpoint = $4, labels = $5, options = $6, scope = $7, status = $8, is_active = $9, updated_at = CURRENT_TIMESTAMP
WHERE id = $1
RETURNING updated_at;

-- name: UpdateLastScanned :exec
UPDATE volumes 
SET last_scanned = $2, updated_at = CURRENT_TIMESTAMP 
WHERE volume_id = $1;

-- name: SoftDeleteVolume :exec
UPDATE volumes 
SET is_active = false, updated_at = CURRENT_TIMESTAMP 
WHERE id = $1;

-- name: HardDeleteVolume :exec
DELETE FROM volumes WHERE id = $1;

-- name: GetActiveVolumeCount :one
SELECT COUNT(*) FROM volumes WHERE is_active = true;

-- name: GetVolumeStats :one
SELECT 
    COUNT(*) as total_volumes,
    COALESCE(COUNT(*) FILTER (WHERE is_active = true), 0) as active_volumes,
    COUNT(DISTINCT driver) as unique_drivers,
    COALESCE(COUNT(*) FILTER (WHERE last_scanned IS NOT NULL), 0) as scanned_volumes,
    MAX(created_at) as newest_volume,
    MIN(created_at) as oldest_volume
FROM volumes;

-- name: UpsertVolume :one
INSERT INTO volumes (volume_id, name, driver, mountpoint, labels, options, scope, status, is_active)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
ON CONFLICT (volume_id) 
DO UPDATE SET 
    name = EXCLUDED.name,
    driver = EXCLUDED.driver,
    mountpoint = EXCLUDED.mountpoint,
    labels = EXCLUDED.labels,
    options = EXCLUDED.options,
    scope = EXCLUDED.scope,
    status = EXCLUDED.status,
    is_active = EXCLUDED.is_active,
    updated_at = CURRENT_TIMESTAMP
RETURNING id, created_at, updated_at;

-- name: CountVolumes :one
SELECT COUNT(*) FROM volumes WHERE is_active = true;

-- =======================
-- CONTAINER OPERATIONS
-- =======================

-- name: CreateContainer :one
INSERT INTO containers (container_id, name, image, state, status, labels, started_at, finished_at, is_active)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
RETURNING id, created_at, updated_at;

-- name: GetContainerByID :one
SELECT id, container_id, name, image, state, status, labels, started_at, finished_at, is_active, created_at, updated_at
FROM containers 
WHERE id = $1;

-- name: GetContainerByContainerID :one
SELECT id, container_id, name, image, state, status, labels, started_at, finished_at, is_active, created_at, updated_at
FROM containers 
WHERE container_id = $1;

-- name: ListContainers :many
SELECT id, container_id, name, image, state, status, labels, started_at, finished_at, is_active, created_at, updated_at
FROM containers 
WHERE is_active = true
ORDER BY created_at DESC
LIMIT $1 OFFSET $2;

-- name: GetContainersByImage :many
SELECT id, container_id, name, image, state, status, labels, started_at, finished_at, is_active, created_at, updated_at
FROM containers 
WHERE image = $1 AND is_active = true
ORDER BY created_at DESC;

-- name: GetContainersByState :many
SELECT id, container_id, name, image, state, status, labels, started_at, finished_at, is_active, created_at, updated_at
FROM containers 
WHERE state = $1 AND is_active = true
ORDER BY created_at DESC;

-- name: UpdateContainer :one
UPDATE containers 
SET name = $2, image = $3, state = $4, status = $5, labels = $6, started_at = $7, finished_at = $8, is_active = $9, updated_at = CURRENT_TIMESTAMP
WHERE id = $1
RETURNING updated_at;

-- name: SoftDeleteContainer :exec
UPDATE containers 
SET is_active = false, updated_at = CURRENT_TIMESTAMP 
WHERE id = $1;

-- name: HardDeleteContainer :exec
DELETE FROM containers WHERE id = $1;

-- name: GetActiveContainerCount :one
SELECT COUNT(*) FROM containers WHERE is_active = true;

-- name: GetContainerStats :one
SELECT 
    COUNT(*) as total_containers,
    COALESCE(SUM(CASE WHEN is_active = true THEN 1 ELSE 0 END), 0) as active_containers,
    COUNT(DISTINCT image) as unique_images,
    COUNT(DISTINCT state) as unique_states,
    MAX(created_at) as newest_container,
    MIN(created_at) as oldest_container
FROM containers;

-- name: UpsertContainer :one
INSERT INTO containers (container_id, name, image, state, status, labels, started_at, finished_at, is_active)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
ON CONFLICT (container_id) 
DO UPDATE SET 
    name = EXCLUDED.name,
    image = EXCLUDED.image,
    state = EXCLUDED.state,
    status = EXCLUDED.status,
    labels = EXCLUDED.labels,
    started_at = EXCLUDED.started_at,
    finished_at = EXCLUDED.finished_at,
    is_active = EXCLUDED.is_active,
    updated_at = CURRENT_TIMESTAMP
RETURNING id, created_at, updated_at;

-- name: CountContainers :one
SELECT COUNT(*) FROM containers WHERE is_active = true;

-- =======================
-- VOLUME MOUNT OPERATIONS
-- =======================

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