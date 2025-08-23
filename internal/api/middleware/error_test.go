package middleware

import (
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
)

func TestErrorHandler(t *testing.T) {
	gin.SetMode(gin.TestMode)

	tests := []struct {
		name           string
		panicValue     any
		expectedStatus int
		expectedCode   string
	}{
		{
			name:           "string panic",
			panicValue:     "test panic string",
			expectedStatus: http.StatusInternalServerError,
			expectedCode:   "INTERNAL_ERROR",
		},
		{
			name:           "error panic",
			panicValue:     errors.New("test error"),
			expectedStatus: http.StatusInternalServerError,
			expectedCode:   "INTERNAL_ERROR",
		},
		{
			name:           "docker error",
			panicValue:     errors.New("docker daemon error: connection refused"),
			expectedStatus: http.StatusServiceUnavailable,
			expectedCode:   "DOCKER_ERROR",
		},
		{
			name:           "permission error",
			panicValue:     errors.New("permission denied to access resource"),
			expectedStatus: http.StatusForbidden,
			expectedCode:   "PERMISSION_ERROR",
		},
		{
			name:           "network error",
			panicValue:     errors.New("network timeout occurred"),
			expectedStatus: http.StatusBadGateway,
			expectedCode:   "NETWORK_ERROR",
		},
		{
			name:           "unknown panic type",
			panicValue:     123,
			expectedStatus: http.StatusInternalServerError,
			expectedCode:   "INTERNAL_ERROR",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			router := gin.New()
			router.Use(ErrorHandler())

			router.GET("/test", func(c *gin.Context) {
				panic(tt.panicValue)
			})

			req, _ := http.NewRequest("GET", "/test", nil)
			w := httptest.NewRecorder()
			router.ServeHTTP(w, req)

			assert.Equal(t, tt.expectedStatus, w.Code)
			assert.Contains(t, w.Body.String(), tt.expectedCode)
		})
	}
}

func TestDockerErrorHandler(t *testing.T) {
	gin.SetMode(gin.TestMode)

	router := gin.New()
	router.Use(DockerErrorHandler())

	router.GET("/test", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"message": "success"})
	})

	req, _ := http.NewRequest("GET", "/test", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
}

func TestIsDockerError(t *testing.T) {
	tests := []struct {
		name     string
		err      error
		expected bool
	}{
		{
			name:     "docker daemon error",
			err:      errors.New("Error response from daemon: connection refused"),
			expected: true,
		},
		{
			name:     "docker API error",
			err:      errors.New("docker API error occurred"),
			expected: true,
		},
		{
			name:     "regular error",
			err:      errors.New("regular error message"),
			expected: false,
		},
		{
			name:     "nil error",
			err:      nil,
			expected: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := isDockerError(tt.err)
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestIsPermissionError(t *testing.T) {
	tests := []struct {
		name     string
		err      error
		expected bool
	}{
		{
			name:     "permission denied error",
			err:      errors.New("permission denied to access resource"),
			expected: true,
		},
		{
			name:     "access denied error",
			err:      errors.New("access denied"),
			expected: true,
		},
		{
			name:     "unauthorized error",
			err:      errors.New("unauthorized access"),
			expected: true,
		},
		{
			name:     "regular error",
			err:      errors.New("regular error message"),
			expected: false,
		},
		{
			name:     "nil error",
			err:      nil,
			expected: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := isPermissionError(tt.err)
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestIsNetworkError(t *testing.T) {
	tests := []struct {
		name     string
		err      error
		expected bool
	}{
		{
			name:     "network timeout error",
			err:      errors.New("network timeout occurred"),
			expected: true,
		},
		{
			name:     "connection refused error",
			err:      errors.New("connection refused"),
			expected: true,
		},
		{
			name:     "connection reset error",
			err:      errors.New("connection reset by peer"),
			expected: true,
		},
		{
			name:     "regular error",
			err:      errors.New("regular error message"),
			expected: false,
		},
		{
			name:     "nil error",
			err:      nil,
			expected: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := isNetworkError(tt.err)
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestIsDockerDaemonError(t *testing.T) {
	tests := []struct {
		name     string
		err      error
		expected bool
	}{
		{
			name:     "docker daemon error",
			err:      errors.New("Error response from daemon: something went wrong"),
			expected: true,
		},
		{
			name:     "regular error",
			err:      errors.New("regular error message"),
			expected: false,
		},
		{
			name:     "nil error",
			err:      nil,
			expected: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := isDockerDaemonError(tt.err)
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestIsDockerPermissionError(t *testing.T) {
	tests := []struct {
		name     string
		err      error
		expected bool
	}{
		{
			name:     "docker permission error",
			err:      errors.New("Got permission denied while trying to connect to the Docker daemon"),
			expected: true,
		},
		{
			name:     "regular error",
			err:      errors.New("regular error message"),
			expected: false,
		},
		{
			name:     "nil error",
			err:      nil,
			expected: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := isDockerPermissionError(tt.err)
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestIsDockerNetworkError(t *testing.T) {
	tests := []struct {
		name     string
		err      error
		expected bool
	}{
		{
			name:     "docker network error",
			err:      errors.New("Error response from daemon: network error"),
			expected: true,
		},
		{
			name:     "regular error",
			err:      errors.New("regular error message"),
			expected: false,
		},
		{
			name:     "nil error",
			err:      nil,
			expected: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := isDockerNetworkError(tt.err)
			assert.Equal(t, tt.expected, result)
		})
	}
}
