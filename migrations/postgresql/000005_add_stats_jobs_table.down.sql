-- Rollback: Remove stats_jobs table

DROP INDEX IF EXISTS idx_stats_jobs_org_id;
DROP INDEX IF EXISTS idx_stats_jobs_created_at;
DROP INDEX IF EXISTS idx_stats_jobs_volume_id;
DROP INDEX IF EXISTS idx_stats_jobs_job_id;
DROP INDEX IF EXISTS idx_stats_jobs_status;

DROP TABLE IF EXISTS stats_jobs;
