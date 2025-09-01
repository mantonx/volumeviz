-- Docker Mount Catalog Queries (PostgreSQL version)
-- SQLC queries for Docker mount catalog operations

-- =============================================================================
-- DOCKER MOUNT CATALOG
-- =============================================================================

-- name: CreateDockerMount :one
INSERT INTO docker_mount_catalog (
    mount_id, mount_type, volume_name, volume_driver, volume_options,
    volume_labels, volume_scope, source_path, container_count, is_orphaned,
    compose_project, compose_services, compose_version, compose_config_files,
    discovery_source, is_tracked, organization_id
) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17
) ON CONFLICT(mount_id) 
DO UPDATE SET
    mount_type = EXCLUDED.mount_type,
    volume_driver = EXCLUDED.volume_driver,
    volume_options = EXCLUDED.volume_options,
    volume_labels = EXCLUDED.volume_labels,
    volume_scope = EXCLUDED.volume_scope,
    source_path = EXCLUDED.source_path,
    container_count = EXCLUDED.container_count,
    is_orphaned = EXCLUDED.is_orphaned,
    compose_project = EXCLUDED.compose_project,
    compose_services = EXCLUDED.compose_services,
    compose_version = EXCLUDED.compose_version,
    compose_config_files = EXCLUDED.compose_config_files,
    discovery_source = EXCLUDED.discovery_source,
    is_tracked = EXCLUDED.is_tracked,
    organization_id = EXCLUDED.organization_id,
    last_seen_at = CURRENT_TIMESTAMP
RETURNING *;

-- name: GetDockerMount :one
SELECT * FROM docker_mount_catalog WHERE id = $1;

-- name: GetDockerMountByMountId :one
SELECT * FROM docker_mount_catalog WHERE mount_id = $1;

-- name: ListMountCatalogEntries :many
SELECT * FROM docker_mount_catalog
ORDER BY last_seen_at DESC
LIMIT $1 OFFSET $2;

-- name: ListMountCatalogEntriesByOrganization :many
SELECT * FROM docker_mount_catalog
WHERE organization_id = $1
ORDER BY last_seen_at DESC
LIMIT $2 OFFSET $3;

-- name: ListMountCatalogEntriesByVolume :many  
SELECT * FROM docker_mount_catalog WHERE mount_id = $1;

-- name: ListMountCatalogEntriesByType :many
SELECT * FROM docker_mount_catalog 
WHERE mount_type = $1
ORDER BY last_seen_at DESC
LIMIT $2 OFFSET $3;

-- name: ListTrackedMounts :many
SELECT * FROM docker_mount_catalog 
WHERE is_tracked = true
ORDER BY last_seen_at DESC;

-- name: ListOrphanedMounts :many
SELECT * FROM docker_mount_catalog 
WHERE is_orphaned = true
ORDER BY last_seen_at DESC;

-- name: UpdateMountContainerCount :exec
UPDATE docker_mount_catalog 
SET container_count = $2, last_seen_at = CURRENT_TIMESTAMP
WHERE id = $1;

-- name: UpdateMountTrackingStatus :exec
UPDATE docker_mount_catalog 
SET is_tracked = $2
WHERE id = $1;

-- name: CountMountsByType :one
SELECT COUNT(*) FROM docker_mount_catalog WHERE mount_type = $1;

-- name: CountMountsByComposeProject :one
SELECT COUNT(*) FROM docker_mount_catalog WHERE compose_project = $1;

-- =============================================================================
-- DOCKER MOUNT ATTACHMENTS
-- =============================================================================

-- name: CreateMountAttachment :one
INSERT INTO docker_mount_attachments (
    mount_catalog_id, container_id, container_name, destination_path,
    access_mode, propagation, container_state, container_image,
    container_labels, container_compose_project, container_compose_service,
    container_compose_container_number, container_compose_config_hash
) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13
) ON CONFLICT(mount_catalog_id, container_id, destination_path)
DO UPDATE SET
    container_name = EXCLUDED.container_name,
    access_mode = EXCLUDED.access_mode,
    propagation = EXCLUDED.propagation,
    container_state = EXCLUDED.container_state,
    container_image = EXCLUDED.container_image,
    container_labels = EXCLUDED.container_labels,
    container_compose_project = EXCLUDED.container_compose_project,
    container_compose_service = EXCLUDED.container_compose_service,
    container_compose_container_number = EXCLUDED.container_compose_container_number,
    container_compose_config_hash = EXCLUDED.container_compose_config_hash,
    is_active = true,
    updated_at = CURRENT_TIMESTAMP
RETURNING *;

-- name: GetMountAttachment :one
SELECT * FROM docker_mount_attachments WHERE id = $1;

-- name: ListMountAttachments :many
SELECT * FROM docker_mount_attachments
WHERE mount_catalog_id = $1
ORDER BY attached_at DESC;

-- name: ListActiveMountAttachments :many
SELECT * FROM docker_mount_attachments
WHERE mount_catalog_id = $1 AND is_active = true
ORDER BY attached_at DESC;

-- name: DeactivateMountAttachment :exec
UPDATE docker_mount_attachments
SET is_active = false, detached_at = CURRENT_TIMESTAMP
WHERE id = $1;

-- name: DeactivateMountAttachmentsByContainer :exec
UPDATE docker_mount_attachments
SET is_active = false, detached_at = CURRENT_TIMESTAMP
WHERE container_id = $1;

-- name: CountActiveMountAttachments :one
SELECT COUNT(*) FROM docker_mount_attachments
WHERE mount_catalog_id = $1 AND is_active = true;

-- =============================================================================
-- DOCKER MOUNT STATISTICS
-- =============================================================================

-- name: CreateMountStatistics :one
INSERT INTO docker_mount_statistics (
    mount_catalog_id, peak_container_count, total_attachments,
    compose_projects_count, compose_services_count, days_since_creation,
    days_since_last_use, attachment_frequency_score, last_known_size_bytes
) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8, $9
) ON CONFLICT(mount_catalog_id)
DO UPDATE SET
    peak_container_count = EXCLUDED.peak_container_count,
    total_attachments = EXCLUDED.total_attachments,
    compose_projects_count = EXCLUDED.compose_projects_count,
    compose_services_count = EXCLUDED.compose_services_count,
    days_since_creation = EXCLUDED.days_since_creation,
    days_since_last_use = EXCLUDED.days_since_last_use,
    attachment_frequency_score = EXCLUDED.attachment_frequency_score,
    last_known_size_bytes = EXCLUDED.last_known_size_bytes,
    calculated_at = CURRENT_TIMESTAMP,
    updated_at = CURRENT_TIMESTAMP
RETURNING *;

-- name: GetMountStatistics :one
SELECT * FROM docker_mount_statistics WHERE mount_catalog_id = $1;

-- name: ListMountStatistics :many
SELECT * FROM docker_mount_statistics
ORDER BY calculated_at DESC
LIMIT $1;

-- =============================================================================
-- DOCKER PROJECTS
-- =============================================================================

-- name: CreateDockerProject :one
INSERT INTO docker_projects (
    project_name, compose_file_path, compose_file_hash,
    working_directory, services, networks, volumes, config_data
) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8
) ON CONFLICT(project_name)
DO UPDATE SET
    compose_file_path = EXCLUDED.compose_file_path,
    compose_file_hash = EXCLUDED.compose_file_hash,
    working_directory = EXCLUDED.working_directory,
    services = EXCLUDED.services,
    networks = EXCLUDED.networks,
    volumes = EXCLUDED.volumes,
    config_data = EXCLUDED.config_data,
    last_seen_at = CURRENT_TIMESTAMP
RETURNING *;

-- name: GetDockerProject :one
SELECT * FROM docker_projects WHERE id = $1;

-- name: GetDockerProjectByName :one
SELECT * FROM docker_projects WHERE project_name = $1;

-- name: ListDockerProjects :many
SELECT * FROM docker_projects
ORDER BY last_seen_at DESC;

-- name: UpdateDockerProjectLastSeen :exec
UPDATE docker_projects
SET last_seen_at = CURRENT_TIMESTAMP
WHERE project_name = $1;