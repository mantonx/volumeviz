package middleware

import (
	"fmt"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/mantonx/volumeviz/internal/utils/auth"
)

// UserRole represents user authorization roles
type UserRole string

const (
	RoleViewer   UserRole = "viewer"
	RoleOperator UserRole = "operator"
	RoleAdmin    UserRole = "admin"
)

// AuthConfig holds authentication middleware configuration
type AuthConfig struct {
	Enabled      bool
	JWTManager   *auth.JWTManager
	SkipPaths    []string
	RequiredRole UserRole // Minimum required role
}

// DefaultAuthConfig returns default authentication configuration
func DefaultAuthConfig() *AuthConfig {
	return &AuthConfig{
		Enabled:      false, // Disabled by default for development
		RequiredRole: RoleViewer,
		SkipPaths: []string{
			"/api/v1/health",
			"/health",
			"/metrics",
			"/api/docs",
			"/openapi",
		},
	}
}

// NewAuthConfig creates a new auth config with JWT manager
func NewAuthConfig(jwtManager *auth.JWTManager, enabled bool) *AuthConfig {
	config := DefaultAuthConfig()
	config.JWTManager = jwtManager
	config.Enabled = enabled
	return config
}

// AuthMiddleware returns JWT authentication middleware
func AuthMiddleware(config *AuthConfig) gin.HandlerFunc {
	if config == nil {
		config = DefaultAuthConfig()
	}

	// If authentication is disabled, return a no-op middleware
	if !config.Enabled {
		return func(c *gin.Context) {
			c.Next()
		}
	}

	// Validate JWT manager is provided
	if config.JWTManager == nil {
		panic("JWTManager must be provided when AUTH_ENABLED=true")
	}

	return gin.HandlerFunc(func(c *gin.Context) {
		// Skip authentication for OPTIONS requests (CORS preflight)
		if c.Request.Method == "OPTIONS" {
			c.Next()
			return
		}

		// Skip authentication for certain paths
		for _, skipPath := range config.SkipPaths {
			if strings.HasPrefix(c.Request.URL.Path, skipPath) {
				c.Next()
				return
			}
		}

		// Extract token from Authorization header
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"error":     "Authorization header required",
				"code":      "MISSING_AUTH_HEADER",
				"requestId": GetRequestID(c),
			})
			return
		}

		// Check Bearer token format
		parts := strings.SplitN(authHeader, " ", 2)
		if len(parts) != 2 || parts[0] != "Bearer" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"error":     "Invalid authorization header format",
				"code":      "INVALID_AUTH_FORMAT",
				"requestId": GetRequestID(c),
			})
			return
		}

		tokenString := parts[1]

		// Parse and validate JWT token using JWT manager
		claims, err := config.JWTManager.ValidateAccessToken(tokenString)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"error":     "Invalid token",
				"code":      "INVALID_TOKEN",
				"details":   err.Error(),
				"requestId": GetRequestID(c),
			})
			return
		}

		// Check if user role meets minimum requirement
		if !hasRequiredRole(UserRole(claims.Role), config.RequiredRole) {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{
				"error":     "Insufficient permissions",
				"code":      "INSUFFICIENT_PERMISSIONS",
				"requestId": GetRequestID(c),
			})
			return
		}

		// Store user information in context for use by handlers
		c.Set("user_id", claims.UserID)
		c.Set("user_role", claims.Role)
		
		// Store organization ID if present in token
		if claims.OrganizationID != nil {
			c.Set("organization_id", *claims.OrganizationID)
		}

		c.Next()
	})
}

// ProtectMutatingOperations middleware protects write operations
func ProtectMutatingOperations(config *AuthConfig) gin.HandlerFunc {
	if config == nil {
		config = DefaultAuthConfig()
	}

	// If authentication is disabled, allow all operations
	if !config.Enabled {
		return func(c *gin.Context) {
			c.Next()
		}
	}

	return gin.HandlerFunc(func(c *gin.Context) {
		// Only protect mutating HTTP methods
		method := c.Request.Method
		if method == "POST" || method == "PUT" || method == "PATCH" || method == "DELETE" {
			// Check if user has operator role or higher
			userRole := c.GetString("user_role")
			if userRole == "" {
				c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
					"error":     "Authentication required for this operation",
					"code":      "AUTH_REQUIRED",
					"requestId": GetRequestID(c),
				})
				return
			}

			if !hasRequiredRole(UserRole(userRole), RoleOperator) {
				c.AbortWithStatusJSON(http.StatusForbidden, gin.H{
					"error":     "Operator role required for this operation",
					"code":      "OPERATOR_REQUIRED",
					"requestId": GetRequestID(c),
				})
				return
			}
		}

		c.Next()
	})
}

// RequireRole middleware requires a specific minimum role
func RequireRole(requiredRole UserRole) gin.HandlerFunc {
	return gin.HandlerFunc(func(c *gin.Context) {
		userRole := c.GetString("user_role")
		if userRole == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"error":     "Authentication required",
				"code":      "AUTH_REQUIRED",
				"requestId": GetRequestID(c),
			})
			return
		}

		if !hasRequiredRole(UserRole(userRole), requiredRole) {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{
				"error":     fmt.Sprintf("%s role required", requiredRole),
				"code":      "INSUFFICIENT_ROLE",
				"requestId": GetRequestID(c),
			})
			return
		}

		c.Next()
	})
}

// hasRequiredRole checks if a user role meets the minimum requirement
func hasRequiredRole(userRole, requiredRole UserRole) bool {
	roleHierarchy := map[UserRole]int{
		RoleViewer:   1,
		"user":       2, // "user" role is equivalent to operator
		RoleOperator: 2,
		RoleAdmin:    3,
	}

	userLevel := roleHierarchy[userRole]
	requiredLevel := roleHierarchy[requiredRole]

	return userLevel >= requiredLevel
}

// GetUserID retrieves the user ID from the context
func GetUserID(c *gin.Context) string {
	if userID, exists := c.Get("userID"); exists {
		if id, ok := userID.(string); ok {
			return id
		}
	}
	return ""
}

// GetUserRole retrieves the user role from the context
func GetUserRole(c *gin.Context) UserRole {
	if userRole, exists := c.Get("userRole"); exists {
		if role, ok := userRole.(string); ok {
			return UserRole(role)
		}
	}
	return ""
}

