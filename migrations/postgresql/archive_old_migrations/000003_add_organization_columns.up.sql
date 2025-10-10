-- Add organization_id columns to remaining tables for multi-tenancy support

-- Add organization_id to scan_jobs table
ALTER TABLE scan_jobs 
ADD COLUMN IF NOT EXISTS organization_id BIGINT;

-- Add constraint only if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'scan_jobs_organization_id_fkey') THEN
        ALTER TABLE scan_jobs ADD CONSTRAINT scan_jobs_organization_id_fkey 
            FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Add index for organization-based scan job filtering
CREATE INDEX idx_scan_jobs_organization_id ON scan_jobs(organization_id);

-- Add organization_id to docker_mount_catalog table  
ALTER TABLE docker_mount_catalog
ADD COLUMN organization_id BIGINT,
ADD CONSTRAINT docker_mount_catalog_organization_id_fkey
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

-- Add index for organization-based mount catalog filtering
CREATE INDEX idx_docker_mount_catalog_organization_id ON docker_mount_catalog(organization_id);

-- Add organization_id to files table
ALTER TABLE files
ADD COLUMN organization_id BIGINT,
ADD CONSTRAINT files_organization_id_fkey
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

-- Add index for organization-based file filtering  
CREATE INDEX idx_files_organization_id ON files(organization_id);

-- Add organization_id to folders table
ALTER TABLE folders 
ADD COLUMN organization_id BIGINT,
ADD CONSTRAINT folders_organization_id_fkey
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

-- Add index for organization-based folder filtering
CREATE INDEX idx_folders_organization_id ON folders(organization_id);

-- Add organization_id to saved_searches table
ALTER TABLE saved_searches
ADD COLUMN organization_id BIGINT,
ADD CONSTRAINT saved_searches_organization_id_fkey
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

-- Add index for organization-based saved search filtering
CREATE INDEX idx_saved_searches_organization_id ON saved_searches(organization_id);

-- Add organization_id to alerts table
ALTER TABLE alerts
ADD COLUMN organization_id BIGINT,
ADD CONSTRAINT alerts_organization_id_fkey
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

-- Add index for organization-based alert filtering
CREATE INDEX idx_alerts_organization_id ON alerts(organization_id);

-- Add organization_id to daily_stats table
ALTER TABLE daily_stats
ADD COLUMN organization_id BIGINT,
ADD CONSTRAINT daily_stats_organization_id_fkey
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

-- Add index for organization-based stats filtering
CREATE INDEX idx_daily_stats_organization_id ON daily_stats(organization_id);

-- Create composite indexes for common query patterns
CREATE INDEX idx_scan_jobs_volume_org ON scan_jobs(volume_id, organization_id);
CREATE INDEX idx_files_volume_org ON files(volume_id, organization_id);
CREATE INDEX idx_folders_volume_org ON folders(volume_id, organization_id);
CREATE INDEX idx_alerts_volume_org ON alerts(volume_id, organization_id);
CREATE INDEX idx_daily_stats_volume_org ON daily_stats(volume_id, organization_id);

-- Add comments for documentation
COMMENT ON COLUMN scan_jobs.organization_id IS 'Organization that owns this scan job';
COMMENT ON COLUMN docker_mount_catalog.organization_id IS 'Organization that owns this docker mount';
COMMENT ON COLUMN files.organization_id IS 'Organization that has access to this file';
COMMENT ON COLUMN folders.organization_id IS 'Organization that has access to this folder';
COMMENT ON COLUMN saved_searches.organization_id IS 'Organization that owns this saved search';
COMMENT ON COLUMN alerts.organization_id IS 'Organization that owns this alert';
COMMENT ON COLUMN daily_stats.organization_id IS 'Organization that owns this daily stat record';