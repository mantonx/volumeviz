package services

import (
	"context"

	"github.com/docker/docker/api/types"
	containertypes "github.com/docker/docker/api/types/container"
	"github.com/docker/docker/api/types/events"
	"github.com/docker/docker/api/types/volume"
	"github.com/mantonx/volumeviz/internal/interfaces"
)

// DockerClientAdapter adapts DockerService to implement the DockerClient interface
// This is needed because DockerService implements business logic methods while
// DockerClient expects raw Docker API methods
type DockerClientAdapter struct {
	service *DockerService
}

// NewDockerClientAdapter creates a new adapter
func NewDockerClientAdapter(service *DockerService) interfaces.DockerClient {
	return &DockerClientAdapter{service: service}
}

// Connection management
func (a *DockerClientAdapter) Ping(ctx context.Context) error {
	return a.service.Ping(ctx)
}

func (a *DockerClientAdapter) Close() error {
	return a.service.Close()
}

func (a *DockerClientAdapter) IsConnected(ctx context.Context) bool {
	return a.service.IsConnected(ctx)
}

// Version information
func (a *DockerClientAdapter) Version(ctx context.Context) (types.Version, error) {
	return a.service.Version(ctx)
}

// Volume operations
func (a *DockerClientAdapter) ListVolumes(ctx context.Context, filterMap map[string][]string) (volume.ListResponse, error) {
	// Use the underlying client directly
	return a.service.client.ListVolumes(ctx, filterMap)
}

func (a *DockerClientAdapter) InspectVolume(ctx context.Context, volumeID string) (volume.Volume, error) {
	return a.service.InspectVolume(ctx, volumeID)
}

// Container operations
func (a *DockerClientAdapter) ListContainers(ctx context.Context, filterMap map[string][]string) ([]containertypes.Summary, error) {
	return a.service.ListContainers(ctx, filterMap)
}

func (a *DockerClientAdapter) InspectContainer(ctx context.Context, containerID string) (containertypes.InspectResponse, error) {
	return a.service.InspectContainer(ctx, containerID)
}

func (a *DockerClientAdapter) ContainerInspect(ctx context.Context, containerID string) (types.ContainerJSON, error) {
	return a.service.ContainerInspect(ctx, containerID)
}

// Events operations
func (a *DockerClientAdapter) Events(ctx context.Context, options events.ListOptions) (<-chan events.Message, <-chan error) {
	return a.service.Events(ctx, options)
}