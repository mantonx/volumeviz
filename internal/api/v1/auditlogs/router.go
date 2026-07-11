package auditlogs

import (
	"github.com/gin-gonic/gin"
	"github.com/mantonx/volumeviz/internal/api/middleware"
	"github.com/mantonx/volumeviz/internal/audit"
)

// Router handles audit-log routes
type Router struct {
	handler *Handler
}

// NewRouter creates a new audit-logs router
func NewRouter(auditLogger audit.Logger) *Router {
	return &Router{handler: NewHandler(auditLogger)}
}

// RegisterRoutes registers audit-log routes on an organization-scoped group.
// Admin only - these expose every user's activity across the organization.
func (r *Router) RegisterRoutes(group *gin.RouterGroup, authConfig *middleware.AuthConfig) {
	auditLogs := group.Group("/audit-logs")
	auditLogs.Use(middleware.RequireRoleWithConfig(authConfig, middleware.RoleAdmin))
	{
		auditLogs.GET("", r.handler.SearchAuditLogs)
		auditLogs.GET("/export", r.handler.ExportAuditLogs)
	}
}
