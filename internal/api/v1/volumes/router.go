package volumes

import (
	"github.com/gin-gonic/gin"
	"github.com/mantonx/volumeviz/internal/api/middleware"
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

// Handler returns the underlying handler (for Phase 3 integration)
func (r *Router) Handler() *Handler {
	return r.handler
}

// RegisterRoutes registers all volume-related routes using the default
// (auth-disabled) middleware config. Prefer RegisterRoutesWithAuth when the
// caller has a real *middleware.AuthConfig available, so role checks on
// destructive routes stay consistent with the rest of the auth stack.
func (r *Router) RegisterRoutes(group *gin.RouterGroup) {
	r.RegisterRoutesWithAuth(group, nil)
}

// RegisterRoutesWithAuth registers all volume-related routes, gating the
// admin-only delete endpoints with authConfig (nil is treated as
// auth-disabled, matching middleware.DefaultAuthConfig).
func (r *Router) RegisterRoutesWithAuth(group *gin.RouterGroup, authConfig *middleware.AuthConfig) {
	// Volume endpoints
	volumes := group.Group("/volumes")
	{
		// List and filter volumes with pagination
		volumes.GET("", r.handler.ListVolumes)

		// Cache management (Phase 3)
		volumes.GET("/cache/stats", r.handler.GetCacheStats)
		volumes.POST("/cache/invalidate", r.handler.InvalidateCache)

		// Export endpoints
		volumes.GET("/export/csv", r.handler.ExportVolumesCSV)
		volumes.GET("/export/json", r.handler.ExportVolumesJSON)

		// Bulk tracking operations
		volumes.POST("/bulk-track", r.handler.BulkTrackVolumes)
		volumes.POST("/bulk-untrack", r.handler.BulkUntrackVolumes)

		// Volume operations (using name instead of id)
		volumes.GET("/:name", r.handler.GetVolume)
		volumes.GET("/:name/attachments", r.handler.GetVolumeAttachments)
		volumes.GET("/:name/stats", r.handler.GetVolumeStats)

		// Volume tracking operations
		volumes.POST("/:name/track", r.handler.TrackVolume)
		volumes.POST("/:name/untrack", r.handler.UntrackVolume)

		// Volume deletion — permanently removes real Docker state, so these
		// require admin role on top of the operator floor every other
		// mutation gets from the global ProtectMutatingOperations middleware.
		requireAdmin := middleware.RequireRoleWithConfig(authConfig, middleware.RoleAdmin)
		volumes.DELETE("/:name", requireAdmin, r.handler.DeleteVolume)
		volumes.POST("/bulk-delete", requireAdmin, r.handler.BulkDeleteVolumes)
	}

	// Reports endpoints
	reports := group.Group("/reports")
	{
		// Orphaned volumes report
		reports.GET("/orphaned", r.handler.GetOrphanedVolumes)
	}
}
