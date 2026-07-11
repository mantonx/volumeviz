-- Add host filesystem capacity columns to daily_stats
-- Captured at scan time (via syscall.Statfs on the volume's mount path) so
-- capacity forecasting can project a volume's growth rate against real
-- remaining disk space instead of an invented threshold.

ALTER TABLE daily_stats ADD COLUMN IF NOT EXISTS disk_total_bytes BIGINT;
ALTER TABLE daily_stats ADD COLUMN IF NOT EXISTS disk_available_bytes BIGINT;

COMMENT ON COLUMN daily_stats.disk_total_bytes IS 'Total size of the host filesystem backing this volume mount, at scan time';
COMMENT ON COLUMN daily_stats.disk_available_bytes IS 'Available (free) bytes on the host filesystem backing this volume mount, at scan time';
