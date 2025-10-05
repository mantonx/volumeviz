package middleware

import (
	"context"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/mantonx/volumeviz/internal/store"
)

type contextKey string

const (
	// OrganizationContextKey is the key for organization ID in context
	OrganizationContextKey contextKey = "organization_id"
	// UserContextKey is the key for user ID in context  
	UserContextKey contextKey = "user_id"
)

// OrganizationMiddleware ensures the user has a valid organization context
type OrganizationMiddleware struct {
	store       store.Store
	authEnabled bool
}

// NewOrganizationMiddleware creates a new organization middleware instance
func NewOrganizationMiddleware(store store.Store) *OrganizationMiddleware {
	return &OrganizationMiddleware{
		store:       store,
		authEnabled: true, // Default to auth enabled for backwards compatibility
	}
}

// NewOrganizationMiddlewareWithAuth creates a new organization middleware with auth configuration
func NewOrganizationMiddlewareWithAuth(store store.Store, authEnabled bool) *OrganizationMiddleware {
	return &OrganizationMiddleware{
		store:       store,
		authEnabled: authEnabled,
	}
}

// RequireOrganization ensures the request has a valid organization context
func (m *OrganizationMiddleware) RequireOrganization() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Skip organization checks if auth is disabled
		if !m.authEnabled {
			c.Next()
			return
		}

		// Get user from context (set by auth middleware)
		userID, exists := c.Get("user_id")
		if !exists {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
			c.Abort()
			return
		}

		// Convert user ID to int64
		uid, err := strconv.ParseInt(userID.(string), 10, 64)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
			c.Abort()
			return
		}

		var organizationID int64

		// First try to get organization ID from JWT claims (set by auth middleware)
		if orgID, exists := c.Get("organization_id"); exists {
			if oid, ok := orgID.(int64); ok && oid > 0 {
				organizationID = oid
			}
		}

		// If not found in claims, fall back to database lookup
		if organizationID == 0 {
			user, err := m.store.GetUserByID(c.Request.Context(), uid)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get user information"})
				c.Abort()
				return
			}

			// Check if user has an organization
			if !user.OrganizationID.Valid || user.OrganizationID.Int64 == 0 {
				c.JSON(http.StatusForbidden, gin.H{"error": "User is not associated with an organization"})
				c.Abort()
				return
			}

			organizationID = user.OrganizationID.Int64
		}

		// Verify organization is active
		org, err := m.store.GetOrganizationByID(c.Request.Context(), organizationID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get organization information"})
			c.Abort()
			return
		}

		if !org.IsActive.Bool {
			c.JSON(http.StatusForbidden, gin.H{"error": "Organization is not active"})
			c.Abort()
			return
		}

		// Add organization ID to context
		c.Set("organization_id", organizationID)
		c.Set("organization", org)
		
		// Also set it in the request context for downstream use
		ctx := context.WithValue(c.Request.Context(), OrganizationContextKey, organizationID)
		ctx = context.WithValue(ctx, UserContextKey, uid)
		c.Request = c.Request.WithContext(ctx)

		c.Next()
	}
}

// GetOrganizationID extracts organization ID from context
func GetOrganizationID(ctx context.Context) (int64, bool) {
	orgID, ok := ctx.Value(OrganizationContextKey).(int64)
	return orgID, ok
}

// GetUserIDFromOrganizationContext extracts user ID from organization context
func GetUserIDFromOrganizationContext(ctx context.Context) (int64, bool) {
	userID, ok := ctx.Value(UserContextKey).(int64)
	return userID, ok
}

// OptionalOrganization allows requests with or without organization context
// Useful for endpoints that can work both globally and per-organization
func (m *OrganizationMiddleware) OptionalOrganization() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Get user from context if exists
		userID, exists := c.Get("user_id")
		if !exists {
			c.Next()
			return
		}

		// Convert user ID to int64
		uid, err := strconv.ParseInt(userID.(string), 10, 64)
		if err != nil {
			c.Next()
			return
		}

		var organizationID int64

		// First try to get organization ID from JWT claims (set by auth middleware)
		if orgID, exists := c.Get("organization_id"); exists {
			if oid, ok := orgID.(int64); ok && oid > 0 {
				organizationID = oid
			}
		}

		// If not found in claims, fall back to database lookup
		if organizationID == 0 {
			user, err := m.store.GetUserByID(c.Request.Context(), uid)
			if err != nil {
				c.Next()
				return
			}

			// If user has an organization, use it
			if user.OrganizationID.Valid && user.OrganizationID.Int64 > 0 {
				organizationID = user.OrganizationID.Int64
			}
		}

		// If we have an organization ID, verify it and add to context
		if organizationID > 0 {
			org, err := m.store.GetOrganizationByID(c.Request.Context(), organizationID)
			if err == nil && org.IsActive.Bool {
				c.Set("organization_id", organizationID)
				c.Set("organization", org)
				
				ctx := context.WithValue(c.Request.Context(), OrganizationContextKey, organizationID)
				ctx = context.WithValue(ctx, UserContextKey, uid)
				c.Request = c.Request.WithContext(ctx)
			}
		}

		c.Next()
	}
}