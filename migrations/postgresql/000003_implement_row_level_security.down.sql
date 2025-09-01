-- Migration Rollback: Remove Row Level Security for Multi-Tenancy
-- This migration removes all RLS policies and utility functions

-- =============================================================================
-- PART 1: Drop RLS policies
-- =============================================================================

-- Drop policies for core data tables
DROP POLICY IF EXISTS volumes_organization_isolation ON volumes;
DROP POLICY IF EXISTS files_organization_isolation ON files;
DROP POLICY IF EXISTS folders_organization_isolation ON folders;
DROP POLICY IF EXISTS scan_jobs_organization_isolation ON scan_jobs;
DROP POLICY IF EXISTS saved_searches_organization_isolation ON saved_searches;
DROP POLICY IF EXISTS alerts_organization_isolation ON alerts;
DROP POLICY IF EXISTS daily_stats_organization_isolation ON daily_stats;
DROP POLICY IF EXISTS docker_mount_catalog_organization_isolation ON docker_mount_catalog;
DROP POLICY IF EXISTS audit_logs_organization_read ON audit_logs;
DROP POLICY IF EXISTS audit_logs_system_admin_write ON audit_logs;

-- Drop policies for user management tables
DROP POLICY IF EXISTS users_organization_isolation ON users;
DROP POLICY IF EXISTS invitations_organization_isolation ON organization_invitations;

-- =============================================================================
-- PART 2: Disable RLS on all tables
-- =============================================================================

-- Disable RLS on core data tables
ALTER TABLE volumes DISABLE ROW LEVEL SECURITY;
ALTER TABLE files DISABLE ROW LEVEL SECURITY;
ALTER TABLE folders DISABLE ROW LEVEL SECURITY;
ALTER TABLE scan_jobs DISABLE ROW LEVEL SECURITY;
ALTER TABLE saved_searches DISABLE ROW LEVEL SECURITY;
ALTER TABLE alerts DISABLE ROW LEVEL SECURITY;
ALTER TABLE daily_stats DISABLE ROW LEVEL SECURITY;
ALTER TABLE docker_mount_catalog DISABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs DISABLE ROW LEVEL SECURITY;

-- Disable RLS on organization-specific tables
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE organization_invitations DISABLE ROW LEVEL SECURITY;

-- =============================================================================
-- PART 3: Drop utility functions
-- =============================================================================

DROP FUNCTION IF EXISTS get_current_organization_id();
DROP FUNCTION IF EXISTS is_system_admin();
DROP FUNCTION IF EXISTS set_organization_context(bigint, boolean);
DROP FUNCTION IF EXISTS clear_organization_context();
DROP FUNCTION IF EXISTS set_system_admin_context();

-- =============================================================================
-- PART 4: Drop RLS performance indexes (optional - may want to keep for performance)
-- =============================================================================

-- Note: Commented out to preserve performance indexes
-- These indexes are beneficial even without RLS
-- Uncomment if you specifically want to remove them

-- DROP INDEX CONCURRENTLY IF EXISTS idx_volumes_organization_id;
-- DROP INDEX CONCURRENTLY IF EXISTS idx_files_organization_id;
-- DROP INDEX CONCURRENTLY IF EXISTS idx_folders_organization_id;
-- DROP INDEX CONCURRENTLY IF EXISTS idx_scan_jobs_organization_id;
-- DROP INDEX CONCURRENTLY IF EXISTS idx_users_organization_id;

-- =============================================================================
-- ROLLBACK COMPLETE
-- =============================================================================

DO $$
BEGIN
    RAISE NOTICE 'Row Level Security rollback completed successfully';
    RAISE NOTICE 'All RLS policies and utility functions have been removed';
    RAISE NOTICE 'Performance indexes on organization_id columns have been preserved';
END $$;