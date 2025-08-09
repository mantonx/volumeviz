-- Migration: 005_scan_tables
-- Description: Add scan_runs and volume_stats tables for volume scanning functionality
-- Up Migration

-- Create scan_runs table for tracking scan job operations
CREATE TABLE IF NOT EXISTS scan_runs (
    scan_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    volume_id VARCHAR(255) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
    method VARCHAR(50) NOT NULL DEFAULT 'du',
    started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    result_id UUID,
    estimated_duration BIGINT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create volume_stats table for historical volume scan statistics
CREATE TABLE IF NOT EXISTS volume_stats (
    id SERIAL PRIMARY KEY,
    volume_name VARCHAR(255) NOT NULL,
    size_bytes BIGINT NOT NULL DEFAULT 0,
    file_count BIGINT DEFAULT 0,
    scan_method VARCHAR(50) NOT NULL DEFAULT 'du',
    duration_ms BIGINT DEFAULT 0,
    ts TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_scan_runs_volume_id ON scan_runs(volume_id);
CREATE INDEX IF NOT EXISTS idx_scan_runs_status ON scan_runs(status);
CREATE INDEX IF NOT EXISTS idx_scan_runs_started_at ON scan_runs(started_at);

CREATE INDEX IF NOT EXISTS idx_volume_stats_volume_name ON volume_stats(volume_name);
CREATE INDEX IF NOT EXISTS idx_volume_stats_ts ON volume_stats(ts);

-- Add foreign key constraints if volumes table exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'volumes') THEN
        -- Note: Using volume_name instead of volume_id for volume_stats since the app uses volume names
        ALTER TABLE volume_stats ADD CONSTRAINT fk_volume_stats_volume_name 
            FOREIGN KEY (volume_name) REFERENCES volumes(name) ON DELETE CASCADE;
    END IF;
END $$;

-- Add update trigger for updated_at columns
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_scan_runs_updated_at 
    BEFORE UPDATE ON scan_runs 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_volume_stats_updated_at 
    BEFORE UPDATE ON volume_stats 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
