// Package mounts provides routing for Docker mount catalog API endpoints
package mounts

import (
	"github.com/gin-gonic/gin"
)

// RegisterRoutes registers mount catalog routes with the router
func RegisterRoutes(r *gin.RouterGroup, handler *Handler) {
	mountsGroup := r.Group("/mounts")
	{
		// Summary and statistics
		mountsGroup.GET("/summary", handler.GetMountCatalogSummary)

		// List and search mounts
		mountsGroup.GET("", handler.ListMountCatalog)

		// Get specific mount details
		mountsGroup.GET("/:id", handler.GetMountDetails)

		// Discovery operations
		mountsGroup.POST("/discover", handler.DiscoverMounts)

		// Mount-specific operations
		mountsGroup.PUT("/:mount_id/tracking", handler.UpdateMountTracking)
	}
}
