-- Search Performance Indexes
-- Adds indexes for fast search queries across files table

-- Text search indexes
CREATE INDEX IF NOT EXISTS idx_files_name_search ON files USING gin(to_tsvector('english', name));
CREATE INDEX IF NOT EXISTS idx_files_path_search ON files USING gin(to_tsvector('english', path));

-- Trigram indexes for fuzzy matching (if pg_trgm extension available)
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS idx_files_name_trgm ON files USING gin(name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_files_path_trgm ON files USING gin(path gin_trgm_ops);

-- Media kind and MIME type indexes
CREATE INDEX IF NOT EXISTS idx_files_media_kind ON files(media_kind) WHERE media_kind IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_files_mime_type ON files(mime) WHERE mime IS NOT NULL;

-- Size range queries
CREATE INDEX IF NOT EXISTS idx_files_size_bytes ON files(size_bytes);

-- Time range queries
CREATE INDEX IF NOT EXISTS idx_files_mtime ON files(mtime) WHERE mtime IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_files_ctime ON files(ctime) WHERE ctime IS NOT NULL;

-- Media metadata search indexes
CREATE INDEX IF NOT EXISTS idx_files_duration ON files(duration_ms) WHERE duration_ms IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_files_dimensions ON files(width, height) WHERE width IS NOT NULL AND height IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_files_width ON files(width) WHERE width IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_files_height ON files(height) WHERE height IS NOT NULL;

-- GPS and location indexes
CREATE INDEX IF NOT EXISTS idx_files_gps_coords ON files(gps_latitude, gps_longitude) WHERE gps_latitude IS NOT NULL AND gps_longitude IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_files_has_gps ON files((gps_latitude IS NOT NULL AND gps_longitude IS NOT NULL));

-- Camera and capture metadata
CREATE INDEX IF NOT EXISTS idx_files_camera_model ON files(camera_model) WHERE camera_model IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_files_capture_datetime ON files(capture_datetime) WHERE capture_datetime IS NOT NULL;

-- Subtitle and hash indexes
CREATE INDEX IF NOT EXISTS idx_files_has_subtitles ON files((subtitle_language IS NOT NULL));
CREATE INDEX IF NOT EXISTS idx_files_has_hash ON files((hash IS NOT NULL));

-- Video and audio codec indexes
CREATE INDEX IF NOT EXISTS idx_files_video_codec ON files(video_codec) WHERE video_codec IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_files_audio_codec ON files(audio_codec) WHERE audio_codec IS NOT NULL;

-- Combined indexes for common queries
CREATE INDEX IF NOT EXISTS idx_files_media_size ON files(media_kind, size_bytes) WHERE media_kind IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_files_media_duration ON files(media_kind, duration_ms) WHERE media_kind IS NOT NULL AND duration_ms IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_files_media_dimensions ON files(media_kind, width, height) WHERE media_kind IS NOT NULL AND width IS NOT NULL AND height IS NOT NULL;

-- Volume-specific search index
CREATE INDEX IF NOT EXISTS idx_files_volume_search ON files(volume_id, media_kind, size_bytes, mtime);

-- Extension-based search
CREATE INDEX IF NOT EXISTS idx_files_extension_lower ON files(LOWER(extension)) WHERE extension IS NOT NULL;

-- Path prefix matching
CREATE INDEX IF NOT EXISTS idx_files_path_prefix ON files(path text_pattern_ops);

-- Compound index for filtered searches
CREATE INDEX IF NOT EXISTS idx_files_complex_search ON files(volume_id, media_kind, size_bytes, mtime, width, height) 
WHERE media_kind IS NOT NULL;

-- Partial indexes for specific media types
CREATE INDEX IF NOT EXISTS idx_files_video_search ON files(volume_id, duration_ms, width, height, video_codec) 
WHERE media_kind = 'video';

CREATE INDEX IF NOT EXISTS idx_files_audio_search ON files(volume_id, duration_ms, audio_codec, audio_channels) 
WHERE media_kind = 'audio';

CREATE INDEX IF NOT EXISTS idx_files_image_search ON files(volume_id, width, height, camera_model, capture_datetime) 
WHERE media_kind = 'image';