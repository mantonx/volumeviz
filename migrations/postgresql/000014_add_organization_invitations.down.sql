-- Migration 000014 Rollback: Remove Organization Invitations Table

DROP VIEW IF EXISTS pending_invitations;
DROP TABLE IF EXISTS organization_invitations CASCADE;
