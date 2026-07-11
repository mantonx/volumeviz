package models

// RolePermissionsV1 is one role's full set of resource/action grants, as
// shown in the Admin Permissions matrix
type RolePermissionsV1 struct {
	Role string `json:"role" example:"operator"`
	// Grants maps "resource:action" (e.g. "volumes:write") to whether the
	// role currently holds that grant
	Grants map[string]bool `json:"grants"`
	// OrgGrants lists which "resource:action" keys are org-specific
	// overrides (toggleable) rather than global built-in defaults
	// (read-only from this API - see PUT /api/v1/permissions)
	OrgGrants map[string]bool `json:"org_grants"`
} // @name RolePermissionsV1

// ListPermissionsResponse is the response body for GET /api/v1/permissions
type ListPermissionsResponse struct {
	Roles     []RolePermissionsV1 `json:"roles"`
	Resources []string            `json:"resources" example:"volumes,scans,files,users,organizations"`
	Actions   []string            `json:"actions" example:"read,write,delete"`
} // @name ListPermissionsResponse

// UpdatePermissionRequest grants or revokes an org-scoped permission for a
// role. Global/built-in default grants cannot be revoked through this
// endpoint - they apply to every organization, so revoking one here would
// silently affect other organizations too.
type UpdatePermissionRequest struct {
	Role     string `json:"role" binding:"required,oneof=admin operator user viewer" example:"operator"`
	Resource string `json:"resource" binding:"required" example:"volumes"`
	Action   string `json:"action" binding:"required,oneof=read write delete" example:"write"`
	Granted  bool   `json:"granted" example:"true"`
} // @name UpdatePermissionRequest
