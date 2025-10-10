-- Rollback: Remove volume metadata columns

-- Drop indexes
DROP INDEX IF EXISTS idx_volumes_options;
DROP INDEX IF EXISTS idx_volumes_labels;
DROP INDEX IF EXISTS idx_volumes_driver;

-- Drop columns
ALTER TABLE volumes DROP COLUMN IF EXISTS options;
ALTER TABLE volumes DROP COLUMN IF EXISTS labels;
ALTER TABLE volumes DROP COLUMN IF EXISTS scope;
ALTER TABLE volumes DROP COLUMN IF EXISTS driver;
