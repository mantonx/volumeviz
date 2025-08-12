-- Rollup compute SQL for SQLite using iterative depth-ordered processing
-- Post-scan rollup: bottom-up size/file counts computation  
-- Uses depth-ordered loops since SQLite recursive CTEs have limitations

-- =============================================================================
-- DEPTH-ORDERED ROLLUP COMPUTATION (SQLite Approach)
-- =============================================================================

-- name: GetDirectoriesByDepthDesc :many
-- Get all directories ordered by depth descending (deepest first)
-- Used for iterative bottom-up rollup computation
SELECT 
    id,
    volume_id,
    parent_dir_id,
    name,
    full_path,
    depth,
    latest_size_bytes,
    latest_file_count,
    updated_at
FROM dir_nodes 
WHERE volume_id = ?
  AND (@touched_dir_ids IS NULL OR id IN (
      SELECT value FROM json_each(@touched_dir_ids)
  ))
ORDER BY depth DESC, full_path ASC;

-- name: ComputeDirectoryRollupStats :one
-- Compute rollup statistics for a specific directory
-- Includes direct files + immediate subdirectory rollups
SELECT 
    ? as dir_id,
    
    -- Direct files in this directory
    COALESCE(files.direct_size, 0) + COALESCE(subdirs.subdir_size, 0) as total_size_bytes,
    COALESCE(files.direct_count, 0) + COALESCE(subdirs.subdir_files, 0) as total_file_count,
    
    -- Component breakdown for validation
    COALESCE(files.direct_size, 0) as direct_files_size,
    COALESCE(files.direct_count, 0) as direct_files_count,
    COALESCE(subdirs.subdir_size, 0) as subdirectories_size,
    COALESCE(subdirs.subdir_files, 0) as subdirectories_files,
    COALESCE(subdirs.subdir_count, 0) as subdirectories_count,
    
    datetime('now') as computed_at

FROM (SELECT 1) dummy -- Dummy table for cross join
LEFT JOIN (
    -- Aggregate direct files
    SELECT 
        SUM(fe.size_bytes) as direct_size,
        COUNT(*) as direct_count
    FROM file_entries fe
    WHERE fe.parent_dir_id = ?
      AND fe.type = 'file'
      AND fe.volume_id = ?
) files ON 1=1
LEFT JOIN (
    -- Aggregate latest rollups from immediate subdirectories
    SELECT 
        SUM(latest_rollups.size_bytes) as subdir_size,
        SUM(latest_rollups.file_count) as subdir_files,
        COUNT(*) as subdir_count
    FROM (
        -- Get most recent rollup for each subdirectory
        SELECT DISTINCT
            dn_child.id,
            first_value(dr.size_bytes) OVER (
                PARTITION BY dn_child.id 
                ORDER BY dr.computed_at DESC 
                ROWS UNBOUNDED PRECEDING
            ) as size_bytes,
            first_value(dr.file_count) OVER (
                PARTITION BY dn_child.id 
                ORDER BY dr.computed_at DESC 
                ROWS UNBOUNDED PRECEDING
            ) as file_count
        FROM dir_nodes dn_child
        LEFT JOIN dir_rollups dr ON dn_child.id = dr.dir_id
        WHERE dn_child.parent_dir_id = ?
          AND dn_child.volume_id = ?
          AND dr.id IS NOT NULL -- Only directories with existing rollups
    ) latest_rollups
) subdirs ON 1=1;

-- name: ComputeDirectoryRollupStatsWithFallback :one  
-- Compute rollup statistics with fallback to latest_size_bytes for missing rollups
-- More robust version that handles directories without existing rollups
SELECT 
    ? as dir_id,
    
    -- Total: direct files + subdirectories (rollups or fallback)
    COALESCE(files.direct_size, 0) + COALESCE(subdirs.subdir_size, 0) as total_size_bytes,
    COALESCE(files.direct_count, 0) + COALESCE(subdirs.subdir_files, 0) as total_file_count,
    
    -- Component breakdown
    COALESCE(files.direct_size, 0) as direct_files_size,
    COALESCE(files.direct_count, 0) as direct_files_count,
    COALESCE(subdirs.subdir_size, 0) as subdirectories_size,
    COALESCE(subdirs.subdir_files, 0) as subdirectories_files,
    COALESCE(subdirs.subdir_count, 0) as subdirectories_count,
    COALESCE(subdirs.rollup_count, 0) as subdirs_with_rollups,
    COALESCE(subdirs.fallback_count, 0) as subdirs_using_fallback,
    
    datetime('now') as computed_at

FROM (SELECT 1) dummy
LEFT JOIN (
    -- Direct files in this directory
    SELECT 
        SUM(fe.size_bytes) as direct_size,
        COUNT(*) as direct_count
    FROM file_entries fe
    WHERE fe.parent_dir_id = ?
      AND fe.type = 'file'
      AND fe.volume_id = ?
) files ON 1=1
LEFT JOIN (
    -- Subdirectories: use latest rollup if available, else latest_size_bytes
    SELECT 
        SUM(subdir_stats.size_bytes) as subdir_size,
        SUM(subdir_stats.file_count) as subdir_files,
        COUNT(*) as subdir_count,
        SUM(CASE WHEN subdir_stats.has_rollup THEN 1 ELSE 0 END) as rollup_count,
        SUM(CASE WHEN subdir_stats.has_rollup THEN 0 ELSE 1 END) as fallback_count
    FROM (
        SELECT 
            dn_child.id,
            CASE 
                WHEN latest_rollup.size_bytes IS NOT NULL THEN latest_rollup.size_bytes
                ELSE dn_child.latest_size_bytes
            END as size_bytes,
            CASE 
                WHEN latest_rollup.file_count IS NOT NULL THEN latest_rollup.file_count  
                ELSE dn_child.latest_file_count
            END as file_count,
            CASE WHEN latest_rollup.id IS NOT NULL THEN 1 ELSE 0 END as has_rollup
        FROM dir_nodes dn_child
        LEFT JOIN (
            -- Most recent rollup for each subdirectory
            SELECT 
                dr.dir_id,
                dr.id,
                dr.size_bytes,
                dr.file_count,
                dr.computed_at,
                ROW_NUMBER() OVER (PARTITION BY dr.dir_id ORDER BY dr.computed_at DESC) as rn
            FROM dir_rollups dr
        ) latest_rollup ON (dn_child.id = latest_rollup.dir_id AND latest_rollup.rn = 1)
        WHERE dn_child.parent_dir_id = ?
          AND dn_child.volume_id = ?
    ) subdir_stats
) subdirs ON 1=1;

-- =============================================================================
-- INCREMENTAL ROLLUP SUPPORT  
-- =============================================================================

-- name: GetAffectedDirectories :many
-- Get directories that need rollup updates (touched dirs + their ancestors)
-- Used for incremental rollup computation
WITH RECURSIVE affected_hierarchy AS (
    -- Base case: Initially touched directories
    SELECT 
        dn.id,
        dn.volume_id,
        dn.parent_dir_id,
        dn.full_path,
        dn.depth,
        0 as propagation_level,
        'touched' as reason
    FROM dir_nodes dn
    WHERE dn.volume_id = ?
      AND (@touched_dir_ids IS NULL OR dn.id IN (
          SELECT value FROM json_each(@touched_dir_ids)
      ))
    
    UNION ALL
    
    -- Recursive case: Propagate up to parent directories
    SELECT 
        parent.id,
        parent.volume_id,
        parent.parent_dir_id,
        parent.full_path,
        parent.depth,
        ah.propagation_level + 1,
        'ancestor' as reason
    FROM dir_nodes parent
    JOIN affected_hierarchy ah ON parent.id = ah.parent_dir_id
    WHERE parent.volume_id = ?
)
SELECT DISTINCT
    id,
    volume_id,
    parent_dir_id,
    full_path,
    depth,
    MIN(propagation_level) as min_propagation_level,
    GROUP_CONCAT(DISTINCT reason) as reasons
FROM affected_hierarchy
GROUP BY id, volume_id, parent_dir_id, full_path, depth
ORDER BY depth DESC, full_path ASC;

-- name: GetDirectoriesNeedingRollupUpdate :many
-- Identify directories requiring rollup updates based on file changes
-- SQLite version of change detection
SELECT 
    dn.id as dir_id,
    dn.volume_id,
    dn.full_path,
    dn.depth,
    latest_rollup.computed_at as last_rollup_date,
    file_changes.latest_file_change,
    file_changes.changed_files_count,
    
    -- Priority scoring
    CASE 
        WHEN latest_rollup.computed_at IS NULL THEN 1000 -- Never computed
        WHEN datetime(file_changes.latest_file_change) > datetime(latest_rollup.computed_at, '+1 hour') THEN 100 -- Stale
        WHEN file_changes.changed_files_count > 100 THEN 50 -- Many changes
        ELSE 10 -- Regular update
    END as rollup_priority,
    
    -- Metadata
    CASE WHEN latest_rollup.computed_at IS NULL THEN 1 ELSE 0 END as never_computed,
    CASE WHEN file_changes.latest_file_change > latest_rollup.computed_at THEN 1 ELSE 0 END as files_changed

FROM dir_nodes dn
LEFT JOIN (
    -- Latest rollup per directory
    SELECT 
        dr.dir_id,
        dr.computed_at,
        ROW_NUMBER() OVER (PARTITION BY dr.dir_id ORDER BY dr.computed_at DESC) as rn
    FROM dir_rollups dr
) latest_rollup ON (dn.id = latest_rollup.dir_id AND latest_rollup.rn = 1)
LEFT JOIN (
    -- File change statistics
    SELECT 
        fe.parent_dir_id,
        MAX(MAX(fe.updated_at, fe.created_at)) as latest_file_change,
        COUNT(*) as changed_files_count
    FROM file_entries fe
    WHERE fe.volume_id = ?
      AND fe.type = 'file'
      AND (@since_timestamp IS NULL 
           OR MAX(fe.updated_at, fe.created_at) > datetime(@since_timestamp))
    GROUP BY fe.parent_dir_id
) file_changes ON dn.id = file_changes.parent_dir_id
WHERE dn.volume_id = ?
  AND (
      latest_rollup.computed_at IS NULL
      OR file_changes.latest_file_change > latest_rollup.computed_at
      OR (@force_all = 1)
  )
ORDER BY rollup_priority DESC, dn.depth DESC, dn.full_path ASC;

-- =============================================================================
-- ROLLUP VALIDATION FOR SQLITE
-- =============================================================================

-- name: ValidateDirectoryRollup :one
-- Validate rollup accuracy for a specific directory
-- Computes direct totals and compares with latest rollup
SELECT 
    dn.id as dir_id,
    dn.full_path,
    dn.depth,
    
    -- Latest rollup values
    latest_rollup.size_bytes as rollup_size,
    latest_rollup.file_count as rollup_files,
    latest_rollup.computed_at as rollup_date,
    
    -- Direct computation
    computed.total_size as computed_size,
    computed.total_files as computed_files,
    computed.direct_files_size,
    computed.direct_files_count,
    computed.subdirs_size,
    computed.subdirs_files,
    computed.subdirs_count,
    
    -- Consistency flags
    CASE WHEN latest_rollup.size_bytes = computed.total_size THEN 1 ELSE 0 END as size_consistent,
    CASE WHEN latest_rollup.file_count = computed.total_files THEN 1 ELSE 0 END as files_consistent,
    
    -- Differences
    (latest_rollup.size_bytes - computed.total_size) as size_diff,
    (latest_rollup.file_count - computed.total_files) as files_diff,
    
    datetime('now') as validated_at

FROM dir_nodes dn
LEFT JOIN (
    -- Latest rollup
    SELECT 
        dr.dir_id,
        dr.size_bytes,
        dr.file_count,
        dr.computed_at,
        ROW_NUMBER() OVER (PARTITION BY dr.dir_id ORDER BY dr.computed_at DESC) as rn
    FROM dir_rollups dr
) latest_rollup ON (dn.id = latest_rollup.dir_id AND latest_rollup.rn = 1)
LEFT JOIN (
    -- Direct computation using same logic as rollup
    SELECT 
        ? as dir_id,
        COALESCE(files.direct_size, 0) + COALESCE(subdirs.subdir_size, 0) as total_size,
        COALESCE(files.direct_count, 0) + COALESCE(subdirs.subdir_files, 0) as total_files,
        COALESCE(files.direct_size, 0) as direct_files_size,
        COALESCE(files.direct_count, 0) as direct_files_count,
        COALESCE(subdirs.subdir_size, 0) as subdirs_size,
        COALESCE(subdirs.subdir_files, 0) as subdirs_files,
        COALESCE(subdirs.subdir_count, 0) as subdirs_count
    FROM (SELECT 1) dummy
    LEFT JOIN (
        SELECT 
            SUM(fe.size_bytes) as direct_size,
            COUNT(*) as direct_count
        FROM file_entries fe
        WHERE fe.parent_dir_id = ? AND fe.type = 'file' AND fe.volume_id = ?
    ) files ON 1=1
    LEFT JOIN (
        SELECT 
            SUM(latest_sub_rollups.size_bytes) as subdir_size,
            SUM(latest_sub_rollups.file_count) as subdir_files,
            COUNT(*) as subdir_count
        FROM (
            SELECT 
                dn_child.id,
                COALESCE(sub_rollup.size_bytes, dn_child.latest_size_bytes) as size_bytes,
                COALESCE(sub_rollup.file_count, dn_child.latest_file_count) as file_count
            FROM dir_nodes dn_child
            LEFT JOIN (
                SELECT 
                    dr_sub.dir_id,
                    dr_sub.size_bytes,
                    dr_sub.file_count,
                    ROW_NUMBER() OVER (PARTITION BY dr_sub.dir_id ORDER BY dr_sub.computed_at DESC) as rn
                FROM dir_rollups dr_sub
            ) sub_rollup ON (dn_child.id = sub_rollup.dir_id AND sub_rollup.rn = 1)
            WHERE dn_child.parent_dir_id = ? AND dn_child.volume_id = ?
        ) latest_sub_rollups
    ) subdirs ON 1=1
) computed ON 1=1
WHERE dn.id = ? AND dn.volume_id = ?;

-- =============================================================================
-- BATCH ROLLUP OPERATIONS
-- =============================================================================

-- name: CreateRollupBatchPrep :exec
-- Prepare temporary table for batch rollup insertion
-- Used for efficient bulk rollup creation in SQLite
CREATE TEMPORARY TABLE IF NOT EXISTS temp_rollup_batch (
    dir_id INTEGER NOT NULL,
    size_bytes INTEGER NOT NULL,
    file_count INTEGER NOT NULL,
    computed_at TEXT NOT NULL
);

-- name: ClearRollupBatchPrep :exec  
-- Clear temporary batch table
DELETE FROM temp_rollup_batch;

-- name: InsertRollupBatch :exec
-- Insert computed rollup into temporary batch table
INSERT INTO temp_rollup_batch (dir_id, size_bytes, file_count, computed_at)
VALUES (?, ?, ?, ?);

-- name: CommitRollupBatch :exec
-- Commit batch rollups from temporary table to actual rollups table
INSERT INTO dir_rollups (dir_id, size_bytes, file_count, computed_at)
SELECT dir_id, size_bytes, file_count, computed_at
FROM temp_rollup_batch;

-- name: GetRollupBatchStats :one
-- Get statistics about the current batch
SELECT 
    COUNT(*) as batch_size,
    SUM(size_bytes) as total_size,
    SUM(file_count) as total_files,
    MIN(computed_at) as earliest_computation,
    MAX(computed_at) as latest_computation,
    COUNT(DISTINCT dir_id) as unique_directories
FROM temp_rollup_batch;

-- =============================================================================
-- PERFORMANCE AND MONITORING
-- =============================================================================

-- name: GetSQLiteRollupPerformanceStats :one
-- Performance statistics for SQLite rollup operations
SELECT 
    COUNT(DISTINCT dr.dir_id) as directories_with_rollups,
    COUNT(*) as total_rollup_records,
    
    -- Temporal analysis
    MIN(dr.computed_at) as oldest_rollup,
    MAX(dr.computed_at) as newest_rollup,
    
    -- Recent activity 
    SUM(CASE WHEN datetime(dr.computed_at) > datetime('now', '-1 hour') THEN 1 ELSE 0 END) as rollups_last_hour,
    SUM(CASE WHEN datetime(dr.created_at) > datetime('now', '-1 hour') THEN 1 ELSE 0 END) as rollups_created_last_hour,
    
    -- Size distribution
    AVG(dr.size_bytes) as avg_directory_size,
    MAX(dr.size_bytes) as max_directory_size,
    
    -- File count distribution
    AVG(dr.file_count) as avg_file_count,
    MAX(dr.file_count) as max_file_count,
    
    -- Volume-specific stats
    COUNT(DISTINCT dn.volume_id) as volumes_with_rollups

FROM dir_rollups dr
LEFT JOIN dir_nodes dn ON dr.dir_id = dn.id
WHERE (@volume_id IS NULL OR dn.volume_id = @volume_id);