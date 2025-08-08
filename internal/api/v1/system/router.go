package system

import (
	"github.com/gin-gonic/gin"
	"github.com/mantonx/volumeviz/internal/services"
)

// Router handles system-related routes
type Router struct {
	handler *Handler
}

// NewRouter creates a new system router
func NewRouter(dockerService *services.DockerService) *Router {
	return &Router{
		handler: NewHandler(dockerService),
	}
}

// RegisterRoutes registers all system-related routes
func (r *Router) RegisterRoutes(group *gin.RouterGroup) {
	system := group.Group("/system")
	{
		system.GET("/info", r.handler.GetSystemInfo)
		system.GET("/version", r.handler.GetVersion)
	}
}
