-- Container CRUD operations (SQLite)

-- name: CreateContainer :one
INSERT INTO containers (container_id, name, image, state, status, labels, started_at, finished_at, is_active)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
RETURNING id, created_at, updated_at;

-- name: GetContainerByID :one
SELECT id, container_id, name, image, state, status, labels, started_at, finished_at, is_active, created_at, updated_at
FROM containers 
WHERE id = ?;

-- name: GetContainerByContainerID :one
SELECT id, container_id, name, image, state, status, labels, started_at, finished_at, is_active, created_at, updated_at
FROM containers 
WHERE container_id = ?;

-- name: ListContainers :many
SELECT id, container_id, name, image, state, status, labels, started_at, finished_at, is_active, created_at, updated_at
FROM containers 
WHERE is_active = 1
ORDER BY created_at DESC
LIMIT ? OFFSET ?;

-- name: GetContainersByImage :many
SELECT id, container_id, name, image, state, status, labels, started_at, finished_at, is_active, created_at, updated_at
FROM containers 
WHERE image = ? AND is_active = 1
ORDER BY created_at DESC;

-- name: GetContainersByState :many
SELECT id, container_id, name, image, state, status, labels, started_at, finished_at, is_active, created_at, updated_at
FROM containers 
WHERE state = ? AND is_active = 1
ORDER BY created_at DESC;

-- name: UpdateContainer :one
UPDATE containers 
SET name = ?, image = ?, state = ?, status = ?, labels = ?, started_at = ?, finished_at = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP
WHERE id = ?
RETURNING updated_at;

-- name: SoftDeleteContainer :exec
UPDATE containers 
SET is_active = 0, updated_at = CURRENT_TIMESTAMP 
WHERE id = ?;

-- name: HardDeleteContainer :exec
DELETE FROM containers WHERE id = ?;

-- name: GetActiveContainerCount :one
SELECT COUNT(*) FROM containers WHERE is_active = 1;

-- name: GetContainerStats :one
SELECT 
    COUNT(*) as total_containers,
    COALESCE(SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END), 0) as active_containers,
    COUNT(DISTINCT image) as unique_images,
    COUNT(DISTINCT state) as unique_states,
    MAX(created_at) as newest_container,
    MIN(created_at) as oldest_container
FROM containers;

-- name: UpsertContainer :one
INSERT INTO containers (container_id, name, image, state, status, labels, started_at, finished_at, is_active)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
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
SELECT COUNT(*) FROM containers WHERE is_active = 1;