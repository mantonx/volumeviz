-- Usage Snapshots Schema Migration
-- Creates table for time-series data and trends analysis

-- Usage snapshots table for time-series data
CREATE TABLE IF NOT EXISTS usage_snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    volume_id TEXT NOT NULL,
    snapshot_date DATE NOT NULL,
    snapshot_type TEXT NOT NULL CHECK (snapshot_type IN ('daily', 'weekly')),
    total_size INTEGER NOT NULL DEFAULT 0,
    file_count INTEGER NOT NULL DEFAULT 0,
    directory_count INTEGER NOT NULL DEFAULT 0,
    largest_file INTEGER NOT NULL DEFAULT 0,
    growth_bytes INTEGER DEFAULT 0, -- growth since previous snapshot
    growth_files INTEGER DEFAULT 0, -- file count growth
    growth_rate_bytes_per_day REAL DEFAULT 0,
    scan_method TEXT NOT NULL,
    scan_duration_ms INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
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
    WHERE snapshot_type = 'daily' AND snapshot_date >= date('now', '-90 days');

CREATE INDEX IF NOT EXISTS idx_usage_snapshots_weekly_recent 
    ON usage_snapshots(volume_id, snapshot_date DESC) 
    WHERE snapshot_type = 'weekly' AND snapshot_date >= date('now', '-1 year');

-- Add growth rate index for trend queries
CREATE INDEX IF NOT EXISTS idx_usage_snapshots_growth_rate 
    ON usage_snapshots(volume_id, growth_rate_bytes_per_day DESC);