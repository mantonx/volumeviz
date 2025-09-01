-- =============================================================================
-- VolumeViz Multi-Tenancy Schema Rollback
-- Removes organizations and multi-tenant features
-- =============================================================================

-- Drop triggers first
DROP TRIGGER IF EXISTS organizations_updated_at_trigger ON organizations;
DROP TRIGGER IF EXISTS organization_invitations_updated_at_trigger ON organization_invitations;

-- Drop audit logging
DROP TABLE IF EXISTS audit_logs CASCADE;

-- Drop RBAC tables
DROP TABLE IF EXISTS user_permissions CASCADE;
DROP TABLE IF EXISTS role_permissions CASCADE;
DROP TABLE IF EXISTS permissions CASCADE;

-- Drop organization tables
DROP TABLE IF EXISTS organization_invitations CASCADE;
DROP TABLE IF EXISTS organizations CASCADE;

-- Remove organization_id columns from existing tables
ALTER TABLE users DROP COLUMN IF EXISTS organization_id;
ALTER TABLE volumes DROP COLUMN IF EXISTS organization_id;
ALTER TABLE docker_mount_catalog DROP COLUMN IF EXISTS organization_id;
ALTER TABLE scan_jobs DROP COLUMN IF EXISTS organization_id;
ALTER TABLE saved_searches DROP COLUMN IF EXISTS organization_id;
ALTER TABLE tracking_rules DROP COLUMN IF EXISTS organization_id;
ALTER TABLE alert_rules DROP COLUMN IF EXISTS organization_id;