-- =============================================================================
-- VolumeViz Multi-Tenancy Schema
-- Adds organizations and multi-tenant data isolation
-- =============================================================================

-- =============================================================================
-- ORGANIZATIONS
-- =============================================================================

-- Organizations table - the core of multi-tenancy
CREATE TABLE organizations (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    description TEXT,
    subdomain TEXT UNIQUE, -- for potential subdomain-based routing
    
    -- Configuration
    settings JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT TRUE,
    
    -- Limits and quotas
    max_users INTEGER DEFAULT 50,
    max_volumes INTEGER DEFAULT 100,
    max_storage_gb BIGINT DEFAULT 1000,
    
    -- Billing/plan info
    plan_type TEXT DEFAULT 'free' CHECK (plan_type IN ('free', 'pro', 'enterprise')),
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    CONSTRAINT org_name_length CHECK (length(trim(name)) >= 3),
    CONSTRAINT org_display_name_length CHECK (length(trim(display_name)) >= 3)
);

-- Organization invitations for user onboarding
CREATE TABLE organization_invitations (
    id BIGSERIAL PRIMARY KEY,
    organization_id BIGINT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    role UserRole NOT NULL DEFAULT 'viewer',
    
    -- Invitation details
    token TEXT NOT NULL UNIQUE,
    invited_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
    message TEXT,
    
    -- Status tracking
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired', 'cancelled')),
    accepted_at TIMESTAMPTZ,
    accepted_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
    
    -- Expiration
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (CURRENT_TIMESTAMP + INTERVAL '7 days'),
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    UNIQUE(organization_id, email)
);

-- =============================================================================
-- UPDATE EXISTING TABLES FOR MULTI-TENANCY
-- =============================================================================

-- Add organization_id to users table
ALTER TABLE users ADD COLUMN organization_id BIGINT REFERENCES organizations(id) ON DELETE CASCADE;

-- Add organization_id to volumes table (the main data isolation)
ALTER TABLE volumes ADD COLUMN organization_id BIGINT REFERENCES organizations(id) ON DELETE CASCADE;

-- Add organization_id to docker_mount_catalog 
ALTER TABLE docker_mount_catalog ADD COLUMN organization_id BIGINT REFERENCES organizations(id) ON DELETE CASCADE;

-- Add organization_id to scan_jobs
ALTER TABLE scan_jobs ADD COLUMN organization_id BIGINT REFERENCES organizations(id) ON DELETE CASCADE;

-- Add organization_id to saved_searches
ALTER TABLE saved_searches ADD COLUMN organization_id BIGINT REFERENCES organizations(id) ON DELETE CASCADE;

-- Add organization_id to tracking_rules
ALTER TABLE tracking_rules ADD COLUMN organization_id BIGINT REFERENCES organizations(id) ON DELETE CASCADE;

-- Add organization_id to alert_rules
ALTER TABLE alert_rules ADD COLUMN organization_id BIGINT REFERENCES organizations(id) ON DELETE CASCADE;

-- =============================================================================
-- RBAC SYSTEM
-- =============================================================================

-- Permissions table - defines all possible permissions in the system
CREATE TABLE permissions (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    resource TEXT NOT NULL, -- 'volumes', 'scans', 'users', 'settings', etc.
    action TEXT NOT NULL,   -- 'read', 'write', 'delete', 'admin'
    description TEXT,
    
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    
    -- Ensure unique resource:action combinations
    UNIQUE(resource, action)
);

-- Role permissions - many-to-many mapping between roles and permissions
CREATE TABLE role_permissions (
    id BIGSERIAL PRIMARY KEY,
    role UserRole NOT NULL,
    permission_id BIGINT NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    
    -- Ensure unique role:permission combinations
    UNIQUE(role, permission_id)
);

-- User permissions - additional permissions granted to specific users
-- This allows for fine-grained permission overrides beyond role-based permissions
CREATE TABLE user_permissions (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    permission_id BIGINT NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    granted BOOLEAN NOT NULL DEFAULT TRUE, -- can also revoke permissions
    granted_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
    
    -- Optional resource-specific permissions
    resource_id TEXT, -- specific volume_id, scan_id, etc.
    
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    
    -- Ensure unique user:permission combinations
    UNIQUE(user_id, permission_id, resource_id)
);

-- =============================================================================
-- AUDIT LOGGING SYSTEM
-- =============================================================================

-- Comprehensive audit log for all system actions
CREATE TABLE audit_logs (
    id BIGSERIAL PRIMARY KEY,
    
    -- Who performed the action
    user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
    organization_id BIGINT REFERENCES organizations(id) ON DELETE SET NULL,
    session_id TEXT, -- link to user session
    
    -- What action was performed
    action TEXT NOT NULL, -- 'create', 'read', 'update', 'delete', 'login', 'logout', etc.
    resource_type TEXT NOT NULL, -- 'volume', 'user', 'scan', 'organization', etc.
    resource_id TEXT, -- specific ID of the resource
    
    -- Action details
    description TEXT NOT NULL,
    details JSONB DEFAULT '{}', -- structured details about the action
    old_values JSONB DEFAULT '{}', -- before values for updates/deletes
    new_values JSONB DEFAULT '{}', -- after values for creates/updates
    
    -- Request context
    ip_address INET,
    user_agent TEXT,
    request_id TEXT, -- trace requests across services
    
    -- Result
    success BOOLEAN NOT NULL DEFAULT TRUE,
    error_message TEXT,
    
    -- Performance
    duration_ms INTEGER, -- how long the action took
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- INDEXES FOR MULTI-TENANT PERFORMANCE
-- =============================================================================

-- Critical indexes for organization-based data isolation
CREATE INDEX idx_users_organization_id ON users(organization_id);
CREATE INDEX idx_volumes_organization_id ON volumes(organization_id);
CREATE INDEX idx_docker_mount_catalog_organization_id ON docker_mount_catalog(organization_id);
CREATE INDEX idx_scan_jobs_organization_id ON scan_jobs(organization_id);
CREATE INDEX idx_saved_searches_organization_id ON saved_searches(organization_id);
CREATE INDEX idx_tracking_rules_organization_id ON tracking_rules(organization_id);
CREATE INDEX idx_alert_rules_organization_id ON alert_rules(organization_id);

-- Composite indexes for common multi-tenant queries
CREATE INDEX idx_volumes_org_active ON volumes(organization_id, is_active);
CREATE INDEX idx_users_org_role ON users(organization_id, role);
CREATE INDEX idx_scan_jobs_org_status ON scan_jobs(organization_id, status);

-- Organization management indexes
CREATE INDEX idx_organization_invitations_org_status ON organization_invitations(organization_id, status);
CREATE INDEX idx_organization_invitations_email ON organization_invitations(email);
CREATE INDEX idx_organization_invitations_token ON organization_invitations(token);
CREATE INDEX idx_organization_invitations_expires ON organization_invitations(expires_at) WHERE status = 'pending';

-- RBAC indexes
CREATE INDEX idx_role_permissions_role ON role_permissions(role);
CREATE INDEX idx_user_permissions_user_id ON user_permissions(user_id);
CREATE INDEX idx_user_permissions_resource ON user_permissions(resource_id) WHERE resource_id IS NOT NULL;

-- =============================================================================
-- DATA INTEGRITY CONSTRAINTS
-- =============================================================================

-- Ensure users belong to an organization (after migration period)
-- ALTER TABLE users ADD CONSTRAINT users_must_have_organization 
--   CHECK (organization_id IS NOT NULL) NOT VALID;

-- Ensure volumes belong to an organization (after migration period)  
-- ALTER TABLE volumes ADD CONSTRAINT volumes_must_have_organization 
--   CHECK (organization_id IS NOT NULL) NOT VALID;

-- =============================================================================
-- TRIGGERS FOR AUTOMATIC UPDATES
-- =============================================================================

-- Update organization timestamps
CREATE TRIGGER organizations_updated_at_trigger
    BEFORE UPDATE ON organizations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER organization_invitations_updated_at_trigger
    BEFORE UPDATE ON organization_invitations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

-- =============================================================================
-- DEFAULT PERMISSIONS DATA
-- =============================================================================

-- Insert default permissions
INSERT INTO permissions (name, resource, action, description) VALUES
-- Volume permissions
('volumes:read', 'volumes', 'read', 'View volume information and statistics'),
('volumes:write', 'volumes', 'write', 'Modify volume settings and configurations'),
('volumes:delete', 'volumes', 'delete', 'Delete volumes from tracking'),
('volumes:scan', 'volumes', 'scan', 'Initiate and manage volume scans'),

-- Scan permissions  
('scans:read', 'scans', 'read', 'View scan jobs and results'),
('scans:write', 'scans', 'write', 'Create and manage scan jobs'),
('scans:delete', 'scans', 'delete', 'Cancel or delete scan jobs'),

-- User management permissions
('users:read', 'users', 'read', 'View user information'),
('users:write', 'users', 'write', 'Create and modify users'),
('users:delete', 'users', 'delete', 'Delete or deactivate users'),

-- Organization permissions
('organization:read', 'organization', 'read', 'View organization information'),
('organization:write', 'organization', 'write', 'Modify organization settings'),
('organization:admin', 'organization', 'admin', 'Full organization administration'),

-- Settings and configuration
('settings:read', 'settings', 'read', 'View system and org settings'),
('settings:write', 'settings', 'write', 'Modify system and org settings'),

-- Alerts and rules
('alerts:read', 'alerts', 'read', 'View alerts and alert rules'),
('alerts:write', 'alerts', 'write', 'Create and manage alert rules'),

-- Search and saved queries
('search:read', 'search', 'read', 'Use search functionality'),
('search:write', 'search', 'write', 'Create and manage saved searches'),

-- Docker integration
('docker:read', 'docker', 'read', 'View Docker mount information'),
('docker:write', 'docker', 'write', 'Modify Docker tracking rules');

-- Assign default permissions to roles
INSERT INTO role_permissions (role, permission_id)
SELECT 'viewer', id FROM permissions WHERE action = 'read';

INSERT INTO role_permissions (role, permission_id)  
SELECT 'operator', id FROM permissions 
WHERE action IN ('read', 'write') 
   OR name IN ('volumes:scan', 'scans:write');

INSERT INTO role_permissions (role, permission_id)
SELECT 'admin', id FROM permissions;

-- =============================================================================
-- DEFAULT ORGANIZATION FOR MIGRATION
-- =============================================================================

-- Create a default organization for existing data
INSERT INTO organizations (name, display_name, description, plan_type, max_users, max_volumes, max_storage_gb)
VALUES ('default', 'Default Organization', 'Default organization for existing VolumeViz installation', 'enterprise', 1000, 10000, 100000)
ON CONFLICT (name) DO NOTHING;