package postgres

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5/pgtype"
	"github.com/mantonx/volumeviz/internal/store/generated/postgres"
	"github.com/mantonx/volumeviz/internal/store/interfaces"
	"github.com/mantonx/volumeviz/internal/store/models"
)

// PostgresDockerStore implements DockerStore interface for PostgreSQL
type PostgresDockerStore struct {
	*PostgresInfrastructureStore
}

// NewPostgresDockerStore creates a new PostgreSQL docker store
func NewPostgresDockerStore(infra *PostgresInfrastructureStore) interfaces.DockerStore {
	return &PostgresDockerStore{
		PostgresInfrastructureStore: infra,
	}
}

// UpsertVolume creates or updates a volume
func (s *PostgresDockerStore) UpsertVolume(ctx context.Context, volume *models.Volume) error {
	params := postgres.UpsertVolumeParams{
		VolumeID:   volume.VolumeID,
		Name:       volume.Name,
		Driver:     volume.Driver,
		Mountpoint: volume.Mountpoint,
		IsActive:   nullBoolFromBool(volume.IsActive),
	}

	_, err := s.queries.UpsertVolume(ctx, params)
	if err != nil {
		return fmt.Errorf("failed to upsert volume: %w", err)
	}
	return nil
}

// DeleteVolume deletes a volume by ID
func (s *PostgresDockerStore) DeleteVolume(ctx context.Context, volumeID string) error {
	// First get the volume to find its database ID
	volume, err := s.queries.GetVolumeByVolumeID(ctx, volumeID)
	if err != nil {
		return fmt.Errorf("failed to find volume: %w", err)
	}
	
	// Soft delete the volume
	err = s.queries.SoftDeleteVolume(ctx, int64(volume.ID))
	if err != nil {
		return fmt.Errorf("failed to delete volume: %w", err)
	}
	return nil
}

// GetVolumeByName retrieves a volume by name
func (s *PostgresDockerStore) GetVolumeByName(ctx context.Context, name string) (*models.Volume, error) {
	// List all volumes and filter by name
	// This is not efficient but works given the available queries
	volumes, err := s.queries.ListVolumes(ctx, postgres.ListVolumesParams{
		Limit:  1000,
		Offset: 0,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to list volumes: %w", err)
	}
	
	for _, vol := range volumes {
		if vol.Name == name {
			return fromPostgresVolume(&vol), nil
		}
	}
	
	return nil, fmt.Errorf("volume not found: %s", name)
}

// ListAllVolumes retrieves all volumes
func (s *PostgresDockerStore) ListAllVolumes(ctx context.Context) ([]*models.Volume, error) {
	rows, err := s.queries.ListVolumes(ctx, postgres.ListVolumesParams{
		Limit:  10000, // Large limit to get all volumes
		Offset: 0,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to list all volumes: %w", err)
	}

	volumes := make([]*models.Volume, len(rows))
	for i, row := range rows {
		volumes[i] = fromPostgresVolume(&row)
	}

	return volumes, nil
}

// GetVolumeByVolumeID retrieves a volume by its volume ID
func (s *PostgresDockerStore) GetVolumeByVolumeID(ctx context.Context, volumeID string) (*models.Volume, error) {
	row, err := s.queries.GetVolumeByVolumeID(ctx, volumeID)
	if err != nil {
		return nil, fmt.Errorf("failed to get volume by volume ID: %w", err)
	}

	return fromPostgresVolume(&row), nil
}

// UpsertContainer creates or updates a container
func (s *PostgresDockerStore) UpsertContainer(ctx context.Context, container *models.Container) error {
	var startedAt, finishedAt pgtype.Timestamp
	if container.StartedAt != nil {
		startedAt = pgtype.Timestamp{Time: *container.StartedAt, Valid: true}
	}
	if container.FinishedAt != nil {
		finishedAt = pgtype.Timestamp{Time: *container.FinishedAt, Valid: true}
	}

	_, err := s.queries.UpsertContainer(ctx, postgres.UpsertContainerParams{
		ContainerID: container.ContainerID,
		Name:        container.Name,
		Image:       container.Image,
		State:       container.State,
		Status:      pgtype.Text{String: container.Status, Valid: container.Status != ""},
		Labels:      mapStringToNullString(container.Labels),
		StartedAt:   startedAt,
		FinishedAt:  finishedAt,
		IsActive:    nullBoolFromBool(container.IsActive),
	})
	if err != nil {
		return fmt.Errorf("failed to upsert container: %w", err)
	}
	return nil
}

// DeleteContainer deletes a container by ID
func (s *PostgresDockerStore) DeleteContainer(ctx context.Context, containerID string) error {
	// First get the container to get its ID
	container, err := s.queries.GetContainerByContainerID(ctx, containerID)
	if err != nil {
		return fmt.Errorf("failed to find container %s: %w", containerID, err)
	}

	err = s.queries.SoftDeleteContainer(ctx, int64(container.ID))
	if err != nil {
		return fmt.Errorf("failed to delete container: %w", err)
	}
	return nil
}

// GetContainerByID retrieves a container by ID
func (s *PostgresDockerStore) GetContainerByID(ctx context.Context, containerID string) (*models.Container, error) {
	row, err := s.queries.GetContainerByContainerID(ctx, containerID)
	if err != nil {
		return nil, fmt.Errorf("failed to get container by container ID: %w", err)
	}

	return fromPostgresContainer(&row), nil
}

// GetContainerByContainerID retrieves a container by its container ID  
func (s *PostgresDockerStore) GetContainerByContainerID(ctx context.Context, containerID string) (*models.Container, error) {
	row, err := s.queries.GetContainerByContainerID(ctx, containerID)
	if err != nil {
		return nil, fmt.Errorf("failed to get container by container ID: %w", err)
	}

	return fromPostgresContainer(&row), nil
}

// ListAllContainers retrieves all containers
func (s *PostgresDockerStore) ListAllContainers(ctx context.Context) ([]*models.Container, error) {
	rows, err := s.queries.ListContainers(ctx, postgres.ListContainersParams{
		Limit:  10000, // Large enough limit to get all containers
		Offset: 0,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to list containers: %w", err)
	}

	containers := make([]*models.Container, len(rows))
	for i, row := range rows {
		containers[i] = fromPostgresContainer(&row)
	}

	return containers, nil
}

// UpsertVolumeMount creates or updates a volume mount
func (s *PostgresDockerStore) UpsertVolumeMount(ctx context.Context, mount *models.VolumeMount) error {
	_, err := s.queries.UpsertVolumeMount(ctx, postgres.UpsertVolumeMountParams{
		VolumeID:    mount.VolumeID,
		ContainerID: mount.ContainerID,
		MountPath:   mount.MountPath,
		AccessMode:  mount.AccessMode,
		IsActive:    nullBoolFromBool(mount.IsActive),
	})
	if err != nil {
		return fmt.Errorf("failed to upsert volume mount: %w", err)
	}
	return nil
}

// DeleteVolumeMount deletes a volume mount
func (s *PostgresDockerStore) DeleteVolumeMount(ctx context.Context, volumeID, containerID string) error {
	err := s.queries.SoftDeleteVolumeMountByVolumeContainer(ctx, postgres.SoftDeleteVolumeMountByVolumeContainerParams{
		VolumeID:    volumeID,
		ContainerID: containerID,
	})
	if err != nil {
		return fmt.Errorf("failed to delete volume mount: %w", err)
	}
	return nil
}

// GetVolumeMountsByContainer retrieves volume mounts for a container
func (s *PostgresDockerStore) GetVolumeMountsByContainer(ctx context.Context, containerID string) ([]*models.VolumeMount, error) {
	rows, err := s.queries.GetVolumeMountsByContainer(ctx, containerID)
	if err != nil {
		return nil, fmt.Errorf("failed to get volume mounts by container: %w", err)
	}

	mounts := make([]*models.VolumeMount, len(rows))
	for i, row := range rows {
		mounts[i] = fromPostgresVolumeMount(&row)
	}

	return mounts, nil
}

// GetVolumeMountsByVolume retrieves volume mounts for a volume
func (s *PostgresDockerStore) GetVolumeMountsByVolume(ctx context.Context, volumeID string) ([]*models.VolumeMount, error) {
	rows, err := s.queries.GetVolumeMountsByVolume(ctx, volumeID)
	if err != nil {
		return nil, fmt.Errorf("failed to get volume mounts by volume: %w", err)
	}

	mounts := make([]*models.VolumeMount, len(rows))
	for i, row := range rows {
		mounts[i] = fromPostgresVolumeMount(&row)
	}

	return mounts, nil
}

// DeactivateVolumeMounts deactivates all volume mounts for a container
func (s *PostgresDockerStore) DeactivateVolumeMounts(ctx context.Context, containerID string) error {
	err := s.queries.DeactivateVolumeMounts(ctx, containerID)
	if err != nil {
		return fmt.Errorf("failed to deactivate volume mounts: %w", err)
	}
	return nil
}

// ListAllVolumeMounts retrieves all volume mounts
func (s *PostgresDockerStore) ListAllVolumeMounts(ctx context.Context) ([]*models.VolumeMount, error) {
	rows, err := s.queries.ListVolumeMounts(ctx, postgres.ListVolumeMountsParams{
		Limit:  10000, // Large enough limit to get all mounts
		Offset: 0,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to list volume mounts: %w", err)
	}

	mounts := make([]*models.VolumeMount, len(rows))
	for i, row := range rows {
		mounts[i] = fromPostgresVolumeMount(&row)
	}

	return mounts, nil
}