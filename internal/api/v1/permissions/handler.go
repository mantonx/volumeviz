package permissions

import (
	"context"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/mantonx/volumeviz/internal/api/middleware"
	"github.com/mantonx/volumeviz/internal/api/models"
	"github.com/mantonx/volumeviz/internal/db/sqlc"
)

// Queries is the subset of *sqlc.Queries this handler needs, narrowed to
// keep the handler unit-testable with a lightweight mock instead of a real
// Postgres connection.
type Queries interface {
	ListPermissionsByOrg(ctx context.Context, organizationID pgtype.Int8) ([]sqlc.Permissions, error)
	CreatePermission(ctx context.Context, arg sqlc.CreatePermissionParams) (sqlc.Permissions, error)
	CheckRolePermission(ctx context.Context, arg sqlc.CheckRolePermissionParams) (bool, error)
	DeleteOrgRolePermission(ctx context.Context, arg sqlc.DeleteOrgRolePermissionParams) error
}

// Handler handles roles/permissions API requests
type Handler struct {
	queries Queries
}

// NewHandler creates a new permissions handler
func NewHandler(queries Queries) *Handler {
	return &Handler{queries: queries}
}

// roles are the fixed role names the app's authorization middleware
// actually checks (see internal/api/middleware/auth.go's hasRequiredRole) -
// this page manages grants for these roles, not arbitrary custom roles
var roles = []string{"admin", "operator", "user", "viewer"}

// resources and actions are derived from what's actually seeded/used in the
// permissions table (see migration 000012) - kept as an explicit list here
// (rather than queried) so every role/resource/action combination renders
// in the matrix even if a given role has zero grants for it yet (e.g.
// "operator" currently has no seeded rows at all)
var resources = []string{"volumes", "scans", "files", "users", "organizations"}
var actions = []string{"read", "write", "delete"}

func grantKey(resource, action string) string {
	return resource + ":" + action
}

// ListPermissions returns the full role/resource/action permission matrix
// for the current organization
// @Summary List roles and permissions
// @Description Get the full permission matrix (which roles can do what) for the current organization, including org-specific overrides and global defaults. Admin only.
// @Tags permissions
// @Accept json
// @Produce json
// @Success 200 {object} models.ListPermissionsResponse
// @Failure 500 {object} map[string]interface{} "Internal server error"
// @Router /api/v1/permissions [get]
func (h *Handler) ListPermissions(c *gin.Context) {
	orgID, ok := middleware.GetOrganizationID(c.Request.Context())
	if !ok {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "No organization context for this request",
			"code":  "ORGANIZATION_CONTEXT_MISSING",
		})
		return
	}

	rows, err := h.queries.ListPermissionsByOrg(c.Request.Context(), pgtype.Int8{Int64: orgID, Valid: true})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "Failed to list permissions",
			"code":    "PERMISSIONS_LIST_ERROR",
			"message": err.Error(),
		})
		return
	}

	byRole := make(map[string]models.RolePermissionsV1, len(roles))
	for _, role := range roles {
		byRole[role] = models.RolePermissionsV1{
			Role:      role,
			Grants:    make(map[string]bool),
			OrgGrants: make(map[string]bool),
		}
	}

	for _, row := range rows {
		rp, ok := byRole[row.Role]
		if !ok {
			continue
		}
		key := grantKey(row.Resource, row.Action)
		rp.Grants[key] = true
		if row.OrganizationID.Valid {
			rp.OrgGrants[key] = true
		}
	}

	response := models.ListPermissionsResponse{
		Roles:     make([]models.RolePermissionsV1, len(roles)),
		Resources: resources,
		Actions:   actions,
	}
	for i, role := range roles {
		response.Roles[i] = byRole[role]
	}

	c.JSON(http.StatusOK, response)
}

// UpdatePermission grants or revokes an org-scoped permission for a role
// @Summary Update a role permission
// @Description Grant or revoke an org-scoped permission for a role. Global/built-in default grants cannot be revoked here. Admin only.
// @Tags permissions
// @Accept json
// @Produce json
// @Param request body models.UpdatePermissionRequest true "Permission update"
// @Success 200 {object} map[string]interface{}
// @Failure 400 {object} map[string]interface{} "Invalid request"
// @Failure 409 {object} map[string]interface{} "Cannot revoke a global default permission"
// @Failure 500 {object} map[string]interface{} "Internal server error"
// @Router /api/v1/permissions [put]
func (h *Handler) UpdatePermission(c *gin.Context) {
	var req models.UpdatePermissionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "Invalid request body",
			"code":    "INVALID_REQUEST",
			"message": err.Error(),
		})
		return
	}

	orgID, ok := middleware.GetOrganizationID(c.Request.Context())
	if !ok {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "No organization context for this request",
			"code":  "ORGANIZATION_CONTEXT_MISSING",
		})
		return
	}
	orgIDParam := pgtype.Int8{Int64: orgID, Valid: true}

	if req.Granted {
		_, err := h.queries.CreatePermission(c.Request.Context(), sqlc.CreatePermissionParams{
			Role:           req.Role,
			Resource:       req.Resource,
			Action:         req.Action,
			OrganizationID: orgIDParam,
		})
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error":   "Failed to grant permission",
				"code":    "PERMISSION_GRANT_ERROR",
				"message": err.Error(),
			})
			return
		}
		c.JSON(http.StatusOK, gin.H{"granted": true})
		return
	}

	// Revoking: only an org-scoped row can be safely deleted here - a
	// global (organization_id IS NULL) row is a built-in default shared by
	// every organization, and this handler has no way to revoke it for just
	// the current org without affecting the rest of the deployment.
	hasGlobal, err := h.queries.CheckRolePermission(c.Request.Context(), sqlc.CheckRolePermissionParams{
		Role:           req.Role,
		Resource:       req.Resource,
		Action:         req.Action,
		OrganizationID: pgtype.Int8{},
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "Failed to check existing permission",
			"code":    "PERMISSION_CHECK_ERROR",
			"message": err.Error(),
		})
		return
	}
	if hasGlobal {
		c.JSON(http.StatusConflict, gin.H{
			"error":   "Cannot revoke a global default permission",
			"code":    "PERMISSION_GLOBAL_DEFAULT",
			"message": "This grant comes from a built-in default shared by every organization and can't be revoked here",
		})
		return
	}

	if err := h.queries.DeleteOrgRolePermission(c.Request.Context(), sqlc.DeleteOrgRolePermissionParams{
		Role:           req.Role,
		Resource:       req.Resource,
		Action:         req.Action,
		OrganizationID: orgIDParam,
	}); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "Failed to revoke permission",
			"code":    "PERMISSION_REVOKE_ERROR",
			"message": err.Error(),
		})
		return
	}
	c.JSON(http.StatusOK, gin.H{"granted": false})
}
