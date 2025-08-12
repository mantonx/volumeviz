-- Migration: 003_triggers_and_functions
-- Description: Add database triggers and functions for data consistency and automation
-- Up Migration

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for all tables with updated_at
CREATE TRIGGER update_volumes_updated_at BEFORE UPDATE ON volumes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_volume_sizes_updated_at BEFORE UPDATE ON volume_sizes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_containers_updated_at BEFORE UPDATE ON containers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_volume_mounts_updated_at BEFORE UPDATE ON volume_mounts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_scan_jobs_updated_at BEFORE UPDATE ON scan_jobs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_volume_metrics_updated_at BEFORE UPDATE ON volume_metrics
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_system_health_updated_at BEFORE UPDATE ON system_health
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_scan_cache_updated_at BEFORE UPDATE ON scan_cache
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to clean expired cache entries
CREATE OR REPLACE FUNCTION clean_expired_cache()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM scan_cache WHERE expires_at < CURRENT_TIMESTAMP;
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Function to update volume last_scanned timestamp when size is recorded
CREATE OR REPLACE FUNCTION update_volume_last_scanned()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE volumes 
    SET last_scanned = CURRENT_TIMESTAMP 
    WHERE volume_id = NEW.volume_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_volume_scanned_trigger 
    AFTER INSERT ON volume_sizes
    FOR EACH ROW EXECUTE FUNCTION update_volume_last_scanned();

-- Function to calculate volume growth rate
CREATE OR REPLACE FUNCTION calculate_growth_rate(p_volume_id VARCHAR(255), days_back INTEGER DEFAULT 7)
RETURNS DOUBLE PRECISION AS $$
DECLARE
    current_size BIGINT;
    past_size BIGINT;
    growth_rate DOUBLE PRECISION;
BEGIN
    -- Get current size
    SELECT total_size INTO current_size
    FROM volume_metrics 
    WHERE volume_id = p_volume_id 
    ORDER BY metric_timestamp DESC 
    LIMIT 1;
    
    -- Get past size
    SELECT total_size INTO past_size
    FROM volume_metrics 
    WHERE volume_id = p_volume_id 
      AND metric_timestamp <= (CURRENT_TIMESTAMP - INTERVAL '1 day' * days_back)
    ORDER BY metric_timestamp DESC 
    LIMIT 1;
    
    -- Calculate growth rate (bytes per day)
    IF current_size IS NOT NULL AND past_size IS NOT NULL THEN
        growth_rate := (current_size - past_size)::DOUBLE PRECISION / days_back;
        RETURN growth_rate;
    END IF;
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;