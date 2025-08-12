-- Volume CRUD operations

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