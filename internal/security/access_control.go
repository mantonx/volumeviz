package security

import (
	"context"
	"fmt"
	"log"
	"strings"

	"github.com/gin-gonic/gin"
)

// AccessControlPolicy defines access control rules for resources
type AccessControlPolicy struct {
	ResourceType    string
	RequiredRole    string
	AllowSystemOnly bool
	OrgScopeRequired bool
}

// AccessController manages cross-organization access control
type AccessController struct {
	policies        map[string]AccessControlPolicy
	securityAudit   *SecurityAuditLogger
}

// NewAccessController creates a new access controller
func NewAccessController(securityAudit *SecurityAuditLogger) *AccessController {
	ac := &AccessController{
		policies:      make(map[string]AccessControlPolicy),
		securityAudit: securityAudit,
	}

	// Initialize default policies
	ac.initializeDefaultPolicies()
	
	return ac
}

// initializeDefaultPolicies sets up default access control policies
func (ac *AccessController) initializeDefaultPolicies() {
	// Volume access policies
	ac.policies["volumes:read"] = AccessControlPolicy{
		ResourceType:     "volume",
		OrgScopeRequired: true,
	}
	
	ac.policies["volumes:write"] = AccessControlPolicy{
		ResourceType:     "volume",
		OrgScopeRequired: true,
		RequiredRole:     "operator", // Minimum role for volume modifications
	}
	
	ac.policies["volumes:delete"] = AccessControlPolicy{
		ResourceType:     "volume",
		OrgScopeRequired: true,
		RequiredRole:     "admin",
	}

	// File access policies  
	ac.policies["files:read"] = AccessControlPolicy{
		ResourceType:     "file",
		OrgScopeRequired: true,
	}
	
	ac.policies["files:write"] = AccessControlPolicy{
		ResourceType:     "file",
		OrgScopeRequired: true,
		RequiredRole:     "operator",
	}

	// System-level policies
	ac.policies["system:config"] = AccessControlPolicy{
		ResourceType:    "system",
		AllowSystemOnly: true,
		RequiredRole:    "admin",
	}
	
	ac.policies["organizations:manage"] = AccessControlPolicy{
		ResourceType:    "organization",
		AllowSystemOnly: true,
		RequiredRole:    "admin",
	}

	// User management policies
	ac.policies["users:read"] = AccessControlPolicy{
		ResourceType:     "user",
		OrgScopeRequired: true,
		RequiredRole:     "admin",
	}
	
	ac.policies["users:manage"] = AccessControlPolicy{
		ResourceType:     "user",
		OrgScopeRequired: true,
		RequiredRole:     "admin",
	}
}

// ValidateAccess validates access to a resource with cross-org prevention
func (ac *AccessController) ValidateAccess(ctx context.Context, action string, resourceID string, targetOrgID *int64) error {
	// Get user context
	userID, ok := ctx.Value("user_id").(string)
	if !ok {
		return fmt.Errorf("no user context available")
	}

	// Get organization context
	orgCtx, ok := GetOrganizationContext(ctx)
	if !ok {
		return fmt.Errorf("no organization context available")
	}

	// Get policy for this action
	policy, exists := ac.policies[action]
	if !exists {
		ac.securityAudit.LogAuthorization(ctx, userID, "unknown", action, ResultDenied, map[string]interface{}{
			"reason": "no_policy_defined",
		})
		return fmt.Errorf("no access policy defined for action: %s", action)
	}

	// Check if system-only access is required
	if policy.AllowSystemOnly && !orgCtx.IsSystemAdmin {
		ac.securityAudit.LogAuthorization(ctx, userID, policy.ResourceType, action, ResultDenied, map[string]interface{}{
			"reason": "system_admin_required",
		})
		return fmt.Errorf("system administrator access required for action: %s", action)
	}

	// Check role requirements
	if policy.RequiredRole != "" {
		userRole, ok := ctx.Value("user_role").(string)
		if !ok || !ac.hasRequiredRole(userRole, policy.RequiredRole) {
			ac.securityAudit.LogAuthorization(ctx, userID, policy.ResourceType, action, ResultDenied, map[string]interface{}{
				"reason":        "insufficient_role",
				"required_role": policy.RequiredRole,
				"user_role":     userRole,
			})
			return fmt.Errorf("insufficient role for action: %s (required: %s)", action, policy.RequiredRole)
		}
	}

	// Check organization scope requirements
	if policy.OrgScopeRequired && !orgCtx.IsSystemAdmin {
		if targetOrgID != nil && orgCtx.OrganizationID != nil {
			if *targetOrgID != *orgCtx.OrganizationID {
				// Cross-organization access attempt
				ac.securityAudit.LogCrossOrganizationAccess(ctx, userID, *orgCtx.OrganizationID, *targetOrgID, policy.ResourceType, ResultDenied)
				return fmt.Errorf("cross-organization access denied: user org %d cannot access org %d resource", *orgCtx.OrganizationID, *targetOrgID)
			}
		} else if orgCtx.OrganizationID == nil {
			return fmt.Errorf("user has no organization context for org-scoped resource")
		}
	}

	// Log successful access
	ac.securityAudit.LogAuthorization(ctx, userID, policy.ResourceType, action, ResultSuccess, map[string]interface{}{
		"resource_id": resourceID,
		"target_org":  targetOrgID,
	})

	return nil
}

// hasRequiredRole checks if user role meets minimum requirement
func (ac *AccessController) hasRequiredRole(userRole, requiredRole string) bool {
	// Define role hierarchy
	roleHierarchy := map[string]int{
		"viewer":   1,
		"operator": 2,
		"admin":    3,
	}

	userLevel, userExists := roleHierarchy[userRole]
	requiredLevel, reqExists := roleHierarchy[requiredRole]

	if !userExists || !reqExists {
		return false
	}

	return userLevel >= requiredLevel
}

// CrossOrgAccessPreventionMiddleware prevents cross-organization data access in HTTP requests
func (ac *AccessController) CrossOrgAccessPreventionMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Skip for authentication endpoints
		if strings.HasPrefix(c.Request.URL.Path, "/auth") {
			c.Next()
			return
		}

		// Get user organization
		userOrgID, exists := c.Get("organization_id")
		if !exists {
			log.Printf("[SECURITY] No organization context for user in request to %s", c.Request.URL.Path)
			c.Next()
			return
		}

		// Check for organization ID in path parameters (e.g., /api/v1/orgs/123/volumes)
		if orgParam := c.Param("orgId"); orgParam != "" {
			var paramOrgID int64
			if _, err := fmt.Sscanf(orgParam, "%d", &paramOrgID); err == nil {
				if userOrgIDInt, ok := userOrgID.(int64); ok {
					// Check if user is trying to access different organization
					if userOrgIDInt != paramOrgID {
						ac.logCrossOrgAccessAttempt(c, userOrgIDInt, paramOrgID)
						c.JSON(403, gin.H{
							"error": "Cross-organization access denied",
							"code":  "CROSS_ORG_ACCESS_DENIED",
							"details": gin.H{
								"user_org": userOrgIDInt,
								"target_org": paramOrgID,
							},
						})
						c.Abort()
						return
					}
				}
			}
		}

		// Check for organization ID in query parameters
		if queryOrgID := c.Query("organization_id"); queryOrgID != "" {
			var paramOrgID int64
			if _, err := fmt.Sscanf(queryOrgID, "%d", &paramOrgID); err == nil {
				if userOrgIDInt, ok := userOrgID.(int64); ok {
					if userOrgIDInt != paramOrgID {
						ac.logCrossOrgAccessAttempt(c, userOrgIDInt, paramOrgID)
						c.JSON(403, gin.H{
							"error": "Cross-organization access denied in query parameters",
							"code":  "CROSS_ORG_ACCESS_DENIED",
						})
						c.Abort()
						return
					}
				}
			}
		}

		c.Next()
	}
}

// logCrossOrgAccessAttempt logs cross-organization access attempts
func (ac *AccessController) logCrossOrgAccessAttempt(c *gin.Context, userOrgID, targetOrgID int64) {
	userID, _ := c.Get("user_id")
	userIDStr := ""
	if uid, ok := userID.(string); ok {
		userIDStr = uid
	}

	ac.securityAudit.LogCrossOrganizationAccess(
		c.Request.Context(),
		userIDStr,
		userOrgID,
		targetOrgID,
		c.Request.URL.Path,
		ResultDenied,
	)

	log.Printf("[SECURITY] Cross-organization access attempt: user org %d -> target org %d, path: %s, IP: %s",
		userOrgID, targetOrgID, c.Request.URL.Path, c.ClientIP())
}

// ResourceAccessValidator validates access to specific resource types
type ResourceAccessValidator struct {
	accessController *AccessController
}

// NewResourceAccessValidator creates a new resource access validator
func NewResourceAccessValidator(accessController *AccessController) *ResourceAccessValidator {
	return &ResourceAccessValidator{
		accessController: accessController,
	}
}

// ValidateVolumeAccess validates access to volume resources
func (rav *ResourceAccessValidator) ValidateVolumeAccess(ctx context.Context, volumeID string, action string) error {
	// For volumes, we need to check the volume's organization
	// This would typically involve a database lookup, but for now we'll use a placeholder
	
	return rav.accessController.ValidateAccess(ctx, fmt.Sprintf("volumes:%s", action), volumeID, nil)
}

// ValidateFileAccess validates access to file resources
func (rav *ResourceAccessValidator) ValidateFileAccess(ctx context.Context, fileID string, action string) error {
	return rav.accessController.ValidateAccess(ctx, fmt.Sprintf("files:%s", action), fileID, nil)
}

// ValidateUserAccess validates access to user management
func (rav *ResourceAccessValidator) ValidateUserAccess(ctx context.Context, targetUserID string, action string) error {
	return rav.accessController.ValidateAccess(ctx, fmt.Sprintf("users:%s", action), targetUserID, nil)
}

// ValidateSystemAccess validates access to system-level resources
func (rav *ResourceAccessValidator) ValidateSystemAccess(ctx context.Context, resource string, action string) error {
	return rav.accessController.ValidateAccess(ctx, fmt.Sprintf("system:%s", action), resource, nil)
}

// DataIsolationEnforcer ensures data isolation between organizations
type DataIsolationEnforcer struct {
	validator *ResourceAccessValidator
}

// NewDataIsolationEnforcer creates a new data isolation enforcer
func NewDataIsolationEnforcer(validator *ResourceAccessValidator) *DataIsolationEnforcer {
	return &DataIsolationEnforcer{
		validator: validator,
	}
}

// EnforceVolumeIsolation ensures volume data isolation
func (die *DataIsolationEnforcer) EnforceVolumeIsolation(c *gin.Context) {
	// Extract volume ID from path
	volumeID := c.Param("volumeId")
	if volumeID == "" {
		volumeID = c.Param("id")
	}
	
	if volumeID != "" {
		// Determine action based on HTTP method
		action := "read"
		switch c.Request.Method {
		case "POST":
			action = "write"
		case "PUT", "PATCH":
			action = "write"  
		case "DELETE":
			action = "delete"
		}

		// Validate access
		if err := die.validator.ValidateVolumeAccess(c.Request.Context(), volumeID, action); err != nil {
			c.JSON(403, gin.H{
				"error": "Access denied",
				"code":  "RESOURCE_ACCESS_DENIED",
				"details": err.Error(),
			})
			c.Abort()
			return
		}
	}
}

// EnforceFileIsolation ensures file data isolation
func (die *DataIsolationEnforcer) EnforceFileIsolation(c *gin.Context) {
	fileID := c.Param("fileId")
	if fileID == "" {
		fileID = c.Param("id")
	}
	
	if fileID != "" {
		action := "read"
		if c.Request.Method != "GET" {
			action = "write"
		}

		if err := die.validator.ValidateFileAccess(c.Request.Context(), fileID, action); err != nil {
			c.JSON(403, gin.H{
				"error": "Access denied", 
				"code":  "RESOURCE_ACCESS_DENIED",
				"details": err.Error(),
			})
			c.Abort()
			return
		}
	}
}

// GetAccessControlMetrics returns access control metrics
func (ac *AccessController) GetAccessControlMetrics(ctx context.Context) map[string]interface{} {
	// TODO: Implement metrics collection
	return map[string]interface{}{
		"total_policies": len(ac.policies),
		"policies":       ac.policies,
	}
}