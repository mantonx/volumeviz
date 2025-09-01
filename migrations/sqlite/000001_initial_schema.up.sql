-- =============================================================================
-- VolumeViz Initial Schema for SQLite
-- Complete database schema for VolumeViz application (SQLite version)
-- =============================================================================

-- =============================================================================
-- CORE SCHEMA
-- =============================================================================

-- Main volumes table (equivalent to "mounts" in Docker)
CREATE TABLE volumes (
    volume_id TEXT PRIMARY KEY,
    display_name TEXT,
    mount_point TEXT NOT NULL,
    container_names TEXT, -- JSON array stored as text
    is_active INTEGER DEFAULT 1, -- Boolean as integer
    
    -- Attributes from filesystem
    total_size_bytes INTEGER DEFAULT 0,
    used_size_bytes INTEGER DEFAULT 0,
    free_size_bytes INTEGER DEFAULT 0,
    filesystem_type TEXT,
    
    -- Container references  
    container_count INTEGER DEFAULT 0,
    
    -- Timestamps
    first_seen_at TEXT DEFAULT CURRENT_TIMESTAMP,
    last_scan_at TEXT,
    last_modified_at TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Current volume sizes/stats  
CREATE TABLE volume_sizes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    volume_id TEXT NOT NULL REFERENCES volumes(volume_id) ON DELETE CASCADE,
    total_size INTEGER NOT NULL DEFAULT 0,
    file_count INTEGER NOT NULL DEFAULT 0,
    directory_count INTEGER NOT NULL DEFAULT 0,
    largest_file_size INTEGER DEFAULT 0,
    smallest_file_size INTEGER DEFAULT 0,
    average_file_size INTEGER DEFAULT 0,
    median_file_size INTEGER DEFAULT 0,
    
    -- Type distribution (JSON)
    type_distribution TEXT DEFAULT '{}',
    extension_distribution TEXT DEFAULT '{}',
    
    calculated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(volume_id)
);

-- Folder hierarchy
CREATE TABLE folders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    volume_id TEXT NOT NULL REFERENCES volumes(volume_id) ON DELETE CASCADE,
    parent_id INTEGER REFERENCES folders(id) ON DELETE CASCADE,
    path TEXT NOT NULL,
    name TEXT NOT NULL,
    path_hash TEXT NOT NULL,
    
    -- Size info
    size_bytes INTEGER DEFAULT 0,
    size_bytes_recursive INTEGER DEFAULT 0,
    
    -- Statistics
    file_count INTEGER DEFAULT 0,
    file_count_recursive INTEGER DEFAULT 0,
    subfolder_count INTEGER DEFAULT 0,
    
    -- Media info
    media_file_count INTEGER DEFAULT 0,
    has_media_files INTEGER DEFAULT 0, -- Boolean
    
    -- Timestamps
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    modified_at TEXT,
    accessed_at TEXT,
    
    UNIQUE(volume_id, path),
    UNIQUE(path_hash)
);

-- Individual files
CREATE TABLE files (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    volume_id TEXT NOT NULL REFERENCES volumes(volume_id) ON DELETE CASCADE,
    folder_id INTEGER REFERENCES folders(id) ON DELETE CASCADE,
    path TEXT NOT NULL,
    path_hash TEXT NOT NULL,
    name TEXT NOT NULL,
    extension TEXT,
    mime TEXT,
    size_bytes INTEGER NOT NULL DEFAULT 0,
    
    -- File system metadata
    created_at TEXT,
    modified_at TEXT,
    accessed_at TEXT,
    mode INTEGER,
    owner_uid INTEGER,
    owner_gid INTEGER,
    
    -- Content metadata
    content_hash TEXT,
    is_text INTEGER DEFAULT 0,
    is_binary INTEGER DEFAULT 1,
    
    -- Media metadata
    media_kind TEXT,
    duration_ms INTEGER,
    bitrate_kbps INTEGER,
    width INTEGER,
    height INTEGER,
    fps REAL,
    color_primaries TEXT,
    transfer_characteristic TEXT,
    hdr_format TEXT,
    
    -- Image/photo metadata
    capture_datetime TEXT,
    camera_make TEXT,
    camera_model TEXT,
    lens_model TEXT,
    orientation INTEGER,
    gps_latitude REAL,
    gps_longitude REAL,
    
    -- Subtitle metadata
    subtitle_language TEXT,
    subtitle_format TEXT,
    cue_count INTEGER,
    coverage_percent REAL,
    
    -- Audio/video codec info
    audio_channels INTEGER,
    audio_codec TEXT,
    audio_sample_rate INTEGER,
    video_codec TEXT,
    video_profile TEXT,
    video_level TEXT,
    
    -- Tracking
    first_seen_at TEXT DEFAULT CURRENT_TIMESTAMP,
    last_scan_at TEXT,
    
    UNIQUE(path_hash)
);

-- Scan job tracking
CREATE TABLE scan_jobs (
    scan_id TEXT PRIMARY KEY,
    volume_id TEXT REFERENCES volumes(volume_id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled', 'paused')),
    
    -- Progress tracking
    total_files INTEGER DEFAULT 0,
    scanned_files INTEGER DEFAULT 0,
    failed_files INTEGER DEFAULT 0,
    total_bytes INTEGER DEFAULT 0,
    scanned_bytes INTEGER DEFAULT 0,
    
    -- Performance metrics
    scan_rate_files_per_sec REAL,
    scan_rate_mb_per_sec REAL,
    
    -- Error tracking
    error_message TEXT,
    error_details TEXT, -- JSON
    
    -- Timing
    started_at TEXT,
    completed_at TEXT,
    paused_at TEXT,
    pause_reason TEXT,
    duration_seconds INTEGER,
    
    -- Additional context
    triggered_by TEXT,
    scan_options TEXT, -- JSON
    
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- DOCKER MOUNT CATALOG WITH ATTACHMENTS
-- =============================================================================

-- Docker mount catalog table
CREATE TABLE docker_mount_catalog (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    
    -- Mount identification
    mount_id TEXT NOT NULL,
    mount_type TEXT NOT NULL CHECK (mount_type IN ('volume', 'bind', 'tmpfs')),
    
    -- Volume-specific fields
    volume_name TEXT,
    volume_driver TEXT,
    volume_options TEXT DEFAULT '{}', -- JSON
    volume_labels TEXT DEFAULT '{}', -- JSON
    volume_scope TEXT,
    
    -- Mount path information
    source_path TEXT NOT NULL,
    
    -- Container attachment information
    container_count INTEGER NOT NULL DEFAULT 0,
    is_orphaned INTEGER NOT NULL DEFAULT 0, -- Boolean
    
    -- Compose metadata
    compose_project TEXT,
    compose_services TEXT, -- JSON array
    compose_version TEXT,
    compose_config_files TEXT, -- JSON array
    
    -- Discovery metadata
    first_discovered_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    discovery_source TEXT NOT NULL DEFAULT 'docker_engine',
    
    -- Tracking status
    is_tracked INTEGER NOT NULL DEFAULT 0, -- Boolean
    tracking_enabled_at TEXT,
    tracking_disabled_at TEXT,
    
    -- Metadata
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(mount_id)
);

-- Docker mount attachments table
CREATE TABLE docker_mount_attachments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    
    -- References
    mount_catalog_id INTEGER NOT NULL REFERENCES docker_mount_catalog(id) ON DELETE CASCADE,
    container_id TEXT NOT NULL,
    container_name TEXT,
    
    -- Mount details within container
    destination_path TEXT NOT NULL,
    access_mode TEXT NOT NULL DEFAULT 'rw' CHECK (access_mode IN ('rw', 'ro')),
    
    -- Propagation settings
    propagation TEXT,
    
    -- Container metadata
    container_state TEXT,
    container_image TEXT,
    container_labels TEXT DEFAULT '{}', -- JSON
    
    -- Compose metadata
    container_compose_project TEXT,
    container_compose_service TEXT,
    container_compose_container_number INTEGER,
    container_compose_config_hash TEXT,
    
    -- Discovery
    attached_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    detached_at TEXT,
    is_active INTEGER NOT NULL DEFAULT 1, -- Boolean
    
    -- Metadata
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(mount_catalog_id, container_id, destination_path)
);

-- Docker mount statistics table
CREATE TABLE docker_mount_statistics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    mount_catalog_id INTEGER NOT NULL REFERENCES docker_mount_catalog(id) ON DELETE CASCADE,
    
    -- Usage statistics
    peak_container_count INTEGER NOT NULL DEFAULT 0,
    total_attachments INTEGER NOT NULL DEFAULT 0,
    
    -- Compose project statistics
    compose_projects_count INTEGER NOT NULL DEFAULT 0,
    compose_services_count INTEGER NOT NULL DEFAULT 0,
    
    -- Lifecycle statistics
    days_since_creation INTEGER,
    days_since_last_use INTEGER,
    attachment_frequency_score REAL,
    
    -- Size information
    last_known_size_bytes INTEGER,
    last_scanned_at TEXT,
    
    -- Metadata
    calculated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(mount_catalog_id)
);

-- Docker Compose project tracking
CREATE TABLE docker_projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_name TEXT NOT NULL,
    compose_file_path TEXT,
    compose_file_hash TEXT,
    working_directory TEXT,
    services TEXT, -- JSON array
    networks TEXT, -- JSON array
    volumes TEXT, -- JSON array
    config_data TEXT DEFAULT '{}', -- JSON
    last_seen_at TEXT DEFAULT CURRENT_TIMESTAMP,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(project_name)
);

-- =============================================================================
-- TRACKING RULES ENGINE WITH ASSIGNMENTS
-- =============================================================================

-- Tracking rules table
CREATE TABLE tracking_rules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    action TEXT NOT NULL CHECK (action IN ('include', 'exclude')),
    priority INTEGER NOT NULL DEFAULT 1000,
    is_enabled INTEGER NOT NULL DEFAULT 1, -- Boolean
    
    -- Rule conditions (JSON)
    conditions TEXT NOT NULL DEFAULT '[]',
    
    -- Statistics and metadata
    match_count INTEGER NOT NULL DEFAULT 0,
    last_matched_at TEXT,
    last_evaluation_at TEXT,
    
    -- Audit fields
    created_by TEXT DEFAULT 'system',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Rule evaluation history
CREATE TABLE tracking_rule_evaluations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    rule_id INTEGER REFERENCES tracking_rules(id) ON DELETE CASCADE,
    
    -- Evaluation context
    evaluation_type TEXT NOT NULL,
    triggered_by TEXT,
    
    -- Results
    status TEXT NOT NULL CHECK (status IN ('pending', 'success', 'error', 'skipped')),
    mounts_evaluated INTEGER NOT NULL DEFAULT 0,
    mounts_matched INTEGER NOT NULL DEFAULT 0,
    mounts_included INTEGER NOT NULL DEFAULT 0,
    mounts_excluded INTEGER NOT NULL DEFAULT 0,
    
    -- Performance metrics
    execution_time_ms INTEGER,
    
    -- Error information
    error_message TEXT,
    error_details TEXT, -- JSON
    
    -- Timestamps
    started_at TEXT NOT NULL,
    completed_at TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Mount tracking assignments
CREATE TABLE mount_tracking_assignments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    mount_catalog_id INTEGER REFERENCES docker_mount_catalog(id) ON DELETE CASCADE,
    rule_id INTEGER REFERENCES tracking_rules(id) ON DELETE SET NULL,
    evaluation_id INTEGER REFERENCES tracking_rule_evaluations(id) ON DELETE SET NULL,
    
    -- Assignment details
    action TEXT NOT NULL CHECK (action IN ('include', 'exclude')),
    is_active INTEGER NOT NULL DEFAULT 1, -- Boolean
    
    -- Rule match information
    matched_conditions TEXT, -- JSON
    rule_priority INTEGER,
    rule_name TEXT,
    
    -- Timestamps
    assigned_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Rule conditions validation
CREATE TABLE tracking_rule_conditions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    rule_id INTEGER REFERENCES tracking_rules(id) ON DELETE CASCADE,
    
    -- Condition definition
    field_name TEXT NOT NULL,
    operator TEXT NOT NULL CHECK (operator IN (
        'equals', 'not_equals', 'regex', 'not_regex', 
        'prefix', 'suffix', 'contains', 'not_contains',
        'glob', 'in', 'not_in'
    )),
    value TEXT,
    values TEXT, -- JSON array for 'in'/'not_in'
    
    -- Condition metadata
    is_case_sensitive INTEGER NOT NULL DEFAULT 1, -- Boolean
    description TEXT,
    
    -- Evaluation statistics
    match_count INTEGER NOT NULL DEFAULT 0,
    last_matched_at TEXT,
    
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Rule templates
CREATE TABLE tracking_rule_templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    description TEXT NOT NULL,
    category TEXT NOT NULL,
    
    -- Template definition
    template_data TEXT NOT NULL, -- JSON
    
    -- Usage statistics
    usage_count INTEGER NOT NULL DEFAULT 0,
    last_used_at TEXT,
    
    -- Template metadata
    is_builtin INTEGER NOT NULL DEFAULT 0, -- Boolean
    tags TEXT, -- JSON array
    
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- MEDIA METADATA
-- =============================================================================

-- File metadata storage
CREATE TABLE file_metadata (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    file_id INTEGER NOT NULL REFERENCES files(id) ON DELETE CASCADE,
    raw_metadata TEXT NOT NULL DEFAULT '{}', -- JSON
    extracted_at TEXT DEFAULT CURRENT_TIMESTAMP,
    extractor_version TEXT,
    extraction_duration_ms INTEGER,
    error_message TEXT,
    UNIQUE(file_id)
);

-- =============================================================================
-- DAILY STATS
-- =============================================================================

-- Daily aggregated statistics
CREATE TABLE daily_stats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    volume_id TEXT NOT NULL REFERENCES volumes(volume_id) ON DELETE CASCADE,
    date TEXT NOT NULL,
    
    -- Size metrics
    total_size_bytes INTEGER DEFAULT 0,
    size_change_bytes INTEGER DEFAULT 0,
    growth_percent REAL,
    
    -- File metrics
    total_files INTEGER DEFAULT 0,
    new_files INTEGER DEFAULT 0,
    deleted_files INTEGER DEFAULT 0,
    modified_files INTEGER DEFAULT 0,
    
    -- Type distribution
    media_files INTEGER DEFAULT 0,
    document_files INTEGER DEFAULT 0,
    code_files INTEGER DEFAULT 0,
    archive_files INTEGER DEFAULT 0,
    other_files INTEGER DEFAULT 0,
    
    -- Performance
    scan_duration_ms INTEGER,
    
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(volume_id, date)
);

-- =============================================================================
-- ALERT SYSTEM
-- =============================================================================

-- Alert rule definitions
CREATE TABLE alert_rules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    rule_type TEXT NOT NULL CHECK (rule_type IN ('threshold', 'growth_rate', 'anomaly', 'custom')),
    metric_name TEXT NOT NULL,
    condition_operator TEXT NOT NULL CHECK (condition_operator IN ('>', '<', '>=', '<=', '==', '!=')),
    threshold_value REAL NOT NULL,
    
    -- Additional parameters
    time_window_minutes INTEGER DEFAULT 60,
    min_occurrences INTEGER DEFAULT 1,
    
    -- Configuration
    is_enabled INTEGER DEFAULT 1, -- Boolean
    severity TEXT NOT NULL DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    cooldown_minutes INTEGER DEFAULT 60,
    
    -- Tracking
    last_triggered_at TEXT,
    trigger_count INTEGER DEFAULT 0,
    
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Alert destination configurations
CREATE TABLE alert_destinations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('email', 'webhook', 'slack', 'teams')),
    configuration TEXT NOT NULL DEFAULT '{}', -- JSON
    is_enabled INTEGER DEFAULT 1, -- Boolean
    last_used_at TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Alert routing rules
CREATE TABLE alert_routes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    rule_id INTEGER NOT NULL REFERENCES alert_rules(id) ON DELETE CASCADE,
    destination_id INTEGER NOT NULL REFERENCES alert_destinations(id) ON DELETE CASCADE,
    severity_filter TEXT, -- JSON array
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(rule_id, destination_id)
);

-- Triggered alert instances
CREATE TABLE alerts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    rule_id INTEGER NOT NULL REFERENCES alert_rules(id) ON DELETE CASCADE,
    volume_id TEXT REFERENCES volumes(volume_id) ON DELETE CASCADE,
    severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    context_data TEXT DEFAULT '{}', -- JSON
    is_resolved INTEGER DEFAULT 0, -- Boolean
    resolved_at TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Alert delivery tracking
CREATE TABLE alert_deliveries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    alert_id INTEGER NOT NULL REFERENCES alerts(id) ON DELETE CASCADE,
    destination_id INTEGER NOT NULL REFERENCES alert_destinations(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'retrying')),
    attempt_count INTEGER DEFAULT 0,
    last_attempt_at TEXT,
    delivered_at TEXT,
    error_message TEXT,
    response_data TEXT DEFAULT '{}', -- JSON
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- SEARCH SYSTEM
-- =============================================================================

-- Saved search queries - complete functionality
CREATE TABLE saved_searches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    query TEXT NOT NULL, -- JSON stored as TEXT in SQLite
    tags TEXT DEFAULT '[]', -- JSON array stored as TEXT in SQLite 
    is_public INTEGER DEFAULT 0 CHECK (is_public IN (0, 1)), -- BOOLEAN as INTEGER in SQLite
    metadata TEXT DEFAULT '{}', -- JSON stored as TEXT in SQLite
    created_at TEXT DEFAULT (datetime('now')), -- ISO8601 datetime string
    updated_at TEXT DEFAULT (datetime('now')), -- ISO8601 datetime string
    last_run_at TEXT, -- ISO8601 datetime string
    run_count INTEGER DEFAULT 0,
    
    -- Constraints
    CHECK(length(trim(name)) > 0)
);

-- =============================================================================
-- PREVIEW SYSTEM
-- =============================================================================

-- File preview/thumbnail tracking
CREATE TABLE file_previews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    file_id INTEGER NOT NULL REFERENCES files(id) ON DELETE CASCADE,
    preview_type TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_size INTEGER,
    width INTEGER,
    height INTEGER,
    format TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'skipped')),
    generated_at TEXT,
    error_message TEXT,
    processing_duration_ms INTEGER,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(file_id, preview_type)
);

-- =============================================================================
-- DETAILED SCAN PROGRESS
-- =============================================================================

-- Multi-phase scan tracking
CREATE TABLE scan_phases (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    scan_id TEXT NOT NULL REFERENCES scan_jobs(scan_id) ON DELETE CASCADE,
    phase_name TEXT NOT NULL CHECK (phase_name IN ('discovery', 'analysis', 'indexing', 'metadata_extraction', 'finalization')),
    status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'completed', 'failed', 'cancelled', 'paused')),
    progress_percent INTEGER DEFAULT 0 CHECK (progress_percent >= 0 AND progress_percent <= 100),
    items_total INTEGER DEFAULT 0,
    items_processed INTEGER DEFAULT 0,
    items_failed INTEGER DEFAULT 0,
    current_item TEXT,
    started_at TEXT,
    completed_at TEXT,
    duration_ms INTEGER,
    throughput_items_per_sec REAL,
    memory_usage_mb INTEGER,
    error_message TEXT,
    pause_reason TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Individual scan step tracking
CREATE TABLE scan_phase_steps (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    phase_id INTEGER NOT NULL REFERENCES scan_phases(id) ON DELETE CASCADE,
    step_name TEXT NOT NULL,
    step_order INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'completed', 'failed', 'cancelled', 'paused')),
    progress_percent INTEGER DEFAULT 0,
    started_at TEXT,
    completed_at TEXT,
    duration_ms INTEGER,
    result_data TEXT DEFAULT '{}', -- JSON
    error_message TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Scan performance metrics
CREATE TABLE scan_performance_metrics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    scan_id TEXT NOT NULL REFERENCES scan_jobs(scan_id) ON DELETE CASCADE,
    metric_name TEXT NOT NULL,
    metric_value REAL NOT NULL,
    metric_unit TEXT,
    measured_at TEXT DEFAULT CURRENT_TIMESTAMP,
    phase TEXT
);

-- =============================================================================
-- USAGE SNAPSHOTS
-- =============================================================================

CREATE TABLE usage_snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    volume_id TEXT NOT NULL REFERENCES volumes(volume_id) ON DELETE CASCADE,
    snapshot_date TEXT NOT NULL,
    total_size_bytes INTEGER NOT NULL DEFAULT 0,
    total_files INTEGER NOT NULL DEFAULT 0,
    total_directories INTEGER NOT NULL DEFAULT 0,
    size_change_bytes INTEGER DEFAULT 0,
    files_change INTEGER DEFAULT 0,
    growth_rate REAL,
    largest_file_size INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(volume_id, snapshot_date)
);

-- =============================================================================
-- INDEXES FOR PERFORMANCE
-- =============================================================================

-- Volume indexes
CREATE INDEX idx_volumes_active ON volumes(is_active);
CREATE INDEX idx_volumes_last_scan ON volumes(last_scan_at);
CREATE INDEX idx_volumes_container_count ON volumes(container_count);

-- Folder indexes
CREATE INDEX idx_folders_volume_id ON folders(volume_id);
CREATE INDEX idx_folders_parent_id ON folders(parent_id);
CREATE INDEX idx_folders_path_hash ON folders(path_hash);
CREATE INDEX idx_folders_media ON folders(volume_id, has_media_files);

-- File indexes
CREATE INDEX idx_files_volume_id ON files(volume_id);
CREATE INDEX idx_files_folder_id ON files(folder_id);
CREATE INDEX idx_files_path_hash ON files(path_hash);
CREATE INDEX idx_files_extension ON files(extension);
CREATE INDEX idx_files_mime ON files(mime);
CREATE INDEX idx_files_size ON files(size_bytes);
CREATE INDEX idx_files_media_kind ON files(media_kind);
CREATE INDEX idx_files_content_hash ON files(content_hash);
CREATE INDEX idx_files_modified ON files(modified_at);

-- Docker mount catalog indexes
CREATE INDEX idx_docker_mount_catalog_mount_id ON docker_mount_catalog(mount_id);
CREATE INDEX idx_docker_mount_catalog_mount_type ON docker_mount_catalog(mount_type);
CREATE INDEX idx_docker_mount_catalog_volume_name ON docker_mount_catalog(volume_name);
CREATE INDEX idx_docker_mount_catalog_orphaned ON docker_mount_catalog(is_orphaned);
CREATE INDEX idx_docker_mount_catalog_tracked ON docker_mount_catalog(is_tracked);
CREATE INDEX idx_docker_mount_catalog_compose_project ON docker_mount_catalog(compose_project);
CREATE INDEX idx_docker_mount_catalog_last_seen ON docker_mount_catalog(last_seen_at);

-- Docker mount attachments indexes
CREATE INDEX idx_docker_mount_attachments_mount_id ON docker_mount_attachments(mount_catalog_id);
CREATE INDEX idx_docker_mount_attachments_container_id ON docker_mount_attachments(container_id);
CREATE INDEX idx_docker_mount_attachments_active ON docker_mount_attachments(is_active);
CREATE INDEX idx_docker_mount_attachments_compose_project ON docker_mount_attachments(container_compose_project);
CREATE INDEX idx_docker_mount_attachments_compose_service ON docker_mount_attachments(container_compose_service);

-- Tracking rules indexes
CREATE INDEX idx_tracking_rules_priority ON tracking_rules(priority, id);
CREATE INDEX idx_tracking_rules_action ON tracking_rules(action);
CREATE INDEX idx_tracking_rules_enabled ON tracking_rules(is_enabled);
CREATE INDEX idx_tracking_rules_updated ON tracking_rules(updated_at);

-- Rule evaluations indexes
CREATE INDEX idx_rule_evaluations_rule_id ON tracking_rule_evaluations(rule_id);
CREATE INDEX idx_rule_evaluations_type ON tracking_rule_evaluations(evaluation_type);
CREATE INDEX idx_rule_evaluations_started ON tracking_rule_evaluations(started_at);
CREATE INDEX idx_rule_evaluations_status ON tracking_rule_evaluations(status);

-- Mount assignments indexes
CREATE INDEX idx_mount_assignments_mount_id ON mount_tracking_assignments(mount_catalog_id);
CREATE INDEX idx_mount_assignments_rule_id ON mount_tracking_assignments(rule_id);
CREATE INDEX idx_mount_assignments_active ON mount_tracking_assignments(is_active, assigned_at);
CREATE INDEX idx_mount_assignments_action ON mount_tracking_assignments(action);

-- Unique active assignment per mount
CREATE UNIQUE INDEX idx_mount_assignments_unique_active ON mount_tracking_assignments(mount_catalog_id) WHERE is_active = 1;

-- Rule conditions indexes
CREATE INDEX idx_rule_conditions_rule_id ON tracking_rule_conditions(rule_id);
CREATE INDEX idx_rule_conditions_field ON tracking_rule_conditions(field_name);

-- Rule templates indexes
CREATE INDEX idx_rule_templates_category ON tracking_rule_templates(category);
CREATE INDEX idx_rule_templates_builtin ON tracking_rule_templates(is_builtin);

-- Scan job indexes
CREATE INDEX idx_scan_jobs_volume_id ON scan_jobs(volume_id);
CREATE INDEX idx_scan_jobs_status ON scan_jobs(status);
CREATE INDEX idx_scan_jobs_started ON scan_jobs(started_at);

-- File metadata indexes
CREATE INDEX idx_file_metadata_file_id ON file_metadata(file_id);
CREATE INDEX idx_file_metadata_extracted ON file_metadata(extracted_at);

-- Daily stats indexes
CREATE INDEX idx_daily_stats_volume_date ON daily_stats(volume_id, date);
CREATE INDEX idx_daily_stats_date ON daily_stats(date);

-- Alert indexes
CREATE INDEX idx_alert_rules_enabled ON alert_rules(is_enabled);
CREATE INDEX idx_alerts_rule_id ON alerts(rule_id);
CREATE INDEX idx_alerts_volume_id ON alerts(volume_id);
CREATE INDEX idx_alerts_resolved ON alerts(is_resolved);
CREATE INDEX idx_alert_deliveries_alert_id ON alert_deliveries(alert_id);
CREATE INDEX idx_alert_deliveries_status ON alert_deliveries(status);

-- Search indexes
CREATE INDEX idx_saved_searches_name ON saved_searches(name);
CREATE INDEX idx_saved_searches_is_public ON saved_searches(is_public);
CREATE INDEX idx_saved_searches_updated_at ON saved_searches(updated_at DESC);
CREATE INDEX idx_saved_searches_last_run_at ON saved_searches(last_run_at DESC) WHERE last_run_at IS NOT NULL;

-- Preview indexes
CREATE INDEX idx_file_previews_file_id ON file_previews(file_id);
CREATE INDEX idx_file_previews_status ON file_previews(status);

-- =============================================================================
-- DEFAULT DATA
-- =============================================================================

-- Insert default rule templates
INSERT INTO tracking_rule_templates (name, description, category, template_data, is_builtin, tags) VALUES
(
    'Include All Docker Volumes',
    'Include all Docker named volumes for tracking',
    'volume',
    '{"name": "Include All Docker Volumes", "action": "include", "priority": 100, "conditions": [{"field_name": "source_type", "operator": "equals", "value": "volume"}]}',
    1,
    '["volume", "basic", "include"]'
),
(
    'Exclude Temporary Mounts',
    'Exclude all tmpfs mounts from tracking',
    'volume',
    '{"name": "Exclude Temporary Mounts", "action": "exclude", "priority": 200, "conditions": [{"field_name": "source_type", "operator": "equals", "value": "tmpfs"}]}',
    1,
    '["tmpfs", "exclude", "temporary"]'
),
(
    'Include Production Compose Projects',
    'Include mounts from production Compose projects',
    'compose',
    '{"name": "Include Production Compose Projects", "action": "include", "priority": 150, "conditions": [{"field_name": "compose_project", "operator": "suffix", "value": "_prod"}]}',
    1,
    '["compose", "production", "include"]'
),
(
    'Exclude Development Volumes',
    'Exclude volumes from development environments',
    'compose',
    '{"name": "Exclude Development Volumes", "action": "exclude", "priority": 300, "conditions": [{"field_name": "compose_project", "operator": "in", "values": ["dev", "development", "test"]}]}',
    1,
    '["compose", "development", "exclude"]'
),
(
    'Include Database Volumes',
    'Include volumes used by database containers',
    'service',
    '{"name": "Include Database Volumes", "action": "include", "priority": 120, "conditions": [{"field_name": "container_image", "operator": "regex", "value": "(postgres|mysql|mongodb|redis|elasticsearch):"}]}',
    1,
    '["database", "service", "include"]'
),
(
    'Exclude Read-Only Bind Mounts',
    'Exclude read-only bind mounts from tracking',
    'security',
    '{"name": "Exclude Read-Only Bind Mounts", "action": "exclude", "priority": 250, "conditions": [{"field_name": "source_type", "operator": "equals", "value": "bind"}, {"field_name": "read_only", "operator": "equals", "value": "true"}]}',
    1,
    '["bind", "readonly", "exclude", "security"]'
);