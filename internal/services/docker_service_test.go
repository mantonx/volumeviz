package services

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/docker/docker/api/types"
	"github.com/docker/docker/api/types/mount"
	"github.com/docker/docker/api/types/volume"
	"github.com/mantonx/volumeviz/internal/mocks"
	"github.com/mantonx/volumeviz/internal/models"
)

func TestDockerService_Ping(t *testing.T) {
	tests := []struct {
		name    string
		pingErr error
		wantErr bool
	}{
		{
			name:    "successful ping",
			pingErr: nil,
			wantErr: false,
		},
		{
			name:    "ping error",
			pingErr: errors.New("connection refused"),
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockClient := &mocks.MockDockerClient{
				PingFunc: func(ctx context.Context) error {
					return tt.pingErr
				},
			}

			service := NewDockerServiceWithClient(mockClient)
			err := service.Ping(context.Background())

			if (err != nil) != tt.wantErr {
				t.Errorf("Ping() error = %v, wantErr %v", err, tt.wantErr)
			}

			if mockClient.PingCalls != 1 {
				t.Errorf("Ping() called %d times, want 1", mockClient.PingCalls)
			}
		})
	}
}

func TestDockerService_GetVersion(t *testing.T) {
	tests := []struct {
		name        string
		version     types.Version
		versionErr  error
		wantVersion string
		wantErr     bool
	}{
		{
			name: "successful version",
			version: types.Version{
				Version:    "20.10.0",
				APIVersion: "1.41",
			},
			versionErr:  nil,
			wantVersion: "20.10.0",
			wantErr:     false,
		},
		{
			name:        "version error",
			version:     types.Version{},
			versionErr:  errors.New("connection error"),
			wantVersion: "",
			wantErr:     true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockClient := &mocks.MockDockerClient{
				VersionFunc: func(ctx context.Context) (types.Version, error) {
					return tt.version, tt.versionErr
				},
			}

			service := NewDockerServiceWithClient(mockClient)
			version, err := service.GetVersion(context.Background())

			if (err != nil) != tt.wantErr {
				t.Errorf("GetVersion() error = %v, wantErr %v", err, tt.wantErr)
			}

			if version.Version != tt.wantVersion {
				t.Errorf("GetVersion() version = %v, want %v", version.Version, tt.wantVersion)
			}
		})
	}
}

func TestDockerService_ListVolumes(t *testing.T) {
	mockVolumes := []*volume.Volume{
		{
			Name:       "test-volume-1",
			Driver:     "local",
			Mountpoint: "/var/lib/docker/volumes/test-volume-1/_data",
			CreatedAt:  "2021-01-01T00:00:00Z",
			Labels:     map[string]string{"env": "test"},
			Options:    map[string]string{},
			Scope:      "local",
		},
		{
			Name:       "test-volume-2",
			Driver:     "local",
			Mountpoint: "/var/lib/docker/volumes/test-volume-2/_data",
			CreatedAt:  "2021-01-02T00:00:00Z",
			Labels:     map[string]string{},
			Options:    map[string]string{},
			Scope:      "local",
		},
	}

	tests := []struct {
		name      string
		volumes   []*volume.Volume
		listErr   error
		wantCount int
		wantErr   bool
	}{
		{
			name:      "successful list",
			volumes:   mockVolumes,
			listErr:   nil,
			wantCount: 2,
			wantErr:   false,
		},
		{
			name:      "empty list",
			volumes:   []*volume.Volume{},
			listErr:   nil,
			wantCount: 0,
			wantErr:   false,
		},
		{
			name:      "list error",
			volumes:   nil,
			listErr:   errors.New("docker error"),
			wantCount: 0,
			wantErr:   true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockClient := &mocks.MockDockerClient{
				ListVolumesFunc: func(ctx context.Context, filterMap map[string][]string) (volume.ListResponse, error) {
					return volume.ListResponse{
						Volumes: tt.volumes,
					}, tt.listErr
				},
			}

			service := NewDockerServiceWithClient(mockClient)
			volumes, err := service.ListVolumes(context.Background())

			if (err != nil) != tt.wantErr {
				t.Errorf("ListVolumes() error = %v, wantErr %v", err, tt.wantErr)
			}

			if len(volumes) != tt.wantCount {
				t.Errorf("ListVolumes() count = %v, want %v", len(volumes), tt.wantCount)
			}

			// Verify volume conversion
			if tt.wantCount > 0 && !tt.wantErr {
				for i, vol := range volumes {
					if vol.Name != tt.volumes[i].Name {
						t.Errorf("Volume[%d] name = %v, want %v", i, vol.Name, tt.volumes[i].Name)
					}
					if vol.Driver != tt.volumes[i].Driver {
						t.Errorf("Volume[%d] driver = %v, want %v", i, vol.Driver, tt.volumes[i].Driver)
					}
				}
			}
		})
	}
}

func TestDockerService_GetVolume(t *testing.T) {
	mockVolume := volume.Volume{
		Name:       "test-volume",
		Driver:     "local",
		Mountpoint: "/var/lib/docker/volumes/test-volume/_data",
		CreatedAt:  "2021-01-01T00:00:00Z",
		Labels:     map[string]string{"env": "test"},
		Options:    map[string]string{},
		Scope:      "local",
		UsageData: &volume.UsageData{
			RefCount: 2,
			Size:     1024,
		},
	}

	tests := []struct {
		name       string
		volumeID   string
		volume     volume.Volume
		inspectErr error
		wantErr    bool
		wantName   string
	}{
		{
			name:       "successful get",
			volumeID:   "test-volume",
			volume:     mockVolume,
			inspectErr: nil,
			wantErr:    false,
			wantName:   "test-volume",
		},
		{
			name:       "volume not found",
			volumeID:   "non-existent",
			volume:     volume.Volume{},
			inspectErr: errors.New("no such volume"),
			wantErr:    true,
			wantName:   "",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockClient := &mocks.MockDockerClient{
				InspectVolumeFunc: func(ctx context.Context, volumeID string) (volume.Volume, error) {
					if volumeID != tt.volumeID {
						t.Errorf("InspectVolume() volumeID = %v, want %v", volumeID, tt.volumeID)
					}
					return tt.volume, tt.inspectErr
				},
			}

			service := NewDockerServiceWithClient(mockClient)
			vol, err := service.GetVolume(context.Background(), tt.volumeID)

			if (err != nil) != tt.wantErr {
				t.Errorf("GetVolume() error = %v, wantErr %v", err, tt.wantErr)
			}

			if !tt.wantErr && vol != nil {
				if vol.Name != tt.wantName {
					t.Errorf("GetVolume() name = %v, want %v", vol.Name, tt.wantName)
				}
				if vol.UsageData != nil && tt.volume.UsageData != nil {
					if vol.UsageData.RefCount != tt.volume.UsageData.RefCount {
						t.Errorf("GetVolume() RefCount = %v, want %v", vol.UsageData.RefCount, tt.volume.UsageData.RefCount)
					}
				}
			}
		})
	}
}

func TestDockerService_GetVolumeContainers(t *testing.T) {
	volumeName := "test-volume"

	mockContainers := []types.Container{
		{
			ID:     "container1",
			Names:  []string{"/test-container-1"},
			State:  "running",
			Status: "Up 2 hours",
		},
		{
			ID:     "container2",
			Names:  []string{"/test-container-2"},
			State:  "exited",
			Status: "Exited (0) 1 hour ago",
		},
	}

	mockContainerJSON1 := types.ContainerJSON{
		ContainerJSONBase: &types.ContainerJSONBase{
			ID:   "container1",
			Name: "/test-container-1",
		},
		Mounts: []types.MountPoint{
			{
				Type:        mount.TypeVolume,
				Name:        volumeName,
				Destination: "/data",
				RW:          true,
			},
		},
	}

	mockContainerJSON2 := types.ContainerJSON{
		ContainerJSONBase: &types.ContainerJSONBase{
			ID:   "container2",
			Name: "/test-container-2",
		},
		Mounts: []types.MountPoint{
			{
				Type:        mount.TypeVolume,
				Name:        volumeName,
				Destination: "/backup",
				RW:          false,
			},
		},
	}

	tests := []struct {
		name           string
		volumeName     string
		containers     []types.Container
		containerJSONs map[string]types.ContainerJSON
		listErr        error
		wantCount      int
		wantErr        bool
	}{
		{
			name:       "successful get containers",
			volumeName: volumeName,
			containers: mockContainers,
			containerJSONs: map[string]types.ContainerJSON{
				"container1": mockContainerJSON1,
				"container2": mockContainerJSON2,
			},
			listErr:   nil,
			wantCount: 2,
			wantErr:   false,
		},
		{
			name:           "no containers using volume",
			volumeName:     "unused-volume",
			containers:     mockContainers,
			containerJSONs: map[string]types.ContainerJSON{},
			listErr:        nil,
			wantCount:      0,
			wantErr:        false,
		},
		{
			name:           "list containers error",
			volumeName:     volumeName,
			containers:     nil,
			containerJSONs: nil,
			listErr:        errors.New("docker error"),
			wantCount:      0,
			wantErr:        true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockClient := &mocks.MockDockerClient{
				ListContainersFunc: func(ctx context.Context, filterMap map[string][]string) ([]types.Container, error) {
					return tt.containers, tt.listErr
				},
				InspectContainerFunc: func(ctx context.Context, containerID string) (types.ContainerJSON, error) {
					if json, ok := tt.containerJSONs[containerID]; ok {
						return json, nil
					}
					return types.ContainerJSON{}, errors.New("container not found")
				},
			}

			service := NewDockerServiceWithClient(mockClient)
			containers, err := service.GetVolumeContainers(context.Background(), tt.volumeName)

			if (err != nil) != tt.wantErr {
				t.Errorf("GetVolumeContainers() error = %v, wantErr %v", err, tt.wantErr)
			}

			if len(containers) != tt.wantCount {
				t.Errorf("GetVolumeContainers() count = %v, want %v", len(containers), tt.wantCount)
			}

			// Verify container details
			if tt.wantCount > 0 && !tt.wantErr {
				for i, container := range containers {
					if container.ID == "" {
						t.Errorf("Container[%d] has empty ID", i)
					}
					if container.MountPath == "" {
						t.Errorf("Container[%d] has empty MountPath", i)
					}
					if container.AccessMode != "rw" && container.AccessMode != "ro" {
						t.Errorf("Container[%d] has invalid AccessMode: %v", i, container.AccessMode)
					}
				}
			}
		})
	}
}

func TestDockerService_IsDockerAvailable(t *testing.T) {
	tests := []struct {
		name        string
		isConnected bool
		want        bool
	}{
		{
			name:        "docker available",
			isConnected: true,
			want:        true,
		},
		{
			name:        "docker not available",
			isConnected: false,
			want:        false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockClient := &mocks.MockDockerClient{
				IsConnectedFunc: func(ctx context.Context) bool {
					return tt.isConnected
				},
			}

			service := NewDockerServiceWithClient(mockClient)
			got := service.IsDockerAvailable(context.Background())

			if got != tt.want {
				t.Errorf("IsDockerAvailable() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestDockerService_GetVolumesByDriver(t *testing.T) {
	localVolumes := []*volume.Volume{
		{
			Name:   "local-volume-1",
			Driver: "local",
		},
		{
			Name:   "local-volume-2",
			Driver: "local",
		},
	}

	tests := []struct {
		name        string
		driver      string
		volumes     []*volume.Volume
		listErr     error
		wantCount   int
		wantErr     bool
		checkFilter bool
	}{
		{
			name:        "filter by local driver",
			driver:      "local",
			volumes:     localVolumes,
			listErr:     nil,
			wantCount:   2,
			wantErr:     false,
			checkFilter: true,
		},
		{
			name:        "filter error",
			driver:      "nfs",
			volumes:     nil,
			listErr:     errors.New("filter error"),
			wantCount:   0,
			wantErr:     true,
			checkFilter: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockClient := &mocks.MockDockerClient{
				ListVolumesFunc: func(ctx context.Context, filterMap map[string][]string) (volume.ListResponse, error) {
					if tt.checkFilter {
						if drivers, ok := filterMap["driver"]; ok {
							if len(drivers) != 1 || drivers[0] != tt.driver {
								t.Errorf("ListVolumes() filter driver = %v, want [%v]", drivers, tt.driver)
							}
						} else {
							t.Error("ListVolumes() missing driver filter")
						}
					}
					return volume.ListResponse{
						Volumes: tt.volumes,
					}, tt.listErr
				},
			}

			service := NewDockerServiceWithClient(mockClient)
			volumes, err := service.GetVolumesByDriver(context.Background(), tt.driver)

			if (err != nil) != tt.wantErr {
				t.Errorf("GetVolumesByDriver() error = %v, wantErr %v", err, tt.wantErr)
			}

			if len(volumes) != tt.wantCount {
				t.Errorf("GetVolumesByDriver() count = %v, want %v", len(volumes), tt.wantCount)
			}
		})
	}
}

func TestDockerService_convertToVolumeModel(t *testing.T) {
	tests := []struct {
		name     string
		input    volume.Volume
		expected models.Volume
	}{
		{
			name: "full volume conversion",
			input: volume.Volume{
				Name:       "test-volume",
				Driver:     "local",
				Mountpoint: "/var/lib/docker/volumes/test-volume/_data",
				CreatedAt:  "2021-01-01T12:00:00Z",
				Labels:     map[string]string{"env": "test"},
				Options:    map[string]string{"type": "none"},
				Scope:      "local",
				Status: map[string]interface{}{
					"key1": "value1",
					"key2": 42,
				},
				UsageData: &volume.UsageData{
					RefCount: 3,
					Size:     2048,
				},
			},
			expected: models.Volume{
				ID:         "test-volume",
				Name:       "test-volume",
				Driver:     "local",
				Mountpoint: "/var/lib/docker/volumes/test-volume/_data",
				Labels:     map[string]string{"env": "test"},
				Options:    map[string]string{"type": "none"},
				Scope:      "local",
				Status: map[string]string{
					"key1": "value1",
					"key2": "42",
				},
				UsageData: &models.VolumeUsage{
					RefCount: 3,
					Size:     2048,
				},
			},
		},
		{
			name: "volume without usage data",
			input: volume.Volume{
				Name:       "simple-volume",
				Driver:     "local",
				Mountpoint: "/var/lib/docker/volumes/simple-volume/_data",
				CreatedAt:  "2021-01-01T12:00:00Z",
			},
			expected: models.Volume{
				ID:         "simple-volume",
				Name:       "simple-volume",
				Driver:     "local",
				Mountpoint: "/var/lib/docker/volumes/simple-volume/_data",
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			service := &DockerService{}
			result := service.convertToVolumeModel(tt.input)

			if result.ID != tt.expected.ID {
				t.Errorf("convertToVolumeModel() ID = %v, want %v", result.ID, tt.expected.ID)
			}
			if result.Name != tt.expected.Name {
				t.Errorf("convertToVolumeModel() Name = %v, want %v", result.Name, tt.expected.Name)
			}
			if result.Driver != tt.expected.Driver {
				t.Errorf("convertToVolumeModel() Driver = %v, want %v", result.Driver, tt.expected.Driver)
			}

			// Check status conversion
			if tt.input.Status != nil {
				if len(result.Status) != len(tt.expected.Status) {
					t.Errorf("convertToVolumeModel() Status length = %v, want %v", len(result.Status), len(tt.expected.Status))
				}
				for k, v := range tt.expected.Status {
					if result.Status[k] != v {
						t.Errorf("convertToVolumeModel() Status[%s] = %v, want %v", k, result.Status[k], v)
					}
				}
			}

			// Check usage data conversion
			if tt.input.UsageData != nil {
				if result.UsageData == nil {
					t.Error("convertToVolumeModel() UsageData is nil, want non-nil")
				} else {
					if result.UsageData.RefCount != tt.expected.UsageData.RefCount {
						t.Errorf("convertToVolumeModel() RefCount = %v, want %v", result.UsageData.RefCount, tt.expected.UsageData.RefCount)
					}
					if result.UsageData.Size != tt.expected.UsageData.Size {
						t.Errorf("convertToVolumeModel() Size = %v, want %v", result.UsageData.Size, tt.expected.UsageData.Size)
					}
				}
			}
		})
	}
}
func TestDockerService_NewDockerService(t *testing.T) {
	tests := []struct {
		name        string
		host        string
		timeout     time.Duration
		expectError bool
	}{
		{
			name:        "valid_unix_socket",
			host:        "unix:///var/run/docker.sock",
			timeout:     30 * time.Second,
			expectError: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			service, err := NewDockerService(tt.host, tt.timeout)

			if tt.expectError && err == nil {
				t.Error("NewDockerService() expected error but got none")
			}
			if service != nil {
				service.Close()
			}
		})
	}
}

func TestDockerService_Close(t *testing.T) {
	mockClient := &mocks.MockDockerClient{
		CloseFunc: func() error {
			return nil
		},
	}
	service := NewDockerServiceWithClient(mockClient)

	err := service.Close()
	if err != nil {
		t.Errorf("Close() error = %v, want nil", err)
	}

	if mockClient.CloseCalls != 1 {
		t.Errorf("Close() called %d times, want 1", mockClient.CloseCalls)
	}
}

func TestDockerService_GetVolumesByLabel(t *testing.T) {
	tests := []struct {
		name        string
		labelKey    string
		labelValue  string
		volumes     volume.ListResponse
		expectError bool
		errorMsg    string
	}{
		{
			name:       "filter_by_environment_label",
			labelKey:   "env",
			labelValue: "production",
			volumes: volume.ListResponse{
				Volumes: []*volume.Volume{
					{
						Name:   "prod-volume-1",
						Driver: "local",
						Labels: map[string]string{"env": "production"},
					},
				},
			},
			expectError: false,
		},
		{
			name:        "filter_error",
			labelKey:    "env",
			labelValue:  "production",
			expectError: true,
			errorMsg:    "failed to list volumes",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockClient := &mocks.MockDockerClient{}
			service := NewDockerServiceWithClient(mockClient)

			if tt.expectError {
				mockClient.ListVolumesFunc = func(ctx context.Context, filterMap map[string][]string) (volume.ListResponse, error) {
					return volume.ListResponse{}, errors.New(tt.errorMsg)
				}
			} else {
				mockClient.ListVolumesFunc = func(ctx context.Context, filterMap map[string][]string) (volume.ListResponse, error) {
					return tt.volumes, nil
				}
			}

			volumes, err := service.GetVolumesByLabel(context.Background(), tt.labelKey, tt.labelValue)

			if tt.expectError {
				if err == nil {
					t.Error("GetVolumesByLabel() expected error but got none")
				}
			} else {
				if err != nil {
					t.Errorf("GetVolumesByLabel() error = %v, want nil", err)
				}
				if len(volumes) != len(tt.volumes.Volumes) {
					t.Errorf("GetVolumesByLabel() returned %d volumes, want %d", len(volumes), len(tt.volumes.Volumes))
				}
			}
		})
	}
}
