-- Alerts system schema
-- Creates tables for alert rules, alerts, destinations, routes, and deliveries

-- Alert rules table
CREATE TABLE IF NOT EXISTS alert_rules (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    query TEXT NOT NULL,
    condition TEXT NOT NULL CHECK (condition IN ('gt', 'lt', 'eq', 'ne', 'gte', 'lte')),
    threshold DOUBLE PRECISION NOT NULL,
    interval_seconds INTEGER NOT NULL CHECK (interval_seconds >= 60), -- Minimum 1 minute
    for_seconds INTEGER CHECK (for_seconds IS NULL OR for_seconds >= 0),
    labels JSONB DEFAULT '{}',
    is_enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT alert_rules_name_unique UNIQUE (name)
);

-- Alerts table
CREATE TABLE IF NOT EXISTS alerts (
    id BIGSERIAL PRIMARY KEY,
    rule_id BIGINT NOT NULL REFERENCES alert_rules(id) ON DELETE CASCADE,
    entity_id TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    dedupe_key TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'firing' CHECK (status IN ('firing', 'resolved')),
    value DOUBLE PRECISION,
    labels JSONB DEFAULT '{}',
    annotations JSONB DEFAULT '{}',
    starts_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ends_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT alerts_dedupe_unique UNIQUE (rule_id, entity_id, dedupe_key)
);

-- Alert destinations table
CREATE TABLE IF NOT EXISTS alert_destinations (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('webhook', 'slack', 'pushover')),
    config JSONB NOT NULL DEFAULT '{}',
    is_enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT alert_destinations_name_unique UNIQUE (name)
);

-- Alert routes table
CREATE TABLE IF NOT EXISTS alert_routes (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    matchers JSONB NOT NULL DEFAULT '{}',
    destination_id BIGINT NOT NULL REFERENCES alert_destinations(id) ON DELETE CASCADE,
    priority INTEGER DEFAULT 0,
    is_enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT alert_routes_name_unique UNIQUE (name)
);

-- Alert deliveries table
CREATE TABLE IF NOT EXISTS alert_deliveries (
    id BIGSERIAL PRIMARY KEY,
    alert_id BIGINT NOT NULL REFERENCES alerts(id) ON DELETE CASCADE,
    destination_id BIGINT NOT NULL REFERENCES alert_destinations(id) ON DELETE CASCADE,
    route_id BIGINT NOT NULL REFERENCES alert_routes(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'delivered', 'failed', 'retrying')),
    attempt_count INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 3,
    next_attempt_at TIMESTAMPTZ,
    last_attempt_at TIMESTAMPTZ,
    error_message TEXT,
    delivered_at TIMESTAMPTZ,
    request_payload TEXT,
    response_payload TEXT,
    response_status INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance

-- Alert rules indexes
CREATE INDEX IF NOT EXISTS idx_alert_rules_enabled ON alert_rules (is_enabled);
CREATE INDEX IF NOT EXISTS idx_alert_rules_created_at ON alert_rules (created_at DESC);

-- Alerts indexes
CREATE INDEX IF NOT EXISTS idx_alerts_rule_id ON alerts (rule_id);
CREATE INDEX IF NOT EXISTS idx_alerts_entity ON alerts (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_alerts_status ON alerts (status);
CREATE INDEX IF NOT EXISTS idx_alerts_starts_at ON alerts (starts_at DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_dedupe ON alerts (rule_id, entity_id, dedupe_key);
CREATE INDEX IF NOT EXISTS idx_alerts_active ON alerts (status) WHERE status = 'firing';

-- Alert destinations indexes
CREATE INDEX IF NOT EXISTS idx_alert_destinations_type ON alert_destinations (type);
CREATE INDEX IF NOT EXISTS idx_alert_destinations_enabled ON alert_destinations (is_enabled);

-- Alert routes indexes  
CREATE INDEX IF NOT EXISTS idx_alert_routes_destination_id ON alert_routes (destination_id);
CREATE INDEX IF NOT EXISTS idx_alert_routes_priority ON alert_routes (priority ASC);
CREATE INDEX IF NOT EXISTS idx_alert_routes_enabled ON alert_routes (is_enabled);

-- Alert deliveries indexes
CREATE INDEX IF NOT EXISTS idx_alert_deliveries_alert_id ON alert_deliveries (alert_id);
CREATE INDEX IF NOT EXISTS idx_alert_deliveries_destination_id ON alert_deliveries (destination_id);
CREATE INDEX IF NOT EXISTS idx_alert_deliveries_route_id ON alert_deliveries (route_id);
CREATE INDEX IF NOT EXISTS idx_alert_deliveries_status ON alert_deliveries (status);
CREATE INDEX IF NOT EXISTS idx_alert_deliveries_next_attempt ON alert_deliveries (next_attempt_at ASC) 
    WHERE status IN ('pending', 'retrying');
CREATE INDEX IF NOT EXISTS idx_alert_deliveries_created_at ON alert_deliveries (created_at DESC);

-- Performance indexes for delivery processing
CREATE INDEX IF NOT EXISTS idx_alert_deliveries_retry_queue ON alert_deliveries (status, next_attempt_at ASC)
    WHERE status IN ('pending', 'retrying') AND next_attempt_at IS NOT NULL;

-- Historical analysis indexes
CREATE INDEX IF NOT EXISTS idx_alerts_timeline ON alerts (rule_id, starts_at DESC, ends_at);
CREATE INDEX IF NOT EXISTS idx_alert_deliveries_stats ON alert_deliveries (destination_id, status, created_at DESC);

-- GIN indexes for JSONB queries
CREATE INDEX IF NOT EXISTS idx_alert_rules_labels_gin ON alert_rules USING GIN (labels);
CREATE INDEX IF NOT EXISTS idx_alerts_labels_gin ON alerts USING GIN (labels);
CREATE INDEX IF NOT EXISTS idx_alerts_annotations_gin ON alerts USING GIN (annotations);
CREATE INDEX IF NOT EXISTS idx_alert_destinations_config_gin ON alert_destinations USING GIN (config);
CREATE INDEX IF NOT EXISTS idx_alert_routes_matchers_gin ON alert_routes USING GIN (matchers);

-- Update trigger functions
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply update triggers
CREATE TRIGGER update_alert_rules_updated_at BEFORE UPDATE ON alert_rules 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_alerts_updated_at BEFORE UPDATE ON alerts 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_alert_destinations_updated_at BEFORE UPDATE ON alert_destinations 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_alert_routes_updated_at BEFORE UPDATE ON alert_routes 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_alert_deliveries_updated_at BEFORE UPDATE ON alert_deliveries 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();