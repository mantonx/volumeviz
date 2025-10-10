-- Rollback migration: Remove organization assignments for migrated records
-- This sets organization_id back to NULL for records that were migrated

-- Note: This is a simplified rollback. In a production system, you might want to
-- track which records were migrated to provide more precise rollback.

UPDATE docker_mount_catalog 
SET organization_id = NULL 
WHERE organization_id = 1;