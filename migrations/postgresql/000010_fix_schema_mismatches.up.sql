-- Fix schema mismatches between code and database

-- Add organization_id to files table if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name='files' AND column_name='organization_id'
    ) THEN
        ALTER TABLE files ADD COLUMN organization_id BIGINT REFERENCES organizations(id) ON DELETE CASCADE;

        -- Set existing files to default organization
        UPDATE files SET organization_id = (SELECT id FROM organizations WHERE name = 'default' LIMIT 1)
        WHERE organization_id IS NULL;

        -- Create index
        CREATE INDEX idx_files_organization_id ON files(organization_id);
    END IF;
END $$;

-- Add organization_id to folders table if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name='folders' AND column_name='organization_id'
    ) THEN
        ALTER TABLE folders ADD COLUMN organization_id BIGINT REFERENCES organizations(id) ON DELETE CASCADE;

        -- Set existing folders to default organization
        UPDATE folders SET organization_id = (SELECT id FROM organizations WHERE name = 'default' LIMIT 1)
        WHERE organization_id IS NULL;

        -- Create index
        CREATE INDEX idx_folders_organization_id ON folders(organization_id);
    END IF;
END $$;

-- Add progress column as computed column based on progress_percent (for backwards compatibility)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name='scan_phases' AND column_name='progress'
    ) THEN
        ALTER TABLE scan_phases ADD COLUMN progress INTEGER GENERATED ALWAYS AS (progress_percent) STORED;
    END IF;
END $$;
