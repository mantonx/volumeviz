package sqlite

import (
	"context"
	"database/sql"
	"fmt"

	sqlite "github.com/mantonx/volumeviz/internal/store/generated/sqlite"
	"github.com/mantonx/volumeviz/internal/store/interfaces"
	"github.com/mantonx/volumeviz/internal/store/models"
)

// SQLiteDockerStore implements DockerStore interface using SQLite
type SQLiteDockerStore struct {
	infraStore *SQLiteInfrastructureStore
}

// NewSQLiteDockerStore creates a new SQLite docker store
func NewSQLiteDockerStore(infraStore *SQLiteInfrastructureStore) interfaces.DockerStore {
	return &SQLiteDockerStore{
		infraStore: infraStore,
	}
}

// Volume operations

// UpsertVolume creates or updates a volume
func (s *SQLiteDockerStore) UpsertVolume(ctx context.Context, volume *models.Volume) error {
	_, err := s.infraStore.GetQueries().UpsertVolume(ctx, sqlite.UpsertVolumeParams{
		VolumeID:   volume.VolumeID,
		Name:       volume.Name,
		Driver:     volume.Driver,
		Mountpoint: volume.Mountpoint,
		Labels:     mapStringToNullString(volume.Labels),
		Options:    mapStringToNullString(volume.Options),
		Scope:      sql.NullString{String: volume.Scope, Valid: volume.Scope != ""},
		Status:     sql.NullString{String: volume.Status, Valid: volume.Status != ""},
		IsActive:   sql.NullInt64{Int64: boolToSQLiteInt(volume.IsActive), Valid: true},
	})
	if err != nil {
		return fmt.Errorf("failed to upsert volume: %w", err)
	}
	return nil
}

// DeleteVolume deletes a volume
func (s *SQLiteDockerStore) DeleteVolume(ctx context.Context, volumeID string) error {
	// First get the volume to get its ID
	volume, err := s.GetVolumeByVolumeID(ctx, volumeID)
	if err != nil {
		return fmt.Errorf("failed to find volume %s: %w", volumeID, err)
	}

	err = s.infraStore.GetQueries().SoftDeleteVolume(ctx, volume.ID)
	if err != nil {
		return fmt.Errorf("failed to delete volume: %w", err)
	}
	return nil
}

// GetVolumeByVolumeID retrieves a volume by its volume ID
func (s *SQLiteDockerStore) GetVolumeByVolumeID(ctx context.Context, volumeID string) (*models.Volume, error) {
	row, err := s.infraStore.GetQueries().GetVolumeByVolumeID(ctx, volumeID)
	if err != nil {
		return nil, fmt.Errorf("failed to get volume by volume ID: %w", err)
	}

	return fromSQLiteVolume(row)
}

// GetVolumeByName retrieves a volume by its name
func (s *SQLiteDockerStore) GetVolumeByName(ctx context.Context, name string) (*models.Volume, error) {
	// We'll need to use ListVolumes and filter by name since there's no GetVolumeByName query
	volumes, err := s.ListAllVolumes(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to list volumes: %w", err)
	}

	for _, volume := range volumes {
		if volume.Name == name {
			return volume, nil
		}
	}

	return nil, fmt.Errorf("volume with name '%s' not found", name)
}

// ListAllVolumes retrieves all volumes
func (s *SQLiteDockerStore) ListAllVolumes(ctx context.Context) ([]*models.Volume, error) {
	// Use a large limit to get all volumes
	rows, err := s.infraStore.GetQueries().ListVolumes(ctx, sqlite.ListVolumesParams{
		Limit:  10000, // Large enough limit to get all volumes
		Offset: 0,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to list volumes: %w", err)
	}

	volumes := make([]*models.Volume, len(rows))
	for i, row := range rows {
		volume, err := fromSQLiteVolume(row)
		if err != nil {
			return nil, fmt.Errorf("failed to convert volume %d: %w", i, err)
		}
		volumes[i] = volume
	}

	return volumes, nil
}

// Container operations

// UpsertContainer creates or updates a container
func (s *SQLiteDockerStore) UpsertContainer(ctx context.Context, container *models.Container) error {
	var startedAt, finishedAt sql.NullTime
	if container.StartedAt != nil {
		startedAt = sql.NullTime{Time: *container.StartedAt, Valid: true}
	}
	if container.FinishedAt != nil {
		finishedAt = sql.NullTime{Time: *container.FinishedAt, Valid: true}
	}

	_, err := s.infraStore.GetQueries().UpsertContainer(ctx, sqlite.UpsertContainerParams{
		ContainerID: container.ContainerID,
		Name:        container.Name,
		Image:       container.Image,
		State:       container.State,
		Status:      sql.NullString{String: container.Status, Valid: container.Status != ""},
		Labels:      mapStringToNullString(container.Labels),
		StartedAt:   startedAt,
		FinishedAt:  finishedAt,
		IsActive:    sql.NullInt64{Int64: boolToSQLiteInt(container.IsActive), Valid: true},
	})
	if err != nil {
		return fmt.Errorf("failed to upsert container: %w", err)
	}
	return nil
}

// DeleteContainer deletes a container
func (s *SQLiteDockerStore) DeleteContainer(ctx context.Context, containerID string) error {
	// First get the container to get its ID
	container, err := s.GetContainerByID(ctx, containerID)
	if err != nil {
		return fmt.Errorf("failed to find container %s: %w", containerID, err)
	}

	err = s.infraStore.GetQueries().SoftDeleteContainer(ctx, container.ID)
	if err != nil {
		return fmt.Errorf("failed to delete container: %w", err)
	}
	return nil
}

// GetContainerByContainerID retrieves a container by its container ID
func (s *SQLiteDockerStore) GetContainerByContainerID(ctx context.Context, containerID string) (*models.Container, error) {
	row, err := s.infraStore.GetQueries().GetContainerByContainerID(ctx, containerID)
	if err != nil {
		return nil, fmt.Errorf("failed to get container by container ID: %w", err)
	}

	return fromSQLiteContainer(row)
}

// GetContainerByID retrieves a container by its ID
func (s *SQLiteDockerStore) GetContainerByID(ctx context.Context, containerID string) (*models.Container, error) {
	// Note: This method name is misleading - it actually expects a container_id string, not the internal ID
	return s.GetContainerByContainerID(ctx, containerID)
}

// ListAllContainers retrieves all containers
func (s *SQLiteDockerStore) ListAllContainers(ctx context.Context) ([]*models.Container, error) {
	// Use a large limit to get all containers
	rows, err := s.infraStore.GetQueries().ListContainers(ctx, sqlite.ListContainersParams{
		Limit:  10000, // Large enough limit to get all containers
		Offset: 0,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to list containers: %w", err)
	}

	containers := make([]*models.Container, len(rows))
	for i, row := range rows {
		container, err := fromSQLiteContainer(row)
		if err != nil {
			return nil, fmt.Errorf("failed to convert container %d: %w", i, err)
		}
		containers[i] = container
	}

	return containers, nil
}

// Volume Mount operations

// UpsertVolumeMount creates or updates a volume mount
func (s *SQLiteDockerStore) UpsertVolumeMount(ctx context.Context, mount *models.VolumeMount) error {
	_, err := s.infraStore.GetQueries().UpsertVolumeMount(ctx, sqlite.UpsertVolumeMountParams{
		VolumeID:    mount.VolumeID,
		ContainerID: mount.ContainerID,
		MountPath:   mount.MountPath,
		AccessMode:  mount.AccessMode,
		IsActive:    sql.NullInt64{Int64: boolToSQLiteInt(mount.IsActive), Valid: true},
	})
	if err != nil {
		return fmt.Errorf("failed to upsert volume mount: %w", err)
	}
	return nil
}

// DeleteVolumeMount deletes a volume mount
func (s *SQLiteDockerStore) DeleteVolumeMount(ctx context.Context, volumeID, containerID string) error {
	err := s.infraStore.GetQueries().SoftDeleteVolumeMountByVolumeContainer(ctx, sqlite.SoftDeleteVolumeMountByVolumeContainerParams{
		VolumeID:    volumeID,
		ContainerID: containerID,
	})
	if err != nil {
		return fmt.Errorf("failed to delete volume mount: %w", err)
	}
	return nil
}

// GetVolumeMountsByContainer retrieves volume mounts for a container
func (s *SQLiteDockerStore) GetVolumeMountsByContainer(ctx context.Context, containerID string) ([]*models.VolumeMount, error) {
	rows, err := s.infraStore.GetQueries().GetVolumeMountsByContainer(ctx, containerID)
	if err != nil {
		return nil, fmt.Errorf("failed to get volume mounts by container: %w", err)
	}

	mounts := make([]*models.VolumeMount, len(rows))
	for i, row := range rows {
		mount, err := fromSQLiteVolumeMount(row)
		if err != nil {
			return nil, fmt.Errorf("failed to convert volume mount %d: %w", i, err)
		}
		mounts[i] = mount
	}

	return mounts, nil
}

// GetVolumeMountsByVolume retrieves volume mounts for a volume
func (s *SQLiteDockerStore) GetVolumeMountsByVolume(ctx context.Context, volumeID string) ([]*models.VolumeMount, error) {
	rows, err := s.infraStore.GetQueries().GetVolumeMountsByVolume(ctx, volumeID)
	if err != nil {
		return nil, fmt.Errorf("failed to get volume mounts by volume: %w", err)
	}

	mounts := make([]*models.VolumeMount, len(rows))
	for i, row := range rows {
		mount, err := fromSQLiteVolumeMount(row)
		if err != nil {
			return nil, fmt.Errorf("failed to convert volume mount %d: %w", i, err)
		}
		mounts[i] = mount
	}

	return mounts, nil
}

// DeactivateVolumeMounts deactivates all volume mounts for a container
func (s *SQLiteDockerStore) DeactivateVolumeMounts(ctx context.Context, containerID string) error {
	err := s.infraStore.GetQueries().DeactivateVolumeMounts(ctx, containerID)
	if err != nil {
		return fmt.Errorf("failed to deactivate volume mounts: %w", err)
	}
	return nil
}

// ListAllVolumeMounts retrieves all volume mounts
func (s *SQLiteDockerStore) ListAllVolumeMounts(ctx context.Context) ([]*models.VolumeMount, error) {
	// Use a large limit to get all volume mounts
	rows, err := s.infraStore.GetQueries().ListVolumeMounts(ctx, sqlite.ListVolumeMountsParams{
		Limit:  10000, // Large enough limit to get all mounts
		Offset: 0,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to list volume mounts: %w", err)
	}

	mounts := make([]*models.VolumeMount, len(rows))
	for i, row := range rows {
		mount, err := fromSQLiteVolumeMount(row)
		if err != nil {
			return nil, fmt.Errorf("failed to convert volume mount %d: %w", i, err)
		}
		mounts[i] = mount
	}

	return mounts, nil
}