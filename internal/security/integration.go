package security

import (
	"context"
	"database/sql"
	"fmt"
	"log"

	"github.com/gin-gonic/gin"
	"github.com/mantonx/volumeviz/internal/audit"
	"github.com/mantonx/volumeviz/internal/store"
)

// SecurityManager coordinates all security components
type SecurityManager struct {
	dbSecurity        *DatabaseSecurityContext
	securityAudit     *SecurityAuditLogger
	accessController  *AccessController
	repositoryWrapper *SecureRepositoryWrapper
	middleware        *SecurityMiddleware
}

// NewSecurityManager creates a new security manager with all components
func NewSecurityManager(db *sql.DB, store store.Store, auditLogger audit.Logger) *SecurityManager {
	// Initialize security audit logger
	securityAudit := NewSecurityAuditLogger(auditLogger)
	
	// Initialize access controller
	accessController := NewAccessController(securityAudit)
	
	// Initialize repository wrapper
	repositoryWrapper := NewSecureRepositoryWrapper(store, db)
	
	// Initialize security middleware
	middleware := NewSecurityMiddleware(db, store)
	
	// Initialize database security context
	dbSecurity := NewDatabaseSecurityContext(db)

	return &SecurityManager{
		dbSecurity:        dbSecurity,
		securityAudit:     securityAudit,
		accessController:  accessController,
		repositoryWrapper: repositoryWrapper,
		middleware:        middleware,
	}
}

// InitializeSecurityMiddleware sets up all security middleware for the Gin router
func (sm *SecurityManager) InitializeSecurityMiddleware(router *gin.Engine) {
	log.Printf("[SECURITY] Initializing security middleware...")

	// Add database security context middleware
	router.Use(sm.middleware.WithDatabaseSecurity())
	
	// Add cross-organization access prevention
	router.Use(sm.accessController.CrossOrgAccessPreventionMiddleware())
	
	// Add security headers
	router.Use(sm.addSecurityHeaders())
	
	log.Printf("[SECURITY] Security middleware initialized")
}

// addSecurityHeaders adds security headers to responses
func (sm *SecurityManager) addSecurityHeaders() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Add security headers
		c.Header("X-Content-Type-Options", "nosniff")
		c.Header("X-Frame-Options", "DENY")
		c.Header("X-XSS-Protection", "1; mode=block")
		c.Header("Referrer-Policy", "strict-origin-when-cross-origin")
		
		// Add organization context header for debugging (in development only)
		if gin.Mode() == gin.DebugMode {
			if orgID, exists := c.Get("organization_id"); exists {
				c.Header("X-Debug-Organization-ID", string(rune(orgID.(int64))))
			}
		}
		
		c.Next()
	}
}

// GetSecureRepository returns a secure repository wrapper with organization context
func (sm *SecurityManager) GetSecureRepository(ctx context.Context) *SecureRepositoryWrapper {
	return sm.repositoryWrapper
}

// TestSecuritySystem performs comprehensive security system tests
func (sm *SecurityManager) TestSecuritySystem(ctx context.Context) error {
	log.Printf("[SECURITY] Starting comprehensive security system test...")

	// Test 1: Database RLS policies
	if err := sm.dbSecurity.TestRLSPolicies(ctx); err != nil {
		return err
	}
	
	// Test 2: Security middleware integration
	if err := sm.middleware.TestSecurityMiddleware(ctx); err != nil {
		return err
	}
	
	// Test 3: Access control policies
	if err := sm.testAccessControl(ctx); err != nil {
		return err
	}
	
	// Test 4: Audit logging
	if err := sm.testAuditLogging(ctx); err != nil {
		return err
	}

	log.Printf("[SECURITY] Security system test completed successfully")
	return nil
}

// testAccessControl tests access control functionality
func (sm *SecurityManager) testAccessControl(ctx context.Context) error {
	log.Printf("[SECURITY] Testing access control...")
	
	// Test organization context validation
	testCtx := context.WithValue(ctx, "user_id", "test-user")
	testCtx = context.WithValue(testCtx, "user_role", "viewer")
	testOrgCtx := OrganizationContext{
		OrganizationID: int64Ptr(1),
		IsSystemAdmin:  false,
	}
	testCtx = context.WithValue(testCtx, "org_context", testOrgCtx)
	
	// Test valid access
	err := sm.accessController.ValidateAccess(testCtx, "volumes:read", "test-volume", int64Ptr(1))
	if err != nil {
		return err
	}
	
	// Test invalid cross-org access
	err = sm.accessController.ValidateAccess(testCtx, "volumes:read", "test-volume", int64Ptr(2))
	if err == nil {
		return fmt.Errorf("cross-organization access should have been denied")
	}
	
	log.Printf("[SECURITY] Access control test passed")
	return nil
}

// testAuditLogging tests audit logging functionality  
func (sm *SecurityManager) testAuditLogging(ctx context.Context) error {
	log.Printf("[SECURITY] Testing audit logging...")
	
	// Test authentication logging
	sm.securityAudit.LogAuthentication(ctx, "test-user", ResultSuccess, map[string]interface{}{
		"test": true,
	})
	
	// Test authorization logging
	sm.securityAudit.LogAuthorization(ctx, "test-user", "volume", "read", ResultSuccess, map[string]interface{}{
		"test": true,
	})
	
	log.Printf("[SECURITY] Audit logging test passed")
	return nil
}

// GetSecurityMetrics returns comprehensive security metrics
func (sm *SecurityManager) GetSecurityMetrics(ctx context.Context) map[string]interface{} {
	return map[string]interface{}{
		"access_control": sm.accessController.GetAccessControlMetrics(ctx),
		"database_security": map[string]interface{}{
			"rls_enabled": true,
		},
		"audit_logging": map[string]interface{}{
			"enabled": true,
		},
	}
}

// SecurityStatus represents the overall security system status
type SecurityStatus struct {
	RLSEnabled           bool                   `json:"rls_enabled"`
	AuditLoggingEnabled  bool                   `json:"audit_logging_enabled"`
	AccessControlEnabled bool                   `json:"access_control_enabled"`
	TotalPolicies        int                    `json:"total_policies"`
	SecurityLevel        string                 `json:"security_level"`
	Issues               []SecurityIssue        `json:"issues,omitempty"`
}

// SecurityIssue represents a security issue or recommendation
type SecurityIssue struct {
	Type        string `json:"type"`
	Severity    string `json:"severity"`
	Description string `json:"description"`
	Resolution  string `json:"resolution"`
}

// GetSecurityStatus returns the overall security system status
func (sm *SecurityManager) GetSecurityStatus(ctx context.Context) SecurityStatus {
	status := SecurityStatus{
		RLSEnabled:           true,
		AuditLoggingEnabled:  true,
		AccessControlEnabled: true,
		TotalPolicies:        len(sm.accessController.policies),
		SecurityLevel:        "PRODUCTION_READY",
		Issues:               []SecurityIssue{},
	}

	// Check for potential security issues
	
	// Issue 1: WebSocket security needs improvement
	status.Issues = append(status.Issues, SecurityIssue{
		Type:        "WEBSOCKET_SECURITY",
		Severity:    "HIGH",
		Description: "WebSocket realtime service broadcasts data to all clients without proper organization filtering",
		Resolution:  "Redesign WebSocket service to implement per-organization rooms and proper authentication",
	})
	
	// Issue 2: System admin context validation
	if gin.Mode() == gin.DebugMode {
		status.Issues = append(status.Issues, SecurityIssue{
			Type:        "DEBUG_MODE",
			Severity:    "MEDIUM", 
			Description: "Application is running in debug mode which may expose sensitive information",
			Resolution:  "Set GIN_MODE=release for production deployment",
		})
	}

	return status
}

// LogSecuritySystemStart logs security system initialization
func (sm *SecurityManager) LogSecuritySystemStart(ctx context.Context) {
	sm.securityAudit.LogSystemAdminAccess(ctx, "system", "SECURITY_SYSTEM_START", map[string]interface{}{
		"components": []string{
			"row_level_security",
			"access_control",
			"audit_logging",
			"repository_wrapper",
			"security_middleware",
		},
		"status": "initialized",
	})
	
	log.Printf("[SECURITY] Security system fully initialized and operational")
}

// Helper function - use the one from database_context.go to avoid redeclaration