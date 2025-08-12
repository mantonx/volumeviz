-- PostgreSQL File Analytics Schema for VolumeViz
-- This is an idempotent schema file - can be run multiple times safely

-- File entries table
CREATE TABLE IF NOT EXISTS file_entries (
    id BIGSERIAL PRIMARY KEY,
    volume_id VARCHAR(255) NOT NULL,
    parent_dir_id BIGINT,
    name VARCHAR(512) NOT NULL,
    size_bytes BIGINT NOT NULL DEFAULT 0,
    mtime TIMESTAMP WITH TIME ZONE NOT NULL,
    ctime TIMESTAMP WITH TIME ZONE NOT NULL,
    inode BIGINT,
    uid INTEGER,
    gid INTEGER,
    type VARCHAR(10) NOT NULL,
    hidden BOOLEAN NOT NULL DEFAULT FALSE,
    path_hash BYTEA NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Directory nodes table
CREATE TABLE IF NOT EXISTS dir_nodes (
    id BIGSERIAL PRIMARY KEY,
    volume_id VARCHAR(255) NOT NULL,
    parent_dir_id BIGINT,
    name VARCHAR(512) NOT NULL,
    full_path VARCHAR(4096) NOT NULL,
    depth INTEGER NOT NULL DEFAULT 0,
    latest_size_bytes BIGINT NOT NULL DEFAULT 0,
    latest_file_count BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Directory rollups table
CREATE TABLE IF NOT EXISTS dir_rollups (
    id BIGSERIAL PRIMARY KEY,
    dir_id BIGINT NOT NULL,
    size_bytes BIGINT NOT NULL DEFAULT 0,
    file_count BIGINT NOT NULL DEFAULT 0,
    computed_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for file_entries
CREATE INDEX IF NOT EXISTS idx_file_entries_volume_id ON file_entries(volume_id);
CREATE INDEX IF NOT EXISTS idx_file_entries_parent_dir_id ON file_entries(parent_dir_id);
CREATE INDEX IF NOT EXISTS idx_file_entries_name ON file_entries(name);
CREATE INDEX IF NOT EXISTS idx_file_entries_size_bytes ON file_entries(size_bytes);
CREATE INDEX IF NOT EXISTS idx_file_entries_type ON file_entries(type);
CREATE INDEX IF NOT EXISTS idx_file_entries_path_hash ON file_entries(path_hash);
CREATE INDEX IF NOT EXISTS idx_file_entries_volume_parent ON file_entries(volume_id, parent_dir_id);
CREATE INDEX IF NOT EXISTS idx_file_entries_volume_size ON file_entries(volume_id, size_bytes DESC);

-- Create indexes for dir_nodes
CREATE INDEX IF NOT EXISTS idx_dir_nodes_volume_id ON dir_nodes(volume_id);
CREATE INDEX IF NOT EXISTS idx_dir_nodes_parent_dir_id ON dir_nodes(parent_dir_id);
CREATE INDEX IF NOT EXISTS idx_dir_nodes_full_path ON dir_nodes(full_path);
CREATE INDEX IF NOT EXISTS idx_dir_nodes_depth ON dir_nodes(depth);
CREATE INDEX IF NOT EXISTS idx_dir_nodes_volume_depth ON dir_nodes(volume_id, depth);
CREATE INDEX IF NOT EXISTS idx_dir_nodes_volume_parent ON dir_nodes(volume_id, parent_dir_id);
CREATE INDEX IF NOT EXISTS idx_dir_nodes_latest_size ON dir_nodes(latest_size_bytes DESC);

-- Create indexes for dir_rollups
CREATE INDEX IF NOT EXISTS idx_dir_rollups_dir_id ON dir_rollups(dir_id);
CREATE INDEX IF NOT EXISTS idx_dir_rollups_computed_at ON dir_rollups(computed_at);
CREATE INDEX IF NOT EXISTS idx_dir_rollups_dir_computed ON dir_rollups(dir_id, computed_at DESC);

-- Add updated_at triggers for file analytics tables
DO $$
BEGIN
    -- File entries
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_file_entries_updated_at') THEN
        CREATE TRIGGER update_file_entries_updated_at BEFORE UPDATE ON file_entries
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;

    -- Directory nodes
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_dir_nodes_updated_at') THEN
        CREATE TRIGGER update_dir_nodes_updated_at BEFORE UPDATE ON dir_nodes
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;