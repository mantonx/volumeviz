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

-- File entries table (simplified for code generation)
CREATE TABLE IF NOT EXISTS file_entries (
    id BIGSERIAL PRIMARY KEY,
    volume_id TEXT NOT NULL,
    parent_dir_id BIGINT,
    name TEXT NOT NULL,
    size_bytes BIGINT NOT NULL DEFAULT 0,
    mtime TIMESTAMP NOT NULL,
    ctime TIMESTAMP NOT NULL,
    inode BIGINT,
    uid INTEGER,
    gid INTEGER,
    type TEXT NOT NULL,
    hidden BOOLEAN NOT NULL DEFAULT false,
    path_hash BYTEA NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Directory nodes table
CREATE TABLE IF NOT EXISTS dir_nodes (
    id BIGSERIAL PRIMARY KEY,
    volume_id TEXT NOT NULL,
    parent_dir_id BIGINT,
    name TEXT NOT NULL,
    full_path TEXT NOT NULL,
    depth INTEGER NOT NULL DEFAULT 0,
    latest_size_bytes BIGINT NOT NULL DEFAULT 0,
    latest_file_count BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Directory rollups table
CREATE TABLE IF NOT EXISTS dir_rollups (
    id BIGSERIAL PRIMARY KEY,
    dir_id BIGINT NOT NULL,
    size_bytes BIGINT NOT NULL DEFAULT 0,
    file_count BIGINT NOT NULL DEFAULT 0,
    computed_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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