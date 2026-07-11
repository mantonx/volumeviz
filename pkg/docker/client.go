package docker

import (
	"context"
	"fmt"
	"time"

	"github.com/docker/docker/api/types"
	containertypes "github.com/docker/docker/api/types/container"
	"github.com/docker/docker/api/types/events"
	"github.com/docker/docker/api/types/filters"
	"github.com/docker/docker/api/types/volume"
	"github.com/docker/docker/client"
)

// Client wraps the Docker client with additional functionality
type Client struct {
	cli     *client.Client
	timeout time.Duration
}

// NewClient creates a new Docker client with configurable options
func NewClient(host string, timeout time.Duration) (*Client, error) {
	var cli *client.Client
	var err error

	if host != "" {
		cli, err = client.NewClientWithOpts(
			client.WithHost(host),
			client.WithAPIVersionNegotiation(),
		)
	} else {
		cli, err = client.NewClientWithOpts(
			client.FromEnv,
			client.WithAPIVersionNegotiation(),
		)
	}

	if err != nil {
		return nil, fmt.Errorf("failed to create Docker client: %w", err)
	}

	return &Client{
		cli:     cli,
		timeout: timeout,
	}, nil
}

// Close closes the Docker client connection
func (c *Client) Close() error {
	return c.cli.Close()
}

// Ping checks if the Docker daemon is reachable
func (c *Client) Ping(ctx context.Context) error {
	ctx, cancel := c.contextWithTimeout(ctx)
	defer cancel()

	_, err := c.cli.Ping(ctx)
	if err != nil {
		return fmt.Errorf("docker daemon unreachable: %w", err)
	}
	return nil
}

// Version returns Docker daemon version information
func (c *Client) Version(ctx context.Context) (types.Version, error) {
	ctx, cancel := c.contextWithTimeout(ctx)
	defer cancel()

	version, err := c.cli.ServerVersion(ctx)
	if err != nil {
		return types.Version{}, fmt.Errorf("failed to get Docker version: %w", err)
	}
	return version, nil
}

// ListVolumes lists all Docker volumes
func (c *Client) ListVolumes(ctx context.Context, filterMap map[string][]string) (volume.ListResponse, error) {
	ctx, cancel := c.contextWithTimeout(ctx)
	defer cancel()

	args := volume.ListOptions{}
	if len(filterMap) > 0 {
		filterArgs := filters.NewArgs()
		for key, values := range filterMap {
			for _, value := range values {
				filterArgs.Add(key, value)
			}
		}
		args.Filters = filterArgs
	}

	volumes, err := c.cli.VolumeList(ctx, args)
	if err != nil {
		return volume.ListResponse{}, fmt.Errorf("failed to list volumes: %w", err)
	}
	return volumes, nil
}

// InspectVolume gets detailed information about a specific volume
func (c *Client) InspectVolume(ctx context.Context, volumeID string) (volume.Volume, error) {
	ctx, cancel := c.contextWithTimeout(ctx)
	defer cancel()

	vol, err := c.cli.VolumeInspect(ctx, volumeID)
	if err != nil {
		return volume.Volume{}, fmt.Errorf("failed to inspect volume %s: %w", volumeID, err)
	}
	return vol, nil
}

// RemoveVolume removes a Docker volume. force=false (the only mode this
// wrapper is ever called with today) leaves Docker's own in-use protection
// intact — the daemon rejects removal of a volume still attached to any
// container, returning a typed conflict error (see errdefs.IsConflict).
func (c *Client) RemoveVolume(ctx context.Context, volumeID string, force bool) error {
	ctx, cancel := c.contextWithTimeout(ctx)
	defer cancel()

	if err := c.cli.VolumeRemove(ctx, volumeID, force); err != nil {
		return fmt.Errorf("failed to remove volume %s: %w", volumeID, err)
	}
	return nil
}

// ListContainers lists all containers with optional filters
func (c *Client) ListContainers(ctx context.Context, filterMap map[string][]string) ([]containertypes.Summary, error) {
	ctx, cancel := c.contextWithTimeout(ctx)
	defer cancel()

	options := containertypes.ListOptions{
		All: true,
	}
	if len(filterMap) > 0 {
		filterArgs := filters.NewArgs()
		for key, values := range filterMap {
			for _, value := range values {
				filterArgs.Add(key, value)
			}
		}
		options.Filters = filterArgs
	}

	containers, err := c.cli.ContainerList(ctx, options)
	if err != nil {
		return nil, fmt.Errorf("failed to list containers: %w", err)
	}
	return containers, nil
}

// InspectContainer gets detailed information about a specific container
func (c *Client) InspectContainer(ctx context.Context, containerID string) (containertypes.InspectResponse, error) {
	ctx, cancel := c.contextWithTimeout(ctx)
	defer cancel()

	container, err := c.cli.ContainerInspect(ctx, containerID)
	if err != nil {
		return containertypes.InspectResponse{}, fmt.Errorf("failed to inspect container %s: %w", containerID, err)
	}
	return container, nil
}

// contextWithTimeout creates a context with the client's configured timeout
func (c *Client) contextWithTimeout(parent context.Context) (context.Context, context.CancelFunc) {
	if c.timeout > 0 {
		return context.WithTimeout(parent, c.timeout)
	}
	return context.WithCancel(parent)
}

// IsConnected checks if the Docker client is properly connected
func (c *Client) IsConnected(ctx context.Context) bool {
	return c.Ping(ctx) == nil
}

// Events streams Docker events with the given options
func (c *Client) Events(ctx context.Context, options events.ListOptions) (<-chan events.Message, <-chan error) {
	return c.cli.Events(ctx, options)
}

// DiskUsage gets Docker disk usage information via the /system/df endpoint
func (c *Client) DiskUsage(ctx context.Context, options types.DiskUsageOptions) (types.DiskUsage, error) {
	ctx, cancel := c.contextWithTimeout(ctx)
	defer cancel()

	usage, err := c.cli.DiskUsage(ctx, options)
	if err != nil {
		return types.DiskUsage{}, fmt.Errorf("failed to get disk usage: %w", err)
	}
	return usage, nil
}
