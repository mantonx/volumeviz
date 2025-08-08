package middleware

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

// UserRole represents user authorization roles
type UserRole string

const (
	RoleViewer   UserRole = "viewer"
	RoleOperator UserRole = "operator"
	RoleAdmin    UserRole = "admin"
)

// JWTHeader represents JWT header
type JWTHeader struct {
	Type      string `json:"typ"`
	Algorithm string `json:"alg"`
}

// AuthClaims represents JWT claims for authentication
type AuthClaims struct {
	UserID    string    `json:"user_id"`
	Role      UserRole  `json:"role"`
	ExpiresAt time.Time `json:"exp"`
	IssuedAt  time.Time `json:"iat"`
	Issuer    string    `json:"iss"`
}

// AuthConfig holds authentication middleware configuration
type AuthConfig struct {
	Enabled      bool
	Secret       string
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

	// Validate secret is provided
	if config.Secret == "" {
		panic("AUTH_HS256_SECRET must be provided when AUTH_ENABLED=true")
	}

	return gin.HandlerFunc(func(c *gin.Context) {
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

		// Parse and validate JWT token
		claims, err := validateJWT(tokenString, config.Secret)
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
		if !hasRequiredRole(claims.Role, config.RequiredRole) {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{
				"error":     "Insufficient permissions",
				"code":      "INSUFFICIENT_PERMISSIONS",
				"requestId": GetRequestID(c),
			})
			return
		}

		// Store user information in context for use by handlers
		c.Set("userID", claims.UserID)
		c.Set("userRole", string(claims.Role))

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
			userRole := c.GetString("userRole")
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
		userRole := c.GetString("userRole")
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

// validateJWT validates a JWT token and returns claims
func validateJWT(tokenString, secret string) (*AuthClaims, error) {
	// Split JWT into parts
	parts := strings.Split(tokenString, ".")
	if len(parts) != 3 {
		return nil, fmt.Errorf("invalid JWT format")
	}

	// Decode header
	headerData, err := base64.RawURLEncoding.DecodeString(parts[0])
	if err != nil {
		return nil, fmt.Errorf("invalid JWT header encoding")
	}

	var header JWTHeader
	if err := json.Unmarshal(headerData, &header); err != nil {
		return nil, fmt.Errorf("invalid JWT header")
	}

	// Check algorithm
	if header.Algorithm != "HS256" {
		return nil, fmt.Errorf("unsupported algorithm: %s", header.Algorithm)
	}

	// Verify signature
	payload := parts[0] + "." + parts[1]
	expectedSignature := generateHS256Signature(payload, secret)
	actualSignature := parts[2]

	if expectedSignature != actualSignature {
		return nil, fmt.Errorf("invalid signature")
	}

	// Decode payload
	payloadData, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil {
		return nil, fmt.Errorf("invalid JWT payload encoding")
	}

	var claims AuthClaims
	if err := json.Unmarshal(payloadData, &claims); err != nil {
		return nil, fmt.Errorf("invalid JWT claims")
	}

	// Check expiration
	if time.Now().After(claims.ExpiresAt) {
		return nil, fmt.Errorf("token expired")
	}

	return &claims, nil
}

// generateHS256Signature generates HMAC SHA256 signature
func generateHS256Signature(payload, secret string) string {
	h := hmac.New(sha256.New, []byte(secret))
	h.Write([]byte(payload))
	return base64.RawURLEncoding.EncodeToString(h.Sum(nil))
}

// GenerateJWT generates a JWT token (helper for development)
func GenerateJWT(userID string, role UserRole, secret string, duration time.Duration) (string, error) {
	if secret == "" {
		return "", fmt.Errorf("secret cannot be empty")
	}

	now := time.Now()
	header := JWTHeader{
		Type:      "JWT",
		Algorithm: "HS256",
	}

	claims := AuthClaims{
		UserID:    userID,
		Role:      role,
		ExpiresAt: now.Add(duration),
		IssuedAt:  now,
		Issuer:    "volumeviz",
	}

	// Encode header
	headerBytes, err := json.Marshal(header)
	if err != nil {
		return "", err
	}
	headerEncoded := base64.RawURLEncoding.EncodeToString(headerBytes)

	// Encode claims
	claimsBytes, err := json.Marshal(claims)
	if err != nil {
		return "", err
	}
	claimsEncoded := base64.RawURLEncoding.EncodeToString(claimsBytes)

	// Generate signature
	payload := headerEncoded + "." + claimsEncoded
	signature := generateHS256Signature(payload, secret)

	return payload + "." + signature, nil
}
