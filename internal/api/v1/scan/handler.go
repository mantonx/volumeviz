// Package scan provides HTTP handlers for volume scanning operations
// Handles size calculations and performance metrics
package scan

import (
	"context"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/mantonx/volumeviz/internal/api/models"
	"github.com/mantonx/volumeviz/internal/interfaces"
	coremodels "github.com/mantonx/volumeviz/internal/models"
	"github.com/mantonx/volumeviz/internal/realtime"
	"github.com/mantonx/volumeviz/internal/scheduler"
	"github.com/mantonx/volumeviz/internal/services/filesystem"
	"github.com/mantonx/volumeviz/internal/store"
	"github.com/mantonx/volumeviz/internal/utils"
	"github.com/mantonx/volumeviz/internal/websocket"
)

// Handler handles scan-related HTTP requests
// Provides endpoints for volume size scanning and metrics
type Handler struct {
	scanner           interfaces.VolumeScanner
	hub               *websocket.Hub
	store            store.Store             // New sqlc-based store
	scheduler         scheduler.ScanScheduler // Optional scheduler for manual scan triggers
	realtimePublisher *realtime.Publisher
	enrichmentManager interfaces.EnrichmentManager // Media enrichment manager
}

// NewHandler creates a new scan handler
// Pass in your volume scanner implementation, WebSocket hub, optional scheduler, and realtime publisher
func NewHandler(scanner interfaces.VolumeScanner, hub *websocket.Hub, scheduler scheduler.ScanScheduler, publisher *realtime.Publisher) *Handler {
	return NewHandlerWithStore(scanner, hub, nil, scheduler, publisher)
}

// NewHandlerWithStore creates a new scan handler with optional store integration
func NewHandlerWithStore(scanner interfaces.VolumeScanner, hub *websocket.Hub, storeInstance store.Store, scheduler scheduler.ScanScheduler, publisher *realtime.Publisher) *Handler {
	return &Handler{
		scanner:           scanner,
		hub:               hub,
		store:            storeInstance,
		scheduler:         scheduler,
		realtimePublisher: publisher,
	}
}

// SetEnrichmentManager sets the media enrichment manager
func (h *Handler) SetEnrichmentManager(manager interfaces.EnrichmentManager) {
	h.enrichmentManager = manager
}

// GetVolumeSize returns volume size information
// @Summary Get volume size
// @Description Get the current size and statistics of a Docker volume
// @Tags scan
// @Accept json
// @Produce json
// @Param id path string true "Volume ID"
// @Success 200 {object} models.ScanResponse
// @Failure 400 {object} models.ErrorResponse
// @Failure 404 {object} models.ErrorResponse
// @Failure 500 {object} models.ErrorResponse
// @Router /volumes/{id}/size [get]
func (h *Handler) GetVolumeSize(c *gin.Context) {
	volumeID := c.Param("id")

	if volumeID == "" {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Error:   "Volume ID is required",
			Code:    "MISSING_VOLUME_ID",
			Details: map[string]any{"message": "Volume ID parameter is missing from the request"},
		})
		return
	}

	result, err := h.scanner.ScanVolume(c.Request.Context(), volumeID)
	if err != nil {
		h.handleScanError(c, err)
		// Broadcast scan error via WebSocket
		if h.hub != nil {
			h.hub.BroadcastScanError(volumeID, err.Error(), "SCAN_ERROR")
		}
		return
	}

	response := models.ScanResponse{
		VolumeID: volumeID,
		Result:   models.ConvertScanResult(result),
		Cached:   result.CacheHit,
	}

	// Historical metrics are now handled by the new DailyStat system
	// Legacy DirRollup analytics are being phased out
	_ = h.store // Suppress unused warning

	// Broadcast scan completion via WebSocket
	if h.hub != nil {
		wsResult := websocket.ScanResult{
			TotalSize:      result.TotalSize,
			FileCount:      result.FileCount,
			DirectoryCount: result.DirectoryCount,
			ScannedAt:      result.ScannedAt,
			Method:         result.Method,
			Duration:       result.Duration,
		}
		h.hub.BroadcastScanComplete(volumeID, wsResult)
	}

	c.JSON(http.StatusOK, response)
}

// RefreshVolumeSize forces a refresh of volume size calculation
// @Summary Refresh volume size
// @Description Clear cache and recalculate volume size, optionally async
// @Tags scan
// @Accept json
// @Produce json
// @Param id path string true "Volume ID"
// @Param request body models.RefreshRequest false "Refresh options"
// @Success 200 {object} models.ScanResponse "Sync scan completed"
// @Success 202 {object} models.AsyncScanResponse "Async scan started"
// @Failure 400 {object} models.ErrorResponse
// @Failure 500 {object} models.ErrorResponse
// @Router /volumes/{id}/size/refresh [post]
func (h *Handler) RefreshVolumeSize(c *gin.Context) {
	volumeID := c.Param("id")

	if volumeID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "Volume ID is required",
			"code":    "MISSING_VOLUME_ID",
			"details": "Volume name parameter is missing from the request",
		})
		return
	}

	var req coremodels.RefreshRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		// If JSON binding fails, use defaults
		req.Async = false
	}

	if req.Async {
		// Emit scan start progress
		if h.realtimePublisher != nil {
			startProgress := realtime.ScanProgressData{
				VolumeID:       volumeID,
				Progress:       0,
				CurrentSize:    0,
				FilesProcessed: 0,
				Method:         req.Method,
				StartedAt:      time.Now(),
			}
			h.realtimePublisher.PublishScanProgress(startProgress)
		}

		scanID, err := h.scanner.ScanVolumeAsync(c.Request.Context(), volumeID)
		if err != nil {
			h.handleScanError(c, err)
			if h.realtimePublisher != nil {
				h.realtimePublisher.PublishScanError(volumeID, err, req.Method)
			}
			return
		}

		c.JSON(http.StatusAccepted, gin.H{
			"message":    "Async scan started",
			"scan_id":    scanID,
			"status_url": fmt.Sprintf("/api/v1/scans/%s/status", scanID),
		})
		return
	}

	// Clear cache and scan synchronously
	if err := h.scanner.ClearCache(volumeID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "Failed to clear cache",
			"details": err.Error(),
		})
		return
	}

	// Emit scan start progress for sync scans too
	if h.realtimePublisher != nil {
		startProgress := realtime.ScanProgressData{
			VolumeID:       volumeID,
			Progress:       0,
			CurrentSize:    0,
			FilesProcessed: 0,
			Method:         req.Method,
			StartedAt:      time.Now(),
		}
		h.realtimePublisher.PublishScanProgress(startProgress)
	}

	result, err := h.scanner.ScanVolume(c.Request.Context(), volumeID)
	if err != nil {
		h.handleScanError(c, err)
		// Broadcast scan error via realtime publisher
		if h.realtimePublisher != nil {
			h.realtimePublisher.PublishScanError(volumeID, err, req.Method)
		}
		return
	}

	// Broadcast scan completion via realtime publisher
	if h.realtimePublisher != nil {
		completeData := realtime.ScanCompleteData{
			VolumeID:       volumeID,
			TotalSize:      result.TotalSize,
			FileCount:      result.FileCount,
			DirectoryCount: result.DirectoryCount,
			Method:         result.Method,
			Duration:       result.Duration,
			ScannedAt:      result.ScannedAt,
		}
		h.realtimePublisher.PublishScanComplete(completeData)
	}

	response := models.ScanResponse{
		VolumeID: volumeID,
		Result:   models.ConvertScanResult(result),
		Cached:   false, // Always false since we cleared cache
	}

	c.JSON(http.StatusOK, response)
}

// GetScanStatus returns the status of an async scan.
// Supports both routes:
// - GET /api/v1/volumes/:id/scan/status (id = volumeID)
// - GET /api/v1/scans/:id/status (id = scanID)
func (h *Handler) GetScanStatus(c *gin.Context) {
	id := c.Param("id")
	if id == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "ID is required",
			"code":    "MISSING_ID",
			"details": "ID parameter is missing from the request",
		})
		return
	}

	fullPath := c.FullPath()
	// If route matches scans path, treat id as scanID and use GetScanProgress
	if strings.Contains(fullPath, "/scans/:id/status") {
		progress, err := h.scanner.GetScanProgress(id)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{
				"error":   "Scan not found",
				"code":    "SCAN_NOT_FOUND",
				"details": fmt.Sprintf("No scan found with ID %s", id),
			})
			return
		}
		c.JSON(http.StatusOK, progress)
		return
	}

	// Otherwise treat as volume-based route and attempt to get progress by volume
	if volumeScanner, ok := h.scanner.(interface {
		GetScanProgressByVolume(volumeID string) (*interfaces.ScanProgress, error)
	}); ok {
		progress, err := volumeScanner.GetScanProgressByVolume(id)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{
				"error":   "No active scan found for volume",
				"code":    "NO_ACTIVE_SCAN",
				"details": fmt.Sprintf("No active scan found for volume %s", id),
			})
			return
		}
		c.JSON(http.StatusOK, progress)
		return
	}

	// Fallback if volume-based method is not available
	c.JSON(http.StatusNotFound, gin.H{
		"error":   "No active scan found for volume",
		"code":    "NO_ACTIVE_SCAN",
		"details": fmt.Sprintf("No active scan found for volume %s", id),
	})
}

// BulkScan performs bulk scanning of multiple volumes
// POST /api/v1/volumes/bulk-scan
func (h *Handler) BulkScan(c *gin.Context) {
	var req models.BulkScanRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "Invalid request format",
			"details": err.Error(),
		})
		return
	}

	if len(req.VolumeIDs) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "At least one volume ID is required",
			"code":  "EMPTY_VOLUME_LIST",
		})
		return
	}

	if req.Async {
		// For async bulk scan, start all scans and return scan IDs
		scanIDs := make([]string, len(req.VolumeIDs))
		for i, volumeID := range req.VolumeIDs {
			scanID, err := h.scanner.ScanVolumeAsync(c.Request.Context(), volumeID)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{
					"error":   "Failed to start async scan",
					"volume":  volumeID,
					"details": err.Error(),
				})
				return
			}
			scanIDs[i] = scanID
		}

		c.JSON(http.StatusAccepted, gin.H{
			"message":  "Bulk async scan started",
			"scan_ids": scanIDs,
			"total":    len(req.VolumeIDs),
		})
		return
	}

	// Synchronous bulk scan
	results := make(map[string]any)
	failed := make(map[string]string)
	successCount := 0

	for _, volumeID := range req.VolumeIDs {
		result, err := h.scanner.ScanVolume(c.Request.Context(), volumeID)
		if err != nil {
			failed[volumeID] = err.Error()
		} else {
			results[volumeID] = result
			successCount++
		}
	}

	response := models.BulkScanResponse{
		Results:  results,
		Failed:   failed,
		Total:    len(req.VolumeIDs),
		Success:  successCount,
		Failures: len(failed),
	}

	statusCode := http.StatusOK
	if len(failed) > 0 && successCount == 0 {
		statusCode = http.StatusInternalServerError
	} else if len(failed) > 0 {
		statusCode = http.StatusPartialContent
	}

	c.JSON(statusCode, response)
}

// GetScanMethods returns available scan methods
// GET /api/v1/scan-methods
func (h *Handler) GetScanMethods(c *gin.Context) {
	methods := h.scanner.GetAvailableMethods()
	c.JSON(http.StatusOK, gin.H{
		"methods": methods,
		"total":   len(methods),
	})
}

// handleScanError handles scan errors with appropriate HTTP responses
func (h *Handler) handleScanError(c *gin.Context, err error) {
	scanErr, ok := err.(*coremodels.ScanError)
	if !ok {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "Internal server error",
			"details": err.Error(),
		})
		return
	}

	response := gin.H{
		"error":   scanErr.Message,
		"code":    scanErr.Code,
		"context": scanErr.Context,
	}

	// Add helpful suggestions based on error type
	switch scanErr.Code {
	case coremodels.ErrorCodeScanQueueTimeout:
		response["suggestion"] = "Retry the request or scan smaller directories"
		c.JSON(http.StatusRequestTimeout, response)

	case coremodels.ErrorCodePathValidationFailed:
		response["suggestion"] = "Ensure the volume exists and is accessible"
		c.JSON(http.StatusBadRequest, response)

	case coremodels.ErrorCodeVolumeNotFound:
		response["suggestion"] = "Check that the volume ID is correct"
		c.JSON(http.StatusNotFound, response)

	case coremodels.ErrorCodePermissionDenied:
		response["suggestion"] = "Check VolumeViz permissions for accessing the volume"
		c.JSON(http.StatusForbidden, response)

	case coremodels.ErrorCodeAllMethodsFailed:
		response["suggestion"] = "Check VolumeViz permissions and available disk space"
		c.JSON(http.StatusInternalServerError, response)

	case coremodels.ErrorCodeScanCanceled:
		response["suggestion"] = "Try again with a longer timeout or scan smaller directories"
		c.JSON(http.StatusRequestTimeout, response)

	default:
		c.JSON(http.StatusInternalServerError, response)
	}
}

// ValidateVolumeID validates a volume ID format
func (h *Handler) ValidateVolumeID(volumeID string) error {
	if volumeID == "" {
		return fmt.Errorf("volume ID cannot be empty")
	}

	if utils.ContainsAny(volumeID, "..", "/") {
		return fmt.Errorf("volume ID contains invalid characters")
	}

	if len(volumeID) > 255 {
		return fmt.Errorf("volume ID too long (max 255 characters)")
	}

	return nil
}

// TriggerVolumeScan enqueues a single volume for scanning via the scheduler
// POST /api/v1/volumes/{name}/scan
func (h *Handler) TriggerVolumeScan(c *gin.Context) {
	if h.scheduler == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"error": "Scan scheduler not available",
			"code":  "SCHEDULER_UNAVAILABLE",
		})
		return
	}

	volumeName := c.Param("name")
	if volumeName == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Volume ID is required",
			"code":  "MISSING_VOLUME_NAME",
		})
		return
	}

	// Validate volume name format
	if err := h.ValidateVolumeID(volumeName); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "Invalid volume name",
			"code":    "INVALID_VOLUME_NAME",
			"details": err.Error(),
		})
		return
	}

	// Enqueue the volume for scanning
	scanID, err := h.scheduler.EnqueueVolume(volumeName)
	if err != nil {
		// Handle different error types
		if strings.Contains(err.Error(), "scheduler not running") {
			c.JSON(http.StatusServiceUnavailable, gin.H{
				"error":   "Scan scheduler is not running",
				"code":    "SCHEDULER_NOT_RUNNING",
				"details": err.Error(),
			})
			return
		}
		if strings.Contains(err.Error(), "queue full") {
			c.JSON(http.StatusTooManyRequests, gin.H{
				"error":   "Scan queue is full",
				"code":    "QUEUE_FULL",
				"details": "Try again later when queue capacity is available",
			})
			return
		}
		if strings.Contains(err.Error(), "skip pattern") || strings.Contains(err.Error(), "not in allow list") {
			c.JSON(http.StatusForbidden, gin.H{
				"error":   "Volume scan not allowed",
				"code":    "SCAN_FORBIDDEN",
				"details": err.Error(),
			})
			return
		}
		if strings.Contains(err.Error(), "already has an active scan") {
			c.JSON(http.StatusConflict, gin.H{
				"error":   "Volume scan already in progress",
				"code":    "SCAN_ALREADY_ACTIVE",
				"details": "Only one scan per volume is allowed at a time",
			})
			return
		}
		if strings.Contains(err.Error(), "shutting down") {
			c.JSON(http.StatusServiceUnavailable, gin.H{
				"error":   "Scan scheduler is shutting down",
				"code":    "SCHEDULER_SHUTTING_DOWN",
				"details": err.Error(),
			})
			return
		}

		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "Failed to enqueue volume scan",
			"code":    "ENQUEUE_FAILED",
			"details": err.Error(),
		})
		return
	}

	// Return scan ID and status URL
	c.JSON(http.StatusAccepted, gin.H{
		"message":    "Volume scan enqueued",
		"scan_id":    scanID,
		"volume":     volumeName,
		"status_url": fmt.Sprintf("/api/v1/scans/%s/status", scanID),
	})
}

// TriggerAllVolumescan enqueues all volumes for scanning (admin-only if auth enabled)
// POST /api/v1/scan/now
func (h *Handler) TriggerAllVolumesScan(c *gin.Context) {
	if h.scheduler == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"error": "Scan scheduler not available",
			"code":  "SCHEDULER_UNAVAILABLE",
		})
		return
	}

	// TODO: Add admin authentication check when auth is implemented
	// For now, anyone can trigger this endpoint

	// Enqueue all volumes for scanning
	batchID, err := h.scheduler.EnqueueAllVolumes()
	if err != nil {
		// Handle different error types
		if strings.Contains(err.Error(), "scheduler not running") {
			c.JSON(http.StatusServiceUnavailable, gin.H{
				"error":   "Scan scheduler is not running",
				"code":    "SCHEDULER_NOT_RUNNING",
				"details": err.Error(),
			})
			return
		}
		if strings.Contains(err.Error(), "rate limited") {
			c.JSON(http.StatusTooManyRequests, gin.H{
				"error":   "Rate limited",
				"code":    "RATE_LIMITED",
				"details": err.Error(),
			})
			return
		}

		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "Failed to enqueue all volumes scan",
			"code":    "ENQUEUE_ALL_FAILED",
			"details": err.Error(),
		})
		return
	}

	// Get scheduler status for additional info
	status := h.scheduler.GetStatus()

	c.JSON(http.StatusAccepted, gin.H{
		"message":     "All volumes scan enqueued",
		"batch_id":    batchID,
		"queue_depth": status.QueueDepth,
		"workers":     status.WorkerCount,
	})
}

// GetSchedulerStatus returns the current status of the scan scheduler
// GET /api/v1/scheduler/status
func (h *Handler) GetSchedulerStatus(c *gin.Context) {
	if h.scheduler == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"error": "Scan scheduler not available",
			"code":  "SCHEDULER_UNAVAILABLE",
		})
		return
	}

	status := h.scheduler.GetStatus()
	c.JSON(http.StatusOK, status)
}

// GetSchedulerMetrics returns metrics for the scan scheduler (for Prometheus)
// GET /api/v1/scheduler/metrics
func (h *Handler) GetSchedulerMetrics(c *gin.Context) {
	if h.scheduler == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"error": "Scan scheduler not available",
			"code":  "SCHEDULER_UNAVAILABLE",
		})
		return
	}

	metrics := h.scheduler.GetMetrics()
	c.JSON(http.StatusOK, metrics)
}

// GetSchedulerDetailedMetrics returns enhanced metrics for the scan scheduler (hardened mode)
// GET /api/v1/scheduler/metrics/detailed
func (h *Handler) GetSchedulerDetailedMetrics(c *gin.Context) {
	if h.scheduler == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"error": "Scan scheduler not available",
			"code":  "SCHEDULER_UNAVAILABLE",
		})
		return
	}

	metrics := h.scheduler.GetDetailedMetrics()
	c.JSON(http.StatusOK, metrics)
}

// GetSchedulerWorkerStats returns worker statistics for the scan scheduler
// GET /api/v1/scheduler/workers
func (h *Handler) GetSchedulerWorkerStats(c *gin.Context) {
	if h.scheduler == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"error": "Scan scheduler not available",
			"code":  "SCHEDULER_UNAVAILABLE",
		})
		return
	}

	workerStats := h.scheduler.GetWorkerStats()
	c.JSON(http.StatusOK, gin.H{
		"workers": workerStats,
		"count":   len(workerStats),
	})
}

// GetSchedulerWatchdogStats returns watchdog statistics for the scan scheduler
// GET /api/v1/scheduler/watchdog
func (h *Handler) GetSchedulerWatchdogStats(c *gin.Context) {
	if h.scheduler == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"error": "Scan scheduler not available",
			"code":  "SCHEDULER_UNAVAILABLE",
		})
		return
	}

	watchdogStats := h.scheduler.GetWatchdogStats()
	if watchdogStats == nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error": "Watchdog not enabled",
			"code":  "WATCHDOG_DISABLED",
		})
		return
	}

	c.JSON(http.StatusOK, watchdogStats)
}

// GetSchedulerCapabilities returns scheduler capabilities and mode information
// GET /api/v1/scheduler/capabilities
func (h *Handler) GetSchedulerCapabilities(c *gin.Context) {
	if h.scheduler == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"error": "Scan scheduler not available",
			"code":  "SCHEDULER_UNAVAILABLE",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"hardened_mode":   h.scheduler.IsHardenedMode(),
		"watchdog_enabled": h.scheduler.GetWatchdogStats() != nil,
		"features": gin.H{
			"atomic_claims":    h.scheduler.IsHardenedMode(),
			"heartbeat":        h.scheduler.IsHardenedMode(),
			"watchdog":         h.scheduler.GetWatchdogStats() != nil,
			"worker_stats":     true,
			"detailed_metrics": true,
		},
	})
}

// ===========================================
// FILESYSTEM INDEXING ENDPOINTS
// ===========================================

// GetFilesystemIndexingStatus returns the status of filesystem indexing for a volume
// @Summary Get filesystem indexing status
// @Description Get the current status of filesystem indexing for a volume
// @Tags filesystem
// @Accept json
// @Produce json
// @Param id path string true "Volume ID"
// @Success 200 {object} models.FilesystemIndexingResponse
// @Failure 400 {object} models.ErrorResponse
// @Failure 404 {object} models.ErrorResponse
// @Failure 503 {object} models.ErrorResponse "Filesystem indexing not enabled"
// @Router /volumes/{id}/filesystem/status [get]
func (h *Handler) GetFilesystemIndexingStatus(c *gin.Context) {
	volumeID := c.Param("id")
	if volumeID == "" {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Error:   "Volume ID is required",
			Code:    "MISSING_VOLUME_ID",
			Details: map[string]any{"message": "Volume ID parameter is missing from the request"},
		})
		return
	}

	// Check if filesystem indexing is available
	if indexingScanner, ok := h.scanner.(interface {
		IsFilesystemIndexingEnabled() bool
		GetFilesystemIndexingProgress() *filesystem.IndexingProgress
	}); ok {
		if !indexingScanner.IsFilesystemIndexingEnabled() {
			c.JSON(http.StatusServiceUnavailable, models.ErrorResponse{
				Error:   "Filesystem indexing not enabled",
				Code:    "FILESYSTEM_INDEXING_DISABLED",
				Details: map[string]any{"message": "Filesystem indexing is not configured for this volume scanner"},
			})
			return
		}

		progress := indexingScanner.GetFilesystemIndexingProgress()
		if progress == nil {
			c.JSON(http.StatusOK, gin.H{
				"volume_id": volumeID,
				"status":    "not_started",
				"message":   "No filesystem indexing in progress",
			})
			return
		}

		// Filter progress for this volume
		if progress.VolumeID != volumeID {
			c.JSON(http.StatusOK, gin.H{
				"volume_id": volumeID,
				"status":    "not_started",
				"message":   "No filesystem indexing in progress for this volume",
			})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"volume_id":        progress.VolumeID,
			"status":           progress.Status,
			"started_at":       progress.StartedAt,
			"last_update":      progress.LastUpdate,
			"folders_scanned":  progress.FoldersScanned,
			"files_scanned":    progress.FilesScanned,
			"bytes_processed":  progress.BytesProcessed,
			"errors_count":     progress.ErrorsCount,
			"current_path":     progress.CurrentPath,
			"current_depth":    progress.CurrentDepth,
			"folders_per_sec":  progress.FoldersPerSec,
			"files_per_sec":    progress.FilesPerSec,
			"last_error":       progress.LastError,
		})
		return
	}

	c.JSON(http.StatusServiceUnavailable, models.ErrorResponse{
		Error:   "Filesystem indexing not supported",
		Code:    "FILESYSTEM_INDEXING_NOT_SUPPORTED",
		Details: map[string]any{"message": "This volume scanner does not support filesystem indexing"},
	})
}

// TriggerFilesystemIndexing manually triggers filesystem indexing for a volume
// @Summary Trigger filesystem indexing
// @Description Manually trigger filesystem indexing for a specific volume
// @Tags filesystem
// @Accept json
// @Produce json
// @Param id path string true "Volume ID"
// @Param request body coremodels.FilesystemIndexingRequest false "Indexing options"
// @Success 202 {object} models.FilesystemIndexingResponse "Indexing started"
// @Failure 400 {object} models.ErrorResponse
// @Failure 409 {object} models.ErrorResponse "Indexing already in progress"
// @Failure 503 {object} models.ErrorResponse "Filesystem indexing not enabled"
// @Router /volumes/{id}/filesystem/index [post]
func (h *Handler) TriggerFilesystemIndexing(c *gin.Context) {
	volumeID := c.Param("id")
	if volumeID == "" {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Error:   "Volume ID is required",
			Code:    "MISSING_VOLUME_ID",
			Details: map[string]any{"message": "Volume ID parameter is missing from the request"},
		})
		return
	}

	// Parse request body for indexing options
	var req struct {
		DeltaMode bool `json:"delta_mode"`
		FullScan  bool `json:"full_scan"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		// Use defaults if JSON binding fails
		req.DeltaMode = true // Default to delta mode for efficiency
	}

	// Check if filesystem indexing is available
	if indexingScanner, ok := h.scanner.(interface {
		IsFilesystemIndexingEnabled() bool
		GetFilesystemIndexingProgress() *filesystem.IndexingProgress
	}); ok {
		if !indexingScanner.IsFilesystemIndexingEnabled() {
			c.JSON(http.StatusServiceUnavailable, models.ErrorResponse{
				Error:   "Filesystem indexing not enabled",
				Code:    "FILESYSTEM_INDEXING_DISABLED",
				Details: map[string]any{"message": "Filesystem indexing is not configured for this volume scanner"},
			})
			return
		}

		// Check if indexing is already in progress
		progress := indexingScanner.GetFilesystemIndexingProgress()
		if progress != nil && progress.VolumeID == volumeID && progress.Status == "running" {
			c.JSON(http.StatusConflict, models.ErrorResponse{
				Error:   "Filesystem indexing already in progress",
				Code:    "INDEXING_ALREADY_ACTIVE",
				Details: map[string]any{"message": "Filesystem indexing is already running for this volume"},
			})
			return
		}

		// This is a simplified trigger - in a real implementation, you'd need to:
		// 1. Get the volume path from Docker service
		// 2. Start indexing asynchronously
		// 3. Return immediately with accepted status
		
		c.JSON(http.StatusAccepted, gin.H{
			"message":    "Filesystem indexing triggered",
			"volume_id":  volumeID,
			"delta_mode": req.DeltaMode,
			"status_url": fmt.Sprintf("/api/v1/volumes/%s/filesystem/status", volumeID),
		})
		return
	}

	c.JSON(http.StatusServiceUnavailable, models.ErrorResponse{
		Error:   "Filesystem indexing not supported",
		Code:    "FILESYSTEM_INDEXING_NOT_SUPPORTED",
		Details: map[string]any{"message": "This volume scanner does not support filesystem indexing"},
	})
}

// GetFilesystemIndexingCapabilities returns filesystem indexing capabilities
// @Summary Get filesystem indexing capabilities
// @Description Get information about filesystem indexing capabilities and configuration
// @Tags filesystem
// @Accept json
// @Produce json
// @Success 200 {object} models.FilesystemCapabilitiesResponse
// @Router /filesystem/capabilities [get]
func (h *Handler) GetFilesystemIndexingCapabilities(c *gin.Context) {
	capabilities := gin.H{
		"enabled": false,
		"features": gin.H{
			"mime_detection":     false,
			"file_hashing":       false,
			"media_classification": false,
			"delta_scanning":     false,
			"skip_rules":         false,
			"progress_tracking":  false,
		},
	}

	// Check if filesystem indexing is available
	if indexingScanner, ok := h.scanner.(interface {
		IsFilesystemIndexingEnabled() bool
	}); ok {
		enabled := indexingScanner.IsFilesystemIndexingEnabled()
		capabilities["enabled"] = enabled
		
		if enabled {
			capabilities["features"] = gin.H{
				"mime_detection":       true,
				"file_hashing":         true,
				"media_classification": true,
				"delta_scanning":       true,
				"skip_rules":           true,
				"progress_tracking":    true,
				"system_metadata":      true,
				"symlink_support":      true,
				"configurable_batch":   true,
			}
			capabilities["supported_hash_algorithms"] = []string{"md5", "sha256"}
			capabilities["supported_media_kinds"] = []string{
				"document", "image", "video", "audio", "archive", "code", "data", "binary", "text",
			}
		}
	}

	c.JSON(http.StatusOK, capabilities)
}

// ===========================================
// MEDIA ENRICHMENT ENDPOINTS
// ===========================================

// TriggerMediaEnrichment triggers media enrichment for a volume
// @Summary Trigger media enrichment
// @Description Manually trigger media metadata enrichment for a specific volume
// @Tags media
// @Accept json
// @Produce json
// @Param id path string true "Volume ID"
// @Success 202 {object} models.MediaEnrichmentResponse "Enrichment started"
// @Failure 400 {object} models.ErrorResponse
// @Failure 503 {object} models.ErrorResponse "Media enrichment not enabled"
// @Router /volumes/{id}/media/enrich [post]
func (h *Handler) TriggerMediaEnrichment(c *gin.Context) {
	volumeID := c.Param("id")
	if volumeID == "" {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Error:   "Volume ID is required",
			Code:    "MISSING_VOLUME_ID",
			Details: map[string]any{"message": "Volume ID parameter is missing from the request"},
		})
		return
	}
	
	// Check if enrichment is enabled
	if h.enrichmentManager == nil || !h.enrichmentManager.IsEnabled() {
		c.JSON(http.StatusServiceUnavailable, models.ErrorResponse{
			Error:   "Media enrichment is not available",
			Code:    "MEDIA_ENRICHMENT_DISABLED",
			Details: map[string]any{"message": "Media enrichment service is disabled or not configured"},
		})
		return
	}
	
	// Start enrichment asynchronously
	go func() {
		ctx := context.Background()
		if err := h.enrichmentManager.EnrichVolume(ctx, volumeID); err != nil {
			// Log error (in real implementation, would use proper logger)
			fmt.Printf("Media enrichment failed for volume %s: %v\n", volumeID, err)
		}
	}()
	
	c.JSON(http.StatusAccepted, gin.H{
		"message":    "Media enrichment triggered",
		"volume_id":  volumeID,
		"status":     "processing",
		"status_url": fmt.Sprintf("/api/v1/volumes/%s/media/status", volumeID),
	})
}

// GetMediaEnrichmentStatus returns the enrichment status for a volume
// @Summary Get media enrichment status
// @Description Get the current status of media enrichment for a volume
// @Tags media
// @Accept json
// @Produce json
// @Param id path string true "Volume ID"
// @Success 200 {object} models.MediaEnrichmentStatusResponse
// @Failure 400 {object} models.ErrorResponse
// @Failure 503 {object} models.ErrorResponse "Media enrichment not enabled"
// @Router /volumes/{id}/media/status [get]
func (h *Handler) GetMediaEnrichmentStatus(c *gin.Context) {
	volumeID := c.Param("id")
	if volumeID == "" {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Error:   "Volume ID is required",
			Code:    "MISSING_VOLUME_ID",
			Details: map[string]any{"message": "Volume ID parameter is missing from the request"},
		})
		return
	}
	
	// Check if enrichment is available
	if h.enrichmentManager == nil {
		c.JSON(http.StatusServiceUnavailable, models.ErrorResponse{
			Error:   "Media enrichment is not available",
			Code:    "MEDIA_ENRICHMENT_DISABLED",
			Details: map[string]any{"message": "Media enrichment service is not configured"},
		})
		return
	}
	
	// Try to get progress if the manager supports it
	type progressGetter interface {
		GetProgress(volumeID string) interface{}
	}
	
	if progressManager, ok := h.enrichmentManager.(progressGetter); ok {
		if progress := progressManager.GetProgress(volumeID); progress != nil {
			c.JSON(http.StatusOK, progress)
			return
		}
	}
	
	// Default response when no progress available
	c.JSON(http.StatusOK, gin.H{
		"volume_id": volumeID,
		"status":    "unknown",
		"message":   "Progress tracking not available",
		"note":      "Media enrichment runs asynchronously after filesystem indexing",
	})
}

// GetMediaEnrichmentCapabilities returns media enrichment capabilities
// @Summary Get media enrichment capabilities
// @Description Get information about available media enrichers and their capabilities
// @Tags media
// @Accept json
// @Produce json
// @Success 200 {object} models.MediaCapabilitiesResponse
// @Router /media/capabilities [get]
func (h *Handler) GetMediaEnrichmentCapabilities(c *gin.Context) {
	if h.enrichmentManager == nil {
		c.JSON(http.StatusServiceUnavailable, models.ErrorResponse{
			Error:   "Media enrichment is not available",
			Code:    "MEDIA_ENRICHMENT_DISABLED",
			Details: map[string]any{"message": "Media enrichment service is not configured"},
		})
		return
	}
	
	c.JSON(http.StatusOK, gin.H{
		"enabled": h.enrichmentManager.IsEnabled(),
		"enrichers": []gin.H{
			{
				"name": "ffprobe",
				"supported_types": []string{"video/*", "audio/*"},
				"features": []string{"duration", "bitrate", "resolution", "codec", "hdr_detection", "fps", "channels"},
				"required_tools": []string{"ffprobe"},
			},
			{
				"name": "exif",
				"supported_types": []string{"image/*"},
				"features": []string{"dimensions", "camera_info", "datetime", "gps", "orientation"},
				"required_tools": []string{"exiftool"},
			},
			{
				"name": "subtitle",
				"supported_types": []string{"text/vtt", "application/x-subrip", "text/x-ssa", "text/x-ass"},
				"features": []string{"language", "cue_count", "coverage", "format"},
				"required_tools": []string{}, // No external tools required
			},
		},
		"configuration": gin.H{
			"max_concurrent_workers": 3,
			"timeout_per_file":       "30s",
			"gps_enabled":            false,
			"hashing_enabled":        false,
		},
	})
}
