-- Migration: Add stats_jobs table for background statistics processing
-- This table tracks statistics computation jobs for monitoring and debugging

CREATE TABLE IF NOT EXISTS stats_jobs (
    id BIGSERIAL PRIMARY KEY,
    job_id TEXT NOT NULL UNIQUE,
    job_type TEXT NOT NULL,
    volume_id TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    progress INTEGER DEFAULT 0,
    error_message TEXT,
    started_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMPTZ,
    duration_ms BIGINT,
    records_processed BIGINT DEFAULT 0,
    organization_id BIGINT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT stats_jobs_status_check CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
    CONSTRAINT stats_jobs_job_type_check CHECK (job_type IN ('daily_stats', 'growth_analysis', 'trend_computation', 'media_analysis', 'capacity_prediction'))
);

CREATE INDEX IF NOT EXISTS idx_stats_jobs_status ON stats_jobs(status);
CREATE INDEX IF NOT EXISTS idx_stats_jobs_job_id ON stats_jobs(job_id);
CREATE INDEX IF NOT EXISTS idx_stats_jobs_volume_id ON stats_jobs(volume_id);
CREATE INDEX IF NOT EXISTS idx_stats_jobs_created_at ON stats_jobs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stats_jobs_org_id ON stats_jobs(organization_id);

COMMENT ON TABLE stats_jobs IS 'Background jobs for statistics computation and analysis';
COMMENT ON COLUMN stats_jobs.job_id IS 'Unique identifier for the job (UUID or generated string)';
COMMENT ON COLUMN stats_jobs.job_type IS 'Type of statistics job being executed';
COMMENT ON COLUMN stats_jobs.volume_id IS 'Volume this job is processing (null for system-wide jobs)';
COMMENT ON COLUMN stats_jobs.progress IS 'Job progress percentage (0-100)';
COMMENT ON COLUMN stats_jobs.duration_ms IS 'Job execution duration in milliseconds';
COMMENT ON COLUMN stats_jobs.records_processed IS 'Number of records/files processed by this job';
