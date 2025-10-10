-- Rollback volume snapshots migration

-- Drop functions first
DROP FUNCTION IF EXISTS cleanup_old_snapshots(INT);
DROP FUNCTION IF EXISTS get_latest_snapshot(TEXT);

-- Drop tables (cascades to indexes and foreign keys)
DROP TABLE IF EXISTS volume_directory_snapshots;
DROP TABLE IF EXISTS volume_snapshots;
