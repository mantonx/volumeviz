-- Rollback Filesystem Indexer Migration

-- Drop triggers
DROP TRIGGER IF EXISTS trigger_update_folder_stats ON files;
DROP TRIGGER IF EXISTS trigger_update_folder_dir_counts ON folders;

-- Drop functions
DROP FUNCTION IF EXISTS update_folder_stats();
DROP FUNCTION IF EXISTS update_folder_dir_counts();

-- Drop indexes
DROP INDEX IF EXISTS idx_files_volume_size;
DROP INDEX IF EXISTS idx_files_mtime;
DROP INDEX IF EXISTS idx_files_name;
DROP INDEX IF EXISTS idx_files_mime;
DROP INDEX IF EXISTS idx_files_extension;
DROP INDEX IF EXISTS idx_files_size_bytes;
DROP INDEX IF EXISTS idx_files_volume_path_hash;
DROP INDEX IF EXISTS idx_files_path_hash;
DROP INDEX IF EXISTS idx_files_hash_algo_hash;
DROP INDEX IF EXISTS idx_files_volume_media_kind;
DROP INDEX IF EXISTS idx_files_media_kind;
DROP INDEX IF EXISTS idx_files_volume_folder;
DROP INDEX IF EXISTS idx_files_folder_id;
DROP INDEX IF EXISTS idx_files_volume_id;
DROP INDEX IF EXISTS idx_files_volume_path_unique;

DROP INDEX IF EXISTS idx_folders_volume_depth;
DROP INDEX IF EXISTS idx_folders_name;
DROP INDEX IF EXISTS idx_folders_file_count;
DROP INDEX IF EXISTS idx_folders_size_recursive;
DROP INDEX IF EXISTS idx_folders_depth;
DROP INDEX IF EXISTS idx_folders_volume_path_hash;
DROP INDEX IF EXISTS idx_folders_path_hash;
DROP INDEX IF EXISTS idx_folders_volume_parent;
DROP INDEX IF EXISTS idx_folders_parent_id;
DROP INDEX IF EXISTS idx_folders_volume_id;
DROP INDEX IF EXISTS idx_folders_volume_path_unique;

-- Drop tables
DROP TABLE IF EXISTS files;
DROP TABLE IF EXISTS folders;

-- Recreate original simplified tables for backwards compatibility
CREATE TABLE IF NOT EXISTS file_entries (
    id BIGSERIAL PRIMARY KEY,
    volume_id TEXT NOT NULL,
    parent_dir_id BIGINT,
    name TEXT NOT NULL,
    size_bytes BIGINT NOT NULL DEFAULT 0,
    mtime TIMESTAMP NOT NULL,
    ctime TIMESTAMP NOT NULL,
    inode BIGINT,
    uid INTEGER,
    gid INTEGER,
    type TEXT NOT NULL,
    hidden BOOLEAN NOT NULL DEFAULT false,
    path_hash BYTEA NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS dir_nodes (
    id BIGSERIAL PRIMARY KEY,
    volume_id TEXT NOT NULL,
    parent_dir_id BIGINT,
    name TEXT NOT NULL,
    full_path TEXT NOT NULL,
    depth INTEGER NOT NULL DEFAULT 0,
    latest_size_bytes BIGINT NOT NULL DEFAULT 0,
    latest_file_count BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS dir_rollups (
    id BIGSERIAL PRIMARY KEY,
    dir_id BIGINT NOT NULL,
    size_bytes BIGINT NOT NULL DEFAULT 0,
    file_count BIGINT NOT NULL DEFAULT 0,
    computed_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Restore basic indexes
CREATE INDEX IF NOT EXISTS idx_file_entries_volume_id ON file_entries(volume_id);
CREATE INDEX IF NOT EXISTS idx_file_entries_parent_dir_id ON file_entries(parent_dir_id);
CREATE INDEX IF NOT EXISTS idx_file_entries_path_hash ON file_entries(path_hash);
CREATE UNIQUE INDEX IF NOT EXISTS idx_file_entries_volume_path_hash_unique ON file_entries(volume_id, path_hash);

CREATE INDEX IF NOT EXISTS idx_dir_nodes_volume_id ON dir_nodes(volume_id);
CREATE INDEX IF NOT EXISTS idx_dir_nodes_parent_dir_id ON dir_nodes(parent_dir_id);
CREATE INDEX IF NOT EXISTS idx_dir_nodes_full_path ON dir_nodes(full_path);
CREATE UNIQUE INDEX IF NOT EXISTS idx_dir_nodes_volume_path ON dir_nodes(volume_id, full_path);

CREATE INDEX IF NOT EXISTS idx_dir_rollups_dir_id ON dir_rollups(dir_id);