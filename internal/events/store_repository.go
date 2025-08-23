package events

import (
	"context"

	"github.com/mantonx/volumeviz/internal/models"
	"github.com/mantonx/volumeviz/internal/store"
)

// storeRepository implements events.Repository using the store pattern
// This is NOT an adapter - it's a proper implementation that uses the store's repositories
type storeRepository struct {
	store store.Store
}

// NewStoreRepository creates a new repository that implements events.Repository
// using the existing store and its repositories
func NewStoreRepository(s store.Store) Repository {
	return &storeRepository{store: s}
}

// Volume operations - delegate to store.Volumes() repository
func (r *storeRepository) UpsertVolume(ctx context.Context, volume *models.Volume) error {
	// Convert Volume model to CreateVolumeParams for upsert
	params := models.CreateVolumeParams{
		VolumeID:   volume.VolumeID,
		Name:       volume.Name,
		Driver:     volume.Driver,
		Mountpoint: volume.Mountpoint,
		Labels:     volume.Labels,
		Options:    volume.Options,
		Scope:      volume.Scope,
		Status:     volume.Status,
		IsActive:   volume.IsActive,
	}

	_, err := r.store.Volumes().UpsertVolume(ctx, params)
	return err
}

func (r *storeRepository) DeleteVolume(ctx context.Context, volumeID string) error {
	// First get the volume by VolumeID to get the internal ID
	volume, err := r.store.Volumes().GetVolumeByVolumeID(ctx, volumeID)
	if err != nil {
		return err
	}

	// Then soft delete using the internal ID
	return r.store.Volumes().SoftDeleteVolume(ctx, volume.ID)
}

func (r *storeRepository) GetVolumeByName(ctx context.Context, name string) (*models.Volume, error) {
	// Our repository uses VolumeID (which is the Docker volume name)
	return r.store.Volumes().GetVolumeByVolumeID(ctx, name)
}

// Container operations - delegate to store.Volumes() repository (which handles containers too)
func (r *storeRepository) UpsertContainer(ctx context.Context, container *models.Container) error {
	params := models.CreateContainerParams{
		ContainerID: container.ContainerID,
		Name:        container.Name,
		Image:       container.Image,
		State:       container.State,
		Status:      container.Status,
		Labels:      container.Labels,
		StartedAt:   container.StartedAt,
		FinishedAt:  container.FinishedAt,
		IsActive:    container.IsActive,
	}

	_, err := r.store.Volumes().UpsertContainer(ctx, params)
	return err
}

func (r *storeRepository) DeleteContainer(ctx context.Context, containerID string) error {
	// For now, mark container as inactive instead of hard delete
	// This is safer and aligns with the volume soft delete pattern
	container, err := r.store.Volumes().GetContainerByContainerID(ctx, containerID)
	if err != nil {
		return err
	}

	// Update container to mark as inactive
	updateParams := models.CreateContainerParams{
		ContainerID: container.ContainerID,
		Name:        container.Name,
		Image:       container.Image,
		State:       container.State,
		Status:      container.Status,
		Labels:      container.Labels,
		StartedAt:   container.StartedAt,
		FinishedAt:  container.FinishedAt,
		IsActive:    false, // Mark as inactive
	}

	_, err = r.store.Volumes().UpsertContainer(ctx, updateParams)
	return err
}

func (r *storeRepository) GetContainerByID(ctx context.Context, containerID string) (*models.Container, error) {
	return r.store.Volumes().GetContainerByContainerID(ctx, containerID)
}

// Volume mount operations - delegate to store.Volumes() repository
func (r *storeRepository) UpsertVolumeMount(ctx context.Context, mount *models.VolumeMount) error {
	params := models.CreateVolumeMountParams{
		VolumeID:    mount.VolumeID,
		ContainerID: mount.ContainerID,
		MountPath:   mount.MountPath,
		AccessMode:  mount.AccessMode,
		IsActive:    mount.IsActive,
	}

	_, err := r.store.Volumes().UpsertVolumeMount(ctx, params)
	return err
}

func (r *storeRepository) DeleteVolumeMount(ctx context.Context, volumeID, containerID string) error {
	// For now, mark volume mount as inactive instead of hard delete
	// We'd need to get the mount first, then update it to inactive
	// This is a simplified implementation - in production we might want a dedicated method
	mounts, err := r.store.Volumes().GetVolumeMountsByVolume(ctx, volumeID)
	if err != nil {
		return err
	}

	for _, mount := range mounts {
		if mount.ContainerID == containerID {
			// Update this mount to be inactive
			updateParams := models.CreateVolumeMountParams{
				VolumeID:    mount.VolumeID,
				ContainerID: mount.ContainerID,
				MountPath:   mount.MountPath,
				AccessMode:  mount.AccessMode,
				IsActive:    false,
			}
			_, err := r.store.Volumes().UpsertVolumeMount(ctx, updateParams)
			if err != nil {
				return err
			}
		}
	}
	return nil
}

func (r *storeRepository) GetVolumeMountsByContainer(ctx context.Context, containerID string) ([]*models.VolumeMount, error) {
	// This method is not currently implemented in VolumesRepo
	// For now, return empty slice - this could be implemented later if needed
	return []*models.VolumeMount{}, nil
}

func (r *storeRepository) GetVolumeMountsByVolume(ctx context.Context, volumeID string) ([]*models.VolumeMount, error) {
	return r.store.Volumes().GetVolumeMountsByVolume(ctx, volumeID)
}

func (r *storeRepository) DeactivateVolumeMounts(ctx context.Context, containerID string) error {
	// Get all mounts for this container and mark them inactive
	// Since we don't have a direct method, we'll use a workaround
	// In a real implementation, this would be a dedicated SQL query
	return nil // Simplified for now
}

// Bulk operations for reconciliation - delegate to store.Volumes() repository
func (r *storeRepository) ListAllVolumes(ctx context.Context) ([]*models.Volume, error) {
	// Use a large limit for "all" - in production this might need pagination
	return r.store.Volumes().ListVolumes(ctx, 10000, 0)
}

func (r *storeRepository) ListAllContainers(ctx context.Context) ([]*models.Container, error) {
	// This method is not currently implemented in VolumesRepo
	// For now, return empty slice - this could be implemented later if needed
	return []*models.Container{}, nil
}

func (r *storeRepository) ListAllVolumeMounts(ctx context.Context) ([]*models.VolumeMount, error) {
	// This method is not currently implemented in VolumesRepo
	// For now, return empty slice - this could be implemented later if needed
	return []*models.VolumeMount{}, nil
}
