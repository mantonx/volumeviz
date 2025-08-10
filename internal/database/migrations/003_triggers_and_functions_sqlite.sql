-- Migration: 003_triggers_and_functions_sqlite
-- Description: Add database triggers for data consistency and automation (SQLite version)
-- Up Migration

-- SQLite triggers for updating updated_at timestamp automatically
-- Note: SQLite doesn't support functions like PostgreSQL, so we use simple triggers

-- Trigger to update updated_at on volumes table
CREATE TRIGGER IF NOT EXISTS update_volumes_updated_at 
    BEFORE UPDATE ON volumes
    FOR EACH ROW 
    BEGIN
        UPDATE volumes SET updated_at = CURRENT_TIMESTAMP WHERE rowid = NEW.rowid;
    END;

-- Trigger to update updated_at on volume_sizes table
CREATE TRIGGER IF NOT EXISTS update_volume_sizes_updated_at 
    BEFORE UPDATE ON volume_sizes
    FOR EACH ROW 
    BEGIN
        UPDATE volume_sizes SET updated_at = CURRENT_TIMESTAMP WHERE rowid = NEW.rowid;
    END;

-- Trigger to update updated_at on containers table
CREATE TRIGGER IF NOT EXISTS update_containers_updated_at 
    BEFORE UPDATE ON containers
    FOR EACH ROW 
    BEGIN
        UPDATE containers SET updated_at = CURRENT_TIMESTAMP WHERE rowid = NEW.rowid;
    END;

-- Trigger to update updated_at on volume_mounts table
CREATE TRIGGER IF NOT EXISTS update_volume_mounts_updated_at 
    BEFORE UPDATE ON volume_mounts
    FOR EACH ROW 
    BEGIN
        UPDATE volume_mounts SET updated_at = CURRENT_TIMESTAMP WHERE rowid = NEW.rowid;
    END;

-- Trigger to update updated_at on scan_jobs table
CREATE TRIGGER IF NOT EXISTS update_scan_jobs_updated_at 
    BEFORE UPDATE ON scan_jobs
    FOR EACH ROW 
    BEGIN
        UPDATE scan_jobs SET updated_at = CURRENT_TIMESTAMP WHERE rowid = NEW.rowid;
    END;

-- Trigger to update updated_at on volume_metrics table
CREATE TRIGGER IF NOT EXISTS update_volume_metrics_updated_at 
    BEFORE UPDATE ON volume_metrics
    FOR EACH ROW 
    BEGIN
        UPDATE volume_metrics SET updated_at = CURRENT_TIMESTAMP WHERE rowid = NEW.rowid;
    END;

-- Trigger to update updated_at on system_health table
CREATE TRIGGER IF NOT EXISTS update_system_health_updated_at 
    BEFORE UPDATE ON system_health
    FOR EACH ROW 
    BEGIN
        UPDATE system_health SET updated_at = CURRENT_TIMESTAMP WHERE rowid = NEW.rowid;
    END;

-- Trigger to update updated_at on scan_cache table
CREATE TRIGGER IF NOT EXISTS update_scan_cache_updated_at 
    BEFORE UPDATE ON scan_cache
    FOR EACH ROW 
    BEGIN
        UPDATE scan_cache SET updated_at = CURRENT_TIMESTAMP WHERE rowid = NEW.rowid;
    END;

-- Trigger to update volume last_scanned timestamp when size is recorded
CREATE TRIGGER IF NOT EXISTS update_volume_scanned_trigger 
    AFTER INSERT ON volume_sizes
    FOR EACH ROW 
    BEGIN
        UPDATE volumes 
        SET last_scanned = CURRENT_TIMESTAMP 
        WHERE volume_id = NEW.volume_id;
    END;

-- Note: SQLite doesn't support stored functions like PostgreSQL
-- Functions like clean_expired_cache() and calculate_growth_rate() 
-- would need to be implemented in application code when using SQLite