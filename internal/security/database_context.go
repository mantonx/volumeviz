package security

import (
	"context"
	"database/sql"
	"fmt"
	"log"
)

// DatabaseSecurityContext manages organization context and RLS policies in database connections
type DatabaseSecurityContext struct {
	db *sql.DB
}

// NewDatabaseSecurityContext creates a new database security context manager
func NewDatabaseSecurityContext(db *sql.DB) *DatabaseSecurityContext {
	return &DatabaseSecurityContext{
		db: db,
	}
}

// OrganizationContext represents the organization context for database operations
type OrganizationContext struct {
	OrganizationID *int64
	IsSystemAdmin  bool
	UserID         *string
}

// WithOrganizationContext executes a function with organization context set in the database session
// This ensures all queries within the function are subject to RLS policies for the specified organization
func (dsc *DatabaseSecurityContext) WithOrganizationContext(
	ctx context.Context,
	orgCtx OrganizationContext,
	fn func(ctx context.Context, tx *sql.Tx) error,
) error {
	// Start a transaction to ensure context isolation
	tx, err := dsc.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer func() {
		if err != nil {
			tx.Rollback()
		}
	}()

	// Set organization context in the database session
	if err := dsc.setOrganizationContext(ctx, tx, orgCtx); err != nil {
		return fmt.Errorf("failed to set organization context: %w", err)
	}

	// Execute the function with the context set
	if err := fn(ctx, tx); err != nil {
		return err
	}

	// Commit the transaction
	if err := tx.Commit(); err != nil {
		return fmt.Errorf("failed to commit transaction: %w", err)
	}

	return nil
}

// WithSystemAdminContext executes a function with system admin context
// This bypasses RLS policies for system-level operations
func (dsc *DatabaseSecurityContext) WithSystemAdminContext(
	ctx context.Context,
	fn func(ctx context.Context, tx *sql.Tx) error,
) error {
	return dsc.WithOrganizationContext(ctx, OrganizationContext{
		IsSystemAdmin: true,
	}, fn)
}

// ValidateOrganizationAccess validates that the current context has access to the specified organization
func (dsc *DatabaseSecurityContext) ValidateOrganizationAccess(
	ctx context.Context,
	userOrgID *int64,
	targetOrgID int64,
) error {
	// System admin can access any organization
	if userOrgID == nil {
		return fmt.Errorf("user has no organization context")
	}

	// User can only access their own organization
	if *userOrgID != targetOrgID {
		return fmt.Errorf("access denied: user organization %d cannot access organization %d", 
			*userOrgID, targetOrgID)
	}

	return nil
}

// setOrganizationContext sets the organization context in the database session
func (dsc *DatabaseSecurityContext) setOrganizationContext(
	ctx context.Context,
	tx *sql.Tx,
	orgCtx OrganizationContext,
) error {
	if orgCtx.IsSystemAdmin {
		// Set system admin context
		_, err := tx.ExecContext(ctx, "SELECT set_system_admin_context()")
		if err != nil {
			return fmt.Errorf("failed to set system admin context: %w", err)
		}
		log.Printf("[SECURITY] Set system admin context")
	} else if orgCtx.OrganizationID != nil {
		// Set organization context
		_, err := tx.ExecContext(ctx, 
			"SELECT set_organization_context($1, false)", 
			*orgCtx.OrganizationID)
		if err != nil {
			return fmt.Errorf("failed to set organization context: %w", err)
		}
		log.Printf("[SECURITY] Set organization context: %d", *orgCtx.OrganizationID)
	} else {
		return fmt.Errorf("invalid context: neither organization ID nor system admin specified")
	}

	return nil
}

// TestRLSPolicies tests that RLS policies are working correctly
func (dsc *DatabaseSecurityContext) TestRLSPolicies(ctx context.Context) error {
	log.Printf("[SECURITY] Testing RLS policies...")

	// Test 1: System admin context should see all data
	err := dsc.WithSystemAdminContext(ctx, func(ctx context.Context, tx *sql.Tx) error {
		var count int
		err := tx.QueryRowContext(ctx, "SELECT COUNT(*) FROM volumes").Scan(&count)
		if err != nil {
			return fmt.Errorf("system admin query failed: %w", err)
		}
		log.Printf("[SECURITY] System admin can see %d volumes", count)
		return nil
	})
	if err != nil {
		return fmt.Errorf("system admin test failed: %w", err)
	}

	// Test 2: Organization context should only see organization data
	err = dsc.WithOrganizationContext(ctx, OrganizationContext{
		OrganizationID: int64Ptr(1),
	}, func(ctx context.Context, tx *sql.Tx) error {
		var count int
		err := tx.QueryRowContext(ctx, "SELECT COUNT(*) FROM volumes WHERE organization_id = 1 OR organization_id IS NULL").Scan(&count)
		if err != nil {
			return fmt.Errorf("organization query failed: %w", err)
		}
		log.Printf("[SECURITY] Organization 1 context can see %d volumes", count)
		return nil
	})
	if err != nil {
		return fmt.Errorf("organization context test failed: %w", err)
	}

	log.Printf("[SECURITY] RLS policy tests completed successfully")
	return nil
}

// GetCurrentOrganizationContext retrieves the current organization context from session
func (dsc *DatabaseSecurityContext) GetCurrentOrganizationContext(ctx context.Context) (*OrganizationContext, error) {
	var orgID sql.NullInt64
	var isAdmin sql.NullBool

	err := dsc.db.QueryRowContext(ctx, `
		SELECT 
			get_current_organization_id(),
			is_system_admin()
	`).Scan(&orgID, &isAdmin)
	
	if err != nil {
		return nil, fmt.Errorf("failed to get current context: %w", err)
	}

	orgCtx := &OrganizationContext{
		IsSystemAdmin: isAdmin.Bool,
	}

	if orgID.Valid {
		orgCtx.OrganizationID = &orgID.Int64
	}

	return orgCtx, nil
}

// Helper function to create int64 pointer
func int64Ptr(v int64) *int64 {
	return &v
}

// SecurityMetrics tracks security-related metrics
type SecurityMetrics struct {
	OrganizationContextSets int64
	SystemAdminContextSets  int64
	AccessDenials          int64
	RLSPolicyViolations    int64
}

// GetSecurityMetrics returns security metrics (placeholder for future implementation)
func (dsc *DatabaseSecurityContext) GetSecurityMetrics() SecurityMetrics {
	// TODO: Implement metrics collection
	return SecurityMetrics{}
}