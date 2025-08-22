-- Rollback migration: Remove filesystem capacity columns from volume_sizes table

-- Remove indexes first
DROP INDEX IF EXISTS idx_volume_sizes_fs_total_bytes;
DROP INDEX IF EXISTS idx_volume_sizes_fs_usage_percent;  
DROP INDEX IF EXISTS idx_volume_sizes_with_fs_capacity;

-- Remove filesystem capacity columns
ALTER TABLE volume_sizes DROP COLUMN IF EXISTS fs_total_bytes;
ALTER TABLE volume_sizes DROP COLUMN IF EXISTS fs_available_bytes;
ALTER TABLE volume_sizes DROP COLUMN IF EXISTS fs_used_bytes;
ALTER TABLE volume_sizes DROP COLUMN IF EXISTS fs_usage_percent;
ALTER TABLE volume_sizes DROP COLUMN IF EXISTS fs_block_size;
ALTER TABLE volume_sizes DROP COLUMN IF EXISTS fs_total_blocks;
ALTER TABLE volume_sizes DROP COLUMN IF EXISTS fs_free_blocks;