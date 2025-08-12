-- Migration: 001_initial_schema (SQLite version)
-- Description: Drop all tables created in the initial schema
-- Down Migration

-- Drop tables in reverse order of creation (due to foreign key constraints)
DROP TABLE IF EXISTS scan_cache;
DROP TABLE IF EXISTS system_health;
DROP TABLE IF EXISTS volume_metrics;
DROP TABLE IF EXISTS scan_jobs;
DROP TABLE IF EXISTS volume_mounts;
DROP TABLE IF EXISTS containers;
DROP TABLE IF EXISTS volume_sizes;
DROP TABLE IF EXISTS volumes;

-- Drop indexes
DROP INDEX IF EXISTS idx_migration_history_applied_at;
DROP INDEX IF EXISTS idx_migration_history_version;

-- Drop migration history table last
DROP TABLE IF EXISTS migration_history;