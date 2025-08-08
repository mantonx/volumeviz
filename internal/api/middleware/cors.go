package middleware

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
)

// CORSConfig holds CORS configuration
type CORSConfig struct {
	AllowedOrigins   []string
	AllowedMethods   []string
	AllowedHeaders   []string
	ExposedHeaders   []string
	AllowCredentials bool
	MaxAge           int
}

// DefaultCORSConfig returns secure default CORS configuration
func DefaultCORSConfig() *CORSConfig {
	return &CORSConfig{
		AllowedOrigins: []string{"http://localhost:3000"}, // Secure default
		AllowedMethods: []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowedHeaders: []string{
			"Accept",
			"Authorization",
			"Content-Type",
			"X-Requested-With",
		},
		ExposedHeaders:   []string{"X-Request-ID"},
		AllowCredentials: false, // More secure default
		MaxAge:           300,   // 5 minutes
	}
}

// CORSMiddleware returns a CORS middleware with the given configuration
func CORSMiddleware(config *CORSConfig) gin.HandlerFunc {
	if config == nil {
		config = DefaultCORSConfig()
	}

	return gin.HandlerFunc(func(c *gin.Context) {
		origin := c.Request.Header.Get("Origin")
		method := c.Request.Method

		// Check if origin is allowed
		originAllowed := false
		if len(config.AllowedOrigins) == 0 {
			// No origins configured - deny all
			originAllowed = false
		} else {
			for _, allowedOrigin := range config.AllowedOrigins {
				if allowedOrigin == "*" {
					// Wildcard allowed (less secure)
					c.Header("Access-Control-Allow-Origin", "*")
					originAllowed = true
					break
				} else if allowedOrigin == origin {
					// Exact match
					c.Header("Access-Control-Allow-Origin", origin)
					originAllowed = true
					break
				}
			}
		}

		// If origin is not allowed and this is not a preflight request, block it
		if !originAllowed && method != "OPTIONS" {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{
				"error": "CORS policy violation",
				"code":  "CORS_DENIED",
			})
			return
		}

		// Set CORS headers for allowed origins
		if originAllowed {
			// Methods
			if len(config.AllowedMethods) > 0 {
				c.Header("Access-Control-Allow-Methods", strings.Join(config.AllowedMethods, ", "))
			}

			// Headers
			if len(config.AllowedHeaders) > 0 {
				c.Header("Access-Control-Allow-Headers", strings.Join(config.AllowedHeaders, ", "))
			}

			// Exposed headers
			if len(config.ExposedHeaders) > 0 {
				c.Header("Access-Control-Expose-Headers", strings.Join(config.ExposedHeaders, ", "))
			}

			// Credentials
			if config.AllowCredentials {
				c.Header("Access-Control-Allow-Credentials", "true")
			}

			// Max age for preflight requests
			if config.MaxAge > 0 {
				c.Header("Access-Control-Max-Age", string(rune(config.MaxAge)))
			}
		}

		// Handle preflight OPTIONS requests
		if method == "OPTIONS" {
			// Check if the request method is allowed
			requestedMethod := c.Request.Header.Get("Access-Control-Request-Method")
			methodAllowed := false

			if requestedMethod != "" {
				for _, allowedMethod := range config.AllowedMethods {
					if allowedMethod == requestedMethod {
						methodAllowed = true
						break
					}
				}
			}

			// Check if requested headers are allowed
			requestedHeaders := c.Request.Header.Get("Access-Control-Request-Headers")
			headersAllowed := true

			if requestedHeaders != "" {
				headers := strings.Split(requestedHeaders, ",")
				for _, header := range headers {
					header = strings.TrimSpace(header)
					headerAllowed := false

					for _, allowedHeader := range config.AllowedHeaders {
						if strings.EqualFold(allowedHeader, header) {
							headerAllowed = true
							break
						}
					}

					if !headerAllowed {
						headersAllowed = false
						break
					}
				}
			}

			// Respond to preflight
			if originAllowed && methodAllowed && headersAllowed {
				c.Status(http.StatusNoContent)
			} else {
				c.AbortWithStatusJSON(http.StatusForbidden, gin.H{
					"error": "CORS preflight failed",
					"code":  "CORS_PREFLIGHT_DENIED",
				})
			}
			return
		}

		c.Next()
	})
}
