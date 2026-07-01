package volumes

import (
	"encoding/json"
	"errors"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/mantonx/volumeviz/internal/api/models"
	"github.com/mantonx/volumeviz/internal/mocks"
	coremodels "github.com/mantonx/volumeviz/internal/models"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
)

// Test GetVolumeStats endpoint (missing from current tests)
func TestGetVolumeStats(t *testing.T) {
	gin.SetMode(gin.TestMode)

	tests := []struct {
		name           string
		volumeID       string
		setupMock      func(*mocks.DockerService)
		expectedStatus int
		checkResponse  func(t *testing.T, body []byte)
	}{
		{
			name:     "successful stats retrieval",
			volumeID: "test-volume",
			setupMock: func(m *mocks.DockerService) {
				volume := &coremodels.Volume{
					ID:         1,
				VolumeID:   "test-volume",
					Name:       "test-volume",
					Driver:     "local",
					Mountpoint: "/var/lib/docker/volumes/test-volume/_data",
					CreatedAt:  time.Now().Add(-24 * time.Hour),
					UsageData: &coremodels.VolumeUsage{
						RefCount: 2,
						Size:     1024 * 1024 * 500, // 500MB
					},
				}
				containers := []coremodels.VolumeContainer{
					{ID: 1, ContainerID: "container1", VolumeID: "test-volume", Name: "web-server"},
					{ID: 2, ContainerID: "container2", VolumeID: "test-volume", Name: "database"},
				}
				m.On("GetVolume", mock.Anything, "test-volume").Return(volume, nil)
				m.On("GetVolumeContainers", mock.Anything, "test-volume").Return(containers, nil)
			},
			expectedStatus: 200,
			checkResponse: func(t *testing.T, body []byte) {
				var stats map[string]interface{}
				err := json.Unmarshal(body, &stats)
				assert.NoError(t, err)

				assert.Equal(t, "test-volume", stats["volume_id"])
				assert.Equal(t, "test-volume", stats["volume_name"])
				assert.Equal(t, "local", stats["driver"])
				assert.Equal(t, "/var/lib/docker/volumes/test-volume/_data", stats["mountpoint"])
				assert.Equal(t, float64(2), stats["container_count"])

				// Check usage data
				usage := stats["usage"].(map[string]interface{})
				assert.Equal(t, float64(2), usage["ref_count"])
				assert.Equal(t, float64(524288000), usage["size"]) // 500MB

				// Check containers array
				containers := stats["containers"].([]interface{})
				assert.Len(t, containers, 2)
			},
		},
		{
			name:     "volume without usage data",
			volumeID: "simple-volume",
			setupMock: func(m *mocks.DockerService) {
				volume := &coremodels.Volume{
					ID:         1,
					VolumeID:   "simple-volume",
					Name:       "simple-volume",
					Driver:     "local",
					Mountpoint: "/var/lib/docker/volumes/simple-volume/_data",
					CreatedAt:  time.Now().Add(-12 * time.Hour),
					UsageData:  nil, // No usage data
				}
				m.On("GetVolume", mock.Anything, "simple-volume").Return(volume, nil)
				m.On("GetVolumeContainers", mock.Anything, "simple-volume").Return([]coremodels.VolumeContainer{}, nil)
			},
			expectedStatus: 200,
			checkResponse: func(t *testing.T, body []byte) {
				var stats map[string]interface{}
				err := json.Unmarshal(body, &stats)
				assert.NoError(t, err)

				assert.Equal(t, "simple-volume", stats["volume_id"])
				assert.Equal(t, float64(0), stats["container_count"])

				// Should not have usage field when no usage data
				_, hasUsage := stats["usage"]
				assert.False(t, hasUsage)
			},
		},
		{
			name:     "container lookup failure doesn't fail request",
			volumeID: "test-volume",
			setupMock: func(m *mocks.DockerService) {
				volume := &coremodels.Volume{
					ID:         1,
				VolumeID:   "test-volume",
					Name:       "test-volume",
					Driver:     "local",
					Mountpoint: "/var/lib/docker/volumes/test-volume/_data",
					CreatedAt:  time.Now(),
				}
				m.On("GetVolume", mock.Anything, "test-volume").Return(volume, nil)
				m.On("GetVolumeContainers", mock.Anything, "test-volume").Return([]coremodels.VolumeContainer{}, errors.New("container service unavailable"))
			},
			expectedStatus: 200,
			checkResponse: func(t *testing.T, body []byte) {
				var stats map[string]interface{}
				err := json.Unmarshal(body, &stats)
				assert.NoError(t, err)

				assert.Equal(t, "test-volume", stats["volume_id"])
				assert.Equal(t, float64(0), stats["container_count"]) // Should default to 0

				containers := stats["containers"].([]interface{})
				assert.Len(t, containers, 0) // Should be empty array
			},
		},
		{
			name:     "missing volume ID",
			volumeID: "",
			setupMock: func(m *mocks.DockerService) {
				// No mock calls expected
			},
			expectedStatus: 400,
			checkResponse: func(t *testing.T, body []byte) {
				var errorResp models.ErrorResponse
				err := json.Unmarshal(body, &errorResp)
				assert.NoError(t, err)
				assert.Equal(t, "Volume ID is required", errorResp.Error)
				assert.Equal(t, "MISSING_VOLUME_ID", errorResp.Code)
			},
		},
		{
			name:     "volume not found",
			volumeID: "nonexistent",
			setupMock: func(m *mocks.DockerService) {
				m.On("GetVolume", mock.Anything, "nonexistent").Return(nil, errors.New("volume not found"))
			},
			expectedStatus: 404,
			checkResponse: func(t *testing.T, body []byte) {
				var errorResp models.ErrorResponse
				err := json.Unmarshal(body, &errorResp)
				assert.NoError(t, err)
				assert.Equal(t, "Volume not found", errorResp.Error)
				assert.Equal(t, "VOLUME_NOT_FOUND", errorResp.Code)
			},
		},
		{
			name:     "docker service error",
			volumeID: "test-volume",
			setupMock: func(m *mocks.DockerService) {
				m.On("GetVolume", mock.Anything, "test-volume").Return(nil, errors.New("docker daemon error"))
			},
			expectedStatus: 500,
			checkResponse: func(t *testing.T, body []byte) {
				var errorResp models.ErrorResponse
				err := json.Unmarshal(body, &errorResp)
				assert.NoError(t, err)
				assert.Equal(t, "Failed to get volume stats", errorResp.Error)
				assert.Equal(t, "VOLUME_STATS_ERROR", errorResp.Code)
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockDocker := &mocks.DockerService{}
			handler := NewHandler(mockDocker, nil, nil)
			tt.setupMock(mockDocker)

			w := httptest.NewRecorder()
			c, _ := gin.CreateTestContext(w)
			c.Params = gin.Params{{Key: "name", Value: tt.volumeID}}
			req := httptest.NewRequest("GET", "/", nil)
			c.Request = req

			handler.GetVolumeStats(c)

			assert.Equal(t, tt.expectedStatus, w.Code)
			if tt.checkResponse != nil {
				tt.checkResponse(t, w.Body.Bytes())
			}
			mockDocker.AssertExpectations(t)
		})
	}
}

// Test utility functions that are missing tests
func TestIsNotFoundError(t *testing.T) {
	tests := []struct {
		name     string
		err      error
		expected bool
	}{
		{
			name:     "nil error",
			err:      nil,
			expected: false,
		},
		{
			name:     "not found error",
			err:      errors.New("volume not found"),
			expected: true,
		},
		{
			name:     "no such error",
			err:      errors.New("no such volume"),
			expected: true,
		},
		{
			name:     "doesn't exist error",
			err:      errors.New("volume doesn't exist"),
			expected: true,
		},
		{
			name:     "case insensitive - NOT FOUND",
			err:      errors.New("Volume NOT FOUND"),
			expected: true,
		},
		{
			name:     "case insensitive - No Such",
			err:      errors.New("No Such Volume"),
			expected: true,
		},
		{
			name:     "generic error",
			err:      errors.New("connection failed"),
			expected: false,
		},
		{
			name:     "docker daemon error",
			err:      errors.New("docker daemon is not running"),
			expected: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := isNotFoundError(tt.err)
			assert.Equal(t, tt.expected, result)
		})
	}
}

// Test isSystemVolume function
func TestIsSystemVolume(t *testing.T) {
	handler := NewHandler(nil, nil, nil)

	// Debug the regex pattern
	t.Logf("Regex pattern: %s", handler.systemVolumeRegex.String())

	tests := []struct {
		name     string
		volume   coremodels.Volume
		expected bool
	}{
		{
			name: "docker system volume",
			volume: coremodels.Volume{
				Name:   "docker_system_volume",
				Driver: "local",
			},
			expected: true,
		},
		{
			name: "builder volume",
			volume: coremodels.Volume{
				Name:   "builder_cache",
				Driver: "local",
			},
			expected: true,
		},
		{
			name: "containerd volume",
			volume: coremodels.Volume{
				Name:   "containerd-data",
				Driver: "local",
			},
			expected: true,
		},
		{
			name: "volume ending with _data",
			volume: coremodels.Volume{
				Name:   "_data",
				Driver: "local",
			},
			expected: true,
		},
		{
			name: "user volume",
			volume: coremodels.Volume{
				Name:   "my-app-data",
				Driver: "local",
			},
			expected: false,
		},
		{
			name: "user volume with docker in name",
			volume: coremodels.Volume{
				Name:   "my-docker-app", // Contains docker but doesn't start with docker_
				Driver: "local",
			},
			expected: false,
		},
		{
			name: "empty name",
			volume: coremodels.Volume{
				Name:   "",
				Driver: "local",
			},
			expected: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := handler.isSystemVolume(tt.volume)
			assert.Equal(t, tt.expected, result)
		})
	}
}

// Test filterUserVolumes function
func TestFilterUserVolumes(t *testing.T) {
	volumes := []coremodels.Volume{
		{
			ID:       1,
			VolumeID: "vol1",
			Name:     "user-data",
			Options: map[string]string{
				"device": "/home/user/data",
				"type":   "bind",
			},
		},
		{
			ID:       2,
			VolumeID: "vol2",
			Name:     "system-vol",
			Options: map[string]string{
				"device": "/var/lib/docker/volumes/system-vol",
			},
		},
		{
			ID:       3,
			VolumeID: "vol3",
			Name:     "cifs-mount",
			Options: map[string]string{
				"device": "/cifs/fileserver/media",
				"type":   "cifs",
			},
		},
		{
			ID:       4,
			VolumeID: "vol4",
			Name:     "regular-volume",
			Options: map[string]string{},
		},
		{
			ID:       5,
			VolumeID: "vol5",
			Name:     "named-volume-with-external-device",
			Options: map[string]string{
				"device": "/mnt/external-drive",
			},
		},
	}

	userVolumes := filterUserVolumes(volumes)

	// Based on the actual isUserVolume logic:
	// vol1: has device="/home/user/data" (user path) -> user volume
	// vol2: has device="/var/lib/docker/..." (docker internal) -> not user volume
	// vol3: has device="/cifs/fileserver/media" (user path) -> user volume
	// vol4: no device option, named "regular-volume" (not infrastructure, not anonymous) -> user volume
	// vol5: has device="/mnt/external-drive" (user path) -> user volume
	assert.Len(t, userVolumes, 4) // vol1, vol3, vol4, vol5

	names := make([]string, len(userVolumes))
	for i, vol := range userVolumes {
		names[i] = vol.Name
	}

	assert.Contains(t, names, "user-data")
	assert.Contains(t, names, "cifs-mount")
	assert.Contains(t, names, "regular-volume") // Named volume, not infrastructure
	assert.Contains(t, names, "named-volume-with-external-device")
	assert.NotContains(t, names, "system-vol") // Docker internal path
}

// Test isUserVolume function
func TestIsUserVolume(t *testing.T) {
	tests := []struct {
		name     string
		volume   coremodels.Volume
		expected bool
	}{
		{
			name: "user home directory mount",
			volume: coremodels.Volume{
				Options: map[string]string{
					"device": "/home/user/documents",
				},
			},
			expected: true,
		},
		{
			name: "cifs network mount",
			volume: coremodels.Volume{
				Options: map[string]string{
					"device": "/cifs/server/share",
				},
			},
			expected: true,
		},
		{
			name: "external mount point",
			volume: coremodels.Volume{
				Options: map[string]string{
					"device": "/mnt/storage",
				},
			},
			expected: true,
		},
		{
			name: "docker internal volume",
			volume: coremodels.Volume{
				Options: map[string]string{
					"device": "/var/lib/docker/volumes/test/_data",
				},
			},
			expected: false,
		},
		{
			name: "volume without device option",
			volume: coremodels.Volume{
				Options: map[string]string{
					"type": "tmpfs",
				},
			},
			expected: false,
		},
		{
			name: "empty options",
			volume: coremodels.Volume{
				Options: map[string]string{},
			},
			expected: false,
		},
		{
			name: "nil options",
			volume: coremodels.Volume{
				Options: nil,
			},
			expected: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := isUserVolume(tt.volume)
			assert.Equal(t, tt.expected, result)
		})
	}
}

// Test containsIgnoreCase helper function
func TestContainsIgnoreCase(t *testing.T) {
	tests := []struct {
		name     string
		str      string
		substr   string
		expected bool
	}{
		{
			name:     "exact match",
			str:      "not found",
			substr:   "not found",
			expected: true,
		},
		{
			name:     "case insensitive match",
			str:      "Volume NOT FOUND",
			substr:   "not found",
			expected: true,
		},
		{
			name:     "substring match",
			str:      "error: volume not found in registry",
			substr:   "not found",
			expected: true,
		},
		{
			name:     "no match",
			str:      "connection timeout",
			substr:   "not found",
			expected: false,
		},
		{
			name:     "empty substring",
			str:      "any string",
			substr:   "",
			expected: true,
		},
		{
			name:     "empty string",
			str:      "",
			substr:   "not found",
			expected: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := containsIgnoreCase(tt.str, tt.substr)
			assert.Equal(t, tt.expected, result)
		})
	}
}

// Test NewHandler constructor with various configurations
func TestNewHandler_Construction(t *testing.T) {
	tests := []struct {
		name    string
		setupFn func() *Handler
		checkFn func(t *testing.T, h *Handler)
	}{
		{
			name: "all dependencies provided",
			setupFn: func() *Handler {
				mockDocker := &mocks.DockerService{}
				return NewHandler(mockDocker, nil, nil)
			},
			checkFn: func(t *testing.T, h *Handler) {
				assert.NotNil(t, h.dockerService)
				assert.NotNil(t, h.systemVolumeRegex)
			},
		},
		{
			name: "nil dependencies",
			setupFn: func() *Handler {
				return NewHandler(nil, nil, nil)
			},
			checkFn: func(t *testing.T, h *Handler) {
				assert.Nil(t, h.dockerService)
				assert.Nil(t, h.store)
				assert.Nil(t, h.realtimePublisher)
				assert.NotNil(t, h.systemVolumeRegex) // Should still have regex
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			handler := tt.setupFn()
			tt.checkFn(t, handler)
		})
	}
}
