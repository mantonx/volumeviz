-- Add missing Docker volume metadata columns
-- These fields provide complete volume information from Docker API

-- Add driver column (e.g., "local", "nfs", "cifs")
ALTER TABLE volumes ADD COLUMN IF NOT EXISTS driver TEXT DEFAULT 'local';

-- Add scope column (e.g., "local", "global")
ALTER TABLE volumes ADD COLUMN IF NOT EXISTS scope TEXT DEFAULT 'local';

-- Add labels column (key-value pairs from Docker)
ALTER TABLE volumes ADD COLUMN IF NOT EXISTS labels JSONB DEFAULT '{}'::jsonb;

-- Add options column (driver-specific options like mount device, type, etc.)
ALTER TABLE volumes ADD COLUMN IF NOT EXISTS options JSONB DEFAULT '{}'::jsonb;

-- Add index on driver for filtering
CREATE INDEX IF NOT EXISTS idx_volumes_driver ON volumes(driver);

-- Add index on labels for JSONB queries
CREATE INDEX IF NOT EXISTS idx_volumes_labels ON volumes USING gin(labels);

-- Add index on options for JSONB queries
CREATE INDEX IF NOT EXISTS idx_volumes_options ON volumes USING gin(options);

-- Comment the new columns
COMMENT ON COLUMN volumes.driver IS 'Docker volume driver (local, nfs, cifs, etc.)';
COMMENT ON COLUMN volumes.scope IS 'Docker volume scope (local or global)';
COMMENT ON COLUMN volumes.labels IS 'Docker volume labels as JSON object';
COMMENT ON COLUMN volumes.options IS 'Driver-specific options (e.g., device path for bind mounts)';
