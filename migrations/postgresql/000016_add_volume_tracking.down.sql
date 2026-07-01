-- =============================================================================
-- Migration 000016 Rollback: Remove Volume Tracking Support
-- =============================================================================

-- Drop the indexes
DROP INDEX IF EXISTS idx_volumes_tracked_active;
DROP INDEX IF EXISTS idx_volumes_is_tracked;

-- Drop the timestamp columns
ALTER TABLE volumes
DROP COLUMN IF EXISTS untracked_at,
DROP COLUMN IF EXISTS tracked_at;

-- Drop the is_tracked column
ALTER TABLE volumes
DROP COLUMN IF EXISTS is_tracked;
