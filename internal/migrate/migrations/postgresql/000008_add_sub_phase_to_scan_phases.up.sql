-- Add sub_phase column to scan_phases table for tracking current enricher
ALTER TABLE scan_phases
ADD COLUMN IF NOT EXISTS sub_phase TEXT;

-- Add comment to document the column
COMMENT ON COLUMN scan_phases.sub_phase IS 'Current sub-phase or enricher being executed (e.g., ffprobe, exiftool)';
