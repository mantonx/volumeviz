-- Add volume snapshots for incremental scanning
-- This enables tracking volume state over time and detecting changes

CREATE TABLE volume_snapshots (
    id BIGSERIAL PRIMARY KEY,
    volume_id TEXT NOT NULL,
    scan_id TEXT NOT NULL,

    -- Snapshot metadata
    snapshot_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    scan_method TEXT NOT NULL, -- 'diskus', 'du', 'native'

    -- Volume state at snapshot time
    total_size BIGINT NOT NULL DEFAULT 0,
    file_count BIGINT NOT NULL DEFAULT 0,
    folder_count BIGINT NOT NULL DEFAULT 0,

    -- For incremental comparison
    root_mtime TIMESTAMPTZ, -- Root directory modification time
    content_hash TEXT, -- Hash of directory tree structure (optional)

    -- Statistics
    scan_duration_ms BIGINT, -- How long the scan took
    indexing_duration_ms BIGINT, -- How long indexing took

    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()

    -- Note: Foreign key to volumes table will be added when volumes table is created
);

-- Indexes for fast lookups
CREATE INDEX idx_volume_snapshots_volume_id ON volume_snapshots(volume_id);
CREATE INDEX idx_volume_snapshots_snapshot_time ON volume_snapshots(snapshot_time DESC);
CREATE INDEX idx_volume_snapshots_scan_id ON volume_snapshots(scan_id);

-- Index for cleanup (delete old snapshots) - using simple index instead of partial for compatibility
CREATE INDEX idx_volume_snapshots_created_at ON volume_snapshots(created_at);

-- Add table to track directory-level changes for faster incremental detection
CREATE TABLE volume_directory_snapshots (
    id BIGSERIAL PRIMARY KEY,
    snapshot_id BIGINT NOT NULL,
    volume_id TEXT NOT NULL,

    -- Directory information
    dir_path TEXT NOT NULL, -- Relative path from volume root
    dir_mtime TIMESTAMPTZ NOT NULL, -- Directory modification time
    dir_size BIGINT NOT NULL DEFAULT 0, -- Total size of directory
    file_count INT NOT NULL DEFAULT 0, -- Number of files in directory
    subdir_count INT NOT NULL DEFAULT 0, -- Number of subdirectories

    -- For change detection
    content_hash TEXT, -- Hash of directory contents (filenames + sizes)

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_snapshot FOREIGN KEY (snapshot_id) REFERENCES volume_snapshots(id) ON DELETE CASCADE
);

-- Indexes for fast change detection
CREATE INDEX idx_volume_dir_snapshots_snapshot ON volume_directory_snapshots(snapshot_id);
CREATE INDEX idx_volume_dir_snapshots_volume ON volume_directory_snapshots(volume_id);
CREATE INDEX idx_volume_dir_snapshots_path ON volume_directory_snapshots(volume_id, dir_path);
CREATE INDEX idx_volume_dir_snapshots_mtime ON volume_directory_snapshots(dir_mtime DESC);

-- Function to get latest snapshot for a volume
CREATE OR REPLACE FUNCTION get_latest_snapshot(p_volume_id TEXT)
RETURNS TABLE (
    snapshot_id BIGINT,
    snapshot_time TIMESTAMPTZ,
    total_size BIGINT,
    file_count BIGINT,
    folder_count BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT id, snapshot_time, total_size, file_count, folder_count
    FROM volume_snapshots
    WHERE volume_id = p_volume_id
    ORDER BY snapshot_time DESC
    LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- Function to cleanup old snapshots (keep last 10 per volume)
CREATE OR REPLACE FUNCTION cleanup_old_snapshots(p_retention_days INT DEFAULT 90)
RETURNS INT AS $$
DECLARE
    deleted_count INT;
BEGIN
    -- Delete snapshots older than retention period, keeping at least last 3 per volume
    WITH ranked_snapshots AS (
        SELECT id,
               ROW_NUMBER() OVER (PARTITION BY volume_id ORDER BY snapshot_time DESC) as rn,
               created_at
        FROM volume_snapshots
    )
    DELETE FROM volume_snapshots
    WHERE id IN (
        SELECT id FROM ranked_snapshots
        WHERE rn > 10 OR created_at < NOW() - (p_retention_days || ' days')::INTERVAL
    );

    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Comments for documentation
COMMENT ON TABLE volume_snapshots IS 'Stores volume state snapshots for incremental scanning. Enables detecting changes between scans to avoid full rescans of unchanged data.';
COMMENT ON TABLE volume_directory_snapshots IS 'Stores directory-level snapshots for fine-grained change detection. Allows identifying specific directories that changed.';
COMMENT ON COLUMN volume_snapshots.content_hash IS 'Optional hash of directory tree structure. Can be used for quick change detection without walking the filesystem.';
COMMENT ON COLUMN volume_directory_snapshots.content_hash IS 'Hash of directory contents (filenames + sizes). Used to detect if directory contents changed.';
