package middleware

import (
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

// CacheControl adds cache control headers for API responses
func CacheControl() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Set default cache headers
		setCacheHeaders(c)
		c.Next()
	}
}

// setCacheHeaders sets appropriate cache headers based on the request path
func setCacheHeaders(c *gin.Context) {
	path := c.Request.URL.Path
	method := c.Request.Method

	// Only cache GET requests
	if method != "GET" {
		c.Header("Cache-Control", "no-cache, no-store, must-revalidate")
		return
	}

	// Different caching strategies based on endpoint
	switch {
	case strings.Contains(path, "/stats/"):
		// Stats can be cached for a short time
		c.Header("Cache-Control", "public, max-age=300") // 5 minutes
		c.Header("Vary", "Accept-Encoding")

	case strings.Contains(path, "/files/") && strings.Contains(path, "/metadata"):
		// File metadata can be cached longer
		c.Header("Cache-Control", "public, max-age=3600") // 1 hour
		c.Header("Vary", "Accept-Encoding")

	case strings.Contains(path, "/explorer/tree"):
		// Folder structure can be cached for a medium time
		c.Header("Cache-Control", "public, max-age=600") // 10 minutes
		c.Header("Vary", "Accept-Encoding")

	case strings.Contains(path, "/volumes/") && !strings.Contains(path, "/scan"):
		// Volume info can be cached longer
		c.Header("Cache-Control", "public, max-age=1800") // 30 minutes
		c.Header("Vary", "Accept-Encoding")

	case strings.Contains(path, "/openapi/") || strings.Contains(path, "/docs"):
		// API docs can be cached for a long time
		c.Header("Cache-Control", "public, max-age=86400") // 24 hours
		c.Header("Vary", "Accept-Encoding")

	default:
		// Default: short cache for dynamic content
		c.Header("Cache-Control", "public, max-age=60") // 1 minute
		c.Header("Vary", "Accept-Encoding")
	}

	// Add Last-Modified header if not present
	if c.GetHeader("Last-Modified") == "" {
		c.Header("Last-Modified", time.Now().UTC().Format(http.TimeFormat))
	}
}

// ETags generates and validates ETags for cacheable responses
func ETags() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Skip for non-GET requests
		if c.Request.Method != "GET" {
			c.Next()
			return
		}

		// Generate ETag based on request path and query parameters
		etag := generateETag(c)
		c.Header("ETag", etag)

		// Check If-None-Match header
		ifNoneMatch := c.GetHeader("If-None-Match")
		if ifNoneMatch != "" && ifNoneMatch == etag {
			c.Status(http.StatusNotModified)
			c.Abort()
			return
		}

		c.Next()
	}
}

// generateETag creates a simple ETag based on request characteristics
func generateETag(c *gin.Context) string {
	// Simple ETag generation - in production, this would be more sophisticated
	path := c.Request.URL.Path
	query := c.Request.URL.RawQuery
	content := path + "?" + query + ":" + strconv.FormatInt(time.Now().Unix()/300, 10) // 5-minute granularity

	// Simple hash (in production, use proper hashing)
	hash := 0
	for _, ch := range content {
		hash = hash*31 + int(ch)
	}

	return `"` + strconv.Itoa(hash) + `"`
}

// ConditionalRequests handles If-Modified-Since headers
func ConditionalRequests() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Skip for non-GET requests
		if c.Request.Method != "GET" {
			c.Next()
			return
		}

		// Check If-Modified-Since header
		ifModifiedSince := c.GetHeader("If-Modified-Since")
		if ifModifiedSince != "" {
			// For demo purposes, assume content is modified every 5 minutes
			// In production, this would check actual modification times
			modTime := time.Now().Truncate(5 * time.Minute)

			if ifModTime, err := http.ParseTime(ifModifiedSince); err == nil {
				if !modTime.After(ifModTime) {
					c.Status(http.StatusNotModified)
					c.Abort()
					return
				}
			}
		}

		c.Next()
	}
}
