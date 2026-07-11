package permissions

import (
	"github.com/gin-gonic/gin"
	"github.com/mantonx/volumeviz/internal/api/middleware"
	"github.com/mantonx/volumeviz/internal/db/sqlc"
)

// Router handles roles/permissions routes
type Router struct {
	handler *Handler
}

// NewRouter creates a new permissions router
func NewRouter(queries *sqlc.Queries) *Router {
	return &Router{handler: NewHandler(queries)}
}

// RegisterRoutes registers permissions routes on an organization-scoped
// group. Admin only - this exposes and edits the authorization model
// itself.
func (r *Router) RegisterRoutes(group *gin.RouterGroup, authConfig *middleware.AuthConfig) {
	perms := group.Group("/permissions")
	perms.Use(middleware.RequireRoleWithConfig(authConfig, middleware.RoleAdmin))
	{
		perms.GET("", r.handler.ListPermissions)
		perms.PUT("", r.handler.UpdatePermission)
	}
}
