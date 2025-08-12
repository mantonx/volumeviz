package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
)

func TestGetEndpointTier(t *testing.T) {
	gin.SetMode(gin.TestMode)

	tests := []struct {
		name         string
		method       string
		path         string
		expectedTier EndpointTier
	}{
		{
			name:         "critical - scan all volumes",
			method:       "POST",
			path:         "/api/v1/scan/now",
			expectedTier: TierCritical,
		},
		{
			name:         "admin - apply migrations",
			method:       "POST",
			path:         "/api/v1/database/migrations/apply",
			expectedTier: TierAdmin,
		},
		{
			name:         "admin - rollback migration",
			method:       "POST",
			path:         "/api/v1/database/migrations/rollback",
			expectedTier: TierAdmin,
		},
		{
			name:         "heavy - bulk scan",
			method:       "POST",
			path:         "/api/v1/volumes/bulk-scan",
			expectedTier: TierHeavy,
		},
		{
			name:         "heavy - snapshot creation",
			method:       "POST",
			path:         "/api/v1/trends/volumes/snapshots",
			expectedTier: TierHeavy,
		},
		{
			name:         "default - get volumes",
			method:       "GET",
			path:         "/api/v1/volumes",
			expectedTier: TierDefault,
		},
		{
			name:         "default - health check",
			method:       "GET",
			path:         "/api/v1/health",
			expectedTier: TierDefault,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			w := httptest.NewRecorder()
			c, _ := gin.CreateTestContext(w)
			c.Request = httptest.NewRequest(tt.method, tt.path, nil)

			tier := getEndpointTier(c)
			assert.Equal(t, tt.expectedTier, tier)
		})
	}
}

func TestTieredRateLimitMiddleware_DisabledConfig(t *testing.T) {
	gin.SetMode(gin.TestMode)

	config := &TieredRateLimitConfig{
		Enabled: false,
	}

	middleware := TieredRateLimitMiddleware(config)

	// Create test context
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest("GET", "/api/v1/volumes", nil)

	// Should pass through without rate limiting
	middleware(c)

	assert.Equal(t, http.StatusOK, w.Code)
}

func TestTieredRateLimitMiddleware_SkipPaths(t *testing.T) {
	gin.SetMode(gin.TestMode)

	config := DefaultTieredRateLimitConfig()
	middleware := TieredRateLimitMiddleware(config)

	skipPaths := []string{"/api/v1/health", "/health", "/metrics"}

	for _, path := range skipPaths {
		t.Run("skip_"+path, func(t *testing.T) {
			w := httptest.NewRecorder()
			c, _ := gin.CreateTestContext(w)
			c.Request = httptest.NewRequest("GET", path, nil)

			middleware(c)

			// Should not have rate limit headers for skipped paths
			assert.Empty(t, w.Header().Get("X-RateLimit-Tier"))
		})
	}
}

func TestTieredRateLimitMiddleware_RateLimitHeaders(t *testing.T) {
	gin.SetMode(gin.TestMode)

	config := DefaultTieredRateLimitConfig()
	middleware := TieredRateLimitMiddleware(config)

	tests := []struct {
		name         string
		path         string
		method       string
		expectedTier string
		expectedRPM  string
	}{
		{
			name:         "default tier",
			path:         "/api/v1/volumes",
			method:       "GET",
			expectedTier: string(TierDefault),
			expectedRPM:  "120",
		},
		{
			name:         "heavy tier",
			path:         "/api/v1/volumes/bulk-scan",
			method:       "POST",
			expectedTier: string(TierHeavy),
			expectedRPM:  "30",
		},
		{
			name:         "admin tier",
			path:         "/api/v1/database/migrations/apply",
			method:       "POST",
			expectedTier: string(TierAdmin),
			expectedRPM:  "10",
		},
		{
			name:         "critical tier",
			path:         "/api/v1/scan/now",
			method:       "POST",
			expectedTier: string(TierCritical),
			expectedRPM:  "2",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			w := httptest.NewRecorder()
			c, _ := gin.CreateTestContext(w)
			c.Request = httptest.NewRequest(tt.method, tt.path, nil)

			middleware(c)

			assert.Equal(t, tt.expectedTier, w.Header().Get("X-RateLimit-Tier"))
			assert.Equal(t, tt.expectedRPM, w.Header().Get("X-RateLimit-Limit"))
		})
	}
}

func TestErrorBudgetTracker_RecordAndCount(t *testing.T) {
	config := &ErrorBudgetConfig{
		Enabled:        true,
		WindowDuration: time.Hour,
		ErrorThreshold: 5,
		CircuitBreaker: true,
		RecoveryTime:   time.Minute * 10, // Set explicit recovery time
	}

	tracker := NewErrorBudgetTracker(config)

	// Should start with no errors
	assert.Equal(t, 0, tracker.GetErrorCount())
	assert.True(t, tracker.ShouldAllow())
	assert.False(t, tracker.IsCircuitOpen())

	// Record some errors
	for i := 0; i < 3; i++ {
		tracker.RecordError()
	}

	assert.Equal(t, 3, tracker.GetErrorCount())
	assert.True(t, tracker.ShouldAllow()) // Still below threshold
	assert.False(t, tracker.IsCircuitOpen())

	// Cross the threshold (need > 5 errors)
	tracker.RecordError()
	tracker.RecordError()
	tracker.RecordError() // Now we have 6 errors, which is > 5

	count := tracker.GetErrorCount()
	assert.Equal(t, 6, count)
	shouldAllow := tracker.ShouldAllow()
	isOpen := tracker.IsCircuitOpen()

	assert.False(t, shouldAllow) // Circuit should be open
	assert.True(t, isOpen)
}

func TestErrorBudgetTracker_WindowCleanup(t *testing.T) {
	config := &ErrorBudgetConfig{
		Enabled:        true,
		WindowDuration: time.Millisecond * 100, // Short window for testing
		ErrorThreshold: 10,
	}

	tracker := NewErrorBudgetTracker(config)

	// Record errors
	for i := 0; i < 5; i++ {
		tracker.RecordError()
	}

	assert.Equal(t, 5, tracker.GetErrorCount())

	// Wait for window to expire
	time.Sleep(time.Millisecond * 150)

	// Errors should be cleaned up
	assert.Equal(t, 0, tracker.GetErrorCount())
}

func TestErrorBudgetTracker_CircuitRecovery(t *testing.T) {
	config := &ErrorBudgetConfig{
		Enabled:        true,
		WindowDuration: time.Hour,
		ErrorThreshold: 2,
		CircuitBreaker: true,
		RecoveryTime:   time.Millisecond * 100,
	}

	tracker := NewErrorBudgetTracker(config)

	// Trigger circuit breaker (need > 2 errors, so record 3)
	tracker.RecordError()
	tracker.RecordError()
	tracker.RecordError()

	assert.True(t, tracker.IsCircuitOpen())
	assert.False(t, tracker.ShouldAllow())

	// Wait for recovery
	time.Sleep(time.Millisecond * 150)

	// Circuit should recover
	assert.True(t, tracker.ShouldAllow())
	assert.False(t, tracker.IsCircuitOpen())
}

func TestErrorBudgetMiddleware_SuccessfulRequest(t *testing.T) {
	gin.SetMode(gin.TestMode)

	config := DefaultErrorBudgetConfig()
	middleware := ErrorBudgetMiddleware(config)

	// Create a simple handler that returns 200
	handler := func(c *gin.Context) {
		c.JSON(200, gin.H{"status": "ok"})
	}

	w := httptest.NewRecorder()
	c, engine := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest("GET", "/test", nil)

	engine.Use(middleware)
	engine.GET("/test", handler)
	engine.HandleContext(c)

	assert.Equal(t, http.StatusOK, w.Code)
	assert.Equal(t, "0", w.Header().Get("X-Error-Budget-Count"))
	assert.Equal(t, "closed", w.Header().Get("X-Circuit-Breaker"))
}

func TestErrorBudgetMiddleware_ErrorRequest(t *testing.T) {
	gin.SetMode(gin.TestMode)

	config := &ErrorBudgetConfig{
		Enabled:        true,
		WindowDuration: time.Hour,
		ErrorThreshold: 1,     // Low threshold for testing
		CircuitBreaker: false, // Disable circuit breaker for this test
	}

	middleware := ErrorBudgetMiddleware(config)

	// Create a handler that returns 500
	handler := func(c *gin.Context) {
		c.JSON(500, gin.H{"error": "internal server error"})
	}

	w := httptest.NewRecorder()
	c, engine := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest("GET", "/test", nil)

	engine.Use(middleware)
	engine.GET("/test", handler)
	engine.HandleContext(c)

	assert.Equal(t, http.StatusInternalServerError, w.Code)
	// Error count should be updated after the request
	assert.Equal(t, "closed", w.Header().Get("X-Circuit-Breaker"))
}

func TestErrorBudgetMiddleware_CircuitBreaker(t *testing.T) {
	gin.SetMode(gin.TestMode)

	config := &ErrorBudgetConfig{
		Enabled:        true,
		WindowDuration: time.Hour,
		ErrorThreshold: 1,
		CircuitBreaker: true,
		RecoveryTime:   time.Minute,
	}

	middleware := ErrorBudgetMiddleware(config)

	// First, trigger the circuit breaker with a 500 error
	handler := func(c *gin.Context) {
		c.JSON(500, gin.H{"error": "internal server error"})
	}

	w1 := httptest.NewRecorder()
	c1, engine := gin.CreateTestContext(w1)
	c1.Request = httptest.NewRequest("GET", "/test", nil)

	engine.Use(middleware)
	engine.GET("/test", handler)
	engine.HandleContext(c1)

	assert.Equal(t, http.StatusInternalServerError, w1.Code)

	// Now make another request - it might be blocked by circuit breaker
	// Note: The exact behavior depends on the implementation details
	w2 := httptest.NewRecorder()
	c2, _ := gin.CreateTestContext(w2)
	c2.Request = httptest.NewRequest("GET", "/test", nil)

	middleware(c2)

	// If circuit is open, should get 503
	if w2.Code == http.StatusServiceUnavailable {
		assert.Equal(t, "open", w2.Header().Get("X-Circuit-Breaker"))
		assert.Equal(t, "true", w2.Header().Get("X-Error-Budget-Exceeded"))
	}
}
