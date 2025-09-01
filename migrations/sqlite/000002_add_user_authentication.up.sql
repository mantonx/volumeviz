-- =============================================================================
-- User Authentication System (SQLite)
-- Migration 002: Add user management tables
-- =============================================================================

-- Users table
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'viewer' CHECK (role IN ('viewer', 'operator', 'admin')),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'pending', 'locked')),
    
    -- Profile information
    first_name TEXT,
    last_name TEXT,
    display_name TEXT,
    avatar_url TEXT,
    timezone TEXT DEFAULT 'UTC',
    
    -- Security
    password_reset_token TEXT,
    password_reset_expires DATETIME,
    email_verification_token TEXT,
    email_verified_at DATETIME,
    last_login_at DATETIME,
    login_attempts INTEGER DEFAULT 0,
    locked_until DATETIME,
    
    -- Audit
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by TEXT,
    
    -- Constraints
    CHECK(length(trim(username)) > 0),
    CHECK(length(trim(email)) > 0),
    CHECK(length(trim(password_hash)) > 0)
);

-- User sessions table for JWT token management
CREATE TABLE user_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_token TEXT NOT NULL UNIQUE,
    jwt_token_id TEXT NOT NULL, -- jti claim from JWT
    device_info TEXT DEFAULT '{}', -- JSON as TEXT in SQLite
    ip_address TEXT,
    user_agent TEXT,
    
    -- Timing
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME NOT NULL,
    last_used_at DATETIME,
    revoked_at DATETIME,
    
    -- Status
    is_active BOOLEAN NOT NULL DEFAULT TRUE
);

-- User activity log
CREATE TABLE user_activity_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    resource_type TEXT,
    resource_id TEXT,
    details TEXT DEFAULT '{}', -- JSON as TEXT in SQLite
    ip_address TEXT,
    user_agent TEXT,
    session_id INTEGER REFERENCES user_sessions(id) ON DELETE SET NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- User preferences
CREATE TABLE user_preferences (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    preference_key TEXT NOT NULL,
    preference_value TEXT NOT NULL, -- JSON as TEXT in SQLite
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(user_id, preference_key)
);

-- =============================================================================
-- INDEXES
-- =============================================================================

-- Users indexes
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_status ON users(status);
CREATE INDEX idx_users_last_login ON users(last_login_at);

-- Sessions indexes
CREATE INDEX idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX idx_user_sessions_token ON user_sessions(session_token);
CREATE INDEX idx_user_sessions_jwt_id ON user_sessions(jwt_token_id);
CREATE INDEX idx_user_sessions_expires ON user_sessions(expires_at);
CREATE INDEX idx_user_sessions_active ON user_sessions(is_active, expires_at) WHERE is_active = 1;

-- Activity log indexes
CREATE INDEX idx_user_activity_user_id ON user_activity_log(user_id);
CREATE INDEX idx_user_activity_action ON user_activity_log(action);
CREATE INDEX idx_user_activity_created ON user_activity_log(created_at);
CREATE INDEX idx_user_activity_resource ON user_activity_log(resource_type, resource_id);

-- Preferences indexes
CREATE INDEX idx_user_preferences_user_id ON user_preferences(user_id);
CREATE INDEX idx_user_preferences_key ON user_preferences(preference_key);

-- =============================================================================
-- TRIGGERS FOR AUTO-UPDATE TIMESTAMPS
-- =============================================================================

-- SQLite trigger for users updated_at
CREATE TRIGGER users_updated_at_trigger 
    AFTER UPDATE ON users
    FOR EACH ROW
BEGIN
    UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- SQLite trigger for user_preferences updated_at
CREATE TRIGGER user_preferences_updated_at_trigger 
    AFTER UPDATE ON user_preferences
    FOR EACH ROW
BEGIN
    UPDATE user_preferences SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- =============================================================================
-- DEFAULT ADMIN USER
-- =============================================================================

-- Insert default admin user (password: "admin123" - change immediately in production)
INSERT OR IGNORE INTO users (username, email, password_hash, role, status, first_name, last_name, display_name, email_verified_at, created_by) 
VALUES (
    'admin',
    'admin@volumeviz.local',
    '$argon2id$v=19$m=65536,t=1,p=4$o2LV5PHnVkzl70LUVhlnvQ$McSBG7ng6N09Bg09/RwBrqHdxHWShqeolZvPQTxjHGY', -- argon2id hash of "admin123"
    'admin',
    'active',
    'System',
    'Administrator',
    'Admin',
    CURRENT_TIMESTAMP,
    'system'
);