-- Migration: Implement Row Level Security for Multi-Tenancy
-- This migration adds PostgreSQL Row Level Security (RLS) policies to enforce organization-based data isolation

-- =============================================================================
-- PART 1: Enable RLS on all organization-scoped tables
-- =============================================================================

-- Enable RLS on core data tables
ALTER TABLE volumes ENABLE ROW LEVEL SECURITY;
ALTER TABLE files ENABLE ROW LEVEL SECURITY;
ALTER TABLE folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE scan_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_searches ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE docker_mount_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Enable RLS on organization-specific tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_invitations ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- PART 2: Create utility function for organization context
-- =============================================================================

-- Function to get current organization ID from session variables
-- This allows the application to set the organization context per connection
CREATE OR REPLACE FUNCTION get_current_organization_id() 
RETURNS bigint AS $$
BEGIN
    -- Get organization ID from session variable set by application
    RETURN COALESCE(
        nullif(current_setting('app.current_organization_id', true), '')::bigint,
        NULL
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if current user is a system admin (for system-level operations)
CREATE OR REPLACE FUNCTION is_system_admin() 
RETURNS boolean AS $$
BEGIN
    -- Check if system admin flag is set by application
    RETURN COALESCE(
        current_setting('app.is_system_admin', true)::boolean,
        false
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- PART 3: Row Level Security Policies for Core Data Tables
-- =============================================================================

-- Volumes table policies
CREATE POLICY volumes_organization_isolation ON volumes
    FOR ALL
    TO PUBLIC
    USING (
        is_system_admin() OR 
        organization_id = get_current_organization_id() OR 
        organization_id IS NULL
    )
    WITH CHECK (
        is_system_admin() OR 
        organization_id = get_current_organization_id() OR 
        organization_id IS NULL
    );

-- Files table policies  
CREATE POLICY files_organization_isolation ON files
    FOR ALL
    TO PUBLIC
    USING (
        is_system_admin() OR 
        organization_id = get_current_organization_id() OR 
        organization_id IS NULL
    )
    WITH CHECK (
        is_system_admin() OR 
        organization_id = get_current_organization_id() OR 
        organization_id IS NULL
    );

-- Folders table policies
CREATE POLICY folders_organization_isolation ON folders
    FOR ALL
    TO PUBLIC
    USING (
        is_system_admin() OR 
        organization_id = get_current_organization_id() OR 
        organization_id IS NULL
    )
    WITH CHECK (
        is_system_admin() OR 
        organization_id = get_current_organization_id() OR 
        organization_id IS NULL
    );

-- Scan jobs table policies
CREATE POLICY scan_jobs_organization_isolation ON scan_jobs
    FOR ALL
    TO PUBLIC
    USING (
        is_system_admin() OR 
        organization_id = get_current_organization_id() OR 
        organization_id IS NULL
    )
    WITH CHECK (
        is_system_admin() OR 
        organization_id = get_current_organization_id() OR 
        organization_id IS NULL
    );

-- Saved searches table policies
CREATE POLICY saved_searches_organization_isolation ON saved_searches
    FOR ALL
    TO PUBLIC
    USING (
        is_system_admin() OR 
        organization_id = get_current_organization_id() OR 
        organization_id IS NULL
    )
    WITH CHECK (
        is_system_admin() OR 
        organization_id = get_current_organization_id() OR 
        organization_id IS NULL
    );

-- Alerts table policies
CREATE POLICY alerts_organization_isolation ON alerts
    FOR ALL
    TO PUBLIC
    USING (
        is_system_admin() OR 
        organization_id = get_current_organization_id() OR 
        organization_id IS NULL
    )
    WITH CHECK (
        is_system_admin() OR 
        organization_id = get_current_organization_id() OR 
        organization_id IS NULL
    );

-- Daily stats table policies
CREATE POLICY daily_stats_organization_isolation ON daily_stats
    FOR ALL
    TO PUBLIC
    USING (
        is_system_admin() OR 
        organization_id = get_current_organization_id() OR 
        organization_id IS NULL
    )
    WITH CHECK (
        is_system_admin() OR 
        organization_id = get_current_organization_id() OR 
        organization_id IS NULL
    );

-- Docker mount catalog table policies
CREATE POLICY docker_mount_catalog_organization_isolation ON docker_mount_catalog
    FOR ALL
    TO PUBLIC
    USING (
        is_system_admin() OR 
        organization_id = get_current_organization_id() OR 
        organization_id IS NULL
    )
    WITH CHECK (
        is_system_admin() OR 
        organization_id = get_current_organization_id() OR 
        organization_id IS NULL
    );

-- Audit logs table policies (read-only for organization, full access for system admin)
CREATE POLICY audit_logs_organization_read ON audit_logs
    FOR SELECT
    TO PUBLIC
    USING (
        is_system_admin() OR 
        organization_id = get_current_organization_id()
    );

CREATE POLICY audit_logs_system_admin_write ON audit_logs
    FOR INSERT
    TO PUBLIC
    WITH CHECK (is_system_admin());

-- =============================================================================
-- PART 4: Row Level Security Policies for User Management
-- =============================================================================

-- Users table policies - users can only see users in their organization
CREATE POLICY users_organization_isolation ON users
    FOR ALL
    TO PUBLIC
    USING (
        is_system_admin() OR 
        organization_id = get_current_organization_id()
    )
    WITH CHECK (
        is_system_admin() OR 
        organization_id = get_current_organization_id()
    );

-- Organization invitations - users can only see invitations for their organization
CREATE POLICY invitations_organization_isolation ON organization_invitations
    FOR ALL
    TO PUBLIC
    USING (
        is_system_admin() OR 
        organization_id = get_current_organization_id()
    )
    WITH CHECK (
        is_system_admin() OR 
        organization_id = get_current_organization_id()
    );

-- =============================================================================
-- PART 5: Grant necessary permissions
-- =============================================================================

-- Grant execute permissions on utility functions
GRANT EXECUTE ON FUNCTION get_current_organization_id() TO PUBLIC;
GRANT EXECUTE ON FUNCTION is_system_admin() TO PUBLIC;

-- =============================================================================
-- PART 6: Add helper functions for application use
-- =============================================================================

-- Function to set organization context for a database session
-- This should be called by the application when establishing organization context
CREATE OR REPLACE FUNCTION set_organization_context(org_id bigint, is_admin boolean DEFAULT false)
RETURNS void AS $$
BEGIN
    -- Set organization ID for this session
    PERFORM set_config('app.current_organization_id', org_id::text, false);
    
    -- Set system admin flag for this session
    PERFORM set_config('app.is_system_admin', is_admin::text, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to clear organization context (for system-level operations)
CREATE OR REPLACE FUNCTION clear_organization_context()
RETURNS void AS $$
BEGIN
    -- Clear organization context
    PERFORM set_config('app.current_organization_id', '', false);
    PERFORM set_config('app.is_system_admin', 'false', false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to set system admin context
CREATE OR REPLACE FUNCTION set_system_admin_context()
RETURNS void AS $$
BEGIN
    -- Set system admin flag
    PERFORM set_config('app.is_system_admin', 'true', false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions on context management functions
GRANT EXECUTE ON FUNCTION set_organization_context(bigint, boolean) TO PUBLIC;
GRANT EXECUTE ON FUNCTION clear_organization_context() TO PUBLIC;
GRANT EXECUTE ON FUNCTION set_system_admin_context() TO PUBLIC;

-- =============================================================================
-- PART 7: Indexes for RLS performance optimization
-- =============================================================================

-- Add indexes on organization_id columns for RLS policy performance
-- These indexes improve the performance of RLS policy checks

-- Volumes organization index (if not exists)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_volumes_organization_id ON volumes(organization_id) WHERE organization_id IS NOT NULL;

-- Files organization index (if not exists)  
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_files_organization_id ON files(organization_id) WHERE organization_id IS NOT NULL;

-- Folders organization index (if not exists)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_folders_organization_id ON folders(organization_id) WHERE organization_id IS NOT NULL;

-- Scan jobs organization index (if not exists)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_scan_jobs_organization_id ON scan_jobs(organization_id) WHERE organization_id IS NOT NULL;

-- Users organization index (if not exists)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_organization_id ON users(organization_id) WHERE organization_id IS NOT NULL;

-- =============================================================================
-- MIGRATION COMPLETE
-- =============================================================================

-- Log successful migration
DO $$
BEGIN
    RAISE NOTICE 'Row Level Security migration completed successfully';
    RAISE NOTICE 'RLS enabled on % organization-scoped tables', (
        SELECT count(*) 
        FROM information_schema.tables t
        JOIN information_schema.columns c ON t.table_name = c.table_name
        WHERE t.table_schema = 'public' 
          AND c.column_name = 'organization_id'
          AND c.table_schema = 'public'
    );
    RAISE NOTICE 'Use set_organization_context(org_id) to set organization context for queries';
    RAISE NOTICE 'Use set_system_admin_context() for system-level operations';
END $$;