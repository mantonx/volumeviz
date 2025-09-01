package security

import (
	"context"
	"database/sql"
	"log"

	"github.com/gin-gonic/gin"
	"github.com/mantonx/volumeviz/internal/api/middleware"
	"github.com/mantonx/volumeviz/internal/store"
)

// SecurityMiddleware integrates RLS database context with HTTP middleware
type SecurityMiddleware struct {
	dbSecurity *DatabaseSecurityContext
	store      store.Store
}

// NewSecurityMiddleware creates a new security middleware
func NewSecurityMiddleware(db *sql.DB, store store.Store) *SecurityMiddleware {
	return &SecurityMiddleware{
		dbSecurity: NewDatabaseSecurityContext(db),
		store:      store,
	}
}

// DatabaseContextKey is the context key for database security context
type DatabaseContextKey struct{}

// WithDatabaseSecurity middleware that sets up database security context based on organization context
func (sm *SecurityMiddleware) WithDatabaseSecurity() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Get organization context from existing middleware
		orgID, exists := c.Get("organization_id")
		if !exists {
			log.Printf("[SECURITY] No organization context found in request")
			c.Next()
			return
		}

		// Check if user has system admin privileges (from JWT or user role)
		isSystemAdmin := false
		if role, exists := c.Get("user_role"); exists {
			if roleStr, ok := role.(string); ok && roleStr == "admin" {
				isSystemAdmin = true
			}
		}

		// Create organization context
		var orgCtx OrganizationContext
		if orgIDInt, ok := orgID.(int64); ok {
			orgCtx = OrganizationContext{
				OrganizationID: &orgIDInt,
				IsSystemAdmin:  isSystemAdmin,
			}
		} else {
			// System-level operation
			orgCtx = OrganizationContext{
				IsSystemAdmin: isSystemAdmin,
			}
		}

		// Store database security context in request context
		ctx := context.WithValue(c.Request.Context(), DatabaseContextKey{}, sm.dbSecurity)
		ctx = context.WithValue(ctx, "org_context", orgCtx)
		c.Request = c.Request.WithContext(ctx)

		c.Next()
	}
}

// GetDatabaseSecurity retrieves the database security context from request context
func GetDatabaseSecurity(ctx context.Context) (*DatabaseSecurityContext, bool) {
	dbSecurity, ok := ctx.Value(DatabaseContextKey{}).(*DatabaseSecurityContext)
	return dbSecurity, ok
}

// GetOrganizationContext retrieves the organization context from request context
func GetOrganizationContext(ctx context.Context) (*OrganizationContext, bool) {
	orgCtx, ok := ctx.Value("org_context").(OrganizationContext)
	return &orgCtx, ok
}

// WithSecureQuery executes a database query with proper organization context
// This is a convenience function that handles RLS context automatically
func WithSecureQuery(ctx context.Context, fn func(ctx context.Context, tx *sql.Tx) error) error {
	dbSecurity, ok := GetDatabaseSecurity(ctx)
	if !ok {
		log.Printf("[SECURITY] Warning: No database security context, executing without RLS protection")
		return fn(ctx, nil) // Fallback to direct execution
	}

	orgCtx, ok := GetOrganizationContext(ctx)
	if !ok {
		log.Printf("[SECURITY] Warning: No organization context, using system admin context")
		return dbSecurity.WithSystemAdminContext(ctx, fn)
	}

	return dbSecurity.WithOrganizationContext(ctx, *orgCtx, fn)
}

// ValidateOrganizationAccess validates organization access in HTTP context
func ValidateOrganizationAccess(c *gin.Context, targetOrgID int64) error {
	// Get user's organization from context
	userOrgID, exists := c.Get("organization_id")
	if !exists {
		return &SecurityError{
			Code:    "NO_ORGANIZATION_CONTEXT",
			Message: "User has no organization context",
		}
	}

	userOrgIDInt, ok := userOrgID.(int64)
	if !ok {
		return &SecurityError{
			Code:    "INVALID_ORGANIZATION_CONTEXT",
			Message: "Invalid organization context type",
		}
	}

	// Check if user is trying to access their own organization
	if userOrgIDInt != targetOrgID {
		return &SecurityError{
			Code:    "CROSS_ORGANIZATION_ACCESS_DENIED",
			Message: "Cannot access data from different organization",
			Details: map[string]interface{}{
				"user_org_id":   userOrgIDInt,
				"target_org_id": targetOrgID,
			},
		}
	}

	return nil
}

// SecurityError represents a security-related error
type SecurityError struct {
	Code    string                 `json:"code"`
	Message string                 `json:"message"`
	Details map[string]interface{} `json:"details,omitempty"`
}

func (e *SecurityError) Error() string {
	return e.Message
}

// LogSecurityEvent logs security-related events for audit purposes
func LogSecurityEvent(ctx context.Context, event string, details map[string]interface{}) {
	// Extract organization context if available
	if orgCtx, ok := GetOrganizationContext(ctx); ok && orgCtx.OrganizationID != nil {
		details["organization_id"] = *orgCtx.OrganizationID
		details["is_system_admin"] = orgCtx.IsSystemAdmin
	}

	log.Printf("[SECURITY-AUDIT] %s: %+v", event, details)
	// TODO: Send to proper audit logging system
}

// RequireSystemAdmin middleware that requires system admin privileges
func (sm *SecurityMiddleware) RequireSystemAdmin() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Check if user has system admin role
		role, exists := c.Get("user_role")
		if !exists {
			LogSecurityEvent(c.Request.Context(), "UNAUTHORIZED_SYSTEM_ACCESS_ATTEMPT", map[string]interface{}{
				"reason": "no_role_context",
				"path":   c.Request.URL.Path,
			})
			c.JSON(403, gin.H{
				"error": "System admin privileges required",
				"code":  "INSUFFICIENT_PRIVILEGES",
			})
			c.Abort()
			return
		}

		roleStr, ok := role.(string)
		if !ok || roleStr != "admin" {
			LogSecurityEvent(c.Request.Context(), "UNAUTHORIZED_SYSTEM_ACCESS_ATTEMPT", map[string]interface{}{
				"reason":      "insufficient_role",
				"user_role":   roleStr,
				"path":        c.Request.URL.Path,
			})
			c.JSON(403, gin.H{
				"error": "System admin privileges required",
				"code":  "INSUFFICIENT_PRIVILEGES",
			})
			c.Abort()
			return
		}

		LogSecurityEvent(c.Request.Context(), "SYSTEM_ADMIN_ACCESS_GRANTED", map[string]interface{}{
			"path": c.Request.URL.Path,
		})
		c.Next()
	}
}

// TestSecurityMiddleware tests the security middleware integration
func (sm *SecurityMiddleware) TestSecurityMiddleware(ctx context.Context) error {
	log.Printf("[SECURITY] Testing security middleware integration...")
	
	// Test RLS policies
	if err := sm.dbSecurity.TestRLSPolicies(ctx); err != nil {
		return err
	}
	
	log.Printf("[SECURITY] Security middleware integration test completed")
	return nil
}