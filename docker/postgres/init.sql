-- PostgreSQL initialization script for VolumeViz development
-- This script sets up performance optimizations and development settings

-- Performance optimizations for development
ALTER SYSTEM SET shared_buffers = '256MB';
ALTER SYSTEM SET effective_cache_size = '1GB';
ALTER SYSTEM SET maintenance_work_mem = '64MB';
ALTER SYSTEM SET checkpoint_completion_target = 0.9;
ALTER SYSTEM SET wal_buffers = '16MB';
ALTER SYSTEM SET default_statistics_target = 100;
ALTER SYSTEM SET random_page_cost = 1.1;
ALTER SYSTEM SET effective_io_concurrency = 200;

-- Enable useful extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";

-- Create a read-only user for monitoring
CREATE USER volumeviz_readonly WITH PASSWORD 'readonly';
GRANT CONNECT ON DATABASE volumeviz TO volumeviz_readonly;
GRANT USAGE ON SCHEMA public TO volumeviz_readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO volumeviz_readonly;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO volumeviz_readonly;

-- Reload configuration
SELECT pg_reload_conf();