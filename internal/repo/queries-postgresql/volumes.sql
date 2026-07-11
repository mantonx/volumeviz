-- Volume management queries for PostgreSQL

-- name: CreateVolume :one
INSERT INTO volumes (
    volume_id, display_name, mount_point, container_names, is_active,
    total_size_bytes, used_size_bytes, free_size_bytes, filesystem_type,
    container_count, first_seen_at, last_scan_at, last_modified_at, organization_id
) VALUES (
    $1, $2, $3, $4, $5,
    $6, $7, $8, $9,
    $10, $11, $12, $13, $14
) RETURNING *;

-- name: GetVolume :one
SELECT * FROM volumes WHERE volume_id = $1 AND organization_id = $2;

-- name: GetVolumeByOrg :one
SELECT * FROM volumes WHERE volume_id = $1 AND organization_id = $2;

-- name: GetVolumeSystemLevel :one
SELECT * FROM volumes WHERE volume_id = $1;

-- name: ListVolumes :many
SELECT * FROM volumes 
WHERE organization_id = $1
ORDER BY volume_id
LIMIT $2 OFFSET $3;

-- name: ListAllVolumes :many
SELECT * FROM volumes 
ORDER BY volume_id
LIMIT $1 OFFSET $2;

-- name: ListActiveVolumes :many
SELECT * FROM volumes 
WHERE is_active = true AND organization_id = $1
ORDER BY volume_id;

-- name: UpdateVolume :one
UPDATE volumes
SET 
    display_name = $2,
    mount_point = $3,
    container_names = $4,
    is_active = $5,
    total_size_bytes = $6,
    used_size_bytes = $7,
    free_size_bytes = $8,
    filesystem_type = $9,
    container_count = $10,
    last_scan_at = $11,
    last_modified_at = $12,
    updated_at = NOW()
WHERE volume_id = $1 AND organization_id = $13
RETURNING *;

-- name: UpdateVolumeStats :one
UPDATE volumes
SET 
    total_size_bytes = $2,
    used_size_bytes = $3,
    free_size_bytes = $4,
    last_scan_at = NOW(),
    updated_at = NOW()
WHERE volume_id = $1 AND organization_id = $5
RETURNING *;

-- name: DeleteVolume :exec
DELETE FROM volumes WHERE volume_id = $1;

-- name: CountVolumes :one
SELECT COUNT(*) FROM volumes WHERE organization_id = $1;

-- name: CountActiveVolumes :one
SELECT COUNT(*) FROM volumes WHERE is_active = true AND organization_id = $1;

-- name: GetVolumeByVolumeID :one  
SELECT * FROM volumes WHERE volume_id = $1 AND organization_id = $2;

-- name: GetVolumeByID :one
SELECT * FROM volumes WHERE volume_id = $1 AND organization_id = $2;

-- name: UpdateLastScanned :exec
UPDATE volumes 
SET last_scan_at = $2, updated_at = NOW()
WHERE volume_id = $1 AND organization_id = $3;

-- name: SoftDeleteVolume :exec
UPDATE volumes
SET is_active = false, updated_at = NOW()
WHERE volume_id = $1 AND organization_id = $2;

-- name: HardDeleteVolume :exec
-- Org-scoped permanent row delete, used after the real Docker volume has
-- already been removed. Not to be confused with the unscoped DeleteVolume
-- query above, which is currently unused and would be a tenant-isolation
-- bug if called directly.
DELETE FROM volumes WHERE volume_id = $1 AND organization_id = $2;

-- name: UpsertVolume :one
INSERT INTO volumes (
    volume_id, display_name, mount_point, container_names, is_active,
    total_size_bytes, used_size_bytes, free_size_bytes, filesystem_type,
    container_count, first_seen_at, last_scan_at, last_modified_at, organization_id,
    driver, scope, labels, options
) VALUES (
    $1, $2, $3, $4, $5,
    $6, $7, $8, $9,
    $10, $11, $12, $13, $14,
    $15, $16, $17, $18
) ON CONFLICT (volume_id) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    mount_point = EXCLUDED.mount_point,
    container_names = EXCLUDED.container_names,
    is_active = EXCLUDED.is_active,
    -- Preserve existing scan data if new values are NULL (reconciliation shouldn't overwrite scan results)
    total_size_bytes = COALESCE(EXCLUDED.total_size_bytes, volumes.total_size_bytes),
    used_size_bytes = COALESCE(EXCLUDED.used_size_bytes, volumes.used_size_bytes),
    free_size_bytes = COALESCE(EXCLUDED.free_size_bytes, volumes.free_size_bytes),
    filesystem_type = COALESCE(EXCLUDED.filesystem_type, volumes.filesystem_type),
    container_count = COALESCE(EXCLUDED.container_count, volumes.container_count),
    last_scan_at = COALESCE(EXCLUDED.last_scan_at, volumes.last_scan_at),
    last_modified_at = COALESCE(EXCLUDED.last_modified_at, volumes.last_modified_at),
    -- Update Docker metadata fields
    driver = EXCLUDED.driver,
    scope = EXCLUDED.scope,
    labels = EXCLUDED.labels,
    options = EXCLUDED.options,
    updated_at = NOW()
RETURNING *;

-- name: GetVolumeStats :one
SELECT 
    volume_id,
    total_size_bytes,
    used_size_bytes,
    free_size_bytes,
    last_scan_at
FROM volumes 
WHERE volume_id = $1 AND organization_id = $2;

-- Container operations (using docker_mount_attachments)
-- name: CreateContainer :one
INSERT INTO docker_mount_attachments (
    mount_catalog_id, container_id, container_name, destination_path,
    access_mode, container_state, container_image, container_labels
) VALUES (
    $1, $2, $3, $4,
    $5, $6, $7, $8
) RETURNING *;

-- name: GetContainerByContainerID :one
SELECT * FROM docker_mount_attachments WHERE container_id = $1 LIMIT 1;

-- name: UpsertContainer :one
-- Simple approach: try insert first, then handle constraint violations in Go
INSERT INTO docker_mount_attachments (
    mount_catalog_id, container_id, container_name, destination_path,
    access_mode, container_state, container_image, container_labels
) VALUES (
    $1, $2, $3, $4,
    $5, $6, $7, $8
) RETURNING *;

-- name: UpdateContainer :one
UPDATE docker_mount_attachments 
SET 
    container_name = $3,
    access_mode = $4,
    container_state = $5,
    container_image = $6,
    container_labels = $7,
    updated_at = NOW()
WHERE container_id = $1 AND mount_catalog_id = $2
RETURNING *;

-- Volume mount operations (using docker_mount_catalog)
-- name: CreateVolumeMount :one
INSERT INTO docker_mount_catalog (
    mount_id, mount_type, source_path, container_count
) VALUES (
    $1, $2, $3, $4
) RETURNING *;

-- name: UpsertVolumeMount :one
INSERT INTO docker_mount_catalog (
    mount_id, mount_type, source_path, container_count
) VALUES (
    $1, $2, $3, $4
) ON CONFLICT (mount_id) DO UPDATE SET
    container_count = EXCLUDED.container_count,
    last_seen_at = NOW(),
    updated_at = NOW()
RETURNING *;

-- name: GetVolumeMountsByVolume :many
SELECT * FROM docker_mount_catalog WHERE volume_name = $1;

-- name: ListVolumesWithCounts :many
SELECT
    v.*,
    COALESCE(COUNT(DISTINCT f.id), 0)::bigint as file_count,
    COALESCE(COUNT(DISTINCT fo.id), 0)::bigint as folder_count
FROM volumes v
LEFT JOIN files f ON f.volume_id = v.volume_id
LEFT JOIN folders fo ON fo.volume_id = v.volume_id
WHERE v.organization_id = $1
GROUP BY v.volume_id
ORDER BY v.volume_id
LIMIT $2 OFFSET $3;

-- =============================================================================
-- Volume Tracking Queries
-- =============================================================================

-- name: SetVolumeTracked :one
-- Set a volume to tracked status
UPDATE volumes
SET
    is_tracked = TRUE,
    tracked_at = NOW(),
    untracked_at = NULL,
    updated_at = NOW()
WHERE volume_id = $1 AND organization_id = $2
RETURNING *;

-- name: SetVolumeUntracked :one
-- Set a volume to untracked status
UPDATE volumes
SET
    is_tracked = FALSE,
    untracked_at = NOW(),
    updated_at = NOW()
WHERE volume_id = $1 AND organization_id = $2
RETURNING *;

-- name: ListTrackedVolumes :many
-- List only tracked volumes
SELECT * FROM volumes
WHERE is_tracked = TRUE AND organization_id = $1
ORDER BY volume_id
LIMIT $2 OFFSET $3;

-- name: ListUntrackedVolumes :many
-- List only untracked volumes
SELECT * FROM volumes
WHERE is_tracked = FALSE AND organization_id = $1
ORDER BY volume_id
LIMIT $2 OFFSET $3;

-- name: CountTrackedVolumes :one
-- Count tracked volumes
SELECT COUNT(*) FROM volumes
WHERE is_tracked = TRUE AND organization_id = $1;

-- name: CountUntrackedVolumes :one
-- Count untracked volumes
SELECT COUNT(*) FROM volumes
WHERE is_tracked = FALSE AND organization_id = $1;

-- name: GetVolumeTrackingStatus :one
-- Get tracking status for a specific volume
SELECT volume_id, is_tracked, tracked_at, untracked_at
FROM volumes
WHERE volume_id = $1 AND organization_id = $2;