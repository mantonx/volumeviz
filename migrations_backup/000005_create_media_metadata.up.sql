-- Media Metadata Enrichers Schema
-- Adds file_metadata table and enriched columns on files table

-- Create file_metadata table for detailed metadata
CREATE TABLE IF NOT EXISTS file_metadata (
    id BIGSERIAL PRIMARY KEY,
    file_id BIGINT NOT NULL,
    kind TEXT NOT NULL, -- 'audio', 'video', 'image', 'subtitle'
    data_json JSONB NOT NULL,
    enriched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_file_metadata_file_id ON file_metadata(file_id);
CREATE INDEX IF NOT EXISTS idx_file_metadata_kind ON file_metadata(kind);
CREATE INDEX IF NOT EXISTS idx_file_metadata_enriched_at ON file_metadata(enriched_at);
CREATE INDEX IF NOT EXISTS idx_file_metadata_file_kind ON file_metadata(file_id, kind);

-- Add enriched columns to files table for fast queries
-- These are flattened from the detailed JSONB data for performance

-- Audio/Video metadata
ALTER TABLE files ADD COLUMN IF NOT EXISTS duration_ms BIGINT;
ALTER TABLE files ADD COLUMN IF NOT EXISTS bitrate_kbps INTEGER;
ALTER TABLE files ADD COLUMN IF NOT EXISTS width INTEGER;
ALTER TABLE files ADD COLUMN IF NOT EXISTS height INTEGER;
ALTER TABLE files ADD COLUMN IF NOT EXISTS fps DECIMAL(8,3);
ALTER TABLE files ADD COLUMN IF NOT EXISTS color_primaries TEXT;
ALTER TABLE files ADD COLUMN IF NOT EXISTS transfer_characteristic TEXT;

-- HDR format enumeration
DO $$ BEGIN
    CREATE TYPE hdr_format AS ENUM ('none', 'hdr10', 'hdr10+', 'dovi');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

ALTER TABLE files ADD COLUMN IF NOT EXISTS hdr_format hdr_format DEFAULT 'none';

-- Image metadata
ALTER TABLE files ADD COLUMN IF NOT EXISTS capture_datetime TIMESTAMPTZ;
ALTER TABLE files ADD COLUMN IF NOT EXISTS camera_make TEXT;
ALTER TABLE files ADD COLUMN IF NOT EXISTS camera_model TEXT;
ALTER TABLE files ADD COLUMN IF NOT EXISTS lens_model TEXT;
ALTER TABLE files ADD COLUMN IF NOT EXISTS orientation INTEGER;
ALTER TABLE files ADD COLUMN IF NOT EXISTS gps_latitude DECIMAL(10,8);
ALTER TABLE files ADD COLUMN IF NOT EXISTS gps_longitude DECIMAL(11,8);

-- Subtitle metadata
ALTER TABLE files ADD COLUMN IF NOT EXISTS subtitle_language TEXT;
ALTER TABLE files ADD COLUMN IF NOT EXISTS subtitle_format TEXT;
ALTER TABLE files ADD COLUMN IF NOT EXISTS cue_count INTEGER;
ALTER TABLE files ADD COLUMN IF NOT EXISTS coverage_percent DECIMAL(5,2);

-- Audio specific metadata
ALTER TABLE files ADD COLUMN IF NOT EXISTS audio_channels INTEGER;
ALTER TABLE files ADD COLUMN IF NOT EXISTS audio_codec TEXT;
ALTER TABLE files ADD COLUMN IF NOT EXISTS audio_sample_rate INTEGER;

-- Video specific metadata
ALTER TABLE files ADD COLUMN IF NOT EXISTS video_codec TEXT;
ALTER TABLE files ADD COLUMN IF NOT EXISTS video_profile TEXT;
ALTER TABLE files ADD COLUMN IF NOT EXISTS video_level TEXT;

-- Create indexes on commonly queried enriched fields
CREATE INDEX IF NOT EXISTS idx_files_duration_ms ON files(duration_ms) WHERE duration_ms IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_files_resolution ON files(width, height) WHERE width IS NOT NULL AND height IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_files_hdr_format ON files(hdr_format) WHERE hdr_format != 'none';
CREATE INDEX IF NOT EXISTS idx_files_capture_datetime ON files(capture_datetime) WHERE capture_datetime IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_files_gps ON files(gps_latitude, gps_longitude) WHERE gps_latitude IS NOT NULL AND gps_longitude IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_files_subtitle_language ON files(subtitle_language) WHERE subtitle_language IS NOT NULL;

-- Create composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_files_media_type_duration ON files(mime, duration_ms) WHERE duration_ms IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_files_media_type_resolution ON files(mime, width, height) WHERE width IS NOT NULL AND height IS NOT NULL;

-- Function to automatically update file metadata when file_metadata is inserted/updated
CREATE OR REPLACE FUNCTION update_file_enriched_columns() RETURNS TRIGGER AS $
BEGIN
    -- Update files table with flattened metadata based on kind
    IF NEW.kind = 'video' OR NEW.kind = 'audio' THEN
        UPDATE files SET
            duration_ms = COALESCE((NEW.data_json->>'duration_ms')::BIGINT, duration_ms),
            bitrate_kbps = COALESCE((NEW.data_json->>'bitrate_kbps')::INTEGER, bitrate_kbps),
            width = COALESCE((NEW.data_json->>'width')::INTEGER, width),
            height = COALESCE((NEW.data_json->>'height')::INTEGER, height),
            fps = COALESCE((NEW.data_json->>'fps')::DECIMAL, fps),
            color_primaries = COALESCE(NEW.data_json->>'color_primaries', color_primaries),
            transfer_characteristic = COALESCE(NEW.data_json->>'transfer_characteristic', transfer_characteristic),
            hdr_format = COALESCE((NEW.data_json->>'hdr_format')::hdr_format, hdr_format),
            audio_channels = COALESCE((NEW.data_json->>'audio_channels')::INTEGER, audio_channels),
            audio_codec = COALESCE(NEW.data_json->>'audio_codec', audio_codec),
            audio_sample_rate = COALESCE((NEW.data_json->>'audio_sample_rate')::INTEGER, audio_sample_rate),
            video_codec = COALESCE(NEW.data_json->>'video_codec', video_codec),
            video_profile = COALESCE(NEW.data_json->>'video_profile', video_profile),
            video_level = COALESCE(NEW.data_json->>'video_level', video_level)
        WHERE id = NEW.file_id;
    END IF;
    
    IF NEW.kind = 'image' THEN
        UPDATE files SET
            width = COALESCE((NEW.data_json->>'width')::INTEGER, width),
            height = COALESCE((NEW.data_json->>'height')::INTEGER, height),
            capture_datetime = COALESCE((NEW.data_json->>'capture_datetime')::TIMESTAMPTZ, capture_datetime),
            camera_make = COALESCE(NEW.data_json->>'camera_make', camera_make),
            camera_model = COALESCE(NEW.data_json->>'camera_model', camera_model),
            lens_model = COALESCE(NEW.data_json->>'lens_model', lens_model),
            orientation = COALESCE((NEW.data_json->>'orientation')::INTEGER, orientation),
            gps_latitude = COALESCE((NEW.data_json->>'gps_latitude')::DECIMAL, gps_latitude),
            gps_longitude = COALESCE((NEW.data_json->>'gps_longitude')::DECIMAL, gps_longitude)
        WHERE id = NEW.file_id;
    END IF;
    
    IF NEW.kind = 'subtitle' THEN
        UPDATE files SET
            subtitle_language = COALESCE(NEW.data_json->>'language', subtitle_language),
            subtitle_format = COALESCE(NEW.data_json->>'format', subtitle_format),
            cue_count = COALESCE((NEW.data_json->>'cue_count')::INTEGER, cue_count),
            coverage_percent = COALESCE((NEW.data_json->>'coverage_percent')::DECIMAL, coverage_percent)
        WHERE id = NEW.file_id;
    END IF;
    
    RETURN NEW;
END;
$ LANGUAGE plpgsql;

-- Create trigger to automatically update enriched columns
DROP TRIGGER IF EXISTS trigger_update_file_enriched_columns ON file_metadata;
CREATE TRIGGER trigger_update_file_enriched_columns
    AFTER INSERT OR UPDATE ON file_metadata
    FOR EACH ROW
    EXECUTE FUNCTION update_file_enriched_columns();

-- Create view for easy querying of enriched files
CREATE OR REPLACE VIEW enriched_files AS
SELECT 
    f.*,
    CASE 
        WHEN f.duration_ms IS NOT NULL THEN 'video/audio'
        WHEN f.capture_datetime IS NOT NULL THEN 'image'
        WHEN f.subtitle_language IS NOT NULL THEN 'subtitle'
        ELSE 'unenriched'
    END as enrichment_status,
    CASE 
        WHEN f.width IS NOT NULL AND f.height IS NOT NULL THEN 
            f.width || 'x' || f.height 
        ELSE NULL 
    END as resolution,
    CASE 
        WHEN f.duration_ms IS NOT NULL THEN 
            EXTRACT(EPOCH FROM INTERVAL '1 millisecond' * f.duration_ms)::INTEGER 
        ELSE NULL 
    END as duration_seconds,
    CASE 
        WHEN f.gps_latitude IS NOT NULL AND f.gps_longitude IS NOT NULL THEN 
            ST_Point(f.gps_longitude, f.gps_latitude)
        ELSE NULL 
    END as gps_location
FROM files f;

-- Create function to get media statistics
CREATE OR REPLACE FUNCTION get_media_statistics(volume_id_param TEXT DEFAULT NULL)
RETURNS TABLE (
    total_files BIGINT,
    enriched_files BIGINT,
    video_files BIGINT,
    audio_files BIGINT,
    image_files BIGINT,
    subtitle_files BIGINT,
    total_duration_hours DECIMAL,
    total_resolution_pixels BIGINT,
    hdr_files BIGINT,
    gps_enabled_files BIGINT
) AS $
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*) as total_files,
        COUNT(*) FILTER (WHERE 
            duration_ms IS NOT NULL OR 
            capture_datetime IS NOT NULL OR 
            subtitle_language IS NOT NULL
        ) as enriched_files,
        COUNT(*) FILTER (WHERE mime LIKE 'video/%') as video_files,
        COUNT(*) FILTER (WHERE mime LIKE 'audio/%') as audio_files,
        COUNT(*) FILTER (WHERE mime LIKE 'image/%') as image_files,
        COUNT(*) FILTER (WHERE subtitle_language IS NOT NULL) as subtitle_files,
        ROUND(SUM(duration_ms) / 1000.0 / 3600.0, 2) as total_duration_hours,
        SUM(COALESCE(width, 0) * COALESCE(height, 0)) as total_resolution_pixels,
        COUNT(*) FILTER (WHERE hdr_format != 'none') as hdr_files,
        COUNT(*) FILTER (WHERE gps_latitude IS NOT NULL AND gps_longitude IS NOT NULL) as gps_enabled_files
    FROM files f
    WHERE volume_id_param IS NULL OR f.volume_id = volume_id_param;
END;
$ LANGUAGE plpgsql;