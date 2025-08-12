package scheduler

import (
	"context"

	"github.com/mantonx/volumeviz/internal/services"
	"github.com/mantonx/volumeviz/internal/models"
)

// DockerVolumeProvider implements VolumeProvider using DockerService
type DockerVolumeProvider struct {
	dockerService *services.DockerService
}

// NewDockerVolumeProvider creates a new DockerVolumeProvider
func NewDockerVolumeProvider(dockerService *services.DockerService) VolumeProvider {
	return &DockerVolumeProvider{
		dockerService: dockerService,
	}
}

// ListVolumes returns all volumes from Docker as models.Volume types
func (p *DockerVolumeProvider) ListVolumes(ctx context.Context) ([]*models.Volume, error) {
	volumes, err := p.dockerService.ListVolumes(ctx)
	if err != nil {
		return nil, err
	}

	storeVolumes := make([]*models.Volume, len(volumes))
	for i, vol := range volumes {
		storeVolumes[i] = &models.Volume{
			VolumeID:   vol.VolumeID,
			Name:       vol.Name,
			Driver:     vol.Driver,
			Mountpoint: vol.Mountpoint,
			Labels:     vol.Labels,
			Options:    vol.Options,
			Scope:      vol.Scope,
			IsActive:   true,
		}
	}

	return storeVolumes, nil
}

// GetVolume returns a specific volume by name as store.Volume type
func (p *DockerVolumeProvider) GetVolume(ctx context.Context, volumeName string) (*models.Volume, error) {
	vol, err := p.dockerService.GetVolume(ctx, volumeName)
	if err != nil {
		return nil, err
	}

	return &models.Volume{
		VolumeID:   vol.VolumeID,
		Name:       vol.Name,
		Driver:     vol.Driver,
		Mountpoint: vol.Mountpoint,
		Labels:     vol.Labels,
		Options:    vol.Options,
		Scope:      vol.Scope,
		IsActive:   true,
	}, nil
}