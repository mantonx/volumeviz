-- Remove sub_phase column from scan_phases table
ALTER TABLE scan_phases
DROP COLUMN IF EXISTS sub_phase;
