-- VolumeViz Core Schema Migration
-- Creates the foundational tables for the application

-- Volumes table
CREATE TABLE IF NOT EXISTS volumes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    volume_id TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    driver TEXT NOT NULL DEFAULT 'local',
    mountpoint TEXT NOT NULL,
    labels TEXT DEFAULT '{}',
    options TEXT DEFAULT '{}',
    scope TEXT DEFAULT 'local',
    status TEXT DEFAULT 'active',
    last_scanned DATETIME,
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Volume sizes table
CREATE TABLE IF NOT EXISTS volume_sizes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    volume_id TEXT NOT NULL,
    total_size INTEGER NOT NULL DEFAULT 0,
    file_count INTEGER NOT NULL DEFAULT 0,
    directory_count INTEGER NOT NULL DEFAULT 0,
    largest_file INTEGER NOT NULL DEFAULT 0,
    scan_method TEXT NOT NULL,
    scan_duration INTEGER NOT NULL DEFAULT 0,
    filesystem_type TEXT,
    checksum_md5 TEXT,
    is_valid INTEGER DEFAULT 1,
    error_message TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (volume_id) REFERENCES volumes(volume_id) ON DELETE CASCADE
);

-- Containers table
CREATE TABLE IF NOT EXISTS containers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    container_id TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    image TEXT NOT NULL,
    state TEXT NOT NULL,
    status TEXT,
    labels TEXT DEFAULT '{}',
    started_at DATETIME,
    finished_at DATETIME,
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Volume mounts table
CREATE TABLE IF NOT EXISTS volume_mounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    volume_id TEXT NOT NULL,
    container_id TEXT NOT NULL,
    mount_path TEXT NOT NULL,
    access_mode TEXT NOT NULL DEFAULT 'rw',
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (volume_id) REFERENCES volumes(volume_id) ON DELETE CASCADE,
    FOREIGN KEY (container_id) REFERENCES containers(container_id) ON DELETE CASCADE,
    UNIQUE(volume_id, container_id, mount_path)
);

-- Scan jobs table
CREATE TABLE IF NOT EXISTS scan_jobs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    scan_id TEXT NOT NULL UNIQUE,
    volume_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'queued',
    progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
    method TEXT NOT NULL,
    started_at DATETIME,
    completed_at DATETIME,
    error_message TEXT,
    result_id INTEGER,
    estimated_duration INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (volume_id) REFERENCES volumes(volume_id) ON DELETE CASCADE,
    FOREIGN KEY (result_id) REFERENCES volume_sizes(id) ON DELETE SET NULL
);

-- Volume metrics table
CREATE TABLE IF NOT EXISTS volume_metrics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    volume_id TEXT NOT NULL,
    metric_timestamp DATETIME NOT NULL,
    total_size INTEGER NOT NULL,
    file_count INTEGER NOT NULL,
    directory_count INTEGER NOT NULL,
    growth_rate REAL,
    access_frequency INTEGER DEFAULT 0,
    container_count INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (volume_id) REFERENCES volumes(volume_id) ON DELETE CASCADE,
    UNIQUE(volume_id, metric_timestamp)
);

-- System health table
CREATE TABLE IF NOT EXISTS system_health (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    component TEXT NOT NULL,
    status TEXT NOT NULL,
    last_check_at DATETIME NOT NULL,
    response_time INTEGER,
    error_message TEXT,
    metadata TEXT DEFAULT '{}',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Scan cache table
CREATE TABLE IF NOT EXISTS scan_cache (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cache_key TEXT NOT NULL UNIQUE,
    volume_id TEXT NOT NULL,
    cached_result TEXT NOT NULL,
    expires_at DATETIME NOT NULL,
    hit_count INTEGER DEFAULT 0,
    last_accessed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_valid INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (volume_id) REFERENCES volumes(volume_id) ON DELETE CASCADE
);

-- Docker events table
CREATE TABLE IF NOT EXISTS docker_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    event_action TEXT NOT NULL,
    event_time DATETIME NOT NULL,
    actor_id TEXT,
    actor_type TEXT,
    actor_attributes TEXT DEFAULT '{}',
    processed INTEGER DEFAULT 0,
    processed_at DATETIME,
    error_message TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_volumes_volume_id ON volumes(volume_id);
CREATE INDEX IF NOT EXISTS idx_volumes_name ON volumes(name);
CREATE INDEX IF NOT EXISTS idx_volumes_last_scanned ON volumes(last_scanned);
CREATE INDEX IF NOT EXISTS idx_volumes_status_active ON volumes(status, is_active) WHERE is_active = 1;
CREATE INDEX IF NOT EXISTS idx_volumes_created_at ON volumes(created_at);

CREATE INDEX IF NOT EXISTS idx_volume_sizes_volume_id ON volume_sizes(volume_id);
CREATE INDEX IF NOT EXISTS idx_volume_sizes_created_at ON volume_sizes(created_at);
CREATE INDEX IF NOT EXISTS idx_volume_sizes_total_size ON volume_sizes(total_size);
CREATE INDEX IF NOT EXISTS idx_volume_sizes_valid_volume_created ON volume_sizes(volume_id, created_at) WHERE is_valid = 1;

CREATE INDEX IF NOT EXISTS idx_containers_container_id ON containers(container_id);
CREATE INDEX IF NOT EXISTS idx_containers_name ON containers(name);
CREATE INDEX IF NOT EXISTS idx_containers_state ON containers(state);
CREATE INDEX IF NOT EXISTS idx_containers_image ON containers(image);
CREATE INDEX IF NOT EXISTS idx_containers_active_state ON containers(is_active, state) WHERE is_active = 1;

CREATE INDEX IF NOT EXISTS idx_volume_mounts_volume_id ON volume_mounts(volume_id);
CREATE INDEX IF NOT EXISTS idx_volume_mounts_container_id ON volume_mounts(container_id);
CREATE INDEX IF NOT EXISTS idx_volume_mounts_active ON volume_mounts(is_active) WHERE is_active = 1;

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
CREATE INDEX IF NOT EXISTS idx_scan_cache_valid_expires ON scan_cache(expires_at) WHERE is_valid = 1;

CREATE INDEX IF NOT EXISTS idx_docker_events_event_id ON docker_events(event_id);
CREATE INDEX IF NOT EXISTS idx_docker_events_event_time ON docker_events(event_time);
CREATE INDEX IF NOT EXISTS idx_docker_events_actor_id ON docker_events(actor_id);
CREATE INDEX IF NOT EXISTS idx_docker_events_processed ON docker_events(processed) WHERE processed = 0;
CREATE INDEX IF NOT EXISTS idx_docker_events_type_action ON docker_events(event_type, event_action);