package stats

import (
	"github.com/gin-gonic/gin"
	"github.com/mantonx/volumeviz/internal/services/stats"
	"github.com/mantonx/volumeviz/internal/store"
)

// StatsRouter provides stats routing functionality
type StatsRouter struct {
	store        store.Store
	statsService *stats.StatsService
}

// NewStatsRouter creates a new stats router
func NewStatsRouter(store store.Store, statsService *stats.StatsService) *StatsRouter {
	return &StatsRouter{
		store:        store,
		statsService: statsService,
	}
}

// RegisterRoutes registers stats routes for the router instance
func (sr *StatsRouter) RegisterRoutes(router *gin.RouterGroup) {
	handler := NewHandler(sr.store, sr.statsService)
	
	// Stats routes with StatsService integration
	router.GET("/stats/daily", handler.GetDailyStats)
	router.GET("/stats/top-folders", handler.GetTopFolders)
	router.GET("/stats/media", handler.GetMediaStats)
	router.GET("/stats/storage", handler.GetStorageStats)
}

// RegisterRoutes registers stats routes with the router
func RegisterRoutes(router *gin.RouterGroup, store store.Store, statsService *stats.StatsService) {
	handler := NewHandler(store, statsService)
	
	// Stats routes
	router.GET("/stats/daily", handler.GetDailyStats)
	router.GET("/stats/top-folders", handler.GetTopFolders)
	router.GET("/stats/media", handler.GetMediaStats)
	router.GET("/stats/storage", handler.GetStorageStats)
}
