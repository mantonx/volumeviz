-- Fix a real data-corruption bug: folders.path_hash and files.path_hash both
-- had a GLOBAL unique constraint (UNIQUE(path_hash), from the initial
-- schema), and UpsertFolder/UpsertFile both targeted that global constraint
-- in their ON CONFLICT clause instead of a per-volume one. path_hash is
-- sha256(path) — it does not include volume_id — so two different volumes
-- that happen to index the same absolute path (e.g. two CIFS mounts of the
-- same underlying share, or any two volumes sharing a directory structure)
-- collided on path_hash and silently overwrote each other's folder/file
-- rows via ON CONFLICT DO UPDATE, or failed outright on CreateFile/
-- CreateFolder's plain INSERT.
--
-- folders already had a correct UNIQUE(volume_id, path) constraint sitting
-- unused (folders_volume_id_path_key) — this migration makes UpsertFolder
-- actually target it. files never had the per-volume equivalent at all —
-- this migration adds it.
--
-- path_hash remains a plain (non-unique) column; idx_folders_path_hash and
-- idx_files_path_hash already exist for lookup purposes and are unaffected —
-- nothing queries path_hash for exact-match lookups (GetFolderByPath/
-- GetFileByPath both key off volume_id+path directly), so nothing depends on
-- path_hash uniqueness functionally.

ALTER TABLE folders DROP CONSTRAINT IF EXISTS folders_path_hash_key;
ALTER TABLE files DROP CONSTRAINT IF EXISTS files_path_hash_key;

ALTER TABLE files ADD CONSTRAINT files_volume_id_path_key UNIQUE (volume_id, path);
