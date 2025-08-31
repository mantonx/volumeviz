package auth

import (
	"context"
	"fmt"
	"net/http"

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

// Stub implementations - TODO: Replace with actual SQLC-generated methods

func (pc *DefaultPermissionChecker) HasPermission(ctx context.Context, userID int64, permission Permission) (bool, error) {
	// TODO: Implement when SQLC generates the methods
	// For now, allow admin-level permissions for testing
	return true, nil
}

func (pc *DefaultPermissionChecker) HasPermissionForResource(ctx context.Context, userID int64, permission Permission, resourceID string) (bool, error) {
	// TODO: Implement when SQLC generates the methods
	// For now, allow admin-level permissions for testing
	return true, nil
}

func (pc *DefaultPermissionChecker) GetUserPermissions(ctx context.Context, userID int64) (PermissionSet, error) {
	// TODO: Implement when SQLC generates the methods
	// For now, return all permissions for testing
	permissions := make(PermissionSet)
	allPerms := []Permission{
		PermissionVolumesRead, PermissionVolumesWrite, PermissionVolumesDelete, PermissionVolumesScan,
		PermissionScansRead, PermissionScansWrite, PermissionScansDelete,
		PermissionUsersRead, PermissionUsersWrite, PermissionUsersDelete,
		PermissionOrganizationRead, PermissionOrganizationWrite, PermissionOrganizationAdmin,
		PermissionSettingsRead, PermissionSettingsWrite,
		PermissionAlertsRead, PermissionAlertsWrite,
		PermissionSearchRead, PermissionSearchWrite,
		PermissionDockerRead, PermissionDockerWrite,
	}
	
	for _, perm := range allPerms {
		permissions.Add(perm)
	}
	
	return permissions, nil
}

func (pc *DefaultPermissionChecker) GrantPermission(ctx context.Context, userID int64, permission Permission, grantedBy int64, resourceID *string) error {
	// TODO: Implement when SQLC generates the methods
	return fmt.Errorf("GrantPermission not implemented yet - waiting for SQLC generation")
}

func (pc *DefaultPermissionChecker) RevokePermission(ctx context.Context, userID int64, permission Permission, resourceID *string) error {
	// TODO: Implement when SQLC generates the methods
	return fmt.Errorf("RevokePermission not implemented yet - waiting for SQLC generation")
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