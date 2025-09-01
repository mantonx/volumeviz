package auth

import (
	"context"
	"fmt"
	"net/http"
	"strings"

	"github.com/jackc/pgx/v5/pgtype"
	"github.com/mantonx/volumeviz/internal/db/sqlc"
)

// Permission represents a system permission
type Permission string

// Define all system permissions as constants
const (
	// Volume permissions
	PermissionVolumesRead   Permission = "volumes:read"
	PermissionVolumesWrite  Permission = "volumes:write"
	PermissionVolumesDelete Permission = "volumes:delete"
	PermissionVolumesScan   Permission = "volumes:scan"

	// Scan permissions
	PermissionScansRead   Permission = "scans:read"
	PermissionScansWrite  Permission = "scans:write"
	PermissionScansDelete Permission = "scans:delete"

	// User management permissions
	PermissionUsersRead   Permission = "users:read"
	PermissionUsersWrite  Permission = "users:write"
	PermissionUsersDelete Permission = "users:delete"

	// Organization permissions
	PermissionOrganizationRead  Permission = "organization:read"
	PermissionOrganizationWrite Permission = "organization:write"
	PermissionOrganizationAdmin Permission = "organization:admin"

	// Settings permissions
	PermissionSettingsRead  Permission = "settings:read"
	PermissionSettingsWrite Permission = "settings:write"

	// Alert permissions
	PermissionAlertsRead  Permission = "alerts:read"
	PermissionAlertsWrite Permission = "alerts:write"

	// Search permissions
	PermissionSearchRead  Permission = "search:read"
	PermissionSearchWrite Permission = "search:write"

	// Docker permissions
	PermissionDockerRead  Permission = "docker:read"
	PermissionDockerWrite Permission = "docker:write"
)

// PermissionSet represents a collection of permissions
type PermissionSet map[Permission]bool

// Has checks if the set contains a specific permission
func (ps PermissionSet) Has(permission Permission) bool {
	return ps[permission]
}

// Add adds a permission to the set
func (ps PermissionSet) Add(permission Permission) {
	ps[permission] = true
}

// Remove removes a permission from the set
func (ps PermissionSet) Remove(permission Permission) {
	delete(ps, permission)
}

// List returns all permissions in the set
func (ps PermissionSet) List() []Permission {
	permissions := make([]Permission, 0, len(ps))
	for permission := range ps {
		permissions = append(permissions, permission)
	}
	return permissions
}

// PermissionChecker interface for checking user permissions
type PermissionChecker interface {
	// HasPermission checks if a user has a specific permission
	HasPermission(ctx context.Context, userID int64, permission Permission) (bool, error)
	
	// HasPermissionForResource checks if a user has permission for a specific resource
	HasPermissionForResource(ctx context.Context, userID int64, permission Permission, resourceID string) (bool, error)
	
	// GetUserPermissions returns all permissions for a user
	GetUserPermissions(ctx context.Context, userID int64) (PermissionSet, error)
	
	// GrantPermission grants a permission to a user
	GrantPermission(ctx context.Context, userID int64, permission Permission, grantedBy int64, resourceID *string) error
	
	// RevokePermission revokes a permission from a user
	RevokePermission(ctx context.Context, userID int64, permission Permission, resourceID *string) error
}

// DefaultPermissionChecker implements PermissionChecker with stub methods
type DefaultPermissionChecker struct {
	queries *sqlc.Queries
}

// NewPermissionChecker creates a new permission checker
func NewPermissionChecker(queries *sqlc.Queries) PermissionChecker {
	return &DefaultPermissionChecker{
		queries: queries,
	}
}

// SQLC-based implementations

func (pc *DefaultPermissionChecker) HasPermission(ctx context.Context, userID int64, permission Permission) (bool, error) {
	// Parse permission to get resource and action
	resource, action := parsePermission(permission)
	
	// Get the permission record
	perm, err := pc.queries.GetPermissionByResourceAction(ctx, sqlc.GetPermissionByResourceActionParams{
		Resource: resource,
		Action:   action,
	})
	if err != nil {
		// If permission doesn't exist, check role-based permissions
		return pc.checkRoleBasedPermission(ctx, userID, permission)
	}
	
	// Check user-specific permission override
	userPerm, err := pc.queries.CheckUserPermission(ctx, sqlc.CheckUserPermissionParams{
		UserID:       userID,
		PermissionID: perm.ID,
		ResourceID:   pgtype.Text{}, // NULL for general permissions
	})
	if err == nil {
		return userPerm.Granted, nil
	}
	
	// Fall back to role-based permissions
	return pc.checkRoleBasedPermission(ctx, userID, permission)
}

func (pc *DefaultPermissionChecker) HasPermissionForResource(ctx context.Context, userID int64, permission Permission, resourceID string) (bool, error) {
	// Parse permission to get resource and action
	resource, action := parsePermission(permission)
	
	// Get the permission record
	perm, err := pc.queries.GetPermissionByResourceAction(ctx, sqlc.GetPermissionByResourceActionParams{
		Resource: resource,
		Action:   action,
	})
	if err != nil {
		// If permission doesn't exist, check role-based permissions
		return pc.checkRoleBasedPermission(ctx, userID, permission)
	}
	
	// Check user-specific permission for this resource
	userPerm, err := pc.queries.CheckUserPermission(ctx, sqlc.CheckUserPermissionParams{
		UserID:       userID,
		PermissionID: perm.ID,
		ResourceID:   pgtype.Text{String: resourceID, Valid: true},
	})
	if err == nil {
		return userPerm.Granted, nil
	}
	
	// Fall back to general permission check
	return pc.HasPermission(ctx, userID, permission)
}

func (pc *DefaultPermissionChecker) GetUserPermissions(ctx context.Context, userID int64) (PermissionSet, error) {
	permissions := make(PermissionSet)
	
	// Get user-specific permissions
	userPerms, err := pc.queries.GetUserPermissions(ctx, userID)
	if err == nil {
		for _, perm := range userPerms {
			if perm.Granted {
				permissions.Add(Permission(perm.Name))
			}
		}
	}
	
	// Get role-based permissions
	user, err := pc.queries.GetUserByID(ctx, userID)
	if err != nil {
		return permissions, err
	}
	
	rolePerms, err := pc.queries.GetRolePermissions(ctx, string(user.Role))
	if err == nil {
		for _, perm := range rolePerms {
			permissions.Add(Permission(perm))
		}
	}
	
	return permissions, nil
}

func (pc *DefaultPermissionChecker) GrantPermission(ctx context.Context, userID int64, permission Permission, grantedBy int64, resourceID *string) error {
	// Parse permission to get resource and action
	resource, action := parsePermission(permission)
	
	// Get the permission record
	perm, err := pc.queries.GetPermissionByResourceAction(ctx, sqlc.GetPermissionByResourceActionParams{
		Resource: resource,
		Action:   action,
	})
	if err != nil {
		return fmt.Errorf("permission not found: %w", err)
	}
	
	// Convert resourceID to pgtype.Text
	var resourceIDText pgtype.Text
	if resourceID != nil {
		resourceIDText = pgtype.Text{String: *resourceID, Valid: true}
	}
	
	// Grant the permission
	return pc.queries.GrantUserPermission(ctx, sqlc.GrantUserPermissionParams{
		UserID:       userID,
		PermissionID: perm.ID,
		Granted:      true,
		GrantedBy:    pgtype.Int8{Int64: grantedBy, Valid: true},
		ResourceID:   resourceIDText,
	})
}

func (pc *DefaultPermissionChecker) RevokePermission(ctx context.Context, userID int64, permission Permission, resourceID *string) error {
	// Parse permission to get resource and action
	resource, action := parsePermission(permission)
	
	// Get the permission record
	perm, err := pc.queries.GetPermissionByResourceAction(ctx, sqlc.GetPermissionByResourceActionParams{
		Resource: resource,
		Action:   action,
	})
	if err != nil {
		return fmt.Errorf("permission not found: %w", err)
	}
	
	// Convert resourceID to pgtype.Text
	var resourceIDText pgtype.Text
	if resourceID != nil {
		resourceIDText = pgtype.Text{String: *resourceID, Valid: true}
	}
	
	// Revoke the permission
	return pc.queries.RevokeUserPermission(ctx, sqlc.RevokeUserPermissionParams{
		UserID:       userID,
		PermissionID: perm.ID,
		ResourceID:   resourceIDText,
	})
}

// RequirePermission is a middleware function that checks if the current user has a specific permission
func RequirePermission(checker PermissionChecker, permission Permission) func(next http.HandlerFunc) http.HandlerFunc {
	return func(next http.HandlerFunc) http.HandlerFunc {
		return func(w http.ResponseWriter, r *http.Request) {
			// Get user ID from context (set by auth middleware)
			userID, ok := GetUserIDFromContext(r.Context())
			if !ok {
				http.Error(w, "Unauthorized", http.StatusUnauthorized)
				return
			}

			// Check permission
			hasPermission, err := checker.HasPermission(r.Context(), userID, permission)
			if err != nil {
				http.Error(w, "Internal Server Error", http.StatusInternalServerError)
				return
			}

			if !hasPermission {
				http.Error(w, "Forbidden", http.StatusForbidden)
				return
			}

			next(w, r)
		}
	}
}

// Helper functions

// parsePermission splits a permission string like "volumes:read" into resource and action
func parsePermission(permission Permission) (resource, action string) {
	parts := strings.Split(string(permission), ":")
	if len(parts) != 2 {
		return "unknown", "unknown"
	}
	return parts[0], parts[1]
}

// checkRoleBasedPermission checks if user has permission based on their role
func (pc *DefaultPermissionChecker) checkRoleBasedPermission(ctx context.Context, userID int64, permission Permission) (bool, error) {
	// Get user to check their role
	user, err := pc.queries.GetUserByID(ctx, userID)
	if err != nil {
		return false, err
	}
	
	// Get permissions for this role
	rolePerms, err := pc.queries.GetRolePermissions(ctx, string(user.Role))
	if err != nil {
		return false, err
	}
	
	// Check if permission is in role permissions
	for _, perm := range rolePerms {
		if Permission(perm) == permission {
			return true, nil
		}
	}
	
	return false, nil
}

// RequirePermissionForResource checks permission for a specific resource
func RequirePermissionForResource(checker PermissionChecker, permission Permission, getResourceID func(r *http.Request) string) func(next http.HandlerFunc) http.HandlerFunc {
	return func(next http.HandlerFunc) http.HandlerFunc {
		return func(w http.ResponseWriter, r *http.Request) {
			// Get user ID from context
			userID, ok := GetUserIDFromContext(r.Context())
			if !ok {
				http.Error(w, "Unauthorized", http.StatusUnauthorized)
				return
			}

			// Get resource ID
			resourceID := getResourceID(r)

			// Check permission
			hasPermission, err := checker.HasPermissionForResource(r.Context(), userID, permission, resourceID)
			if err != nil {
				http.Error(w, "Internal Server Error", http.StatusInternalServerError)
				return
			}

			if !hasPermission {
				http.Error(w, "Forbidden", http.StatusForbidden)
				return
			}

			next(w, r)
		}
	}
}
