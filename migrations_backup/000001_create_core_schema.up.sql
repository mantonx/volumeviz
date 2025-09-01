-- VolumeViz Core Schema Migration
-- Creates the foundational tables for the application
-- Updated for PostgreSQL with unused tables removed

-- Volumes table
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
    is_valid BOOLEAN DEFAULT TRUE,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (volume_id) REFERENCES volumes(volume_id) ON DELETE CASCADE
);

-- Containers table
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

-- Volume mounts table
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

-- Scan jobs table
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
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (volume_id) REFERENCES volumes(volume_id) ON DELETE CASCADE,
    FOREIGN KEY (result_id) REFERENCES volume_sizes(id) ON DELETE SET NULL
);

-- Volume metrics table
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

-- Note: Removed unused tables system_health, scan_cache, docker_events
-- These were never implemented and had no SQLC queries

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_volumes_volume_id ON volumes(volume_id);
CREATE INDEX IF NOT EXISTS idx_volumes_name ON volumes(name);
CREATE INDEX IF NOT EXISTS idx_volumes_last_scanned ON volumes(last_scanned);
CREATE INDEX IF NOT EXISTS idx_volumes_status_active ON volumes(status, is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_volumes_created_at ON volumes(created_at);

CREATE INDEX IF NOT EXISTS idx_volume_sizes_volume_id ON volume_sizes(volume_id);
CREATE INDEX IF NOT EXISTS idx_volume_sizes_created_at ON volume_sizes(created_at);
CREATE INDEX IF NOT EXISTS idx_volume_sizes_total_size ON volume_sizes(total_size);
CREATE INDEX IF NOT EXISTS idx_volume_sizes_valid_volume_created ON volume_sizes(volume_id, created_at) WHERE is_valid = TRUE;

CREATE INDEX IF NOT EXISTS idx_containers_container_id ON containers(container_id);
CREATE INDEX IF NOT EXISTS idx_containers_name ON containers(name);
CREATE INDEX IF NOT EXISTS idx_containers_state ON containers(state);
CREATE INDEX IF NOT EXISTS idx_containers_image ON containers(image);
CREATE INDEX IF NOT EXISTS idx_containers_active_state ON containers(is_active, state) WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS idx_volume_mounts_volume_id ON volume_mounts(volume_id);
CREATE INDEX IF NOT EXISTS idx_volume_mounts_container_id ON volume_mounts(container_id);
CREATE INDEX IF NOT EXISTS idx_volume_mounts_active ON volume_mounts(is_active) WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS idx_scan_jobs_scan_id ON scan_jobs(scan_id);
CREATE INDEX IF NOT EXISTS idx_scan_jobs_volume_id ON scan_jobs(volume_id);
CREATE INDEX IF NOT EXISTS idx_scan_jobs_status ON scan_jobs(status);
CREATE INDEX IF NOT EXISTS idx_scan_jobs_created_at ON scan_jobs(created_at);
CREATE INDEX IF NOT EXISTS idx_scan_jobs_pending ON scan_jobs(status) WHERE status IN ('queued', 'scanning');

CREATE INDEX IF NOT EXISTS idx_volume_metrics_volume_id ON volume_metrics(volume_id);
CREATE INDEX IF NOT EXISTS idx_volume_metrics_timestamp ON volume_metrics(metric_timestamp);
CREATE INDEX IF NOT EXISTS idx_volume_metrics_volume_timestamp ON volume_metrics(volume_id, metric_timestamp);