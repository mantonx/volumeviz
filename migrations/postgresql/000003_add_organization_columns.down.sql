-- Remove organization_id columns and related indexes

-- Drop composite indexes
DROP INDEX IF EXISTS idx_daily_stats_volume_org;
DROP INDEX IF EXISTS idx_alerts_volume_org;
DROP INDEX IF EXISTS idx_folders_volume_org;
DROP INDEX IF EXISTS idx_files_volume_org;
DROP INDEX IF EXISTS idx_scan_jobs_volume_org;

-- Remove organization_id from daily_stats table
DROP INDEX IF EXISTS idx_daily_stats_organization_id;
ALTER TABLE daily_stats DROP CONSTRAINT IF EXISTS daily_stats_organization_id_fkey;
ALTER TABLE daily_stats DROP COLUMN IF EXISTS organization_id;

-- Remove organization_id from alerts table  
DROP INDEX IF EXISTS idx_alerts_organization_id;
ALTER TABLE alerts DROP CONSTRAINT IF EXISTS alerts_organization_id_fkey;
ALTER TABLE alerts DROP COLUMN IF EXISTS organization_id;

-- Remove organization_id from saved_searches table
DROP INDEX IF EXISTS idx_saved_searches_organization_id;
ALTER TABLE saved_searches DROP CONSTRAINT IF EXISTS saved_searches_organization_id_fkey;
ALTER TABLE saved_searches DROP COLUMN IF EXISTS organization_id;

-- Remove organization_id from folders table
DROP INDEX IF EXISTS idx_folders_organization_id;
ALTER TABLE folders DROP CONSTRAINT IF EXISTS folders_organization_id_fkey;
ALTER TABLE folders DROP COLUMN IF EXISTS organization_id;

-- Remove organization_id from files table
DROP INDEX IF EXISTS idx_files_organization_id;
ALTER TABLE files DROP CONSTRAINT IF EXISTS files_organization_id_fkey;
ALTER TABLE files DROP COLUMN IF EXISTS organization_id;

-- Remove organization_id from docker_mount_catalog table
DROP INDEX IF EXISTS idx_docker_mount_catalog_organization_id;
ALTER TABLE docker_mount_catalog DROP CONSTRAINT IF EXISTS docker_mount_catalog_organization_id_fkey;
ALTER TABLE docker_mount_catalog DROP COLUMN IF EXISTS organization_id;

-- Remove organization_id from scan_jobs table
DROP INDEX IF EXISTS idx_scan_jobs_organization_id;
ALTER TABLE scan_jobs DROP CONSTRAINT IF EXISTS scan_jobs_organization_id_fkey;
ALTER TABLE scan_jobs DROP COLUMN IF EXISTS organization_id;