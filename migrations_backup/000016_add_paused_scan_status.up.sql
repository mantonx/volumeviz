-- Add pause_reason field to scan_phases to track why a scan was paused
-- This allows scans to be marked as paused during graceful restarts instead of failed

-- Add pause_reason field to track why a scan was paused
ALTER TABLE scan_phases ADD COLUMN IF NOT EXISTS pause_reason TEXT DEFAULT '';

-- Create index for querying paused scans (status is already TEXT, 'paused' is a valid value)
CREATE INDEX IF NOT EXISTS idx_scan_phases_paused_status ON scan_phases(status) WHERE status = 'paused';