package mocks

import (
	"context"
	"fmt"

	"github.com/docker/docker/api/types"
	containertypes "github.com/docker/docker/api/types/container"
	"github.com/docker/docker/api/types/volume"
)

// MockDockerClient is a mock implementation of the DockerClient interface
type MockDockerClient struct {
	// Connection
	PingFunc        func(ctx context.Context) error
	CloseFunc       func() error
	IsConnectedFunc func(ctx context.Context) bool

	// Version
	VersionFunc func(ctx context.Context) (types.Version, error)

	// Volumes
	ListVolumesFunc   func(ctx context.Context, filterMap map[string][]string) (volume.ListResponse, error)
	InspectVolumeFunc func(ctx context.Context, volumeID string) (volume.Volume, error)

	// Containers
	ListContainersFunc   func(ctx context.Context, filterMap map[string][]string) ([]containertypes.Summary, error)
	InspectContainerFunc func(ctx context.Context, containerID string) (containertypes.InspectResponse, error)

	// Call counters for assertions
	PingCalls             int
	CloseCalls            int
	IsConnectedCalls      int
	VersionCalls          int
	ListVolumesCalls      int
	InspectVolumeCalls    int
	ListContainersCalls   int
	InspectContainerCalls int
}

// Ping mocks the Ping method
func (m *MockDockerClient) Ping(ctx context.Context) error {
	m.PingCalls++
	if m.PingFunc != nil {
		return m.PingFunc(ctx)
	}
	return nil
}

// Close mocks the Close method
func (m *MockDockerClient) Close() error {
	m.CloseCalls++
	if m.CloseFunc != nil {
		return m.CloseFunc()
	}
	return nil
}

// IsConnected mocks the IsConnected method
func (m *MockDockerClient) IsConnected(ctx context.Context) bool {
	m.IsConnectedCalls++
	if m.IsConnectedFunc != nil {
		return m.IsConnectedFunc(ctx)
	}
	return true
}

// Version mocks the Version method
func (m *MockDockerClient) Version(ctx context.Context) (types.Version, error) {
	m.VersionCalls++
	if m.VersionFunc != nil {
		return m.VersionFunc(ctx)
	}
	return types.Version{
		Version:    "20.10.0",
		APIVersion: "1.41",
		GoVersion:  "go1.16",
		GitCommit:  "mock-commit",
		BuildTime:  "2021-01-01T00:00:00Z",
	}, nil
}

// ListVolumes mocks the ListVolumes method
func (m *MockDockerClient) ListVolumes(ctx context.Context, filterMap map[string][]string) (volume.ListResponse, error) {
	m.ListVolumesCalls++
	if m.ListVolumesFunc != nil {
		return m.ListVolumesFunc(ctx, filterMap)
	}
	return volume.ListResponse{}, nil
}

// InspectVolume mocks the InspectVolume method
func (m *MockDockerClient) InspectVolume(ctx context.Context, volumeID string) (volume.Volume, error) {
	m.InspectVolumeCalls++
	if m.InspectVolumeFunc != nil {
		return m.InspectVolumeFunc(ctx, volumeID)
	}
	return volume.Volume{}, fmt.Errorf("volume not found")
}

// ListContainers mocks the ListContainers method
func (m *MockDockerClient) ListContainers(ctx context.Context, filterMap map[string][]string) ([]containertypes.Summary, error) {
	m.ListContainersCalls++
	if m.ListContainersFunc != nil {
		return m.ListContainersFunc(ctx, filterMap)
	}
	return []containertypes.Summary{}, nil
}

// InspectContainer mocks the InspectContainer method
func (m *MockDockerClient) InspectContainer(ctx context.Context, containerID string) (containertypes.InspectResponse, error) {
	m.InspectContainerCalls++
	if m.InspectContainerFunc != nil {
		return m.InspectContainerFunc(ctx, containerID)
	}
	return containertypes.InspectResponse{}, fmt.Errorf("container not found")
}
