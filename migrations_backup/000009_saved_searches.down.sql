-- Drop saved searches table and related objects

DROP TRIGGER IF EXISTS trigger_saved_searches_updated_at ON saved_searches;
DROP FUNCTION IF EXISTS update_saved_searches_updated_at();
DROP TABLE IF EXISTS saved_searches;