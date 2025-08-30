package volumes

import (
	"github.com/gin-gonic/gin"
	"github.com/mantonx/volumeviz/internal/interfaces"
	"github.com/mantonx/volumeviz/internal/realtime"
	"github.com/mantonx/volumeviz/internal/store"
)

// Router handles volume-related routes
type Router struct {
	handler *Handler
}

// NewRouter creates a new volume router
func NewRouter(dockerService interfaces.DockerService, store store.Store, publisher *realtime.Broadcaster) *Router {
	return &Router{
		handler: NewHandler(dockerService, store, publisher),
	}
}

// NewRouterWithScanner creates a new volume router with volume scanner integration
func NewRouterWithScanner(dockerService interfaces.DockerService, store store.Store, publisher *realtime.Broadcaster, scanner interfaces.VolumeScanner) *Router {
	return &Router{
		handler: NewHandlerWithScanner(dockerService, store, publisher, scanner),
	}
}

// RegisterRoutes registers all volume-related routes
func (r *Router) RegisterRoutes(group *gin.RouterGroup) {
	// Volume endpoints
	volumes := group.Group("/volumes")
	{
		// List and filter volumes with pagination
		volumes.GET("", r.handler.ListVolumes)

		// Volume operations (using name instead of id)
		volumes.GET("/:name", r.handler.GetVolume)
		volumes.GET("/:name/attachments", r.handler.GetVolumeAttachments)
		volumes.GET("/:name/stats", r.handler.GetVolumeStats)
	}

	// Reports endpoints
	reports := group.Group("/reports")
	{
		// Orphaned volumes report
		reports.GET("/orphaned", r.handler.GetOrphanedVolumes)
	}
}
