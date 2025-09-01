-- Create previews table for tracking generated preview metadata
CREATE TABLE IF NOT EXISTS previews (
    id BIGSERIAL PRIMARY KEY,
    file_id BIGINT NOT NULL REFERENCES files(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL CHECK (type IN ('thumbnail', 'poster', 'cover')),
    size VARCHAR(50) NOT NULL CHECK (size IN ('small', 'medium', 'large')),
    format VARCHAR(20) NOT NULL DEFAULT 'webp',
    width INTEGER,
    height INTEGER,
    file_size BIGINT NOT NULL,
    content_hash VARCHAR(64) NOT NULL, -- SHA256 of the preview file
    storage_path TEXT NOT NULL, -- Content-addressed storage path
    time_offset FLOAT DEFAULT 0, -- For video thumbnails
    processing_ms BIGINT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    accessed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Unique constraint to prevent duplicate previews
    UNIQUE(file_id, type, size, time_offset)
);

-- Index for fast lookups by file_id
CREATE INDEX idx_previews_file_id ON previews(file_id);

-- Index for cleanup operations (finding old previews)
CREATE INDEX idx_previews_accessed_at ON previews(accessed_at);

-- Index for content-addressed lookups
CREATE INDEX idx_previews_content_hash ON previews(content_hash);

-- Index for storage path lookups
CREATE INDEX idx_previews_storage_path ON previews(storage_path);

-- Index for preview type and size filtering
CREATE INDEX idx_previews_type_size ON previews(type, size);

-- Create preview stats table for monitoring
CREATE TABLE IF NOT EXISTS preview_stats (
    id BIGSERIAL PRIMARY KEY,
    total_generated BIGINT DEFAULT 0,
    total_size_bytes BIGINT DEFAULT 0,
    cache_hits BIGINT DEFAULT 0,
    cache_misses BIGINT DEFAULT 0,
    last_cleanup TIMESTAMP WITH TIME ZONE,
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Insert initial stats row
INSERT INTO preview_stats (total_generated, total_size_bytes, cache_hits, cache_misses)
VALUES (0, 0, 0, 0);

-- Function to update preview access time
CREATE OR REPLACE FUNCTION update_preview_access_time()
RETURNS TRIGGER AS $$
BEGIN
    NEW.accessed_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update accessed_at on any update
CREATE TRIGGER trigger_update_preview_access_time
    BEFORE UPDATE ON previews
    FOR EACH ROW
    EXECUTE FUNCTION update_preview_access_time();