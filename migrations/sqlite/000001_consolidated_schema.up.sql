-- =============================================================================
-- VolumeViz Consolidated Database Schema (SQLite Version)
-- Consolidates all 16 migrations into a single, comprehensive schema
-- Compatible with SQLite 3.35+ (supports generated columns, JSON functions)
-- =============================================================================

-- Enable foreign key support in SQLite
PRAGMA foreign_keys = ON;

-- =============================================================================
-- CORE TABLES - Foundation data structures
-- =============================================================================

-- Docker volumes registry
CREATE TABLE volumes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    volume_id TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    driver TEXT NOT NULL DEFAULT 'local',
    mountpoint TEXT NOT NULL,
    labels TEXT DEFAULT '{}', -- JSON stored as TEXT in SQLite
    options TEXT DEFAULT '{}', -- JSON stored as TEXT in SQLite
    scope TEXT DEFAULT 'local',
    status TEXT DEFAULT 'active',
    last_scanned TEXT, -- ISO8601 datetime string
    is_active INTEGER DEFAULT 1 CHECK (is_active IN (0, 1)), -- BOOLEAN as INTEGER in SQLite
    created_at TEXT DEFAULT (datetime('now')), -- ISO8601 datetime string
    updated_at TEXT DEFAULT (datetime('now'))  -- ISO8601 datetime string
);

-- Container registry
CREATE TABLE containers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    container_id TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    image TEXT NOT NULL,
    state TEXT NOT NULL,
    status TEXT,
    labels TEXT DEFAULT '{}', -- JSON stored as TEXT in SQLite
    started_at TEXT, -- ISO8601 datetime string
    finished_at TEXT, -- ISO8601 datetime string
    is_active INTEGER DEFAULT 1 CHECK (is_active IN (0, 1)), -- BOOLEAN as INTEGER in SQLite
    created_at TEXT DEFAULT (datetime('now')), -- ISO8601 datetime string
    updated_at TEXT DEFAULT (datetime('now'))  -- ISO8601 datetime string
);

-- Volume-container mount relationships
CREATE TABLE volume_mounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    volume_id TEXT NOT NULL REFERENCES volumes(volume_id) ON DELETE CASCADE,
    container_id TEXT NOT NULL REFERENCES containers(container_id) ON DELETE CASCADE,
    mount_path TEXT NOT NULL,
    access_mode TEXT NOT NULL DEFAULT 'rw',
    is_active INTEGER DEFAULT 1 CHECK (is_active IN (0, 1)), -- BOOLEAN as INTEGER in SQLite
    created_at TEXT DEFAULT (datetime('now')), -- ISO8601 datetime string
    updated_at TEXT DEFAULT (datetime('now')), -- ISO8601 datetime string
    UNIQUE(volume_id, container_id, mount_path)
);

-- Volume size and capacity metrics
CREATE TABLE volume_sizes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    volume_id TEXT NOT NULL REFERENCES volumes(volume_id) ON DELETE CASCADE,
    total_size INTEGER NOT NULL DEFAULT 0, -- BIGINT as INTEGER in SQLite
    file_count INTEGER NOT NULL DEFAULT 0,
    directory_count INTEGER NOT NULL DEFAULT 0,
    largest_file INTEGER NOT NULL DEFAULT 0,
    scan_method TEXT NOT NULL,
    scan_duration INTEGER NOT NULL DEFAULT 0,
    filesystem_type TEXT,
    checksum_md5 TEXT,
    is_valid INTEGER DEFAULT 1 CHECK (is_valid IN (0, 1)), -- BOOLEAN as INTEGER in SQLite
    error_message TEXT,
    -- Filesystem capacity tracking
    filesystem_size INTEGER,
    filesystem_used INTEGER,
    filesystem_available INTEGER,
    filesystem_usage_percent REAL, -- DECIMAL as REAL in SQLite
    inodes_total INTEGER,
    inodes_used INTEGER,
    inodes_available INTEGER,
    inodes_usage_percent REAL,
    created_at TEXT DEFAULT (datetime('now')), -- ISO8601 datetime string
    updated_at TEXT DEFAULT (datetime('now'))  -- ISO8601 datetime string
);

-- Scan job tracking
CREATE TABLE scan_jobs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    scan_id TEXT NOT NULL UNIQUE,
    volume_id TEXT NOT NULL REFERENCES volumes(volume_id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'completed', 'failed', 'cancelled', 'paused')),
    progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
    method TEXT NOT NULL,
    started_at TEXT, -- ISO8601 datetime string
    completed_at TEXT, -- ISO8601 datetime string
    error_message TEXT,
    result_id INTEGER REFERENCES volume_sizes(id) ON DELETE SET NULL,
    estimated_duration INTEGER,
    created_at TEXT DEFAULT (datetime('now')), -- ISO8601 datetime string
    updated_at TEXT DEFAULT (datetime('now'))  -- ISO8601 datetime string
);

-- Time-series volume metrics
CREATE TABLE volume_metrics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    volume_id TEXT NOT NULL REFERENCES volumes(volume_id) ON DELETE CASCADE,
    metric_timestamp TEXT NOT NULL, -- ISO8601 datetime string
    total_size INTEGER NOT NULL,
    file_count INTEGER NOT NULL,
    directory_count INTEGER NOT NULL,
    growth_rate REAL,
    access_frequency INTEGER DEFAULT 0,
    container_count INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')), -- ISO8601 datetime string
    updated_at TEXT DEFAULT (datetime('now')), -- ISO8601 datetime string
    UNIQUE(volume_id, metric_timestamp)
);

-- =============================================================================
-- FILESYSTEM INDEXING TABLES
-- =============================================================================

-- Directory/folder structure with statistics
CREATE TABLE folders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    volume_id TEXT NOT NULL REFERENCES volumes(volume_id) ON DELETE CASCADE,
    parent_id INTEGER REFERENCES folders(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    path TEXT NOT NULL,
    path_hash BLOB NOT NULL, -- BYTEA as BLOB in SQLite
    depth INTEGER NOT NULL DEFAULT 0,
    size_bytes_recursive INTEGER NOT NULL DEFAULT 0,
    file_count INTEGER NOT NULL DEFAULT 0,
    dir_count INTEGER NOT NULL DEFAULT 0,
    mtime TEXT, -- ISO8601 datetime string
    created_at TEXT DEFAULT (datetime('now')), -- ISO8601 datetime string
    updated_at TEXT DEFAULT (datetime('now')), -- ISO8601 datetime string
    UNIQUE(volume_id, path)
);

-- File entries with comprehensive metadata
CREATE TABLE files (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    volume_id TEXT NOT NULL REFERENCES volumes(volume_id) ON DELETE CASCADE,
    folder_id INTEGER REFERENCES folders(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    path TEXT NOT NULL,
    path_hash BLOB NOT NULL, -- BYTEA as BLOB in SQLite
    size_bytes INTEGER NOT NULL DEFAULT 0,
    mtime TEXT NOT NULL, -- ISO8601 datetime string
    ctime TEXT NOT NULL, -- ISO8601 datetime string
    inode INTEGER,
    uid INTEGER,
    gid INTEGER,
    extension TEXT,
    mime TEXT,
    media_kind TEXT,
    is_symlink INTEGER DEFAULT 0 CHECK (is_symlink IN (0, 1)), -- BOOLEAN as INTEGER in SQLite
    -- Media metadata columns
    duration INTEGER, -- seconds for audio/video
    width INTEGER, -- image/video width
    height INTEGER, -- image/video height
    bitrate INTEGER, -- audio/video bitrate
    fps REAL, -- video frame rate (DECIMAL as REAL)
    codec_video TEXT, -- video codec
    codec_audio TEXT, -- audio codec
    channels INTEGER, -- audio channels
    sample_rate INTEGER, -- audio sample rate
    bit_depth INTEGER, -- audio bit depth
    color_space TEXT, -- image/video color space
    orientation INTEGER, -- EXIF orientation
    camera_make TEXT, -- camera manufacturer
    camera_model TEXT, -- camera model
    lens_model TEXT, -- lens information
    focal_length REAL, -- focal length in mm
    aperture REAL, -- f-stop
    shutter_speed TEXT, -- shutter speed
    iso INTEGER, -- ISO setting
    flash INTEGER CHECK (flash IN (0, 1)), -- flash used (BOOLEAN as INTEGER)
    gps_latitude REAL, -- GPS latitude
    gps_longitude REAL, -- GPS longitude
    gps_altitude REAL, -- GPS altitude
    date_taken TEXT, -- ISO8601 datetime string - when photo/video was taken
    artist TEXT, -- audio artist
    album TEXT, -- audio album
    title TEXT, -- media title
    genre TEXT, -- media genre
    year INTEGER, -- release/creation year
    track_number INTEGER, -- audio track number
    created_at TEXT DEFAULT (datetime('now')), -- ISO8601 datetime string
    updated_at TEXT DEFAULT (datetime('now')), -- ISO8601 datetime string
    UNIQUE(volume_id, path_hash)
);

-- Rich metadata storage for files (JSON format)
CREATE TABLE file_metadata (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    file_id INTEGER NOT NULL REFERENCES files(id) ON DELETE CASCADE,
    raw_metadata TEXT NOT NULL DEFAULT '{}', -- JSON stored as TEXT in SQLite
    extracted_at TEXT DEFAULT (datetime('now')), -- ISO8601 datetime string
    extractor_version TEXT,
    extraction_duration_ms INTEGER,
    error_message TEXT,
    UNIQUE(file_id)
);

-- =============================================================================
-- STATISTICS AND ANALYTICS TABLES
-- =============================================================================

-- Daily aggregated statistics
CREATE TABLE stats_daily (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    volume_id TEXT NOT NULL REFERENCES volumes(volume_id) ON DELETE CASCADE,
    stat_date TEXT NOT NULL, -- ISO8601 date string
    total_bytes INTEGER NOT NULL DEFAULT 0,
    files_count INTEGER NOT NULL DEFAULT 0,
    folders_count INTEGER NOT NULL DEFAULT 0,
    added_bytes INTEGER NOT NULL DEFAULT 0,
    removed_bytes INTEGER NOT NULL DEFAULT 0,
    added_files INTEGER NOT NULL DEFAULT 0,
    removed_files INTEGER NOT NULL DEFAULT 0,
    media_kinds TEXT DEFAULT '{}', -- JSON stored as TEXT in SQLite
    largest_files TEXT DEFAULT '[]', -- JSON array as TEXT
    growth_rate_7d REAL,
    growth_rate_30d REAL,
    bytes_change_7d INTEGER,
    bytes_change_30d INTEGER,
    files_change_7d INTEGER,
    files_change_30d INTEGER,
    created_at TEXT DEFAULT (datetime('now')), -- ISO8601 datetime string
    UNIQUE(volume_id, stat_date)
);

-- Background statistics computation jobs
CREATE TABLE stats_jobs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    job_id TEXT NOT NULL UNIQUE,
    job_type TEXT NOT NULL, -- 'daily_stats', 'weekly_rollup', etc.
    volume_id TEXT REFERENCES volumes(volume_id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending',
    started_at TEXT, -- ISO8601 datetime string
    completed_at TEXT, -- ISO8601 datetime string
    processing_duration_ms INTEGER,
    processed_items INTEGER DEFAULT 0,
    error_message TEXT,
    created_at TEXT DEFAULT (datetime('now')) -- ISO8601 datetime string
);

-- =============================================================================
-- ALERTS SYSTEM
-- =============================================================================

-- Alert rule definitions
CREATE TABLE alert_rules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    condition_type TEXT NOT NULL, -- 'size_threshold', 'growth_rate', etc.
    condition_config TEXT NOT NULL DEFAULT '{}', -- JSON stored as TEXT
    severity TEXT NOT NULL DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    volume_filter TEXT, -- volume name pattern or null for all
    is_enabled INTEGER DEFAULT 1 CHECK (is_enabled IN (0, 1)), -- BOOLEAN as INTEGER
    last_triggered_at TEXT, -- ISO8601 datetime string
    created_at TEXT DEFAULT (datetime('now')), -- ISO8601 datetime string
    updated_at TEXT DEFAULT (datetime('now'))  -- ISO8601 datetime string
);

-- Alert destination configurations
CREATE TABLE alert_destinations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('email', 'webhook', 'slack', 'teams')),
    configuration TEXT NOT NULL DEFAULT '{}', -- JSON stored as TEXT
    is_enabled INTEGER DEFAULT 1 CHECK (is_enabled IN (0, 1)), -- BOOLEAN as INTEGER
    last_used_at TEXT, -- ISO8601 datetime string
    created_at TEXT DEFAULT (datetime('now')), -- ISO8601 datetime string
    updated_at TEXT DEFAULT (datetime('now'))  -- ISO8601 datetime string
);

-- Alert routing rules (which alerts go where)
CREATE TABLE alert_routes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    rule_id INTEGER NOT NULL REFERENCES alert_rules(id) ON DELETE CASCADE,
    destination_id INTEGER NOT NULL REFERENCES alert_destinations(id) ON DELETE CASCADE,
    severity_filter TEXT, -- JSON array of severities
    created_at TEXT DEFAULT (datetime('now')), -- ISO8601 datetime string
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
    context_data TEXT DEFAULT '{}', -- JSON stored as TEXT
    is_resolved INTEGER DEFAULT 0 CHECK (is_resolved IN (0, 1)), -- BOOLEAN as INTEGER
    resolved_at TEXT, -- ISO8601 datetime string
    created_at TEXT DEFAULT (datetime('now')) -- ISO8601 datetime string
);

-- Alert delivery tracking
CREATE TABLE alert_deliveries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    alert_id INTEGER NOT NULL REFERENCES alerts(id) ON DELETE CASCADE,
    destination_id INTEGER NOT NULL REFERENCES alert_destinations(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'retrying')),
    attempt_count INTEGER DEFAULT 0,
    last_attempt_at TEXT, -- ISO8601 datetime string
    delivered_at TEXT, -- ISO8601 datetime string
    error_message TEXT,
    response_data TEXT DEFAULT '{}', -- JSON stored as TEXT
    created_at TEXT DEFAULT (datetime('now')) -- ISO8601 datetime string
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
    preview_type TEXT NOT NULL, -- 'thumbnail', 'poster', 'waveform'
    file_path TEXT NOT NULL,
    file_size INTEGER,
    width INTEGER,
    height INTEGER,
    format TEXT, -- 'jpg', 'png', 'webp'
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'skipped')),
    generated_at TEXT, -- ISO8601 datetime string
    error_message TEXT,
    processing_duration_ms INTEGER,
    created_at TEXT DEFAULT (datetime('now')), -- ISO8601 datetime string
    UNIQUE(file_id, preview_type)
);

-- =============================================================================
-- DOCKER MOUNT CATALOG
-- =============================================================================

-- Docker Compose project tracking
CREATE TABLE docker_projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_name TEXT NOT NULL,
    compose_file_path TEXT,
    compose_file_hash TEXT,
    working_directory TEXT,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'stopped', 'removed')),
    discovered_at TEXT DEFAULT (datetime('now')), -- ISO8601 datetime string
    last_seen_at TEXT DEFAULT (datetime('now')), -- ISO8601 datetime string
    labels TEXT DEFAULT '{}' -- JSON stored as TEXT
);

-- Enhanced mount tracking with Docker context
CREATE TABLE mount_catalog (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    volume_id TEXT NOT NULL REFERENCES volumes(volume_id) ON DELETE CASCADE,
    container_id TEXT REFERENCES containers(container_id) ON DELETE CASCADE,
    project_id INTEGER REFERENCES docker_projects(id) ON DELETE SET NULL,
    service_name TEXT, -- Docker Compose service name
    mount_source TEXT NOT NULL, -- host path or volume name
    mount_target TEXT NOT NULL, -- container path
    mount_type TEXT NOT NULL CHECK (mount_type IN ('bind', 'volume', 'tmpfs')),
    mount_options TEXT, -- Stored as comma-separated values
    is_active INTEGER DEFAULT 1 CHECK (is_active IN (0, 1)), -- BOOLEAN as INTEGER
    discovered_at TEXT DEFAULT (datetime('now')), -- ISO8601 datetime string
    last_verified_at TEXT DEFAULT (datetime('now')) -- ISO8601 datetime string
);

-- =============================================================================
-- TRACKING RULES ENGINE
-- =============================================================================

-- Rule templates for common use cases
CREATE TABLE tracking_rule_templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    category TEXT, -- 'media', 'logs', 'databases', etc.
    rule_config TEXT NOT NULL DEFAULT '{}', -- JSON stored as TEXT
    is_builtin INTEGER DEFAULT 0 CHECK (is_builtin IN (0, 1)), -- BOOLEAN as INTEGER
    usage_count INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')) -- ISO8601 datetime string
);

-- Volume inclusion/exclusion rules
CREATE TABLE tracking_rules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    template_id INTEGER REFERENCES tracking_rule_templates(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    description TEXT,
    rule_type TEXT NOT NULL CHECK (rule_type IN ('include', 'exclude')),
    conditions TEXT NOT NULL DEFAULT '{}', -- JSON stored as TEXT
    priority INTEGER DEFAULT 100, -- lower numbers = higher priority
    is_enabled INTEGER DEFAULT 1 CHECK (is_enabled IN (0, 1)), -- BOOLEAN as INTEGER
    evaluation_count INTEGER DEFAULT 0,
    match_count INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')), -- ISO8601 datetime string
    updated_at TEXT DEFAULT (datetime('now'))  -- ISO8601 datetime string
);

-- Rule evaluation history
CREATE TABLE tracking_rule_evaluations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    rule_id INTEGER NOT NULL REFERENCES tracking_rules(id) ON DELETE CASCADE,
    volume_id TEXT NOT NULL REFERENCES volumes(volume_id) ON DELETE CASCADE,
    matched INTEGER NOT NULL CHECK (matched IN (0, 1)), -- BOOLEAN as INTEGER
    evaluation_context TEXT DEFAULT '{}', -- JSON stored as TEXT
    evaluated_at TEXT DEFAULT (datetime('now')) -- ISO8601 datetime string
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
    current_item TEXT, -- what we're currently processing
    started_at TEXT, -- ISO8601 datetime string
    completed_at TEXT, -- ISO8601 datetime string
    duration_ms INTEGER,
    throughput_items_per_sec REAL,
    memory_usage_mb INTEGER,
    error_message TEXT,
    pause_reason TEXT, -- why was it paused
    created_at TEXT DEFAULT (datetime('now')), -- ISO8601 datetime string
    updated_at TEXT DEFAULT (datetime('now'))  -- ISO8601 datetime string
);

-- Individual scan step tracking within phases
CREATE TABLE scan_phase_steps (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    phase_id INTEGER NOT NULL REFERENCES scan_phases(id) ON DELETE CASCADE,
    step_name TEXT NOT NULL,
    step_order INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'completed', 'failed', 'cancelled', 'paused')),
    progress_percent INTEGER DEFAULT 0,
    started_at TEXT, -- ISO8601 datetime string
    completed_at TEXT, -- ISO8601 datetime string
    duration_ms INTEGER,
    result_data TEXT DEFAULT '{}', -- JSON stored as TEXT
    error_message TEXT,
    created_at TEXT DEFAULT (datetime('now')) -- ISO8601 datetime string
);

-- Scan performance metrics
CREATE TABLE scan_performance_metrics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    scan_id TEXT NOT NULL REFERENCES scan_jobs(scan_id) ON DELETE CASCADE,
    metric_name TEXT NOT NULL, -- 'files_per_second', 'memory_peak_mb', etc.
    metric_value REAL NOT NULL,
    metric_unit TEXT, -- 'files/sec', 'MB', 'ms', etc.
    measured_at TEXT DEFAULT (datetime('now')), -- ISO8601 datetime string
    phase TEXT -- which phase this metric relates to
);

-- =============================================================================
-- USAGE SNAPSHOTS - Time-series data
-- =============================================================================

CREATE TABLE usage_snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    volume_id TEXT NOT NULL REFERENCES volumes(volume_id) ON DELETE CASCADE,
    snapshot_date TEXT NOT NULL, -- ISO8601 date string
    total_size_bytes INTEGER NOT NULL DEFAULT 0,
    total_files INTEGER NOT NULL DEFAULT 0,
    total_directories INTEGER NOT NULL DEFAULT 0,
    size_change_bytes INTEGER DEFAULT 0, -- vs previous snapshot
    files_change INTEGER DEFAULT 0, -- vs previous snapshot
    growth_rate REAL, -- percentage growth
    largest_file_size INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')), -- ISO8601 datetime string
    UNIQUE(volume_id, snapshot_date)
);

-- =============================================================================
-- INDEXES FOR PERFORMANCE
-- =============================================================================

-- Core table indexes
CREATE INDEX idx_volumes_volume_id ON volumes(volume_id);
CREATE INDEX idx_volumes_name ON volumes(name);
CREATE INDEX idx_volumes_last_scanned ON volumes(last_scanned);
CREATE INDEX idx_volumes_status_active ON volumes(status, is_active) WHERE is_active = 1;
CREATE INDEX idx_volumes_created_at ON volumes(created_at);

CREATE INDEX idx_volume_sizes_volume_id ON volume_sizes(volume_id);
CREATE INDEX idx_volume_sizes_created_at ON volume_sizes(created_at);
CREATE INDEX idx_volume_sizes_total_size ON volume_sizes(total_size);
CREATE INDEX idx_volume_sizes_filesystem_usage ON volume_sizes(filesystem_usage_percent) WHERE filesystem_usage_percent IS NOT NULL;

CREATE INDEX idx_containers_container_id ON containers(container_id);
CREATE INDEX idx_containers_name ON containers(name);
CREATE INDEX idx_containers_state ON containers(state);
CREATE INDEX idx_containers_image ON containers(image);
CREATE INDEX idx_containers_active_state ON containers(is_active, state) WHERE is_active = 1;

CREATE INDEX idx_volume_mounts_volume_id ON volume_mounts(volume_id);
CREATE INDEX idx_volume_mounts_container_id ON volume_mounts(container_id);
CREATE INDEX idx_volume_mounts_active ON volume_mounts(is_active) WHERE is_active = 1;

CREATE INDEX idx_scan_jobs_scan_id ON scan_jobs(scan_id);
CREATE INDEX idx_scan_jobs_volume_id ON scan_jobs(volume_id);
CREATE INDEX idx_scan_jobs_status ON scan_jobs(status);
CREATE INDEX idx_scan_jobs_created_at ON scan_jobs(created_at);
CREATE INDEX idx_scan_jobs_pending ON scan_jobs(status) WHERE status IN ('queued', 'running');

-- Filesystem indexing
CREATE UNIQUE INDEX idx_folders_volume_path ON folders(volume_id, path);
CREATE INDEX idx_folders_parent_id ON folders(parent_id);
CREATE INDEX idx_folders_volume_id ON folders(volume_id);
CREATE INDEX idx_folders_path_hash ON folders(path_hash);
CREATE INDEX idx_folders_size_recursive ON folders(size_bytes_recursive DESC);

CREATE UNIQUE INDEX idx_files_volume_path_hash ON files(volume_id, path_hash);
CREATE INDEX idx_files_folder_id ON files(folder_id);
CREATE INDEX idx_files_volume_id ON files(volume_id);
CREATE INDEX idx_files_extension ON files(extension) WHERE extension IS NOT NULL;
CREATE INDEX idx_files_mime ON files(mime) WHERE mime IS NOT NULL;
CREATE INDEX idx_files_media_kind ON files(media_kind) WHERE media_kind IS NOT NULL;
CREATE INDEX idx_files_size_bytes ON files(size_bytes DESC);
CREATE INDEX idx_files_mtime ON files(mtime);

-- Media-specific indexes
CREATE INDEX idx_files_unenriched ON files(volume_id, created_at) 
    WHERE (duration IS NULL AND mime LIKE 'video/%') 
       OR (width IS NULL AND mime LIKE 'image/%')
       OR (artist IS NULL AND mime LIKE 'audio/%');

CREATE INDEX idx_files_media_dimensions ON files(width, height) 
    WHERE width IS NOT NULL AND height IS NOT NULL;

CREATE INDEX idx_files_media_duration ON files(duration) 
    WHERE duration IS NOT NULL;

CREATE INDEX idx_files_gps_coords ON files(gps_latitude, gps_longitude) 
    WHERE gps_latitude IS NOT NULL AND gps_longitude IS NOT NULL;

CREATE INDEX idx_files_date_taken ON files(date_taken) 
    WHERE date_taken IS NOT NULL;

-- File metadata indexes
CREATE UNIQUE INDEX idx_file_metadata_file_id ON file_metadata(file_id);
CREATE INDEX idx_file_metadata_extracted_at ON file_metadata(extracted_at);

-- Statistics indexes
CREATE UNIQUE INDEX idx_stats_daily_volume_date ON stats_daily(volume_id, stat_date);
CREATE INDEX idx_stats_daily_stat_date ON stats_daily(stat_date);
CREATE INDEX idx_stats_daily_total_bytes ON stats_daily(total_bytes DESC);
CREATE INDEX idx_stats_daily_growth_rate_7d ON stats_daily(growth_rate_7d) WHERE growth_rate_7d IS NOT NULL;

-- Alerts system indexes
CREATE INDEX idx_alert_rules_enabled ON alert_rules(is_enabled) WHERE is_enabled = 1;
CREATE INDEX idx_alerts_rule_id ON alerts(rule_id);
CREATE INDEX idx_alerts_volume_id ON alerts(volume_id);
CREATE INDEX idx_alerts_created_at ON alerts(created_at);
CREATE INDEX idx_alerts_unresolved ON alerts(is_resolved, created_at) WHERE is_resolved = 0;
CREATE INDEX idx_alert_deliveries_status ON alert_deliveries(status, created_at);

-- Preview system indexes
CREATE UNIQUE INDEX idx_file_previews_file_type ON file_previews(file_id, preview_type);
CREATE INDEX idx_file_previews_status ON file_previews(status);
CREATE INDEX idx_file_previews_pending ON file_previews(created_at) WHERE status = 'pending';

-- Docker catalog indexes
CREATE INDEX idx_docker_projects_name ON docker_projects(project_name);
CREATE INDEX idx_docker_projects_status ON docker_projects(status);
CREATE INDEX idx_mount_catalog_volume_id ON mount_catalog(volume_id);
CREATE INDEX idx_mount_catalog_container_id ON mount_catalog(container_id);
CREATE INDEX idx_mount_catalog_project_id ON mount_catalog(project_id);
CREATE INDEX idx_mount_catalog_active ON mount_catalog(is_active) WHERE is_active = 1;

-- Tracking rules indexes
CREATE INDEX idx_tracking_rules_enabled ON tracking_rules(is_enabled, priority) WHERE is_enabled = 1;
CREATE INDEX idx_tracking_rule_evaluations_volume ON tracking_rule_evaluations(volume_id, evaluated_at);

-- Scan progress indexes
CREATE INDEX idx_scan_phases_scan_id ON scan_phases(scan_id);
CREATE INDEX idx_scan_phases_status ON scan_phases(status, updated_at);
CREATE INDEX idx_scan_phase_steps_phase_id ON scan_phase_steps(phase_id, step_order);
CREATE INDEX idx_scan_performance_metrics_scan_id ON scan_performance_metrics(scan_id, measured_at);

-- Usage snapshots indexes
CREATE UNIQUE INDEX idx_usage_snapshots_volume_date ON usage_snapshots(volume_id, snapshot_date);
CREATE INDEX idx_usage_snapshots_date ON usage_snapshots(snapshot_date);
CREATE INDEX idx_usage_snapshots_growth ON usage_snapshots(growth_rate) WHERE growth_rate IS NOT NULL;

-- Volume metrics indexes
CREATE INDEX idx_volume_metrics_volume_id ON volume_metrics(volume_id);
CREATE INDEX idx_volume_metrics_timestamp ON volume_metrics(metric_timestamp);
CREATE UNIQUE INDEX idx_volume_metrics_volume_timestamp ON volume_metrics(volume_id, metric_timestamp);

-- Saved searches indexes
CREATE INDEX idx_saved_searches_name ON saved_searches(name);
CREATE INDEX idx_saved_searches_is_public ON saved_searches(is_public);
CREATE INDEX idx_saved_searches_updated_at ON saved_searches(updated_at DESC);
CREATE INDEX idx_saved_searches_last_run_at ON saved_searches(last_run_at DESC) WHERE last_run_at IS NOT NULL;

-- =============================================================================
-- VIEWS FOR PERFORMANCE (SQLite doesn't support materialized views)
-- =============================================================================

-- Volume summary with latest statistics
CREATE VIEW volume_summary AS
SELECT 
    v.volume_id,
    v.name,
    v.mountpoint,
    v.status,
    v.last_scanned,
    vs.total_size,
    vs.file_count,
    vs.directory_count,
    vs.filesystem_usage_percent,
    sd.growth_rate_7d,
    sd.growth_rate_30d,
    COUNT(DISTINCT vm.container_id) as mounted_containers,
    MAX(vm.created_at) as last_mount_activity
FROM volumes v
LEFT JOIN volume_sizes vs ON vs.volume_id = v.volume_id 
    AND vs.created_at = (SELECT MAX(created_at) FROM volume_sizes WHERE volume_id = v.volume_id)
LEFT JOIN stats_daily sd ON sd.volume_id = v.volume_id 
    AND sd.stat_date = (SELECT MAX(stat_date) FROM stats_daily WHERE volume_id = v.volume_id)
LEFT JOIN volume_mounts vm ON vm.volume_id = v.volume_id AND vm.is_active = 1
GROUP BY v.volume_id, v.name, v.mountpoint, v.status, v.last_scanned, 
         vs.total_size, vs.file_count, vs.directory_count, vs.filesystem_usage_percent,
         sd.growth_rate_7d, sd.growth_rate_30d;

-- Media enrichment queue view
CREATE VIEW unenriched_media_files AS
SELECT 
    f.id,
    f.volume_id,
    f.path,
    f.mime,
    f.media_kind,
    f.size_bytes,
    f.created_at
FROM files f
WHERE (
    (f.mime LIKE 'video/%' AND f.duration IS NULL) OR
    (f.mime LIKE 'image/%' AND f.width IS NULL) OR
    (f.mime LIKE 'audio/%' AND f.artist IS NULL)
)
AND f.size_bytes > 0
ORDER BY f.created_at DESC;

-- =============================================================================
-- TRIGGERS FOR AUTOMATIC UPDATES
-- =============================================================================

-- Trigger to update folder statistics when files change
CREATE TRIGGER trigger_update_folder_stats_insert
    AFTER INSERT ON files
    FOR EACH ROW
BEGIN
    -- Update parent folder file count and total size
    UPDATE folders SET
        file_count = file_count + 1,
        size_bytes_recursive = size_bytes_recursive + NEW.size_bytes,
        updated_at = datetime('now')
    WHERE id = NEW.folder_id;
END;

CREATE TRIGGER trigger_update_folder_stats_update
    AFTER UPDATE OF size_bytes, folder_id ON files
    FOR EACH ROW
    WHEN OLD.size_bytes != NEW.size_bytes OR OLD.folder_id != NEW.folder_id
BEGIN
    -- Update old parent folder if folder changed
    UPDATE folders SET
        file_count = file_count - 1,
        size_bytes_recursive = size_bytes_recursive - OLD.size_bytes,
        updated_at = datetime('now')
    WHERE id = OLD.folder_id AND OLD.folder_id != NEW.folder_id;
    
    -- Update new parent folder
    UPDATE folders SET
        file_count = CASE WHEN OLD.folder_id = NEW.folder_id THEN file_count ELSE file_count + 1 END,
        size_bytes_recursive = size_bytes_recursive - OLD.size_bytes + NEW.size_bytes,
        updated_at = datetime('now')
    WHERE id = NEW.folder_id;
END;

CREATE TRIGGER trigger_update_folder_stats_delete
    AFTER DELETE ON files
    FOR EACH ROW
BEGIN
    -- Update parent folder file count and total size
    UPDATE folders SET
        file_count = file_count - 1,
        size_bytes_recursive = size_bytes_recursive - OLD.size_bytes,
        updated_at = datetime('now')
    WHERE id = OLD.folder_id;
END;

-- =============================================================================
-- FINAL VALIDATION
-- =============================================================================

-- Verify all tables were created
SELECT 'Database schema created successfully. Tables: ' || COUNT(*) as result 
FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';