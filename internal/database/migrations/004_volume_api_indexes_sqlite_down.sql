-- Migration: 004_volume_api_indexes_sqlite
-- Description: Remove Volume API v1 indexes (SQLite version)  
-- Down Migration

-- Drop all indexes created in the up migration
DROP INDEX IF EXISTS idx_volume_sizes_size_bytes;
DROP INDEX IF EXISTS idx_volumes_filter_sort;
DROP INDEX IF EXISTS idx_volume_mounts_orphaned_check;
DROP INDEX IF EXISTS idx_volumes_system_pattern;
DROP INDEX IF EXISTS idx_volumes_label_search;