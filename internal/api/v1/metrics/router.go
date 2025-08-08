// Package metrics provides routing for volume metrics endpoints
package metrics

import (
	"github.com/gin-gonic/gin"
	"github.com/mantonx/volumeviz/internal/database"
)

// Router handles metrics-related routes
type Router struct {
	handler *Handler
}

// New creates a new metrics router
func New(db *database.DB) *Router {
	return &Router{
		handler: NewHandler(db),
	}
}

// RegisterRoutes registers all metrics routes
func (r *Router) RegisterRoutes(rg *gin.RouterGroup) {
	// Volume-specific metrics
	volumeRoutes := rg.Group("/volumes")
	{
		// Historical metrics for specific volume
		volumeRoutes.GET("/:id/metrics", r.handler.GetVolumeMetrics)
		
		// Capacity forecast for specific volume
		volumeRoutes.GET("/:id/capacity-forecast", r.handler.GetCapacityForecast)
		
		// Bulk operations
		volumeRoutes.GET("/trends", r.handler.GetVolumeTrends)
		volumeRoutes.GET("/history", r.handler.GetVolumeHistory)
		volumeRoutes.GET("/growth-rates", r.handler.GetGrowthRates)
	}
}