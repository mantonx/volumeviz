package services

import (
	"context"
	"fmt"
	"time"

	"github.com/docker/docker/api/types"
	"github.com/docker/docker/api/types/volume"
	"github.com/username/volumeviz/internal/models"
	"github.com/username/volumeviz/pkg/docker"
)

// DockerService handles Docker-related operations
type DockerService struct {
	client *docker.Client
}

// NewDockerService creates a new Docker service instance
func NewDockerService(host string, timeout time.Duration) (*DockerService, error) {
	client, err := docker.NewClient(host, timeout)
	if err != nil {
		return nil, fmt.Errorf("failed to create Docker client: %w", err)
	}

	return &DockerService{
		client: client,
	}, nil
}

// Close closes the Docker service and its underlying connections
func (s *DockerService) Close() error {
	return s.client.Close()
}

// Ping checks if the Docker daemon is reachable
func (s *DockerService) Ping(ctx context.Context) error {
	return s.client.Ping(ctx)
}

// GetVersion returns Docker daemon version information
func (s *DockerService) GetVersion(ctx context.Context) (types.Version, error) {
	return s.client.Version(ctx)
}

// ListVolumes returns all Docker volumes with metadata
func (s *DockerService) ListVolumes(ctx context.Context) ([]models.Volume, error) {
	// List all volumes
	volumeResp, err := s.client.ListVolumes(ctx, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to list volumes: %w", err)
	}

	volumes := make([]models.Volume, 0, len(volumeResp.Volumes))
	for _, vol := range volumeResp.Volumes {
		volume := s.convertToVolumeModel(*vol)
		volumes = append(volumes, volume)
	}

	return volumes, nil
}

// GetVolume returns detailed information about a specific volume
func (s *DockerService) GetVolume(ctx context.Context, volumeID string) (*models.Volume, error) {
	// Inspect the volume
	vol, err := s.client.InspectVolume(ctx, volumeID)
	if err != nil {
		return nil, fmt.Errorf("failed to get volume %s: %w", volumeID, err)
	}

	// Convert to our model
	volume := s.convertToVolumeModel(vol)
	return &volume, nil
}

// GetVolumeContainers returns all containers using a specific volume
func (s *DockerService) GetVolumeContainers(ctx context.Context, volumeName string) ([]models.VolumeContainer, error) {
	// List all containers
	containers, err := s.client.ListContainers(ctx, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to list containers: %w", err)
	}

	var volumeContainers []models.VolumeContainer

	// Check each container for the volume mount
	for _, container := range containers {
		// Inspect container to get detailed mount information
		containerInfo, err := s.client.InspectContainer(ctx, container.ID)
		if err != nil {
			// Skip this container if we can't inspect it
			continue
		}

		// Check each mount point
		for _, mount := range containerInfo.Mounts {
			// For volumes, the mount name matches the volume name
			if mount.Type == "volume" && mount.Name == volumeName {
				volumeContainer := models.VolumeContainer{
					ID:          container.ID,
					Name:        containerInfo.Name,
					State:       container.State,
					Status:      container.Status,
					MountPath:   mount.Destination,
					MountType:   string(mount.Type),
					AccessMode:  "rw", // Default
				}

				// Determine read/write permissions from mount
				if !mount.RW {
					volumeContainer.AccessMode = "ro"
				}

				volumeContainers = append(volumeContainers, volumeContainer)
				break // Found the volume, no need to check other mounts
			}
		}
	}

	return volumeContainers, nil
}

// convertToVolumeModel converts Docker API volume to our model
func (s *DockerService) convertToVolumeModel(vol volume.Volume) models.Volume {
	volume := models.Volume{
		ID:         vol.Name, // Docker volumes use name as ID
		Name:       vol.Name,
		Driver:     vol.Driver,
		Mountpoint: vol.Mountpoint,
		Labels:     vol.Labels,
		Options:    vol.Options,
		Scope:      vol.Scope,
	}

	// Parse creation time if available
	if vol.CreatedAt != "" {
		if createdAt, err := time.Parse(time.RFC3339, vol.CreatedAt); err == nil {
			volume.CreatedAt = createdAt
		}
	}

	// Convert status map from interface{} to string for compatibility
	if vol.Status != nil {
		volume.Status = make(map[string]string)
		for key, value := range vol.Status {
			if strValue, ok := value.(string); ok {
				volume.Status[key] = strValue
			} else {
				volume.Status[key] = fmt.Sprintf("%v", value)
			}
		}
	}

	// Set usage data if available
	if vol.UsageData != nil {
		volume.UsageData = &models.VolumeUsage{
			RefCount: vol.UsageData.RefCount,
			Size:     vol.UsageData.Size,
		}
	}

	return volume
}

// IsDockerAvailable checks if Docker daemon is available
func (s *DockerService) IsDockerAvailable(ctx context.Context) bool {
	return s.client.IsConnected(ctx)
}

// GetVolumesByDriver returns volumes filtered by driver
func (s *DockerService) GetVolumesByDriver(ctx context.Context, driver string) ([]models.Volume, error) {
	filterMap := map[string][]string{
		"driver": {driver},
	}

	volumeResp, err := s.client.ListVolumes(ctx, filterMap)
	if err != nil {
		return nil, fmt.Errorf("failed to list volumes by driver %s: %w", driver, err)
	}

	volumes := make([]models.Volume, 0, len(volumeResp.Volumes))
	for _, vol := range volumeResp.Volumes {
		volume := s.convertToVolumeModel(*vol)
		volumes = append(volumes, volume)
	}

	return volumes, nil
}

// GetVolumesByLabel returns volumes filtered by label
func (s *DockerService) GetVolumesByLabel(ctx context.Context, labelKey, labelValue string) ([]models.Volume, error) {
	labelFilter := labelKey
	if labelValue != "" {
		labelFilter = fmt.Sprintf("%s=%s", labelKey, labelValue)
	}

	filterMap := map[string][]string{
		"label": {labelFilter},
	}

	volumeResp, err := s.client.ListVolumes(ctx, filterMap)
	if err != nil {
		return nil, fmt.Errorf("failed to list volumes by label %s: %w", labelKey, err)
	}

	volumes := make([]models.Volume, 0, len(volumeResp.Volumes))
	for _, vol := range volumeResp.Volumes {
		volume := s.convertToVolumeModel(*vol)
		volumes = append(volumes, volume)
	}

	return volumes, nil
}