-- Docker Mount Catalog Queries (SQLite version)
-- SQLC queries for Docker mount catalog operations

-- =============================================================================
-- DOCKER MOUNT CATALOG
-- =============================================================================

-- name: CreateDockerMount :one
INSERT INTO docker_mount_catalog (
    mount_id, mount_type, volume_name, volume_driver, volume_options,
    volume_labels, volume_scope, source_path, container_count, is_orphaned,
    compose_project, compose_services, compose_version, compose_config_files,
    discovery_source, is_tracked
) VALUES (
    ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
) ON CONFLICT(mount_id) 
DO UPDATE SET
    mount_type = excluded.mount_type,
    volume_driver = excluded.volume_driver,
    volume_options = excluded.volume_options,
    volume_labels = excluded.volume_labels,
    volume_scope = excluded.volume_scope,
    container_count = excluded.container_count,
    is_orphaned = excluded.is_orphaned,
    compose_project = excluded.compose_project,
    compose_services = excluded.compose_services,
    compose_version = excluded.compose_version,
    compose_config_files = excluded.compose_config_files,
    last_seen_at = CURRENT_TIMESTAMP,
    updated_at = CURRENT_TIMESTAMP
RETURNING *;

-- name: GetDockerMount :one
SELECT * FROM docker_mount_catalog
WHERE id = ?;

-- name: GetDockerMountByMountId :one
SELECT * FROM docker_mount_catalog
WHERE mount_id = ?;

-- name: ListDockerMounts :many
SELECT * FROM docker_mount_catalog
ORDER BY last_seen_at DESC
LIMIT ? OFFSET ?;

-- name: ListTrackedMounts :many
SELECT * FROM docker_mount_catalog
WHERE is_tracked = 1
ORDER BY compose_project, mount_id;

-- name: ListOrphanedMounts :many
SELECT * FROM docker_mount_catalog
WHERE is_orphaned = 1
ORDER BY last_seen_at DESC;

-- name: ListMountsByComposeProject :many
SELECT * FROM docker_mount_catalog
WHERE compose_project = ?
ORDER BY mount_id;

-- name: UpdateMountTracking :exec
UPDATE docker_mount_catalog
SET is_tracked = ?,
    tracking_enabled_at = CASE WHEN ? THEN CURRENT_TIMESTAMP ELSE tracking_enabled_at END,
    tracking_disabled_at = CASE WHEN NOT ? THEN CURRENT_TIMESTAMP ELSE tracking_disabled_at END,
    updated_at = CURRENT_TIMESTAMP
WHERE id = ?;

-- name: UpdateMountOrphanStatus :exec
UPDATE docker_mount_catalog
SET is_orphaned = ?,
    updated_at = CURRENT_TIMESTAMP
WHERE id = ?;

-- name: UpdateMountContainerCount :exec
UPDATE docker_mount_catalog
SET container_count = ?,
    is_orphaned = CASE WHEN ? = 0 THEN 1 ELSE 0 END,
    last_seen_at = CURRENT_TIMESTAMP,
    updated_at = CURRENT_TIMESTAMP
WHERE id = ?;

-- name: DeleteDockerMount :exec
DELETE FROM docker_mount_catalog
WHERE id = ?;

-- name: CountMountsByType :many
SELECT mount_type, COUNT(*) as count
FROM docker_mount_catalog
GROUP BY mount_type;

-- name: CountMountsByComposeProject :many
SELECT compose_project, COUNT(*) as count
FROM docker_mount_catalog
WHERE compose_project IS NOT NULL
GROUP BY compose_project
ORDER BY count DESC;

-- name: ListMountCatalogEntriesByVolume :many
SELECT * FROM docker_mount_catalog
WHERE mount_id = ?
ORDER BY created_at DESC;

-- name: ListMountCatalogEntries :many
SELECT * FROM docker_mount_catalog
ORDER BY created_at DESC
LIMIT ? OFFSET ?;

-- name: ListMountCatalogEntriesByType :many
SELECT * FROM docker_mount_catalog
WHERE mount_type = ?
ORDER BY created_at DESC
LIMIT ? OFFSET ?;

-- name: UpdateMountTrackingStatus :exec
UPDATE docker_mount_catalog
SET 
    is_tracked = ?,
    tracking_enabled_at = CASE WHEN ? = 1 THEN CURRENT_TIMESTAMP ELSE tracking_enabled_at END,
    tracking_disabled_at = CASE WHEN ? = 0 THEN CURRENT_TIMESTAMP ELSE tracking_disabled_at END,
    updated_at = CURRENT_TIMESTAMP
WHERE id = ?;

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
    ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
) RETURNING *;

-- name: GetMountAttachment :one
SELECT * FROM docker_mount_attachments
WHERE id = ?;

-- name: GetActiveAttachmentByContainer :one
SELECT * FROM docker_mount_attachments
WHERE container_id = ? AND mount_catalog_id = ? AND is_active = 1;

-- name: ListMountAttachments :many
SELECT * FROM docker_mount_attachments
WHERE mount_catalog_id = ?
ORDER BY attached_at DESC;

-- name: ListActiveAttachments :many
SELECT * FROM docker_mount_attachments
WHERE mount_catalog_id = ? AND is_active = 1
ORDER BY container_name;

-- name: ListAttachmentsByContainer :many
SELECT * FROM docker_mount_attachments
WHERE container_id = ? AND is_active = 1
ORDER BY destination_path;

-- name: ListAttachmentsByComposeService :many
SELECT * FROM docker_mount_attachments
WHERE container_compose_project = ? AND container_compose_service = ? AND is_active = 1
ORDER BY container_compose_container_number;

-- name: DeactivateAttachment :exec
UPDATE docker_mount_attachments
SET is_active = 0,
    detached_at = CURRENT_TIMESTAMP,
    updated_at = CURRENT_TIMESTAMP
WHERE id = ?;

-- name: DeactivateContainerAttachments :exec
UPDATE docker_mount_attachments
SET is_active = 0,
    detached_at = CURRENT_TIMESTAMP,
    updated_at = CURRENT_TIMESTAMP
WHERE container_id = ? AND is_active = 1;

-- name: UpdateAttachmentContainerState :exec
UPDATE docker_mount_attachments
SET container_state = ?,
    updated_at = CURRENT_TIMESTAMP
WHERE container_id = ? AND is_active = 1;

-- name: DeleteMountAttachment :exec
DELETE FROM docker_mount_attachments
WHERE id = ?;

-- name: CountActiveAttachments :one
SELECT COUNT(*) as count
FROM docker_mount_attachments
WHERE mount_catalog_id = ? AND is_active = 1;

-- =============================================================================
-- DOCKER MOUNT STATISTICS
-- =============================================================================

-- name: CreateOrUpdateMountStatistics :one
INSERT INTO docker_mount_statistics (
    mount_catalog_id, peak_container_count, total_attachments,
    compose_projects_count, compose_services_count,
    days_since_creation, days_since_last_use, attachment_frequency_score,
    last_known_size_bytes, last_scanned_at
) VALUES (
    ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
) ON CONFLICT(mount_catalog_id)
DO UPDATE SET
    peak_container_count = MAX(docker_mount_statistics.peak_container_count, excluded.peak_container_count),
    total_attachments = excluded.total_attachments,
    compose_projects_count = excluded.compose_projects_count,
    compose_services_count = excluded.compose_services_count,
    days_since_creation = excluded.days_since_creation,
    days_since_last_use = excluded.days_since_last_use,
    attachment_frequency_score = excluded.attachment_frequency_score,
    last_known_size_bytes = COALESCE(excluded.last_known_size_bytes, docker_mount_statistics.last_known_size_bytes),
    last_scanned_at = COALESCE(excluded.last_scanned_at, docker_mount_statistics.last_scanned_at),
    calculated_at = CURRENT_TIMESTAMP,
    updated_at = CURRENT_TIMESTAMP
RETURNING *;

-- name: GetMountStatistics :one
SELECT * FROM docker_mount_statistics
WHERE mount_catalog_id = ?;

-- name: UpdateMountSize :exec
UPDATE docker_mount_statistics
SET last_known_size_bytes = ?,
    last_scanned_at = CURRENT_TIMESTAMP,
    updated_at = CURRENT_TIMESTAMP
WHERE mount_catalog_id = ?;

-- =============================================================================
-- DOCKER PROJECTS
-- =============================================================================

-- name: CreateDockerProject :one
INSERT INTO docker_projects (
    project_name, compose_file_path, compose_file_hash,
    working_directory, services, networks, volumes, config_data
) VALUES (
    ?, ?, ?, ?, ?, ?, ?, ?
) ON CONFLICT(project_name)
DO UPDATE SET
    compose_file_path = excluded.compose_file_path,
    compose_file_hash = excluded.compose_file_hash,
    working_directory = excluded.working_directory,
    services = excluded.services,
    networks = excluded.networks,
    volumes = excluded.volumes,
    config_data = excluded.config_data,
    last_seen_at = CURRENT_TIMESTAMP
RETURNING *;

-- name: GetDockerProject :one
SELECT * FROM docker_projects
WHERE id = ?;

-- name: GetDockerProjectByName :one
SELECT * FROM docker_projects
WHERE project_name = ?;

-- name: ListDockerProjects :many
SELECT * FROM docker_projects
ORDER BY last_seen_at DESC
LIMIT ? OFFSET ?;

-- name: UpdateDockerProjectLastSeen :exec
UPDATE docker_projects
SET last_seen_at = CURRENT_TIMESTAMP
WHERE project_name = ?;

-- name: DeleteDockerProject :exec
DELETE FROM docker_projects
WHERE id = ?;