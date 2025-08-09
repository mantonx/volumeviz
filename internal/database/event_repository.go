package database

import (
	"context"
	"database/sql"
	"fmt"
	"log"
)

// EventRepository handles event-related database operations
// Implements the events.Repository interface for Docker event processing
type EventRepository struct {
	*BaseRepository
}

// NewEventRepository creates a new event repository
func NewEventRepository(db *DB) *EventRepository {
	return &EventRepository{
		BaseRepository: NewBaseRepository(db),
	}
}

// WithTx returns a new event repository instance using the provided transaction
func (r *EventRepository) WithTx(tx *Tx) *EventRepository {
	return &EventRepository{
		BaseRepository: r.BaseRepository.WithTx(tx),
	}
}

// UpsertVolume creates or updates a volume based on volume_id
func (r *EventRepository) UpsertVolume(ctx context.Context, volume *Volume) error {
	query := `
		INSERT INTO volumes (volume_id, name, driver, mountpoint, labels, options, scope, status, is_active, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
		ON CONFLICT (volume_id) 
		DO UPDATE SET 
			name = EXCLUDED.name,
			driver = EXCLUDED.driver,
			mountpoint = EXCLUDED.mountpoint,
			labels = EXCLUDED.labels,
			options = EXCLUDED.options,
			scope = EXCLUDED.scope,
			status = EXCLUDED.status,
			is_active = EXCLUDED.is_active,
			updated_at = EXCLUDED.updated_at
		RETURNING id, created_at, updated_at
	`

	executor := r.getExecutor()
	err := executor.QueryRow(query,
		volume.VolumeID,
		volume.Name,
		volume.Driver,
		volume.Mountpoint,
		volume.Labels,
		volume.Options,
		volume.Scope,
		volume.Status,
		volume.IsActive,
		volume.CreatedAt,
		volume.UpdatedAt,
	).Scan(&volume.ID, &volume.CreatedAt, &volume.UpdatedAt)

	if err != nil {
		return fmt.Errorf("failed to upsert volume: %w", err)
	}

	return nil
}

// DeleteVolume deletes a volume by its volume_id (Docker volume name)
func (r *EventRepository) DeleteVolume(ctx context.Context, volumeID string) error {
	// First deactivate all volume mounts for this volume
	mountQuery := `
		UPDATE volume_mounts 
		SET is_active = false, updated_at = CURRENT_TIMESTAMP 
		WHERE volume_id = $1
	`
	
	executor := r.getExecutor()
	if _, err := executor.Exec(mountQuery, volumeID); err != nil {
		log.Printf("[WARN] Failed to deactivate volume mounts for volume %s: %v", volumeID, err)
	}

	// Then delete the volume
	query := `DELETE FROM volumes WHERE volume_id = $1`
	
	result, err := executor.Exec(query, volumeID)
	if err != nil {
		return fmt.Errorf("failed to delete volume: %w", err)
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return err
	}

	if rowsAffected == 0 {
		// Volume didn't exist, but that's ok for idempotent operations
		log.Printf("[DEBUG] Volume %s not found during delete (already removed)", volumeID)
	}

	return nil
}

// GetVolumeByName retrieves a volume by its name (volume_id)
func (r *EventRepository) GetVolumeByName(ctx context.Context, name string) (*Volume, error) {
	query := `
		SELECT id, volume_id, name, driver, mountpoint, labels, options, 
		       scope, status, last_scanned, is_active, created_at, updated_at
		FROM volumes 
		WHERE volume_id = $1
	`

	executor := r.getExecutor()
	volume := &Volume{}
	var lastScanned sql.NullTime

	err := executor.QueryRow(query, name).Scan(
		&volume.ID,
		&volume.VolumeID,
		&volume.Name,
		&volume.Driver,
		&volume.Mountpoint,
		&volume.Labels,
		&volume.Options,
		&volume.Scope,
		&volume.Status,
		&lastScanned,
		&volume.IsActive,
		&volume.CreatedAt,
		&volume.UpdatedAt,
	)

	if err == sql.ErrNoRows {
		return nil, nil // Not found is not an error for this use case
	}
	if err != nil {
		return nil, err
	}

	if lastScanned.Valid {
		volume.LastScanned = &lastScanned.Time
	}

	return volume, nil
}

// UpsertContainer creates or updates a container based on container_id
func (r *EventRepository) UpsertContainer(ctx context.Context, container *Container) error {
	query := `
		INSERT INTO containers (container_id, name, image, state, status, labels, started_at, finished_at, is_active, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
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
			updated_at = EXCLUDED.updated_at
		RETURNING id, created_at, updated_at
	`

	executor := r.getExecutor()
	err := executor.QueryRow(query,
		container.ContainerID,
		container.Name,
		container.Image,
		container.State,
		container.Status,
		container.Labels,
		container.StartedAt,
		container.FinishedAt,
		container.IsActive,
		container.CreatedAt,
		container.UpdatedAt,
	).Scan(&container.ID, &container.CreatedAt, &container.UpdatedAt)

	if err != nil {
		return fmt.Errorf("failed to upsert container: %w", err)
	}

	return nil
}

// DeleteContainer deletes a container by its container_id
func (r *EventRepository) DeleteContainer(ctx context.Context, containerID string) error {
	// First deactivate all volume mounts for this container
	if err := r.DeactivateVolumeMounts(ctx, containerID); err != nil {
		log.Printf("[WARN] Failed to deactivate volume mounts for container %s: %v", containerID, err)
	}

	// Then delete the container
	query := `DELETE FROM containers WHERE container_id = $1`
	
	executor := r.getExecutor()
	result, err := executor.Exec(query, containerID)
	if err != nil {
		return fmt.Errorf("failed to delete container: %w", err)
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return err
	}

	if rowsAffected == 0 {
		// Container didn't exist, but that's ok for idempotent operations
		log.Printf("[DEBUG] Container %s not found during delete (already removed)", containerID)
	}

	return nil
}

// GetContainerByID retrieves a container by its container_id
func (r *EventRepository) GetContainerByID(ctx context.Context, containerID string) (*Container, error) {
	query := `
		SELECT id, container_id, name, image, state, status, labels, 
		       started_at, finished_at, is_active, created_at, updated_at
		FROM containers 
		WHERE container_id = $1
	`

	executor := r.getExecutor()
	container := &Container{}
	var startedAt, finishedAt sql.NullTime

	err := executor.QueryRow(query, containerID).Scan(
		&container.ID,
		&container.ContainerID,
		&container.Name,
		&container.Image,
		&container.State,
		&container.Status,
		&container.Labels,
		&startedAt,
		&finishedAt,
		&container.IsActive,
		&container.CreatedAt,
		&container.UpdatedAt,
	)

	if err == sql.ErrNoRows {
		return nil, nil // Not found is not an error for this use case
	}
	if err != nil {
		return nil, err
	}

	if startedAt.Valid {
		container.StartedAt = &startedAt.Time
	}
	if finishedAt.Valid {
		container.FinishedAt = &finishedAt.Time
	}

	return container, nil
}

// UpsertVolumeMount creates or updates a volume mount
func (r *EventRepository) UpsertVolumeMount(ctx context.Context, mount *VolumeMount) error {
	query := `
		INSERT INTO volume_mounts (volume_id, container_id, mount_path, access_mode, is_active, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		ON CONFLICT (volume_id, container_id, mount_path) 
		DO UPDATE SET 
			access_mode = EXCLUDED.access_mode,
			is_active = EXCLUDED.is_active,
			updated_at = EXCLUDED.updated_at
		RETURNING id, created_at, updated_at
	`

	executor := r.getExecutor()
	err := executor.QueryRow(query,
		mount.VolumeID,
		mount.ContainerID,
		mount.MountPath,
		mount.AccessMode,
		mount.IsActive,
		mount.CreatedAt,
		mount.UpdatedAt,
	).Scan(&mount.ID, &mount.CreatedAt, &mount.UpdatedAt)

	if err != nil {
		return fmt.Errorf("failed to upsert volume mount: %w", err)
	}

	return nil
}

// DeleteVolumeMount deletes a specific volume mount
func (r *EventRepository) DeleteVolumeMount(ctx context.Context, volumeID, containerID string) error {
	query := `DELETE FROM volume_mounts WHERE volume_id = $1 AND container_id = $2`
	
	executor := r.getExecutor()
	_, err := executor.Exec(query, volumeID, containerID)
	return err
}

// GetVolumeMountsByContainer retrieves all volume mounts for a container
func (r *EventRepository) GetVolumeMountsByContainer(ctx context.Context, containerID string) ([]*VolumeMount, error) {
	query := `
		SELECT id, volume_id, container_id, mount_path, access_mode, is_active, created_at, updated_at
		FROM volume_mounts 
		WHERE container_id = $1
		ORDER BY mount_path
	`

	executor := r.getExecutor()
	rows, err := executor.Query(query, containerID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var mounts []*VolumeMount
	for rows.Next() {
		mount := &VolumeMount{}
		err := rows.Scan(
			&mount.ID,
			&mount.VolumeID,
			&mount.ContainerID,
			&mount.MountPath,
			&mount.AccessMode,
			&mount.IsActive,
			&mount.CreatedAt,
			&mount.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}
		mounts = append(mounts, mount)
	}

	return mounts, rows.Err()
}

// GetVolumeMountsByVolume retrieves all volume mounts for a volume
func (r *EventRepository) GetVolumeMountsByVolume(ctx context.Context, volumeID string) ([]*VolumeMount, error) {
	query := `
		SELECT id, volume_id, container_id, mount_path, access_mode, is_active, created_at, updated_at
		FROM volume_mounts 
		WHERE volume_id = $1
		ORDER BY container_id, mount_path
	`

	executor := r.getExecutor()
	rows, err := executor.Query(query, volumeID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var mounts []*VolumeMount
	for rows.Next() {
		mount := &VolumeMount{}
		err := rows.Scan(
			&mount.ID,
			&mount.VolumeID,
			&mount.ContainerID,
			&mount.MountPath,
			&mount.AccessMode,
			&mount.IsActive,
			&mount.CreatedAt,
			&mount.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}
		mounts = append(mounts, mount)
	}

	return mounts, rows.Err()
}

// DeactivateVolumeMounts deactivates all volume mounts for a container
func (r *EventRepository) DeactivateVolumeMounts(ctx context.Context, containerID string) error {
	query := `
		UPDATE volume_mounts 
		SET is_active = false, updated_at = CURRENT_TIMESTAMP 
		WHERE container_id = $1 AND is_active = true
	`
	
	executor := r.getExecutor()
	_, err := executor.Exec(query, containerID)
	return err
}

// ListAllVolumes retrieves all active volumes
func (r *EventRepository) ListAllVolumes(ctx context.Context) ([]*Volume, error) {
	query := `
		SELECT id, volume_id, name, driver, mountpoint, labels, options, 
		       scope, status, last_scanned, is_active, created_at, updated_at
		FROM volumes 
		WHERE is_active = true
		ORDER BY created_at DESC
	`

	executor := r.getExecutor()
	rows, err := executor.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var volumes []*Volume
	for rows.Next() {
		volume := &Volume{}
		var lastScanned sql.NullTime

		err := rows.Scan(
			&volume.ID,
			&volume.VolumeID,
			&volume.Name,
			&volume.Driver,
			&volume.Mountpoint,
			&volume.Labels,
			&volume.Options,
			&volume.Scope,
			&volume.Status,
			&lastScanned,
			&volume.IsActive,
			&volume.CreatedAt,
			&volume.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}

		if lastScanned.Valid {
			volume.LastScanned = &lastScanned.Time
		}
		volumes = append(volumes, volume)
	}

	return volumes, rows.Err()
}

// ListAllContainers retrieves all active containers
func (r *EventRepository) ListAllContainers(ctx context.Context) ([]*Container, error) {
	query := `
		SELECT id, container_id, name, image, state, status, labels, 
		       started_at, finished_at, is_active, created_at, updated_at
		FROM containers 
		WHERE is_active = true
		ORDER BY created_at DESC
	`

	executor := r.getExecutor()
	rows, err := executor.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var containers []*Container
	for rows.Next() {
		container := &Container{}
		var startedAt, finishedAt sql.NullTime

		err := rows.Scan(
			&container.ID,
			&container.ContainerID,
			&container.Name,
			&container.Image,
			&container.State,
			&container.Status,
			&container.Labels,
			&startedAt,
			&finishedAt,
			&container.IsActive,
			&container.CreatedAt,
			&container.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}

		if startedAt.Valid {
			container.StartedAt = &startedAt.Time
		}
		if finishedAt.Valid {
			container.FinishedAt = &finishedAt.Time
		}
		containers = append(containers, container)
	}

	return containers, rows.Err()
}

// ListAllVolumeMounts retrieves all active volume mounts
func (r *EventRepository) ListAllVolumeMounts(ctx context.Context) ([]*VolumeMount, error) {
	query := `
		SELECT id, volume_id, container_id, mount_path, access_mode, is_active, created_at, updated_at
		FROM volume_mounts 
		WHERE is_active = true
		ORDER BY volume_id, container_id
	`

	executor := r.getExecutor()
	rows, err := executor.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var mounts []*VolumeMount
	for rows.Next() {
		mount := &VolumeMount{}
		err := rows.Scan(
			&mount.ID,
			&mount.VolumeID,
			&mount.ContainerID,
			&mount.MountPath,
			&mount.AccessMode,
			&mount.IsActive,
			&mount.CreatedAt,
			&mount.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}
		mounts = append(mounts, mount)
	}

	return mounts, rows.Err()
}