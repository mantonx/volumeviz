-- Remove the scan_checkpoints table and its supporting objects.
--
-- This table was written to on every scan (every 5 minutes / 100k items) but
-- never read back by anything: resume actually happens via scan_phases
-- (see internal/scheduler/resume_manager.go), a separate, working mechanism.
-- scan_checkpoints was a second, redundant resume system that nothing ever
-- consulted, so it grew unbounded with no benefit.

DROP TRIGGER IF EXISTS trigger_update_scan_checkpoint_updated_at ON scan_checkpoints;
DROP FUNCTION IF EXISTS update_scan_checkpoint_updated_at();
DROP TABLE IF EXISTS scan_checkpoints;
