-- Docker Mount Catalog Migration (VV-301)
-- Creates tables for canonical Docker mount catalog with Compose metadata

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