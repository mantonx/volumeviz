package volumes

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/docker/docker/api/types"
	"github.com/gin-gonic/gin"
	"github.com/mantonx/volumeviz/internal/models"
)

func TestHandler_ListVolumes(t *testing.T) {
	gin.SetMode(gin.TestMode)

	mockVolumes := []models.Volume{
		{
			ID:         "vol1",
			Name:       "vol1",
			Driver:     "local",
			Mountpoint: "/var/lib/docker/volumes/vol1/_data",
			CreatedAt:  time.Now(),
			Labels:     map[string]string{"env": "test"},
		},
		{
			ID:         "vol2",
			Name:       "vol2",
			Driver:     "nfs",
			Mountpoint: "/mnt/nfs/vol2",
			CreatedAt:  time.Now(),
		},
	}

	tests := []struct {
		name           string
		queryParams    map[string]string
		setupMock      func() *mockDockerService
		expectedStatus int
		expectedCount  int
	}{
		{
			name:        "list all volumes",
			queryParams: map[string]string{},
			setupMock: func() *mockDockerService {
				return &mockDockerService{
					listVolumes: func(ctx context.Context) ([]models.Volume, error) {
						return mockVolumes, nil
					},
				}
			},
			expectedStatus: http.StatusOK,
			expectedCount:  2,
		},
		{
			name:        "filter by driver",
			queryParams: map[string]string{"driver": "local"},
			setupMock: func() *mockDockerService {
				return &mockDockerService{
					getVolumesByDriver: func(ctx context.Context, driver string) ([]models.Volume, error) {
						if driver == "local" {
							return []models.Volume{mockVolumes[0]}, nil
						}
						return []models.Volume{}, nil
					},
				}
			},
			expectedStatus: http.StatusOK,
			expectedCount:  1,
		},
		{
			name:        "filter by label",
			queryParams: map[string]string{"label_key": "env", "label_value": "test"},
			setupMock: func() *mockDockerService {
				return &mockDockerService{
					getVolumesByLabel: func(ctx context.Context, key, value string) ([]models.Volume, error) {
						if key == "env" && value == "test" {
							return []models.Volume{mockVolumes[0]}, nil
						}
						return []models.Volume{}, nil
					},
				}
			},
			expectedStatus: http.StatusOK,
			expectedCount:  1,
		},
		{
			name:        "list volumes error",
			queryParams: map[string]string{},
			setupMock: func() *mockDockerService {
				return &mockDockerService{
					listVolumes: func(ctx context.Context) ([]models.Volume, error) {
						return nil, errors.New("docker error")
					},
				}
			},
			expectedStatus: http.StatusInternalServerError,
			expectedCount:  0,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockService := tt.setupMock()
			handler := &Handler{dockerService: mockService}

			w := httptest.NewRecorder()
			c, _ := gin.CreateTestContext(w)

			// Build request with query parameters
			req := httptest.NewRequest("GET", "/api/v1/volumes", nil)
			q := req.URL.Query()
			for k, v := range tt.queryParams {
				q.Add(k, v)
			}
			req.URL.RawQuery = q.Encode()
			c.Request = req

			handler.ListVolumes(c)

			if w.Code != tt.expectedStatus {
				t.Errorf("Expected status %d, got %d", tt.expectedStatus, w.Code)
			}

			if tt.expectedStatus == http.StatusOK {
				body := w.Body.String()
				if !contains(body, `"total":`+string(rune(tt.expectedCount+'0'))) {
					t.Errorf("Expected %d volumes in response", tt.expectedCount)
				}
			}
		})
	}
}

func TestHandler_GetVolume(t *testing.T) {
	gin.SetMode(gin.TestMode)

	mockVolume := &models.Volume{
		ID:         "test-vol",
		Name:       "test-vol",
		Driver:     "local",
		Mountpoint: "/var/lib/docker/volumes/test-vol/_data",
		CreatedAt:  time.Now(),
	}

	tests := []struct {
		name           string
		volumeID       string
		setupMock      func() *mockDockerService
		expectedStatus int
	}{
		{
			name:     "get existing volume",
			volumeID: "test-vol",
			setupMock: func() *mockDockerService {
				return &mockDockerService{
					getVolume: func(ctx context.Context, volumeID string) (*models.Volume, error) {
						if volumeID == "test-vol" {
							return mockVolume, nil
						}
						return nil, errors.New("not found")
					},
				}
			},
			expectedStatus: http.StatusOK,
		},
		{
			name:     "volume not found",
			volumeID: "non-existent",
			setupMock: func() *mockDockerService {
				return &mockDockerService{
					getVolume: func(ctx context.Context, volumeID string) (*models.Volume, error) {
						return nil, errors.New("volume not found")
					},
				}
			},
			expectedStatus: http.StatusNotFound,
		},
		{
			name:     "empty volume ID",
			volumeID: "",
			setupMock: func() *mockDockerService {
				return &mockDockerService{}
			},
			expectedStatus: http.StatusBadRequest,
		},
		{
			name:     "docker error",
			volumeID: "test-vol",
			setupMock: func() *mockDockerService {
				return &mockDockerService{
					getVolume: func(ctx context.Context, volumeID string) (*models.Volume, error) {
						return nil, errors.New("docker daemon error")
					},
				}
			},
			expectedStatus: http.StatusInternalServerError,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockService := tt.setupMock()
			handler := &Handler{dockerService: mockService}

			w := httptest.NewRecorder()
			c, _ := gin.CreateTestContext(w)
			c.Request = httptest.NewRequest("GET", "/api/v1/volumes/"+tt.volumeID, nil)
			c.Params = gin.Params{{Key: "id", Value: tt.volumeID}}

			handler.GetVolume(c)

			if w.Code != tt.expectedStatus {
				t.Errorf("Expected status %d, got %d", tt.expectedStatus, w.Code)
			}

			if tt.expectedStatus == http.StatusOK {
				body := w.Body.String()
				if !contains(body, `"name":"test-vol"`) {
					t.Error("Expected volume name in response")
				}
			}
		})
	}
}

func TestHandler_GetVolumeContainers(t *testing.T) {
	gin.SetMode(gin.TestMode)

	mockVolume := &models.Volume{
		ID:   "test-vol",
		Name: "test-vol",
	}

	mockContainers := []models.VolumeContainer{
		{
			ID:         "container1",
			Name:       "/test-container-1",
			State:      "running",
			Status:     "Up 2 hours",
			MountPath:  "/data",
			MountType:  "volume",
			AccessMode: "rw",
		},
		{
			ID:         "container2",
			Name:       "/test-container-2",
			State:      "exited",
			Status:     "Exited (0) 1 hour ago",
			MountPath:  "/backup",
			MountType:  "volume",
			AccessMode: "ro",
		},
	}

	tests := []struct {
		name           string
		volumeID       string
		setupMock      func() *mockDockerService
		expectedStatus int
		expectedCount  int
	}{
		{
			name:     "get containers for existing volume",
			volumeID: "test-vol",
			setupMock: func() *mockDockerService {
				return &mockDockerService{
					getVolume: func(ctx context.Context, volumeID string) (*models.Volume, error) {
						if volumeID == "test-vol" {
							return mockVolume, nil
						}
						return nil, errors.New("not found")
					},
					getVolumeContainers: func(ctx context.Context, volumeName string) ([]models.VolumeContainer, error) {
						if volumeName == "test-vol" {
							return mockContainers, nil
						}
						return []models.VolumeContainer{}, nil
					},
				}
			},
			expectedStatus: http.StatusOK,
			expectedCount:  2,
		},
		{
			name:     "volume not found",
			volumeID: "non-existent",
			setupMock: func() *mockDockerService {
				return &mockDockerService{
					getVolume: func(ctx context.Context, volumeID string) (*models.Volume, error) {
						return nil, errors.New("no such volume")
					},
				}
			},
			expectedStatus: http.StatusNotFound,
			expectedCount:  0,
		},
		{
			name:     "empty volume ID",
			volumeID: "",
			setupMock: func() *mockDockerService {
				return &mockDockerService{}
			},
			expectedStatus: http.StatusBadRequest,
			expectedCount:  0,
		},
		{
			name:     "error getting containers",
			volumeID: "test-vol",
			setupMock: func() *mockDockerService {
				return &mockDockerService{
					getVolume: func(ctx context.Context, volumeID string) (*models.Volume, error) {
						return mockVolume, nil
					},
					getVolumeContainers: func(ctx context.Context, volumeName string) ([]models.VolumeContainer, error) {
						return nil, errors.New("docker error")
					},
				}
			},
			expectedStatus: http.StatusInternalServerError,
			expectedCount:  0,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockService := tt.setupMock()
			handler := &Handler{dockerService: mockService}

			w := httptest.NewRecorder()
			c, _ := gin.CreateTestContext(w)
			c.Request = httptest.NewRequest("GET", "/api/v1/volumes/"+tt.volumeID+"/containers", nil)
			c.Params = gin.Params{{Key: "id", Value: tt.volumeID}}

			handler.GetVolumeContainers(c)

			if w.Code != tt.expectedStatus {
				t.Errorf("Expected status %d, got %d", tt.expectedStatus, w.Code)
			}

			if tt.expectedStatus == http.StatusOK {
				body := w.Body.String()
				if !contains(body, `"containers"`) {
					t.Error("Expected containers in response")
				}
			}
		})
	}
}

// Mock Docker service for testing
type mockDockerService struct {
	ping                func(ctx context.Context) error
	getVersion          func(ctx context.Context) (types.Version, error)
	listVolumes         func(ctx context.Context) ([]models.Volume, error)
	getVolume           func(ctx context.Context, volumeID string) (*models.Volume, error)
	getVolumeContainers func(ctx context.Context, volumeName string) ([]models.VolumeContainer, error)
	isDockerAvailable   func(ctx context.Context) bool
	getVolumesByDriver  func(ctx context.Context, driver string) ([]models.Volume, error)
	getVolumesByLabel   func(ctx context.Context, labelKey, labelValue string) ([]models.Volume, error)
}

func (m *mockDockerService) Ping(ctx context.Context) error {
	if m.ping != nil {
		return m.ping(ctx)
	}
	return nil
}

func (m *mockDockerService) GetVersion(ctx context.Context) (types.Version, error) {
	if m.getVersion != nil {
		return m.getVersion(ctx)
	}
	return types.Version{}, nil
}

func (m *mockDockerService) ListVolumes(ctx context.Context) ([]models.Volume, error) {
	if m.listVolumes != nil {
		return m.listVolumes(ctx)
	}
	return []models.Volume{}, nil
}

func (m *mockDockerService) GetVolume(ctx context.Context, volumeID string) (*models.Volume, error) {
	if m.getVolume != nil {
		return m.getVolume(ctx, volumeID)
	}
	return nil, errors.New("not implemented")
}

func (m *mockDockerService) GetVolumeContainers(ctx context.Context, volumeName string) ([]models.VolumeContainer, error) {
	if m.getVolumeContainers != nil {
		return m.getVolumeContainers(ctx, volumeName)
	}
	return []models.VolumeContainer{}, nil
}

func (m *mockDockerService) IsDockerAvailable(ctx context.Context) bool {
	if m.isDockerAvailable != nil {
		return m.isDockerAvailable(ctx)
	}
	return true
}

func (m *mockDockerService) GetVolumesByDriver(ctx context.Context, driver string) ([]models.Volume, error) {
	if m.getVolumesByDriver != nil {
		return m.getVolumesByDriver(ctx, driver)
	}
	return []models.Volume{}, nil
}

func (m *mockDockerService) GetVolumesByLabel(ctx context.Context, labelKey, labelValue string) ([]models.Volume, error) {
	if m.getVolumesByLabel != nil {
		return m.getVolumesByLabel(ctx, labelKey, labelValue)
	}
	return []models.Volume{}, nil
}

func (m *mockDockerService) Close() error {
	return nil
}

// Helper function to check if a string contains a substring
func contains(s, substr string) bool {
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return true
		}
	}
	return false
}