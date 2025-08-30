package scan

import (
	"github.com/gin-gonic/gin"
	"github.com/mantonx/volumeviz/internal/interfaces"
	"github.com/mantonx/volumeviz/internal/realtime"
	"github.com/mantonx/volumeviz/internal/scheduler"
	"github.com/mantonx/volumeviz/internal/store"
)

// Router handles scan-related routes
type Router struct {
	handler *Handler
}

// NewRouter creates a new scan router
func NewRouter(scanner interfaces.VolumeScanner, store store.Store, scanScheduler scheduler.ScanScheduler, publisher *realtime.Broadcaster) *Router {
	return &Router{
		handler: NewHandlerWithStore(scanner, store, scanScheduler, publisher),
	}
}

// SetEnrichmentManager sets the media enrichment manager
func (r *Router) SetEnrichmentManager(manager interfaces.EnrichmentManager) {
	r.handler.SetEnrichmentManager(manager)
}

// RegisterRoutes registers all scan-related routes
func (r *Router) RegisterRoutes(group *gin.RouterGroup) {
	// Volume size endpoints
	group.GET("/volumes/:name/size", r.handler.GetSizeAnalysisStatus)
	group.POST("/volumes/:name/size/refresh", r.handler.RefreshVolumeSize)

	// Volume scan status endpoint (per spec)
	group.GET("/volumes/:name/scan/status", r.handler.GetScanStatus)

	// Scan status by scan ID (used by tests and clients)
	group.GET("/scans/:id/status", r.handler.GetScanStatus)

	// Comprehensive progress tracking endpoints
	group.GET("/scans/:id/progress", r.handler.GetScanProgress)      // Detailed scan progress
	group.GET("/scans/:id/errors", r.handler.GetScanErrors)          // Scan errors with filtering
	group.GET("/scans/active", r.handler.GetActiveScans)             // Active scans list
	group.GET("/scans/recent-errors", r.handler.GetRecentScanErrors) // Recent errors across all scans

	// Bulk scanning
	group.POST("/volumes/bulk-scan", r.handler.BulkScan)

	// Scan methods
	group.GET("/scan-methods", r.handler.GetScanMethods)

	// Manual scan trigger endpoints (scheduler-based)
	group.POST("/volumes/:name/scan", r.handler.TriggerVolumeScan) // Enqueue single volume
	group.POST("/scan/now", r.handler.TriggerAllVolumesScan)       // Enqueue all volumes (admin-only)

	// Scheduler management endpoints
	group.GET("/scheduler/status", r.handler.GetSchedulerStatus)   // Get scheduler status
	group.GET("/scheduler/metrics", r.handler.GetSchedulerMetrics) // Get scheduler metrics

	// Enhanced scheduler endpoints (hardened mode)
	group.GET("/scheduler/metrics/detailed", r.handler.GetSchedulerDetailedMetrics) // Enhanced metrics with worker/watchdog stats
	group.GET("/scheduler/workers", r.handler.GetSchedulerWorkerStats)              // Worker statistics
	group.GET("/scheduler/watchdog", r.handler.GetSchedulerWatchdogStats)           // Watchdog statistics
	group.GET("/scheduler/capabilities", r.handler.GetSchedulerCapabilities)        // Scheduler capabilities and mode

	// Filesystem indexing endpoints
	// Using :name to match existing route parameter naming convention
	group.GET("/volumes/:name/filesystem/status", r.handler.GetFilesystemIndexingStatus) // Get filesystem indexing status
	group.POST("/volumes/:name/filesystem/index", r.handler.TriggerFilesystemIndexing)   // Trigger filesystem indexing
	group.GET("/filesystem/capabilities", r.handler.GetFilesystemIndexingCapabilities)   // Get filesystem indexing capabilities

	// Media enrichment endpoints
	group.POST("/volumes/:name/media/enrich", r.handler.TriggerMediaEnrichment)  // Trigger media enrichment
	group.GET("/volumes/:name/media/status", r.handler.GetMediaEnrichmentStatus) // Get media enrichment status
	group.GET("/media/capabilities", r.handler.GetMediaEnrichmentCapabilities)   // Get media enrichment capabilities
}
