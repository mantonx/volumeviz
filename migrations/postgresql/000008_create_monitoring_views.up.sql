-- Create views for scan monitoring and reporting

-- Active scans view: Shows all currently running or paused scans with progress
CREATE OR REPLACE VIEW active_scans AS
SELECT
    sj.scan_id,
    sj.volume_id,
    sj.status,
    sj.started_at,
    sj.updated_at,
    sj.completed_at,
    sj.error_message,
    -- Calculate overall progress from phases
    COALESCE(
        (SELECT AVG(
            CASE
                WHEN sp.items_total > 0
                THEN (sp.items_processed::float / sp.items_total::float) * 100
                ELSE 0
            END
        )
        FROM scan_phases sp
        WHERE sp.scan_id = sj.scan_id
        ), 0
    ) as overall_progress_percent,
    -- Count phases
    (SELECT COUNT(*) FROM scan_phases sp WHERE sp.scan_id = sj.scan_id) as total_phases,
    (SELECT COUNT(*) FROM scan_phases sp WHERE sp.scan_id = sj.scan_id AND sp.status = 'completed') as completed_phases,
    (SELECT COUNT(*) FROM scan_phases sp WHERE sp.scan_id = sj.scan_id AND sp.status = 'running') as running_phases,
    (SELECT COUNT(*) FROM scan_phases sp WHERE sp.scan_id = sj.scan_id AND sp.status = 'failed') as failed_phases,
    -- Time metrics
    EXTRACT(EPOCH FROM (COALESCE(sj.completed_at, CURRENT_TIMESTAMP) - sj.started_at)) as duration_seconds,
    EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - sj.updated_at)) as seconds_since_update
FROM scan_jobs sj
WHERE sj.status IN ('running', 'paused')
ORDER BY sj.started_at DESC;

-- Scan progress summary: Detailed phase breakdown for all recent scans
CREATE OR REPLACE VIEW scan_progress_summary AS
SELECT
    sj.scan_id,
    sj.volume_id,
    sj.status as scan_status,
    sj.started_at as scan_started_at,
    sj.completed_at as scan_completed_at,
    sp.phase_name,
    sp.status as phase_status,
    sp.started_at as phase_started_at,
    sp.completed_at as phase_completed_at,
    sp.items_processed,
    sp.items_total,
    sp.items_failed,
    sp.items_successful,
    sp.current_item,
    sp.progress_percent,
    sp.error_message as phase_error,
    sp.pause_reason,
    sp.current_depth,
    sp.throughput_items_per_sec,
    sp.memory_usage_mb,
    -- Progress calculation
    CASE
        WHEN sp.items_total > 0
        THEN ROUND((sp.items_processed::numeric / sp.items_total::numeric) * 100, 2)
        ELSE 0
    END as phase_progress_percent,
    -- Duration
    EXTRACT(EPOCH FROM (COALESCE(sp.completed_at, CURRENT_TIMESTAMP) - sp.started_at)) as phase_duration_seconds
FROM scan_jobs sj
LEFT JOIN scan_phases sp ON sj.scan_id = sp.scan_id
WHERE sj.started_at >= CURRENT_TIMESTAMP - INTERVAL '7 days'
ORDER BY sj.started_at DESC, sp.started_at ASC;

-- Recent scan errors: Shows all errors from the last 24 hours
CREATE OR REPLACE VIEW recent_scan_errors AS
SELECT
    se.id,
    se.scan_id,
    sj.volume_id,
    se.phase_name,
    se.error_type,
    se.error_category,
    se.severity,
    se.component,
    se.operation,
    se.error_message,
    se.item_path,
    se.item_name,
    se.item_type,
    se.occurred_at,
    se.retry_count,
    se.max_retries,
    -- Join with scan info
    sj.status as scan_status,
    sj.started_at as scan_started_at,
    -- Time since error
    EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - se.occurred_at)) as seconds_since_error
FROM scan_errors se
LEFT JOIN scan_jobs sj ON se.scan_id = sj.scan_id
WHERE se.occurred_at >= CURRENT_TIMESTAMP - INTERVAL '24 hours'
ORDER BY se.occurred_at DESC;

-- Scan history view: Summary of all completed scans
CREATE OR REPLACE VIEW scan_history AS
SELECT
    sj.scan_id,
    sj.volume_id,
    sj.status,
    sj.started_at,
    sj.completed_at,
    EXTRACT(EPOCH FROM (sj.completed_at - sj.started_at)) as duration_seconds,
    -- Phase statistics
    (SELECT COUNT(*) FROM scan_phases sp WHERE sp.scan_id = sj.scan_id AND sp.status = 'completed') as completed_phases,
    (SELECT COUNT(*) FROM scan_phases sp WHERE sp.scan_id = sj.scan_id AND sp.status = 'failed') as failed_phases,
    -- Error count
    (SELECT COUNT(*) FROM scan_errors se WHERE se.scan_id = sj.scan_id) as total_errors,
    -- Items processed
    (SELECT SUM(sp.items_processed) FROM scan_phases sp WHERE sp.scan_id = sj.scan_id) as total_items_processed
FROM scan_jobs sj
WHERE sj.status IN ('completed', 'failed', 'cancelled')
ORDER BY sj.completed_at DESC;

-- Volume scan statistics: Aggregated stats per volume
CREATE OR REPLACE VIEW volume_scan_stats AS
SELECT
    sj.volume_id,
    COUNT(*) as total_scans,
    COUNT(*) FILTER (WHERE sj.status = 'completed') as successful_scans,
    COUNT(*) FILTER (WHERE sj.status = 'failed') as failed_scans,
    COUNT(*) FILTER (WHERE sj.status = 'running') as running_scans,
    MAX(sj.started_at) as last_scan_started,
    MAX(sj.completed_at) as last_scan_completed,
    AVG(EXTRACT(EPOCH FROM (sj.completed_at - sj.started_at))) FILTER (WHERE sj.status = 'completed') as avg_scan_duration_seconds,
    SUM((SELECT COUNT(*) FROM scan_errors se WHERE se.scan_id = sj.scan_id)) as total_errors
FROM scan_jobs sj
WHERE sj.started_at >= CURRENT_TIMESTAMP - INTERVAL '30 days'
GROUP BY sj.volume_id
ORDER BY last_scan_started DESC;
