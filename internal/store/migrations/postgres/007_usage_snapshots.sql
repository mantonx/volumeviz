-- PostgreSQL Usage Snapshots Schema
-- Migration: 007_usage_snapshots
-- Description: Add usage_snapshots table for time-series data and trends analysis

-- Usage snapshots table for time-series data
CREATE TABLE IF NOT EXISTS usage_snapshots (
    id BIGSERIAL PRIMARY KEY,
    volume_id VARCHAR(255) NOT NULL,
    snapshot_date DATE NOT NULL,
    snapshot_type VARCHAR(20) NOT NULL CHECK (snapshot_type IN ('daily', 'weekly')),
    total_size BIGINT NOT NULL DEFAULT 0,
    file_count BIGINT NOT NULL DEFAULT 0,
    directory_count BIGINT NOT NULL DEFAULT 0,
    largest_file BIGINT NOT NULL DEFAULT 0,
    growth_bytes BIGINT DEFAULT 0, -- growth since previous snapshot
    growth_files BIGINT DEFAULT 0, -- file count growth
    growth_rate_bytes_per_day DOUBLE PRECISION DEFAULT 0,
    scan_method VARCHAR(50) NOT NULL,
    scan_duration_ms BIGINT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (volume_id) REFERENCES volumes(volume_id) ON DELETE CASCADE,
    UNIQUE(volume_id, snapshot_date, snapshot_type)
);

-- Create indexes for time-series queries
CREATE INDEX IF NOT EXISTS idx_usage_snapshots_volume_date 
    ON usage_snapshots(volume_id, snapshot_date DESC);

CREATE INDEX IF NOT EXISTS idx_usage_snapshots_date_type 
    ON usage_snapshots(snapshot_date DESC, snapshot_type);

CREATE INDEX IF NOT EXISTS idx_usage_snapshots_volume_type_date 
    ON usage_snapshots(volume_id, snapshot_type, snapshot_date DESC);

-- Create partial indexes for performance optimization
CREATE INDEX IF NOT EXISTS idx_usage_snapshots_daily_recent 
    ON usage_snapshots(volume_id, snapshot_date DESC) 
    WHERE snapshot_type = 'daily' AND snapshot_date >= (CURRENT_DATE - INTERVAL '90 days');

CREATE INDEX IF NOT EXISTS idx_usage_snapshots_weekly_recent 
    ON usage_snapshots(volume_id, snapshot_date DESC) 
    WHERE snapshot_type = 'weekly' AND snapshot_date >= (CURRENT_DATE - INTERVAL '1 year');

-- Add growth rate index for trend queries
CREATE INDEX IF NOT EXISTS idx_usage_snapshots_growth_rate 
    ON usage_snapshots(volume_id, growth_rate_bytes_per_day DESC);

-- Apply updated_at trigger
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_usage_snapshots_updated_at') THEN
        CREATE TRIGGER update_usage_snapshots_updated_at BEFORE UPDATE ON usage_snapshots
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

-- Add table comments for documentation
COMMENT ON TABLE usage_snapshots IS 'Time-series snapshots of volume usage for trends analysis and historical data retention';
COMMENT ON COLUMN usage_snapshots.snapshot_type IS 'Type of snapshot: daily (kept 90 days) or weekly (kept 1 year)';
COMMENT ON COLUMN usage_snapshots.growth_bytes IS 'Size growth in bytes since previous snapshot of same type';
COMMENT ON COLUMN usage_snapshots.growth_rate_bytes_per_day IS 'Calculated growth rate in bytes per day based on time delta';