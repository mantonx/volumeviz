-- VV-302: Tracking Rules Engine Schema
-- Ordered rule-based system for Docker mount tracking with preview functionality

-- Rule action enumeration
CREATE TYPE rule_action AS ENUM ('include', 'exclude');

-- Rule condition operator enumeration  
CREATE TYPE rule_operator AS ENUM (
    'equals',           -- Exact match
    'not_equals',       -- Not equal
    'regex',           -- Regular expression
    'not_regex',       -- Negative regex
    'prefix',          -- String prefix
    'suffix',          -- String suffix
    'contains',        -- String contains
    'not_contains',    -- String does not contain
    'glob',            -- Glob pattern
    'in',              -- Value in list
    'not_in'           -- Value not in list
);

-- Rule evaluation status
CREATE TYPE rule_evaluation_status AS ENUM ('pending', 'success', 'error', 'skipped');

-- Tracking rules table - ordered rule definitions
CREATE TABLE IF NOT EXISTS tracking_rules (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    action rule_action NOT NULL,
    priority INTEGER NOT NULL DEFAULT 1000, -- Lower numbers = higher priority
    is_enabled BOOLEAN NOT NULL DEFAULT true,
    
    -- Rule conditions (JSON array of condition objects)
    conditions JSONB NOT NULL DEFAULT '[]'::jsonb,
    
    -- Statistics and metadata
    match_count INTEGER NOT NULL DEFAULT 0,
    last_matched_at TIMESTAMPTZ,
    last_evaluation_at TIMESTAMPTZ,
    
    -- Audit fields
    created_by TEXT DEFAULT 'system',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Rule evaluation history - tracks when rules are evaluated
CREATE TABLE IF NOT EXISTS tracking_rule_evaluations (
    id BIGSERIAL PRIMARY KEY,
    rule_id BIGINT REFERENCES tracking_rules(id) ON DELETE CASCADE,
    
    -- Evaluation context
    evaluation_type TEXT NOT NULL, -- 'manual', 'scheduled', 'mount_discovery', 'api_request'
    triggered_by TEXT, -- User ID or system component
    
    -- Results
    status rule_evaluation_status NOT NULL,
    mounts_evaluated INTEGER NOT NULL DEFAULT 0,
    mounts_matched INTEGER NOT NULL DEFAULT 0,
    mounts_included INTEGER NOT NULL DEFAULT 0,
    mounts_excluded INTEGER NOT NULL DEFAULT 0,
    
    -- Performance metrics
    execution_time_ms INTEGER,
    
    -- Error information
    error_message TEXT,
    error_details JSONB,
    
    -- Timestamps
    started_at TIMESTAMPTZ NOT NULL,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Mount tracking assignments - results of rule evaluation
CREATE TABLE IF NOT EXISTS mount_tracking_assignments (
    id BIGSERIAL PRIMARY KEY,
    mount_catalog_id BIGINT REFERENCES docker_mount_catalog(id) ON DELETE CASCADE,
    rule_id BIGINT REFERENCES tracking_rules(id) ON DELETE SET NULL,
    evaluation_id BIGINT REFERENCES tracking_rule_evaluations(id) ON DELETE SET NULL,
    
    -- Assignment details
    action rule_action NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    
    -- Rule match information
    matched_conditions JSONB, -- Which conditions matched
    rule_priority INTEGER,
    rule_name TEXT,
    
    -- Timestamps
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ, -- Optional expiration
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Rule conditions validation - stores validated condition schemas
CREATE TABLE IF NOT EXISTS tracking_rule_conditions (
    id BIGSERIAL PRIMARY KEY,
    rule_id BIGINT REFERENCES tracking_rules(id) ON DELETE CASCADE,
    
    -- Condition definition
    field_name TEXT NOT NULL, -- e.g., 'source_type', 'compose_project'
    operator rule_operator NOT NULL,
    value TEXT, -- Single value for most operators
    values TEXT[], -- Array values for 'in'/'not_in' operators
    
    -- Condition metadata
    is_case_sensitive BOOLEAN NOT NULL DEFAULT true,
    description TEXT,
    
    -- Evaluation statistics
    match_count INTEGER NOT NULL DEFAULT 0,
    last_matched_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Rule templates - predefined rule patterns
CREATE TABLE IF NOT EXISTS tracking_rule_templates (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    description TEXT NOT NULL,
    category TEXT NOT NULL, -- e.g., 'volume', 'compose', 'security'
    
    -- Template definition
    template_data JSONB NOT NULL,
    
    -- Usage statistics
    usage_count INTEGER NOT NULL DEFAULT 0,
    last_used_at TIMESTAMPTZ,
    
    -- Template metadata
    is_builtin BOOLEAN NOT NULL DEFAULT false,
    tags TEXT[],
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_tracking_rules_priority ON tracking_rules (priority ASC, id ASC) WHERE is_enabled = true;
CREATE INDEX IF NOT EXISTS idx_tracking_rules_action ON tracking_rules (action);
CREATE INDEX IF NOT EXISTS idx_tracking_rules_enabled ON tracking_rules (is_enabled);
CREATE INDEX IF NOT EXISTS idx_tracking_rules_updated ON tracking_rules (updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_rule_evaluations_rule_id ON tracking_rule_evaluations (rule_id);
CREATE INDEX IF NOT EXISTS idx_rule_evaluations_type ON tracking_rule_evaluations (evaluation_type);
CREATE INDEX IF NOT EXISTS idx_rule_evaluations_started ON tracking_rule_evaluations (started_at DESC);
CREATE INDEX IF NOT EXISTS idx_rule_evaluations_status ON tracking_rule_evaluations (status);

CREATE INDEX IF NOT EXISTS idx_mount_assignments_mount_id ON mount_tracking_assignments (mount_catalog_id);
CREATE INDEX IF NOT EXISTS idx_mount_assignments_rule_id ON mount_tracking_assignments (rule_id);
CREATE INDEX IF NOT EXISTS idx_mount_assignments_active ON mount_tracking_assignments (is_active, assigned_at DESC);
CREATE INDEX IF NOT EXISTS idx_mount_assignments_action ON mount_tracking_assignments (action) WHERE is_active = true;

-- Ensure one active assignment per mount using unique index
CREATE UNIQUE INDEX IF NOT EXISTS idx_mount_assignments_unique_active ON mount_tracking_assignments (mount_catalog_id) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_rule_conditions_rule_id ON tracking_rule_conditions (rule_id);
CREATE INDEX IF NOT EXISTS idx_rule_conditions_field ON tracking_rule_conditions (field_name);

CREATE INDEX IF NOT EXISTS idx_rule_templates_category ON tracking_rule_templates (category);
CREATE INDEX IF NOT EXISTS idx_rule_templates_builtin ON tracking_rule_templates (is_builtin);

-- Insert default rule templates
INSERT INTO tracking_rule_templates (name, description, category, template_data, is_builtin, tags) VALUES
(
    'Include All Docker Volumes',
    'Include all Docker named volumes for tracking',
    'volume',
    '{
        "name": "Include All Docker Volumes",
        "action": "include",
        "priority": 100,
        "conditions": [
            {
                "field_name": "source_type",
                "operator": "equals",
                "value": "volume"
            }
        ]
    }'::jsonb,
    true,
    ARRAY['volume', 'basic', 'include']
),
(
    'Exclude Temporary Mounts',
    'Exclude all tmpfs mounts from tracking',
    'volume',
    '{
        "name": "Exclude Temporary Mounts", 
        "action": "exclude",
        "priority": 200,
        "conditions": [
            {
                "field_name": "source_type",
                "operator": "equals",
                "value": "tmpfs"
            }
        ]
    }'::jsonb,
    true,
    ARRAY['tmpfs', 'exclude', 'temporary']
),
(
    'Include Production Compose Projects',
    'Include mounts from production Compose projects',
    'compose',
    '{
        "name": "Include Production Compose Projects",
        "action": "include", 
        "priority": 150,
        "conditions": [
            {
                "field_name": "compose_project",
                "operator": "suffix",
                "value": "_prod"
            }
        ]
    }'::jsonb,
    true,
    ARRAY['compose', 'production', 'include']
),
(
    'Exclude Development Volumes',
    'Exclude volumes from development environments',
    'compose',
    '{
        "name": "Exclude Development Volumes",
        "action": "exclude",
        "priority": 300,
        "conditions": [
            {
                "field_name": "compose_project", 
                "operator": "in",
                "values": ["dev", "development", "test"]
            }
        ]
    }'::jsonb,
    true,
    ARRAY['compose', 'development', 'exclude']
),
(
    'Include Database Volumes',
    'Include volumes used by database containers',
    'service',
    '{
        "name": "Include Database Volumes",
        "action": "include",
        "priority": 120,
        "conditions": [
            {
                "field_name": "container_image",
                "operator": "regex",
                "value": "(postgres|mysql|mongodb|redis|elasticsearch):"
            }
        ]
    }'::jsonb,
    true,
    ARRAY['database', 'service', 'include']
),
(
    'Exclude Read-Only Bind Mounts',
    'Exclude read-only bind mounts from tracking',
    'security',
    '{
        "name": "Exclude Read-Only Bind Mounts",
        "action": "exclude",
        "priority": 250,
        "conditions": [
            {
                "field_name": "source_type",
                "operator": "equals", 
                "value": "bind"
            },
            {
                "field_name": "read_only",
                "operator": "equals",
                "value": "true"
            }
        ]
    }'::jsonb,
    true,
    ARRAY['bind', 'readonly', 'exclude', 'security']
);

-- Create function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_tracking_rules_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for automatic timestamp updates
CREATE TRIGGER tracking_rules_updated_at_trigger
    BEFORE UPDATE ON tracking_rules
    FOR EACH ROW
    EXECUTE FUNCTION update_tracking_rules_updated_at();

CREATE TRIGGER mount_tracking_assignments_updated_at_trigger
    BEFORE UPDATE ON mount_tracking_assignments
    FOR EACH ROW
    EXECUTE FUNCTION update_tracking_rules_updated_at();

CREATE TRIGGER tracking_rule_conditions_updated_at_trigger
    BEFORE UPDATE ON tracking_rule_conditions
    FOR EACH ROW
    EXECUTE FUNCTION update_tracking_rules_updated_at();

CREATE TRIGGER tracking_rule_templates_updated_at_trigger
    BEFORE UPDATE ON tracking_rule_templates
    FOR EACH ROW
    EXECUTE FUNCTION update_tracking_rules_updated_at();