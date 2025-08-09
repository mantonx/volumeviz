-- Migration: 004_volume_api_indexes
-- Description: Remove indexes for Volume API v1 endpoints
-- Down Migration

DROP INDEX IF EXISTS idx_volume_sizes_size_bytes;
DROP INDEX IF EXISTS idx_volumes_filter_sort;
DROP INDEX IF EXISTS idx_volume_mounts_orphaned_check;
DROP INDEX IF EXISTS idx_volumes_system_pattern;
DROP INDEX IF EXISTS idx_volumes_label_search;