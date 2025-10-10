-- Migration 000014: Add Organization Invitations Table
-- Creates organization_invitations table for managing pending user invitations

CREATE TABLE IF NOT EXISTS organization_invitations (
    id BIGSERIAL PRIMARY KEY,
    organization_id BIGINT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'user',
    token VARCHAR(255) NOT NULL UNIQUE,
    invited_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    expires_at TIMESTAMP NOT NULL,
    accepted_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT valid_status CHECK (status IN ('pending', 'accepted', 'expired', 'revoked'))
);

CREATE INDEX IF NOT EXISTS idx_org_invitations_organization_id ON organization_invitations(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_invitations_email ON organization_invitations(email);
CREATE INDEX IF NOT EXISTS idx_org_invitations_token ON organization_invitations(token);
CREATE INDEX IF NOT EXISTS idx_org_invitations_status ON organization_invitations(status);
CREATE INDEX IF NOT EXISTS idx_org_invitations_invited_by ON organization_invitations(invited_by);
CREATE INDEX IF NOT EXISTS idx_org_invitations_expires_at ON organization_invitations(expires_at);

-- Create view for pending invitations (useful for management UI)
CREATE OR REPLACE VIEW pending_invitations AS
SELECT
    oi.id,
    oi.organization_id,
    o.name AS organization_name,
    oi.email,
    oi.role,
    oi.token,
    oi.invited_by,
    u.username AS invited_by_username,
    oi.expires_at,
    oi.created_at
FROM organization_invitations oi
JOIN organizations o ON oi.organization_id = o.id
LEFT JOIN users u ON oi.invited_by = u.id
WHERE oi.status = 'pending'
  AND oi.expires_at > NOW()
ORDER BY oi.created_at DESC;
