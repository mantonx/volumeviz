-- =============================================================================
-- VolumeViz Initial Schema
-- Complete database schema for VolumeViz application
-- =============================================================================

-- =============================================================================
-- CORE TYPES AND ENUMS
-- =============================================================================

-- Mount types enumeration
CREATE TYPE mount_type AS ENUM ('volume', 'bind', 'tmpfs');

-- Mount access modes enumeration  
CREATE TYPE mount_access_mode AS ENUM ('rw', 'ro');

-- Rule action enumeration
CREATE TYPE rule_action AS ENUM ('include', 'exclude');

-- Rule condition operator enumeration  
CREATE TYPE rule_operator AS ENUM (
    'equals',           -- Exact match
    'not_equals',       -- Not equal
    'regex',           -- Regular expression
    'not_regex',       -- Negative regex
    'prefix',          -- String prefix
    'suffix',          -- String suffix
    'contains',        -- String contains
    'not_contains',    -- String does not contain
    'glob',            -- Glob pattern
    'in',              -- Value in list
    'not_in'           -- Value not in list
);

-- Rule evaluation status
CREATE TYPE rule_evaluation_status AS ENUM ('pending', 'success', 'error', 'skipped');

-- =============================================================================
-- CORE SCHEMA (Migrations 001, 002, 004)
-- =============================================================================

-- Main volumes table (equivalent to "mounts" in Docker)
CREATE TABLE volumes (
    volume_id TEXT PRIMARY KEY, -- Docker volume name or path
    display_name TEXT,
    mount_point TEXT NOT NULL,
    container_names TEXT[], -- Array of container names using this volume
    is_active BOOLEAN DEFAULT TRUE,
    
    -- Attributes from filesystem
    total_size_bytes BIGINT DEFAULT 0,
    used_size_bytes BIGINT DEFAULT 0,
    free_size_bytes BIGINT DEFAULT 0,
    filesystem_type TEXT,
    
    -- Container references  
    container_count INTEGER DEFAULT 0,
    
    -- Timestamps
    first_seen_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_scan_at TIMESTAMPTZ,
    last_modified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Current volume sizes/stats  
CREATE TABLE volume_sizes (
    id BIGSERIAL PRIMARY KEY,
    volume_id TEXT NOT NULL REFERENCES volumes(volume_id) ON DELETE CASCADE,
    total_size BIGINT NOT NULL DEFAULT 0,
    file_count BIGINT NOT NULL DEFAULT 0,
    directory_count BIGINT NOT NULL DEFAULT 0,
    largest_file_size BIGINT DEFAULT 0,
    smallest_file_size BIGINT DEFAULT 0,
    average_file_size BIGINT DEFAULT 0,
    median_file_size BIGINT DEFAULT 0,
    
    -- Type distribution
    type_distribution JSONB DEFAULT '{}',
    extension_distribution JSONB DEFAULT '{}',
    
    calculated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(volume_id)
);

-- Folder hierarchy
CREATE TABLE folders (
    id BIGSERIAL PRIMARY KEY,
    volume_id TEXT NOT NULL REFERENCES volumes(volume_id) ON DELETE CASCADE,
    parent_id BIGINT REFERENCES folders(id) ON DELETE CASCADE,
    path TEXT NOT NULL,
    name TEXT NOT NULL,
    path_hash TEXT NOT NULL, -- Hash of path for faster lookups
    
    -- Size info
    size_bytes BIGINT DEFAULT 0,
    size_bytes_recursive BIGINT DEFAULT 0,
    
    -- Statistics
    file_count INTEGER DEFAULT 0,
    file_count_recursive INTEGER DEFAULT 0,
    subfolder_count INTEGER DEFAULT 0,
    
    -- Media info
    media_file_count INTEGER DEFAULT 0,
    has_media_files BOOLEAN DEFAULT FALSE,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    modified_at TIMESTAMPTZ,
    accessed_at TIMESTAMPTZ,
    
    -- Add unique constraint on volume+path combination
    UNIQUE(volume_id, path),
    UNIQUE(path_hash)
);

-- Individual files
CREATE TABLE files (
    id BIGSERIAL PRIMARY KEY,
    volume_id TEXT NOT NULL REFERENCES volumes(volume_id) ON DELETE CASCADE,
    folder_id BIGINT REFERENCES folders(id) ON DELETE CASCADE,
    path TEXT NOT NULL,
    path_hash TEXT NOT NULL, -- SHA256 hash of path for deduplication
    name TEXT NOT NULL,
    extension TEXT,
    mime TEXT,
    size_bytes BIGINT NOT NULL DEFAULT 0,
    
    -- File system metadata
    created_at TIMESTAMPTZ,
    modified_at TIMESTAMPTZ,
    accessed_at TIMESTAMPTZ,
    mode INTEGER, -- Unix file permissions
    owner_uid INTEGER,
    owner_gid INTEGER,
    
    -- Content metadata
    content_hash TEXT, -- SHA256 hash of file content
    is_text BOOLEAN DEFAULT FALSE,
    is_binary BOOLEAN DEFAULT TRUE,
    
    -- Media metadata (flattened from file_metadata)
    media_kind TEXT, -- 'video', 'audio', 'image', 'document', etc.
    duration_ms BIGINT, -- for video/audio
    bitrate_kbps INTEGER, -- for video/audio
    width INTEGER, -- for video/image
    height INTEGER, -- for video/image  
    fps NUMERIC(10,2), -- for video
    color_primaries TEXT, -- for video
    transfer_characteristic TEXT, -- for video
    hdr_format TEXT, -- 'SDR', 'HDR10', 'HLG', 'DolbyVision'
    
    -- Image/photo metadata
    capture_datetime TIMESTAMPTZ,
    camera_make TEXT,
    camera_model TEXT,
    lens_model TEXT,
    orientation INTEGER,
    gps_latitude NUMERIC(10,7),
    gps_longitude NUMERIC(11,7),
    
    -- Subtitle metadata
    subtitle_language TEXT,
    subtitle_format TEXT,
    cue_count INTEGER,
    coverage_percent NUMERIC(5,2),
    
    -- Audio/video codec info
    audio_channels INTEGER,
    audio_codec TEXT,
    audio_sample_rate INTEGER,
    video_codec TEXT,
    video_profile TEXT,
    video_level TEXT,
    
    -- Tracking
    first_seen_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    last_scan_at TIMESTAMPTZ,
    
    -- Add unique constraint on path_hash
    UNIQUE(path_hash)
);

-- Scan job tracking
CREATE TABLE scan_jobs (
    scan_id TEXT PRIMARY KEY,
    volume_id TEXT REFERENCES volumes(volume_id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled', 'paused')),
    
    -- Progress tracking
    total_files BIGINT DEFAULT 0,
    scanned_files BIGINT DEFAULT 0,
    failed_files BIGINT DEFAULT 0,
    total_bytes BIGINT DEFAULT 0,
    scanned_bytes BIGINT DEFAULT 0,
    
    -- Performance metrics
    scan_rate_files_per_sec DECIMAL(10,2),
    scan_rate_mb_per_sec DECIMAL(10,2),
    
    -- Error tracking
    error_message TEXT,
    error_details JSONB DEFAULT '{}',
    
    -- Timing
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    paused_at TIMESTAMPTZ, -- migration 016
    pause_reason TEXT, -- migration 016
    duration_seconds INTEGER,
    
    -- Additional context
    triggered_by TEXT, -- 'manual', 'scheduled', 'watcher', etc.
    scan_options JSONB DEFAULT '{}',
    
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- DOCKER MOUNT CATALOG WITH ATTACHMENTS (Migration 011) - RESTORED
-- =============================================================================

-- Docker mount catalog table
-- Canonical source of truth for all Docker mounts discovered from Engine
CREATE TABLE docker_mount_catalog (
    id BIGSERIAL PRIMARY KEY,
    
    -- Mount identification
    mount_id TEXT NOT NULL, -- Unique identifier for the mount
    mount_type mount_type NOT NULL,
    
    -- Volume-specific fields (for mount_type = 'volume')
    volume_name TEXT, -- Docker volume name (null for bind/tmpfs)
    volume_driver TEXT, -- Volume driver (local, nfs, etc.)
    volume_options JSONB DEFAULT '{}', -- Volume driver options
    volume_labels JSONB DEFAULT '{}', -- Volume labels
    volume_scope TEXT, -- Volume scope (local, global)
    
    -- Mount path information
    source_path TEXT NOT NULL, -- Source path (volume name, host path, or tmpfs)
    
    -- Container attachment information
    container_count INTEGER NOT NULL DEFAULT 0, -- Number of containers using this mount
    is_orphaned BOOLEAN NOT NULL DEFAULT false, -- True if volume exists but no containers use it
    
    -- Compose metadata (enriched from container labels)
    compose_project TEXT, -- com.docker.compose.project
    compose_services TEXT[], -- Array of services using this mount
    compose_version TEXT, -- com.docker.compose.version
    compose_config_files TEXT[], -- Array of compose files (from container labels)
    
    -- Discovery metadata
    first_discovered_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    discovery_source TEXT NOT NULL DEFAULT 'docker_engine', -- How this mount was discovered
    
    -- Tracking status
    is_tracked BOOLEAN NOT NULL DEFAULT false, -- Whether this mount is currently being tracked
    tracking_enabled_at TIMESTAMPTZ, -- When tracking was enabled
    tracking_disabled_at TIMESTAMPTZ, -- When tracking was disabled
    
    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT unique_mount_id UNIQUE (mount_id)
);

-- Docker mount attachments table - RESTORED
-- Tracks which containers have which mounts attached
CREATE TABLE docker_mount_attachments (
    id BIGSERIAL PRIMARY KEY,
    
    -- References
    mount_catalog_id BIGINT NOT NULL REFERENCES docker_mount_catalog(id) ON DELETE CASCADE,
    container_id TEXT NOT NULL, -- Docker container ID
    container_name TEXT, -- Container name for easier debugging
    
    -- Mount details within container
    destination_path TEXT NOT NULL, -- Where the mount is attached in container
    access_mode mount_access_mode NOT NULL DEFAULT 'rw',
    
    -- Propagation settings (bind mounts only)
    propagation TEXT, -- rprivate, private, rshared, shared, rslave, slave
    
    -- Container metadata
    container_state TEXT, -- running, stopped, etc.
    container_image TEXT, -- Image name
    container_labels JSONB DEFAULT '{}', -- All container labels
    
    -- Compose metadata from this specific container
    container_compose_project TEXT, -- com.docker.compose.project
    container_compose_service TEXT, -- com.docker.compose.service
    container_compose_container_number INTEGER, -- com.docker.compose.container-number
    container_compose_config_hash TEXT, -- com.docker.compose.config-hash
    
    -- Discovery
    attached_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    detached_at TIMESTAMPTZ, -- When attachment was removed (null if still attached)
    is_active BOOLEAN NOT NULL DEFAULT true, -- Whether attachment is currently active
    
    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT unique_active_attachment UNIQUE (mount_catalog_id, container_id, destination_path) 
        DEFERRABLE INITIALLY DEFERRED
);

-- Docker mount statistics table
CREATE TABLE docker_mount_statistics (
    id BIGSERIAL PRIMARY KEY,
    mount_catalog_id BIGINT NOT NULL REFERENCES docker_mount_catalog(id) ON DELETE CASCADE,
    
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
    
    -- Size information (from volume scans)
    last_known_size_bytes BIGINT,
    last_scanned_at TIMESTAMPTZ,
    
    -- Metadata
    calculated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Docker Compose project tracking
CREATE TABLE docker_projects (
    id BIGSERIAL PRIMARY KEY,
    project_name TEXT NOT NULL,
    compose_file_path TEXT,
    compose_file_hash TEXT,
    working_directory TEXT,
    services TEXT[], -- Array of service names
    networks TEXT[], -- Array of network names
    volumes TEXT[], -- Array of volume names
    config_data JSONB DEFAULT '{}', -- Full compose config
    last_seen_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(project_name)
);

-- =============================================================================
-- TRACKING RULES ENGINE WITH ASSIGNMENTS (Migration 012) - RESTORED
-- =============================================================================

-- Tracking rules table - ordered rule definitions
CREATE TABLE tracking_rules (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    action rule_action NOT NULL,
    priority INTEGER NOT NULL DEFAULT 1000, -- Lower numbers = higher priority
    is_enabled BOOLEAN NOT NULL DEFAULT true,
    
    -- Rule conditions (JSON array of condition objects)
    conditions JSONB NOT NULL DEFAULT '[]'::jsonb,
    
    -- Statistics and metadata
    match_count INTEGER NOT NULL DEFAULT 0,
    last_matched_at TIMESTAMPTZ,
    last_evaluation_at TIMESTAMPTZ,
    
    -- Audit fields
    created_by TEXT DEFAULT 'system',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Rule evaluation history - tracks when rules are evaluated
CREATE TABLE tracking_rule_evaluations (
    id BIGSERIAL PRIMARY KEY,
    rule_id BIGINT REFERENCES tracking_rules(id) ON DELETE CASCADE,
    
    -- Evaluation context
    evaluation_type TEXT NOT NULL, -- 'manual', 'scheduled', 'mount_discovery', 'api_request'
    triggered_by TEXT, -- User ID or system component
    
    -- Results
    status rule_evaluation_status NOT NULL,
    mounts_evaluated INTEGER NOT NULL DEFAULT 0,
    mounts_matched INTEGER NOT NULL DEFAULT 0,
    mounts_included INTEGER NOT NULL DEFAULT 0,
    mounts_excluded INTEGER NOT NULL DEFAULT 0,
    
    -- Performance metrics
    execution_time_ms INTEGER,
    
    -- Error information
    error_message TEXT,
    error_details JSONB,
    
    -- Timestamps
    started_at TIMESTAMPTZ NOT NULL,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Mount tracking assignments - results of rule evaluation - RESTORED
CREATE TABLE mount_tracking_assignments (
    id BIGSERIAL PRIMARY KEY,
    mount_catalog_id BIGINT REFERENCES docker_mount_catalog(id) ON DELETE CASCADE,
    rule_id BIGINT REFERENCES tracking_rules(id) ON DELETE SET NULL,
    evaluation_id BIGINT REFERENCES tracking_rule_evaluations(id) ON DELETE SET NULL,
    
    -- Assignment details
    action rule_action NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    
    -- Rule match information
    matched_conditions JSONB, -- Which conditions matched
    rule_priority INTEGER,
    rule_name TEXT,
    
    -- Timestamps
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMPTZ, -- Optional expiration
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Rule conditions validation - stores validated condition schemas
CREATE TABLE tracking_rule_conditions (
    id BIGSERIAL PRIMARY KEY,
    rule_id BIGINT REFERENCES tracking_rules(id) ON DELETE CASCADE,
    
    -- Condition definition
    field_name TEXT NOT NULL, -- e.g., 'source_type', 'compose_project'
    operator rule_operator NOT NULL,
    value TEXT, -- Single value for most operators
    values TEXT[], -- Array values for 'in'/'not_in' operators
    
    -- Condition metadata
    is_case_sensitive BOOLEAN NOT NULL DEFAULT true,
    description TEXT,
    
    -- Evaluation statistics
    match_count INTEGER NOT NULL DEFAULT 0,
    last_matched_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Rule templates - predefined rule patterns
CREATE TABLE tracking_rule_templates (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    description TEXT NOT NULL,
    category TEXT NOT NULL, -- e.g., 'volume', 'compose', 'security'
    
    -- Template definition
    template_data JSONB NOT NULL,
    
    -- Usage statistics
    usage_count INTEGER NOT NULL DEFAULT 0,
    last_used_at TIMESTAMPTZ,
    
    -- Template metadata
    is_builtin BOOLEAN NOT NULL DEFAULT false,
    tags TEXT[],
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- MEDIA METADATA (Migration 005)
-- =============================================================================

-- File metadata storage (extracted media information)
CREATE TABLE file_metadata (
    id BIGSERIAL PRIMARY KEY,
    file_id BIGINT NOT NULL REFERENCES files(id) ON DELETE CASCADE,
    raw_metadata JSONB NOT NULL DEFAULT '{}', -- Full exiftool/ffprobe output
    extracted_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    extractor_version TEXT,
    extraction_duration_ms INTEGER,
    error_message TEXT,
    UNIQUE(file_id)
);

-- =============================================================================
-- DAILY STATS (Migration 006)
-- =============================================================================

-- Daily aggregated statistics
CREATE TABLE daily_stats (
    id BIGSERIAL PRIMARY KEY,
    volume_id TEXT NOT NULL REFERENCES volumes(volume_id) ON DELETE CASCADE,
    date DATE NOT NULL,
    
    -- Size metrics
    total_size_bytes BIGINT DEFAULT 0,
    size_change_bytes BIGINT DEFAULT 0, -- vs previous day
    growth_percent DECIMAL(8,4),
    
    -- File metrics
    total_files BIGINT DEFAULT 0,
    new_files BIGINT DEFAULT 0,
    deleted_files BIGINT DEFAULT 0,
    modified_files BIGINT DEFAULT 0,
    
    -- Type distribution
    media_files BIGINT DEFAULT 0,
    document_files BIGINT DEFAULT 0,
    code_files BIGINT DEFAULT 0,
    archive_files BIGINT DEFAULT 0,
    other_files BIGINT DEFAULT 0,
    
    -- Performance
    scan_duration_ms BIGINT,
    
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(volume_id, date)
);

-- =============================================================================
-- ALERT SYSTEM (Migration 007)
-- =============================================================================

-- Alert rule definitions
CREATE TABLE alert_rules (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    rule_type TEXT NOT NULL CHECK (rule_type IN ('threshold', 'growth_rate', 'anomaly', 'custom')),
    metric_name TEXT NOT NULL, -- 'volume_size', 'file_count', 'growth_rate', etc.
    condition_operator TEXT NOT NULL CHECK (condition_operator IN ('>', '<', '>=', '<=', '==', '!=')),
    threshold_value DECIMAL(20,4) NOT NULL,
    
    -- Additional parameters
    time_window_minutes INTEGER DEFAULT 60,
    min_occurrences INTEGER DEFAULT 1,
    
    -- Configuration
    is_enabled BOOLEAN DEFAULT TRUE,
    severity TEXT NOT NULL DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    cooldown_minutes INTEGER DEFAULT 60, -- min time between alerts
    
    -- Tracking
    last_triggered_at TIMESTAMPTZ,
    trigger_count INTEGER DEFAULT 0,
    
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Alert destination configurations
CREATE TABLE alert_destinations (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('email', 'webhook', 'slack', 'teams')),
    configuration JSONB NOT NULL DEFAULT '{}', -- email addr, webhook URL, etc.
    is_enabled BOOLEAN DEFAULT TRUE,
    last_used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Alert routing rules (which alerts go where)
CREATE TABLE alert_routes (
    id BIGSERIAL PRIMARY KEY,
    rule_id BIGINT NOT NULL REFERENCES alert_rules(id) ON DELETE CASCADE,
    destination_id BIGINT NOT NULL REFERENCES alert_destinations(id) ON DELETE CASCADE,
    severity_filter TEXT, -- JSON array of severities for SQLite compatibility
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(rule_id, destination_id)
);

-- Triggered alert instances
CREATE TABLE alerts (
    id BIGSERIAL PRIMARY KEY,
    rule_id BIGINT NOT NULL REFERENCES alert_rules(id) ON DELETE CASCADE,
    volume_id TEXT REFERENCES volumes(volume_id) ON DELETE CASCADE,
    severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    context_data JSONB DEFAULT '{}',
    is_resolved BOOLEAN DEFAULT FALSE,
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Alert delivery tracking
CREATE TABLE alert_deliveries (
    id BIGSERIAL PRIMARY KEY,
    alert_id BIGINT NOT NULL REFERENCES alerts(id) ON DELETE CASCADE,
    destination_id BIGINT NOT NULL REFERENCES alert_destinations(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'retrying')),
    attempt_count INTEGER DEFAULT 0,
    last_attempt_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    error_message TEXT,
    response_data JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- SEARCH SYSTEM (Migrations 008, 009)
-- =============================================================================

-- Saved search queries - complete functionality
CREATE TABLE saved_searches (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    query JSONB NOT NULL,
    tags TEXT[],
    is_public BOOLEAN DEFAULT false,
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_run_at TIMESTAMPTZ,
    run_count INTEGER DEFAULT 0,
    
    -- Constraints
    CONSTRAINT saved_searches_name_unique UNIQUE(name),
    CONSTRAINT saved_searches_name_not_empty CHECK(length(trim(name)) > 0)
);

-- =============================================================================
-- PREVIEW SYSTEM (Migration 010)
-- =============================================================================

-- File preview/thumbnail tracking
CREATE TABLE file_previews (
    id BIGSERIAL PRIMARY KEY,
    file_id BIGINT NOT NULL REFERENCES files(id) ON DELETE CASCADE,
    preview_type TEXT NOT NULL, -- 'thumbnail', 'poster', 'waveform'
    file_path TEXT NOT NULL,
    file_size BIGINT,
    width INTEGER,
    height INTEGER,
    format TEXT, -- 'jpg', 'png', 'webp'
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'skipped')),
    generated_at TIMESTAMPTZ,
    error_message TEXT,
    processing_duration_ms INTEGER,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(file_id, preview_type)
);

-- =============================================================================
-- DETAILED SCAN PROGRESS (Migration 014)
-- =============================================================================

-- Multi-phase scan tracking
CREATE TABLE scan_phases (
    id BIGSERIAL PRIMARY KEY,
    scan_id TEXT NOT NULL REFERENCES scan_jobs(scan_id) ON DELETE CASCADE,
    phase_name TEXT NOT NULL CHECK (phase_name IN ('discovery', 'analysis', 'indexing', 'metadata_extraction', 'finalization')),
    status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'completed', 'failed', 'cancelled', 'paused')),
    progress_percent INTEGER DEFAULT 0 CHECK (progress_percent >= 0 AND progress_percent <= 100),
    items_total BIGINT DEFAULT 0,
    items_processed BIGINT DEFAULT 0,
    items_failed BIGINT DEFAULT 0,
    current_item TEXT, -- what we're currently processing
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    duration_ms BIGINT,
    throughput_items_per_sec DECIMAL(10,2),
    memory_usage_mb BIGINT,
    error_message TEXT,
    pause_reason TEXT, -- why was it paused (migration 016)
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Individual scan step tracking within phases
CREATE TABLE scan_phase_steps (
    id BIGSERIAL PRIMARY KEY,
    phase_id BIGINT NOT NULL REFERENCES scan_phases(id) ON DELETE CASCADE,
    step_name TEXT NOT NULL,
    step_order INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'completed', 'failed', 'cancelled', 'paused')),
    progress_percent INTEGER DEFAULT 0,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    duration_ms BIGINT,
    result_data JSONB DEFAULT '{}',
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Scan performance metrics
CREATE TABLE scan_performance_metrics (
    id BIGSERIAL PRIMARY KEY,
    scan_id TEXT NOT NULL REFERENCES scan_jobs(scan_id) ON DELETE CASCADE,
    metric_name TEXT NOT NULL, -- 'files_per_second', 'memory_peak_mb', etc.
    metric_value DECIMAL(15,4) NOT NULL,
    metric_unit TEXT, -- 'files/sec', 'MB', 'ms', etc.
    measured_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    phase TEXT -- which phase this metric relates to
);

-- =============================================================================
-- USAGE SNAPSHOTS (Migration 003) - Time-series data
-- =============================================================================

CREATE TABLE usage_snapshots (
    id BIGSERIAL PRIMARY KEY,
    volume_id TEXT NOT NULL REFERENCES volumes(volume_id) ON DELETE CASCADE,
    snapshot_date DATE NOT NULL,
    total_size_bytes BIGINT NOT NULL DEFAULT 0,
    total_files BIGINT NOT NULL DEFAULT 0,
    total_directories BIGINT NOT NULL DEFAULT 0,
    size_change_bytes BIGINT DEFAULT 0, -- vs previous snapshot
    files_change BIGINT DEFAULT 0, -- vs previous snapshot
    growth_rate DECIMAL(8,4), -- percentage growth
    largest_file_size BIGINT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(volume_id, snapshot_date)
);

-- =============================================================================
-- INDEXES FOR PERFORMANCE
-- =============================================================================

-- Volume indexes
CREATE INDEX idx_volumes_active ON volumes(is_active);
CREATE INDEX idx_volumes_last_scan ON volumes(last_scan_at);
CREATE INDEX idx_volumes_container_count ON volumes(container_count) WHERE container_count > 0;

-- Folder indexes
CREATE INDEX idx_folders_volume_id ON folders(volume_id);
CREATE INDEX idx_folders_parent_id ON folders(parent_id);
CREATE INDEX idx_folders_path_hash ON folders(path_hash);
CREATE INDEX idx_folders_media ON folders(volume_id, has_media_files) WHERE has_media_files = TRUE;

-- File indexes
CREATE INDEX idx_files_volume_id ON files(volume_id);
CREATE INDEX idx_files_folder_id ON files(folder_id);
CREATE INDEX idx_files_path_hash ON files(path_hash);
CREATE INDEX idx_files_extension ON files(extension);
CREATE INDEX idx_files_mime ON files(mime);
CREATE INDEX idx_files_size ON files(size_bytes);
CREATE INDEX idx_files_media_kind ON files(media_kind) WHERE media_kind IS NOT NULL;
CREATE INDEX idx_files_content_hash ON files(content_hash) WHERE content_hash IS NOT NULL;
CREATE INDEX idx_files_modified ON files(modified_at);

-- Docker mount catalog indexes
CREATE INDEX idx_docker_mount_catalog_mount_id ON docker_mount_catalog(mount_id);
CREATE INDEX idx_docker_mount_catalog_mount_type ON docker_mount_catalog(mount_type);
CREATE INDEX idx_docker_mount_catalog_volume_name ON docker_mount_catalog(volume_name) WHERE volume_name IS NOT NULL;
CREATE INDEX idx_docker_mount_catalog_orphaned ON docker_mount_catalog(is_orphaned) WHERE is_orphaned = true;
CREATE INDEX idx_docker_mount_catalog_tracked ON docker_mount_catalog(is_tracked);
CREATE INDEX idx_docker_mount_catalog_compose_project ON docker_mount_catalog(compose_project) WHERE compose_project IS NOT NULL;
CREATE INDEX idx_docker_mount_catalog_last_seen ON docker_mount_catalog(last_seen_at);

-- Docker mount attachments indexes
CREATE INDEX idx_docker_mount_attachments_mount_id ON docker_mount_attachments(mount_catalog_id);
CREATE INDEX idx_docker_mount_attachments_container_id ON docker_mount_attachments(container_id);
CREATE INDEX idx_docker_mount_attachments_active ON docker_mount_attachments(is_active) WHERE is_active = true;
CREATE INDEX idx_docker_mount_attachments_compose_project ON docker_mount_attachments(container_compose_project) WHERE container_compose_project IS NOT NULL;
CREATE INDEX idx_docker_mount_attachments_compose_service ON docker_mount_attachments(container_compose_service) WHERE container_compose_service IS NOT NULL;

-- Tracking rules indexes
CREATE INDEX idx_tracking_rules_priority ON tracking_rules (priority ASC, id ASC) WHERE is_enabled = true;
CREATE INDEX idx_tracking_rules_action ON tracking_rules (action);
CREATE INDEX idx_tracking_rules_enabled ON tracking_rules (is_enabled);
CREATE INDEX idx_tracking_rules_updated ON tracking_rules (updated_at DESC);

-- Rule evaluations indexes
CREATE INDEX idx_rule_evaluations_rule_id ON tracking_rule_evaluations (rule_id);
CREATE INDEX idx_rule_evaluations_type ON tracking_rule_evaluations (evaluation_type);
CREATE INDEX idx_rule_evaluations_started ON tracking_rule_evaluations (started_at DESC);
CREATE INDEX idx_rule_evaluations_status ON tracking_rule_evaluations (status);

-- Mount assignments indexes
CREATE INDEX idx_mount_assignments_mount_id ON mount_tracking_assignments (mount_catalog_id);
CREATE INDEX idx_mount_assignments_rule_id ON mount_tracking_assignments (rule_id);
CREATE INDEX idx_mount_assignments_active ON mount_tracking_assignments (is_active, assigned_at DESC);
CREATE INDEX idx_mount_assignments_action ON mount_tracking_assignments (action) WHERE is_active = true;

-- Ensure one active assignment per mount using unique index
CREATE UNIQUE INDEX idx_mount_assignments_unique_active ON mount_tracking_assignments (mount_catalog_id) WHERE is_active = true;

-- Rule conditions indexes
CREATE INDEX idx_rule_conditions_rule_id ON tracking_rule_conditions (rule_id);
CREATE INDEX idx_rule_conditions_field ON tracking_rule_conditions (field_name);

-- Rule templates indexes
CREATE INDEX idx_rule_templates_category ON tracking_rule_templates (category);
CREATE INDEX idx_rule_templates_builtin ON tracking_rule_templates (is_builtin);

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
CREATE INDEX idx_saved_searches_tags ON saved_searches USING gin(tags);
CREATE INDEX idx_saved_searches_is_public ON saved_searches(is_public);
CREATE INDEX idx_saved_searches_updated_at ON saved_searches(updated_at DESC);
CREATE INDEX idx_saved_searches_last_run_at ON saved_searches(last_run_at DESC) WHERE last_run_at IS NOT NULL;

-- Preview indexes
CREATE INDEX idx_file_previews_file_id ON file_previews(file_id);
CREATE INDEX idx_file_previews_status ON file_previews(status);

-- =============================================================================
-- FUNCTIONS AND TRIGGERS (PostgreSQL only, handled differently in SQLite)
-- =============================================================================

-- Function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for automatic timestamp updates
CREATE TRIGGER volumes_updated_at_trigger
    BEFORE UPDATE ON volumes
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER docker_mount_catalog_updated_at_trigger
    BEFORE UPDATE ON docker_mount_catalog
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER docker_mount_attachments_updated_at_trigger
    BEFORE UPDATE ON docker_mount_attachments
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER tracking_rules_updated_at_trigger
    BEFORE UPDATE ON tracking_rules
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER mount_tracking_assignments_updated_at_trigger
    BEFORE UPDATE ON mount_tracking_assignments
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER tracking_rule_conditions_updated_at_trigger
    BEFORE UPDATE ON tracking_rule_conditions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER tracking_rule_templates_updated_at_trigger
    BEFORE UPDATE ON tracking_rule_templates
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER alert_rules_updated_at_trigger
    BEFORE UPDATE ON alert_rules
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER alert_destinations_updated_at_trigger
    BEFORE UPDATE ON alert_destinations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER saved_searches_updated_at_trigger
    BEFORE UPDATE ON saved_searches
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

-- =============================================================================
-- DEFAULT DATA
-- =============================================================================

-- Insert default rule templates
INSERT INTO tracking_rule_templates (name, description, category, template_data, is_builtin, tags) VALUES
(
    'Include All Docker Volumes',
    'Include all Docker named volumes for tracking',
    'volume',
    '{
        "name": "Include All Docker Volumes",
        "action": "include",
        "priority": 100,
        "conditions": [
            {
                "field_name": "source_type",
                "operator": "equals",
                "value": "volume"
            }
        ]
    }'::jsonb,
    true,
    ARRAY['volume', 'basic', 'include']
),
(
    'Exclude Temporary Mounts',
    'Exclude all tmpfs mounts from tracking',
    'volume',
    '{
        "name": "Exclude Temporary Mounts", 
        "action": "exclude",
        "priority": 200,
        "conditions": [
            {
                "field_name": "source_type",
                "operator": "equals",
                "value": "tmpfs"
            }
        ]
    }'::jsonb,
    true,
    ARRAY['tmpfs', 'exclude', 'temporary']
),
(
    'Include Production Compose Projects',
    'Include mounts from production Compose projects',
    'compose',
    '{
        "name": "Include Production Compose Projects",
        "action": "include", 
        "priority": 150,
        "conditions": [
            {
                "field_name": "compose_project",
                "operator": "suffix",
                "value": "_prod"
            }
        ]
    }'::jsonb,
    true,
    ARRAY['compose', 'production', 'include']
),
(
    'Exclude Development Volumes',
    'Exclude volumes from development environments',
    'compose',
    '{
        "name": "Exclude Development Volumes",
        "action": "exclude",
        "priority": 300,
        "conditions": [
            {
                "field_name": "compose_project", 
                "operator": "in",
                "values": ["dev", "development", "test"]
            }
        ]
    }'::jsonb,
    true,
    ARRAY['compose', 'development', 'exclude']
),
(
    'Include Database Volumes',
    'Include volumes used by database containers',
    'service',
    '{
        "name": "Include Database Volumes",
        "action": "include",
        "priority": 120,
        "conditions": [
            {
                "field_name": "container_image",
                "operator": "regex",
                "value": "(postgres|mysql|mongodb|redis|elasticsearch):"
            }
        ]
    }'::jsonb,
    true,
    ARRAY['database', 'service', 'include']
),
(
    'Exclude Read-Only Bind Mounts',
    'Exclude read-only bind mounts from tracking',
    'security',
    '{
        "name": "Exclude Read-Only Bind Mounts",
        "action": "exclude",
        "priority": 250,
        "conditions": [
            {
                "field_name": "source_type",
                "operator": "equals", 
                "value": "bind"
            },
            {
                "field_name": "read_only",
                "operator": "equals",
                "value": "true"
            }
        ]
    }'::jsonb,
    true,
    ARRAY['bind', 'readonly', 'exclude', 'security']
);