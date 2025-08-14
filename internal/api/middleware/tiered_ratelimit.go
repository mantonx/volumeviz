package middleware

import (
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/mantonx/volumeviz/internal/api/utils"
)

// TieredRateLimitConfig defines rate limits for different endpoint tiers
type TieredRateLimitConfig struct {
	Enabled   bool                      // Whether tiered rate limiting is enabled
	KeyFunc   func(*gin.Context) string // Function to generate rate limit key
	SkipPaths []string                  // Paths to skip (e.g., health checks)

	// Default tier (most endpoints)
	DefaultRPM   int // Requests per minute
	DefaultBurst int // Burst capacity

	// Heavy operations tier (scanning, bulk operations)
	HeavyRPM   int // Requests per minute
	HeavyBurst int // Burst capacity

	// Admin tier (migration, system operations)
	AdminRPM   int // Requests per minute
	AdminBurst int // Burst capacity

	// Critical tier (bulk scan all, major operations)
	CriticalRPM   int // Requests per minute
	CriticalBurst int // Burst capacity
}

// DefaultTieredRateLimitConfig returns default tiered rate limiting configuration
func DefaultTieredRateLimitConfig() *TieredRateLimitConfig {
	return &TieredRateLimitConfig{
		Enabled:   true,
		KeyFunc:   DefaultKeyFunc,
		SkipPaths: []string{"/api/v1/health", "/health", "/metrics"},

		// Standard endpoints: 120 RPM, 60 burst
		DefaultRPM:   120,
		DefaultBurst: 60,

		// Heavy operations: 30 RPM, 10 burst (scans, refreshes)
		HeavyRPM:   30,
		HeavyBurst: 10,

		// Admin operations: 10 RPM, 5 burst (migrations)
		AdminRPM:   10,
		AdminBurst: 5,

		// Critical operations: 2 RPM, 1 burst (bulk scan all)
		CriticalRPM:   2,
		CriticalBurst: 1,
	}
}

// EndpointTier represents the rate limit tier for an endpoint
type EndpointTier string

const (
	TierDefault  EndpointTier = "default"
	TierHeavy    EndpointTier = "heavy"
	TierAdmin    EndpointTier = "admin"
	TierCritical EndpointTier = "critical"
)

// getEndpointTier determines the rate limit tier based on the request path and method
func getEndpointTier(c *gin.Context) EndpointTier {
	path := c.Request.URL.Path
	method := c.Request.Method

	// Critical tier endpoints (highest restriction)
	switch {
	case path == "/api/v1/scan/now" && method == "POST": // Scan all volumes
		return TierCritical
	}

	// Admin tier endpoints
	switch {
	case path == "/api/v1/database/migrations/apply" && method == "POST":
		return TierAdmin
	case path == "/api/v1/database/migrations/rollback" && method == "POST":
		return TierAdmin
	}

	// Heavy tier endpoints
	switch {
	case path == "/api/v1/volumes/bulk-scan" && method == "POST": // Bulk operations
		return TierHeavy
	case method == "POST" && (
	// Volume scanning operations
	c.Param("name") != "" && (path == "/api/v1/volumes/"+c.Param("name")+"/scan" ||
		path == "/api/v1/volumes/"+c.Param("name")+"/size/refresh")):
		return TierHeavy
	}

	// Default tier for everything else
	return TierDefault
}

// getRateLimitForTier returns the RPM and burst values for a given tier
func (config *TieredRateLimitConfig) getRateLimitForTier(tier EndpointTier) (rpm, burst int) {
	switch tier {
	case TierHeavy:
		return config.HeavyRPM, config.HeavyBurst
	case TierAdmin:
		return config.AdminRPM, config.AdminBurst
	case TierCritical:
		return config.CriticalRPM, config.CriticalBurst
	default:
		return config.DefaultRPM, config.DefaultBurst
	}
}

// TieredRateLimitMiddleware returns a tiered rate limiting middleware
func TieredRateLimitMiddleware(config *TieredRateLimitConfig) gin.HandlerFunc {
	if config == nil {
		config = DefaultTieredRateLimitConfig()
	}

	// If disabled, return a no-op middleware
	if !config.Enabled {
		return func(c *gin.Context) {
			c.Next()
		}
	}

	// Create separate limiters for each tier
	limiters := make(map[EndpointTier]*RateLimiter)

	// Initialize limiters for each tier with appropriate limits
	for _, tier := range []EndpointTier{TierDefault, TierHeavy, TierAdmin, TierCritical} {
		rpm, burst := config.getRateLimitForTier(tier)
		limiters[tier] = NewRateLimiter(&RateLimitConfig{
			Enabled:   true,
			RPM:       rpm,
			Burst:     burst,
			SkipPaths: config.SkipPaths,
			KeyFunc:   config.KeyFunc,
		})
	}

	// Start cleanup goroutines for all limiters
	for _, limiter := range limiters {
		go func(l *RateLimiter) {
			ticker := time.NewTicker(time.Hour)
			defer ticker.Stop()

			for range ticker.C {
				l.Cleanup()
			}
		}(limiter)
	}

	return gin.HandlerFunc(func(c *gin.Context) {
		// Skip rate limiting for certain paths
		for _, skipPath := range config.SkipPaths {
			if c.Request.URL.Path == skipPath {
				c.Next()
				return
			}
		}

		// Determine the endpoint tier
		tier := getEndpointTier(c)
		limiter := limiters[tier]

		// Generate rate limit key (includes tier for separation)
		baseKey := config.KeyFunc(c)
		key := fmt.Sprintf("%s:%s", tier, baseKey)

		// Check if request is allowed
		if !limiter.IsAllowed(key) {
			rpm, burst := config.getRateLimitForTier(tier)

			// Set rate limit headers
			c.Header("X-RateLimit-Limit", strconv.Itoa(rpm))
			c.Header("X-RateLimit-Remaining", "0")
			c.Header("X-RateLimit-Reset", strconv.FormatInt(time.Now().Add(time.Minute).Unix(), 10))
			c.Header("X-RateLimit-Tier", string(tier))
			c.Header("X-RateLimit-Burst", strconv.Itoa(burst))

			// Calculate retry after based on tier (more restrictive tiers have longer wait times)
			var retryAfter int
			switch tier {
			case TierCritical:
				retryAfter = 300 // 5 minutes
			case TierAdmin:
				retryAfter = 120 // 2 minutes
			case TierHeavy:
				retryAfter = 60 // 1 minute
			default:
				retryAfter = 30 // 30 seconds
			}

			utils.RespondWithRateLimited(c,
				fmt.Sprintf("Rate limit exceeded for %s tier endpoints", tier),
				retryAfter)
			return
		}

		// Add rate limit information headers for successful requests
		rpm, burst := config.getRateLimitForTier(tier)
		c.Header("X-RateLimit-Limit", strconv.Itoa(rpm))
		c.Header("X-RateLimit-Tier", string(tier))
		c.Header("X-RateLimit-Burst", strconv.Itoa(burst))

		c.Next()
	})
}

// ErrorBudgetConfig defines configuration for 5xx error budget tracking
type ErrorBudgetConfig struct {
	Enabled        bool          // Whether error budget tracking is enabled
	WindowDuration time.Duration // Time window for error budget (e.g., 1 hour)
	ErrorThreshold int           // Maximum 5xx errors allowed in window
	CircuitBreaker bool          // Whether to enable circuit breaker behavior
	RecoveryTime   time.Duration // Time to wait before allowing requests again
}

// DefaultErrorBudgetConfig returns default error budget configuration
func DefaultErrorBudgetConfig() *ErrorBudgetConfig {
	return &ErrorBudgetConfig{
		Enabled:        true,
		WindowDuration: time.Hour,        // 1 hour window
		ErrorThreshold: 100,              // 100 5xx errors per hour max
		CircuitBreaker: true,             // Enable circuit breaker
		RecoveryTime:   time.Minute * 10, // 10 minute recovery
	}
}

// ErrorBudgetTracker tracks 5xx errors and implements circuit breaker logic
type ErrorBudgetTracker struct {
	errors      []time.Time
	config      *ErrorBudgetConfig
	circuitOpen bool
	lastError   time.Time
}

// NewErrorBudgetTracker creates a new error budget tracker
func NewErrorBudgetTracker(config *ErrorBudgetConfig) *ErrorBudgetTracker {
	if config == nil {
		config = DefaultErrorBudgetConfig()
	}

	return &ErrorBudgetTracker{
		errors: make([]time.Time, 0),
		config: config,
	}
}

// RecordError records a 5xx error
func (ebt *ErrorBudgetTracker) RecordError() {
	now := time.Now()
	ebt.lastError = now

	// Add current error
	ebt.errors = append(ebt.errors, now)

	// Clean up old errors outside the window
	cutoff := now.Add(-ebt.config.WindowDuration)
	validErrors := make([]time.Time, 0, len(ebt.errors))
	for _, errorTime := range ebt.errors {
		if errorTime.After(cutoff) {
			validErrors = append(validErrors, errorTime)
		}
	}
	ebt.errors = validErrors

	// Check if we should open the circuit
	if ebt.config.CircuitBreaker && len(ebt.errors) > ebt.config.ErrorThreshold {
		ebt.circuitOpen = true
	}
}

// ShouldAllow checks if a request should be allowed based on error budget
func (ebt *ErrorBudgetTracker) ShouldAllow() bool {
	if !ebt.config.Enabled {
		return true
	}

	// If circuit breaker is disabled, always allow
	if !ebt.config.CircuitBreaker {
		return true
	}

	// Check current error count and update circuit state
	currentErrorCount := ebt.GetErrorCount()
	if currentErrorCount > ebt.config.ErrorThreshold {
		ebt.circuitOpen = true
	}

	// If circuit is open, check if enough time has passed for recovery
	if ebt.circuitOpen {
		if time.Since(ebt.lastError) >= ebt.config.RecoveryTime {
			ebt.circuitOpen = false
			return true
		}
		return false
	}

	return true
}

// GetErrorCount returns the current error count in the window
func (ebt *ErrorBudgetTracker) GetErrorCount() int {
	// Clean up old errors
	now := time.Now()
	cutoff := now.Add(-ebt.config.WindowDuration)
	validErrors := make([]time.Time, 0, len(ebt.errors))
	for _, errorTime := range ebt.errors {
		if errorTime.After(cutoff) {
			validErrors = append(validErrors, errorTime)
		}
	}
	ebt.errors = validErrors

	return len(ebt.errors)
}

// IsCircuitOpen returns true if the circuit breaker is currently open
func (ebt *ErrorBudgetTracker) IsCircuitOpen() bool {
	if !ebt.config.Enabled || !ebt.config.CircuitBreaker {
		return false
	}

	// Check current error count and update circuit state
	currentErrorCount := ebt.GetErrorCount()
	if currentErrorCount > ebt.config.ErrorThreshold {
		ebt.circuitOpen = true
	}

	// If circuit is open, check if enough time has passed for recovery
	if ebt.circuitOpen && time.Since(ebt.lastError) >= ebt.config.RecoveryTime {
		ebt.circuitOpen = false
	}

	return ebt.circuitOpen
}

// ErrorBudgetMiddleware tracks 5xx errors and implements circuit breaker logic
func ErrorBudgetMiddleware(config *ErrorBudgetConfig) gin.HandlerFunc {
	tracker := NewErrorBudgetTracker(config)

	return gin.HandlerFunc(func(c *gin.Context) {
		// Check if circuit breaker should block the request
		if !tracker.ShouldAllow() {
			c.Header("X-Circuit-Breaker", "open")
			c.Header("X-Error-Budget-Exceeded", "true")

			utils.RespondWithError(c,
				http.StatusServiceUnavailable,
				utils.ErrorCodeInternal,
				"Service temporarily unavailable due to high error rate",
				map[string]interface{}{
					"circuit_breaker": "open",
					"recovery_time":   tracker.config.RecoveryTime.String(),
				})
			return
		}

		// Add error budget info to headers
		c.Header("X-Error-Budget-Count", strconv.Itoa(tracker.GetErrorCount()))
		c.Header("X-Error-Budget-Threshold", strconv.Itoa(tracker.config.ErrorThreshold))
		c.Header("X-Circuit-Breaker", "closed")

		c.Next()

		// Record 5xx errors after request completion
		if c.Writer.Status() >= 500 && c.Writer.Status() < 600 {
			tracker.RecordError()
		}
	})
}
