package interfaces

import (
	"context"

	"github.com/docker/docker/api/types"
	containertypes "github.com/docker/docker/api/types/container"
	"github.com/docker/docker/api/types/events"
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
	RemoveVolume(ctx context.Context, volumeID string, force bool) error

	// Container operations
	ListContainers(ctx context.Context, filterMap map[string][]string) ([]containertypes.Summary, error)
	InspectContainer(ctx context.Context, containerID string) (containertypes.InspectResponse, error)

	// Events operations
	Events(ctx context.Context, options events.ListOptions) (<-chan events.Message, <-chan error)

	// System operations
	DiskUsage(ctx context.Context, options types.DiskUsageOptions) (types.DiskUsage, error)
}
