-- Container CRUD operations (PostgreSQL)

-- name: CreateContainer :one
INSERT INTO containers (container_id, name, image, state, status, labels, started_at, finished_at, is_active)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
RETURNING id, created_at, updated_at;

-- name: GetContainerByID :one
SELECT id, container_id, name, image, state, status, labels, started_at, finished_at, is_active, created_at, updated_at
FROM containers 
WHERE id = $1;

-- name: GetContainerByContainerID :one
SELECT id, container_id, name, image, state, status, labels, started_at, finished_at, is_active, created_at, updated_at
FROM containers 
WHERE container_id = $1;

-- name: ListContainers :many
SELECT id, container_id, name, image, state, status, labels, started_at, finished_at, is_active, created_at, updated_at
FROM containers 
WHERE is_active = true
ORDER BY created_at DESC
LIMIT $1 OFFSET $2;

-- name: GetContainersByImage :many
SELECT id, container_id, name, image, state, status, labels, started_at, finished_at, is_active, created_at, updated_at
FROM containers 
WHERE image = $1 AND is_active = true
ORDER BY created_at DESC;

-- name: GetContainersByState :many
SELECT id, container_id, name, image, state, status, labels, started_at, finished_at, is_active, created_at, updated_at
FROM containers 
WHERE state = $1 AND is_active = true
ORDER BY created_at DESC;

-- name: UpdateContainer :one
UPDATE containers 
SET name = $2, image = $3, state = $4, status = $5, labels = $6, started_at = $7, finished_at = $8, is_active = $9, updated_at = CURRENT_TIMESTAMP
WHERE id = $1
RETURNING updated_at;

-- name: SoftDeleteContainer :exec
UPDATE containers 
SET is_active = false, updated_at = CURRENT_TIMESTAMP 
WHERE id = $1;

-- name: HardDeleteContainer :exec
DELETE FROM containers WHERE id = $1;

-- name: GetActiveContainerCount :one
SELECT COUNT(*) FROM containers WHERE is_active = true;

-- name: GetContainerStats :one
SELECT 
    COUNT(*) as total_containers,
    COALESCE(SUM(CASE WHEN is_active = true THEN 1 ELSE 0 END), 0) as active_containers,
    COUNT(DISTINCT image) as unique_images,
    COUNT(DISTINCT state) as unique_states,
    MAX(created_at) as newest_container,
    MIN(created_at) as oldest_container
FROM containers;

-- name: UpsertContainer :one
INSERT INTO containers (container_id, name, image, state, status, labels, started_at, finished_at, is_active)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
ON CONFLICT (container_id) 
DO UPDATE SET 
    name = EXCLUDED.name,
    image = EXCLUDED.image,
    state = EXCLUDED.state,
    status = EXCLUDED.status,
    labels = EXCLUDED.labels,
    started_at = EXCLUDED.started_at,
    finished_at = EXCLUDED.finished_at,
    is_active = EXCLUDED.is_active,
    updated_at = CURRENT_TIMESTAMP
RETURNING id, created_at, updated_at;

-- name: CountContainers :one
SELECT COUNT(*) FROM containers WHERE is_active = true;