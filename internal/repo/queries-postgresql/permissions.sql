-- Permissions queries for VolumeViz
-- Simplified version matching migration 000012 schema

-- name: CreatePermission :one
INSERT INTO permissions (
    role, resource, action, organization_id
) VALUES (
    $1, $2, $3, $4
) RETURNING *;

-- name: GetPermissionByID :one
SELECT * FROM permissions WHERE id = $1;

-- name: GetRolePermissions :many
SELECT * FROM permissions
WHERE role = $1
  AND (organization_id = $2 OR organization_id IS NULL)
ORDER BY resource, action;

-- name: GetRolePermissionsGlobal :many
SELECT * FROM permissions
WHERE role = $1 AND organization_id IS NULL
ORDER BY resource, action;

-- name: CheckRolePermission :one
SELECT COUNT(*) > 0 AS has_permission
FROM permissions
WHERE role = $1
  AND resource = $2
  AND action = $3
  AND (organization_id = $4 OR organization_id IS NULL);

-- name: ListAllPermissions :many
SELECT * FROM permissions
ORDER BY role, resource, action;

-- name: ListPermissionsByOrg :many
SELECT * FROM permissions
WHERE organization_id = $1 OR organization_id IS NULL
ORDER BY role, resource, action;

-- name: DeletePermission :exec
DELETE FROM permissions WHERE id = $1;

-- name: DeleteRolePermissions :exec
DELETE FROM permissions WHERE role = $1 AND organization_id = $2;

-- Roles queries
-- name: CreateRole :one
INSERT INTO roles (
    organization_id, name, description, is_system
) VALUES (
    $1, $2, $3, $4
) RETURNING *;

-- name: GetRoleByID :one
SELECT * FROM roles WHERE id = $1;

-- name: GetRoleByName :one
SELECT * FROM roles
WHERE name = $1 AND organization_id = $2;

-- name: ListRolesByOrg :many
SELECT * FROM roles
WHERE organization_id = $1
ORDER BY created_at DESC;

-- name: ListSystemRoles :many
SELECT * FROM roles
WHERE is_system = true
ORDER BY name;

-- name: UpdateRole :one
UPDATE roles SET
    description = COALESCE(sqlc.narg('description'), description),
    updated_at = NOW()
WHERE id = sqlc.arg('id')
RETURNING *;

-- name: DeleteRole :exec
DELETE FROM roles WHERE id = $1 AND is_system = false;
