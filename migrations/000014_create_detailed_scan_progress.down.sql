-- Drop comprehensive scan progress tracking schema

-- Drop functions
DROP FUNCTION IF EXISTS record_scan_error(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, TEXT);
DROP FUNCTION IF EXISTS update_scan_phase_progress(TEXT, TEXT, TEXT, INTEGER, BIGINT, BIGINT, TEXT, BIGINT);

-- Drop views
DROP VIEW IF EXISTS scan_progress_summary;
DROP VIEW IF EXISTS recent_scan_errors;
DROP VIEW IF EXISTS active_scans;

-- Drop tables in reverse dependency order
DROP TABLE IF EXISTS scan_performance_metrics;
DROP TABLE IF EXISTS scan_errors;
DROP TABLE IF EXISTS scan_progress_items;
DROP TABLE IF EXISTS scan_phases;

-- Remove columns added to scan_jobs
ALTER TABLE scan_jobs DROP COLUMN IF EXISTS current_phase;
ALTER TABLE scan_jobs DROP COLUMN IF EXISTS total_phases;
ALTER TABLE scan_jobs DROP COLUMN IF EXISTS phase_progress;