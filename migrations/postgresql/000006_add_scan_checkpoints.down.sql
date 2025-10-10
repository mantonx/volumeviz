-- Rollback scan checkpoints migration

-- Drop trigger first
DROP TRIGGER IF EXISTS trigger_update_scan_checkpoint_updated_at ON scan_checkpoints;

-- Drop function
DROP FUNCTION IF EXISTS update_scan_checkpoint_updated_at();

-- Drop table (cascades to indexes)
DROP TABLE IF EXISTS scan_checkpoints;

-- Remove status column from scan_jobs if we added it
-- Note: This is cautious - only drop if it was likely added by this migration
-- In production, you might want to keep this column if other code depends on it
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'scan_jobs'
        AND column_name = 'status'
    ) THEN
        -- Only drop if scan_jobs exists and has status column
        ALTER TABLE scan_jobs DROP COLUMN IF EXISTS status;
    END IF;
END $$;
