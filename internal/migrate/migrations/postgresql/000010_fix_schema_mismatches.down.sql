-- Reverse migration for 000010_fix_schema_mismatches

-- Remove organization_id from folders table
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name='folders' AND column_name='organization_id'
    ) THEN
        DROP INDEX IF EXISTS idx_folders_organization_id;
        ALTER TABLE folders DROP COLUMN organization_id;
    END IF;
END $$;

-- Remove organization_id from files table
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name='files' AND column_name='organization_id'
    ) THEN
        DROP INDEX IF EXISTS idx_files_organization_id;
        ALTER TABLE files DROP COLUMN organization_id;
    END IF;
END $$;

-- Remove progress column from scan_phases
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name='scan_phases' AND column_name='progress'
    ) THEN
        ALTER TABLE scan_phases DROP COLUMN progress;
    END IF;
END $$;
