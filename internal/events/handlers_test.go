package events

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/docker/docker/api/types"
	containertypes "github.com/docker/docker/api/types/container"
	"github.com/docker/docker/api/types/events"
	"github.com/docker/docker/api/types/volume"
	"github.com/mantonx/volumeviz/internal/database"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
)

func TestEventHandlerProcessEvent(t *testing.T) {
	mockRepo := &MockRepository{}
	mockDocker := &MockDockerClient{}
	
	handler := NewEventHandlerService(mockDocker, mockRepo, nil)
	
	ctx := context.Background()
	
	tests := []struct {
		name        string
		event       *DockerEvent
		setupMocks  func()
		expectError bool
	}{
		{
			name: "volume created event",
			event: &DockerEvent{
				Type:   VolumeCreated,
				ID:     "vol_123",
				Name:   "test-volume",
				Action: "create",
				Time:   time.Now(),
			},
			setupMocks: func() {
				mockDocker.On("InspectVolume", mock.Anything, "test-volume").Return(volume.Volume{
					Name:       "test-volume",
					Driver:     "local",
					Mountpoint: "/var/lib/docker/volumes/test-volume/_data",
					Scope:      "local",
					Labels:     map[string]string{},
					Options:    map[string]string{},
				}, nil)
				mockRepo.On("UpsertVolume", mock.Anything, mock.AnythingOfType("*database.Volume")).Return(nil)
			},
		},
		{
			name: "volume removed event",
			event: &DockerEvent{
				Type:   VolumeRemoved,
				ID:     "vol_123",
				Name:   "test-volume",
				Action: "remove",
				Time:   time.Now(),
			},
			setupMocks: func() {
				mockRepo.On("DeleteVolume", mock.Anything, "test-volume").Return(nil)
			},
		},
		{
			name: "container started event",
			event: &DockerEvent{
				Type:   ContainerStarted,
				ID:     "container_abc",
				Name:   "test-container",
				Action: "start",
				Time:   time.Now(),
			},
			setupMocks: func() {
				mockDocker.On("ContainerInspect", mock.Anything, "container_abc").Return(types.ContainerJSON{
					ContainerJSONBase: &types.ContainerJSONBase{
						ID:   "container_abc",
						Name: "/test-container",
						State: &types.ContainerState{
							Status:     "running",
							StartedAt:  "2023-01-01T00:00:00Z",
							FinishedAt: "",
						},
					},
					Config: &containertypes.Config{
						Image:  "nginx:latest",
						Labels: map[string]string{},
					},
					Mounts: []types.MountPoint{},
				}, nil)
				mockRepo.On("UpsertContainer", mock.Anything, mock.AnythingOfType("*database.Container")).Return(nil)
				mockRepo.On("DeactivateVolumeMounts", mock.Anything, "container_abc").Return(nil)
			},
		},
		{
			name: "unknown event type",
			event: &DockerEvent{
				Type:   "unknown.event",
				ID:     "test_123",
				Action: "unknown",
				Time:   time.Now(),
			},
			expectError: true,
		},
	}
	
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Reset mocks
			mockRepo.ExpectedCalls = nil
			mockDocker.ExpectedCalls = nil
			
			if tt.setupMocks != nil {
				tt.setupMocks()
			}
			
			err := handler.ProcessEvent(ctx, tt.event)
			
			if tt.expectError {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)
			}
			
			mockRepo.AssertExpectations(t)
			mockDocker.AssertExpectations(t)
		})
	}
}

func TestHandleVolumeCreate(t *testing.T) {
	mockRepo := &MockRepository{}
	mockDocker := &MockDockerClient{}
	
	handler := NewEventHandlerService(mockDocker, mockRepo, nil)
	
	ctx := context.Background()
	event := &DockerEvent{
		Type:   VolumeCreated,
		ID:     "vol_123",
		Name:   "test-volume",
		Action: "create",
		Time:   time.Now(),
	}
	
	volumeResp := volume.Volume{
		Name:       "test-volume",
		Driver:     "local",
		Mountpoint: "/var/lib/docker/volumes/test-volume/_data",
		Scope:      "local",
		Labels: map[string]string{
			"created": "2023-01-01T00:00:00Z",
		},
		Options: map[string]string{},
	}
	
	mockDocker.On("InspectVolume", ctx, "test-volume").Return(volumeResp, nil)
	mockRepo.On("UpsertVolume", ctx, mock.MatchedBy(func(v *database.Volume) bool {
		return v.VolumeID == "test-volume" &&
			v.Name == "test-volume" &&
			v.Driver == "local" &&
			v.Mountpoint == "/var/lib/docker/volumes/test-volume/_data" &&
			v.Scope == "local" &&
			v.Status == "active" &&
			v.IsActive == true
	})).Return(nil)
	
	err := handler.HandleVolumeCreate(ctx, event)
	
	assert.NoError(t, err)
	mockRepo.AssertExpectations(t)
	mockDocker.AssertExpectations(t)
}

func TestHandleVolumeCreateError(t *testing.T) {
	mockRepo := &MockRepository{}
	mockDocker := &MockDockerClient{}
	
	handler := NewEventHandlerService(mockDocker, mockRepo, nil)
	
	ctx := context.Background()
	event := &DockerEvent{
		Type:   VolumeCreated,
		ID:     "vol_123",
		Name:   "test-volume",
		Action: "create",
		Time:   time.Now(),
	}
	
	// Test Docker inspect error
	mockDocker.On("InspectVolume", ctx, "test-volume").Return(volume.Volume{}, errors.New("volume not found"))
	
	err := handler.HandleVolumeCreate(ctx, event)
	
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "failed to inspect volume")
	mockDocker.AssertExpectations(t)
}

func TestHandleVolumeRemove(t *testing.T) {
	mockRepo := &MockRepository{}
	mockDocker := &MockDockerClient{}
	
	handler := NewEventHandlerService(mockDocker, mockRepo, nil)
	
	ctx := context.Background()
	event := &DockerEvent{
		Type:   VolumeRemoved,
		ID:     "vol_123",
		Name:   "test-volume",
		Action: "remove",
		Time:   time.Now(),
	}
	
	mockRepo.On("DeleteVolume", ctx, "test-volume").Return(nil)
	
	err := handler.HandleVolumeRemove(ctx, event)
	
	assert.NoError(t, err)
	mockRepo.AssertExpectations(t)
}

func TestHandleContainerStart(t *testing.T) {
	mockRepo := &MockRepository{}
	mockDocker := &MockDockerClient{}
	
	handler := NewEventHandlerService(mockDocker, mockRepo, nil)
	
	ctx := context.Background()
	event := &DockerEvent{
		Type:   ContainerStarted,
		ID:     "container_abc",
		Name:   "test-container",
		Action: "start",
		Time:   time.Now(),
	}
	
	containerJSON := types.ContainerJSON{
		ContainerJSONBase: &types.ContainerJSONBase{
			ID:   "container_abc",
			Name: "/test-container",
			State: &types.ContainerState{
				Status:     "running",
				StartedAt:  "2023-01-01T00:00:00Z",
				FinishedAt: "",
			},
		},
		Config: &containertypes.Config{
			Image:  "nginx:latest",
			Labels: map[string]string{},
		},
		Mounts: []types.MountPoint{
			{
				Type:        "volume",
				Name:        "test-vol",
				Destination: "/data",
				RW:          true,
			},
		},
	}
	
	mockDocker.On("ContainerInspect", ctx, "container_abc").Return(containerJSON, nil)
	mockRepo.On("UpsertContainer", ctx, mock.MatchedBy(func(c *database.Container) bool {
		return c.ContainerID == "container_abc" &&
			c.Name == "/test-container" &&
			c.Image == "nginx:latest" &&
			c.State == "running" &&
			c.IsActive == true
	})).Return(nil)
	mockRepo.On("DeactivateVolumeMounts", ctx, "container_abc").Return(nil)
	mockRepo.On("UpsertVolumeMount", ctx, mock.MatchedBy(func(m *database.VolumeMount) bool {
		return m.VolumeID == "test-vol" &&
			m.ContainerID == "container_abc" &&
			m.MountPath == "/data" &&
			m.AccessMode == "rw" &&
			m.IsActive == true
	})).Return(nil)
	
	err := handler.HandleContainerStart(ctx, event)
	
	assert.NoError(t, err)
	mockRepo.AssertExpectations(t)
	mockDocker.AssertExpectations(t)
}

func TestHandleContainerDestroy(t *testing.T) {
	mockRepo := &MockRepository{}
	mockDocker := &MockDockerClient{}
	
	handler := NewEventHandlerService(mockDocker, mockRepo, nil)
	
	ctx := context.Background()
	event := &DockerEvent{
		Type:   ContainerDestroyed,
		ID:     "container_abc",
		Name:   "test-container",
		Action: "destroy",
		Time:   time.Now(),
	}
	
	mockRepo.On("DeactivateVolumeMounts", ctx, "container_abc").Return(nil)
	mockRepo.On("DeleteContainer", ctx, "container_abc").Return(nil)
	
	err := handler.HandleContainerDestroy(ctx, event)
	
	assert.NoError(t, err)
	mockRepo.AssertExpectations(t)
}

func TestUpdateVolumeMounts(t *testing.T) {
	mockRepo := &MockRepository{}
	mockDocker := &MockDockerClient{}
	
	handler := NewEventHandlerService(mockDocker, mockRepo, nil)
	
	ctx := context.Background()
	containerID := "container_123"
	eventTime := time.Now()
	
	mounts := []types.MountPoint{
		{
			Type:        "volume",
			Name:        "vol1",
			Destination: "/data1",
			RW:          true,
		},
		{
			Type:        "volume",
			Name:        "vol2", 
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
	
	mockRepo.On("DeactivateVolumeMounts", ctx, containerID).Return(nil)
	
	// Should only process volume mounts, not bind mounts
	mockRepo.On("UpsertVolumeMount", ctx, mock.MatchedBy(func(m *database.VolumeMount) bool {
		return m.VolumeID == "vol1" && m.AccessMode == "rw"
	})).Return(nil)
	
	mockRepo.On("UpsertVolumeMount", ctx, mock.MatchedBy(func(m *database.VolumeMount) bool {
		return m.VolumeID == "vol2" && m.AccessMode == "ro"
	})).Return(nil)
	
	err := handler.updateVolumeMounts(ctx, containerID, mounts, eventTime)
	
	assert.NoError(t, err)
	mockRepo.AssertExpectations(t)
	
	// Verify bind mount was not processed (only 2 UpsertVolumeMount calls expected)
	mockRepo.AssertNumberOfCalls(t, "UpsertVolumeMount", 2)
}

// Mock implementations
type MockRepository struct {
	mock.Mock
}

func (m *MockRepository) UpsertVolume(ctx context.Context, volume *database.Volume) error {
	args := m.Called(ctx, volume)
	return args.Error(0)
}

func (m *MockRepository) DeleteVolume(ctx context.Context, volumeID string) error {
	args := m.Called(ctx, volumeID)
	return args.Error(0)
}

func (m *MockRepository) GetVolumeByName(ctx context.Context, name string) (*database.Volume, error) {
	args := m.Called(ctx, name)
	return args.Get(0).(*database.Volume), args.Error(1)
}

func (m *MockRepository) UpsertContainer(ctx context.Context, container *database.Container) error {
	args := m.Called(ctx, container)
	return args.Error(0)
}

func (m *MockRepository) DeleteContainer(ctx context.Context, containerID string) error {
	args := m.Called(ctx, containerID)
	return args.Error(0)
}

func (m *MockRepository) GetContainerByID(ctx context.Context, containerID string) (*database.Container, error) {
	args := m.Called(ctx, containerID)
	return args.Get(0).(*database.Container), args.Error(1)
}

func (m *MockRepository) UpsertVolumeMount(ctx context.Context, mount *database.VolumeMount) error {
	args := m.Called(ctx, mount)
	return args.Error(0)
}

func (m *MockRepository) DeleteVolumeMount(ctx context.Context, volumeID, containerID string) error {
	args := m.Called(ctx, volumeID, containerID)
	return args.Error(0)
}

func (m *MockRepository) GetVolumeMountsByContainer(ctx context.Context, containerID string) ([]*database.VolumeMount, error) {
	args := m.Called(ctx, containerID)
	return args.Get(0).([]*database.VolumeMount), args.Error(1)
}

func (m *MockRepository) GetVolumeMountsByVolume(ctx context.Context, volumeID string) ([]*database.VolumeMount, error) {
	args := m.Called(ctx, volumeID)
	return args.Get(0).([]*database.VolumeMount), args.Error(1)
}

func (m *MockRepository) DeactivateVolumeMounts(ctx context.Context, containerID string) error {
	args := m.Called(ctx, containerID)
	return args.Error(0)
}

func (m *MockRepository) ListAllVolumes(ctx context.Context) ([]*database.Volume, error) {
	args := m.Called(ctx)
	return args.Get(0).([]*database.Volume), args.Error(1)
}

func (m *MockRepository) ListAllContainers(ctx context.Context) ([]*database.Container, error) {
	args := m.Called(ctx)
	return args.Get(0).([]*database.Container), args.Error(1)
}

func (m *MockRepository) ListAllVolumeMounts(ctx context.Context) ([]*database.VolumeMount, error) {
	args := m.Called(ctx)
	return args.Get(0).([]*database.VolumeMount), args.Error(1)
}

type MockDockerClient struct {
	mock.Mock
}

func (m *MockDockerClient) InspectVolume(ctx context.Context, volumeID string) (volume.Volume, error) {
	args := m.Called(ctx, volumeID)
	return args.Get(0).(volume.Volume), args.Error(1)
}

func (m *MockDockerClient) ContainerInspect(ctx context.Context, containerID string) (types.ContainerJSON, error) {
	args := m.Called(ctx, containerID)
	return args.Get(0).(types.ContainerJSON), args.Error(1)
}

// Implement other interface methods as no-ops for testing
func (m *MockDockerClient) Ping(ctx context.Context) error { return nil }
func (m *MockDockerClient) Close() error { return nil }
func (m *MockDockerClient) IsConnected(ctx context.Context) bool { return true }
func (m *MockDockerClient) Version(ctx context.Context) (types.Version, error) { return types.Version{}, nil }
func (m *MockDockerClient) ListVolumes(ctx context.Context, filterMap map[string][]string) (volume.ListResponse, error) { return volume.ListResponse{}, nil }
func (m *MockDockerClient) ListContainers(ctx context.Context, filterMap map[string][]string) ([]containertypes.Summary, error) { return nil, nil }
func (m *MockDockerClient) InspectContainer(ctx context.Context, containerID string) (containertypes.InspectResponse, error) { return containertypes.InspectResponse{}, nil }
func (m *MockDockerClient) Events(ctx context.Context, options events.ListOptions) (<-chan events.Message, <-chan error) { return nil, nil }