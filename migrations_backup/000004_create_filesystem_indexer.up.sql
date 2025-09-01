-- Filesystem Indexer Migration
-- Enhanced folder tree and file records with rich universal metadata

-- Drop existing tables to recreate with enhanced schema
DROP TABLE IF EXISTS dir_rollups;
DROP TABLE IF EXISTS file_entries;
DROP TABLE IF EXISTS dir_nodes;

-- Enhanced folders table with rich metadata
CREATE TABLE IF NOT EXISTS folders (
    id BIGSERIAL PRIMARY KEY,
    parent_id BIGINT REFERENCES folders(id) ON DELETE CASCADE,
    volume_id TEXT NOT NULL,
    name TEXT NOT NULL,
    path TEXT NOT NULL,
    path_hash BYTEA NOT NULL,
    size_bytes_recursive BIGINT NOT NULL DEFAULT 0,
    disk_usage_bytes_recursive BIGINT NOT NULL DEFAULT 0,
    file_count BIGINT NOT NULL DEFAULT 0,
    dir_count BIGINT NOT NULL DEFAULT 0,
    depth INTEGER NOT NULL DEFAULT 0,
    mtime TIMESTAMP,
    ctime TIMESTAMP,
    uid INTEGER,
    gid INTEGER,
    mode INTEGER,
    is_symlink BOOLEAN DEFAULT false,
    symlink_target TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (volume_id) REFERENCES volumes(volume_id) ON DELETE CASCADE
);

-- Enhanced files table with rich metadata
CREATE TABLE IF NOT EXISTS files (
    id BIGSERIAL PRIMARY KEY,
    folder_id BIGINT NOT NULL REFERENCES folders(id) ON DELETE CASCADE,
    volume_id TEXT NOT NULL,
    name TEXT NOT NULL,
    path TEXT NOT NULL,
    extension TEXT,
    size_bytes BIGINT NOT NULL DEFAULT 0,
    disk_usage_bytes BIGINT NOT NULL DEFAULT 0,
    mtime TIMESTAMP,
    ctime TIMESTAMP,
    birthtime TIMESTAMP,
    uid INTEGER,
    gid INTEGER,
    mode INTEGER,
    inode BIGINT,
    device TEXT,
    is_symlink BOOLEAN DEFAULT false,
    symlink_target TEXT,
    mime TEXT,
    media_kind TEXT,
    encoding TEXT,
    hash_algo TEXT,
    hash BYTEA,
    path_hash BYTEA NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (volume_id) REFERENCES volumes(volume_id) ON DELETE CASCADE
);

-- Create indexes for folders table
CREATE INDEX IF NOT EXISTS idx_folders_volume_id ON folders(volume_id);
CREATE INDEX IF NOT EXISTS idx_folders_parent_id ON folders(parent_id);
CREATE INDEX IF NOT EXISTS idx_folders_volume_parent ON folders(volume_id, parent_id);
CREATE INDEX IF NOT EXISTS idx_folders_path_hash ON folders(path_hash);
CREATE INDEX IF NOT EXISTS idx_folders_volume_path_hash ON folders(volume_id, path_hash);
CREATE INDEX IF NOT EXISTS idx_folders_depth ON folders(depth);
CREATE INDEX IF NOT EXISTS idx_folders_size_recursive ON folders(size_bytes_recursive DESC);
CREATE INDEX IF NOT EXISTS idx_folders_file_count ON folders(file_count DESC);
CREATE INDEX IF NOT EXISTS idx_folders_name ON folders(name);
CREATE INDEX IF NOT EXISTS idx_folders_volume_depth ON folders(volume_id, depth);

-- Create unique constraint for folders
CREATE UNIQUE INDEX IF NOT EXISTS idx_folders_volume_path_unique ON folders(volume_id, path_hash);

-- Create indexes for files table
CREATE INDEX IF NOT EXISTS idx_files_volume_id ON files(volume_id);
CREATE INDEX IF NOT EXISTS idx_files_folder_id ON files(folder_id);
CREATE INDEX IF NOT EXISTS idx_files_volume_folder ON files(volume_id, folder_id);
CREATE INDEX IF NOT EXISTS idx_files_media_kind ON files(media_kind);
CREATE INDEX IF NOT EXISTS idx_files_volume_media_kind ON files(volume_id, folder_id, media_kind);
CREATE INDEX IF NOT EXISTS idx_files_hash_algo_hash ON files(hash_algo, hash);
CREATE INDEX IF NOT EXISTS idx_files_path_hash ON files(path_hash);
CREATE INDEX IF NOT EXISTS idx_files_volume_path_hash ON files(volume_id, path_hash);
CREATE INDEX IF NOT EXISTS idx_files_size_bytes ON files(size_bytes DESC);
CREATE INDEX IF NOT EXISTS idx_files_extension ON files(extension);
CREATE INDEX IF NOT EXISTS idx_files_mime ON files(mime);
CREATE INDEX IF NOT EXISTS idx_files_name ON files(name);
CREATE INDEX IF NOT EXISTS idx_files_volume_size ON files(volume_id, size_bytes DESC);
CREATE INDEX IF NOT EXISTS idx_files_mtime ON files(mtime);

-- Create unique constraint for files
CREATE UNIQUE INDEX IF NOT EXISTS idx_files_volume_path_unique ON files(volume_id, path_hash);

-- Add triggers to maintain folder statistics
CREATE OR REPLACE FUNCTION update_folder_stats() RETURNS TRIGGER AS $$
BEGIN
    -- Update parent folder statistics when files change
    IF TG_OP = 'INSERT' THEN
        UPDATE folders 
        SET 
            file_count = file_count + 1,
            size_bytes_recursive = size_bytes_recursive + NEW.size_bytes,
            disk_usage_bytes_recursive = disk_usage_bytes_recursive + NEW.disk_usage_bytes,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = NEW.folder_id;
        
        -- Recursively update parent folders
        WITH RECURSIVE parent_folders AS (
            SELECT parent_id FROM folders WHERE id = NEW.folder_id AND parent_id IS NOT NULL
            UNION ALL
            SELECT f.parent_id FROM folders f 
            INNER JOIN parent_folders pf ON f.id = pf.parent_id
            WHERE f.parent_id IS NOT NULL
        )
        UPDATE folders 
        SET 
            size_bytes_recursive = size_bytes_recursive + NEW.size_bytes,
            disk_usage_bytes_recursive = disk_usage_bytes_recursive + NEW.disk_usage_bytes,
            updated_at = CURRENT_TIMESTAMP
        WHERE id IN (SELECT parent_id FROM parent_folders);
        
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE folders 
        SET 
            file_count = file_count - 1,
            size_bytes_recursive = size_bytes_recursive - OLD.size_bytes,
            disk_usage_bytes_recursive = disk_usage_bytes_recursive - OLD.disk_usage_bytes,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = OLD.folder_id;
        
        -- Recursively update parent folders
        WITH RECURSIVE parent_folders AS (
            SELECT parent_id FROM folders WHERE id = OLD.folder_id AND parent_id IS NOT NULL
            UNION ALL
            SELECT f.parent_id FROM folders f 
            INNER JOIN parent_folders pf ON f.id = pf.parent_id
            WHERE f.parent_id IS NOT NULL
        )
        UPDATE folders 
        SET 
            size_bytes_recursive = size_bytes_recursive - OLD.size_bytes,
            disk_usage_bytes_recursive = disk_usage_bytes_recursive - OLD.disk_usage_bytes,
            updated_at = CURRENT_TIMESTAMP
        WHERE id IN (SELECT parent_id FROM parent_folders);
        
        RETURN OLD;
    ELSIF TG_OP = 'UPDATE' THEN
        UPDATE folders 
        SET 
            size_bytes_recursive = size_bytes_recursive - OLD.size_bytes + NEW.size_bytes,
            disk_usage_bytes_recursive = disk_usage_bytes_recursive - OLD.disk_usage_bytes + NEW.disk_usage_bytes,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = NEW.folder_id;
        
        -- Recursively update parent folders
        WITH RECURSIVE parent_folders AS (
            SELECT parent_id FROM folders WHERE id = NEW.folder_id AND parent_id IS NOT NULL
            UNION ALL
            SELECT f.parent_id FROM folders f 
            INNER JOIN parent_folders pf ON f.id = pf.parent_id
            WHERE f.parent_id IS NOT NULL
        )
        UPDATE folders 
        SET 
            size_bytes_recursive = size_bytes_recursive - OLD.size_bytes + NEW.size_bytes,
            disk_usage_bytes_recursive = disk_usage_bytes_recursive - OLD.disk_usage_bytes + NEW.disk_usage_bytes,
            updated_at = CURRENT_TIMESTAMP
        WHERE id IN (SELECT parent_id FROM parent_folders);
        
        RETURN NEW;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for maintaining folder statistics
CREATE TRIGGER trigger_update_folder_stats
    AFTER INSERT OR UPDATE OR DELETE ON files
    FOR EACH ROW EXECUTE FUNCTION update_folder_stats();

-- Add function to update folder directory counts
CREATE OR REPLACE FUNCTION update_folder_dir_counts() RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        -- Update parent folder dir count
        IF NEW.parent_id IS NOT NULL THEN
            UPDATE folders 
            SET 
                dir_count = dir_count + 1,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = NEW.parent_id;
        END IF;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        -- Update parent folder dir count
        IF OLD.parent_id IS NOT NULL THEN
            UPDATE folders 
            SET 
                dir_count = dir_count - 1,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = OLD.parent_id;
        END IF;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for maintaining folder directory counts
CREATE TRIGGER trigger_update_folder_dir_counts
    AFTER INSERT OR DELETE ON folders
    FOR EACH ROW EXECUTE FUNCTION update_folder_dir_counts();