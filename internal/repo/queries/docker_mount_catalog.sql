-- Docker Mount Catalog Queries (VV-301)
-- SQLC queries for Docker mount catalog operations

-- name: CreateMountCatalogEntry :one
INSERT INTO docker_mount_catalog (
    mount_id,
    mount_type,
    volume_name,
    volume_driver,
    volume_options,
    volume_labels,
    volume_scope,
    source_path,
    container_count,
    is_orphaned,
    compose_project,
    compose_services,
    compose_version,
    compose_config_files,
    discovery_source,
    is_tracked
) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16
) RETURNING *;

-- name: GetMountCatalogEntry :one
SELECT * FROM docker_mount_catalog
WHERE mount_id = $1;

-- name: ListMountCatalogEntries :many
SELECT * FROM docker_mount_catalog
ORDER BY 
    CASE WHEN $1::text = 'mount_type' THEN mount_type::text END,
    CASE WHEN $1::text = 'compose_project' THEN compose_project END,
    CASE WHEN $1::text = 'last_seen' THEN last_seen_at END DESC,
    CASE WHEN $1::text = 'container_count' THEN container_count END DESC,
    volume_name, mount_id
LIMIT $2 OFFSET $3;

-- name: ListMountCatalogEntriesByType :many
SELECT * FROM docker_mount_catalog
WHERE mount_type = $1
ORDER BY volume_name, mount_id
LIMIT $2 OFFSET $3;

-- name: ListMountCatalogEntriesByComposeProject :many
SELECT * FROM docker_mount_catalog
WHERE compose_project = $1
ORDER BY mount_type, volume_name, mount_id
LIMIT $2 OFFSET $3;

-- name: ListOrphanedMounts :many
SELECT * FROM docker_mount_catalog
WHERE is_orphaned = true
ORDER BY last_seen_at DESC
LIMIT $1 OFFSET $2;

-- name: ListTrackedMounts :many
SELECT * FROM docker_mount_catalog
WHERE is_tracked = true
ORDER BY mount_type, volume_name, mount_id
LIMIT $1 OFFSET $2;

-- name: UpdateMountCatalogEntry :one
UPDATE docker_mount_catalog SET
    volume_driver = COALESCE($2, volume_driver),
    volume_options = COALESCE($3, volume_options),
    volume_labels = COALESCE($4, volume_labels),
    volume_scope = COALESCE($5, volume_scope),
    container_count = COALESCE($6, container_count),
    is_orphaned = COALESCE($7, is_orphaned),
    compose_project = COALESCE($8, compose_project),
    compose_services = COALESCE($9, compose_services),
    compose_version = COALESCE($10, compose_version),
    compose_config_files = COALESCE($11, compose_config_files),
    last_seen_at = CURRENT_TIMESTAMP,
    updated_at = CURRENT_TIMESTAMP
WHERE mount_id = $1
RETURNING *;

-- name: UpdateMountTrackingStatus :one
UPDATE docker_mount_catalog SET
    is_tracked = $2,
    tracking_enabled_at = CASE WHEN $2 = true THEN CURRENT_TIMESTAMP ELSE tracking_enabled_at END,
    tracking_disabled_at = CASE WHEN $2 = false THEN CURRENT_TIMESTAMP ELSE tracking_disabled_at END,
    updated_at = CURRENT_TIMESTAMP
WHERE mount_id = $1
RETURNING *;

-- name: DeleteMountCatalogEntry :exec
DELETE FROM docker_mount_catalog
WHERE mount_id = $1;

-- name: CreateMountAttachment :one
INSERT INTO docker_mount_attachments (
    mount_catalog_id,
    container_id,
    container_name,
    destination_path,
    access_mode,
    propagation,
    container_state,
    container_image,
    container_labels,
    container_compose_project,
    container_compose_service,
    container_compose_container_number,
    container_compose_config_hash
) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13
) RETURNING *;

-- name: GetMountAttachment :one
SELECT * FROM docker_mount_attachments
WHERE mount_catalog_id = $1 AND container_id = $2 AND destination_path = $3 AND is_active = true;

-- name: ListMountAttachments :many
SELECT * FROM docker_mount_attachments
WHERE mount_catalog_id = $1 AND is_active = true
ORDER BY container_name, destination_path;

-- name: ListContainerAttachments :many
SELECT 
    dma.*,
    dmc.mount_id,
    dmc.mount_type,
    dmc.volume_name,
    dmc.source_path
FROM docker_mount_attachments dma
JOIN docker_mount_catalog dmc ON dma.mount_catalog_id = dmc.id
WHERE dma.container_id = $1 AND dma.is_active = true
ORDER BY dma.destination_path;

-- name: UpdateMountAttachment :one
UPDATE docker_mount_attachments SET
    container_name = COALESCE($4, container_name),
    access_mode = COALESCE($5, access_mode),
    propagation = COALESCE($6, propagation),
    container_state = COALESCE($7, container_state),
    container_image = COALESCE($8, container_image),
    container_labels = COALESCE($9, container_labels),
    container_compose_project = COALESCE($10, container_compose_project),
    container_compose_service = COALESCE($11, container_compose_service),
    container_compose_container_number = COALESCE($12, container_compose_container_number),
    container_compose_config_hash = COALESCE($13, container_compose_config_hash),
    updated_at = CURRENT_TIMESTAMP
WHERE mount_catalog_id = $1 AND container_id = $2 AND destination_path = $3 AND is_active = true
RETURNING *;

-- name: DeactivateMountAttachment :one
UPDATE docker_mount_attachments SET
    is_active = false,
    detached_at = CURRENT_TIMESTAMP,
    updated_at = CURRENT_TIMESTAMP
WHERE mount_catalog_id = $1 AND container_id = $2 AND destination_path = $3 AND is_active = true
RETURNING *;

-- name: DeactivateContainerAttachments :many
UPDATE docker_mount_attachments SET
    is_active = false,
    detached_at = CURRENT_TIMESTAMP,
    updated_at = CURRENT_TIMESTAMP
WHERE container_id = $1 AND is_active = true
RETURNING *;

-- name: CreateMountStatistics :one
INSERT INTO docker_mount_statistics (
    mount_catalog_id,
    peak_container_count,
    total_attachments,
    compose_projects_count,
    compose_services_count,
    days_since_creation,
    days_since_last_use,
    attachment_frequency_score,
    last_known_size_bytes,
    last_scanned_at
) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10
) RETURNING *;

-- name: GetMountStatistics :one
SELECT * FROM docker_mount_statistics
WHERE mount_catalog_id = $1
ORDER BY calculated_at DESC
LIMIT 1;

-- name: UpdateMountStatistics :one
UPDATE docker_mount_statistics SET
    peak_container_count = GREATEST(peak_container_count, $2),
    total_attachments = $3,
    compose_projects_count = $4,
    compose_services_count = $5,
    days_since_creation = $6,
    days_since_last_use = $7,
    attachment_frequency_score = $8,
    last_known_size_bytes = COALESCE($9, last_known_size_bytes),
    last_scanned_at = COALESCE($10, last_scanned_at),
    calculated_at = CURRENT_TIMESTAMP,
    updated_at = CURRENT_TIMESTAMP
WHERE mount_catalog_id = $1
RETURNING *;

-- Complex analytical queries

-- name: GetMountCatalogSummary :one
SELECT
    COUNT(*) as total_mounts,
    COUNT(*) FILTER (WHERE mount_type = 'volume') as volume_mounts,
    COUNT(*) FILTER (WHERE mount_type = 'bind') as bind_mounts,
    COUNT(*) FILTER (WHERE mount_type = 'tmpfs') as tmpfs_mounts,
    COUNT(*) FILTER (WHERE is_orphaned = true) as orphaned_mounts,
    COUNT(*) FILTER (WHERE is_tracked = true) as tracked_mounts,
    COUNT(DISTINCT compose_project) FILTER (WHERE compose_project IS NOT NULL) as compose_projects
FROM docker_mount_catalog;

-- name: GetComposeProjectMountSummary :many
SELECT
    compose_project,
    COUNT(*) as mount_count,
    COUNT(*) FILTER (WHERE mount_type = 'volume') as volume_count,
    COUNT(*) FILTER (WHERE mount_type = 'bind') as bind_count,
    COUNT(*) FILTER (WHERE mount_type = 'tmpfs') as tmpfs_count,
    COUNT(*) FILTER (WHERE is_orphaned = true) as orphaned_count,
    COUNT(*) FILTER (WHERE is_tracked = true) as tracked_count,
    array_agg(DISTINCT mount_id ORDER BY mount_id) as mount_ids
FROM docker_mount_catalog
WHERE compose_project IS NOT NULL
GROUP BY compose_project
ORDER BY mount_count DESC, compose_project;

-- name: GetMountUsageAnalytics :many
SELECT
    dmc.mount_id,
    dmc.mount_type,
    dmc.volume_name,
    dmc.compose_project,
    dmc.container_count,
    dmc.is_orphaned,
    dmc.is_tracked,
    dms.peak_container_count,
    dms.total_attachments,
    dms.attachment_frequency_score,
    dms.days_since_creation,
    dms.days_since_last_use,
    dms.last_known_size_bytes
FROM docker_mount_catalog dmc
LEFT JOIN docker_mount_statistics dms ON dmc.id = dms.mount_catalog_id
ORDER BY 
    CASE WHEN $1::text = 'usage' THEN dms.attachment_frequency_score END DESC,
    CASE WHEN $1::text = 'size' THEN dms.last_known_size_bytes END DESC,
    CASE WHEN $1::text = 'age' THEN dms.days_since_creation END DESC,
    dmc.mount_id
LIMIT $2 OFFSET $3;

-- name: SearchMountCatalog :many
SELECT * FROM docker_mount_catalog
WHERE 
    ($1::text IS NULL OR mount_id ILIKE '%' || $1 || '%') AND
    ($2::text IS NULL OR volume_name ILIKE '%' || $2 || '%') AND
    ($3::text IS NULL OR compose_project ILIKE '%' || $3 || '%') AND
    ($4::mount_type IS NULL OR mount_type = $4) AND
    ($5::boolean IS NULL OR is_orphaned = $5) AND
    ($6::boolean IS NULL OR is_tracked = $6)
ORDER BY last_seen_at DESC
LIMIT $7 OFFSET $8;

-- name: GetStaleAttachments :many
-- Find attachments where container no longer exists (for cleanup)
SELECT * FROM docker_mount_attachments
WHERE is_active = true 
  AND updated_at < CURRENT_TIMESTAMP - INTERVAL '1 hour'
ORDER BY updated_at
LIMIT $1;

-- name: CleanupStaleAttachments :many
-- Mark attachments as inactive if they haven't been updated recently
UPDATE docker_mount_attachments SET
    is_active = false,
    detached_at = CURRENT_TIMESTAMP,
    updated_at = CURRENT_TIMESTAMP
WHERE is_active = true 
  AND updated_at < CURRENT_TIMESTAMP - INTERVAL '1 hour'
RETURNING *;