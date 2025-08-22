-- PostgreSQL schema for sqlc code generation

-- Volumes table
CREATE TABLE IF NOT EXISTS volumes (
    id BIGSERIAL PRIMARY KEY,
    volume_id TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    driver TEXT NOT NULL DEFAULT 'local',
    mountpoint TEXT NOT NULL,
    labels TEXT DEFAULT '{}',
    options TEXT DEFAULT '{}',
    scope TEXT DEFAULT 'local',
    status TEXT DEFAULT 'active',
    last_scanned TIMESTAMP,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Containers table
CREATE TABLE IF NOT EXISTS containers (
    id BIGSERIAL PRIMARY KEY,
    container_id TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    image TEXT NOT NULL,
    state TEXT NOT NULL,
    status TEXT,
    labels TEXT DEFAULT '{}',
    started_at TIMESTAMP,
    finished_at TIMESTAMP,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Volume mounts table
CREATE TABLE IF NOT EXISTS volume_mounts (
    id BIGSERIAL PRIMARY KEY,
    volume_id TEXT NOT NULL,
    container_id TEXT NOT NULL,
    mount_path TEXT NOT NULL,
    access_mode TEXT NOT NULL DEFAULT 'rw',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (volume_id) REFERENCES volumes(volume_id) ON DELETE CASCADE,
    FOREIGN KEY (container_id) REFERENCES containers(container_id) ON DELETE CASCADE,
    UNIQUE(volume_id, container_id, mount_path)
);

-- Enhanced folders table with rich metadata
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
    media_kind TEXT, -- Primary media type for the folder
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

-- HDR format enumeration
DO $$ BEGIN
    CREATE TYPE hdr_format AS ENUM ('none', 'hdr10', 'hdr10+', 'dovi');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Enhanced files table with rich metadata
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
    -- Media metadata columns
    duration_ms BIGINT,
    bitrate_kbps INTEGER,
    width INTEGER,
    height INTEGER,
    fps DECIMAL(8,3),
    color_primaries TEXT,
    transfer_characteristic TEXT,
    hdr_format hdr_format DEFAULT 'none',
    capture_datetime TIMESTAMPTZ,
    camera_make TEXT,
    camera_model TEXT,
    lens_model TEXT,
    orientation INTEGER,
    gps_latitude DECIMAL(10,8),
    gps_longitude DECIMAL(11,8),
    subtitle_language TEXT,
    subtitle_format TEXT,
    cue_count INTEGER,
    coverage_percent DECIMAL(5,2),
    audio_channels INTEGER,
    audio_codec TEXT,
    audio_sample_rate INTEGER,
    video_codec TEXT,
    video_profile TEXT,
    video_level TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (volume_id) REFERENCES volumes(volume_id) ON DELETE CASCADE
);

-- File metadata table for enriched media data
CREATE TABLE IF NOT EXISTS file_metadata (
    id BIGSERIAL PRIMARY KEY,
    file_id BIGINT NOT NULL,
    kind TEXT NOT NULL, -- 'audio', 'video', 'image', 'subtitle'
    data_json JSONB NOT NULL,
    enriched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE
);

-- Usage snapshots table
CREATE TABLE IF NOT EXISTS usage_snapshots (
    id BIGSERIAL PRIMARY KEY,
    volume_id TEXT NOT NULL,
    snapshot_date TIMESTAMP NOT NULL,
    snapshot_type TEXT NOT NULL,
    total_size BIGINT NOT NULL,
    file_count BIGINT NOT NULL,
    directory_count BIGINT NOT NULL,
    largest_file BIGINT NOT NULL,
    growth_bytes BIGINT,
    growth_files BIGINT,
    growth_rate_bytes_per_day DOUBLE PRECISION,
    scan_method TEXT NOT NULL,
    scan_duration_ms BIGINT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Volume sizes table
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
    is_valid BOOLEAN DEFAULT true,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    -- Filesystem capacity columns (added in migration 000013)
    fs_total_bytes BIGINT,
    fs_available_bytes BIGINT,
    fs_used_bytes BIGINT,
    fs_usage_percent NUMERIC(5,2),
    fs_block_size BIGINT,
    fs_total_blocks BIGINT,
    fs_free_blocks BIGINT
);

-- Scan jobs table
CREATE TABLE IF NOT EXISTS scan_jobs (
    id BIGSERIAL PRIMARY KEY,
    scan_id TEXT NOT NULL UNIQUE,
    volume_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'queued',
    progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
    method TEXT NOT NULL,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    error_message TEXT,
    result_id BIGINT,
    estimated_duration BIGINT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Volume metrics table
CREATE TABLE IF NOT EXISTS volume_metrics (
    id BIGSERIAL PRIMARY KEY,
    volume_id TEXT NOT NULL,
    metric_timestamp TIMESTAMP NOT NULL,
    total_size BIGINT NOT NULL,
    file_count BIGINT NOT NULL,
    directory_count BIGINT NOT NULL,
    growth_rate DOUBLE PRECISION,
    access_frequency BIGINT DEFAULT 0,
    container_count BIGINT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Daily stats table for tracking growth, churn, and composition
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

-- Indexes for efficient querying

-- Primary query patterns: by volume + date range
CREATE INDEX IF NOT EXISTS idx_stats_daily_volume_date 
    ON stats_daily (volume_id, date DESC);

-- Folder-level trends
CREATE INDEX IF NOT EXISTS idx_stats_daily_folder_date 
    ON stats_daily (folder_id, date DESC) 
    WHERE folder_id IS NOT NULL;

-- Media kind analysis
CREATE INDEX IF NOT EXISTS idx_stats_daily_media_kind 
    ON stats_daily (volume_id, media_kind, date DESC) 
    WHERE media_kind IS NOT NULL;

-- Growth analysis - top growing folders
CREATE INDEX IF NOT EXISTS idx_stats_daily_growth 
    ON stats_daily (date DESC, added_bytes DESC) 
    WHERE folder_id IS NOT NULL AND added_bytes > 0;

-- Latest stats lookup
CREATE INDEX IF NOT EXISTS idx_stats_daily_latest 
    ON stats_daily (volume_id, computed_at DESC);

-- Job monitoring index
CREATE INDEX IF NOT EXISTS idx_stats_daily_job_monitoring 
    ON stats_daily (computed_at DESC, job_duration_ms) 
    WHERE scan_id IS NOT NULL;

-- Preview tables for thumbnails, posters, and cover art
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

-- Preview stats table for monitoring
CREATE TABLE IF NOT EXISTS preview_stats (
    id BIGSERIAL PRIMARY KEY,
    total_generated BIGINT DEFAULT 0,
    total_size_bytes BIGINT DEFAULT 0,
    cache_hits BIGINT DEFAULT 0,
    cache_misses BIGINT DEFAULT 0,
    last_cleanup TIMESTAMP WITH TIME ZONE,
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create a view for easy trend calculations
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

-- Create materialized view for performance on large datasets
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
CREATE UNIQUE INDEX IF NOT EXISTS idx_stats_daily_summary_pk 
    ON stats_daily_summary (date, volume_id);

-- Job status tracking table
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

-- Index for job monitoring
CREATE INDEX IF NOT EXISTS idx_stats_jobs_monitoring 
    ON stats_jobs (job_type, status, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_stats_jobs_volume 
    ON stats_jobs (volume_id, started_at DESC) 
    WHERE volume_id IS NOT NULL;

-- =============================================================================
-- ALERTS SYSTEM SCHEMA
-- =============================================================================

-- Alert rules table
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

-- Alerts table
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

-- Alert destinations table
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

-- Alert routes table
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

-- Alert deliveries table
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

-- Alerts system indexes
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
CREATE INDEX IF NOT EXISTS idx_alert_deliveries_next_attempt ON alert_deliveries (next_attempt_at ASC) 
    WHERE status IN ('pending', 'retrying');
CREATE INDEX IF NOT EXISTS idx_alert_deliveries_created_at ON alert_deliveries (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_alert_deliveries_retry_queue ON alert_deliveries (status, next_attempt_at ASC)
    WHERE status IN ('pending', 'retrying') AND next_attempt_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_alerts_timeline ON alerts (rule_id, starts_at DESC, ends_at);
CREATE INDEX IF NOT EXISTS idx_alert_deliveries_stats ON alert_deliveries (destination_id, status, created_at DESC);

-- GIN indexes for JSONB queries
CREATE INDEX IF NOT EXISTS idx_alert_rules_labels_gin ON alert_rules USING GIN (labels);
CREATE INDEX IF NOT EXISTS idx_alerts_labels_gin ON alerts USING GIN (labels);
CREATE INDEX IF NOT EXISTS idx_alerts_annotations_gin ON alerts USING GIN (annotations);
CREATE INDEX IF NOT EXISTS idx_alert_destinations_config_gin ON alert_destinations USING GIN (config);
CREATE INDEX IF NOT EXISTS idx_alert_routes_matchers_gin ON alert_routes USING GIN (matchers);
-- Saved Searches Table for search functionality
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

-- Indexes for saved searches
CREATE INDEX IF NOT EXISTS idx_saved_searches_name ON saved_searches(name);
CREATE INDEX IF NOT EXISTS idx_saved_searches_tags ON saved_searches USING gin(tags);
CREATE INDEX IF NOT EXISTS idx_saved_searches_is_public ON saved_searches(is_public);
CREATE INDEX IF NOT EXISTS idx_saved_searches_updated_at ON saved_searches(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_saved_searches_last_run_at ON saved_searches(last_run_at DESC) WHERE last_run_at IS NOT NULL;

-- =============================================================================
-- DOCKER MOUNT CATALOG SCHEMA (VV-301)
-- =============================================================================

-- Mount types enumeration
DO $$ BEGIN
    CREATE TYPE mount_type AS ENUM ('volume', 'bind', 'tmpfs');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Mount access modes enumeration  
DO $$ BEGIN
    CREATE TYPE mount_access_mode AS ENUM ('rw', 'ro');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Docker mount catalog table
-- Canonical source of truth for all Docker mounts discovered from Engine
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

-- Docker mount attachments table
-- Tracks which containers have which mounts attached
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

-- Docker mount statistics table
-- Aggregated statistics about mount usage patterns
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

-- Performance indexes
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
-- VV-302: Tracking Rules Engine Schema
-- Ordered rule-based system for Docker mount tracking with preview functionality

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

-- Tracking rules table - ordered rule definitions
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

-- Rule evaluation history - tracks when rules are evaluated
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

-- Mount tracking assignments - results of rule evaluation
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

-- Rule conditions validation - stores validated condition schemas
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

-- Rule templates - predefined rule patterns
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

-- Indexes for performance
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

-- Create function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_tracking_rules_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for automatic timestamp updates
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