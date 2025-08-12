-- PostgreSQL Core Schema for VolumeViz
-- This is an idempotent schema file - can be run multiple times safely

-- Migration history table
CREATE TABLE IF NOT EXISTS migration_history (
    id SERIAL PRIMARY KEY,
    version VARCHAR(255) NOT NULL UNIQUE,
    description TEXT NOT NULL,
    applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    rollback_sql TEXT,
    checksum VARCHAR(32) NOT NULL,
    execution_time BIGINT NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_migration_history_version ON migration_history(version);
CREATE INDEX IF NOT EXISTS idx_migration_history_applied_at ON migration_history(applied_at);

-- Volumes table
CREATE TABLE IF NOT EXISTS volumes (
    id SERIAL PRIMARY KEY,
    volume_id VARCHAR(255) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    driver VARCHAR(100) NOT NULL DEFAULT 'local',
    mountpoint TEXT NOT NULL,
    labels JSONB DEFAULT '{}',
    options JSONB DEFAULT '{}',
    scope VARCHAR(50) DEFAULT 'local',
    status VARCHAR(50) DEFAULT 'active',
    last_scanned TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Volume sizes table
CREATE TABLE IF NOT EXISTS volume_sizes (
    id SERIAL PRIMARY KEY,
    volume_id VARCHAR(255) NOT NULL,
    total_size BIGINT NOT NULL DEFAULT 0,
    file_count BIGINT NOT NULL DEFAULT 0,
    directory_count BIGINT NOT NULL DEFAULT 0,
    largest_file BIGINT NOT NULL DEFAULT 0,
    scan_method VARCHAR(50) NOT NULL,
    scan_duration BIGINT NOT NULL DEFAULT 0,
    filesystem_type VARCHAR(100),
    checksum_md5 VARCHAR(32),
    is_valid BOOLEAN DEFAULT true,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (volume_id) REFERENCES volumes(volume_id) ON DELETE CASCADE
);

-- Containers table
CREATE TABLE IF NOT EXISTS containers (
    id SERIAL PRIMARY KEY,
    container_id VARCHAR(255) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    image VARCHAR(500) NOT NULL,
    state VARCHAR(50) NOT NULL,
    status TEXT,
    labels JSONB DEFAULT '{}',
    started_at TIMESTAMP WITH TIME ZONE,
    finished_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Volume mounts table
CREATE TABLE IF NOT EXISTS volume_mounts (
    id SERIAL PRIMARY KEY,
    volume_id VARCHAR(255) NOT NULL,
    container_id VARCHAR(255) NOT NULL,
    mount_path TEXT NOT NULL,
    access_mode VARCHAR(10) NOT NULL DEFAULT 'rw',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (volume_id) REFERENCES volumes(volume_id) ON DELETE CASCADE,
    FOREIGN KEY (container_id) REFERENCES containers(container_id) ON DELETE CASCADE,
    UNIQUE(volume_id, container_id, mount_path)
);

-- Scan jobs table
CREATE TABLE IF NOT EXISTS scan_jobs (
    id SERIAL PRIMARY KEY,
    scan_id VARCHAR(255) NOT NULL UNIQUE,
    volume_id VARCHAR(255) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'queued',
    progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
    method VARCHAR(50) NOT NULL,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    result_id INTEGER,
    estimated_duration BIGINT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (volume_id) REFERENCES volumes(volume_id) ON DELETE CASCADE,
    FOREIGN KEY (result_id) REFERENCES volume_sizes(id) ON DELETE SET NULL
);

-- Volume metrics table
CREATE TABLE IF NOT EXISTS volume_metrics (
    id SERIAL PRIMARY KEY,
    volume_id VARCHAR(255) NOT NULL,
    metric_timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    total_size BIGINT NOT NULL,
    file_count BIGINT NOT NULL,
    directory_count BIGINT NOT NULL,
    growth_rate DOUBLE PRECISION,
    access_frequency INTEGER DEFAULT 0,
    container_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (volume_id) REFERENCES volumes(volume_id) ON DELETE CASCADE,
    UNIQUE(volume_id, metric_timestamp)
);

-- System health table
CREATE TABLE IF NOT EXISTS system_health (
    id SERIAL PRIMARY KEY,
    component VARCHAR(100) NOT NULL,
    status VARCHAR(50) NOT NULL,
    last_check_at TIMESTAMP WITH TIME ZONE NOT NULL,
    response_time BIGINT,
    error_message TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Scan cache table
CREATE TABLE IF NOT EXISTS scan_cache (
    id SERIAL PRIMARY KEY,
    cache_key VARCHAR(255) NOT NULL UNIQUE,
    volume_id VARCHAR(255) NOT NULL,
    cached_result TEXT NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    hit_count INTEGER DEFAULT 0,
    last_accessed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    is_valid BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (volume_id) REFERENCES volumes(volume_id) ON DELETE CASCADE
);

-- Docker events table
CREATE TABLE IF NOT EXISTS docker_events (
    id SERIAL PRIMARY KEY,
    event_id VARCHAR(255) NOT NULL,
    event_type VARCHAR(100) NOT NULL,
    event_action VARCHAR(100) NOT NULL,
    event_time TIMESTAMP WITH TIME ZONE NOT NULL,
    actor_id VARCHAR(255),
    actor_type VARCHAR(100),
    actor_attributes JSONB DEFAULT '{}',
    processed BOOLEAN DEFAULT false,
    processed_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at triggers
DO $$
BEGIN
    -- Volumes
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_volumes_updated_at') THEN
        CREATE TRIGGER update_volumes_updated_at BEFORE UPDATE ON volumes
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;

    -- Volume sizes
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_volume_sizes_updated_at') THEN
        CREATE TRIGGER update_volume_sizes_updated_at BEFORE UPDATE ON volume_sizes
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;

    -- Containers
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_containers_updated_at') THEN
        CREATE TRIGGER update_containers_updated_at BEFORE UPDATE ON containers
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;

    -- Volume mounts
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_volume_mounts_updated_at') THEN
        CREATE TRIGGER update_volume_mounts_updated_at BEFORE UPDATE ON volume_mounts
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;

    -- Scan jobs
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_scan_jobs_updated_at') THEN
        CREATE TRIGGER update_scan_jobs_updated_at BEFORE UPDATE ON scan_jobs
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;

    -- Volume metrics
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_volume_metrics_updated_at') THEN
        CREATE TRIGGER update_volume_metrics_updated_at BEFORE UPDATE ON volume_metrics
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;

    -- System health
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_system_health_updated_at') THEN
        CREATE TRIGGER update_system_health_updated_at BEFORE UPDATE ON system_health
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;

    -- Scan cache
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_scan_cache_updated_at') THEN
        CREATE TRIGGER update_scan_cache_updated_at BEFORE UPDATE ON scan_cache
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_volumes_volume_id ON volumes(volume_id);
CREATE INDEX IF NOT EXISTS idx_volumes_name ON volumes(name);
CREATE INDEX IF NOT EXISTS idx_volumes_last_scanned ON volumes(last_scanned);
CREATE INDEX IF NOT EXISTS idx_volumes_status_active ON volumes(status, is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_volumes_created_at ON volumes(created_at);

CREATE INDEX IF NOT EXISTS idx_volume_sizes_volume_id ON volume_sizes(volume_id);
CREATE INDEX IF NOT EXISTS idx_volume_sizes_created_at ON volume_sizes(created_at);
CREATE INDEX IF NOT EXISTS idx_volume_sizes_total_size ON volume_sizes(total_size);
CREATE INDEX IF NOT EXISTS idx_volume_sizes_valid_volume_created ON volume_sizes(volume_id, created_at) WHERE is_valid = true;

CREATE INDEX IF NOT EXISTS idx_containers_container_id ON containers(container_id);
CREATE INDEX IF NOT EXISTS idx_containers_name ON containers(name);
CREATE INDEX IF NOT EXISTS idx_containers_state ON containers(state);
CREATE INDEX IF NOT EXISTS idx_containers_image ON containers(image);
CREATE INDEX IF NOT EXISTS idx_containers_active_state ON containers(is_active, state) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_volume_mounts_volume_id ON volume_mounts(volume_id);
CREATE INDEX IF NOT EXISTS idx_volume_mounts_container_id ON volume_mounts(container_id);
CREATE INDEX IF NOT EXISTS idx_volume_mounts_active ON volume_mounts(is_active) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_scan_jobs_scan_id ON scan_jobs(scan_id);
CREATE INDEX IF NOT EXISTS idx_scan_jobs_volume_id ON scan_jobs(volume_id);
CREATE INDEX IF NOT EXISTS idx_scan_jobs_status ON scan_jobs(status);
CREATE INDEX IF NOT EXISTS idx_scan_jobs_created_at ON scan_jobs(created_at);
CREATE INDEX IF NOT EXISTS idx_scan_jobs_pending ON scan_jobs(status) WHERE status IN ('queued', 'scanning');

CREATE INDEX IF NOT EXISTS idx_volume_metrics_volume_id ON volume_metrics(volume_id);
CREATE INDEX IF NOT EXISTS idx_volume_metrics_timestamp ON volume_metrics(metric_timestamp);
CREATE INDEX IF NOT EXISTS idx_volume_metrics_volume_timestamp ON volume_metrics(volume_id, metric_timestamp);

CREATE INDEX IF NOT EXISTS idx_system_health_component ON system_health(component);
CREATE INDEX IF NOT EXISTS idx_system_health_status ON system_health(status);
CREATE INDEX IF NOT EXISTS idx_system_health_last_check ON system_health(last_check_at);

CREATE INDEX IF NOT EXISTS idx_scan_cache_cache_key ON scan_cache(cache_key);
CREATE INDEX IF NOT EXISTS idx_scan_cache_volume_id ON scan_cache(volume_id);
CREATE INDEX IF NOT EXISTS idx_scan_cache_expires_at ON scan_cache(expires_at);
CREATE INDEX IF NOT EXISTS idx_scan_cache_valid_expires ON scan_cache(expires_at) WHERE is_valid = true;

CREATE INDEX IF NOT EXISTS idx_docker_events_event_id ON docker_events(event_id);
CREATE INDEX IF NOT EXISTS idx_docker_events_event_time ON docker_events(event_time);
CREATE INDEX IF NOT EXISTS idx_docker_events_actor_id ON docker_events(actor_id);
CREATE INDEX IF NOT EXISTS idx_docker_events_processed ON docker_events(processed) WHERE processed = false;
CREATE INDEX IF NOT EXISTS idx_docker_events_type_action ON docker_events(event_type, event_action);