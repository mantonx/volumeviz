package trends

import (
	"github.com/gin-gonic/gin"
	"github.com/mantonx/volumeviz/internal/store"
)

// Router handles trends-related routes
type Router struct {
	handler *Handler
}

// NewRouter creates a new trends router
func NewRouter(store store.Store) *Router {
	return &Router{
		handler: NewHandler(store),
	}
}

// RegisterRoutes registers trends routes
func (r *Router) RegisterRoutes(rg *gin.RouterGroup) {
	// Trends routes
	trendsGroup := rg.Group("/trends")
	{
		// Volume-specific trends
		trendsGroup.GET("/volumes/:volumeId", r.handler.GetVolumeTrends)
		trendsGroup.GET("/volumes/:volumeId/deltas", r.handler.GetVolumeGrowthDeltas)
		trendsGroup.GET("/volumes/:volumeId/series", r.handler.GetVolumeStepSeries)
		trendsGroup.GET("/volumes/:volumeId/slope", r.handler.GetVolumeTrendSlope)
		trendsGroup.GET("/volumes/:volumeId/7day", r.handler.Get7DayTrend)
		trendsGroup.GET("/volumes/:volumeId/30day", r.handler.Get30DayTrend)
		trendsGroup.POST("/volumes/:volumeId/snapshots", r.handler.CreateSnapshot)

		// Global trends
		trendsGroup.GET("/summary", r.handler.GetAllVolumesTrendsSummary)
	}
}
