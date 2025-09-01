-- =============================================================================
-- VolumeViz Multi-Tenancy Schema Rollback (SQLite)
-- Removes organizations and multi-tenant features
-- =============================================================================

-- Drop audit logging
DROP TABLE IF EXISTS audit_logs;

-- Drop RBAC tables
DROP TABLE IF EXISTS user_permissions;
DROP TABLE IF EXISTS role_permissions;
DROP TABLE IF EXISTS permissions;

-- Drop organization tables
DROP TABLE IF EXISTS organization_invitations;
DROP TABLE IF EXISTS organizations;

-- Remove organization_id columns from existing tables
-- Note: SQLite doesn't support DROP COLUMN directly, so we'll need to recreate tables
-- This is a simplified version - in production you'd want to preserve data

-- For now, just note that this would require table recreation in SQLite
-- ALTER TABLE users DROP COLUMN organization_id; -- Not supported in SQLite
-- ALTER TABLE volumes DROP COLUMN organization_id; -- Not supported in SQLite
-- etc.

-- Instead, we'll leave a comment about manual cleanup required
-- Manual cleanup required: Remove organization_id columns from:
-- users, volumes, docker_mount_catalog, scan_jobs, saved_searches, tracking_rules, alert_rules