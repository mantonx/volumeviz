-- Migration: Assign organization_id to existing records
-- Created: 2025-08-31
-- Description: Assigns the default organization (id=1) to existing records that don't have organization_id set

-- Update docker_mount_catalog records to belong to default organization
UPDATE docker_mount_catalog 
SET organization_id = 1 
WHERE organization_id IS NULL;

-- Verify the migration worked
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM docker_mount_catalog WHERE organization_id IS NULL
    ) THEN
        RAISE EXCEPTION 'Migration failed: Some docker_mount_catalog records still have NULL organization_id';
    END IF;
    
    RAISE NOTICE 'Successfully migrated all existing records to default organization';
END $$;