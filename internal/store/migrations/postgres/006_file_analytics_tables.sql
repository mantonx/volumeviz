-- Migration: 006_file_analytics_tables
-- Description: Add file_entries, dir_nodes, and dir_rollups tables for file/directory analytics
-- Up Migration (PostgreSQL)

-- Create file_entries table for individual files and directories
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
    type VARCHAR(10) NOT NULL CHECK (type IN ('file', 'dir', 'symlink')),
    hidden BOOLEAN NOT NULL DEFAULT FALSE,
    path_hash BYTEA NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create dir_nodes table for directory structure
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

-- Create dir_rollups table for aggregated directory statistics
CREATE TABLE IF NOT EXISTS dir_rollups (
    id BIGSERIAL PRIMARY KEY,
    dir_id BIGINT NOT NULL,
    size_bytes BIGINT NOT NULL DEFAULT 0,
    file_count BIGINT NOT NULL DEFAULT 0,
    computed_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for file_entries as specified in requirements
-- Primary composite index on volume_id and parent_dir_id
CREATE INDEX IF NOT EXISTS idx_file_entries_volume_parent 
    ON file_entries(volume_id, parent_dir_id);

-- Path hash index for avoiding long-path index bloat
CREATE INDEX IF NOT EXISTS idx_file_entries_volume_path_hash 
    ON file_entries(volume_id, path_hash);

-- Additional performance indexes
CREATE INDEX IF NOT EXISTS idx_file_entries_type 
    ON file_entries(type);
    
CREATE INDEX IF NOT EXISTS idx_file_entries_size 
    ON file_entries(size_bytes DESC);

-- Create indexes for dir_nodes as specified in requirements  
-- Primary composite index on volume_id and parent_dir_id
CREATE INDEX IF NOT EXISTS idx_dir_nodes_volume_parent 
    ON dir_nodes(volume_id, parent_dir_id);

-- Unique constraint on volume_id and full_path as required
CREATE UNIQUE INDEX IF NOT EXISTS idx_dir_nodes_volume_path 
    ON dir_nodes(volume_id, full_path);

-- Additional performance indexes
CREATE INDEX IF NOT EXISTS idx_dir_nodes_depth 
    ON dir_nodes(depth);
    
CREATE INDEX IF NOT EXISTS idx_dir_nodes_size 
    ON dir_nodes(latest_size_bytes DESC);

-- Create indexes for dir_rollups as specified in requirements
-- Primary composite index on dir_id and computed_at desc for time-series queries
CREATE INDEX IF NOT EXISTS idx_dir_rollups_dir_computed 
    ON dir_rollups(dir_id, computed_at DESC);

-- Additional performance indexes
CREATE INDEX IF NOT EXISTS idx_dir_rollups_computed_at 
    ON dir_rollups(computed_at DESC);

-- Add foreign key constraints
ALTER TABLE file_entries 
    ADD CONSTRAINT fk_file_entries_parent_dir 
    FOREIGN KEY (parent_dir_id) REFERENCES dir_nodes(id) ON DELETE CASCADE;

ALTER TABLE dir_nodes 
    ADD CONSTRAINT fk_dir_nodes_parent_dir 
    FOREIGN KEY (parent_dir_id) REFERENCES dir_nodes(id) ON DELETE CASCADE;

ALTER TABLE dir_rollups 
    ADD CONSTRAINT fk_dir_rollups_dir 
    FOREIGN KEY (dir_id) REFERENCES dir_nodes(id) ON DELETE CASCADE;

-- Add update triggers for updated_at columns
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_file_entries_updated_at 
    BEFORE UPDATE ON file_entries 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_dir_nodes_updated_at 
    BEFORE UPDATE ON dir_nodes 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Performance optimization: Create partial indexes for common queries
CREATE INDEX IF NOT EXISTS idx_file_entries_volume_hidden_false 
    ON file_entries(volume_id, name) 
    WHERE hidden = FALSE;

CREATE INDEX IF NOT EXISTS idx_dir_nodes_root_dirs 
    ON dir_nodes(volume_id, name) 
    WHERE parent_dir_id IS NULL;

-- Add table comments for documentation
COMMENT ON TABLE file_entries IS 'Individual files and directories with detailed metadata for fast filesystem queries';
COMMENT ON TABLE dir_nodes IS 'Directory structure with hierarchical relationships and latest size calculations';
COMMENT ON TABLE dir_rollups IS 'Time-series aggregated directory statistics for historical analysis';

COMMENT ON COLUMN file_entries.path_hash IS 'xxhash of full path to avoid long-path index bloat';
COMMENT ON COLUMN dir_nodes.full_path IS 'Complete path from volume root, must be unique within volume';
COMMENT ON COLUMN dir_rollups.computed_at IS 'When this rollup was calculated, indexed for time-series queries';