-- Migration: 004_volume_api_indexes
-- Description: Add indexes for Volume API v1 endpoints performance
-- Up Migration

-- Add index for size_bytes in volume_sizes for orphaned volumes sorting
CREATE INDEX IF NOT EXISTS idx_volume_sizes_size_bytes ON volume_sizes(total_size DESC) WHERE is_valid = true;

-- Add composite index for volume filtering and sorting
CREATE INDEX IF NOT EXISTS idx_volumes_filter_sort 
    ON volumes(driver, created_at DESC, name) WHERE is_active = true;

-- Add index for orphaned volume detection (volumes without attachments)
-- This helps with the LEFT JOIN performance when finding orphaned volumes
CREATE INDEX IF NOT EXISTS idx_volume_mounts_orphaned_check 
    ON volume_mounts(volume_id) WHERE is_active = true;

-- Add partial index for system volumes detection based on name patterns
-- This improves filtering performance for system volumes
CREATE INDEX IF NOT EXISTS idx_volumes_system_pattern 
    ON volumes(name) 
    WHERE is_active = true 
    AND (name LIKE 'docker_%' OR name LIKE 'builder_%' OR name LIKE 'containerd%' OR name = '_data');

-- Add index for label-based search queries
CREATE INDEX IF NOT EXISTS idx_volumes_label_search ON volumes USING GIN(to_tsvector('english', labels::text));