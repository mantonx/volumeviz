-- Recreate scan_checkpoints (structure only — data is not recoverable).
-- See 000006_add_scan_checkpoints.up.sql for the original migration this
-- mirrors; kept in sync here in case this drop needs to be rolled back.

CREATE TABLE scan_checkpoints (
    id BIGSERIAL PRIMARY KEY,
    scan_id TEXT NOT NULL,
    volume_id TEXT NOT NULL,
    checkpoint_type TEXT NOT NULL,

    phase TEXT NOT NULL,
    progress DOUBLE PRECISION NOT NULL DEFAULT 0.0,

    items_processed BIGINT NOT NULL DEFAULT 0,
    bytes_processed BIGINT NOT NULL DEFAULT 0,
    errors_count BIGINT NOT NULL DEFAULT 0,

    last_path TEXT,
    last_depth INTEGER,
    last_folder_id BIGINT,
    resume_data JSONB,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT unique_scan_checkpoint UNIQUE (scan_id, checkpoint_type)
);

CREATE INDEX idx_scan_checkpoints_scan_id ON scan_checkpoints(scan_id);
CREATE INDEX idx_scan_checkpoints_volume_id ON scan_checkpoints(volume_id);
CREATE INDEX idx_scan_checkpoints_updated_at ON scan_checkpoints(updated_at DESC);
CREATE INDEX idx_scan_checkpoints_created_at ON scan_checkpoints(created_at);

CREATE OR REPLACE FUNCTION update_scan_checkpoint_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_scan_checkpoint_updated_at
    BEFORE UPDATE ON scan_checkpoints
    FOR EACH ROW
    EXECUTE FUNCTION update_scan_checkpoint_updated_at();
