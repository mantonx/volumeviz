-- Migration: 001_initial_schema
-- Description: Rollback initial database schema
-- Down Migration

DROP TABLE IF EXISTS scan_cache CASCADE;
DROP TABLE IF EXISTS system_health CASCADE;
DROP TABLE IF EXISTS volume_metrics CASCADE;
DROP TABLE IF EXISTS scan_jobs CASCADE;
DROP TABLE IF EXISTS volume_mounts CASCADE;
DROP TABLE IF EXISTS containers CASCADE;
DROP TABLE IF EXISTS volume_sizes CASCADE;
DROP TABLE IF EXISTS volumes CASCADE;
DROP TABLE IF EXISTS migration_history CASCADE;