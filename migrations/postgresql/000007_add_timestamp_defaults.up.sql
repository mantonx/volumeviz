-- Add DEFAULT CURRENT_TIMESTAMP to nullable timestamp columns
-- This prevents NULL values that cause "cannot scan NULL into *time.Time" errors

-- Update existing NULL values in files table
UPDATE files
SET
    created_at = COALESCE(created_at, CURRENT_TIMESTAMP),
    modified_at = COALESCE(modified_at, CURRENT_TIMESTAMP),
    accessed_at = COALESCE(accessed_at, CURRENT_TIMESTAMP)
WHERE created_at IS NULL OR modified_at IS NULL OR accessed_at IS NULL;

-- Update existing NULL values in folders table
UPDATE folders
SET
    created_at = COALESCE(created_at, CURRENT_TIMESTAMP),
    modified_at = COALESCE(modified_at, CURRENT_TIMESTAMP),
    accessed_at = COALESCE(accessed_at, CURRENT_TIMESTAMP)
WHERE created_at IS NULL OR modified_at IS NULL OR accessed_at IS NULL;

-- Add DEFAULT constraints to files table
ALTER TABLE files
    ALTER COLUMN created_at SET DEFAULT CURRENT_TIMESTAMP,
    ALTER COLUMN modified_at SET DEFAULT CURRENT_TIMESTAMP,
    ALTER COLUMN accessed_at SET DEFAULT CURRENT_TIMESTAMP;

-- Add DEFAULT constraints to folders table
ALTER TABLE folders
    ALTER COLUMN created_at SET DEFAULT CURRENT_TIMESTAMP,
    ALTER COLUMN modified_at SET DEFAULT CURRENT_TIMESTAMP,
    ALTER COLUMN accessed_at SET DEFAULT CURRENT_TIMESTAMP;
