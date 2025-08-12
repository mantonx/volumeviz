-- File Analytics Schema Migration
-- Creates tables for file system analysis and analytics

-- File entries table
CREATE TABLE IF NOT EXISTS file_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    volume_id TEXT NOT NULL,
    parent_dir_id INTEGER,
    name TEXT NOT NULL,
    size_bytes INTEGER NOT NULL DEFAULT 0,
    mtime TEXT NOT NULL,
    ctime TEXT NOT NULL,
    inode INTEGER,
    uid INTEGER,
    gid INTEGER,
    type TEXT NOT NULL,
    hidden INTEGER NOT NULL DEFAULT 0,
    path_hash BLOB NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

-- Directory nodes table
CREATE TABLE IF NOT EXISTS dir_nodes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    volume_id TEXT NOT NULL,
    parent_dir_id INTEGER,
    name TEXT NOT NULL,
    full_path TEXT NOT NULL,
    depth INTEGER NOT NULL DEFAULT 0,
    latest_size_bytes INTEGER NOT NULL DEFAULT 0,
    latest_file_count INTEGER NOT NULL DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

-- Directory rollups table
CREATE TABLE IF NOT EXISTS dir_rollups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    dir_id INTEGER NOT NULL,
    size_bytes INTEGER NOT NULL DEFAULT 0,
    file_count INTEGER NOT NULL DEFAULT 0,
    computed_at TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
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

-- Create unique constraint for file entries
CREATE UNIQUE INDEX IF NOT EXISTS idx_file_entries_volume_path_hash_unique ON file_entries(volume_id, path_hash);

-- Create indexes for dir_nodes
CREATE INDEX IF NOT EXISTS idx_dir_nodes_volume_id ON dir_nodes(volume_id);
CREATE INDEX IF NOT EXISTS idx_dir_nodes_parent_dir_id ON dir_nodes(parent_dir_id);
CREATE INDEX IF NOT EXISTS idx_dir_nodes_full_path ON dir_nodes(full_path);
CREATE INDEX IF NOT EXISTS idx_dir_nodes_depth ON dir_nodes(depth);
CREATE INDEX IF NOT EXISTS idx_dir_nodes_volume_depth ON dir_nodes(volume_id, depth);
CREATE INDEX IF NOT EXISTS idx_dir_nodes_volume_parent ON dir_nodes(volume_id, parent_dir_id);
CREATE INDEX IF NOT EXISTS idx_dir_nodes_latest_size ON dir_nodes(latest_size_bytes DESC);

-- Create unique constraint for dir nodes
CREATE UNIQUE INDEX IF NOT EXISTS idx_dir_nodes_volume_path ON dir_nodes(volume_id, full_path);

-- Create indexes for dir_rollups
CREATE INDEX IF NOT EXISTS idx_dir_rollups_dir_id ON dir_rollups(dir_id);
CREATE INDEX IF NOT EXISTS idx_dir_rollups_computed_at ON dir_rollups(computed_at);
CREATE INDEX IF NOT EXISTS idx_dir_rollups_dir_computed ON dir_rollups(dir_id, computed_at DESC);