-- Fix docker_mount_attachments foreign key constraint
-- Make mount_catalog_id nullable to allow standalone container tracking

-- Drop the existing foreign key constraint
ALTER TABLE docker_mount_attachments
    DROP CONSTRAINT IF EXISTS docker_mount_attachments_mount_catalog_id_fkey;

-- Make mount_catalog_id nullable
ALTER TABLE docker_mount_attachments
    ALTER COLUMN mount_catalog_id DROP NOT NULL;

-- Re-add the foreign key constraint (now with nullable column)
ALTER TABLE docker_mount_attachments
    ADD CONSTRAINT docker_mount_attachments_mount_catalog_id_fkey
    FOREIGN KEY (mount_catalog_id)
    REFERENCES docker_mount_catalog(id)
    ON DELETE CASCADE;

-- Create index for better query performance on mount_catalog_id
CREATE INDEX IF NOT EXISTS idx_docker_mount_attachments_mount_catalog_id
    ON docker_mount_attachments(mount_catalog_id)
    WHERE mount_catalog_id IS NOT NULL;
