-- Comprehensive Scan Progress Tracking Schema
-- Provides detailed visibility into all scan phases and progress

-- Extend scan_jobs table to support phases
ALTER TABLE scan_jobs ADD COLUMN IF NOT EXISTS current_phase TEXT DEFAULT 'volume_scan';
ALTER TABLE scan_jobs ADD COLUMN IF NOT EXISTS total_phases INTEGER DEFAULT 3;
ALTER TABLE scan_jobs ADD COLUMN IF NOT EXISTS phase_progress INTEGER DEFAULT 0 CHECK (phase_progress >= 0 AND phase_progress <= 100);

-- Scan phases table - tracks each phase of the scan process
CREATE TABLE IF NOT EXISTS scan_phases (
    id BIGSERIAL PRIMARY KEY,
    scan_id TEXT NOT NULL,
    phase_name TEXT NOT NULL, -- 'volume_scan', 'filesystem_indexing', 'media_enrichment', 'preview_generation'
    phase_order INTEGER NOT NULL, -- 1, 2, 3, 4
    status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'running', 'completed', 'failed', 'skipped'
    progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
    
    -- Counts and metrics
    items_total BIGINT DEFAULT 0,
    items_processed BIGINT DEFAULT 0,
    items_successful BIGINT DEFAULT 0,
    items_failed BIGINT DEFAULT 0,
    items_skipped BIGINT DEFAULT 0,
    
    -- Size tracking (in bytes)
    bytes_total BIGINT DEFAULT 0,
    bytes_processed BIGINT DEFAULT 0,
    
    -- Performance metrics
    items_per_second DECIMAL(10,2) DEFAULT 0,
    bytes_per_second BIGINT DEFAULT 0,
    
    -- Timing
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    estimated_completion_at TIMESTAMPTZ,
    duration_ms BIGINT,
    
    -- Current processing info
    current_item TEXT, -- current file/directory being processed
    current_depth INTEGER DEFAULT 0,
    
    -- Error tracking
    error_message TEXT,
    error_count BIGINT DEFAULT 0,
    last_error_at TIMESTAMPTZ,
    
    -- Metadata
    metadata JSONB DEFAULT '{}',
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    FOREIGN KEY (scan_id) REFERENCES scan_jobs(scan_id) ON DELETE CASCADE,
    UNIQUE(scan_id, phase_name)
);

-- Scan progress items table - tracks individual items being processed
CREATE TABLE IF NOT EXISTS scan_progress_items (
    id BIGSERIAL PRIMARY KEY,
    scan_id TEXT NOT NULL,
    phase_name TEXT NOT NULL,
    item_type TEXT NOT NULL, -- 'file', 'directory', 'volume', 'media_file'
    item_path TEXT NOT NULL,
    item_name TEXT,
    item_size BIGINT DEFAULT 0,
    
    status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed', 'skipped'
    progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
    
    -- Processing details
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    duration_ms BIGINT,
    
    -- Results
    result_data JSONB,
    error_message TEXT,
    error_details JSONB,
    
    -- Metadata
    metadata JSONB DEFAULT '{}',
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    FOREIGN KEY (scan_id) REFERENCES scan_jobs(scan_id) ON DELETE CASCADE,
    FOREIGN KEY (scan_id, phase_name) REFERENCES scan_phases(scan_id, phase_name) ON DELETE CASCADE
);

-- Scan errors table - detailed error tracking for all failures
CREATE TABLE IF NOT EXISTS scan_errors (
    id BIGSERIAL PRIMARY KEY,
    scan_id TEXT NOT NULL,
    phase_name TEXT NOT NULL,
    
    -- Error classification
    error_type TEXT NOT NULL, -- 'ffprobe_failed', 'permission_denied', 'file_not_found', 'timeout', etc.
    error_category TEXT NOT NULL, -- 'system', 'tool', 'file', 'network', 'timeout', 'permission'
    severity TEXT NOT NULL DEFAULT 'error', -- 'warning', 'error', 'critical'
    
    -- Error context
    component TEXT, -- 'ffprobe', 'exiftool', 'filesystem_indexer', 'volume_scanner'
    operation TEXT, -- 'scan_volume', 'index_file', 'enrich_media', 'extract_metadata'
    
    -- Item that failed
    item_path TEXT,
    item_name TEXT,
    item_type TEXT,
    item_size BIGINT,
    
    -- Error details
    error_message TEXT NOT NULL,
    error_code TEXT,
    stack_trace TEXT,
    technical_details JSONB, -- stderr, exit codes, network errors, etc.
    
    -- Timing
    occurred_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Context
    context JSONB DEFAULT '{}', -- additional context like file permissions, system state
    
    -- Recovery attempts
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 0,
    retry_after TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    FOREIGN KEY (scan_id) REFERENCES scan_jobs(scan_id) ON DELETE CASCADE,
    FOREIGN KEY (scan_id, phase_name) REFERENCES scan_phases(scan_id, phase_name) ON DELETE CASCADE
);

-- Scan performance metrics table - tracks performance over time
CREATE TABLE IF NOT EXISTS scan_performance_metrics (
    id BIGSERIAL PRIMARY KEY,
    scan_id TEXT NOT NULL,
    phase_name TEXT NOT NULL,
    
    -- Snapshot timing
    measured_at TIMESTAMPTZ DEFAULT NOW(),
    elapsed_seconds INTEGER NOT NULL,
    
    -- Current rates
    items_per_second DECIMAL(10,2) DEFAULT 0,
    bytes_per_second BIGINT DEFAULT 0,
    errors_per_minute DECIMAL(8,2) DEFAULT 0,
    
    -- Cumulative counts
    items_processed BIGINT DEFAULT 0,
    bytes_processed BIGINT DEFAULT 0,
    errors_count BIGINT DEFAULT 0,
    
    -- System metrics
    cpu_usage_percent DECIMAL(5,2),
    memory_usage_bytes BIGINT,
    disk_io_read_bytes BIGINT,
    disk_io_write_bytes BIGINT,
    
    -- Queue metrics
    queue_depth INTEGER DEFAULT 0,
    active_workers INTEGER DEFAULT 0,
    
    -- Progress estimation
    estimated_remaining_seconds INTEGER,
    estimated_completion_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    FOREIGN KEY (scan_id) REFERENCES scan_jobs(scan_id) ON DELETE CASCADE,
    FOREIGN KEY (scan_id, phase_name) REFERENCES scan_phases(scan_id, phase_name) ON DELETE CASCADE
);

-- Indexes for efficient querying

-- Scan phases indexes
CREATE INDEX IF NOT EXISTS idx_scan_phases_scan_id ON scan_phases(scan_id);
CREATE INDEX IF NOT EXISTS idx_scan_phases_phase_name ON scan_phases(phase_name);
CREATE INDEX IF NOT EXISTS idx_scan_phases_status ON scan_phases(status);
CREATE INDEX IF NOT EXISTS idx_scan_phases_scan_status ON scan_phases(scan_id, status);
CREATE INDEX IF NOT EXISTS idx_scan_phases_updated_at ON scan_phases(updated_at);
CREATE INDEX IF NOT EXISTS idx_scan_phases_active ON scan_phases(scan_id, phase_name) WHERE status IN ('pending', 'running');

-- Progress items indexes
CREATE INDEX IF NOT EXISTS idx_scan_progress_items_scan_id ON scan_progress_items(scan_id);
CREATE INDEX IF NOT EXISTS idx_scan_progress_items_phase ON scan_progress_items(phase_name);
CREATE INDEX IF NOT EXISTS idx_scan_progress_items_scan_phase ON scan_progress_items(scan_id, phase_name);
CREATE INDEX IF NOT EXISTS idx_scan_progress_items_status ON scan_progress_items(status);
CREATE INDEX IF NOT EXISTS idx_scan_progress_items_item_type ON scan_progress_items(item_type);
CREATE INDEX IF NOT EXISTS idx_scan_progress_items_path ON scan_progress_items(item_path);
CREATE INDEX IF NOT EXISTS idx_scan_progress_items_updated_at ON scan_progress_items(updated_at);
CREATE INDEX IF NOT EXISTS idx_scan_progress_items_failed ON scan_progress_items(scan_id, phase_name) WHERE status = 'failed';

-- Error tracking indexes
CREATE INDEX IF NOT EXISTS idx_scan_errors_scan_id ON scan_errors(scan_id);
CREATE INDEX IF NOT EXISTS idx_scan_errors_phase ON scan_errors(phase_name);
CREATE INDEX IF NOT EXISTS idx_scan_errors_scan_phase ON scan_errors(scan_id, phase_name);
CREATE INDEX IF NOT EXISTS idx_scan_errors_type ON scan_errors(error_type);
CREATE INDEX IF NOT EXISTS idx_scan_errors_category ON scan_errors(error_category);
CREATE INDEX IF NOT EXISTS idx_scan_errors_component ON scan_errors(component);
CREATE INDEX IF NOT EXISTS idx_scan_errors_severity ON scan_errors(severity);
CREATE INDEX IF NOT EXISTS idx_scan_errors_occurred_at ON scan_errors(occurred_at);
CREATE INDEX IF NOT EXISTS idx_scan_errors_item_path ON scan_errors(item_path);

-- Performance metrics indexes
CREATE INDEX IF NOT EXISTS idx_scan_performance_scan_id ON scan_performance_metrics(scan_id);
CREATE INDEX IF NOT EXISTS idx_scan_performance_phase ON scan_performance_metrics(phase_name);
CREATE INDEX IF NOT EXISTS idx_scan_performance_scan_phase ON scan_performance_metrics(scan_id, phase_name);
CREATE INDEX IF NOT EXISTS idx_scan_performance_measured_at ON scan_performance_metrics(measured_at);

-- Composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_scan_phases_active_scans ON scan_phases(status, updated_at) WHERE status IN ('running', 'pending');
CREATE INDEX IF NOT EXISTS idx_scan_errors_recent ON scan_errors(occurred_at, severity, error_category);
CREATE INDEX IF NOT EXISTS idx_scan_progress_active_items ON scan_progress_items(scan_id, status, updated_at) WHERE status IN ('processing', 'pending');

-- Views for common queries

-- Active scans overview
CREATE OR REPLACE VIEW active_scans AS
SELECT 
    sj.scan_id,
    sj.volume_id,
    sj.status as job_status,
    sj.current_phase,
    sj.progress as overall_progress,
    sj.started_at as job_started_at,
    sp.phase_name,
    sp.status as phase_status,
    sp.progress as phase_progress,
    sp.items_processed,
    sp.items_total,
    sp.current_item,
    sp.items_per_second,
    sp.estimated_completion_at,
    sp.error_count as phase_errors,
    EXTRACT(EPOCH FROM (NOW() - sj.started_at))::INTEGER as elapsed_seconds
FROM scan_jobs sj
LEFT JOIN scan_phases sp ON sj.scan_id = sp.scan_id AND sj.current_phase = sp.phase_name
WHERE sj.status IN ('queued', 'scanning', 'running');

-- Recent errors summary
CREATE OR REPLACE VIEW recent_scan_errors AS
SELECT 
    se.scan_id,
    sj.volume_id,
    se.phase_name,
    se.error_type,
    se.error_category,
    se.severity,
    se.component,
    se.item_path,
    se.error_message,
    se.occurred_at,
    se.retry_count
FROM scan_errors se
JOIN scan_jobs sj ON se.scan_id = sj.scan_id
WHERE se.occurred_at > NOW() - INTERVAL '24 hours'
ORDER BY se.occurred_at DESC;

-- Scan progress summary
CREATE OR REPLACE VIEW scan_progress_summary AS
SELECT 
    sj.scan_id,
    sj.volume_id,
    sj.status as job_status,
    sj.current_phase,
    sj.progress as overall_progress,
    sj.started_at,
    COUNT(sp.id) as total_phases,
    COUNT(sp.id) FILTER (WHERE sp.status = 'completed') as completed_phases,
    COUNT(sp.id) FILTER (WHERE sp.status = 'running') as running_phases,
    COUNT(sp.id) FILTER (WHERE sp.status = 'failed') as failed_phases,
    SUM(sp.items_total) as total_items,
    SUM(sp.items_processed) as processed_items,
    SUM(sp.items_successful) as successful_items,
    SUM(sp.items_failed) as failed_items,
    SUM(sp.error_count) as total_errors,
    MAX(sp.updated_at) as last_activity
FROM scan_jobs sj
LEFT JOIN scan_phases sp ON sj.scan_id = sp.scan_id
GROUP BY sj.scan_id, sj.volume_id, sj.status, sj.current_phase, sj.progress, sj.started_at;

-- Functions for updating progress

-- Update scan phase progress
CREATE OR REPLACE FUNCTION update_scan_phase_progress(
    p_scan_id TEXT,
    p_phase_name TEXT,
    p_status TEXT DEFAULT NULL,
    p_progress INTEGER DEFAULT NULL,
    p_items_processed BIGINT DEFAULT NULL,
    p_items_total BIGINT DEFAULT NULL,
    p_current_item TEXT DEFAULT NULL,
    p_error_count BIGINT DEFAULT NULL
) RETURNS VOID AS $$
BEGIN
    UPDATE scan_phases SET
        status = COALESCE(p_status, status),
        progress = COALESCE(p_progress, progress),
        items_processed = COALESCE(p_items_processed, items_processed),
        items_total = COALESCE(p_items_total, items_total),
        current_item = COALESCE(p_current_item, current_item),
        error_count = COALESCE(p_error_count, error_count),
        updated_at = NOW(),
        completed_at = CASE WHEN p_status = 'completed' THEN NOW() ELSE completed_at END,
        duration_ms = CASE WHEN p_status IN ('completed', 'failed') THEN 
            EXTRACT(EPOCH FROM (NOW() - started_at)) * 1000 ELSE duration_ms END
    WHERE scan_id = p_scan_id AND phase_name = p_phase_name;
    
    -- Update overall scan job progress
    UPDATE scan_jobs SET
        current_phase = p_phase_name,
        phase_progress = COALESCE(p_progress, phase_progress),
        updated_at = NOW()
    WHERE scan_id = p_scan_id;
END;
$$ LANGUAGE plpgsql;

-- Record scan error
CREATE OR REPLACE FUNCTION record_scan_error(
    p_scan_id TEXT,
    p_phase_name TEXT,
    p_error_type TEXT,
    p_error_category TEXT,
    p_component TEXT,
    p_operation TEXT,
    p_item_path TEXT,
    p_error_message TEXT,
    p_technical_details JSONB DEFAULT NULL,
    p_severity TEXT DEFAULT 'error'
) RETURNS BIGINT AS $$
DECLARE
    error_id BIGINT;
BEGIN
    INSERT INTO scan_errors (
        scan_id, phase_name, error_type, error_category, 
        component, operation, item_path, error_message,
        technical_details, severity
    ) VALUES (
        p_scan_id, p_phase_name, p_error_type, p_error_category,
        p_component, p_operation, p_item_path, p_error_message,
        p_technical_details, p_severity
    ) RETURNING id INTO error_id;
    
    -- Update phase error count
    UPDATE scan_phases SET
        error_count = error_count + 1,
        last_error_at = NOW(),
        updated_at = NOW()
    WHERE scan_id = p_scan_id AND phase_name = p_phase_name;
    
    RETURN error_id;
END;
$$ LANGUAGE plpgsql;