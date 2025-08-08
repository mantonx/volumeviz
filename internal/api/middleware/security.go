package middleware

import (
	"strings"

	"github.com/gin-gonic/gin"
)

// SecurityConfig holds security middleware configuration
type SecurityConfig struct {
	ContentTypeOptions      string
	FrameOptions           string
	ReferrerPolicy         string
	ContentSecurityPolicy  string
	StrictTransportSecurity string // Only set if using HTTPS
	PermittedCrossDomainPolicies string
	HideServerHeader       bool
}

// DefaultSecurityConfig returns secure default security headers configuration
func DefaultSecurityConfig() *SecurityConfig {
	return &SecurityConfig{
		ContentTypeOptions:      "nosniff",
		FrameOptions:           "SAMEORIGIN",
		ReferrerPolicy:         "no-referrer",
		ContentSecurityPolicy:  "default-src 'none'; frame-ancestors 'self';",
		PermittedCrossDomainPolicies: "none",
		HideServerHeader:       true,
	}
}

// SecurityHeadersMiddleware adds security headers to all responses
func SecurityHeadersMiddleware(config *SecurityConfig) gin.HandlerFunc {
	if config == nil {
		config = DefaultSecurityConfig()
	}

	return gin.HandlerFunc(func(c *gin.Context) {
		// X-Content-Type-Options: Prevents MIME type confusion attacks
		if config.ContentTypeOptions != "" {
			c.Header("X-Content-Type-Options", config.ContentTypeOptions)
		}

		// X-Frame-Options: Prevents clickjacking attacks
		if config.FrameOptions != "" {
			c.Header("X-Frame-Options", config.FrameOptions)
		}

		// Referrer-Policy: Controls referrer information
		if config.ReferrerPolicy != "" {
			c.Header("Referrer-Policy", config.ReferrerPolicy)
		}

		// Content-Security-Policy: Prevents XSS and other injection attacks
		if config.ContentSecurityPolicy != "" {
			c.Header("Content-Security-Policy", config.ContentSecurityPolicy)
		}

		// Strict-Transport-Security: Forces HTTPS (only set if using HTTPS)
		if config.StrictTransportSecurity != "" && c.Request.TLS != nil {
			c.Header("Strict-Transport-Security", config.StrictTransportSecurity)
		}

		// X-Permitted-Cross-Domain-Policies: Controls Flash/PDF cross-domain access
		if config.PermittedCrossDomainPolicies != "" {
			c.Header("X-Permitted-Cross-Domain-Policies", config.PermittedCrossDomainPolicies)
		}

		// Hide server information
		if config.HideServerHeader {
			c.Header("Server", "")
		}

		c.Next()
	})
}

// ErrorHandlingMiddleware enhances error handling with security considerations
func ErrorHandlingMiddleware(isProduction bool) gin.HandlerFunc {
	return gin.HandlerFunc(func(c *gin.Context) {
		c.Next()

		// Check if there are errors to handle
		if len(c.Errors) > 0 {
			err := c.Errors.Last()

			// In production, don't expose internal error details
			if isProduction {
				// Log the full error but return generic message
				gin.Logger()(c)
				
				c.JSON(c.Writer.Status(), gin.H{
					"error":     "Internal server error",
					"code":      "INTERNAL_ERROR", 
					"requestId": c.GetString("requestId"),
				})
			} else {
				// In development, show more details
				c.JSON(c.Writer.Status(), gin.H{
					"error":     err.Error(),
					"code":      "INTERNAL_ERROR",
					"requestId": c.GetString("requestId"),
					"type":      err.Type,
				})
			}
		}
	})
}

// NoSniffMiddleware sets X-Content-Type-Options header
func NoSniffMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Header("X-Content-Type-Options", "nosniff")
		c.Next()
	}
}

// HTTPSRedirectMiddleware redirects HTTP to HTTPS in production
func HTTPSRedirectMiddleware(enabled bool) gin.HandlerFunc {
	return gin.HandlerFunc(func(c *gin.Context) {
		if !enabled {
			c.Next()
			return
		}

		// Check if request is already HTTPS
		if c.Request.TLS != nil {
			c.Next()
			return
		}

		// Check X-Forwarded-Proto header (for reverse proxies)
		if strings.ToLower(c.Request.Header.Get("X-Forwarded-Proto")) == "https" {
			c.Next()
			return
		}

		// Redirect to HTTPS
		httpsURL := "https://" + c.Request.Host + c.Request.URL.String()
		c.Redirect(301, httpsURL)
		c.Abort()
	})
}