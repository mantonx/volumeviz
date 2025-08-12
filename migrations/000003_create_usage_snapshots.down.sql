-- Drop indexes first
DROP INDEX IF EXISTS idx_usage_snapshots_growth_rate;
DROP INDEX IF EXISTS idx_usage_snapshots_weekly_recent;
DROP INDEX IF EXISTS idx_usage_snapshots_daily_recent;
DROP INDEX IF EXISTS idx_usage_snapshots_volume_type_date;
DROP INDEX IF EXISTS idx_usage_snapshots_date_type;
DROP INDEX IF EXISTS idx_usage_snapshots_volume_date;

-- Drop table
DROP TABLE IF EXISTS usage_snapshots;