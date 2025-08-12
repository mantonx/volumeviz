-- volumes.sql: Docker volume, container, and mount operations
-- This file consolidates all Docker resource management queries
-- SQLite-compatible version

-- =======================
-- VOLUME OPERATIONS
-- =======================

-- name: CreateVolume :one
INSERT INTO volumes (volume_id, name, driver, mountpoint, labels, options, scope, status, is_active)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
RETURNING id, created_at, updated_at;

-- name: GetVolumeByID :one
SELECT id, volume_id, name, driver, mountpoint, labels, options, scope, status, last_scanned, is_active, created_at, updated_at
FROM volumes 
WHERE id = ?;

-- name: GetVolumeByVolumeID :one
SELECT id, volume_id, name, driver, mountpoint, labels, options, scope, status, last_scanned, is_active, created_at, updated_at
FROM volumes 
WHERE volume_id = ?;

-- name: ListVolumes :many
SELECT id, volume_id, name, driver, mountpoint, labels, options, scope, status, last_scanned, is_active, created_at, updated_at
FROM volumes 
WHERE is_active = true
ORDER BY created_at DESC
LIMIT ? OFFSET ?;

-- name: GetVolumesByDriver :many
SELECT id, volume_id, name, driver, mountpoint, labels, options, scope, status, last_scanned, is_active, created_at, updated_at
FROM volumes 
WHERE driver = ? AND is_active = true
ORDER BY created_at DESC;

-- name: GetVolumesByLabel :many
SELECT id, volume_id, name, driver, mountpoint, labels, options, scope, status, last_scanned, is_active, created_at, updated_at
FROM volumes 
WHERE json_extract(labels, '$.' || ?) = ? AND is_active = true
ORDER BY created_at DESC;

-- name: UpdateVolume :one
UPDATE volumes 
SET name = ?, driver = ?, mountpoint = ?, labels = ?, options = ?, scope = ?, status = ?, is_active = ?, updated_at = datetime('now')
WHERE id = ?
RETURNING updated_at;

-- name: UpdateLastScanned :exec
UPDATE volumes 
SET last_scanned = ?, updated_at = datetime('now') 
WHERE volume_id = ?;

-- name: SoftDeleteVolume :exec
UPDATE volumes 
SET is_active = false, updated_at = datetime('now') 
WHERE id = ?;

-- name: HardDeleteVolume :exec
DELETE FROM volumes WHERE id = ?;

-- name: GetActiveVolumeCount :one
SELECT COUNT(*) FROM volumes WHERE is_active = true;

-- name: GetVolumeStats :one
SELECT 
    COUNT(*) as total_volumes,
    SUM(CASE WHEN is_active = true THEN 1 ELSE 0 END) as active_volumes,
    COUNT(DISTINCT driver) as unique_drivers,
    SUM(CASE WHEN last_scanned IS NOT NULL THEN 1 ELSE 0 END) as scanned_volumes,
    MAX(created_at) as newest_volume,
    MIN(created_at) as oldest_volume
FROM volumes;

-- name: UpsertVolume :one
INSERT INTO volumes (volume_id, name, driver, mountpoint, labels, options, scope, status, is_active)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
ON CONFLICT(volume_id) 
DO UPDATE SET 
    name = EXCLUDED.name,
    driver = EXCLUDED.driver,
    mountpoint = EXCLUDED.mountpoint,
    labels = EXCLUDED.labels,
    options = EXCLUDED.options,
    scope = EXCLUDED.scope,
    status = EXCLUDED.status,
    is_active = EXCLUDED.is_active,
    updated_at = datetime('now')
RETURNING id, created_at, updated_at;

-- name: CountVolumes :one
SELECT COUNT(*) FROM volumes WHERE is_active = true;

-- =======================
-- CONTAINER OPERATIONS
-- =======================

-- name: CreateContainer :one
INSERT INTO containers (container_id, name, image, state, status, labels, started_at, finished_at, is_active)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
RETURNING id, created_at, updated_at;

-- name: GetContainerByID :one
SELECT id, container_id, name, image, state, status, labels, started_at, finished_at, is_active, created_at, updated_at
FROM containers 
WHERE id = ?;

-- name: GetContainerByContainerID :one
SELECT id, container_id, name, image, state, status, labels, started_at, finished_at, is_active, created_at, updated_at
FROM containers 
WHERE container_id = ?;

-- name: ListContainers :many
SELECT id, container_id, name, image, state, status, labels, started_at, finished_at, is_active, created_at, updated_at
FROM containers 
WHERE is_active = true
ORDER BY created_at DESC
LIMIT ? OFFSET ?;

-- name: GetContainersByImage :many
SELECT id, container_id, name, image, state, status, labels, started_at, finished_at, is_active, created_at, updated_at
FROM containers 
WHERE image = ? AND is_active = true
ORDER BY created_at DESC;

-- name: GetContainersByState :many
SELECT id, container_id, name, image, state, status, labels, started_at, finished_at, is_active, created_at, updated_at
FROM containers 
WHERE state = ? AND is_active = true
ORDER BY created_at DESC;

-- name: UpdateContainer :one
UPDATE containers 
SET name = ?, image = ?, state = ?, status = ?, labels = ?, started_at = ?, finished_at = ?, is_active = ?, updated_at = datetime('now')
WHERE id = ?
RETURNING updated_at;

-- name: SoftDeleteContainer :exec
UPDATE containers 
SET is_active = false, updated_at = datetime('now') 
WHERE id = ?;

-- name: HardDeleteContainer :exec
DELETE FROM containers WHERE id = ?;

-- name: GetActiveContainerCount :one
SELECT COUNT(*) FROM containers WHERE is_active = true;

-- name: GetContainerStats :one
SELECT 
    COUNT(*) as total_containers,
    SUM(CASE WHEN is_active = true THEN 1 ELSE 0 END) as active_containers,
    COUNT(DISTINCT image) as unique_images,
    COUNT(DISTINCT state) as unique_states,
    MAX(created_at) as newest_container,
    MIN(created_at) as oldest_container
FROM containers;

-- name: UpsertContainer :one
INSERT INTO containers (container_id, name, image, state, status, labels, started_at, finished_at, is_active)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
ON CONFLICT(container_id) 
DO UPDATE SET 
    name = EXCLUDED.name,
    image = EXCLUDED.image,
    state = EXCLUDED.state,
    status = EXCLUDED.status,
    labels = EXCLUDED.labels,
    started_at = EXCLUDED.started_at,
    finished_at = EXCLUDED.finished_at,
    is_active = EXCLUDED.is_active,
    updated_at = datetime('now')
RETURNING id, created_at, updated_at;

-- name: CountContainers :one
SELECT COUNT(*) FROM containers WHERE is_active = true;

-- =======================
-- VOLUME MOUNT OPERATIONS
-- =======================

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
WHERE is_active = true
ORDER BY created_at DESC
LIMIT ? OFFSET ?;

-- name: GetVolumeMountsByVolume :many
SELECT id, volume_id, container_id, mount_path, access_mode, is_active, created_at, updated_at
FROM volume_mounts 
WHERE volume_id = ? AND is_active = true
ORDER BY created_at DESC;

-- name: GetVolumeMountsByContainer :many
SELECT id, volume_id, container_id, mount_path, access_mode, is_active, created_at, updated_at
FROM volume_mounts 
WHERE container_id = ? AND is_active = true
ORDER BY created_at DESC;

-- name: GetVolumeMountByVolumeContainer :one
SELECT id, volume_id, container_id, mount_path, access_mode, is_active, created_at, updated_at
FROM volume_mounts 
WHERE volume_id = ? AND container_id = ? AND mount_path = ?;

-- name: UpdateVolumeMount :one
UPDATE volume_mounts 
SET access_mode = ?, is_active = ?, updated_at = datetime('now')
WHERE id = ?
RETURNING updated_at;

-- name: SoftDeleteVolumeMount :exec
UPDATE volume_mounts 
SET is_active = false, updated_at = datetime('now') 
WHERE id = ?;

-- name: SoftDeleteVolumeMountByVolumeContainer :exec
UPDATE volume_mounts 
SET is_active = false, updated_at = datetime('now') 
WHERE volume_id = ? AND container_id = ?;

-- name: HardDeleteVolumeMount :exec
DELETE FROM volume_mounts WHERE id = ?;

-- name: HardDeleteVolumeMountByVolumeContainer :exec
DELETE FROM volume_mounts WHERE volume_id = ? AND container_id = ?;

-- name: DeactivateVolumeMounts :exec
UPDATE volume_mounts 
SET is_active = false, updated_at = datetime('now') 
WHERE container_id = ?;

-- name: GetActiveVolumeMountCount :one
SELECT COUNT(*) FROM volume_mounts WHERE is_active = true;

-- name: GetVolumeMountStats :one
SELECT 
    COUNT(*) as total_mounts,
    SUM(CASE WHEN is_active = true THEN 1 ELSE 0 END) as active_mounts,
    COUNT(DISTINCT volume_id) as unique_volumes,
    COUNT(DISTINCT container_id) as unique_containers,
    MAX(created_at) as newest_mount,
    MIN(created_at) as oldest_mount
FROM volume_mounts;

-- name: UpsertVolumeMount :one
INSERT INTO volume_mounts (volume_id, container_id, mount_path, access_mode, is_active)
VALUES (?, ?, ?, ?, ?)
ON CONFLICT(volume_id, container_id, mount_path) 
DO UPDATE SET 
    access_mode = EXCLUDED.access_mode,
    is_active = EXCLUDED.is_active,
    updated_at = datetime('now')
RETURNING id, created_at, updated_at;

-- name: CountVolumeMounts :one
SELECT COUNT(*) FROM volume_mounts WHERE is_active = true;