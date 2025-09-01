-- Migration rollback: Remove daily stats tracking

-- Drop materialized view first
DROP MATERIALIZED VIEW IF EXISTS stats_daily_summary;

-- Drop regular view
DROP VIEW IF EXISTS stats_daily_trends;

-- Drop job tracking table
DROP TABLE IF EXISTS stats_jobs;

-- Drop main stats table (cascades to indexes)
DROP TABLE IF EXISTS stats_daily;