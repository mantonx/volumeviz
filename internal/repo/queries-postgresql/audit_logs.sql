-- Audit logs queries for VolumeViz

-- name: CreateAuditLog :one
INSERT INTO audit_logs (
    organization_id, user_id, action, resource_type, resource_id,
    ip_address, user_agent, status, details
) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8, $9
) RETURNING *;

-- name: GetAuditLogByID :one
SELECT * FROM audit_logs WHERE id = $1;

-- name: ListAuditLogsByOrg :many
SELECT * FROM audit_logs
WHERE organization_id = $1
ORDER BY created_at DESC
LIMIT $2 OFFSET $3;

-- name: ListAuditLogsByUser :many
SELECT * FROM audit_logs
WHERE user_id = $1
ORDER BY created_at DESC
LIMIT $2 OFFSET $3;

-- name: ListAuditLogsByAction :many
SELECT * FROM audit_logs
WHERE organization_id = $1 AND action = $2
ORDER BY created_at DESC
LIMIT $3 OFFSET $4;

-- name: ListAuditLogsByResource :many
SELECT * FROM audit_logs
WHERE organization_id = $1 AND resource_type = $2
ORDER BY created_at DESC
LIMIT $3 OFFSET $4;

-- name: CountAuditLogsByOrg :one
SELECT COUNT(*) FROM audit_logs
WHERE organization_id = $1;

-- name: CountAuditLogsByUser :one
SELECT COUNT(*) FROM audit_logs
WHERE user_id = $1;

-- name: GetRecentAuditEvents :many
SELECT * FROM recent_audit_events
WHERE organization_id = $1
LIMIT $2;

-- name: SearchAuditLogsByOrg :many
SELECT * FROM recent_audit_events
WHERE organization_id = sqlc.arg(organization_id)
    AND (sqlc.narg(action)::text IS NULL OR action = sqlc.narg(action))
    AND (sqlc.narg(status)::text IS NULL OR status = sqlc.narg(status))
    AND (sqlc.narg(search)::text IS NULL OR
        username ILIKE '%' || sqlc.narg(search) || '%' OR
        action ILIKE '%' || sqlc.narg(search) || '%' OR
        details::text ILIKE '%' || sqlc.narg(search) || '%')
ORDER BY created_at DESC
LIMIT sqlc.arg(row_limit) OFFSET sqlc.arg(row_offset);

-- name: CountSearchAuditLogsByOrg :one
SELECT COUNT(*) FROM recent_audit_events
WHERE organization_id = sqlc.arg(organization_id)
    AND (sqlc.narg(action)::text IS NULL OR action = sqlc.narg(action))
    AND (sqlc.narg(status)::text IS NULL OR status = sqlc.narg(status))
    AND (sqlc.narg(search)::text IS NULL OR
        username ILIKE '%' || sqlc.narg(search) || '%' OR
        action ILIKE '%' || sqlc.narg(search) || '%' OR
        details::text ILIKE '%' || sqlc.narg(search) || '%');

-- name: DeleteOldAuditLogs :exec
DELETE FROM audit_logs
WHERE created_at < $1;

-- name: DeleteAuditLogsByOrg :exec
DELETE FROM audit_logs
WHERE organization_id = $1;
