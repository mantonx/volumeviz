-- Migration: 006_file_analytics_tables
-- Description: Remove file_entries, dir_nodes, and dir_rollups tables for file/directory analytics
-- Down Migration (PostgreSQL)

-- Remove triggers first
DROP TRIGGER IF EXISTS update_file_entries_updated_at ON file_entries;
DROP TRIGGER IF EXISTS update_dir_nodes_updated_at ON dir_nodes;

-- Remove foreign key constraints to avoid dependency issues
ALTER TABLE file_entries DROP CONSTRAINT IF EXISTS fk_file_entries_parent_dir;
ALTER TABLE dir_nodes DROP CONSTRAINT IF EXISTS fk_dir_nodes_parent_dir;
ALTER TABLE dir_rollups DROP CONSTRAINT IF EXISTS fk_dir_rollups_dir;

-- Drop indexes (they will be removed with tables, but explicit for clarity)
DROP INDEX IF EXISTS idx_file_entries_volume_parent;
DROP INDEX IF EXISTS idx_file_entries_volume_path_hash;
DROP INDEX IF EXISTS idx_file_entries_type;
DROP INDEX IF EXISTS idx_file_entries_size;
DROP INDEX IF EXISTS idx_file_entries_volume_hidden_false;

DROP INDEX IF EXISTS idx_dir_nodes_volume_parent;
DROP INDEX IF EXISTS idx_dir_nodes_volume_path;
DROP INDEX IF EXISTS idx_dir_nodes_depth;
DROP INDEX IF EXISTS idx_dir_nodes_size;
DROP INDEX IF EXISTS idx_dir_nodes_root_dirs;

DROP INDEX IF EXISTS idx_dir_rollups_dir_computed;
DROP INDEX IF EXISTS idx_dir_rollups_computed_at;

-- Drop tables in reverse dependency order
DROP TABLE IF EXISTS dir_rollups CASCADE;
DROP TABLE IF EXISTS file_entries CASCADE;
DROP TABLE IF EXISTS dir_nodes CASCADE;

-- Note: We don't drop the update_updated_at_column function 
-- as it might be used by other tables from previous migrations