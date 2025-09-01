-- Drop preview-related tables and functions

-- Drop trigger first
DROP TRIGGER IF EXISTS trigger_update_preview_access_time ON previews;

-- Drop function
DROP FUNCTION IF EXISTS update_preview_access_time();

-- Drop tables
DROP TABLE IF EXISTS preview_stats;
DROP TABLE IF EXISTS previews;