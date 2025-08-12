-- SQLite migration for file analytics tables
-- This migration creates the tables with proper indexes and constraints

-- Create file_entries table for individual files and directories
CREATE TABLE IF NOT EXISTS file_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    volume_id TEXT NOT NULL,
    parent_dir_id INTEGER,
    name TEXT NOT NULL CHECK(length(name) <= 512),
    size_bytes INTEGER NOT NULL DEFAULT 0,
    mtime TEXT NOT NULL,  -- ISO 8601 datetime string
    ctime TEXT NOT NULL,  -- ISO 8601 datetime string
    inode INTEGER,
    uid INTEGER,
    gid INTEGER,
    type TEXT NOT NULL CHECK (type IN ('file', 'dir', 'symlink')),
    hidden INTEGER NOT NULL DEFAULT 0 CHECK (hidden IN (0, 1)),  -- SQLite boolean as integer
    path_hash BLOB NOT NULL CHECK(length(path_hash) = 16),
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

-- Create dir_nodes table for directory structure
CREATE TABLE IF NOT EXISTS dir_nodes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    volume_id TEXT NOT NULL,
    parent_dir_id INTEGER,
    name TEXT NOT NULL CHECK(length(name) <= 512),
    full_path TEXT NOT NULL CHECK(length(full_path) <= 4096),
    depth INTEGER NOT NULL DEFAULT 0,
    latest_size_bytes INTEGER NOT NULL DEFAULT 0,
    latest_file_count INTEGER NOT NULL DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

-- Create dir_rollups table for aggregated directory statistics
CREATE TABLE IF NOT EXISTS dir_rollups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    dir_id INTEGER NOT NULL,
    size_bytes INTEGER NOT NULL DEFAULT 0,
    file_count INTEGER NOT NULL DEFAULT 0,
    computed_at TEXT NOT NULL,  -- ISO 8601 datetime string
    created_at TEXT DEFAULT (datetime('now'))
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

-- Add unique constraint for upserts on file_entries
CREATE UNIQUE INDEX IF NOT EXISTS idx_file_entries_volume_path_hash_unique
    ON file_entries(volume_id, path_hash);

-- Performance optimization: Create partial indexes for common queries
-- SQLite partial index syntax
CREATE INDEX IF NOT EXISTS idx_file_entries_volume_hidden_false 
    ON file_entries(volume_id, name) 
    WHERE hidden = 0;

CREATE INDEX IF NOT EXISTS idx_dir_nodes_root_dirs 
    ON dir_nodes(volume_id, name) 
    WHERE parent_dir_id IS NULL;

-- Create triggers for updated_at columns (SQLite doesn't support PostgreSQL-style functions)
CREATE TRIGGER IF NOT EXISTS update_file_entries_updated_at
    AFTER UPDATE ON file_entries
    FOR EACH ROW
BEGIN
    UPDATE file_entries SET updated_at = datetime('now') WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_dir_nodes_updated_at
    AFTER UPDATE ON dir_nodes
    FOR EACH ROW
BEGIN
    UPDATE dir_nodes SET updated_at = datetime('now') WHERE id = NEW.id;
END;

-- Note: SQLite doesn't support foreign key constraints by default
-- They need to be enabled with PRAGMA foreign_keys = ON;
-- For compatibility, we define them but they may not be enforced
-- depending on SQLite configuration

-- Foreign key enforcement will depend on PRAGMA foreign_keys setting