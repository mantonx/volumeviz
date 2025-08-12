package postgres

import (
	"context"
	"fmt"

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

	err := s.queries.UpsertVolume(ctx, params)
	if err != nil {
		return fmt.Errorf("failed to upsert volume: %w", err)
	}
	return nil
}

// DeleteVolume deletes a volume by ID
func (s *PostgresDockerStore) DeleteVolume(ctx context.Context, volumeID string) error {
	err := s.queries.DeleteVolume(ctx, volumeID)
	if err != nil {
		return fmt.Errorf("failed to delete volume: %w", err)
	}
	return nil
}

// GetVolumeByName retrieves a volume by name
func (s *PostgresDockerStore) GetVolumeByName(ctx context.Context, name string) (*models.Volume, error) {
	row, err := s.queries.GetVolumeByName(ctx, name)
	if err != nil {
		return nil, fmt.Errorf("failed to get volume by name: %w", err)
	}

	return fromPostgresVolume(&row), nil
}

// ListAllVolumes retrieves all volumes
func (s *PostgresDockerStore) ListAllVolumes(ctx context.Context) ([]*models.Volume, error) {
	rows, err := s.queries.ListAllVolumes(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to list all volumes: %w", err)
	}

	volumes := make([]*models.Volume, len(rows))
	for i, row := range rows {
		volumes[i] = fromPostgresVolume(&row)
	}

	return volumes, nil
}

// UpsertContainer creates or updates a container
func (s *PostgresDockerStore) UpsertContainer(ctx context.Context, container *models.Container) error {
	params := postgres.UpsertContainerParams{
		ContainerID: container.ContainerID,
		Name:        container.Name,
		Image:       container.Image,
		State:       container.State,
		IsActive:    nullBoolFromBool(container.IsActive),
	}

	err := s.queries.UpsertContainer(ctx, params)
	if err != nil {
		return fmt.Errorf("failed to upsert container: %w", err)
	}
	return nil
}

// DeleteContainer deletes a container by ID
func (s *PostgresDockerStore) DeleteContainer(ctx context.Context, containerID string) error {
	err := s.queries.DeleteContainer(ctx, containerID)
	if err != nil {
		return fmt.Errorf("failed to delete container: %w", err)
	}
	return nil
}

// GetContainerByID retrieves a container by ID
func (s *PostgresDockerStore) GetContainerByID(ctx context.Context, containerID string) (*models.Container, error) {
	row, err := s.queries.GetContainerByID(ctx, containerID)
	if err != nil {
		return nil, fmt.Errorf("failed to get container by ID: %w", err)
	}

	return fromPostgresContainer(&row), nil
}

// ListAllContainers retrieves all containers
func (s *PostgresDockerStore) ListAllContainers(ctx context.Context) ([]*models.Container, error) {
	rows, err := s.queries.ListAllContainers(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to list all containers: %w", err)
	}

	containers := make([]*models.Container, len(rows))
	for i, row := range rows {
		containers[i] = fromPostgresContainer(&row)
	}

	return containers, nil
}

// UpsertVolumeMount creates or updates a volume mount
func (s *PostgresDockerStore) UpsertVolumeMount(ctx context.Context, mount *models.VolumeMount) error {
	params := postgres.UpsertVolumeMountParams{
		VolumeID:    mount.VolumeID,
		ContainerID: mount.ContainerID,
		MountPath:   mount.MountPath,
		AccessMode:  mount.AccessMode,
		IsActive:    nullBoolFromBool(mount.IsActive),
	}

	err := s.queries.UpsertVolumeMount(ctx, params)
	if err != nil {
		return fmt.Errorf("failed to upsert volume mount: %w", err)
	}
	return nil
}

// DeleteVolumeMount deletes a volume mount
func (s *PostgresDockerStore) DeleteVolumeMount(ctx context.Context, volumeID, containerID string) error {
	err := s.queries.DeleteVolumeMount(ctx, postgres.DeleteVolumeMountParams{
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
	rows, err := s.queries.ListAllVolumeMounts(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to list all volume mounts: %w", err)
	}

	mounts := make([]*models.VolumeMount, len(rows))
	for i, row := range rows {
		mounts[i] = fromPostgresVolumeMount(&row)
	}

	return mounts, nil
}