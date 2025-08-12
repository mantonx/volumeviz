package system

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/docker/docker/api/types"
	"github.com/gin-gonic/gin"
	"github.com/mantonx/volumeviz/internal/mocks"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
)

func setupTestRouter() (*gin.Engine, *mocks.DockerService) {
	gin.SetMode(gin.TestMode)
	router := gin.New()

	dockerService := new(mocks.DockerService)
	handler := NewHandler(dockerService)

	api := router.Group("/api/v1")
	{
		api.GET("/system/info", handler.GetSystemInfo)
		api.GET("/system/version", handler.GetVersion)
	}

	return router, dockerService
}

func TestNewHandler(t *testing.T) {
	dockerService := new(mocks.DockerService)
	handler := NewHandler(dockerService)

	assert.NotNil(t, handler)
	assert.Equal(t, dockerService, handler.dockerService)
}

func TestGetSystemInfo_DockerAvailable(t *testing.T) {
	router, dockerService := setupTestRouter()

	// Mock Docker service to return available with version info
	dockerService.On("IsDockerAvailable", mock.Anything).Return(true)
	dockerService.On("GetVersion", mock.Anything).Return(types.Version{
		Version:    "24.0.6",
		APIVersion: "1.43",
	}, nil)

	req := httptest.NewRequest("GET", "/api/v1/system/info", nil)
	w := httptest.NewRecorder()

	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	assert.Contains(t, w.Body.String(), `"service":"volumeviz"`)
	assert.Contains(t, w.Body.String(), `"version":"1.0.0"`)
	assert.Contains(t, w.Body.String(), `"available":true`)
	assert.Contains(t, w.Body.String(), `"version":"24.0.6"`)
	assert.Contains(t, w.Body.String(), `"api_version":"1.43"`)

	dockerService.AssertExpectations(t)
}

func TestGetSystemInfo_DockerNotAvailable(t *testing.T) {
	router, dockerService := setupTestRouter()

	// Mock Docker service to return not available
	dockerService.On("IsDockerAvailable", mock.Anything).Return(false)
	dockerService.On("GetVersion", mock.Anything).Return(types.Version{}, assert.AnError)

	req := httptest.NewRequest("GET", "/api/v1/system/info", nil)
	w := httptest.NewRecorder()

	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	assert.Contains(t, w.Body.String(), `"service":"volumeviz"`)
	assert.Contains(t, w.Body.String(), `"version":"1.0.0"`)
	assert.Contains(t, w.Body.String(), `"available":false`)
	// Should not contain Docker version info
	assert.NotContains(t, w.Body.String(), `"version":"24.0.6"`)

	dockerService.AssertExpectations(t)
}

func TestGetVersion(t *testing.T) {
	router, _ := setupTestRouter()

	req := httptest.NewRequest("GET", "/api/v1/system/version", nil)
	w := httptest.NewRecorder()

	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	assert.Contains(t, w.Body.String(), `"api_version":"v1"`)
	assert.Contains(t, w.Body.String(), `"service":"volumeviz"`)
	assert.Contains(t, w.Body.String(), `"version":"1.0.0"`)
	assert.Contains(t, w.Body.String(), `"endpoints"`)
	assert.Contains(t, w.Body.String(), `"health":"/api/v1/health"`)
	assert.Contains(t, w.Body.String(), `"volumes":"/api/v1/volumes"`)
	assert.Contains(t, w.Body.String(), `"system":"/api/v1/system"`)
}

func TestGetSystemInfo_DockerVersionError(t *testing.T) {
	router, dockerService := setupTestRouter()

	// Mock Docker service as available but version call fails
	dockerService.On("IsDockerAvailable", mock.Anything).Return(true)
	dockerService.On("GetVersion", mock.Anything).Return(types.Version{}, assert.AnError)

	req := httptest.NewRequest("GET", "/api/v1/system/info", nil)
	w := httptest.NewRecorder()

	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	assert.Contains(t, w.Body.String(), `"service":"volumeviz"`)
	// Should show Docker as available but without version details due to error
	assert.Contains(t, w.Body.String(), `"available":true`)
	// Should not contain version details due to GetVersion error
	assert.NotContains(t, w.Body.String(), `"version":"24.0.6"`)

	dockerService.AssertExpectations(t)
}

func TestHandler_ContextHandling(t *testing.T) {
	router, dockerService := setupTestRouter()

	// Verify that the handler passes context properly
	var capturedContext context.Context
	dockerService.On("IsDockerAvailable", mock.MatchedBy(func(ctx context.Context) bool {
		capturedContext = ctx
		return true
	})).Return(false)
	dockerService.On("GetVersion", mock.Anything).Return(types.Version{}, assert.AnError)

	req := httptest.NewRequest("GET", "/api/v1/system/info", nil)
	w := httptest.NewRecorder()

	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	assert.NotNil(t, capturedContext)

	dockerService.AssertExpectations(t)
}
