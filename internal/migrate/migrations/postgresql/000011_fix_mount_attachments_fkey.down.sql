-- Reverse migration for 000011_fix_mount_attachments_fkey

-- Drop the partial index
DROP INDEX IF EXISTS idx_docker_mount_attachments_mount_catalog_id;

-- Drop the foreign key constraint
ALTER TABLE docker_mount_attachments
    DROP CONSTRAINT IF EXISTS docker_mount_attachments_mount_catalog_id_fkey;

-- Make mount_catalog_id NOT NULL again
ALTER TABLE docker_mount_attachments
    ALTER COLUMN mount_catalog_id SET NOT NULL;

-- Re-add the foreign key constraint with NOT NULL column
ALTER TABLE docker_mount_attachments
    ADD CONSTRAINT docker_mount_attachments_mount_catalog_id_fkey
    FOREIGN KEY (mount_catalog_id)
    REFERENCES docker_mount_catalog(id)
    ON DELETE CASCADE;
