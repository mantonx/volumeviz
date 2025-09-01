-- Rollback Docker Mount Catalog Migration (VV-301)

-- Drop indexes first
DROP INDEX IF EXISTS idx_docker_mount_attachments_container_active;
DROP INDEX IF EXISTS idx_docker_mount_catalog_compose_project_type;
DROP INDEX IF EXISTS idx_docker_mount_catalog_type_tracked;

DROP INDEX IF EXISTS idx_docker_mount_statistics_calculated_at;
DROP INDEX IF EXISTS idx_docker_mount_statistics_mount_id;

DROP INDEX IF EXISTS idx_docker_mount_attachments_compose_service;
DROP INDEX IF EXISTS idx_docker_mount_attachments_compose_project;
DROP INDEX IF EXISTS idx_docker_mount_attachments_active;
DROP INDEX IF EXISTS idx_docker_mount_attachments_container_id;
DROP INDEX IF EXISTS idx_docker_mount_attachments_mount_id;

DROP INDEX IF EXISTS idx_docker_mount_catalog_last_seen;
DROP INDEX IF EXISTS idx_docker_mount_catalog_compose_project;
DROP INDEX IF EXISTS idx_docker_mount_catalog_tracked;
DROP INDEX IF EXISTS idx_docker_mount_catalog_orphaned;
DROP INDEX IF EXISTS idx_docker_mount_catalog_volume_name;
DROP INDEX IF EXISTS idx_docker_mount_catalog_mount_type;
DROP INDEX IF EXISTS idx_docker_mount_catalog_mount_id;

-- Drop tables
DROP TABLE IF EXISTS docker_mount_statistics;
DROP TABLE IF EXISTS docker_mount_attachments;
DROP TABLE IF EXISTS docker_mount_catalog;

-- Drop custom types
DROP TYPE IF EXISTS mount_access_mode;
DROP TYPE IF EXISTS mount_type;