package health

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/docker/docker/api/types"
	"github.com/gin-gonic/gin"
	"github.com/mantonx/volumeviz/internal/mocks"
	"github.com/mantonx/volumeviz/internal/services"
)

func TestHandler_GetDockerHealth(t *testing.T) {
	gin.SetMode(gin.TestMode)

	tests := []struct {
		name           string
		setupMock      func() *mocks.MockDockerClient
		expectedStatus int
		checkResponse  func(t *testing.T, w *httptest.ResponseRecorder)
	}{
		{
			name: "healthy docker daemon",
			setupMock: func() *mocks.MockDockerClient {
				return &mocks.MockDockerClient{
					VersionFunc: func(ctx context.Context) (types.Version, error) {
						return types.Version{
							Version:    "20.10.0",
							APIVersion: "1.41",
							GoVersion:  "go1.16",
							GitCommit:  "abc123",
							BuildTime:  "2021-01-01T00:00:00Z",
						}, nil
					},
					IsConnectedFunc: func(ctx context.Context) bool {
						return true
					},
				}
			},
			expectedStatus: http.StatusOK,
			checkResponse: func(t *testing.T, w *httptest.ResponseRecorder) {
				if !contains(w.Body.String(), `"status":"healthy"`) {
					t.Error("Expected healthy status")
				}
				if !contains(w.Body.String(), `"version":"20.10.0"`) {
					t.Error("Expected version 20.10.0")
				}
			},
		},
		{
			name: "unhealthy docker daemon",
			setupMock: func() *mocks.MockDockerClient {
				return &mocks.MockDockerClient{
					VersionFunc: func(ctx context.Context) (types.Version, error) {
						return types.Version{}, errors.New("connection refused")
					},
					IsConnectedFunc: func(ctx context.Context) bool {
						return false
					},
				}
			},
			expectedStatus: http.StatusServiceUnavailable,
			checkResponse: func(t *testing.T, w *httptest.ResponseRecorder) {
				if !contains(w.Body.String(), `"status":"unhealthy"`) {
					t.Error("Expected unhealthy status")
				}
			},
		},
		{
			name: "docker daemon not available",
			setupMock: func() *mocks.MockDockerClient {
				return &mocks.MockDockerClient{
					VersionFunc: func(ctx context.Context) (types.Version, error) {
						return types.Version{}, nil
					},
					IsConnectedFunc: func(ctx context.Context) bool {
						return false
					},
				}
			},
			expectedStatus: http.StatusServiceUnavailable,
			checkResponse: func(t *testing.T, w *httptest.ResponseRecorder) {
				if !contains(w.Body.String(), `"status":"unhealthy"`) {
					t.Error("Expected unhealthy status")
				}
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockClient := tt.setupMock()
			dockerService := services.NewDockerServiceWithClient(mockClient)
			handler := NewHandler(dockerService, nil, nil, nil)

			w := httptest.NewRecorder()
			c, _ := gin.CreateTestContext(w)
			c.Request = httptest.NewRequest("GET", "/api/v1/health/docker", nil)

			handler.GetDockerHealth(c)

			if w.Code != tt.expectedStatus {
				t.Errorf("Expected status %d, got %d", tt.expectedStatus, w.Code)
			}

			if tt.checkResponse != nil {
				tt.checkResponse(t, w)
			}
		})
	}
}

func TestHandler_GetAppHealth(t *testing.T) {
	gin.SetMode(gin.TestMode)

	tests := []struct {
		name            string
		dockerAvailable bool
		expectedStatus  int
		expectedHealth  string
	}{
		{
			name:            "all services healthy",
			dockerAvailable: true,
			expectedStatus:  http.StatusOK,
			expectedHealth:  "healthy",
		},
		{
			name:            "docker unavailable",
			dockerAvailable: false,
			expectedStatus:  http.StatusPartialContent,
			expectedHealth:  "degraded",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockClient := &mocks.MockDockerClient{
				IsConnectedFunc: func(ctx context.Context) bool {
					return tt.dockerAvailable
				},
			}
			dockerService := services.NewDockerServiceWithClient(mockClient)
			handler := NewHandler(dockerService, nil, nil, nil)

			w := httptest.NewRecorder()
			c, _ := gin.CreateTestContext(w)
			c.Request = httptest.NewRequest("GET", "/api/v1/health", nil)

			handler.GetAppHealth(c)

			if w.Code != tt.expectedStatus {
				t.Errorf("Expected status %d, got %d", tt.expectedStatus, w.Code)
			}

			if !contains(w.Body.String(), `"status":"`+tt.expectedHealth+`"`) {
				t.Errorf("Expected health status %s", tt.expectedHealth)
			}
		})
	}
}

func TestHandler_GetReadiness(t *testing.T) {
	gin.SetMode(gin.TestMode)

	tests := []struct {
		name            string
		dockerAvailable bool
		expectedStatus  int
		expectedReady   bool
	}{
		{
			name:            "ready",
			dockerAvailable: true,
			expectedStatus:  http.StatusOK,
			expectedReady:   true,
		},
		{
			name:            "not ready",
			dockerAvailable: false,
			expectedStatus:  http.StatusServiceUnavailable,
			expectedReady:   false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockClient := &mocks.MockDockerClient{
				IsConnectedFunc: func(ctx context.Context) bool {
					return tt.dockerAvailable
				},
			}
			dockerService := services.NewDockerServiceWithClient(mockClient)
			handler := NewHandler(dockerService, nil, nil, nil)

			w := httptest.NewRecorder()
			c, _ := gin.CreateTestContext(w)
			c.Request = httptest.NewRequest("GET", "/api/v1/health/ready", nil)

			handler.GetReadiness(c)

			if w.Code != tt.expectedStatus {
				t.Errorf("Expected status %d, got %d", tt.expectedStatus, w.Code)
			}

			if tt.expectedReady && !contains(w.Body.String(), `"status":"ready"`) {
				t.Error("Expected ready status")
			}
			if !tt.expectedReady && !contains(w.Body.String(), `"status":"not ready"`) {
				t.Error("Expected not ready status")
			}
		})
	}
}

func TestHandler_GetLiveness(t *testing.T) {
	gin.SetMode(gin.TestMode)

	handler := NewHandler(nil, nil, nil, nil) // Liveness doesn't need Docker service

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest("GET", "/api/v1/health/live", nil)

	handler.GetLiveness(c)

	if w.Code != http.StatusOK {
		t.Errorf("Expected status %d, got %d", http.StatusOK, w.Code)
	}

	if !contains(w.Body.String(), `"status":"alive"`) {
		t.Error("Expected alive status")
	}
}

// Helper function to check if a string contains a substring
func contains(s, substr string) bool {
	return len(s) >= len(substr) && (s == substr || len(s) > 0 && containsSubstring(s, substr))
}

func containsSubstring(s, substr string) bool {
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return true
		}
	}
	return false
}
