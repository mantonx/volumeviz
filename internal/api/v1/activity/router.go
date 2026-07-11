package activity

import (
	"github.com/gin-gonic/gin"
	"github.com/mantonx/volumeviz/internal/audit"
)

// Router handles activity-related routes
type Router struct {
	handler *Handler
}

// NewRouter creates a new activity router
func NewRouter(auditLogger audit.Logger) *Router {
	return &Router{handler: NewHandler(auditLogger)}
}

// RegisterRoutes registers activity routes on an organization-scoped group
func (r *Router) RegisterRoutes(group *gin.RouterGroup) {
	activity := group.Group("/activity")
	{
		activity.GET("/recent", r.handler.GetRecentActivity)
	}
}
