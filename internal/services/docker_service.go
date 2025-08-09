// Package services provides business logic for VolumeViz operations
// Wraps Docker API calls with error handling and data transformation
package services

import (
	"context"
	"fmt"
	"time"

	"github.com/docker/docker/api/types"
	containertypes "github.com/docker/docker/api/types/container"
	"github.com/docker/docker/api/types/events"
	"github.com/docker/docker/api/types/volume"
	"github.com/mantonx/volumeviz/internal/interfaces"
	"github.com/mantonx/volumeviz/internal/models"
	"github.com/mantonx/volumeviz/internal/utils"
	"github.com/mantonx/volumeviz/pkg/docker"
)

// DockerService handles Docker-related operations
// Wraps the Docker client with business logic and error handling
type DockerService struct {
	client interfaces.DockerClient
}

// NewDockerService creates a new Docker service instance
// Pass Docker daemon URL and connection timeout
func NewDockerService(host string, timeout time.Duration) (*DockerService, error) {
	client, err := docker.NewClient(host, timeout)
	if err != nil {
		return nil, utils.WrapError(err, "failed to create Docker client")
	}

	return &DockerService{
		client: client,
	}, nil
}

// NewDockerServiceWithClient creates a new Docker service with a custom client
// Mainly used for testing with mock clients
func NewDockerServiceWithClient(client interfaces.DockerClient) *DockerService {
	return &DockerService{
		client: client,
	}
}

// Close closes the Docker service and its underlying connections
// Always call this when you're done to avoid resource leaks
func (s *DockerService) Close() error {
	return s.client.Close()
}

// Ping checks if the Docker daemon is reachable
// Returns error if daemon is down or unreachable
func (s *DockerService) Ping(ctx context.Context) error {
	return s.client.Ping(ctx)
}

// IsConnected checks if the Docker daemon is connected
// Returns true if connected, false otherwise
func (s *DockerService) IsConnected(ctx context.Context) bool {
	return s.client.IsConnected(ctx)
}

// GetVersion returns Docker daemon version information
// Useful for compatibility checks and debugging
func (s *DockerService) GetVersion(ctx context.Context) (types.Version, error) {
	return s.client.Version(ctx)
}

// Version is an alias for GetVersion to satisfy the DockerClient interface
func (s *DockerService) Version(ctx context.Context) (types.Version, error) {
	return s.client.Version(ctx)
}

// ListVolumes returns all Docker volumes with metadata
func (s *DockerService) ListVolumes(ctx context.Context) ([]models.Volume, error) {
	// List all volumes
	volumeResp, err := s.client.ListVolumes(ctx, nil)
	if err != nil {
		return nil, utils.WrapError(err, "failed to list volumes")
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
		return nil, utils.WrapErrorf(err, "failed to get volume %s", volumeID)
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
		return nil, utils.WrapError(err, "failed to list containers")
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
					ID:         container.ID,
					Name:       containerInfo.Name,
					State:      container.State,
					Status:     container.Status,
					MountPath:  mount.Destination,
					MountType:  string(mount.Type),
					AccessMode: "rw", // Default
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
		return nil, utils.WrapErrorf(err, "failed to list volumes by driver %s", driver)
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
		return nil, utils.WrapErrorf(err, "failed to list volumes by label %s", labelKey)
	}

	volumes := make([]models.Volume, 0, len(volumeResp.Volumes))
	for _, vol := range volumeResp.Volumes {
		volume := s.convertToVolumeModel(*vol)
		volumes = append(volumes, volume)
	}

	return volumes, nil
}

// ContainerInspect returns detailed information about a container
// This is needed for the events service to inspect containers
func (s *DockerService) ContainerInspect(ctx context.Context, containerID string) (types.ContainerJSON, error) {
	return s.client.ContainerInspect(ctx, containerID)
}

// Events returns a channel of Docker events and errors
// Used by the events service to monitor Docker daemon events
func (s *DockerService) Events(ctx context.Context, options events.ListOptions) (<-chan events.Message, <-chan error) {
	return s.client.Events(ctx, options)
}

// ListContainers returns a list of containers
// Needed for event reconciliation
func (s *DockerService) ListContainers(ctx context.Context, filterMap map[string][]string) ([]containertypes.Summary, error) {
	return s.client.ListContainers(ctx, filterMap)
}

// InspectVolume returns detailed information about a volume
// Needed for events processing
func (s *DockerService) InspectVolume(ctx context.Context, volumeID string) (volume.Volume, error) {
	return s.client.InspectVolume(ctx, volumeID)
}

// InspectContainer is an alias for GetVolumeContainers' internal implementation
// Returns detailed container information in the Docker API format
func (s *DockerService) InspectContainer(ctx context.Context, containerID string) (containertypes.InspectResponse, error) {
	return s.client.InspectContainer(ctx, containerID)
}

