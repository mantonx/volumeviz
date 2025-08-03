package interfaces

import (
	"context"

	"github.com/docker/docker/api/types"
	"github.com/docker/docker/api/types/volume"
)

// DockerClient defines the interface for Docker operations
type DockerClient interface {
	// Connection management
	Ping(ctx context.Context) error
	Close() error
	IsConnected(ctx context.Context) bool

	// Version information
	Version(ctx context.Context) (types.Version, error)

	// Volume operations
	ListVolumes(ctx context.Context, filterMap map[string][]string) (volume.ListResponse, error)
	InspectVolume(ctx context.Context, volumeID string) (volume.Volume, error)

	// Container operations
	ListContainers(ctx context.Context, filterMap map[string][]string) ([]types.Container, error)
	InspectContainer(ctx context.Context, containerID string) (types.ContainerJSON, error)
}