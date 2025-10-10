-- Users queries for VolumeViz
-- Simplified version matching migration 000012 schema

-- name: CreateUser :one
INSERT INTO users (
    organization_id, username, email, password_hash, role, is_active
) VALUES (
    $1, $2, $3, $4, $5, $6
) RETURNING *;

-- name: GetUserByID :one
SELECT * FROM users WHERE id = $1;

-- name: GetUserByIDAndOrg :one
SELECT * FROM users WHERE id = $1 AND organization_id = $2;

-- name: GetUserByUsername :one
SELECT * FROM users WHERE username = $1;

-- name: GetUserByUsernameAndOrg :one
SELECT * FROM users WHERE username = $1 AND organization_id = $2;

-- name: GetUserByEmail :one
SELECT * FROM users WHERE email = $1;

-- name: GetUserByEmailAndOrg :one
SELECT * FROM users WHERE email = $1 AND organization_id = $2;

-- name: UpdateUser :one
UPDATE users SET
    email = COALESCE(sqlc.narg('email'), email),
    role = COALESCE(sqlc.narg('role'), role),
    is_active = COALESCE(sqlc.narg('is_active'), is_active),
    updated_at = NOW()
WHERE id = sqlc.arg('id')
RETURNING *;

-- name: UpdateUserPassword :exec
UPDATE users SET
    password_hash = $2,
    updated_at = NOW()
WHERE id = $1;

-- name: UpdateUserLastLogin :exec
UPDATE users SET
    last_login_at = NOW(),
    updated_at = NOW()
WHERE id = $1;

-- name: SetUserActive :exec
UPDATE users SET
    is_active = $2,
    updated_at = NOW()
WHERE id = $1;

-- name: ListUsersByOrg :many
SELECT * FROM users
WHERE organization_id = $1
ORDER BY created_at DESC
LIMIT $2 OFFSET $3;

-- name: ListAllUsers :many
SELECT * FROM users
ORDER BY created_at DESC
LIMIT $1 OFFSET $2;

-- name: CountUsersByOrg :one
SELECT COUNT(*) FROM users
WHERE organization_id = $1;

-- name: DeleteUser :exec
DELETE FROM users WHERE id = $1;

-- name: DeleteUserByUsernameAndOrg :exec
DELETE FROM users WHERE username = $1 AND organization_id = $2;
