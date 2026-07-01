-- =============================================================================
-- Migration 000016: Add Volume Tracking Support
-- =============================================================================
-- This migration adds the ability to track/untrack volumes in VolumeViz.
-- When a volume is untracked, all its data is removed from the database but
-- the Docker volume itself remains intact (read-only app philosophy).
-- =============================================================================

-- Add is_tracked column to volumes table
-- Default to TRUE for all existing volumes (they are already being tracked)
ALTER TABLE volumes
ADD COLUMN is_tracked BOOLEAN NOT NULL DEFAULT TRUE;

-- Add comment to document the column
COMMENT ON COLUMN volumes.is_tracked IS 'Indicates whether this volume is actively tracked in VolumeViz. When FALSE, associated data should be removed from the database.';

-- Create an index for efficient filtering by tracking status
CREATE INDEX idx_volumes_is_tracked ON volumes(is_tracked);

-- Create an index for common queries (tracked + active volumes)
CREATE INDEX idx_volumes_tracked_active ON volumes(is_tracked, is_active) WHERE is_tracked = TRUE;

-- Update the updated_at timestamp trigger to include is_tracked changes
-- (Assuming there's already a trigger for updated_at, this comment documents the expected behavior)
-- The trigger should fire when is_tracked changes

-- Add tracking state transition timestamps
ALTER TABLE volumes
ADD COLUMN tracked_at TIMESTAMPTZ,
ADD COLUMN untracked_at TIMESTAMPTZ;

-- Set tracked_at for existing volumes to their created_at time
UPDATE volumes SET tracked_at = created_at WHERE is_tracked = TRUE;

-- Add comments for the timestamp columns
COMMENT ON COLUMN volumes.tracked_at IS 'Timestamp when the volume was last set to tracked status';
COMMENT ON COLUMN volumes.untracked_at IS 'Timestamp when the volume was last set to untracked status';
