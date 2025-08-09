package scan

import (
	"github.com/gin-gonic/gin"
	"github.com/mantonx/volumeviz/internal/core/interfaces"
	"github.com/mantonx/volumeviz/internal/database"
	"github.com/mantonx/volumeviz/internal/scheduler"
	"github.com/mantonx/volumeviz/internal/websocket"
)

// Router handles scan-related routes
type Router struct {
	handler *Handler
}

// NewRouter creates a new scan router
func NewRouter(scanner interfaces.VolumeScanner, hub *websocket.Hub, db *database.DB, scanScheduler scheduler.ScanScheduler) *Router {
	metricsRepo := database.NewVolumeMetricsRepository(db)
	return &Router{
		handler: NewHandler(scanner, hub, metricsRepo, scanScheduler),
	}
}

// RegisterRoutes registers all scan-related routes
func (r *Router) RegisterRoutes(group *gin.RouterGroup) {
	// Volume size endpoints
	group.GET("/volumes/:name/size", r.handler.GetVolumeSize)
	group.POST("/volumes/:name/size/refresh", r.handler.RefreshVolumeSize)

	// Volume scan status endpoint (per spec)
	group.GET("/volumes/:name/scan/status", r.handler.GetScanStatus)

	// Scan status by scan ID (used by tests and clients)
	group.GET("/scans/:id/status", r.handler.GetScanStatus)

	// Bulk scanning
	group.POST("/volumes/bulk-scan", r.handler.BulkScan)

	// Scan methods
	group.GET("/scan-methods", r.handler.GetScanMethods)

	// Manual scan trigger endpoints (scheduler-based)
	group.POST("/volumes/:name/scan", r.handler.TriggerVolumeScan)    // Enqueue single volume
	group.POST("/scan/now", r.handler.TriggerAllVolumesScan)         // Enqueue all volumes (admin-only)
	
	// Scheduler management endpoints
	group.GET("/scheduler/status", r.handler.GetSchedulerStatus)     // Get scheduler status
	group.GET("/scheduler/metrics", r.handler.GetSchedulerMetrics)   // Get scheduler metrics
}
