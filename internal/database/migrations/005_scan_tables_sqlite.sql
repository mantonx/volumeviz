-- Migration: 005_scan_tables_sqlite
-- Description: Add scan_runs and volume_stats tables for volume scanning functionality (SQLite version)
-- Up Migration

-- Create scan_runs table for tracking scan job operations
CREATE TABLE IF NOT EXISTS scan_runs (
    scan_id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    volume_id VARCHAR(255) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
    method VARCHAR(50) NOT NULL DEFAULT 'du',
    started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME,
    error_message TEXT,
    result_id TEXT,
    estimated_duration BIGINT DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Create volume_stats table for historical volume scan statistics
CREATE TABLE IF NOT EXISTS volume_stats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    volume_name VARCHAR(255) NOT NULL,
    size_bytes BIGINT NOT NULL DEFAULT 0,
    file_count BIGINT DEFAULT 0,
    scan_method VARCHAR(50) NOT NULL DEFAULT 'du',
    duration_ms BIGINT DEFAULT 0,
    ts DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_scan_runs_volume_id ON scan_runs(volume_id);
CREATE INDEX IF NOT EXISTS idx_scan_runs_status ON scan_runs(status);
CREATE INDEX IF NOT EXISTS idx_scan_runs_started_at ON scan_runs(started_at);

CREATE INDEX IF NOT EXISTS idx_volume_stats_volume_name ON volume_stats(volume_name);
CREATE INDEX IF NOT EXISTS idx_volume_stats_ts ON volume_stats(ts);

-- Add foreign key constraints if volumes table exists
-- Note: Foreign key constraint omitted to avoid unique constraint issues
-- Volume names should be validated at the application level

-- Add triggers for updated_at columns (SQLite version)
CREATE TRIGGER IF NOT EXISTS update_scan_runs_updated_at 
    BEFORE UPDATE ON scan_runs 
    FOR EACH ROW 
    BEGIN
        UPDATE scan_runs SET updated_at = CURRENT_TIMESTAMP WHERE rowid = NEW.rowid;
    END;

CREATE TRIGGER IF NOT EXISTS update_volume_stats_updated_at 
    BEFORE UPDATE ON volume_stats 
    FOR EACH ROW 
    BEGIN
        UPDATE volume_stats SET updated_at = CURRENT_TIMESTAMP WHERE rowid = NEW.rowid;
    END;