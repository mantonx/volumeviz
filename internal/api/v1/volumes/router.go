package volumes

import (
	"github.com/gin-gonic/gin"
	"github.com/mantonx/volumeviz/internal/interfaces"
	"github.com/mantonx/volumeviz/internal/websocket"
)

// Router handles volume-related routes
type Router struct {
	handler *Handler
}

// NewRouter creates a new volume router
func NewRouter(dockerService interfaces.DockerService, hub *websocket.Hub) *Router {
	return &Router{
		handler: NewHandler(dockerService, hub),
	}
}

// RegisterRoutes registers all volume-related routes
func (r *Router) RegisterRoutes(group *gin.RouterGroup) {
	volumes := group.Group("/volumes")
	{
		// List and filter volumes
		volumes.GET("", r.handler.ListVolumes)
		
		// Volume operations
		volumes.GET("/:id", r.handler.GetVolume)
		volumes.GET("/:id/containers", r.handler.GetVolumeContainers)
		volumes.GET("/:id/stats", r.handler.GetVolumeStats)
	}
}