package auth

import (
	"context"
	"fmt"
	"strings"

	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
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

	// Scan permissions
	PermissionScansRead   Permission = "scans:read"
	PermissionScansWrite  Permission = "scans:write"
	PermissionScansDelete Permission = "scans:delete"

	// Files permissions
	PermissionFilesRead   Permission = "files:read"
	PermissionFilesWrite  Permission = "files:write"
	PermissionFilesDelete Permission = "files:delete"

	// User management permissions
	PermissionUsersRead   Permission = "users:read"
	PermissionUsersWrite  Permission = "users:write"
	PermissionUsersDelete Permission = "users:delete"

	// Organization permissions
	PermissionOrganizationsRead   Permission = "organizations:read"
	PermissionOrganizationsWrite  Permission = "organizations:write"
	PermissionOrganizationsDelete Permission = "organizations:delete"
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

	// GetUserPermissions returns all permissions for a user based on their role
	GetUserPermissions(ctx context.Context, userID int64) (PermissionSet, error)
}

// DefaultPermissionChecker implements role-based permission checking
type DefaultPermissionChecker struct {
	pool    *pgxpool.Pool
	queries *sqlc.Queries
}

// NewPermissionChecker creates a new permission checker
func NewPermissionChecker(pool *pgxpool.Pool) PermissionChecker {
	return &DefaultPermissionChecker{
		pool:    pool,
		queries: sqlc.New(pool),
	}
}

// HasPermission checks if a user has a specific permission based on their role
func (pc *DefaultPermissionChecker) HasPermission(ctx context.Context, userID int64, permission Permission) (bool, error) {
	// Get the user to determine their role
	user, err := pc.queries.GetUserByID(ctx, userID)
	if err != nil {
		return false, fmt.Errorf("failed to get user: %w", err)
	}

	// Parse permission to get resource and action
	resource, action := parsePermission(permission)

	// Check if the user's role has this permission
	hasPermission, err := pc.queries.CheckRolePermission(ctx, sqlc.CheckRolePermissionParams{
		Role:           user.Role,
		Resource:       resource,
		Action:         action,
		OrganizationID: pgtype.Int8{Int64: user.OrganizationID, Valid: true},
	})

	if err != nil {
		return false, fmt.Errorf("failed to check permission: %w", err)
	}

	return hasPermission, nil
}

// GetUserPermissions returns all permissions for a user based on their role
func (pc *DefaultPermissionChecker) GetUserPermissions(ctx context.Context, userID int64) (PermissionSet, error) {
	// Get the user to determine their role
	user, err := pc.queries.GetUserByID(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to get user: %w", err)
	}

	// Get all permissions for the user's role
	permissions, err := pc.queries.GetRolePermissions(ctx, sqlc.GetRolePermissionsParams{
		Role:           user.Role,
		OrganizationID: pgtype.Int8{Int64: user.OrganizationID, Valid: true},
	})

	if err != nil {
		return nil, fmt.Errorf("failed to get role permissions: %w", err)
	}

	// Build permission set
	permSet := make(PermissionSet)
	for _, perm := range permissions {
		permStr := fmt.Sprintf("%s:%s", perm.Resource, perm.Action)
		permSet.Add(Permission(permStr))
	}

	return permSet, nil
}

// parsePermission splits a permission string into resource and action
// Example: "volumes:read" -> ("volumes", "read")
func parsePermission(permission Permission) (string, string) {
	parts := strings.SplitN(string(permission), ":", 2)
	if len(parts) != 2 {
		return "", ""
	}
	return parts[0], parts[1]
}

// NoopPermissionChecker is a no-op implementation for when permissions are disabled
type NoopPermissionChecker struct{}

// NewNoopPermissionChecker creates a new no-op permission checker
func NewNoopPermissionChecker() PermissionChecker {
	return &NoopPermissionChecker{}
}

// HasPermission always returns true
func (pc *NoopPermissionChecker) HasPermission(ctx context.Context, userID int64, permission Permission) (bool, error) {
	return true, nil
}

// GetUserPermissions returns an empty set
func (pc *NoopPermissionChecker) GetUserPermissions(ctx context.Context, userID int64) (PermissionSet, error) {
	return make(PermissionSet), nil
}
