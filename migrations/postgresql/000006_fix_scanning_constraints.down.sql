-- Migration rollback: Revert scanning constraint fixes
-- This reverts to the original (incorrect) constraints

-- Drop scan_errors table
DROP TABLE IF EXISTS scan_errors;

-- Revert scan_phases status constraint to original (without 'pending')
ALTER TABLE scan_phases DROP CONSTRAINT IF EXISTS scan_phases_status_check;
ALTER TABLE scan_phases ADD CONSTRAINT scan_phases_status_check
  CHECK (status IN (
    'queued',
    'running',
    'completed',
    'failed',
    'cancelled',
    'paused'
  ));

-- Revert scan_phases phase_name constraint to original
ALTER TABLE scan_phases DROP CONSTRAINT IF EXISTS scan_phases_phase_name_check;
ALTER TABLE scan_phases ADD CONSTRAINT scan_phases_phase_name_check
  CHECK (phase_name IN (
    'discovery',
    'analysis',
    'indexing',
    'metadata_extraction',
    'finalization'
  ));
