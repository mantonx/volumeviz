-- Organization invitations queries for VolumeViz

-- name: CreateInvitation :one
INSERT INTO organization_invitations (
    organization_id, email, role, token, invited_by, expires_at
) VALUES (
    $1, $2, $3, $4, $5, $6
) RETURNING *;

-- name: GetInvitationByID :one
SELECT * FROM organization_invitations WHERE id = $1;

-- name: GetInvitationByToken :one
SELECT * FROM organization_invitations
WHERE token = $1 AND status = 'pending' AND expires_at > NOW();

-- name: ListInvitationsByOrg :many
SELECT * FROM organization_invitations
WHERE organization_id = $1
ORDER BY created_at DESC
LIMIT $2 OFFSET $3;

-- name: ListPendingInvitationsByOrg :many
SELECT * FROM organization_invitations
WHERE organization_id = $1 AND status = 'pending' AND expires_at > NOW()
ORDER BY created_at DESC;

-- name: UpdateInvitationStatus :one
UPDATE organization_invitations SET
    status = $2,
    accepted_at = CASE WHEN $2 = 'accepted' THEN NOW() ELSE NULL END,
    updated_at = NOW()
WHERE id = $1
RETURNING *;

-- name: RevokeInvitation :exec
UPDATE organization_invitations SET
    status = 'revoked',
    updated_at = NOW()
WHERE id = $1;

-- name: ExpireOldInvitations :exec
UPDATE organization_invitations SET
    status = 'expired',
    updated_at = NOW()
WHERE status = 'pending' AND expires_at < NOW();

-- name: DeleteInvitation :exec
DELETE FROM organization_invitations WHERE id = $1;

-- name: CountPendingInvitations :one
SELECT COUNT(*) FROM organization_invitations
WHERE organization_id = $1 AND status = 'pending' AND expires_at > NOW();

-- name: GetPendingInvitationsView :many
SELECT * FROM pending_invitations
WHERE organization_id = $1;
