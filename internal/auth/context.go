package auth

import (
	"context"
)

// Context keys for storing values in request context
type contextKey string

const (
	UserIDContextKey         contextKey = "user_id"
	OrganizationIDContextKey contextKey = "organization_id"
	UserRoleContextKey       contextKey = "user_role"
	SessionIDContextKey      contextKey = "session_id"
)

// GetUserIDFromContext extracts the user ID from the request context
func GetUserIDFromContext(ctx context.Context) (int64, bool) {
	userID, ok := ctx.Value(UserIDContextKey).(int64)
	return userID, ok
}

// SetUserIDInContext sets the user ID in the request context
func SetUserIDInContext(ctx context.Context, userID int64) context.Context {
	return context.WithValue(ctx, UserIDContextKey, userID)
}

// GetOrganizationIDFromContext extracts the organization ID from the request context
func GetOrganizationIDFromContext(ctx context.Context) (int64, bool) {
	orgID, ok := ctx.Value(OrganizationIDContextKey).(int64)
	return orgID, ok
}

// SetOrganizationIDInContext sets the organization ID in the request context
func SetOrganizationIDInContext(ctx context.Context, orgID int64) context.Context {
	return context.WithValue(ctx, OrganizationIDContextKey, orgID)
}

// GetUserRoleFromContext extracts the user role from the request context
func GetUserRoleFromContext(ctx context.Context) (string, bool) {
	role, ok := ctx.Value(UserRoleContextKey).(string)
	return role, ok
}

// SetUserRoleInContext sets the user role in the request context
func SetUserRoleInContext(ctx context.Context, role string) context.Context {
	return context.WithValue(ctx, UserRoleContextKey, role)
}

// GetSessionIDFromContext extracts the session ID from the request context
func GetSessionIDFromContext(ctx context.Context) (string, bool) {
	sessionID, ok := ctx.Value(SessionIDContextKey).(string)
	return sessionID, ok
}

// SetSessionIDInContext sets the session ID in the request context
func SetSessionIDInContext(ctx context.Context, sessionID string) context.Context {
	return context.WithValue(ctx, SessionIDContextKey, sessionID)
}