-- Add operation tracking tables for undo/rollback functionality

-- Operations table for tracking file operations
CREATE TABLE operations (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL CHECK (type IN ('delete', 'move', 'copy', 'rename')),
    status TEXT NOT NULL CHECK (status IN ('pending', 'in_progress', 'completed', 'failed', 'rolled_back')),
    volume_id TEXT NOT NULL,
    description TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Operation actions table for tracking individual file operations
CREATE TABLE operation_actions (
    id TEXT PRIMARY KEY,
    operation_id TEXT NOT NULL REFERENCES operations(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('delete', 'move', 'copy', 'rename')),
    source_path TEXT NOT NULL,
    target_path TEXT,
    file_size BIGINT NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'pending',
    executed_at TIMESTAMP WITH TIME ZONE,
    backup_path TEXT,
    error_message TEXT
);

-- Indexes for performance
CREATE INDEX idx_operations_volume_id ON operations(volume_id);
CREATE INDEX idx_operations_created_at ON operations(created_at DESC);
CREATE INDEX idx_operations_status ON operations(status);
CREATE INDEX idx_operation_actions_operation_id ON operation_actions(operation_id);
CREATE INDEX idx_operation_actions_status ON operation_actions(status);
CREATE INDEX idx_operation_actions_source_path ON operation_actions(source_path);

-- Add comments for documentation
COMMENT ON TABLE operations IS 'Tracks file system operations for undo/rollback functionality';
COMMENT ON TABLE operation_actions IS 'Individual actions within file operations';

COMMENT ON COLUMN operations.id IS 'Unique operation identifier';
COMMENT ON COLUMN operations.type IS 'Type of operation: delete, move, copy, rename';
COMMENT ON COLUMN operations.status IS 'Current status of the operation';
COMMENT ON COLUMN operations.volume_id IS 'Volume where operation was performed';
COMMENT ON COLUMN operations.description IS 'Human-readable description of the operation';
COMMENT ON COLUMN operations.metadata IS 'Additional metadata (total files, workflow ID, etc.)';

COMMENT ON COLUMN operation_actions.backup_path IS 'Path to backup file (for delete operations)';
COMMENT ON COLUMN operation_actions.file_size IS 'Size of the file being operated on';
COMMENT ON COLUMN operation_actions.error_message IS 'Error message if operation failed';