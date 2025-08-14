package trends

import (
	"github.com/gin-gonic/gin"
	"github.com/mantonx/volumeviz/internal/interfaces"
	"github.com/mantonx/volumeviz/internal/store"
)

// Router handles trends-related routes
type Router struct {
	handler *Handler
}

// NewRouter creates a new trends router
func NewRouter(store store.Store, statsService interfaces.StatsService) *Router {
	return &Router{
		handler: NewHandler(store, statsService),
	}
}

// RegisterRoutes registers trends routes
func (r *Router) RegisterRoutes(rg *gin.RouterGroup) {
	// Trends routes
	trendsGroup := rg.Group("/trends")
	{
		// Volume-specific trends
		trendsGroup.GET("/volumes/:volumeId", r.handler.GetVolumeTrends)

		// Global trends
		trendsGroup.GET("/summary", r.handler.GetAllVolumesTrendsSummary)
	}
}
