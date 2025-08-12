-- Drop indexes first
DROP INDEX IF EXISTS idx_dir_rollups_dir_computed;
DROP INDEX IF EXISTS idx_dir_rollups_computed_at;
DROP INDEX IF EXISTS idx_dir_rollups_dir_id;

DROP INDEX IF EXISTS idx_dir_nodes_latest_size;
DROP INDEX IF EXISTS idx_dir_nodes_volume_parent;
DROP INDEX IF EXISTS idx_dir_nodes_volume_depth;
DROP INDEX IF EXISTS idx_dir_nodes_depth;
DROP INDEX IF EXISTS idx_dir_nodes_full_path;
DROP INDEX IF EXISTS idx_dir_nodes_parent_dir_id;
DROP INDEX IF EXISTS idx_dir_nodes_volume_id;
DROP INDEX IF EXISTS idx_dir_nodes_volume_path;

DROP INDEX IF EXISTS idx_file_entries_volume_size;
DROP INDEX IF EXISTS idx_file_entries_volume_parent;
DROP INDEX IF EXISTS idx_file_entries_path_hash;
DROP INDEX IF EXISTS idx_file_entries_type;
DROP INDEX IF EXISTS idx_file_entries_size_bytes;
DROP INDEX IF EXISTS idx_file_entries_name;
DROP INDEX IF EXISTS idx_file_entries_parent_dir_id;
DROP INDEX IF EXISTS idx_file_entries_volume_id;
DROP INDEX IF EXISTS idx_file_entries_volume_path_hash_unique;

-- Drop tables
DROP TABLE IF EXISTS dir_rollups;
DROP TABLE IF EXISTS dir_nodes;
DROP TABLE IF EXISTS file_entries;