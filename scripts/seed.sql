-- Seed data for quick local/dev usage
-- Volumes
INSERT INTO volumes (volume_id, name, driver, mountpoint, labels, options, scope, status, is_active)
VALUES
  ('vol-001','data_volume','local','/var/lib/docker/volumes/data_volume/_data','{}','{}','local','active',true)
ON CONFLICT (volume_id) DO NOTHING;

-- Containers
INSERT INTO containers (container_id, name, image, state, status, labels, is_active)
VALUES
  ('ctr-001','api','ghcr.io/example/api:latest','running','Up','{}',true)
ON CONFLICT (container_id) DO NOTHING;

-- Volume mounts
INSERT INTO volume_mounts (volume_id, container_id, mount_path, access_mode, is_active)
VALUES
  ('vol-001','ctr-001','/data','rw',true)
ON CONFLICT DO NOTHING;

-- Recent metrics (last 3 days)
INSERT INTO volume_metrics (volume_id, metric_timestamp, total_size, file_count, directory_count, access_frequency, container_count)
VALUES
  ('vol-001', CURRENT_TIMESTAMP - INTERVAL '2 days', 100000000, 1000, 100, 3, 1),
  ('vol-001', CURRENT_TIMESTAMP - INTERVAL '1 day', 120000000, 1100, 110, 4, 1),
  ('vol-001', CURRENT_TIMESTAMP, 150000000, 1200, 115, 5, 1)
ON CONFLICT DO NOTHING;

-- A recent size scan
INSERT INTO volume_sizes (volume_id, total_size, file_count, directory_count, largest_file, scan_method, scan_duration, filesystem_type, is_valid)
VALUES
  ('vol-001', 150000000, 1200, 115, 50000000, 'native', 1000000000, 'ext4', true)
ON CONFLICT DO NOTHING;
