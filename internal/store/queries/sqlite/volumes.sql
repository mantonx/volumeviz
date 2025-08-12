-- Volume CRUD operations (SQLite)

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
WHERE is_active = 1
ORDER BY created_at DESC
LIMIT ? OFFSET ?;

-- name: GetVolumesByDriver :many
SELECT id, volume_id, name, driver, mountpoint, labels, options, scope, status, last_scanned, is_active, created_at, updated_at
FROM volumes 
WHERE driver = ? AND is_active = 1
ORDER BY created_at DESC;

-- name: GetVolumesByLabel :many
SELECT id, volume_id, name, driver, mountpoint, labels, options, scope, status, last_scanned, is_active, created_at, updated_at
FROM volumes 
WHERE JSON_EXTRACT(labels, '$.' || ?) = ? AND is_active = 1
ORDER BY created_at DESC;

-- name: UpdateVolume :one
UPDATE volumes 
SET name = ?, driver = ?, mountpoint = ?, labels = ?, options = ?, scope = ?, status = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP
WHERE id = ?
RETURNING updated_at;

-- name: UpdateLastScanned :exec
UPDATE volumes 
SET last_scanned = ?, updated_at = CURRENT_TIMESTAMP 
WHERE volume_id = ?;

-- name: SoftDeleteVolume :exec
UPDATE volumes 
SET is_active = 0, updated_at = CURRENT_TIMESTAMP 
WHERE id = ?;

-- name: HardDeleteVolume :exec
DELETE FROM volumes WHERE id = ?;

-- name: GetActiveVolumeCount :one
SELECT COUNT(*) FROM volumes WHERE is_active = 1;

-- name: GetVolumeStats :one
SELECT 
    COUNT(*) as total_volumes,
    COALESCE(SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END), 0) as active_volumes,
    COUNT(DISTINCT driver) as unique_drivers,
    COALESCE(SUM(CASE WHEN last_scanned IS NOT NULL THEN 1 ELSE 0 END), 0) as scanned_volumes,
    MAX(created_at) as newest_volume,
    MIN(created_at) as oldest_volume
FROM volumes;

-- name: UpsertVolume :one
INSERT INTO volumes (volume_id, name, driver, mountpoint, labels, options, scope, status, is_active)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
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
SELECT COUNT(*) FROM volumes WHERE is_active = 1;