// Package docker provides Docker client services for VolumeViz operations
// Wraps Docker API calls with error handling and data transformation
package docker

import (
	"context"
	"fmt"
	"sync"
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

	// Disk usage cache to avoid expensive Docker API calls
	diskUsageCache      *types.DiskUsage
	diskUsageCacheTime  time.Time
	diskUsageCacheTTL   time.Duration
	diskUsageCacheMutex sync.RWMutex
}

// NewDockerService creates a new Docker service instance
// Pass Docker daemon URL and connection timeout
func NewDockerService(host string, timeout time.Duration) (*DockerService, error) {
	client, err := docker.NewClient(host, timeout)
	if err != nil {
		return nil, utils.WrapError(err, "failed to create Docker client")
	}

	return &DockerService{
		client:            client,
		diskUsageCacheTTL: 30 * time.Second, // Cache disk usage for 30 seconds
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

// getCachedDiskUsage returns cached disk usage data or fetches fresh data if cache is stale
// This significantly improves performance by avoiding expensive Docker API calls
func (s *DockerService) getCachedDiskUsage(ctx context.Context) types.DiskUsage {
	s.diskUsageCacheMutex.RLock()
	if s.diskUsageCache != nil && time.Since(s.diskUsageCacheTime) < s.diskUsageCacheTTL {
		// Cache hit - return cached data
		cache := *s.diskUsageCache
		s.diskUsageCacheMutex.RUnlock()
		return cache
	}
	s.diskUsageCacheMutex.RUnlock()

	// Cache miss or stale - fetch fresh data
	s.diskUsageCacheMutex.Lock()
	defer s.diskUsageCacheMutex.Unlock()

	// Double-check after acquiring write lock (another goroutine might have updated it)
	if s.diskUsageCache != nil && time.Since(s.diskUsageCacheTime) < s.diskUsageCacheTTL {
		return *s.diskUsageCache
	}

	// Fetch fresh disk usage data
	diskUsage, err := s.client.DiskUsage(ctx, types.DiskUsageOptions{
		Types: []types.DiskUsageObject{types.VolumeObject},
	})
	if err != nil {
		// Log the error but return empty diskUsage - volumes will just show without sizes
		// This maintains backward compatibility if the Docker daemon doesn't support /system/df
		return types.DiskUsage{}
	}

	// Update cache
	s.diskUsageCache = &diskUsage
	s.diskUsageCacheTime = time.Now()

	return diskUsage
}

// ListVolumes returns all Docker volumes with metadata
func (s *DockerService) ListVolumes(ctx context.Context) ([]models.Volume, error) {
	// List all volumes
	volumeResp, err := s.client.ListVolumes(ctx, nil)
	if err != nil {
		return nil, utils.WrapError(err, "failed to list volumes")
	}

	// Get disk usage data which includes volume sizes (with caching)
	diskUsage := s.getCachedDiskUsage(ctx)

	// Create a map of volume names to disk usage data for quick lookup
	volumeSizeMap := make(map[string]*volume.UsageData)
	if len(diskUsage.Volumes) > 0 {
		for _, vol := range diskUsage.Volumes {
			if vol.UsageData != nil {
				volumeSizeMap[vol.Name] = vol.UsageData
			}
		}
	}

	volumes := make([]models.Volume, 0, len(volumeResp.Volumes))
	for _, vol := range volumeResp.Volumes {
		volume := s.convertToVolumeModel(*vol)

		// Override usage data with disk usage information if available
		if usageData, exists := volumeSizeMap[vol.Name]; exists {
			volume.UsageData = &models.VolumeUsage{
				RefCount: int(usageData.RefCount),
				Size:     usageData.Size,
			}
		}

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

	// Get disk usage data to populate size information
	diskUsage, err := s.client.DiskUsage(ctx, types.DiskUsageOptions{
		Types: []types.DiskUsageObject{types.VolumeObject},
	})
	if err == nil && len(diskUsage.Volumes) > 0 {
		// Find this volume in the disk usage response
		for _, diskVol := range diskUsage.Volumes {
			if diskVol.Name == volumeID && diskVol.UsageData != nil {
				volume.UsageData = &models.VolumeUsage{
					RefCount: int(diskVol.UsageData.RefCount),
					Size:     diskVol.UsageData.Size,
				}
				break
			}
		}
	}

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
				var image string
				if containerInfo.Config != nil {
					image = containerInfo.Config.Image
				}

				volumeContainer := models.VolumeContainer{
					ID:          1, // Auto-increment ID
					ContainerID: container.ID,
					VolumeID:    volumeName,
					Name:        containerInfo.Name,
					Image:       image,
					State:       container.State,
					Status:      container.Status,
					MountPath:   mount.Destination,
					AccessMode:  "rw", // Default
					IsActive:    container.State == "running",
					CreatedAt:   time.Now(),
					UpdatedAt:   time.Now(),
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

// GetVolumeContainersBatch retrieves containers for multiple volumes in a single batch operation
// This is much more efficient than calling GetVolumeContainers for each volume individually
func (s *DockerService) GetVolumeContainersBatch(ctx context.Context, volumeNames []string) (map[string][]models.VolumeContainer, error) {
	// List all containers once
	containers, err := s.client.ListContainers(ctx, nil)
	if err != nil {
		return nil, utils.WrapError(err, "failed to list containers")
	}

	// Build a map of volume name -> containers
	volumeContainerMap := make(map[string][]models.VolumeContainer)

	// Initialize map with empty slices for all requested volumes
	for _, volumeName := range volumeNames {
		volumeContainerMap[volumeName] = []models.VolumeContainer{}
	}

	// Check each container for volume mounts
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
			if mount.Type == "volume" {
				// Check if this volume is one we're interested in
				for _, volumeName := range volumeNames {
					if mount.Name == volumeName {
						volumeContainer := models.VolumeContainer{
							ID:          1, // Auto-increment ID
							ContainerID: container.ID,
							VolumeID:    volumeName,
							Name:        containerInfo.Name,
							Image:       containerInfo.Config.Image,
							State:       container.State,
							Status:      container.Status,
							MountPath:   mount.Destination,
							AccessMode:  "rw", // Default
							IsActive:    container.State == "running",
							CreatedAt:   time.Now(),
							UpdatedAt:   time.Now(),
						}

						// Determine read/write permissions from mount
						if !mount.RW {
							volumeContainer.AccessMode = "ro"
						}

						volumeContainerMap[volumeName] = append(volumeContainerMap[volumeName], volumeContainer)
						break // Found the volume, no need to check other mounts in this volume
					}
				}
			}
		}
	}

	return volumeContainerMap, nil
}

// convertToVolumeModel converts Docker API volume to our model
func (s *DockerService) convertToVolumeModel(vol volume.Volume) models.Volume {
	volume := models.Volume{
		ID:         1,        // Auto-increment ID (will be set by database)
		VolumeID:   vol.Name, // Docker volumes use name as volume ID
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

	// Set basic status - Docker volumes are typically "active" if they exist
	volume.Status = "active"
	volume.IsActive = true

	// Set usage data if available
	if vol.UsageData != nil {
		volume.UsageData = &models.VolumeUsage{
			RefCount: int(vol.UsageData.RefCount),
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

// RemoveVolume permanently deletes a Docker volume. Callers are responsible
// for confirming the volume isn't attached to any container before calling
// this — force=false additionally leaves Docker's own daemon-side in-use
// check as a final backstop against deleting an attached volume.
func (s *DockerService) RemoveVolume(ctx context.Context, volumeID string, force bool) error {
	return s.client.RemoveVolume(ctx, volumeID, force)
}

// InspectContainer is an alias for GetVolumeContainers' internal implementation
// Returns detailed container information in the Docker API format
func (s *DockerService) InspectContainer(ctx context.Context, containerID string) (containertypes.InspectResponse, error) {
	return s.client.InspectContainer(ctx, containerID)
}

// GetDockerClient returns the underlying Docker client for events processing
// This provides access to the raw Docker API for services that need it
func (s *DockerService) GetDockerClient() interfaces.DockerClient {
	return s.client
}
