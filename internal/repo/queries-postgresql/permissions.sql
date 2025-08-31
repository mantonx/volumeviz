-- name: GetPermissionByResourceAction :one
SELECT id, name, resource, action, description, created_at
FROM permissions
WHERE resource = $1 AND action = $2;

-- name: GetRolePermissions :many
SELECT p.name
FROM permissions p
JOIN role_permissions rp ON p.id = rp.permission_id
WHERE rp.role = $1;

-- name: CheckUserPermission :one
SELECT granted, resource_id
FROM user_permissions
WHERE user_id = $1 AND permission_id = $2 AND (resource_id = $3 OR ($3 IS NULL AND resource_id IS NULL));

-- name: GetUserPermissions :many
SELECT p.name, up.granted
FROM user_permissions up
JOIN permissions p ON up.permission_id = p.id
WHERE up.user_id = $1;

-- name: GrantUserPermission :exec
INSERT INTO user_permissions (user_id, permission_id, granted, granted_by, resource_id)
VALUES ($1, $2, $3, $4, $5)
ON CONFLICT (user_id, permission_id, resource_id) DO UPDATE SET
    granted = EXCLUDED.granted,
    granted_by = EXCLUDED.granted_by;

-- name: RevokeUserPermission :exec
DELETE FROM user_permissions
WHERE user_id = $1 AND permission_id = $2 AND (resource_id = $3 OR ($3 IS NULL AND resource_id IS NULL));