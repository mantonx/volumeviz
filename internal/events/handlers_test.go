package events

import (
	"context"
	"testing"
	"time"

	"github.com/docker/docker/api/types"
	"github.com/docker/docker/api/types/container"
	containertypes "github.com/docker/docker/api/types/container"
	"github.com/docker/docker/api/types/events"
	"github.com/docker/docker/api/types/volume"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"

	"github.com/mantonx/volumeviz/internal/models"
)

// MockDockerClient for testing
type MockDockerClient struct {
	mock.Mock
}

func (m *MockDockerClient) InspectVolume(ctx context.Context, volumeID string) (volume.Volume, error) {
	args := m.Called(ctx, volumeID)
	return args.Get(0).(volume.Volume), args.Error(1)
}

func (m *MockDockerClient) InspectContainer(ctx context.Context, containerID string) (containertypes.InspectResponse, error) {
	args := m.Called(ctx, containerID)
	return args.Get(0).(containertypes.InspectResponse), args.Error(1)
}

func (m *MockDockerClient) Ping(ctx context.Context) error {
	args := m.Called(ctx)
	return args.Error(0)
}

func (m *MockDockerClient) Close() error {
	args := m.Called()
	return args.Error(0)
}

func (m *MockDockerClient) IsConnected(ctx context.Context) bool {
	args := m.Called(ctx)
	return args.Bool(0)
}

func (m *MockDockerClient) Version(ctx context.Context) (types.Version, error) {
	args := m.Called(ctx)
	return args.Get(0).(types.Version), args.Error(1)
}

func (m *MockDockerClient) ListVolumes(ctx context.Context, filterMap map[string][]string) (volume.ListResponse, error) {
	args := m.Called(ctx, filterMap)
	return args.Get(0).(volume.ListResponse), args.Error(1)
}

func (m *MockDockerClient) ListContainers(ctx context.Context, filterMap map[string][]string) ([]containertypes.Summary, error) {
	args := m.Called(ctx, filterMap)
	return args.Get(0).([]containertypes.Summary), args.Error(1)
}

func (m *MockDockerClient) Events(ctx context.Context, options events.ListOptions) (<-chan events.Message, <-chan error) {
	args := m.Called(ctx, options)
	return args.Get(0).(<-chan events.Message), args.Get(1).(<-chan error)
}

func (m *MockDockerClient) DiskUsage(ctx context.Context, options types.DiskUsageOptions) (types.DiskUsage, error) {
	args := m.Called(ctx, options)
	return args.Get(0).(types.DiskUsage), args.Error(1)
}

// MockRepository for testing
type MockRepository struct {
	mock.Mock
}

func (m *MockRepository) UpsertVolume(ctx context.Context, volume *models.Volume) error {
	args := m.Called(ctx, volume)
	return args.Error(0)
}

func (m *MockRepository) DeleteVolume(ctx context.Context, volumeName string) error {
	args := m.Called(ctx, volumeName)
	return args.Error(0)
}

func (m *MockRepository) GetVolumeByName(ctx context.Context, name string) (*models.Volume, error) {
	args := m.Called(ctx, name)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.Volume), args.Error(1)
}

func (m *MockRepository) UpsertContainer(ctx context.Context, container *models.Container) error {
	args := m.Called(ctx, container)
	return args.Error(0)
}

func (m *MockRepository) DeleteContainer(ctx context.Context, containerID string) error {
	args := m.Called(ctx, containerID)
	return args.Error(0)
}

func (m *MockRepository) GetContainerByID(ctx context.Context, id string) (*models.Container, error) {
	args := m.Called(ctx, id)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.Container), args.Error(1)
}

func (m *MockRepository) UpsertVolumeMount(ctx context.Context, mount *models.VolumeMount) error {
	args := m.Called(ctx, mount)
	return args.Error(0)
}

func (m *MockRepository) DeleteVolumeMount(ctx context.Context, volumeID, containerID string) error {
	args := m.Called(ctx, volumeID, containerID)
	return args.Error(0)
}

func (m *MockRepository) GetVolumeMountsByContainer(ctx context.Context, containerID string) ([]*models.VolumeMount, error) {
	args := m.Called(ctx, containerID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]*models.VolumeMount), args.Error(1)
}

func (m *MockRepository) GetVolumeMountsByVolume(ctx context.Context, volumeID string) ([]*models.VolumeMount, error) {
	args := m.Called(ctx, volumeID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]*models.VolumeMount), args.Error(1)
}

func (m *MockRepository) DeactivateVolumeMounts(ctx context.Context, containerID string) error {
	args := m.Called(ctx, containerID)
	return args.Error(0)
}

func (m *MockRepository) ListAllVolumes(ctx context.Context) ([]*models.Volume, error) {
	args := m.Called(ctx)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]*models.Volume), args.Error(1)
}

func (m *MockRepository) ListAllContainers(ctx context.Context) ([]*models.Container, error) {
	args := m.Called(ctx)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]*models.Container), args.Error(1)
}

func (m *MockRepository) ListAllVolumeMounts(ctx context.Context) ([]*models.VolumeMount, error) {
	args := m.Called(ctx)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]*models.VolumeMount), args.Error(1)
}

func TestNewEventHandlerService(t *testing.T) {
	dockerClient := &MockDockerClient{}
	repository := &MockRepository{}
	promMetrics := &EventMetricsCollector{}

	service := NewEventHandlerService(dockerClient, repository, promMetrics, nil)

	assert.NotNil(t, service)
	assert.Equal(t, dockerClient, service.dockerClient)
	assert.Equal(t, repository, service.repository)
	assert.Equal(t, promMetrics, service.promMetrics)
}

func TestEventHandlerService_ProcessEvent(t *testing.T) {
	dockerClient := &MockDockerClient{}
	repository := &MockRepository{}

	service := NewEventHandlerService(dockerClient, repository, nil, nil)
	ctx := context.Background()

	tests := []struct {
		name        string
		event       *DockerEvent
		expectError bool
	}{
		{
			name: "unknown event type",
			event: &DockerEvent{
				Type:   EventType("unknown"),
				ID:     "unknown-123",
				Action: "unknown",
				Time:   time.Now(),
			},
			expectError: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := service.ProcessEvent(ctx, tt.event)

			if tt.expectError {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)
			}
		})
	}
}

func TestEventHandlerService_HandleVolumeCreate(t *testing.T) {
	dockerClient := &MockDockerClient{}
	repository := &MockRepository{}

	service := NewEventHandlerService(dockerClient, repository, nil, nil)
	ctx := context.Background()

	event := &DockerEvent{
		Type:   VolumeCreated,
		ID:     "vol-123",
		Name:   "test-volume",
		Action: "create",
		Time:   time.Now(),
	}

	vol := volume.Volume{
		Name:       "test-volume",
		Driver:     "local",
		Mountpoint: "/var/lib/docker/volumes/test-volume/_data",
		Labels: map[string]string{
			"created": time.Now().Format(time.RFC3339),
		},
		Options: map[string]string{},
		Scope:   "local",
	}

	dockerClient.On("InspectVolume", ctx, "test-volume").Return(vol, nil)
	repository.On("UpsertVolume", ctx, mock.AnythingOfType("*models.Volume")).Return(nil)

	err := service.HandleVolumeCreate(ctx, event)

	assert.NoError(t, err)
	dockerClient.AssertExpectations(t)
	repository.AssertExpectations(t)
}

func TestEventHandlerService_HandleVolumeRemove(t *testing.T) {
	dockerClient := &MockDockerClient{}
	repository := &MockRepository{}

	service := NewEventHandlerService(dockerClient, repository, nil, nil)
	ctx := context.Background()

	event := &DockerEvent{
		Type:   VolumeRemoved,
		ID:     "vol-123",
		Name:   "test-volume",
		Action: "remove",
		Time:   time.Now(),
	}

	repository.On("DeleteVolume", ctx, "test-volume").Return(nil)

	err := service.HandleVolumeRemove(ctx, event)

	assert.NoError(t, err)
	repository.AssertExpectations(t)
}

func TestEventHandlerService_HandleContainerDestroy(t *testing.T) {
	dockerClient := &MockDockerClient{}
	repository := &MockRepository{}

	service := NewEventHandlerService(dockerClient, repository, nil, nil)
	ctx := context.Background()

	event := &DockerEvent{
		Type:   ContainerDestroyed,
		ID:     "container-123",
		Name:   "test-container",
		Action: "destroy",
		Time:   time.Now(),
	}

	repository.On("DeactivateVolumeMounts", ctx, "container-123").Return(nil)
	repository.On("DeleteContainer", ctx, "container-123").Return(nil)

	err := service.HandleContainerDestroy(ctx, event)

	assert.NoError(t, err)
	repository.AssertExpectations(t)
}

func TestEventHandlerService_ConvertContainerToModel(t *testing.T) {
	service := &EventHandlerService{}

	startedAt := time.Now().Add(-1 * time.Hour)
	finishedAt := time.Now()

	containerJSON := containertypes.InspectResponse{
		ContainerJSONBase: &container.ContainerJSONBase{
			ID:   "container-123",
			Name: "/test-container",
			State: &container.State{
				Status:     "running",
				StartedAt:  startedAt.Format(time.RFC3339Nano),
				FinishedAt: finishedAt.Format(time.RFC3339Nano),
			},
		},
		Config: &container.Config{
			Image: "test-image",
			Labels: map[string]string{
				"env": "test",
			},
		},
	}

	eventTime := time.Now()
	container := service.convertContainerToModel(containerJSON, "running", eventTime)

	assert.Equal(t, "container-123", container.ContainerID)
	assert.Equal(t, "/test-container", container.Name)
	assert.Equal(t, "test-image", container.Image)
	assert.Equal(t, "running", container.State)
	assert.Equal(t, "running", container.Status)
	assert.True(t, container.IsActive)
	assert.Equal(t, startedAt.Unix(), container.CreatedAt.Unix())
	assert.Equal(t, eventTime, container.UpdatedAt)
	assert.NotNil(t, container.StartedAt)
	assert.NotNil(t, container.FinishedAt)
	assert.Equal(t, map[string]string{"env": "test"}, container.Labels)
}

func TestEventHandlerService_UpdateVolumeMounts(t *testing.T) {
	dockerClient := &MockDockerClient{}
	repository := &MockRepository{}

	service := NewEventHandlerService(dockerClient, repository, nil, nil)
	ctx := context.Background()

	mounts := []containertypes.MountPoint{
		{
			Type:        "volume",
			Name:        "test-volume-1",
			Source:      "/var/lib/docker/volumes/test-volume-1/_data",
			Destination: "/data1",
			RW:          true,
		},
		{
			Type:        "volume",
			Name:        "test-volume-2",
			Source:      "/var/lib/docker/volumes/test-volume-2/_data",
			Destination: "/data2",
			RW:          false,
		},
		{
			Type:        "bind",
			Source:      "/host/path",
			Destination: "/container/path",
			RW:          true,
		},
	}

	repository.On("DeactivateVolumeMounts", ctx, "container-123").Return(nil)
	repository.On("UpsertVolumeMount", ctx, mock.MatchedBy(func(mount *models.VolumeMount) bool {
		return mount.VolumeID == "test-volume-1" && mount.AccessMode == "rw"
	})).Return(nil)
	repository.On("UpsertVolumeMount", ctx, mock.MatchedBy(func(mount *models.VolumeMount) bool {
		return mount.VolumeID == "test-volume-2" && mount.AccessMode == "ro"
	})).Return(nil)

	err := service.updateVolumeMounts(ctx, "container-123", mounts, time.Now(), "running")

	assert.NoError(t, err)
	repository.AssertExpectations(t)
}
