package volumes

import (
	"encoding/json"
	"errors"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	apiutils "github.com/mantonx/volumeviz/internal/api/utils"
	"github.com/mantonx/volumeviz/internal/mocks"
	coremodels "github.com/mantonx/volumeviz/internal/models"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
)

// Removed setupTestHandler as it's unused

func TestListVolumes_V1API(t *testing.T) {
	gin.SetMode(gin.TestMode)

	tests := []struct {
		name           string
		query          string
		setupMock      func(*mocks.DockerService)
		expectedStatus int
		checkResponse  func(t *testing.T, body []byte)
	}{
		{
			name:  "default pagination",
			query: "",
			setupMock: func(m *mocks.DockerService) {
				volumes := []coremodels.Volume{
					{
						ID:         "vol1",
						Name:       "test-volume-1",
						Driver:     "local",
						CreatedAt:  time.Now().Add(-24 * time.Hour),
						Mountpoint: "/var/lib/docker/volumes/test-volume-1/_data",
						Scope:      "local",
						Labels:     map[string]string{"env": "test"},
					},
					{
						ID:         "vol2",
						Name:       "test-volume-2", 
						Driver:     "local",
						CreatedAt:  time.Now().Add(-12 * time.Hour),
						Mountpoint: "/var/lib/docker/volumes/test-volume-2/_data",
						Scope:      "local",
					},
				}
				m.On("ListVolumes", mock.Anything).Return(volumes, nil)
				m.On("GetVolumeContainers", mock.Anything, "vol1").Return([]coremodels.VolumeContainer{}, nil)
				m.On("GetVolumeContainers", mock.Anything, "vol2").Return([]coremodels.VolumeContainer{}, nil)
			},
			expectedStatus: 200,
			checkResponse: func(t *testing.T, body []byte) {
				var response apiutils.PagedResponse
				err := json.Unmarshal(body, &response)
				assert.NoError(t, err)
				assert.Equal(t, 1, response.Page)
				assert.Equal(t, 25, response.PageSize)
				assert.Equal(t, int64(2), response.Total)
				// No explicit sort specified, so sort string should be empty
				assert.Equal(t, "", response.Sort)
			},
		},
		{
			name:  "with pagination and sorting",
			query: "page=2&page_size=1&sort=created_at:desc",
			setupMock: func(m *mocks.DockerService) {
				volumes := []coremodels.Volume{
					{
						ID:        "vol1",
						Name:      "test-volume-1",
						Driver:    "local",
						CreatedAt: time.Now().Add(-24 * time.Hour),
					},
					{
						ID:        "vol2",
						Name:      "test-volume-2",
						Driver:    "local", 
						CreatedAt: time.Now().Add(-12 * time.Hour),
					},
				}
				m.On("ListVolumes", mock.Anything).Return(volumes, nil)
				m.On("GetVolumeContainers", mock.Anything, mock.Anything).Return([]coremodels.VolumeContainer{}, nil)
			},
			expectedStatus: 200,
			checkResponse: func(t *testing.T, body []byte) {
				var response apiutils.PagedResponse
				err := json.Unmarshal(body, &response)
				assert.NoError(t, err)
				assert.Equal(t, 2, response.Page)
				assert.Equal(t, 1, response.PageSize)
				assert.Equal(t, int64(2), response.Total)
				assert.Equal(t, "created_at:desc", response.Sort)
			},
		},
		{
			name:  "with driver filter",
			query: "driver=local",
			setupMock: func(m *mocks.DockerService) {
				volumes := []coremodels.Volume{
					{
						ID:     "vol1",
						Name:   "local-volume",
						Driver: "local",
					},
				}
				m.On("ListVolumes", mock.Anything).Return(volumes, nil)
				m.On("GetVolumeContainers", mock.Anything, "vol1").Return([]coremodels.VolumeContainer{}, nil)
			},
			expectedStatus: 200,
			checkResponse: func(t *testing.T, body []byte) {
				var response apiutils.PagedResponse
				err := json.Unmarshal(body, &response)
				assert.NoError(t, err)
				assert.Equal(t, "local", response.Filters["driver"])
			},
		},
		{
			name:  "invalid sort field",
			query: "sort=invalid_field:asc",
			setupMock: func(m *mocks.DockerService) {
				// Mock should not be called due to validation error
			},
			expectedStatus: 400,
			checkResponse: func(t *testing.T, body []byte) {
				// Should contain error about invalid sort field
				assert.Contains(t, string(body), "invalid sort field")
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
			req := httptest.NewRequest("GET", "/?"+tt.query, nil)
			c.Request = req

			handler.ListVolumes(c)

			assert.Equal(t, tt.expectedStatus, w.Code)
			if tt.checkResponse != nil {
				tt.checkResponse(t, w.Body.Bytes())
			}
			mockDocker.AssertExpectations(t)
		})
	}
}

func TestGetVolume_V1API(t *testing.T) {
	gin.SetMode(gin.TestMode)

	tests := []struct {
		name           string
		volumeName     string
		setupMock      func(*mocks.DockerService)
		expectedStatus int
		checkResponse  func(t *testing.T, body []byte)
	}{
		{
			name:       "volume found",
			volumeName: "test-volume",
			setupMock: func(m *mocks.DockerService) {
				volume := &coremodels.Volume{
					ID:         "vol1",
					Name:       "test-volume",
					Driver:     "local",
					CreatedAt:  time.Now(),
					Mountpoint: "/var/lib/docker/volumes/test-volume/_data",
					Scope:      "local",
					Labels:     map[string]string{"env": "test"},
				}
				containers := []coremodels.VolumeContainer{
					{
						ID:         "container1",
						Name:       "test-container",
						MountPath:  "/data",
						AccessMode: "rw",
					},
				}
				m.On("GetVolume", mock.Anything, "test-volume").Return(volume, nil)
				m.On("GetVolumeContainers", mock.Anything, "test-volume").Return(containers, nil)
			},
			expectedStatus: 200,
			checkResponse: func(t *testing.T, body []byte) {
				var response map[string]interface{}
				err := json.Unmarshal(body, &response)
				assert.NoError(t, err)
				assert.Equal(t, "test-volume", response["name"])
				assert.Equal(t, "local", response["driver"])
				attachments := response["attachments"].([]interface{})
				assert.Len(t, attachments, 1)
				attachment := attachments[0].(map[string]interface{})
				assert.Equal(t, "container1", attachment["container_id"])
				assert.Equal(t, "/data", attachment["mount_path"])
				assert.Equal(t, true, attachment["rw"])
			},
		},
		{
			name:       "volume not found",
			volumeName: "nonexistent",
			setupMock: func(m *mocks.DockerService) {
				m.On("GetVolume", mock.Anything, "nonexistent").Return(nil, errors.New("volume not found"))
			},
			expectedStatus: 404,
			checkResponse: func(t *testing.T, body []byte) {
				assert.Contains(t, string(body), "not found")
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
			c.Params = gin.Params{{Key: "name", Value: tt.volumeName}}
			req := httptest.NewRequest("GET", "/", nil)
			c.Request = req

			handler.GetVolume(c)

			assert.Equal(t, tt.expectedStatus, w.Code)
			if tt.checkResponse != nil {
				tt.checkResponse(t, w.Body.Bytes())
			}
			mockDocker.AssertExpectations(t)
		})
	}
}

func TestGetVolumeAttachments_V1API(t *testing.T) {
	gin.SetMode(gin.TestMode)

	tests := []struct {
		name           string
		volumeName     string
		setupMock      func(*mocks.DockerService)
		expectedStatus int
		checkResponse  func(t *testing.T, body []byte)
	}{
		{
			name:       "volume with attachments",
			volumeName: "test-volume",
			setupMock: func(m *mocks.DockerService) {
				volume := &coremodels.Volume{ID: "vol1", Name: "test-volume"}
				containers := []coremodels.VolumeContainer{
					{
						ID:         "container1",
						Name:       "test-container-1",
						MountPath:  "/data",
						AccessMode: "rw",
					},
					{
						ID:         "container2",
						Name:       "test-container-2", 
						MountPath:  "/app",
						AccessMode: "ro",
					},
				}
				m.On("GetVolume", mock.Anything, "test-volume").Return(volume, nil)
				m.On("GetVolumeContainers", mock.Anything, "test-volume").Return(containers, nil)
			},
			expectedStatus: 200,
			checkResponse: func(t *testing.T, body []byte) {
				var response map[string]interface{}
				err := json.Unmarshal(body, &response)
				assert.NoError(t, err)
				assert.Equal(t, float64(2), response["total"])
				data := response["data"].([]interface{})
				assert.Len(t, data, 2)
				
				attachment1 := data[0].(map[string]interface{})
				assert.Equal(t, "container1", attachment1["container_id"])
				assert.Equal(t, "test-container-1", attachment1["container_name"])
				assert.Equal(t, "/data", attachment1["mount_path"])
				assert.Equal(t, true, attachment1["rw"])

				attachment2 := data[1].(map[string]interface{})
				assert.Equal(t, "container2", attachment2["container_id"])
				assert.Equal(t, "/app", attachment2["mount_path"])
				assert.Equal(t, false, attachment2["rw"])
			},
		},
		{
			name:       "volume not found",
			volumeName: "nonexistent",
			setupMock: func(m *mocks.DockerService) {
				m.On("GetVolume", mock.Anything, "nonexistent").Return(nil, errors.New("volume not found"))
			},
			expectedStatus: 404,
			checkResponse: func(t *testing.T, body []byte) {
				assert.Contains(t, string(body), "not found")
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
			c.Params = gin.Params{{Key: "name", Value: tt.volumeName}}
			req := httptest.NewRequest("GET", "/", nil)
			c.Request = req

			handler.GetVolumeAttachments(c)

			assert.Equal(t, tt.expectedStatus, w.Code)
			if tt.checkResponse != nil {
				tt.checkResponse(t, w.Body.Bytes())
			}
			mockDocker.AssertExpectations(t)
		})
	}
}

func TestGetOrphanedVolumes(t *testing.T) {
	gin.SetMode(gin.TestMode)

	tests := []struct {
		name           string
		query          string
		setupMock      func(*mocks.DockerService)
		expectedStatus int
		checkResponse  func(t *testing.T, body []byte)
	}{
		{
			name:  "orphaned volumes found",
			query: "",
			setupMock: func(m *mocks.DockerService) {
				volumes := []coremodels.Volume{
					{
						ID:        "vol1",
						Name:      "orphaned-volume",
						Driver:    "local",
						CreatedAt: time.Now().Add(-24 * time.Hour),
						UsageData: &coremodels.VolumeUsage{Size: 1024 * 1024 * 100}, // 100MB
					},
					{
						ID:        "vol2",
						Name:      "used-volume", 
						Driver:    "local",
						CreatedAt: time.Now().Add(-12 * time.Hour),
					},
				}
				m.On("ListVolumes", mock.Anything).Return(volumes, nil)
				// vol1 has no containers (orphaned)
				m.On("GetVolumeContainers", mock.Anything, "vol1").Return([]coremodels.VolumeContainer{}, nil)
				// vol2 has containers (not orphaned)  
				m.On("GetVolumeContainers", mock.Anything, "vol2").Return([]coremodels.VolumeContainer{{ID: "container1"}}, nil)
			},
			expectedStatus: 200,
			checkResponse: func(t *testing.T, body []byte) {
				var response apiutils.PagedResponse
				err := json.Unmarshal(body, &response)
				assert.NoError(t, err)
				assert.Equal(t, int64(1), response.Total) // Only 1 orphaned volume
				data := response.Data.([]interface{})
				assert.Len(t, data, 1)
				
				orphanedVol := data[0].(map[string]interface{})
				assert.Equal(t, "orphaned-volume", orphanedVol["name"])
				assert.Equal(t, "local", orphanedVol["driver"])
				assert.Equal(t, float64(104857600), orphanedVol["size_bytes"]) // 100MB
			},
		},
		{
			name:  "with system volumes excluded by default",
			query: "",
			setupMock: func(m *mocks.DockerService) {
				volumes := []coremodels.Volume{
					{
						ID:     "vol1",
						Name:   "docker_system_volume", // Should be filtered as system volume
						Driver: "local",
					},
					{
						ID:     "vol2",
						Name:   "user-volume",
						Driver: "local",
					},
				}
				m.On("ListVolumes", mock.Anything).Return(volumes, nil)
				// Only the user volume will be checked since system volume is filtered out first
				m.On("GetVolumeContainers", mock.Anything, "vol2").Return([]coremodels.VolumeContainer{}, nil)
			},
			expectedStatus: 200,
			checkResponse: func(t *testing.T, body []byte) {
				var response apiutils.PagedResponse
				err := json.Unmarshal(body, &response)
				assert.NoError(t, err)
				assert.Equal(t, int64(1), response.Total) // Only user volume, system volume filtered out
				data := response.Data.([]interface{})
				assert.Len(t, data, 1)
				
				orphanedVol := data[0].(map[string]interface{})
				assert.Equal(t, "user-volume", orphanedVol["name"])
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
			req := httptest.NewRequest("GET", "/?"+tt.query, nil)
			c.Request = req

			handler.GetOrphanedVolumes(c)

			assert.Equal(t, tt.expectedStatus, w.Code)
			if tt.checkResponse != nil {
				tt.checkResponse(t, w.Body.Bytes())
			}
			mockDocker.AssertExpectations(t)
		})
	}
}