-- =============================================================================
-- User Authentication System - Rollback
-- Migration 002: Remove user management tables
-- =============================================================================

-- Drop triggers first
DROP TRIGGER IF EXISTS users_updated_at_trigger ON users;
DROP TRIGGER IF EXISTS user_preferences_updated_at_trigger ON user_preferences;

-- Drop tables in reverse dependency order
DROP TABLE IF EXISTS user_activity_log;
DROP TABLE IF EXISTS user_preferences;
DROP TABLE IF EXISTS user_sessions;
DROP TABLE IF EXISTS users;

-- Drop custom types
DROP TYPE IF EXISTS user_status;
DROP TYPE IF EXISTS user_role;