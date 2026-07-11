package systemconfig

import (
	"github.com/gin-gonic/gin"
	"github.com/mantonx/volumeviz/internal/api/middleware"
	"github.com/mantonx/volumeviz/internal/config"
)

// Router handles system-config routes
type Router struct {
	handler *Handler
}

// NewRouter creates a new system-config router
func NewRouter(cfg *config.Config) *Router {
	return &Router{handler: NewHandler(cfg)}
}

// RegisterRoutes registers system-config routes. Admin only - this reveals
// infrastructure details (rate limits, CORS origins, DB type) that
// shouldn't be visible to a plain viewer.
func (r *Router) RegisterRoutes(group *gin.RouterGroup, authConfig *middleware.AuthConfig) {
	sysConfig := group.Group("/system")
	sysConfig.Use(middleware.RequireRoleWithConfig(authConfig, middleware.RoleAdmin))
	{
		sysConfig.GET("/config", r.handler.GetConfig)
	}
}
