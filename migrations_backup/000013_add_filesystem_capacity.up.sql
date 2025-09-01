-- Migration to add filesystem capacity support to volume_sizes table
-- This enables storing and retrieving filesystem capacity information for both network and regular Docker volumes

-- Add filesystem capacity columns to volume_sizes table
ALTER TABLE volume_sizes ADD COLUMN fs_total_bytes BIGINT;
ALTER TABLE volume_sizes ADD COLUMN fs_available_bytes BIGINT;  
ALTER TABLE volume_sizes ADD COLUMN fs_used_bytes BIGINT;
ALTER TABLE volume_sizes ADD COLUMN fs_usage_percent NUMERIC(5,2);
ALTER TABLE volume_sizes ADD COLUMN fs_block_size BIGINT;
ALTER TABLE volume_sizes ADD COLUMN fs_total_blocks BIGINT;
ALTER TABLE volume_sizes ADD COLUMN fs_free_blocks BIGINT;

-- Add indexes for filesystem capacity queries
CREATE INDEX IF NOT EXISTS idx_volume_sizes_fs_total_bytes ON volume_sizes(fs_total_bytes) WHERE fs_total_bytes IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_volume_sizes_fs_usage_percent ON volume_sizes(fs_usage_percent) WHERE fs_usage_percent IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_volume_sizes_with_fs_capacity ON volume_sizes(volume_id, created_at DESC) WHERE fs_total_bytes IS NOT NULL AND is_valid = 1;

-- PostgreSQL-only comments (SQLite ignores COMMENT statements)
-- fs_total_bytes: Total filesystem capacity in bytes (from syscall.Statfs)
-- fs_available_bytes: Available filesystem space in bytes  
-- fs_used_bytes: Used filesystem space in bytes
-- fs_usage_percent: Filesystem usage percentage (0-100)
-- fs_block_size: Filesystem block size in bytes
-- fs_total_blocks: Total filesystem blocks
-- fs_free_blocks: Free filesystem blocks