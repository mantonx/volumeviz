-- =============================================================================
-- VolumeViz Multi-Tenancy Schema (Simplified)
-- Adds basic organizations support without full RBAC
-- =============================================================================

-- Organizations table - the core of multi-tenancy
CREATE TABLE IF NOT EXISTS organizations (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    description TEXT,
    subdomain TEXT UNIQUE,

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

-- Create default organization for existing data
INSERT INTO organizations (name, display_name, description, plan_type, max_users, max_volumes, max_storage_gb)
VALUES ('default', 'Default Organization', 'Default organization for existing VolumeViz installation', 'enterprise', 1000, 10000, 100000)
ON CONFLICT (name) DO NOTHING;

-- Add organization_id to volumes table (only if not exists)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name='volumes' AND column_name='organization_id'
    ) THEN
        ALTER TABLE volumes ADD COLUMN organization_id BIGINT REFERENCES organizations(id) ON DELETE CASCADE;

        -- Set existing volumes to default organization
        UPDATE volumes SET organization_id = (SELECT id FROM organizations WHERE name = 'default' LIMIT 1)
        WHERE organization_id IS NULL;
    END IF;
END $$;

-- Add organization_id to docker_mount_catalog (only if not exists)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name='docker_mount_catalog' AND column_name='organization_id'
    ) THEN
        ALTER TABLE docker_mount_catalog ADD COLUMN organization_id BIGINT REFERENCES organizations(id) ON DELETE CASCADE;

        -- Set existing mounts to default organization
        UPDATE docker_mount_catalog SET organization_id = (SELECT id FROM organizations WHERE name = 'default' LIMIT 1)
        WHERE organization_id IS NULL;
    END IF;
END $$;

-- Add organization_id to scan_jobs (only if not exists)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name='scan_jobs' AND column_name='organization_id'
    ) THEN
        ALTER TABLE scan_jobs ADD COLUMN organization_id BIGINT REFERENCES organizations(id) ON DELETE CASCADE;

        -- Set existing scan jobs to default organization
        UPDATE scan_jobs SET organization_id = (SELECT id FROM organizations WHERE name = 'default' LIMIT 1)
        WHERE organization_id IS NULL;
    END IF;
END $$;

-- Add organization_id to saved_searches (only if table exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='saved_searches') THEN
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name='saved_searches' AND column_name='organization_id'
        ) THEN
            ALTER TABLE saved_searches ADD COLUMN organization_id BIGINT REFERENCES organizations(id) ON DELETE CASCADE;

            -- Set existing searches to default organization
            UPDATE saved_searches SET organization_id = (SELECT id FROM organizations WHERE name = 'default' LIMIT 1)
            WHERE organization_id IS NULL;
        END IF;
    END IF;
END $$;

-- Add organization_id to tracking_rules (only if table exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='tracking_rules') THEN
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name='tracking_rules' AND column_name='organization_id'
        ) THEN
            ALTER TABLE tracking_rules ADD COLUMN organization_id BIGINT REFERENCES organizations(id) ON DELETE CASCADE;

            -- Set existing rules to default organization
            UPDATE tracking_rules SET organization_id = (SELECT id FROM organizations WHERE name = 'default' LIMIT 1)
            WHERE organization_id IS NULL;
        END IF;
    END IF;
END $$;

-- Add organization_id to alert_rules (only if table exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='alert_rules') THEN
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name='alert_rules' AND column_name='organization_id'
        ) THEN
            ALTER TABLE alert_rules ADD COLUMN organization_id BIGINT REFERENCES organizations(id) ON DELETE CASCADE;

            -- Set existing alert rules to default organization
            UPDATE alert_rules SET organization_id = (SELECT id FROM organizations WHERE name = 'default' LIMIT 1)
            WHERE organization_id IS NULL;
        END IF;
    END IF;
END $$;

-- Create indexes for organization lookups
CREATE INDEX IF NOT EXISTS idx_volumes_organization_id ON volumes(organization_id);
CREATE INDEX IF NOT EXISTS idx_docker_mount_catalog_organization_id ON docker_mount_catalog(organization_id);
CREATE INDEX IF NOT EXISTS idx_scan_jobs_organization_id ON scan_jobs(organization_id);
CREATE INDEX IF NOT EXISTS idx_organizations_name ON organizations(name);
CREATE INDEX IF NOT EXISTS idx_organizations_is_active ON organizations(is_active) WHERE is_active = TRUE;
