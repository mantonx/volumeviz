package middleware

import (
	"fmt"
	"net"
	"net/http"
	"strconv"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
)

// TokenBucket implements a simple token bucket rate limiter
type TokenBucket struct {
	capacity   int           // Maximum tokens
	tokens     int           // Current tokens
	refillRate int           // Tokens per minute
	lastRefill time.Time     // Last refill time
	mutex      sync.Mutex    // Thread safety
}

// NewTokenBucket creates a new token bucket
func NewTokenBucket(capacity, refillRate int) *TokenBucket {
	return &TokenBucket{
		capacity:   capacity,
		tokens:     capacity,
		refillRate: refillRate,
		lastRefill: time.Now(),
	}
}

// TryConsume attempts to consume a token
func (tb *TokenBucket) TryConsume() bool {
	tb.mutex.Lock()
	defer tb.mutex.Unlock()

	// Refill tokens based on time elapsed
	now := time.Now()
	elapsed := now.Sub(tb.lastRefill).Minutes()
	
	if elapsed >= 1.0 {
		// Add tokens for each minute elapsed
		tokensToAdd := int(elapsed) * tb.refillRate
		tb.tokens = min(tb.capacity, tb.tokens+tokensToAdd)
		tb.lastRefill = now
	}

	// Try to consume a token
	if tb.tokens > 0 {
		tb.tokens--
		return true
	}

	return false
}

// RateLimitConfig holds rate limiting configuration
type RateLimitConfig struct {
	Enabled    bool          // Whether rate limiting is enabled
	RPM        int           // Requests per minute
	Burst      int           // Burst capacity
	SkipPaths  []string      // Paths to skip (e.g., health checks)
	KeyFunc    func(*gin.Context) string // Function to generate rate limit key
}

// DefaultRateLimitConfig returns default rate limiting configuration
func DefaultRateLimitConfig() *RateLimitConfig {
	return &RateLimitConfig{
		Enabled:   true,
		RPM:       60,   // 60 requests per minute
		Burst:     30,   // Allow bursts up to 30 requests
		SkipPaths: []string{"/api/v1/health", "/health", "/metrics"},
		KeyFunc:   DefaultKeyFunc,
	}
}

// DefaultKeyFunc generates a rate limit key based on client IP and route
func DefaultKeyFunc(c *gin.Context) string {
	// Get client IP
	clientIP := getClientIP(c)
	
	// Include route in key for per-endpoint limiting
	route := c.FullPath()
	if route == "" {
		route = c.Request.URL.Path
	}
	
	return fmt.Sprintf("%s:%s", clientIP, route)
}

// getClientIP extracts the real client IP from the request
func getClientIP(c *gin.Context) string {
	// Check X-Forwarded-For header (from reverse proxy)
	if xff := c.GetHeader("X-Forwarded-For"); xff != "" {
		// Take the first IP in the list
		if ip := net.ParseIP(xff); ip != nil {
			return ip.String()
		}
	}

	// Check X-Real-IP header
	if xri := c.GetHeader("X-Real-IP"); xri != "" {
		if ip := net.ParseIP(xri); ip != nil {
			return ip.String()
		}
	}

	// Fall back to RemoteAddr
	host, _, err := net.SplitHostPort(c.Request.RemoteAddr)
	if err != nil {
		return c.Request.RemoteAddr
	}
	
	return host
}

// RateLimiter manages rate limiting for multiple keys
type RateLimiter struct {
	buckets map[string]*TokenBucket
	config  *RateLimitConfig
	mutex   sync.RWMutex
}

// NewRateLimiter creates a new rate limiter
func NewRateLimiter(config *RateLimitConfig) *RateLimiter {
	if config == nil {
		config = DefaultRateLimitConfig()
	}

	return &RateLimiter{
		buckets: make(map[string]*TokenBucket),
		config:  config,
	}
}

// IsAllowed checks if a request should be allowed
func (rl *RateLimiter) IsAllowed(key string) bool {
	rl.mutex.RLock()
	bucket, exists := rl.buckets[key]
	rl.mutex.RUnlock()

	if !exists {
		rl.mutex.Lock()
		// Double-check after acquiring write lock
		bucket, exists = rl.buckets[key]
		if !exists {
			bucket = NewTokenBucket(rl.config.Burst, rl.config.RPM)
			rl.buckets[key] = bucket
		}
		rl.mutex.Unlock()
	}

	return bucket.TryConsume()
}

// Cleanup removes old buckets to prevent memory leaks
func (rl *RateLimiter) Cleanup() {
	rl.mutex.Lock()
	defer rl.mutex.Unlock()

	now := time.Now()
	for key, bucket := range rl.buckets {
		// Remove buckets that haven't been used in the last hour
		if now.Sub(bucket.lastRefill) > time.Hour {
			delete(rl.buckets, key)
		}
	}
}

// RateLimitMiddleware returns a rate limiting middleware
func RateLimitMiddleware(config *RateLimitConfig) gin.HandlerFunc {
	if config == nil {
		config = DefaultRateLimitConfig()
	}

	// If disabled, return a no-op middleware
	if !config.Enabled {
		return func(c *gin.Context) {
			c.Next()
		}
	}

	limiter := NewRateLimiter(config)

	// Start cleanup goroutine
	go func() {
		ticker := time.NewTicker(time.Hour)
		defer ticker.Stop()
		
		for range ticker.C {
			limiter.Cleanup()
		}
	}()

	return gin.HandlerFunc(func(c *gin.Context) {
		// Skip rate limiting for certain paths
		for _, skipPath := range config.SkipPaths {
			if c.Request.URL.Path == skipPath {
				c.Next()
				return
			}
		}

		// Generate rate limit key
		key := config.KeyFunc(c)

		// Check if request is allowed
		if !limiter.IsAllowed(key) {
			c.Header("X-RateLimit-Limit", strconv.Itoa(config.RPM))
			c.Header("X-RateLimit-Remaining", "0")
			c.Header("X-RateLimit-Reset", strconv.FormatInt(time.Now().Add(time.Minute).Unix(), 10))
			
			c.AbortWithStatusJSON(http.StatusTooManyRequests, gin.H{
				"error":     "Rate limit exceeded",
				"code":      "RATE_LIMIT_EXCEEDED",
				"requestId": GetRequestID(c),
				"retryAfter": "60", // seconds
			})
			return
		}

		c.Next()
	})
}

// min returns the minimum of two integers
func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}