package scan

import (
	"github.com/gin-gonic/gin"
	"github.com/mantonx/volumeviz/internal/core/interfaces"
	"github.com/mantonx/volumeviz/internal/database"
	"github.com/mantonx/volumeviz/internal/websocket"
)

// Router handles scan-related routes
type Router struct {
	handler *Handler
}

// NewRouter creates a new scan router
func NewRouter(scanner interfaces.VolumeScanner, hub *websocket.Hub, db *database.DB) *Router {
	metricsRepo := database.NewVolumeMetricsRepository(db)
	return &Router{
		handler: NewHandler(scanner, hub, metricsRepo),
	}
}

// RegisterRoutes registers all scan-related routes
func (r *Router) RegisterRoutes(group *gin.RouterGroup) {
	// Volume size endpoints
	group.GET("/volumes/:id/size", r.handler.GetVolumeSize)
	group.POST("/volumes/:id/size/refresh", r.handler.RefreshVolumeSize)

	// Volume scan status endpoint (per spec)
	group.GET("/volumes/:id/scan/status", r.handler.GetScanStatus)

	// Bulk scanning
	group.POST("/volumes/bulk-scan", r.handler.BulkScan)

	// Scan methods
	group.GET("/scan-methods", r.handler.GetScanMethods)
}
