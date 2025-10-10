-- name: CreateOrganization :one
INSERT INTO organizations (name, display_name, description, subdomain, settings, max_users, max_volumes, max_storage_gb, plan_type)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
RETURNING id, name, display_name, description, subdomain, settings, is_active, max_users, max_volumes, max_storage_gb, plan_type, created_at, updated_at;

-- name: GetOrganizationByID :one
SELECT id, name, display_name, description, subdomain, settings, is_active, max_users, max_volumes, max_storage_gb, plan_type, created_at, updated_at
FROM organizations
WHERE id = $1 AND is_active = true;

-- name: GetOrganizationByName :one
SELECT id, name, display_name, description, subdomain, settings, is_active, max_users, max_volumes, max_storage_gb, plan_type, created_at, updated_at
FROM organizations
WHERE name = $1 AND is_active = true;

-- name: GetOrganizationBySubdomain :one
SELECT id, name, display_name, description, subdomain, settings, is_active, max_users, max_volumes, max_storage_gb, plan_type, created_at, updated_at
FROM organizations
WHERE subdomain = $1 AND is_active = true;

-- name: UpdateOrganization :one
UPDATE organizations
SET display_name = $2, description = $3, subdomain = $4, settings = $5, max_users = $6, max_volumes = $7, max_storage_gb = $8, plan_type = $9
WHERE id = $1 AND is_active = true
RETURNING id, name, display_name, description, subdomain, settings, is_active, max_users, max_volumes, max_storage_gb, plan_type, created_at, updated_at;

-- name: DeactivateOrganization :exec
UPDATE organizations
SET is_active = false
WHERE id = $1;

-- name: ListOrganizations :many
SELECT id, name, display_name, description, subdomain, settings, is_active, max_users, max_volumes, max_storage_gb, plan_type, created_at, updated_at
FROM organizations
WHERE is_active = true
ORDER BY created_at DESC
LIMIT $1 OFFSET $2;

-- name: CountOrganizations :one
SELECT COUNT(*) FROM organizations WHERE is_active = true;