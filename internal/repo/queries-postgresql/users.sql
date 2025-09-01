-- name: CreateUser :one
INSERT INTO users (
    username, email, password_hash, role, status,
    first_name, last_name, display_name, timezone, created_by, organization_id
) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11
) RETURNING *;

-- name: GetUserByID :one
SELECT * FROM users WHERE id = $1;

-- name: GetUserByIDAndOrg :one
SELECT * FROM users WHERE id = $1 AND organization_id = $2;

-- name: GetUserByUsername :one
SELECT * FROM users WHERE username = $1;

-- name: GetUserByEmail :one
SELECT * FROM users WHERE email = $1;

-- name: UpdateUser :one
UPDATE users SET
    email = COALESCE($2, email),
    first_name = COALESCE($3, first_name),
    last_name = COALESCE($4, last_name),
    display_name = COALESCE($5, display_name),
    timezone = COALESCE($6, timezone),
    role = COALESCE($7, role),
    status = COALESCE($8, status)
WHERE id = $1
RETURNING *;

-- name: UpdateUserPassword :exec
UPDATE users SET 
    password_hash = $2,
    password_reset_token = NULL,
    password_reset_expires = NULL
WHERE id = $1;

-- name: UpdateUserLastLogin :exec
UPDATE users SET 
    last_login_at = CURRENT_TIMESTAMP,
    login_attempts = 0,
    locked_until = NULL
WHERE id = $1;

-- name: IncrementLoginAttempts :exec
UPDATE users SET 
    login_attempts = login_attempts + 1
WHERE id = $1;

-- name: LockUser :exec
UPDATE users SET 
    locked_until = $2,
    status = 'locked'
WHERE id = $1;

-- name: SetPasswordResetToken :exec
UPDATE users SET 
    password_reset_token = $2,
    password_reset_expires = $3
WHERE id = $1;

-- name: VerifyEmail :exec
UPDATE users SET 
    email_verified_at = CURRENT_TIMESTAMP,
    email_verification_token = NULL
WHERE id = $1;

-- name: ListUsers :many
SELECT * FROM users 
WHERE organization_id = $1
ORDER BY created_at DESC
LIMIT $2 OFFSET $3;

-- name: DeleteUser :exec
DELETE FROM users WHERE id = $1;

-- User Sessions
-- name: CreateUserSession :one
INSERT INTO user_sessions (
    user_id, session_token, jwt_token_id, device_info,
    ip_address, user_agent, expires_at
) VALUES (
    $1, $2, $3, $4, $5, $6, $7
) RETURNING *;

-- name: GetUserSession :one
SELECT * FROM user_sessions 
WHERE session_token = $1 AND is_active = TRUE AND expires_at > CURRENT_TIMESTAMP;

-- name: GetUserSessionByJTI :one
SELECT * FROM user_sessions 
WHERE jwt_token_id = $1 AND is_active = TRUE;

-- name: UpdateSessionLastUsed :exec
UPDATE user_sessions SET last_used_at = CURRENT_TIMESTAMP 
WHERE id = $1;

-- name: RevokeUserSession :exec
UPDATE user_sessions SET 
    is_active = FALSE,
    revoked_at = CURRENT_TIMESTAMP
WHERE id = $1;

-- name: RevokeAllUserSessions :exec
UPDATE user_sessions SET 
    is_active = FALSE,
    revoked_at = CURRENT_TIMESTAMP
WHERE user_id = $1 AND is_active = TRUE;

-- name: CleanupExpiredSessions :exec
DELETE FROM user_sessions 
WHERE expires_at < CURRENT_TIMESTAMP OR revoked_at IS NOT NULL;

-- User Activity Log
-- name: LogUserActivity :one
INSERT INTO user_activity_log (
    user_id, action, resource_type, resource_id,
    details, ip_address, user_agent, session_id
) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8
) RETURNING *;

-- name: GetUserActivityLog :many
SELECT * FROM user_activity_log 
WHERE user_id = $1
ORDER BY created_at DESC
LIMIT $2 OFFSET $3;

-- User Preferences  
-- name: SetUserPreference :one
INSERT INTO user_preferences (user_id, preference_key, preference_value)
VALUES ($1, $2, $3)
ON CONFLICT (user_id, preference_key) 
DO UPDATE SET preference_value = EXCLUDED.preference_value
RETURNING *;

-- name: GetUserPreference :one
SELECT * FROM user_preferences 
WHERE user_id = $1 AND preference_key = $2;

-- name: GetAllUserPreferences :many
SELECT * FROM user_preferences 
WHERE user_id = $1
ORDER BY preference_key;

-- name: DeleteUserPreference :exec
DELETE FROM user_preferences 
WHERE user_id = $1 AND preference_key = $2;