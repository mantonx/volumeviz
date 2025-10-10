-- Add scan checkpoints for crash recovery and resume capability
-- This enables long-running scans (1TB+ volumes) to resume after crashes/restarts

CREATE TABLE scan_checkpoints (
    id BIGSERIAL PRIMARY KEY,
    scan_id TEXT NOT NULL,
    volume_id TEXT NOT NULL,
    checkpoint_type TEXT NOT NULL, -- 'volume_scan', 'filesystem_indexing', 'enrichment'

    -- Progress state
    phase TEXT NOT NULL,
    progress DOUBLE PRECISION NOT NULL DEFAULT 0.0,

    -- Counters
    items_processed BIGINT NOT NULL DEFAULT 0,
    bytes_processed BIGINT NOT NULL DEFAULT 0,
    errors_count BIGINT NOT NULL DEFAULT 0,

    -- Resume position for filesystem indexing
    last_path TEXT,
    last_depth INTEGER,
    last_folder_id BIGINT, -- Resume from this folder in folders table
    resume_data JSONB, -- Method-specific resume data

    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Ensure one checkpoint per scan+type combination
    CONSTRAINT unique_scan_checkpoint UNIQUE (scan_id, checkpoint_type)
);

-- Indexes for fast checkpoint lookup
CREATE INDEX idx_scan_checkpoints_scan_id ON scan_checkpoints(scan_id);
CREATE INDEX idx_scan_checkpoints_volume_id ON scan_checkpoints(volume_id);
CREATE INDEX idx_scan_checkpoints_updated_at ON scan_checkpoints(updated_at DESC);

-- Index for cleanup job (delete checkpoints older than 7 days)
CREATE INDEX idx_scan_checkpoints_created_at ON scan_checkpoints(created_at);

-- Note: If scan_jobs table exists in your schema, you may want to add a status column
-- to track interrupted scans. This migration doesn't modify scan_jobs as it may not exist.

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_scan_checkpoint_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at on checkpoint updates
CREATE TRIGGER trigger_update_scan_checkpoint_updated_at
    BEFORE UPDATE ON scan_checkpoints
    FOR EACH ROW
    EXECUTE FUNCTION update_scan_checkpoint_updated_at();

-- Add comment for documentation
COMMENT ON TABLE scan_checkpoints IS 'Stores periodic checkpoints during volume scans to enable resume capability after crashes or interruptions. Critical for 1TB+ volumes with multi-hour scan times.';
COMMENT ON COLUMN scan_checkpoints.checkpoint_type IS 'Type of scan phase being checkpointed: volume_scan (size calculation), filesystem_indexing (file/folder crawl), enrichment (media metadata)';
COMMENT ON COLUMN scan_checkpoints.resume_data IS 'JSON object containing phase-specific data needed to resume. Example: {"method": "diskus", "started_at": "2025-10-05T10:00:00Z"}';
COMMENT ON COLUMN scan_checkpoints.last_folder_id IS 'ID of last processed folder in folders table. Used to resume filesystem indexing from exact position.';
