-- Remove pause_reason field and paused status index from scan_phases

-- Drop the index
DROP INDEX IF EXISTS idx_scan_phases_paused_status;

-- Remove pause_reason column
ALTER TABLE scan_phases DROP COLUMN IF EXISTS pause_reason;