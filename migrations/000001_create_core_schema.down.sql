-- Drop all indexes first
DROP INDEX IF EXISTS idx_docker_events_type_action;
DROP INDEX IF EXISTS idx_docker_events_processed;
DROP INDEX IF EXISTS idx_docker_events_actor_id;
DROP INDEX IF EXISTS idx_docker_events_event_time;
DROP INDEX IF EXISTS idx_docker_events_event_id;

DROP INDEX IF EXISTS idx_scan_cache_valid_expires;
DROP INDEX IF EXISTS idx_scan_cache_expires_at;
DROP INDEX IF EXISTS idx_scan_cache_volume_id;
DROP INDEX IF EXISTS idx_scan_cache_cache_key;

DROP INDEX IF EXISTS idx_system_health_last_check;
DROP INDEX IF EXISTS idx_system_health_status;
DROP INDEX IF EXISTS idx_system_health_component;

DROP INDEX IF EXISTS idx_volume_metrics_volume_timestamp;
DROP INDEX IF EXISTS idx_volume_metrics_timestamp;
DROP INDEX IF EXISTS idx_volume_metrics_volume_id;

DROP INDEX IF EXISTS idx_scan_jobs_pending;
DROP INDEX IF EXISTS idx_scan_jobs_created_at;
DROP INDEX IF EXISTS idx_scan_jobs_status;
DROP INDEX IF EXISTS idx_scan_jobs_volume_id;
DROP INDEX IF EXISTS idx_scan_jobs_scan_id;

DROP INDEX IF EXISTS idx_volume_mounts_active;
DROP INDEX IF EXISTS idx_volume_mounts_container_id;
DROP INDEX IF EXISTS idx_volume_mounts_volume_id;

DROP INDEX IF EXISTS idx_containers_active_state;
DROP INDEX IF EXISTS idx_containers_image;
DROP INDEX IF EXISTS idx_containers_state;
DROP INDEX IF EXISTS idx_containers_name;
DROP INDEX IF EXISTS idx_containers_container_id;

DROP INDEX IF EXISTS idx_volume_sizes_valid_volume_created;
DROP INDEX IF EXISTS idx_volume_sizes_total_size;
DROP INDEX IF EXISTS idx_volume_sizes_created_at;
DROP INDEX IF EXISTS idx_volume_sizes_volume_id;

DROP INDEX IF EXISTS idx_volumes_created_at;
DROP INDEX IF EXISTS idx_volumes_status_active;
DROP INDEX IF EXISTS idx_volumes_last_scanned;
DROP INDEX IF EXISTS idx_volumes_name;
DROP INDEX IF EXISTS idx_volumes_volume_id;

-- Drop tables in reverse dependency order
DROP TABLE IF EXISTS docker_events;
DROP TABLE IF EXISTS scan_cache;
DROP TABLE IF EXISTS system_health;
DROP TABLE IF EXISTS volume_metrics;
DROP TABLE IF EXISTS scan_jobs;
DROP TABLE IF EXISTS volume_mounts;
DROP TABLE IF EXISTS volume_sizes;
DROP TABLE IF EXISTS containers;
DROP TABLE IF EXISTS volumes;