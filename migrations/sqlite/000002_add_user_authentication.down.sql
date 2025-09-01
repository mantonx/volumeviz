-- =============================================================================
-- User Authentication System - Rollback (SQLite)
-- Migration 002: Remove user management tables
-- =============================================================================

-- Drop triggers first
DROP TRIGGER IF EXISTS users_updated_at_trigger;
DROP TRIGGER IF EXISTS user_preferences_updated_at_trigger;

-- Drop tables in reverse dependency order
DROP TABLE IF EXISTS user_activity_log;
DROP TABLE IF EXISTS user_preferences;
DROP TABLE IF EXISTS user_sessions;
DROP TABLE IF EXISTS users;