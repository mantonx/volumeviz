-- Saved Searches Table
-- Stores user-defined search queries for later execution

CREATE TABLE IF NOT EXISTS saved_searches (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    query JSONB NOT NULL,
    tags TEXT[],
    is_public BOOLEAN DEFAULT false,
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_run_at TIMESTAMPTZ,
    run_count INTEGER DEFAULT 0,
    
    -- Constraints
    CONSTRAINT saved_searches_name_unique UNIQUE(name),
    CONSTRAINT saved_searches_name_not_empty CHECK(length(trim(name)) > 0)
);

-- Indexes for saved searches
CREATE INDEX IF NOT EXISTS idx_saved_searches_name ON saved_searches(name);
CREATE INDEX IF NOT EXISTS idx_saved_searches_tags ON saved_searches USING gin(tags);
CREATE INDEX IF NOT EXISTS idx_saved_searches_is_public ON saved_searches(is_public);
CREATE INDEX IF NOT EXISTS idx_saved_searches_updated_at ON saved_searches(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_saved_searches_last_run_at ON saved_searches(last_run_at DESC) WHERE last_run_at IS NOT NULL;

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_saved_searches_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_saved_searches_updated_at
    BEFORE UPDATE ON saved_searches
    FOR EACH ROW
    EXECUTE FUNCTION update_saved_searches_updated_at();