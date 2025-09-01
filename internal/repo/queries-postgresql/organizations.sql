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

-- name: CreateOrganizationInvitation :one
INSERT INTO organization_invitations (organization_id, email, role, token, invited_by, message, expires_at)
VALUES ($1, $2, $3, $4, $5, $6, $7)
RETURNING *;

-- name: GetOrganizationInvitationByToken :one
SELECT id, organization_id, email, role, token, invited_by, message, status, accepted_at, accepted_by, expires_at, created_at, updated_at
FROM organization_invitations
WHERE token = $1 AND status = 'pending' AND expires_at > CURRENT_TIMESTAMP;

-- name: AcceptOrganizationInvitation :exec
UPDATE organization_invitations
SET status = 'accepted', accepted_at = CURRENT_TIMESTAMP, accepted_by = $2
WHERE id = $1;

-- name: CancelOrganizationInvitation :exec
UPDATE organization_invitations
SET status = 'cancelled'
WHERE id = $1;

-- name: ListOrganizationInvitations :many
SELECT id, organization_id, email, role, token, invited_by, message, status, accepted_at, accepted_by, expires_at, created_at, updated_at
FROM organization_invitations
WHERE organization_id = $1
ORDER BY created_at DESC
LIMIT $2 OFFSET $3;