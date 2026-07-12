ALTER TABLE files DROP CONSTRAINT IF EXISTS files_volume_id_path_key;

ALTER TABLE files ADD CONSTRAINT files_path_hash_key UNIQUE (path_hash);
ALTER TABLE folders ADD CONSTRAINT folders_path_hash_key UNIQUE (path_hash);
