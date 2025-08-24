-- Performance Index Testing Script
-- Demonstrates the effectiveness of the new scan performance indexes

-- =======================================
-- Test Setup: Create Sample Data
-- =======================================

-- Insert a test volume
INSERT INTO volumes (volume_id, name, driver, mountpoint) 
VALUES ('test-performance-vol', 'Performance Test Volume', 'local', '/test/path')
ON CONFLICT (volume_id) DO NOTHING;

-- Create a test folder
INSERT INTO folders (volume_id, name, path, path_hash, depth) 
VALUES ('test-performance-vol', 'test-folder', '/test/folder', '\x1234', 0)
ON CONFLICT (volume_id, path_hash) DO NOTHING;

-- Get the folder ID for file insertion
DO $$
DECLARE
    test_folder_id BIGINT;
BEGIN
    SELECT id INTO test_folder_id FROM folders WHERE volume_id = 'test-performance-vol' LIMIT 1;
    
    -- Insert test files that need enrichment (if not already present)
    IF NOT EXISTS (SELECT 1 FROM files WHERE volume_id = 'test-performance-vol' LIMIT 1) THEN
        -- Video files needing enrichment
        FOR i IN 1..100 LOOP
            INSERT INTO files (folder_id, volume_id, name, path, path_hash, mime, size_bytes)
            VALUES (
                test_folder_id,
                'test-performance-vol',
                'video' || i || '.mp4',
                '/test/folder/video' || i || '.mp4',
                ('\x' || lpad(to_hex(i), 8, '0'))::bytea,
                'video/mp4',
                i * 1024 * 1024
            );
        END LOOP;
        
        -- Audio files needing enrichment
        FOR i IN 1..50 LOOP
            INSERT INTO files (folder_id, volume_id, name, path, path_hash, mime, size_bytes)
            VALUES (
                test_folder_id,
                'test-performance-vol',
                'audio' || i || '.mp3',
                '/test/folder/audio' || i || '.mp3',
                ('\x' || lpad(to_hex(i + 1000), 8, '0'))::bytea,
                'audio/mpeg',
                i * 1024 * 512
            );
        END LOOP;
        
        -- Image files needing enrichment
        FOR i IN 1..30 LOOP
            INSERT INTO files (folder_id, volume_id, name, path, path_hash, mime, size_bytes)
            VALUES (
                test_folder_id,
                'test-performance-vol',
                'image' || i || '.jpg',
                '/test/folder/image' || i || '.jpg',
                ('\x' || lpad(to_hex(i + 2000), 8, '0'))::bytea,
                'image/jpeg',
                i * 1024 * 256
            );
        END LOOP;
        
        RAISE NOTICE 'Created 180 test files for performance testing';
    ELSE
        RAISE NOTICE 'Test files already exist, skipping creation';
    END IF;
END $$;

-- =======================================
-- Performance Index Testing
-- =======================================

-- Test 1: GetUnenrichedFiles Query Performance
EXPLAIN (ANALYZE, BUFFERS) 
SELECT * FROM files 
WHERE volume_id = 'test-performance-vol'
AND mime IN (
    'video/mp4', 'video/x-msvideo', 'video/x-matroska', 'video/quicktime',
    'audio/mpeg', 'audio/flac', 'audio/wav', 'audio/aac',
    'image/jpeg', 'image/png', 'image/tiff', 'image/bmp'
) AND (
    (mime LIKE 'video/%' OR mime LIKE 'audio/%') AND (duration_ms IS NULL OR video_codec IS NULL OR audio_codec IS NULL)
    OR
    mime LIKE 'image/%' AND (width IS NULL OR height IS NULL OR capture_datetime IS NULL)
)
ORDER BY size_bytes DESC 
LIMIT 1000;

-- Test 2: GetUnenrichedFilesPaginated Query Performance
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM files
WHERE volume_id = 'test-performance-vol'
AND mime IN (
    'video/mp4', 'video/x-msvideo', 'video/x-matroska', 'video/quicktime',
    'audio/mpeg', 'audio/flac', 'audio/wav', 'audio/aac',
    'image/jpeg', 'image/png', 'image/tiff', 'image/bmp'
) AND (
    (mime LIKE 'video/%' OR mime LIKE 'audio/%') AND (duration_ms IS NULL OR video_codec IS NULL OR audio_codec IS NULL)
    OR
    mime LIKE 'image/%' AND (width IS NULL OR height IS NULL OR capture_datetime IS NULL)
)
ORDER BY size_bytes DESC
LIMIT 50 OFFSET 0;

-- Test 3: GetUnenrichedFileCount Query Performance  
EXPLAIN (ANALYZE, BUFFERS)
SELECT COUNT(*) FROM files
WHERE volume_id = 'test-performance-vol'
AND mime IN (
    'video/mp4', 'video/x-msvideo', 'video/x-matroska', 'video/quicktime',
    'audio/mpeg', 'audio/flac', 'audio/wav', 'audio/aac',
    'image/jpeg', 'image/png', 'image/tiff', 'image/bmp'
) AND (
    (mime LIKE 'video/%' OR mime LIKE 'audio/%') AND (duration_ms IS NULL OR video_codec IS NULL OR audio_codec IS NULL)
    OR
    mime LIKE 'image/%' AND (width IS NULL OR height IS NULL OR capture_datetime IS NULL)
);

-- =======================================
-- Index Usage Statistics
-- =======================================

-- Show current index usage for our test queries
SELECT * FROM index_usage_stats 
WHERE tablename = 'files' 
AND indexname LIKE '%unenriched%'
ORDER BY idx_scan DESC;

-- =======================================
-- Enrichment Performance Analysis
-- =======================================

-- Use the new performance analysis function
SELECT * FROM analyze_unenriched_files_performance('test-performance-vol');

-- =======================================
-- Materialized View Performance
-- =======================================

-- Refresh the materialized view
SELECT refresh_volume_enrichment_stats();

-- Query the materialized view
SELECT * FROM mv_volume_enrichment_stats 
WHERE volume_id = 'test-performance-vol';

-- =======================================
-- Performance Summary
-- =======================================

SELECT 
    'Performance Index Testing Summary' as test_name,
    COUNT(*) as total_test_files,
    COUNT(*) FILTER (WHERE mime LIKE 'video/%') as video_files,
    COUNT(*) FILTER (WHERE mime LIKE 'audio/%') as audio_files,
    COUNT(*) FILTER (WHERE mime LIKE 'image/%') as image_files,
    COUNT(*) FILTER (WHERE duration_ms IS NULL AND (mime LIKE 'video/%' OR mime LIKE 'audio/%')) as files_needing_duration,
    COUNT(*) FILTER (WHERE width IS NULL AND mime LIKE 'image/%') as files_needing_dimensions
FROM files 
WHERE volume_id = 'test-performance-vol';

-- =======================================
-- Cleanup Instructions
-- =======================================

-- To clean up test data, run:
-- DELETE FROM files WHERE volume_id = 'test-performance-vol';
-- DELETE FROM folders WHERE volume_id = 'test-performance-vol'; 
-- DELETE FROM volumes WHERE volume_id = 'test-performance-vol';