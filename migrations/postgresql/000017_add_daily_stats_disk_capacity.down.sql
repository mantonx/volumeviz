-- =============================================================================
-- Migration 000017 Rollback: Remove daily_stats disk capacity columns
-- =============================================================================

ALTER TABLE daily_stats
DROP COLUMN IF EXISTS disk_available_bytes,
DROP COLUMN IF EXISTS disk_total_bytes;
