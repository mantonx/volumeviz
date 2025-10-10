-- Remove DEFAULT constraints from files table
ALTER TABLE files
    ALTER COLUMN created_at DROP DEFAULT,
    ALTER COLUMN modified_at DROP DEFAULT,
    ALTER COLUMN accessed_at DROP DEFAULT;

-- Remove DEFAULT constraints from folders table
ALTER TABLE folders
    ALTER COLUMN created_at DROP DEFAULT,
    ALTER COLUMN modified_at DROP DEFAULT,
    ALTER COLUMN accessed_at DROP DEFAULT;
