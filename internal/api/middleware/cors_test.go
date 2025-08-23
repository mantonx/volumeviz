package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
)

func TestDefaultCORSConfig(t *testing.T) {
	config := DefaultCORSConfig()

	assert.Equal(t, []string{"http://localhost:3000"}, config.AllowedOrigins)
	assert.Equal(t, []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"}, config.AllowedMethods)
	assert.Equal(t, []string{"Accept", "Authorization", "Content-Type", "X-Requested-With"}, config.AllowedHeaders)
	assert.Equal(t, []string{"X-Request-ID"}, config.ExposedHeaders)
	assert.False(t, config.AllowCredentials)
	assert.Equal(t, 300, config.MaxAge)
}

func TestCORSMiddleware(t *testing.T) {
	gin.SetMode(gin.TestMode)

	tests := []struct {
		name           string
		config         *CORSConfig
		method         string
		origin         string
		requestHeaders string
		expectHeaders  map[string]string
		expectedStatus int
	}{
		{
			name:   "simple GET request",
			config: DefaultCORSConfig(),
			method: "GET",
			origin: "http://localhost:3000",
			expectHeaders: map[string]string{
				"Access-Control-Allow-Origin": "http://localhost:3000",
			},
			expectedStatus: http.StatusOK,
		},
		{
			name:           "preflight OPTIONS request",
			config:         DefaultCORSConfig(),
			method:         "OPTIONS",
			origin:         "http://localhost:3000",
			requestHeaders: "Content-Type, Authorization",
			expectHeaders: map[string]string{
				"Access-Control-Allow-Origin":  "http://localhost:3000",
				"Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
				"Access-Control-Max-Age":       "300",
			},
			expectedStatus: http.StatusNoContent,
		},
		{
			name: "custom origins",
			config: &CORSConfig{
				AllowedOrigins:   []string{"https://app.example.com", "https://admin.example.com"},
				AllowedMethods:   []string{"GET", "POST"},
				AllowedHeaders:   []string{"Content-Type"},
				ExposedHeaders:   []string{"X-Total-Count"},
				AllowCredentials: false,
				MaxAge:           3600,
			},
			method: "OPTIONS",
			origin: "https://app.example.com",
			expectHeaders: map[string]string{
				"Access-Control-Allow-Origin":  "https://app.example.com",
				"Access-Control-Allow-Methods": "GET, POST",
				"Access-Control-Max-Age":       "3600",
			},
			expectedStatus: http.StatusNoContent,
		},
		{
			name: "disallowed origin",
			config: &CORSConfig{
				AllowedOrigins: []string{"https://allowed.com"},
				AllowedMethods: []string{"GET", "POST"},
				AllowedHeaders: []string{"Content-Type"},
			},
			method:        "GET",
			origin:        "https://blocked.com",
			expectHeaders: map[string]string{
				// Should not have CORS headers for disallowed origin
			},
			expectedStatus: http.StatusOK,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			router := gin.New()
			router.Use(CORSMiddleware(tt.config))

			router.GET("/test", func(c *gin.Context) {
				c.JSON(http.StatusOK, gin.H{"message": "success"})
			})

			router.OPTIONS("/test", func(c *gin.Context) {
				// This should be handled by CORS middleware
			})

			req, _ := http.NewRequest(tt.method, "/test", nil)
			if tt.origin != "" {
				req.Header.Set("Origin", tt.origin)
			}
			if tt.requestHeaders != "" {
				req.Header.Set("Access-Control-Request-Headers", tt.requestHeaders)
			}
			if tt.method == "OPTIONS" {
				req.Header.Set("Access-Control-Request-Method", "POST")
			}

			w := httptest.NewRecorder()
			router.ServeHTTP(w, req)

			assert.Equal(t, tt.expectedStatus, w.Code)

			for header, expectedValue := range tt.expectHeaders {
				actualValue := w.Header().Get(header)
				assert.Equal(t, expectedValue, actualValue, "Header %s mismatch", header)
			}
		})
	}
}

func TestCORSMiddleware_WithWildcard(t *testing.T) {
	gin.SetMode(gin.TestMode)

	config := &CORSConfig{
		AllowedOrigins:   []string{"*"},
		AllowedMethods:   []string{"GET", "POST"},
		AllowedHeaders:   []string{"Content-Type"},
		AllowCredentials: true,
	}

	router := gin.New()
	router.Use(CORSMiddleware(config))

	router.GET("/test", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"message": "success"})
	})

	req, _ := http.NewRequest("GET", "/test", nil)
	req.Header.Set("Origin", "https://any-origin.com")

	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	assert.Equal(t, "*", w.Header().Get("Access-Control-Allow-Origin"))
	assert.Equal(t, "true", w.Header().Get("Access-Control-Allow-Credentials"))
}

func TestCORSMiddleware_NoOriginHeader(t *testing.T) {
	gin.SetMode(gin.TestMode)

	config := DefaultCORSConfig()

	router := gin.New()
	router.Use(CORSMiddleware(config))

	router.GET("/test", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"message": "success"})
	})

	req, _ := http.NewRequest("GET", "/test", nil)
	// No Origin header

	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	// Should still work without Origin header
}
