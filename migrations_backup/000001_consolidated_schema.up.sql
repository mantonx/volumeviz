-- VolumeViz Consolidated Schema - Final State
-- This represents the complete database schema after all 16 migrations
-- Generated from analysis of migrations 000001 through 000016
-- PostgreSQL-specific optimizations and data types included

-- =======================================
-- EXTENSIONS
-- =======================================

-- PostGIS extension for spatial queries (GPS coordinates)
CREATE EXTENSION IF NOT EXISTS postgis;

-- Text search and fuzzy matching
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- =======================================
-- ENUMERATIONS
-- =======================================

-- HDR format enumeration
CREATE TYPE hdr_format AS ENUM ('none', 'hdr10', 'hdr10+', 'dovi');

-- Mount types enumeration
CREATE TYPE mount_type AS ENUM ('volume', 'bind', 'tmpfs');

-- Mount access modes enumeration  
CREATE TYPE mount_access_mode AS ENUM ('rw', 'ro');

-- Rule action enumeration
CREATE TYPE rule_action AS ENUM ('include', 'exclude');

-- Rule condition operator enumeration  
CREATE TYPE rule_operator AS ENUM (
    'equals', 'not_equals', 'regex', 'not_regex', 'prefix', 'suffix',
    'contains', 'not_contains', 'glob', 'in', 'not_in'
);

-- Rule evaluation status
CREATE TYPE rule_evaluation_status AS ENUM ('pending', 'success', 'error', 'skipped');

-- =======================================
-- CORE TABLES
-- =======================================

-- Volumes table - Core volume registry
CREATE TABLE IF NOT EXISTS volumes (
    id BIGSERIAL PRIMARY KEY,
    volume_id TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    driver TEXT NOT NULL DEFAULT 'local',
    mountpoint TEXT NOT NULL,
    labels JSONB DEFAULT '{}',
    options JSONB DEFAULT '{}',
    scope TEXT DEFAULT 'local',
    status TEXT DEFAULT 'active',
    last_scanned TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Volume sizes table - Volume scan results and filesystem capacity
CREATE TABLE IF NOT EXISTS volume_sizes (
    id BIGSERIAL PRIMARY KEY,
    volume_id TEXT NOT NULL,
    total_size BIGINT NOT NULL DEFAULT 0,
    file_count BIGINT NOT NULL DEFAULT 0,
    directory_count BIGINT NOT NULL DEFAULT 0,
    largest_file BIGINT NOT NULL DEFAULT 0,
    scan_method TEXT NOT NULL,
    scan_duration BIGINT NOT NULL DEFAULT 0,
    filesystem_type TEXT,
    checksum_md5 TEXT,
    is_valid BOOLEAN DEFAULT TRUE,
    error_message TEXT,
    
    -- Filesystem capacity fields (from migration 000013)
    fs_total_bytes BIGINT,
    fs_available_bytes BIGINT,  
    fs_used_bytes BIGINT,
    fs_usage_percent NUMERIC(5,2),
    fs_block_size BIGINT,
    fs_total_blocks BIGINT,
    fs_free_blocks BIGINT,
    
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (volume_id) REFERENCES volumes(volume_id) ON DELETE CASCADE
);

-- Containers table - Docker container registry
CREATE TABLE IF NOT EXISTS containers (
    id BIGSERIAL PRIMARY KEY,
    container_id TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    image TEXT NOT NULL,
    state TEXT NOT NULL,
    status TEXT,
    labels JSONB DEFAULT '{}',
    started_at TIMESTAMPTZ,
    finished_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Volume mounts table - Container to volume mapping
CREATE TABLE IF NOT EXISTS volume_mounts (
    id BIGSERIAL PRIMARY KEY,
    volume_id TEXT NOT NULL,
    container_id TEXT NOT NULL,
    mount_path TEXT NOT NULL,
    access_mode TEXT NOT NULL DEFAULT 'rw',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (volume_id) REFERENCES volumes(volume_id) ON DELETE CASCADE,
    FOREIGN KEY (container_id) REFERENCES containers(container_id) ON DELETE CASCADE,
    UNIQUE(volume_id, container_id, mount_path)
);

-- =======================================
-- SCAN MANAGEMENT
-- =======================================

-- Scan jobs table - Master scan job tracking with phases (from migrations 000001, 000014, 000016)
CREATE TABLE IF NOT EXISTS scan_jobs (
    id BIGSERIAL PRIMARY KEY,
    scan_id TEXT NOT NULL UNIQUE,
    volume_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'queued',
    progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
    method TEXT NOT NULL,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    error_message TEXT,
    result_id BIGINT,
    estimated_duration BIGINT,
    
    -- Phase tracking (from migration 000014)
    current_phase TEXT DEFAULT 'volume_scan',
    total_phases INTEGER DEFAULT 3,
    phase_progress INTEGER DEFAULT 0 CHECK (phase_progress >= 0 AND phase_progress <= 100),
    
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (volume_id) REFERENCES volumes(volume_id) ON DELETE CASCADE,
    FOREIGN KEY (result_id) REFERENCES volume_sizes(id) ON DELETE SET NULL
);

-- Scan phases table - Detailed scan phase tracking (from migration 000014)
CREATE TABLE IF NOT EXISTS scan_phases (
    id BIGSERIAL PRIMARY KEY,
    scan_id TEXT NOT NULL,
    phase_name TEXT NOT NULL, -- 'volume_scan', 'filesystem_indexing', 'media_enrichment', 'preview_generation'
    phase_order INTEGER NOT NULL, -- 1, 2, 3, 4
    status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'running', 'completed', 'failed', 'skipped', 'paused'
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
    
    -- Pause tracking (from migration 000016)
    pause_reason TEXT DEFAULT '',
    
    -- Metadata
    metadata JSONB DEFAULT '{}',
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    FOREIGN KEY (scan_id) REFERENCES scan_jobs(scan_id) ON DELETE CASCADE,
    UNIQUE(scan_id, phase_name)
);

-- Scan progress items table - Individual item processing tracking (from migration 000014)
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

-- Scan errors table - Detailed error tracking (from migration 000014)
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

-- Scan performance metrics table - Performance tracking over time (from migration 000014)
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

-- Volume metrics table - Time-series volume metrics
CREATE TABLE IF NOT EXISTS volume_metrics (
    id BIGSERIAL PRIMARY KEY,
    volume_id TEXT NOT NULL,
    metric_timestamp TIMESTAMPTZ NOT NULL,
    total_size BIGINT NOT NULL,
    file_count BIGINT NOT NULL,
    directory_count BIGINT NOT NULL,
    growth_rate REAL,
    access_frequency INTEGER DEFAULT 0,
    container_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (volume_id) REFERENCES volumes(volume_id) ON DELETE CASCADE,
    UNIQUE(volume_id, metric_timestamp)
);

-- =======================================
-- FILESYSTEM INDEXING
-- =======================================

-- Folders table - Enhanced folder tree with rich metadata (from migration 000004)
CREATE TABLE IF NOT EXISTS folders (
    id BIGSERIAL PRIMARY KEY,
    parent_id BIGINT REFERENCES folders(id) ON DELETE CASCADE,
    volume_id TEXT NOT NULL,
    name TEXT NOT NULL,
    path TEXT NOT NULL,
    path_hash BYTEA NOT NULL,
    size_bytes_recursive BIGINT NOT NULL DEFAULT 0,
    disk_usage_bytes_recursive BIGINT NOT NULL DEFAULT 0,
    file_count BIGINT NOT NULL DEFAULT 0,
    dir_count BIGINT NOT NULL DEFAULT 0,
    depth INTEGER NOT NULL DEFAULT 0,
    mtime TIMESTAMP,
    ctime TIMESTAMP,
    uid INTEGER,
    gid INTEGER,
    mode INTEGER,
    is_symlink BOOLEAN DEFAULT false,
    symlink_target TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (volume_id) REFERENCES volumes(volume_id) ON DELETE CASCADE
);

-- Files table - Enhanced files with rich metadata and media enrichment (from migrations 000004, 000005)
CREATE TABLE IF NOT EXISTS files (
    id BIGSERIAL PRIMARY KEY,
    folder_id BIGINT NOT NULL REFERENCES folders(id) ON DELETE CASCADE,
    volume_id TEXT NOT NULL,
    name TEXT NOT NULL,
    path TEXT NOT NULL,
    extension TEXT,
    size_bytes BIGINT NOT NULL DEFAULT 0,
    disk_usage_bytes BIGINT NOT NULL DEFAULT 0,
    mtime TIMESTAMP,
    ctime TIMESTAMP,
    birthtime TIMESTAMP,
    uid INTEGER,
    gid INTEGER,
    mode INTEGER,
    inode BIGINT,
    device TEXT,
    is_symlink BOOLEAN DEFAULT false,
    symlink_target TEXT,
    mime TEXT,
    media_kind TEXT,
    encoding TEXT,
    hash_algo TEXT,
    hash BYTEA,
    path_hash BYTEA NOT NULL,
    
    -- Audio/Video metadata (from migration 000005)
    duration_ms BIGINT,
    bitrate_kbps INTEGER,
    width INTEGER,
    height INTEGER,
    fps DECIMAL(8,3),
    color_primaries TEXT,
    transfer_characteristic TEXT,
    hdr_format hdr_format DEFAULT 'none',
    audio_channels INTEGER,
    audio_codec TEXT,
    audio_sample_rate INTEGER,
    video_codec TEXT,
    video_profile TEXT,
    video_level TEXT,
    
    -- Image metadata (from migration 000005)
    capture_datetime TIMESTAMPTZ,
    camera_make TEXT,
    camera_model TEXT,
    lens_model TEXT,
    orientation INTEGER,
    gps_latitude DECIMAL(10,8),
    gps_longitude DECIMAL(11,8),
    
    -- Subtitle metadata (from migration 000005)
    subtitle_language TEXT,
    subtitle_format TEXT,
    cue_count INTEGER,
    coverage_percent DECIMAL(5,2),
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (volume_id) REFERENCES volumes(volume_id) ON DELETE CASCADE
);

-- File metadata table - Detailed JSONB metadata (from migration 000005)
CREATE TABLE IF NOT EXISTS file_metadata (
    id BIGSERIAL PRIMARY KEY,
    file_id BIGINT NOT NULL,
    kind TEXT NOT NULL, -- 'audio', 'video', 'image', 'subtitle'
    data_json JSONB NOT NULL,
    enriched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE
);

-- =======================================
-- ANALYTICS AND STATISTICS
-- =======================================

-- Usage snapshots table - Time-series data (from migration 000003)
CREATE TABLE IF NOT EXISTS usage_snapshots (
    id BIGSERIAL PRIMARY KEY,
    volume_id TEXT NOT NULL,
    snapshot_date DATE NOT NULL,
    snapshot_type TEXT NOT NULL CHECK (snapshot_type IN ('daily', 'weekly')),
    total_size BIGINT NOT NULL DEFAULT 0,
    file_count BIGINT NOT NULL DEFAULT 0,
    directory_count BIGINT NOT NULL DEFAULT 0,
    largest_file BIGINT NOT NULL DEFAULT 0,
    growth_bytes BIGINT DEFAULT 0, -- growth since previous snapshot
    growth_files BIGINT DEFAULT 0, -- file count growth
    growth_rate_bytes_per_day REAL DEFAULT 0,
    scan_method TEXT NOT NULL,
    scan_duration_ms INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (volume_id) REFERENCES volumes(volume_id) ON DELETE CASCADE,
    UNIQUE(volume_id, snapshot_date, snapshot_type)
);

-- Daily stats table - Daily aggregates and deltas (from migration 000006)
CREATE TABLE IF NOT EXISTS stats_daily (
    id BIGSERIAL PRIMARY KEY,
    
    -- Dimensions
    date DATE NOT NULL,
    volume_id TEXT NOT NULL,
    folder_id BIGINT NULL, -- NULL for volume-level aggregates
    media_kind TEXT NULL, -- NULL for all-media aggregates
    
    -- Current state metrics
    files_count BIGINT NOT NULL DEFAULT 0,
    total_bytes BIGINT NOT NULL DEFAULT 0,
    
    -- Delta metrics (changes since previous day)
    added_bytes BIGINT NOT NULL DEFAULT 0,
    removed_bytes BIGINT NOT NULL DEFAULT 0,
    added_files BIGINT NOT NULL DEFAULT 0,
    removed_files BIGINT NOT NULL DEFAULT 0,
    
    -- Processing metadata
    computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    scan_id TEXT NULL, -- Link to scan that generated this data
    job_duration_ms BIGINT NULL, -- Time taken to compute
    
    -- Ensure uniqueness per dimension combination
    CONSTRAINT stats_daily_unique_dimension 
        UNIQUE (date, volume_id, folder_id, media_kind),
    
    -- Foreign key constraints
    CONSTRAINT fk_stats_daily_volume 
        FOREIGN KEY (volume_id) REFERENCES volumes(volume_id) ON DELETE CASCADE,
    CONSTRAINT fk_stats_daily_folder 
        FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE CASCADE
);

-- Stats jobs table - Job status tracking (from migration 000006)
CREATE TABLE IF NOT EXISTS stats_jobs (
    id BIGSERIAL PRIMARY KEY,
    job_type TEXT NOT NULL, -- 'scan_completion', 'nightly_reconcile', 'backfill'
    volume_id TEXT NULL, -- NULL for global jobs
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ NULL,
    duration_ms BIGINT NULL,
    status TEXT NOT NULL DEFAULT 'running', -- 'running', 'completed', 'failed'
    error_message TEXT NULL,
    processed_dates INT DEFAULT 0, -- Number of dates processed
    records_created INT DEFAULT 0,
    records_updated INT DEFAULT 0,
    
    CONSTRAINT fk_stats_jobs_volume 
        FOREIGN KEY (volume_id) REFERENCES volumes(volume_id) ON DELETE CASCADE
);

-- =======================================
-- ALERTS SYSTEM
-- =======================================

-- Alert rules table (from migration 000007)
CREATE TABLE IF NOT EXISTS alert_rules (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    query TEXT NOT NULL,
    condition TEXT NOT NULL CHECK (condition IN ('gt', 'lt', 'eq', 'ne', 'gte', 'lte')),
    threshold DOUBLE PRECISION NOT NULL,
    interval_seconds INTEGER NOT NULL CHECK (interval_seconds >= 60), -- Minimum 1 minute
    for_seconds INTEGER CHECK (for_seconds IS NULL OR for_seconds >= 0),
    labels JSONB DEFAULT '{}',
    is_enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT alert_rules_name_unique UNIQUE (name)
);

-- Alerts table (from migration 000007)
CREATE TABLE IF NOT EXISTS alerts (
    id BIGSERIAL PRIMARY KEY,
    rule_id BIGINT NOT NULL REFERENCES alert_rules(id) ON DELETE CASCADE,
    entity_id TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    dedupe_key TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'firing' CHECK (status IN ('firing', 'resolved')),
    value DOUBLE PRECISION,
    labels JSONB DEFAULT '{}',
    annotations JSONB DEFAULT '{}',
    starts_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ends_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT alerts_dedupe_unique UNIQUE (rule_id, entity_id, dedupe_key)
);

-- Alert destinations table (from migration 000007)
CREATE TABLE IF NOT EXISTS alert_destinations (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('webhook', 'slack', 'pushover')),
    config JSONB NOT NULL DEFAULT '{}',
    is_enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT alert_destinations_name_unique UNIQUE (name)
);

-- Alert routes table (from migration 000007)
CREATE TABLE IF NOT EXISTS alert_routes (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    matchers JSONB NOT NULL DEFAULT '{}',
    destination_id BIGINT NOT NULL REFERENCES alert_destinations(id) ON DELETE CASCADE,
    priority INTEGER DEFAULT 0,
    is_enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT alert_routes_name_unique UNIQUE (name)
);

-- Alert deliveries table (from migration 000007)
CREATE TABLE IF NOT EXISTS alert_deliveries (
    id BIGSERIAL PRIMARY KEY,
    alert_id BIGINT NOT NULL REFERENCES alerts(id) ON DELETE CASCADE,
    destination_id BIGINT NOT NULL REFERENCES alert_destinations(id) ON DELETE CASCADE,
    route_id BIGINT NOT NULL REFERENCES alert_routes(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'delivered', 'failed', 'retrying')),
    attempt_count INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 3,
    next_attempt_at TIMESTAMPTZ,
    last_attempt_at TIMESTAMPTZ,
    error_message TEXT,
    delivered_at TIMESTAMPTZ,
    request_payload TEXT,
    response_payload TEXT,
    response_status INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =======================================
-- SEARCH AND USER FEATURES
-- =======================================

-- Saved searches table (from migration 000009)
CREATE TABLE IF NOT EXISTS saved_searches (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    query JSONB NOT NULL,
    tags TEXT[],
    is_public BOOLEAN DEFAULT false,
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_run_at TIMESTAMPTZ,
    run_count INTEGER DEFAULT 0,
    
    -- Constraints
    CONSTRAINT saved_searches_name_unique UNIQUE(name),
    CONSTRAINT saved_searches_name_not_empty CHECK(length(trim(name)) > 0)
);

-- =======================================
-- PREVIEW SYSTEM
-- =======================================

-- Previews table - Generated preview metadata (from migration 000010)
CREATE TABLE IF NOT EXISTS previews (
    id BIGSERIAL PRIMARY KEY,
    file_id BIGINT NOT NULL REFERENCES files(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL CHECK (type IN ('thumbnail', 'poster', 'cover')),
    size VARCHAR(50) NOT NULL CHECK (size IN ('small', 'medium', 'large')),
    format VARCHAR(20) NOT NULL DEFAULT 'webp',
    width INTEGER,
    height INTEGER,
    file_size BIGINT NOT NULL,
    content_hash VARCHAR(64) NOT NULL, -- SHA256 of the preview file
    storage_path TEXT NOT NULL, -- Content-addressed storage path
    time_offset FLOAT DEFAULT 0, -- For video thumbnails
    processing_ms BIGINT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    accessed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Unique constraint to prevent duplicate previews
    UNIQUE(file_id, type, size, time_offset)
);

-- Preview stats table - Monitoring (from migration 000010)
CREATE TABLE IF NOT EXISTS preview_stats (
    id BIGSERIAL PRIMARY KEY,
    total_generated BIGINT DEFAULT 0,
    total_size_bytes BIGINT DEFAULT 0,
    cache_hits BIGINT DEFAULT 0,
    cache_misses BIGINT DEFAULT 0,
    last_cleanup TIMESTAMP WITH TIME ZONE,
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =======================================
-- DOCKER MOUNT CATALOG
-- =======================================

-- Docker mount catalog table - Canonical Docker mount source (from migration 000011)
CREATE TABLE IF NOT EXISTS docker_mount_catalog (
    id BIGSERIAL PRIMARY KEY,
    
    -- Mount identification
    mount_id TEXT NOT NULL, -- Unique identifier for the mount (volume name for volumes, hash for binds/tmpfs)
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
    first_discovered_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_seen_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    discovery_source TEXT NOT NULL DEFAULT 'docker_engine', -- How this mount was discovered
    
    -- Tracking status
    is_tracked BOOLEAN NOT NULL DEFAULT false, -- Whether this mount is currently being tracked
    tracking_enabled_at TIMESTAMP, -- When tracking was enabled
    tracking_disabled_at TIMESTAMP, -- When tracking was disabled
    
    -- Metadata
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT unique_mount_id UNIQUE (mount_id)
);

-- Docker mount attachments table - Container mount tracking (from migration 000011)
CREATE TABLE IF NOT EXISTS docker_mount_attachments (
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
    attached_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    detached_at TIMESTAMP, -- When attachment was removed (null if still attached)
    is_active BOOLEAN NOT NULL DEFAULT true, -- Whether attachment is currently active
    
    -- Metadata
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT unique_active_attachment UNIQUE (mount_catalog_id, container_id, destination_path) 
        DEFERRABLE INITIALLY DEFERRED
);

-- Docker mount statistics table - Aggregated statistics (from migration 000011)
CREATE TABLE IF NOT EXISTS docker_mount_statistics (
    id BIGSERIAL PRIMARY KEY,
    
    mount_catalog_id BIGINT NOT NULL REFERENCES docker_mount_catalog(id) ON DELETE CASCADE,
    
    -- Usage statistics
    peak_container_count INTEGER NOT NULL DEFAULT 0, -- Max containers ever attached
    total_attachments INTEGER NOT NULL DEFAULT 0, -- Total attachments over time
    
    -- Compose project statistics
    compose_projects_count INTEGER NOT NULL DEFAULT 0, -- Number of different compose projects using this mount
    compose_services_count INTEGER NOT NULL DEFAULT 0, -- Number of different services using this mount
    
    -- Lifecycle statistics
    days_since_creation INTEGER, -- Days since mount was first discovered
    days_since_last_use INTEGER, -- Days since last container attachment
    attachment_frequency_score REAL, -- Score indicating how frequently this mount is used
    
    -- Size information (from volume scans)
    last_known_size_bytes BIGINT, -- Last known size from scanning
    last_scanned_at TIMESTAMP, -- When size was last updated
    
    -- Metadata
    calculated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- =======================================
-- TRACKING RULES ENGINE
-- =======================================

-- Tracking rules table - Ordered rule definitions (from migration 000012)
CREATE TABLE IF NOT EXISTS tracking_rules (
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
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Rule evaluation history table - Tracks when rules are evaluated (from migration 000012)
CREATE TABLE IF NOT EXISTS tracking_rule_evaluations (
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
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Mount tracking assignments table - Results of rule evaluation (from migration 000012)
CREATE TABLE IF NOT EXISTS mount_tracking_assignments (
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
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ, -- Optional expiration
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Rule conditions validation table - Validated condition schemas (from migration 000012)
CREATE TABLE IF NOT EXISTS tracking_rule_conditions (
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
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Rule templates table - Predefined rule patterns (from migration 000012)
CREATE TABLE IF NOT EXISTS tracking_rule_templates (
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
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =======================================
-- COMPREHENSIVE INDEXING STRATEGY
-- =======================================

-- Core table indexes (from migration 000001)
CREATE INDEX IF NOT EXISTS idx_volumes_volume_id ON volumes(volume_id);
CREATE INDEX IF NOT EXISTS idx_volumes_name ON volumes(name);
CREATE INDEX IF NOT EXISTS idx_volumes_last_scanned ON volumes(last_scanned);
CREATE INDEX IF NOT EXISTS idx_volumes_status_active ON volumes(status, is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_volumes_created_at ON volumes(created_at);

CREATE INDEX IF NOT EXISTS idx_volume_sizes_volume_id ON volume_sizes(volume_id);
CREATE INDEX IF NOT EXISTS idx_volume_sizes_created_at ON volume_sizes(created_at);
CREATE INDEX IF NOT EXISTS idx_volume_sizes_total_size ON volume_sizes(total_size);
CREATE INDEX IF NOT EXISTS idx_volume_sizes_valid_volume_created ON volume_sizes(volume_id, created_at) WHERE is_valid = TRUE;

-- Filesystem capacity indexes (from migration 000013)
CREATE INDEX IF NOT EXISTS idx_volume_sizes_fs_total_bytes ON volume_sizes(fs_total_bytes) WHERE fs_total_bytes IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_volume_sizes_fs_usage_percent ON volume_sizes(fs_usage_percent) WHERE fs_usage_percent IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_volume_sizes_with_fs_capacity ON volume_sizes(volume_id, created_at DESC) WHERE fs_total_bytes IS NOT NULL AND is_valid = true;

CREATE INDEX IF NOT EXISTS idx_containers_container_id ON containers(container_id);
CREATE INDEX IF NOT EXISTS idx_containers_name ON containers(name);
CREATE INDEX IF NOT EXISTS idx_containers_state ON containers(state);
CREATE INDEX IF NOT EXISTS idx_containers_image ON containers(image);
CREATE INDEX IF NOT EXISTS idx_containers_active_state ON containers(is_active, state) WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS idx_volume_mounts_volume_id ON volume_mounts(volume_id);
CREATE INDEX IF NOT EXISTS idx_volume_mounts_container_id ON volume_mounts(container_id);
CREATE INDEX IF NOT EXISTS idx_volume_mounts_active ON volume_mounts(is_active) WHERE is_active = TRUE;

-- Scan job indexes (from migrations 000001, 000014, 000015)
CREATE INDEX IF NOT EXISTS idx_scan_jobs_scan_id ON scan_jobs(scan_id);
CREATE INDEX IF NOT EXISTS idx_scan_jobs_volume_id ON scan_jobs(volume_id);
CREATE INDEX IF NOT EXISTS idx_scan_jobs_status ON scan_jobs(status);
CREATE INDEX IF NOT EXISTS idx_scan_jobs_created_at ON scan_jobs(created_at);
CREATE INDEX IF NOT EXISTS idx_scan_jobs_pending ON scan_jobs(status) WHERE status IN ('queued', 'scanning');
CREATE INDEX IF NOT EXISTS idx_scan_jobs_active_monitoring ON scan_jobs(status, current_phase, updated_at) WHERE status IN ('queued', 'scanning', 'running');
CREATE INDEX IF NOT EXISTS idx_scan_jobs_volume_history ON scan_jobs(volume_id, completed_at DESC, status) WHERE completed_at IS NOT NULL;

-- Scan phase indexes (from migrations 000014, 000015)
CREATE INDEX IF NOT EXISTS idx_scan_phases_scan_id ON scan_phases(scan_id);
CREATE INDEX IF NOT EXISTS idx_scan_phases_phase_name ON scan_phases(phase_name);
CREATE INDEX IF NOT EXISTS idx_scan_phases_status ON scan_phases(status);
CREATE INDEX IF NOT EXISTS idx_scan_phases_scan_status ON scan_phases(scan_id, status);
CREATE INDEX IF NOT EXISTS idx_scan_phases_updated_at ON scan_phases(updated_at);
CREATE INDEX IF NOT EXISTS idx_scan_phases_active ON scan_phases(scan_id, phase_name) WHERE status IN ('pending', 'running');
CREATE INDEX IF NOT EXISTS idx_scan_phases_paused_status ON scan_phases(status) WHERE status = 'paused';
CREATE INDEX IF NOT EXISTS idx_scan_phases_active_updates ON scan_phases(scan_id, phase_name, updated_at) WHERE status IN ('pending', 'running');
CREATE INDEX IF NOT EXISTS idx_scan_phases_comprehensive_progress ON scan_phases(scan_id, phase_order, status, progress) WHERE status != 'skipped';
CREATE INDEX IF NOT EXISTS idx_scan_phases_active_scans ON scan_phases(status, updated_at) WHERE status IN ('running', 'pending');

-- Scan progress items indexes (from migrations 000014, 000015)
CREATE INDEX IF NOT EXISTS idx_scan_progress_items_scan_id ON scan_progress_items(scan_id);
CREATE INDEX IF NOT EXISTS idx_scan_progress_items_phase ON scan_progress_items(phase_name);
CREATE INDEX IF NOT EXISTS idx_scan_progress_items_scan_phase ON scan_progress_items(scan_id, phase_name);
CREATE INDEX IF NOT EXISTS idx_scan_progress_items_status ON scan_progress_items(status);
CREATE INDEX IF NOT EXISTS idx_scan_progress_items_item_type ON scan_progress_items(item_type);
CREATE INDEX IF NOT EXISTS idx_scan_progress_items_path ON scan_progress_items(item_path);
CREATE INDEX IF NOT EXISTS idx_scan_progress_items_updated_at ON scan_progress_items(updated_at);
CREATE INDEX IF NOT EXISTS idx_scan_progress_items_failed ON scan_progress_items(scan_id, phase_name) WHERE status = 'failed';
CREATE INDEX IF NOT EXISTS idx_scan_progress_items_active_tracking ON scan_progress_items(scan_id, phase_name, status, updated_at) WHERE status IN ('pending', 'processing');
CREATE INDEX IF NOT EXISTS idx_scan_progress_active_items ON scan_progress_items(scan_id, status, updated_at) WHERE status IN ('processing', 'pending');

-- Scan error indexes (from migrations 000014, 000015)
CREATE INDEX IF NOT EXISTS idx_scan_errors_scan_id ON scan_errors(scan_id);
CREATE INDEX IF NOT EXISTS idx_scan_errors_phase ON scan_errors(phase_name);
CREATE INDEX IF NOT EXISTS idx_scan_errors_scan_phase ON scan_errors(scan_id, phase_name);
CREATE INDEX IF NOT EXISTS idx_scan_errors_type ON scan_errors(error_type);
CREATE INDEX IF NOT EXISTS idx_scan_errors_category ON scan_errors(error_category);
CREATE INDEX IF NOT EXISTS idx_scan_errors_component ON scan_errors(component);
CREATE INDEX IF NOT EXISTS idx_scan_errors_severity ON scan_errors(severity);
CREATE INDEX IF NOT EXISTS idx_scan_errors_occurred_at ON scan_errors(occurred_at);
CREATE INDEX IF NOT EXISTS idx_scan_errors_item_path ON scan_errors(item_path);
CREATE INDEX IF NOT EXISTS idx_scan_errors_recent_by_phase ON scan_errors(scan_id, phase_name, occurred_at DESC, severity);
CREATE INDEX IF NOT EXISTS idx_scan_errors_recent ON scan_errors(occurred_at, severity, error_category);

-- Performance metrics indexes (from migration 000014)
CREATE INDEX IF NOT EXISTS idx_scan_performance_scan_id ON scan_performance_metrics(scan_id);
CREATE INDEX IF NOT EXISTS idx_scan_performance_phase ON scan_performance_metrics(phase_name);
CREATE INDEX IF NOT EXISTS idx_scan_performance_scan_phase ON scan_performance_metrics(scan_id, phase_name);
CREATE INDEX IF NOT EXISTS idx_scan_performance_measured_at ON scan_performance_metrics(measured_at);

CREATE INDEX IF NOT EXISTS idx_volume_metrics_volume_id ON volume_metrics(volume_id);
CREATE INDEX IF NOT EXISTS idx_volume_metrics_timestamp ON volume_metrics(metric_timestamp);
CREATE INDEX IF NOT EXISTS idx_volume_metrics_volume_timestamp ON volume_metrics(volume_id, metric_timestamp);

-- Folder indexes (from migrations 000004, 000015)
CREATE INDEX IF NOT EXISTS idx_folders_volume_id ON folders(volume_id);
CREATE INDEX IF NOT EXISTS idx_folders_parent_id ON folders(parent_id);
CREATE INDEX IF NOT EXISTS idx_folders_volume_parent ON folders(volume_id, parent_id);
CREATE INDEX IF NOT EXISTS idx_folders_path_hash ON folders(path_hash);
CREATE INDEX IF NOT EXISTS idx_folders_volume_path_hash ON folders(volume_id, path_hash);
CREATE INDEX IF NOT EXISTS idx_folders_depth ON folders(depth);
CREATE INDEX IF NOT EXISTS idx_folders_size_recursive ON folders(size_bytes_recursive DESC);
CREATE INDEX IF NOT EXISTS idx_folders_file_count ON folders(file_count DESC);
CREATE INDEX IF NOT EXISTS idx_folders_name ON folders(name);
CREATE INDEX IF NOT EXISTS idx_folders_volume_depth ON folders(volume_id, depth);
CREATE INDEX IF NOT EXISTS idx_folders_hierarchy_performance ON folders(parent_id, depth, size_bytes_recursive DESC) WHERE parent_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_folders_path_lookup ON folders(volume_id, path);

-- Unique constraint for folders
CREATE UNIQUE INDEX IF NOT EXISTS idx_folders_volume_path_unique ON folders(volume_id, path_hash);

-- File indexes (from migrations 000004, 000005, 000008, 000015)
CREATE INDEX IF NOT EXISTS idx_files_volume_id ON files(volume_id);
CREATE INDEX IF NOT EXISTS idx_files_folder_id ON files(folder_id);
CREATE INDEX IF NOT EXISTS idx_files_volume_folder ON files(volume_id, folder_id);
CREATE INDEX IF NOT EXISTS idx_files_media_kind ON files(media_kind);
CREATE INDEX IF NOT EXISTS idx_files_volume_media_kind ON files(volume_id, folder_id, media_kind);
CREATE INDEX IF NOT EXISTS idx_files_hash_algo_hash ON files(hash_algo, hash);
CREATE INDEX IF NOT EXISTS idx_files_path_hash ON files(path_hash);
CREATE INDEX IF NOT EXISTS idx_files_volume_path_hash ON files(volume_id, path_hash);
CREATE INDEX IF NOT EXISTS idx_files_size_bytes ON files(size_bytes DESC);
CREATE INDEX IF NOT EXISTS idx_files_extension ON files(extension);
CREATE INDEX IF NOT EXISTS idx_files_mime ON files(mime);
CREATE INDEX IF NOT EXISTS idx_files_name ON files(name);
CREATE INDEX IF NOT EXISTS idx_files_volume_size ON files(volume_id, size_bytes DESC);
CREATE INDEX IF NOT EXISTS idx_files_mtime ON files(mtime);
CREATE INDEX IF NOT EXISTS idx_files_folder_volume_performance ON files(folder_id, volume_id, size_bytes DESC);
CREATE INDEX IF NOT EXISTS idx_files_path_lookup ON files(volume_id, path);

-- Search performance indexes (from migration 000008)
CREATE INDEX IF NOT EXISTS idx_files_name_search ON files USING gin(to_tsvector('english', name));
CREATE INDEX IF NOT EXISTS idx_files_path_search ON files USING gin(to_tsvector('english', path));
CREATE INDEX IF NOT EXISTS idx_files_name_trgm ON files USING gin(name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_files_path_trgm ON files USING gin(path gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_files_mime_type ON files(mime) WHERE mime IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_files_extension_lower ON files(LOWER(extension)) WHERE extension IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_files_path_prefix ON files(path text_pattern_ops);

-- Media enrichment indexes (from migrations 000005, 000008, 000015)
CREATE INDEX IF NOT EXISTS idx_files_duration_ms ON files(duration_ms) WHERE duration_ms IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_files_resolution ON files(width, height) WHERE width IS NOT NULL AND height IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_files_width ON files(width) WHERE width IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_files_height ON files(height) WHERE height IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_files_hdr_format ON files(hdr_format) WHERE hdr_format != 'none';
CREATE INDEX IF NOT EXISTS idx_files_capture_datetime ON files(capture_datetime) WHERE capture_datetime IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_files_gps ON files(gps_latitude, gps_longitude) WHERE gps_latitude IS NOT NULL AND gps_longitude IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_files_camera_model ON files(camera_model) WHERE camera_model IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_files_has_subtitles ON files((subtitle_language IS NOT NULL));
CREATE INDEX IF NOT EXISTS idx_files_has_hash ON files((hash IS NOT NULL));
CREATE INDEX IF NOT EXISTS idx_files_video_codec ON files(video_codec) WHERE video_codec IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_files_audio_codec ON files(audio_codec) WHERE audio_codec IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_files_has_gps ON files((gps_latitude IS NOT NULL AND gps_longitude IS NOT NULL));

-- Performance-critical enrichment indexes (from migration 000015)
CREATE INDEX IF NOT EXISTS idx_files_unenriched_optimized ON files(volume_id, mime) 
WHERE (
    -- Video/audio files missing duration or codec info
    (mime LIKE 'video/%' OR mime LIKE 'audio/%') AND (duration_ms IS NULL OR video_codec IS NULL OR audio_codec IS NULL)
    OR
    -- Image files missing dimensions or EXIF data
    mime LIKE 'image/%' AND (width IS NULL OR height IS NULL OR capture_datetime IS NULL)
    OR
    -- Subtitle files missing subtitle info
    mime IN ('text/vtt', 'application/x-subrip', 'text/x-ssa', 'text/x-ass') AND subtitle_language IS NULL
);

CREATE INDEX IF NOT EXISTS idx_files_unenriched_pagination ON files(volume_id, size_bytes DESC, id)
WHERE mime IN (
    'video/mp4', 'video/x-msvideo', 'video/x-matroska', 'video/quicktime', 'video/x-ms-wmv', 'video/x-flv', 'video/webm',
    'audio/mpeg', 'audio/flac', 'audio/wav', 'audio/aac', 'audio/ogg', 'audio/mp4',
    'image/jpeg', 'image/png', 'image/tiff', 'image/bmp', 'image/webp', 'image/heic',
    'text/vtt', 'application/x-subrip', 'text/x-ssa', 'text/x-ass'
) AND (
    (mime LIKE 'video/%' OR mime LIKE 'audio/%') AND (duration_ms IS NULL OR video_codec IS NULL OR audio_codec IS NULL)
    OR
    mime LIKE 'image/%' AND (width IS NULL OR height IS NULL OR capture_datetime IS NULL)
    OR
    mime IN ('text/vtt', 'application/x-subrip', 'text/x-ssa', 'text/x-ass') AND subtitle_language IS NULL
);

CREATE INDEX IF NOT EXISTS idx_files_unenriched_count ON files(volume_id)
WHERE mime IN (
    'video/mp4', 'video/x-msvideo', 'video/x-matroska', 'video/quicktime', 'video/x-ms-wmv', 'video/x-flv', 'video/webm',
    'audio/mpeg', 'audio/flac', 'audio/wav', 'audio/aac', 'audio/ogg', 'audio/mp4',
    'image/jpeg', 'image/png', 'image/tiff', 'image/bmp', 'image/webp', 'image/heic',
    'text/vtt', 'application/x-subrip', 'text/x-ssa', 'text/x-ass'
) AND (
    (mime LIKE 'video/%' OR mime LIKE 'audio/%') AND (duration_ms IS NULL OR video_codec IS NULL OR audio_codec IS NULL)
    OR
    mime LIKE 'image/%' AND (width IS NULL OR height IS NULL OR capture_datetime IS NULL)
    OR
    mime IN ('text/vtt', 'application/x-subrip', 'text/x-ssa', 'text/x-ass') AND subtitle_language IS NULL
);

-- Specialized media search indexes
CREATE INDEX IF NOT EXISTS idx_files_hdr_content ON files(volume_id, hdr_format, width DESC, height DESC) WHERE hdr_format != 'none';
CREATE INDEX IF NOT EXISTS idx_files_gps_content ON files(volume_id, capture_datetime DESC) WHERE gps_latitude IS NOT NULL AND gps_longitude IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_files_codec_analysis ON files(volume_id, video_codec, audio_codec, duration_ms DESC) WHERE duration_ms IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_files_subtitle_distribution ON files(volume_id, subtitle_language, cue_count) WHERE subtitle_language IS NOT NULL;

-- Compound search indexes (from migration 000008)
CREATE INDEX IF NOT EXISTS idx_files_media_size ON files(media_kind, size_bytes) WHERE media_kind IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_files_media_duration ON files(media_kind, duration_ms) WHERE media_kind IS NOT NULL AND duration_ms IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_files_media_dimensions ON files(media_kind, width, height) WHERE media_kind IS NOT NULL AND width IS NOT NULL AND height IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_files_volume_search ON files(volume_id, media_kind, size_bytes, mtime);
CREATE INDEX IF NOT EXISTS idx_files_complex_search ON files(volume_id, media_kind, size_bytes, mtime, width, height) WHERE media_kind IS NOT NULL;

-- Partial indexes for specific media types (from migration 000008)
CREATE INDEX IF NOT EXISTS idx_files_video_search ON files(volume_id, duration_ms, width, height, video_codec) WHERE media_kind = 'video';
CREATE INDEX IF NOT EXISTS idx_files_audio_search ON files(volume_id, duration_ms, audio_codec, audio_channels) WHERE media_kind = 'audio';
CREATE INDEX IF NOT EXISTS idx_files_image_search ON files(volume_id, width, height, camera_model, capture_datetime) WHERE media_kind = 'image';

-- Unique constraint for files
CREATE UNIQUE INDEX IF NOT EXISTS idx_files_volume_path_unique ON files(volume_id, path_hash);

-- File metadata indexes (from migrations 000005, 000015)
CREATE INDEX IF NOT EXISTS idx_file_metadata_file_id ON file_metadata(file_id);
CREATE INDEX IF NOT EXISTS idx_file_metadata_kind ON file_metadata(kind);
CREATE INDEX IF NOT EXISTS idx_file_metadata_enriched_at ON file_metadata(enriched_at);
CREATE INDEX IF NOT EXISTS idx_file_metadata_file_kind ON file_metadata(file_id, kind);
CREATE INDEX IF NOT EXISTS idx_file_metadata_bulk_insert ON file_metadata(file_id, kind, enriched_at);
CREATE INDEX IF NOT EXISTS idx_file_metadata_volume_stats ON file_metadata(kind, enriched_at) WHERE kind IN ('video', 'audio', 'image', 'subtitle');

-- JSONB indexes for metadata
CREATE INDEX IF NOT EXISTS idx_file_metadata_jsonb_duration ON file_metadata USING GIN (data_json) WHERE kind IN ('video', 'audio');
CREATE INDEX IF NOT EXISTS idx_file_metadata_jsonb_resolution ON file_metadata USING GIN (data_json) WHERE kind IN ('video', 'image');

-- Usage snapshots indexes (from migration 000003)
CREATE INDEX IF NOT EXISTS idx_usage_snapshots_volume_date ON usage_snapshots(volume_id, snapshot_date DESC);
CREATE INDEX IF NOT EXISTS idx_usage_snapshots_date_type ON usage_snapshots(snapshot_date DESC, snapshot_type);
CREATE INDEX IF NOT EXISTS idx_usage_snapshots_volume_type_date ON usage_snapshots(volume_id, snapshot_type, snapshot_date DESC);
CREATE INDEX IF NOT EXISTS idx_usage_snapshots_daily_recent ON usage_snapshots(volume_id, snapshot_date DESC) WHERE snapshot_type = 'daily' AND snapshot_date >= CURRENT_DATE - INTERVAL '90 days';
CREATE INDEX IF NOT EXISTS idx_usage_snapshots_weekly_recent ON usage_snapshots(volume_id, snapshot_date DESC) WHERE snapshot_type = 'weekly' AND snapshot_date >= CURRENT_DATE - INTERVAL '1 year';
CREATE INDEX IF NOT EXISTS idx_usage_snapshots_growth_rate ON usage_snapshots(volume_id, growth_rate_bytes_per_day DESC);

-- Daily stats indexes (from migration 000006)
CREATE INDEX IF NOT EXISTS idx_stats_daily_volume_date ON stats_daily (volume_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_stats_daily_folder_date ON stats_daily (folder_id, date DESC) WHERE folder_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_stats_daily_media_kind ON stats_daily (volume_id, media_kind, date DESC) WHERE media_kind IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_stats_daily_growth ON stats_daily (date DESC, added_bytes DESC) WHERE folder_id IS NOT NULL AND added_bytes > 0;
CREATE INDEX IF NOT EXISTS idx_stats_daily_latest ON stats_daily (volume_id, computed_at DESC);
CREATE INDEX IF NOT EXISTS idx_stats_daily_job_monitoring ON stats_daily (computed_at DESC, job_duration_ms) WHERE scan_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_stats_jobs_monitoring ON stats_jobs (job_type, status, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_stats_jobs_volume ON stats_jobs (volume_id, started_at DESC) WHERE volume_id IS NOT NULL;

-- Alert system indexes (from migration 000007)
CREATE INDEX IF NOT EXISTS idx_alert_rules_enabled ON alert_rules (is_enabled);
CREATE INDEX IF NOT EXISTS idx_alert_rules_created_at ON alert_rules (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_alerts_rule_id ON alerts (rule_id);
CREATE INDEX IF NOT EXISTS idx_alerts_entity ON alerts (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_alerts_status ON alerts (status);
CREATE INDEX IF NOT EXISTS idx_alerts_starts_at ON alerts (starts_at DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_dedupe ON alerts (rule_id, entity_id, dedupe_key);
CREATE INDEX IF NOT EXISTS idx_alerts_active ON alerts (status) WHERE status = 'firing';

CREATE INDEX IF NOT EXISTS idx_alert_destinations_type ON alert_destinations (type);
CREATE INDEX IF NOT EXISTS idx_alert_destinations_enabled ON alert_destinations (is_enabled);

CREATE INDEX IF NOT EXISTS idx_alert_routes_destination_id ON alert_routes (destination_id);
CREATE INDEX IF NOT EXISTS idx_alert_routes_priority ON alert_routes (priority ASC);
CREATE INDEX IF NOT EXISTS idx_alert_routes_enabled ON alert_routes (is_enabled);

CREATE INDEX IF NOT EXISTS idx_alert_deliveries_alert_id ON alert_deliveries (alert_id);
CREATE INDEX IF NOT EXISTS idx_alert_deliveries_destination_id ON alert_deliveries (destination_id);
CREATE INDEX IF NOT EXISTS idx_alert_deliveries_route_id ON alert_deliveries (route_id);
CREATE INDEX IF NOT EXISTS idx_alert_deliveries_status ON alert_deliveries (status);
CREATE INDEX IF NOT EXISTS idx_alert_deliveries_next_attempt ON alert_deliveries (next_attempt_at ASC) WHERE status IN ('pending', 'retrying');
CREATE INDEX IF NOT EXISTS idx_alert_deliveries_created_at ON alert_deliveries (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_alert_deliveries_retry_queue ON alert_deliveries (status, next_attempt_at ASC) WHERE status IN ('pending', 'retrying') AND next_attempt_at IS NOT NULL;

-- Historical analysis indexes
CREATE INDEX IF NOT EXISTS idx_alerts_timeline ON alerts (rule_id, starts_at DESC, ends_at);
CREATE INDEX IF NOT EXISTS idx_alert_deliveries_stats ON alert_deliveries (destination_id, status, created_at DESC);

-- GIN indexes for JSONB queries (from migration 000007)
CREATE INDEX IF NOT EXISTS idx_alert_rules_labels_gin ON alert_rules USING GIN (labels);
CREATE INDEX IF NOT EXISTS idx_alerts_labels_gin ON alerts USING GIN (labels);
CREATE INDEX IF NOT EXISTS idx_alerts_annotations_gin ON alerts USING GIN (annotations);
CREATE INDEX IF NOT EXISTS idx_alert_destinations_config_gin ON alert_destinations USING GIN (config);
CREATE INDEX IF NOT EXISTS idx_alert_routes_matchers_gin ON alert_routes USING GIN (matchers);

-- Saved searches indexes (from migration 000009)
CREATE INDEX IF NOT EXISTS idx_saved_searches_name ON saved_searches(name);
CREATE INDEX IF NOT EXISTS idx_saved_searches_tags ON saved_searches USING gin(tags);
CREATE INDEX IF NOT EXISTS idx_saved_searches_is_public ON saved_searches(is_public);
CREATE INDEX IF NOT EXISTS idx_saved_searches_updated_at ON saved_searches(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_saved_searches_last_run_at ON saved_searches(last_run_at DESC) WHERE last_run_at IS NOT NULL;

-- Preview system indexes (from migration 000010)
CREATE INDEX IF NOT EXISTS idx_previews_file_id ON previews(file_id);
CREATE INDEX IF NOT EXISTS idx_previews_accessed_at ON previews(accessed_at);
CREATE INDEX IF NOT EXISTS idx_previews_content_hash ON previews(content_hash);
CREATE INDEX IF NOT EXISTS idx_previews_storage_path ON previews(storage_path);
CREATE INDEX IF NOT EXISTS idx_previews_type_size ON previews(type, size);

-- Docker mount catalog indexes (from migration 000011)
CREATE INDEX IF NOT EXISTS idx_docker_mount_catalog_mount_id ON docker_mount_catalog(mount_id);
CREATE INDEX IF NOT EXISTS idx_docker_mount_catalog_mount_type ON docker_mount_catalog(mount_type);
CREATE INDEX IF NOT EXISTS idx_docker_mount_catalog_volume_name ON docker_mount_catalog(volume_name) WHERE volume_name IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_docker_mount_catalog_orphaned ON docker_mount_catalog(is_orphaned) WHERE is_orphaned = true;
CREATE INDEX IF NOT EXISTS idx_docker_mount_catalog_tracked ON docker_mount_catalog(is_tracked);
CREATE INDEX IF NOT EXISTS idx_docker_mount_catalog_compose_project ON docker_mount_catalog(compose_project) WHERE compose_project IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_docker_mount_catalog_last_seen ON docker_mount_catalog(last_seen_at);

CREATE INDEX IF NOT EXISTS idx_docker_mount_attachments_mount_id ON docker_mount_attachments(mount_catalog_id);
CREATE INDEX IF NOT EXISTS idx_docker_mount_attachments_container_id ON docker_mount_attachments(container_id);
CREATE INDEX IF NOT EXISTS idx_docker_mount_attachments_active ON docker_mount_attachments(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_docker_mount_attachments_compose_project ON docker_mount_attachments(container_compose_project) WHERE container_compose_project IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_docker_mount_attachments_compose_service ON docker_mount_attachments(container_compose_service) WHERE container_compose_service IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_docker_mount_statistics_mount_id ON docker_mount_statistics(mount_catalog_id);
CREATE INDEX IF NOT EXISTS idx_docker_mount_statistics_calculated_at ON docker_mount_statistics(calculated_at);

-- Composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_docker_mount_catalog_type_tracked ON docker_mount_catalog(mount_type, is_tracked);
CREATE INDEX IF NOT EXISTS idx_docker_mount_catalog_compose_project_type ON docker_mount_catalog(compose_project, mount_type) WHERE compose_project IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_docker_mount_attachments_container_active ON docker_mount_attachments(container_id, is_active);

-- Tracking rules indexes (from migration 000012)
CREATE INDEX IF NOT EXISTS idx_tracking_rules_priority ON tracking_rules (priority ASC, id ASC) WHERE is_enabled = true;
CREATE INDEX IF NOT EXISTS idx_tracking_rules_action ON tracking_rules (action);
CREATE INDEX IF NOT EXISTS idx_tracking_rules_enabled ON tracking_rules (is_enabled);
CREATE INDEX IF NOT EXISTS idx_tracking_rules_updated ON tracking_rules (updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_rule_evaluations_rule_id ON tracking_rule_evaluations (rule_id);
CREATE INDEX IF NOT EXISTS idx_rule_evaluations_type ON tracking_rule_evaluations (evaluation_type);
CREATE INDEX IF NOT EXISTS idx_rule_evaluations_started ON tracking_rule_evaluations (started_at DESC);
CREATE INDEX IF NOT EXISTS idx_rule_evaluations_status ON tracking_rule_evaluations (status);

CREATE INDEX IF NOT EXISTS idx_mount_assignments_mount_id ON mount_tracking_assignments (mount_catalog_id);
CREATE INDEX IF NOT EXISTS idx_mount_assignments_rule_id ON mount_tracking_assignments (rule_id);
CREATE INDEX IF NOT EXISTS idx_mount_assignments_active ON mount_tracking_assignments (is_active, assigned_at DESC);
CREATE INDEX IF NOT EXISTS idx_mount_assignments_action ON mount_tracking_assignments (action) WHERE is_active = true;

-- Ensure one active assignment per mount using unique index
CREATE UNIQUE INDEX IF NOT EXISTS idx_mount_assignments_unique_active ON mount_tracking_assignments (mount_catalog_id) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_rule_conditions_rule_id ON tracking_rule_conditions (rule_id);
CREATE INDEX IF NOT EXISTS idx_rule_conditions_field ON tracking_rule_conditions (field_name);

CREATE INDEX IF NOT EXISTS idx_rule_templates_category ON tracking_rule_templates (category);
CREATE INDEX IF NOT EXISTS idx_rule_templates_builtin ON tracking_rule_templates (is_builtin);

-- =======================================
-- MATERIALIZED VIEWS
-- =======================================

-- Daily stats summary materialized view (from migration 000006)
CREATE MATERIALIZED VIEW IF NOT EXISTS stats_daily_summary AS
SELECT 
    date,
    volume_id,
    -- Volume totals (folder_id IS NULL, media_kind IS NULL)
    SUM(CASE WHEN folder_id IS NULL AND media_kind IS NULL THEN files_count ELSE 0 END) as volume_files_total,
    SUM(CASE WHEN folder_id IS NULL AND media_kind IS NULL THEN total_bytes ELSE 0 END) as volume_bytes_total,
    SUM(CASE WHEN folder_id IS NULL AND media_kind IS NULL THEN added_bytes ELSE 0 END) as volume_added_bytes,
    SUM(CASE WHEN folder_id IS NULL AND media_kind IS NULL THEN removed_bytes ELSE 0 END) as volume_removed_bytes,
    
    -- Media kind breakdown counts
    COUNT(CASE WHEN folder_id IS NULL AND media_kind IS NOT NULL THEN 1 END) as media_kinds_tracked,
    COUNT(CASE WHEN folder_id IS NOT NULL AND media_kind IS NULL THEN 1 END) as folders_tracked,
    
    -- Aggregation metadata
    MAX(computed_at) as last_computed_at,
    COUNT(*) as total_stats_rows
FROM stats_daily
GROUP BY date, volume_id;

-- Index for materialized view
CREATE UNIQUE INDEX IF NOT EXISTS idx_stats_daily_summary_pk ON stats_daily_summary (date, volume_id);

-- Volume enrichment stats materialized view (from migration 000015)
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_volume_enrichment_stats AS
SELECT 
    v.volume_id,
    v.name as volume_name,
    COUNT(f.id) as total_files,
    COUNT(f.id) FILTER (WHERE f.duration_ms IS NOT NULL OR f.capture_datetime IS NOT NULL OR f.subtitle_language IS NOT NULL) as enriched_files,
    COUNT(f.id) FILTER (WHERE f.mime LIKE 'video/%') as video_files,
    COUNT(f.id) FILTER (WHERE f.mime LIKE 'audio/%') as audio_files,
    COUNT(f.id) FILTER (WHERE f.mime LIKE 'image/%') as image_files,
    COUNT(f.id) FILTER (WHERE f.subtitle_language IS NOT NULL) as subtitle_files,
    COALESCE(SUM(f.duration_ms) / 1000.0 / 3600.0, 0) as total_duration_hours,
    COUNT(f.id) FILTER (WHERE f.hdr_format != 'none') as hdr_files,
    COUNT(f.id) FILTER (WHERE f.gps_latitude IS NOT NULL AND f.gps_longitude IS NOT NULL) as gps_files,
    MAX(f.updated_at) as last_updated
FROM volumes v
LEFT JOIN files f ON v.volume_id = f.volume_id
GROUP BY v.volume_id, v.name;

-- Index on the materialized view for fast lookups
CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_volume_enrichment_stats_volume_id ON mv_volume_enrichment_stats(volume_id);
CREATE INDEX IF NOT EXISTS idx_mv_volume_enrichment_stats_enrichment_ratio ON mv_volume_enrichment_stats((enriched_files::float / NULLIF(total_files, 0)) DESC);

-- =======================================
-- VIEWS
-- =======================================

-- Daily stats trends view (from migration 000006)
CREATE OR REPLACE VIEW stats_daily_trends AS
SELECT 
    s.date,
    s.volume_id,
    s.folder_id,
    s.media_kind,
    s.files_count,
    s.total_bytes,
    s.added_bytes,
    s.removed_bytes,
    s.added_files,
    s.removed_files,
    
    -- 7-day trend calculations
    s.total_bytes - COALESCE(s7.total_bytes, 0) as bytes_change_7d,
    s.files_count - COALESCE(s7.files_count, 0) as files_change_7d,
    
    -- 30-day trend calculations  
    s.total_bytes - COALESCE(s30.total_bytes, 0) as bytes_change_30d,
    s.files_count - COALESCE(s30.files_count, 0) as files_change_30d,
    
    -- Growth rates (percentage)
    CASE 
        WHEN COALESCE(s7.total_bytes, 0) > 0 
        THEN ROUND(((s.total_bytes - s7.total_bytes) * 100.0 / s7.total_bytes)::numeric, 2)
        ELSE NULL 
    END as bytes_growth_rate_7d,
    
    CASE 
        WHEN COALESCE(s30.total_bytes, 0) > 0 
        THEN ROUND(((s.total_bytes - s30.total_bytes) * 100.0 / s30.total_bytes)::numeric, 2)
        ELSE NULL 
    END as bytes_growth_rate_30d,
    
    s.computed_at
FROM stats_daily s
LEFT JOIN stats_daily s7 ON (
    s7.volume_id = s.volume_id 
    AND s7.folder_id IS NOT DISTINCT FROM s.folder_id
    AND s7.media_kind IS NOT DISTINCT FROM s.media_kind
    AND s7.date = s.date - INTERVAL '7 days'
)
LEFT JOIN stats_daily s30 ON (
    s30.volume_id = s.volume_id 
    AND s30.folder_id IS NOT DISTINCT FROM s.folder_id
    AND s30.media_kind IS NOT DISTINCT FROM s.media_kind
    AND s30.date = s.date - INTERVAL '30 days'
);

-- Enriched files view (from migration 000005)
CREATE OR REPLACE VIEW enriched_files AS
SELECT 
    f.*,
    CASE 
        WHEN f.duration_ms IS NOT NULL THEN 'video/audio'
        WHEN f.capture_datetime IS NOT NULL THEN 'image'
        WHEN f.subtitle_language IS NOT NULL THEN 'subtitle'
        ELSE 'unenriched'
    END as enrichment_status,
    CASE 
        WHEN f.width IS NOT NULL AND f.height IS NOT NULL THEN 
            f.width || 'x' || f.height 
        ELSE NULL 
    END as resolution,
    CASE 
        WHEN f.duration_ms IS NOT NULL THEN 
            EXTRACT(EPOCH FROM INTERVAL '1 millisecond' * f.duration_ms)::INTEGER 
        ELSE NULL 
    END as duration_seconds,
    CASE 
        WHEN f.gps_latitude IS NOT NULL AND f.gps_longitude IS NOT NULL THEN 
            ST_Point(f.gps_longitude, f.gps_latitude)
        ELSE NULL 
    END as gps_location
FROM files f;

-- Active scans overview (from migration 000014)
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

-- Recent errors summary (from migration 000014)
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

-- Scan progress summary (from migration 000014)
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

-- Index usage stats view (from migration 000015)
CREATE OR REPLACE VIEW index_usage_stats AS
SELECT 
    schemaname,
    relname as tablename,
    indexrelname as indexname,
    idx_scan,
    idx_tup_read,
    idx_tup_fetch,
    pg_size_pretty(pg_relation_size(indexrelid)) as index_size
FROM pg_stat_user_indexes 
WHERE schemaname = 'public'
AND relname IN ('files', 'file_metadata', 'scan_phases', 'scan_progress_items', 'scan_errors', 'folders')
ORDER BY idx_scan DESC, idx_tup_read DESC;

-- =======================================
-- FUNCTIONS AND PROCEDURES
-- =======================================

-- Update trigger function (from migration 000007)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Update folder stats function (from migration 000004)
CREATE OR REPLACE FUNCTION update_folder_stats() RETURNS TRIGGER AS $$
BEGIN
    -- Update parent folder statistics when files change
    IF TG_OP = 'INSERT' THEN
        UPDATE folders 
        SET 
            file_count = file_count + 1,
            size_bytes_recursive = size_bytes_recursive + NEW.size_bytes,
            disk_usage_bytes_recursive = disk_usage_bytes_recursive + NEW.disk_usage_bytes,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = NEW.folder_id;
        
        -- Recursively update parent folders
        WITH RECURSIVE parent_folders AS (
            SELECT parent_id FROM folders WHERE id = NEW.folder_id AND parent_id IS NOT NULL
            UNION ALL
            SELECT f.parent_id FROM folders f 
            INNER JOIN parent_folders pf ON f.id = pf.parent_id
            WHERE f.parent_id IS NOT NULL
        )
        UPDATE folders 
        SET 
            size_bytes_recursive = size_bytes_recursive + NEW.size_bytes,
            disk_usage_bytes_recursive = disk_usage_bytes_recursive + NEW.disk_usage_bytes,
            updated_at = CURRENT_TIMESTAMP
        WHERE id IN (SELECT parent_id FROM parent_folders);
        
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE folders 
        SET 
            file_count = file_count - 1,
            size_bytes_recursive = size_bytes_recursive - OLD.size_bytes,
            disk_usage_bytes_recursive = disk_usage_bytes_recursive - OLD.disk_usage_bytes,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = OLD.folder_id;
        
        -- Recursively update parent folders
        WITH RECURSIVE parent_folders AS (
            SELECT parent_id FROM folders WHERE id = OLD.folder_id AND parent_id IS NOT NULL
            UNION ALL
            SELECT f.parent_id FROM folders f 
            INNER JOIN parent_folders pf ON f.id = pf.parent_id
            WHERE f.parent_id IS NOT NULL
        )
        UPDATE folders 
        SET 
            size_bytes_recursive = size_bytes_recursive - OLD.size_bytes,
            disk_usage_bytes_recursive = disk_usage_bytes_recursive - OLD.disk_usage_bytes,
            updated_at = CURRENT_TIMESTAMP
        WHERE id IN (SELECT parent_id FROM parent_folders);
        
        RETURN OLD;
    ELSIF TG_OP = 'UPDATE' THEN
        UPDATE folders 
        SET 
            size_bytes_recursive = size_bytes_recursive - OLD.size_bytes + NEW.size_bytes,
            disk_usage_bytes_recursive = disk_usage_bytes_recursive - OLD.disk_usage_bytes + NEW.disk_usage_bytes,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = NEW.folder_id;
        
        -- Recursively update parent folders
        WITH RECURSIVE parent_folders AS (
            SELECT parent_id FROM folders WHERE id = NEW.folder_id AND parent_id IS NOT NULL
            UNION ALL
            SELECT f.parent_id FROM folders f 
            INNER JOIN parent_folders pf ON f.id = pf.parent_id
            WHERE f.parent_id IS NOT NULL
        )
        UPDATE folders 
        SET 
            size_bytes_recursive = size_bytes_recursive - OLD.size_bytes + NEW.size_bytes,
            disk_usage_bytes_recursive = disk_usage_bytes_recursive - OLD.disk_usage_bytes + NEW.disk_usage_bytes,
            updated_at = CURRENT_TIMESTAMP
        WHERE id IN (SELECT parent_id FROM parent_folders);
        
        RETURN NEW;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Update folder dir counts function (from migration 000004)
CREATE OR REPLACE FUNCTION update_folder_dir_counts() RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        -- Update parent folder dir count
        IF NEW.parent_id IS NOT NULL THEN
            UPDATE folders 
            SET 
                dir_count = dir_count + 1,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = NEW.parent_id;
        END IF;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        -- Update parent folder dir count
        IF OLD.parent_id IS NOT NULL THEN
            UPDATE folders 
            SET 
                dir_count = dir_count - 1,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = OLD.parent_id;
        END IF;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Update file enriched columns function (from migration 000005)
CREATE OR REPLACE FUNCTION update_file_enriched_columns() RETURNS TRIGGER AS $$
BEGIN
    -- Update files table with flattened metadata based on kind
    IF NEW.kind = 'video' OR NEW.kind = 'audio' THEN
        UPDATE files SET
            duration_ms = COALESCE((NEW.data_json->>'duration_ms')::BIGINT, duration_ms),
            bitrate_kbps = COALESCE((NEW.data_json->>'bitrate_kbps')::INTEGER, bitrate_kbps),
            width = COALESCE((NEW.data_json->>'width')::INTEGER, width),
            height = COALESCE((NEW.data_json->>'height')::INTEGER, height),
            fps = COALESCE((NEW.data_json->>'fps')::DECIMAL, fps),
            color_primaries = COALESCE(NEW.data_json->>'color_primaries', color_primaries),
            transfer_characteristic = COALESCE(NEW.data_json->>'transfer_characteristic', transfer_characteristic),
            hdr_format = COALESCE((NEW.data_json->>'hdr_format')::hdr_format, hdr_format),
            audio_channels = COALESCE((NEW.data_json->>'audio_channels')::INTEGER, audio_channels),
            audio_codec = COALESCE(NEW.data_json->>'audio_codec', audio_codec),
            audio_sample_rate = COALESCE((NEW.data_json->>'audio_sample_rate')::INTEGER, audio_sample_rate),
            video_codec = COALESCE(NEW.data_json->>'video_codec', video_codec),
            video_profile = COALESCE(NEW.data_json->>'video_profile', video_profile),
            video_level = COALESCE(NEW.data_json->>'video_level', video_level)
        WHERE id = NEW.file_id;
    END IF;
    
    IF NEW.kind = 'image' THEN
        UPDATE files SET
            width = COALESCE((NEW.data_json->>'width')::INTEGER, width),
            height = COALESCE((NEW.data_json->>'height')::INTEGER, height),
            capture_datetime = COALESCE((NEW.data_json->>'capture_datetime')::TIMESTAMPTZ, capture_datetime),
            camera_make = COALESCE(NEW.data_json->>'camera_make', camera_make),
            camera_model = COALESCE(NEW.data_json->>'camera_model', camera_model),
            lens_model = COALESCE(NEW.data_json->>'lens_model', lens_model),
            orientation = COALESCE((NEW.data_json->>'orientation')::INTEGER, orientation),
            gps_latitude = COALESCE((NEW.data_json->>'gps_latitude')::DECIMAL, gps_latitude),
            gps_longitude = COALESCE((NEW.data_json->>'gps_longitude')::DECIMAL, gps_longitude)
        WHERE id = NEW.file_id;
    END IF;
    
    IF NEW.kind = 'subtitle' THEN
        UPDATE files SET
            subtitle_language = COALESCE(NEW.data_json->>'language', subtitle_language),
            subtitle_format = COALESCE(NEW.data_json->>'format', subtitle_format),
            cue_count = COALESCE((NEW.data_json->>'cue_count')::INTEGER, cue_count),
            coverage_percent = COALESCE((NEW.data_json->>'coverage_percent')::DECIMAL, coverage_percent)
        WHERE id = NEW.file_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Media statistics function (from migration 000005)
CREATE OR REPLACE FUNCTION get_media_statistics(volume_id_param TEXT DEFAULT NULL)
RETURNS TABLE (
    total_files BIGINT,
    enriched_files BIGINT,
    video_files BIGINT,
    audio_files BIGINT,
    image_files BIGINT,
    subtitle_files BIGINT,
    total_duration_hours DECIMAL,
    total_resolution_pixels BIGINT,
    hdr_files BIGINT,
    gps_enabled_files BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*) as total_files,
        COUNT(*) FILTER (WHERE 
            duration_ms IS NOT NULL OR 
            capture_datetime IS NOT NULL OR 
            subtitle_language IS NOT NULL
        ) as enriched_files,
        COUNT(*) FILTER (WHERE mime LIKE 'video/%') as video_files,
        COUNT(*) FILTER (WHERE mime LIKE 'audio/%') as audio_files,
        COUNT(*) FILTER (WHERE mime LIKE 'image/%') as image_files,
        COUNT(*) FILTER (WHERE subtitle_language IS NOT NULL) as subtitle_files,
        ROUND(SUM(duration_ms) / 1000.0 / 3600.0, 2) as total_duration_hours,
        SUM(COALESCE(width, 0) * COALESCE(height, 0)) as total_resolution_pixels,
        COUNT(*) FILTER (WHERE hdr_format != 'none') as hdr_files,
        COUNT(*) FILTER (WHERE gps_latitude IS NOT NULL AND gps_longitude IS NOT NULL) as gps_enabled_files
    FROM files f
    WHERE volume_id_param IS NULL OR f.volume_id = volume_id_param;
END;
$$ LANGUAGE plpgsql;

-- Update saved searches trigger function (from migration 000009)
CREATE OR REPLACE FUNCTION update_saved_searches_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Update preview access time function (from migration 000010)
CREATE OR REPLACE FUNCTION update_preview_access_time()
RETURNS TRIGGER AS $$
BEGIN
    NEW.accessed_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Update tracking rules timestamp function (from migration 000012)
CREATE OR REPLACE FUNCTION update_tracking_rules_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Update scan phase progress function (from migration 000014)
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

-- Record scan error function (from migration 000014)
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

-- Refresh materialized view function (from migration 000015)
CREATE OR REPLACE FUNCTION refresh_volume_enrichment_stats() RETURNS VOID AS $$
BEGIN
    REFRESH MATERIALIZED VIEW mv_volume_enrichment_stats;
END;
$$ LANGUAGE plpgsql;

-- Analyze unenriched files performance function (from migration 000015)
CREATE OR REPLACE FUNCTION analyze_unenriched_files_performance(p_volume_id TEXT DEFAULT NULL)
RETURNS TABLE (
    volume_id TEXT,
    total_files BIGINT,
    video_unenriched BIGINT,
    audio_unenriched BIGINT, 
    image_unenriched BIGINT,
    subtitle_unenriched BIGINT,
    estimated_enrichment_time_hours DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        f.volume_id,
        COUNT(*) as total_files,
        COUNT(*) FILTER (WHERE f.mime LIKE 'video/%' AND (f.duration_ms IS NULL OR f.video_codec IS NULL)) as video_unenriched,
        COUNT(*) FILTER (WHERE f.mime LIKE 'audio/%' AND (f.duration_ms IS NULL OR f.audio_codec IS NULL)) as audio_unenriched,
        COUNT(*) FILTER (WHERE f.mime LIKE 'image/%' AND (f.width IS NULL OR f.height IS NULL OR f.capture_datetime IS NULL)) as image_unenriched,
        COUNT(*) FILTER (WHERE f.mime IN ('text/vtt', 'application/x-subrip', 'text/x-ssa', 'text/x-ass') AND f.subtitle_language IS NULL) as subtitle_unenriched,
        -- Estimate enrichment time based on file types (video: 2s, audio: 1s, image: 0.5s, subtitle: 0.1s)
        ROUND(
            (COUNT(*) FILTER (WHERE f.mime LIKE 'video/%' AND (f.duration_ms IS NULL OR f.video_codec IS NULL)) * 2.0 +
             COUNT(*) FILTER (WHERE f.mime LIKE 'audio/%' AND (f.duration_ms IS NULL OR f.audio_codec IS NULL)) * 1.0 +
             COUNT(*) FILTER (WHERE f.mime LIKE 'image/%' AND (f.width IS NULL OR f.height IS NULL OR f.capture_datetime IS NULL)) * 0.5 +
             COUNT(*) FILTER (WHERE f.mime IN ('text/vtt', 'application/x-subrip', 'text/x-ssa', 'text/x-ass') AND f.subtitle_language IS NULL) * 0.1
            ) / 3600.0, 2
        ) as estimated_enrichment_time_hours
    FROM files f
    WHERE (p_volume_id IS NULL OR f.volume_id = p_volume_id)
    AND f.mime IN (
        'video/mp4', 'video/x-msvideo', 'video/x-matroska', 'video/quicktime', 'video/x-ms-wmv', 'video/x-flv', 'video/webm',
        'audio/mpeg', 'audio/flac', 'audio/wav', 'audio/aac', 'audio/ogg', 'audio/mp4',
        'image/jpeg', 'image/png', 'image/tiff', 'image/bmp', 'image/webp', 'image/heic',
        'text/vtt', 'application/x-subrip', 'text/x-ssa', 'text/x-ass'
    )
    GROUP BY f.volume_id;
END;
$$ LANGUAGE plpgsql;

-- Unused index recommendations function (from migration 000015)
CREATE OR REPLACE FUNCTION get_unused_index_recommendations()
RETURNS TABLE (
    schema_name TEXT,
    table_name TEXT,
    index_name TEXT,
    index_size TEXT,
    scans BIGINT,
    tuples_read BIGINT,
    recommendation TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        schemaname::TEXT,
        relname::TEXT as table_name,
        indexrelname::TEXT as index_name,
        pg_size_pretty(pg_relation_size(indexrelid))::TEXT,
        idx_scan,
        idx_tup_read,
        CASE 
            WHEN idx_scan = 0 THEN 'Consider dropping - never used'
            WHEN idx_scan < 10 AND pg_relation_size(indexrelid) > 1024*1024 THEN 'Consider dropping - rarely used and large'
            WHEN idx_tup_read / GREATEST(idx_scan, 1) < 2 THEN 'Review usage - low efficiency'
            ELSE 'Keep - good usage pattern'
        END::TEXT as recommendation
    FROM pg_stat_user_indexes 
    WHERE schemaname = 'public'
    AND relname IN ('files', 'file_metadata', 'scan_phases', 'scan_progress_items', 'scan_errors', 'folders')
    ORDER BY 
        CASE 
            WHEN idx_scan = 0 THEN 1
            WHEN idx_scan < 10 AND pg_relation_size(indexrelid) > 1024*1024 THEN 2
            ELSE 3
        END,
        pg_relation_size(indexrelid) DESC;
END;
$$ LANGUAGE plpgsql;

-- =======================================
-- TRIGGERS
-- =======================================

-- Folder statistics triggers (from migration 000004)
CREATE TRIGGER trigger_update_folder_stats
    AFTER INSERT OR UPDATE OR DELETE ON files
    FOR EACH ROW EXECUTE FUNCTION update_folder_stats();

CREATE TRIGGER trigger_update_folder_dir_counts
    AFTER INSERT OR DELETE ON folders
    FOR EACH ROW EXECUTE FUNCTION update_folder_dir_counts();

-- File metadata enrichment trigger (from migration 000005)
DROP TRIGGER IF EXISTS trigger_update_file_enriched_columns ON file_metadata;
CREATE TRIGGER trigger_update_file_enriched_columns
    AFTER INSERT OR UPDATE ON file_metadata
    FOR EACH ROW
    EXECUTE FUNCTION update_file_enriched_columns();

-- Alert system triggers (from migration 000007)
CREATE TRIGGER update_alert_rules_updated_at BEFORE UPDATE ON alert_rules 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_alerts_updated_at BEFORE UPDATE ON alerts 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_alert_destinations_updated_at BEFORE UPDATE ON alert_destinations 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_alert_routes_updated_at BEFORE UPDATE ON alert_routes 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_alert_deliveries_updated_at BEFORE UPDATE ON alert_deliveries 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Saved searches trigger (from migration 000009)
CREATE TRIGGER trigger_saved_searches_updated_at
    BEFORE UPDATE ON saved_searches
    FOR EACH ROW
    EXECUTE FUNCTION update_saved_searches_updated_at();

-- Preview access time trigger (from migration 000010)
CREATE TRIGGER trigger_update_preview_access_time
    BEFORE UPDATE ON previews
    FOR EACH ROW
    EXECUTE FUNCTION update_preview_access_time();

-- Tracking rules triggers (from migration 000012)
CREATE TRIGGER tracking_rules_updated_at_trigger
    BEFORE UPDATE ON tracking_rules
    FOR EACH ROW
    EXECUTE FUNCTION update_tracking_rules_updated_at();

CREATE TRIGGER mount_tracking_assignments_updated_at_trigger
    BEFORE UPDATE ON mount_tracking_assignments
    FOR EACH ROW
    EXECUTE FUNCTION update_tracking_rules_updated_at();

CREATE TRIGGER tracking_rule_conditions_updated_at_trigger
    BEFORE UPDATE ON tracking_rule_conditions
    FOR EACH ROW
    EXECUTE FUNCTION update_tracking_rules_updated_at();

CREATE TRIGGER tracking_rule_templates_updated_at_trigger
    BEFORE UPDATE ON tracking_rule_templates
    FOR EACH ROW
    EXECUTE FUNCTION update_tracking_rules_updated_at();

-- =======================================
-- INITIAL DATA
-- =======================================

-- Insert initial preview stats row (from migration 000010)
INSERT INTO preview_stats (total_generated, total_size_bytes, cache_hits, cache_misses)
VALUES (0, 0, 0, 0)
ON CONFLICT DO NOTHING;

-- Insert default rule templates (from migration 000012)
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
)
ON CONFLICT (name) DO NOTHING;

-- =======================================
-- SCHEMA VALIDATION COMMENTS
-- =======================================

COMMENT ON DATABASE CURRENT_DATABASE() IS 'VolumeViz consolidated schema - PostgreSQL optimized storage for Docker volume analysis and monitoring';

COMMENT ON TABLE volumes IS 'Core volume registry with Docker volume metadata';
COMMENT ON TABLE volume_sizes IS 'Volume scan results including filesystem capacity information';
COMMENT ON TABLE containers IS 'Docker container registry';
COMMENT ON TABLE volume_mounts IS 'Container-volume mount relationships';

COMMENT ON TABLE scan_jobs IS 'Master scan job tracking with multi-phase support';
COMMENT ON TABLE scan_phases IS 'Detailed scan phase tracking with progress monitoring';
COMMENT ON TABLE scan_progress_items IS 'Individual item processing tracking for scans';
COMMENT ON TABLE scan_errors IS 'Comprehensive error tracking for all scan failures';
COMMENT ON TABLE scan_performance_metrics IS 'Performance metrics tracking over time';

COMMENT ON TABLE folders IS 'Enhanced folder tree with recursive statistics and metadata';
COMMENT ON TABLE files IS 'Enhanced file records with rich metadata and media enrichment';
COMMENT ON TABLE file_metadata IS 'Detailed JSONB metadata for enriched files';

COMMENT ON TABLE usage_snapshots IS 'Time-series data for volume usage trends';
COMMENT ON TABLE stats_daily IS 'Daily aggregated statistics with delta tracking';
COMMENT ON TABLE stats_jobs IS 'Job status tracking for statistics computation';

COMMENT ON TABLE alert_rules IS 'Alert rule definitions with conditions and thresholds';
COMMENT ON TABLE alerts IS 'Active and resolved alerts with deduplication';
COMMENT ON TABLE alert_destinations IS 'Alert delivery destinations (webhook, slack, etc.)';
COMMENT ON TABLE alert_routes IS 'Alert routing rules with matchers';
COMMENT ON TABLE alert_deliveries IS 'Alert delivery tracking and retry management';

COMMENT ON TABLE saved_searches IS 'User-defined search queries for reuse';
COMMENT ON TABLE previews IS 'Generated preview metadata with content addressing';
COMMENT ON TABLE preview_stats IS 'Preview system monitoring and statistics';

COMMENT ON TABLE docker_mount_catalog IS 'Canonical Docker mount discovery and tracking';
COMMENT ON TABLE docker_mount_attachments IS 'Container mount attachment tracking';
COMMENT ON TABLE docker_mount_statistics IS 'Aggregated mount usage statistics';

COMMENT ON TABLE tracking_rules IS 'Rule-based mount tracking with priorities';
COMMENT ON TABLE tracking_rule_evaluations IS 'Rule evaluation history and performance';
COMMENT ON TABLE mount_tracking_assignments IS 'Mount tracking assignment results';
COMMENT ON TABLE tracking_rule_conditions IS 'Validated rule condition schemas';
COMMENT ON TABLE tracking_rule_templates IS 'Predefined rule templates and patterns';

COMMENT ON TABLE volume_metrics IS 'Time-series volume metrics for trends and analysis';