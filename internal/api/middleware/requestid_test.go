package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
)

func TestRequestIDMiddleware_GeneratesID(t *testing.T) {
	gin.SetMode(gin.TestMode)

	// Create router with middleware
	router := gin.New()
	router.Use(RequestIDMiddleware())

	var capturedRequestID string
	router.GET("/test", func(c *gin.Context) {
		capturedRequestID = GetRequestID(c)
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	// Make request without X-Request-ID header
	req := httptest.NewRequest("GET", "/test", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	// Assert response
	assert.Equal(t, http.StatusOK, w.Code)

	// Assert request ID was generated and is valid UUID
	assert.NotEmpty(t, capturedRequestID)
	_, err := uuid.Parse(capturedRequestID)
	assert.NoError(t, err, "Generated request ID should be a valid UUID")

	// Assert response header contains the request ID
	responseRequestID := w.Header().Get(RequestIDHeader)
	assert.Equal(t, capturedRequestID, responseRequestID)
}

func TestRequestIDMiddleware_UsesProvidedID(t *testing.T) {
	gin.SetMode(gin.TestMode)

	// Create router with middleware
	router := gin.New()
	router.Use(RequestIDMiddleware())

	var capturedRequestID string
	router.GET("/test", func(c *gin.Context) {
		capturedRequestID = GetRequestID(c)
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	// Make request with custom X-Request-ID header
	customRequestID := "custom-request-id-123"
	req := httptest.NewRequest("GET", "/test", nil)
	req.Header.Set(RequestIDHeader, customRequestID)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	// Assert response
	assert.Equal(t, http.StatusOK, w.Code)

	// Assert provided request ID was used
	assert.Equal(t, customRequestID, capturedRequestID)

	// Assert response header contains the provided request ID
	responseRequestID := w.Header().Get(RequestIDHeader)
	assert.Equal(t, customRequestID, responseRequestID)
}

func TestRequestIDMiddleware_EmptyProvidedID(t *testing.T) {
	gin.SetMode(gin.TestMode)

	// Create router with middleware
	router := gin.New()
	router.Use(RequestIDMiddleware())

	var capturedRequestID string
	router.GET("/test", func(c *gin.Context) {
		capturedRequestID = GetRequestID(c)
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	// Make request with empty X-Request-ID header
	req := httptest.NewRequest("GET", "/test", nil)
	req.Header.Set(RequestIDHeader, "")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	// Assert response
	assert.Equal(t, http.StatusOK, w.Code)

	// Assert new request ID was generated (not empty)
	assert.NotEmpty(t, capturedRequestID)

	// Assert it's a valid UUID
	_, err := uuid.Parse(capturedRequestID)
	assert.NoError(t, err)

	// Assert response header contains the generated request ID
	responseRequestID := w.Header().Get(RequestIDHeader)
	assert.Equal(t, capturedRequestID, responseRequestID)
}

func TestGetRequestID_ValidContext(t *testing.T) {
	gin.SetMode(gin.TestMode)

	// Create a gin context
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)

	// Set request ID in context
	expectedRequestID := "test-request-id"
	c.Set(RequestIDKey, expectedRequestID)

	// Get request ID
	actualRequestID := GetRequestID(c)

	assert.Equal(t, expectedRequestID, actualRequestID)
}

func TestGetRequestID_NoContextValue(t *testing.T) {
	gin.SetMode(gin.TestMode)

	// Create a gin context without setting request ID
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)

	// Get request ID (should return empty string)
	actualRequestID := GetRequestID(c)

	assert.Equal(t, "", actualRequestID)
}

func TestGetRequestID_InvalidContextValue(t *testing.T) {
	gin.SetMode(gin.TestMode)

	// Create a gin context
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)

	// Set non-string value in context
	c.Set(RequestIDKey, 123)

	// Get request ID (should return empty string for non-string value)
	actualRequestID := GetRequestID(c)

	assert.Equal(t, "", actualRequestID)
}

func TestConstants(t *testing.T) {
	// Test that constants are properly defined
	assert.Equal(t, "X-Request-ID", RequestIDHeader)
	assert.Equal(t, "requestId", RequestIDKey)
}

func TestRequestIDMiddleware_Integration(t *testing.T) {
	gin.SetMode(gin.TestMode)

	// Create router with middleware
	router := gin.New()
	router.Use(RequestIDMiddleware())

	// Add multiple endpoints to test consistent behavior
	router.GET("/endpoint1", func(c *gin.Context) {
		requestID := GetRequestID(c)
		c.JSON(http.StatusOK, gin.H{"endpoint": "1", "request_id": requestID})
	})

	router.GET("/endpoint2", func(c *gin.Context) {
		requestID := GetRequestID(c)
		c.JSON(http.StatusOK, gin.H{"endpoint": "2", "request_id": requestID})
	})

	// Test first endpoint
	req1 := httptest.NewRequest("GET", "/endpoint1", nil)
	w1 := httptest.NewRecorder()
	router.ServeHTTP(w1, req1)

	requestID1 := w1.Header().Get(RequestIDHeader)
	assert.NotEmpty(t, requestID1)

	// Test second endpoint
	req2 := httptest.NewRequest("GET", "/endpoint2", nil)
	w2 := httptest.NewRecorder()
	router.ServeHTTP(w2, req2)

	requestID2 := w2.Header().Get(RequestIDHeader)
	assert.NotEmpty(t, requestID2)

	// Request IDs should be different for different requests
	assert.NotEqual(t, requestID1, requestID2)
}
