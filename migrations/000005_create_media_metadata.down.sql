-- Rollback for Media Metadata Enrichers Schema

-- Drop the view
DROP VIEW IF EXISTS enriched_files;

-- Drop the function
DROP FUNCTION IF EXISTS get_media_statistics(TEXT);

-- Drop trigger and function
DROP TRIGGER IF EXISTS trigger_update_file_enriched_columns ON file_metadata;
DROP FUNCTION IF EXISTS update_file_enriched_columns();

-- Drop indexes
DROP INDEX IF EXISTS idx_file_metadata_file_id;
DROP INDEX IF EXISTS idx_file_metadata_kind;
DROP INDEX IF EXISTS idx_file_metadata_enriched_at;
DROP INDEX IF EXISTS idx_file_metadata_file_kind;

DROP INDEX IF EXISTS idx_files_duration_ms;
DROP INDEX IF EXISTS idx_files_resolution;
DROP INDEX IF EXISTS idx_files_hdr_format;
DROP INDEX IF EXISTS idx_files_capture_datetime;
DROP INDEX IF EXISTS idx_files_gps;
DROP INDEX IF EXISTS idx_files_subtitle_language;
DROP INDEX IF EXISTS idx_files_media_type_duration;
DROP INDEX IF EXISTS idx_files_media_type_resolution;

-- Drop enriched columns from files table
ALTER TABLE files DROP COLUMN IF EXISTS duration_ms;
ALTER TABLE files DROP COLUMN IF EXISTS bitrate_kbps;
ALTER TABLE files DROP COLUMN IF EXISTS width;
ALTER TABLE files DROP COLUMN IF EXISTS height;
ALTER TABLE files DROP COLUMN IF EXISTS fps;
ALTER TABLE files DROP COLUMN IF EXISTS color_primaries;
ALTER TABLE files DROP COLUMN IF EXISTS transfer_characteristic;
ALTER TABLE files DROP COLUMN IF EXISTS hdr_format;
ALTER TABLE files DROP COLUMN IF EXISTS capture_datetime;
ALTER TABLE files DROP COLUMN IF EXISTS camera_make;
ALTER TABLE files DROP COLUMN IF EXISTS camera_model;
ALTER TABLE files DROP COLUMN IF EXISTS lens_model;
ALTER TABLE files DROP COLUMN IF EXISTS orientation;
ALTER TABLE files DROP COLUMN IF EXISTS gps_latitude;
ALTER TABLE files DROP COLUMN IF EXISTS gps_longitude;
ALTER TABLE files DROP COLUMN IF EXISTS subtitle_language;
ALTER TABLE files DROP COLUMN IF EXISTS subtitle_format;
ALTER TABLE files DROP COLUMN IF EXISTS cue_count;
ALTER TABLE files DROP COLUMN IF EXISTS coverage_percent;
ALTER TABLE files DROP COLUMN IF EXISTS audio_channels;
ALTER TABLE files DROP COLUMN IF EXISTS audio_codec;
ALTER TABLE files DROP COLUMN IF EXISTS audio_sample_rate;
ALTER TABLE files DROP COLUMN IF EXISTS video_codec;
ALTER TABLE files DROP COLUMN IF EXISTS video_profile;
ALTER TABLE files DROP COLUMN IF EXISTS video_level;

-- Drop the enum type
DROP TYPE IF EXISTS hdr_format;

-- Drop the file_metadata table
DROP TABLE IF EXISTS file_metadata;