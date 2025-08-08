-- SQLite-compatible seed (converted)
INSERT OR IGNORE INTO volumes (volume_id, name, driver, mountpoint, labels, options, scope, status, is_active)
VALUES ('vol-001','data_volume','local','/var/lib/docker/volumes/data_volume/_data','{}','{}','local','active',1);

INSERT OR IGNORE INTO containers (container_id, name, image, state, status, labels, is_active)
VALUES ('ctr-001','api','ghcr.io/example/api:latest','running','Up','{}',1);

INSERT OR IGNORE INTO volume_mounts (volume_id, container_id, mount_path, access_mode, is_active)
VALUES ('vol-001','ctr-001','/data','rw',1);

INSERT OR IGNORE INTO volume_metrics (volume_id, metric_timestamp, total_size, file_count, directory_count, access_frequency, container_count)
VALUES
  ('vol-001', datetime('now','-2 days'), 100000000, 1000, 100, 3, 1),
  ('vol-001', datetime('now','-1 day'), 120000000, 1100, 110, 4, 1),
  ('vol-001', datetime('now'), 150000000, 1200, 115, 5, 1);

INSERT OR IGNORE INTO volume_sizes (volume_id, total_size, file_count, directory_count, largest_file, scan_method, scan_duration, filesystem_type, is_valid)
VALUES ('vol-001', 150000000, 1200, 115, 50000000, 'native', 1000000000, 'ext4', 1);
