// Package scan provides HTTP handlers for volume scanning operations
// Handles size calculations and performance metrics
package scan

import (
	"context"
	"fmt"
	"net/http"
	"strconv"
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
)

// Handler handles scan-related HTTP requests
// Provides endpoints for volume size scanning and metrics
type Handler struct {
	scanner           interfaces.VolumeScanner
	store             store.Store             // New sqlc-based store
	scheduler         scheduler.ScanScheduler // Optional scheduler for manual scan triggers
	realtimePublisher *realtime.Broadcaster
	enrichmentManager interfaces.EnrichmentManager // Media enrichment manager
}

// NewHandler creates a new scan handler
// Pass in your volume scanner implementation, WebSocket hub, optional scheduler, and realtime publisher
func NewHandler(scanner interfaces.VolumeScanner, scheduler scheduler.ScanScheduler, publisher *realtime.Broadcaster) *Handler {
	return NewHandlerWithStore(scanner, nil, scheduler, publisher)
}

// NewHandlerWithStore creates a new scan handler with optional store integration
func NewHandlerWithStore(scanner interfaces.VolumeScanner, storeInstance store.Store, scheduler scheduler.ScanScheduler, publisher *realtime.Broadcaster) *Handler {
	return &Handler{
		scanner:           scanner,
		store:             storeInstance,
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
func (h *Handler) GetSizeAnalysisStatus(c *gin.Context) {
	volumeID := c.Param("name")

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
		// Scan error broadcasting is now handled by the scheduler's realtime broadcaster
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

	// Scan completion broadcasting is now handled by the scheduler's realtime broadcaster

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
	volumeID := c.Param("name")

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

// GetScanProgress returns comprehensive progress information for a scan
// GET /api/v1/scans/{scanId}/progress
// @Summary Get detailed scan progress with sub-phase information
// @Description Get comprehensive progress information including phases, sub-phases, items, errors, and confidence indicators
// @Tags scan
// @Accept json
// @Produce json
// @Param scanId path string true "Scan ID"
// @Success 200 {object} map[string]interface{} "Comprehensive scan progress with sub-phase details"
// @Failure 400 {object} models.ErrorResponse
// @Failure 404 {object} models.ErrorResponse
// @Router /scans/{scanId}/progress [get]
func (h *Handler) GetScanProgress(c *gin.Context) {
	scanID := c.Param("id")
	if scanID == "" {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Error:   "Scan ID is required",
			Code:    "MISSING_SCAN_ID",
			Details: map[string]any{"message": "Scan ID parameter is missing from the request"},
		})
		return
	}

	if h.store == nil {
		c.JSON(http.StatusServiceUnavailable, models.ErrorResponse{
			Error:   "Progress tracking not available",
			Code:    "PROGRESS_TRACKING_DISABLED",
			Details: map[string]any{"message": "Database progress tracking is not configured"},
		})
		return
	}

	scanProgressRepo := h.store.ScanProgress()

	// Get scan phases
	phases, err := scanProgressRepo.GetScanPhases(c.Request.Context(), scanID)
	if err != nil {
		c.JSON(http.StatusNotFound, models.ErrorResponse{
			Error:   "Scan not found",
			Code:    "SCAN_NOT_FOUND",
			Details: map[string]any{"message": fmt.Sprintf("No scan found with ID %s", scanID), "scan_id": scanID},
		})
		return
	}

	if len(phases) == 0 {
		c.JSON(http.StatusNotFound, models.ErrorResponse{
			Error:   "No progress data found",
			Code:    "NO_PROGRESS_DATA",
			Details: map[string]any{"message": "Scan exists but no progress data available", "scan_id": scanID},
		})
		return
	}

	// Get scan errors
	errorPointers, err := scanProgressRepo.GetScanErrors(c.Request.Context(), scanID, "", 100, 0)
	if err != nil {
		// Log error but don't fail - errors are optional
		errorPointers = []*coremodels.ScanProgressError{}
	}

	// Convert from pointers to values
	errors := make([]coremodels.ScanProgressError, len(errorPointers))
	for i, errorPtr := range errorPointers {
		if errorPtr != nil {
			errors[i] = *errorPtr
		}
	}

	// Populate error messages in phases based on recent errors
	phaseErrorMap := make(map[string]string)
	for _, err := range errors {
		if err.PhaseName != "" {
			if existingMsg, exists := phaseErrorMap[err.PhaseName]; exists {
				// Keep the first (most recent) error message for each phase
				if existingMsg == "" {
					phaseErrorMap[err.PhaseName] = err.ErrorMessage
				}
			} else {
				phaseErrorMap[err.PhaseName] = err.ErrorMessage
			}
		}
	}

	// Update phases with error messages
	for i := range phases {
		if errorMsg, exists := phaseErrorMap[phases[i].PhaseName]; exists && errorMsg != "" {
			phases[i].ErrorMessage = errorMsg
		}
	}

	// Get the overall status from the scan_jobs table (single source of truth)
	var overallStatus string = "unknown"
	var volumeID string
	if scansRepo := h.store.Scans(); scansRepo != nil {
		if scanJob, err := scansRepo.GetScanJobByScanID(c.Request.Context(), scanID); err == nil {
			overallStatus = scanJob.Status
			volumeID = scanJob.VolumeID
		}
	}

	// Calculate overall progress from phase data
	var overallProgress float64 = 0.0
	phaseWeights := map[string]float64{
		"volume_scan":         0.15, // 15%
		"filesystem_indexing": 0.70, // 70%
		"media_enrichment":    0.15, // 15%
	}

	totalWeight := 0.0
	weightedProgress := 0.0

	for _, phase := range phases {
		if weight, exists := phaseWeights[phase.PhaseName]; exists {
			totalWeight += weight

			// Calculate phase progress based on status and progress
			var phaseProgress float64
			switch phase.Status {
			case "completed":
				phaseProgress = 100.0
			case "failed":
				// Failed phases still contribute their partial progress
				phaseProgress = float64(phase.Progress)
			case "running":
				phaseProgress = float64(phase.Progress)
			case "pending", "skipped":
				phaseProgress = 0.0
			default:
				phaseProgress = 0.0
			}

			weightedProgress += weight * phaseProgress
		}
	}

	// Calculate final overall progress
	if totalWeight > 0 {
		overallProgress = weightedProgress / totalWeight
	}

	// For completed scans, ensure 100% progress
	if overallStatus == "completed" {
		overallProgress = 100.0
	}

	// Get timing information
	var startedAt, completedAt *time.Time
	if len(phases) > 0 {
		// Use earliest start time
		for _, phase := range phases {
			if phase.StartedAt != nil && (startedAt == nil || phase.StartedAt.Before(*startedAt)) {
				startedAt = phase.StartedAt
			}
		}
		// Use latest completion time
		for _, phase := range phases {
			if phase.CompletedAt != nil && (completedAt == nil || phase.CompletedAt.After(*completedAt)) {
				completedAt = phase.CompletedAt
			}
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"scan_id":           scanID,
		"volume_id":         volumeID,
		"overall_status":    overallStatus,
		"overall_progress":  overallProgress,
		"started_at":        startedAt,
		"completed_at":      completedAt,
		"phases":            phases,
		"recent_errors":     errors,
		"performance_stats": h.calculatePerformanceStats(phases, overallStatus, startedAt),
	})
}

// calculatePerformanceStats computes performance metrics for a scan
func (h *Handler) calculatePerformanceStats(phases []coremodels.ScanPhase, status string, startedAt *time.Time) gin.H {
	// Default values
	stats := gin.H{
		"total_phases":                len(phases),
		"total_items":                 0,
		"total_errors":                0,
		"elapsed_seconds":             0,
		"estimated_remaining_seconds": 0,
		"overall_items_per_second":    0.0,
		"overall_bytes_per_second":    0,
		"error_rate":                  0.0,
	}

	if len(phases) == 0 {
		return stats
	}

	// Calculate totals across all phases
	totalItemsProcessed := int64(0)
	totalItemsTotal := int64(0)
	totalBytesProcessed := int64(0)
	totalErrors := int64(0)
	var earliestStartTime *time.Time

	for _, phase := range phases {
		totalItemsProcessed += phase.ItemsProcessed
		totalItemsTotal += phase.ItemsTotal
		totalBytesProcessed += phase.BytesProcessed
		totalErrors += phase.ErrorCount

		// Find earliest start time
		if phase.StartedAt != nil {
			startTime := *phase.StartedAt
			if earliestStartTime == nil || startTime.Before(*earliestStartTime) {
				earliestStartTime = &startTime
			}
		}
	}

	// Calculate elapsed time
	var elapsedSeconds int
	if earliestStartTime != nil {
		elapsed := time.Since(*earliestStartTime)
		elapsedSeconds = int(elapsed.Seconds())
	}

	// Calculate rates (avoid division by zero)
	var itemsPerSecond float64
	var bytesPerSecond int64
	if elapsedSeconds > 0 {
		itemsPerSecond = float64(totalItemsProcessed) / float64(elapsedSeconds)
		bytesPerSecond = totalBytesProcessed / int64(elapsedSeconds)
	}

	// Estimate remaining time based on current progress
	var estimatedRemainingSeconds int
	if itemsPerSecond > 0 && totalItemsTotal > totalItemsProcessed {
		remainingItems := totalItemsTotal - totalItemsProcessed
		estimatedRemainingSeconds = int(float64(remainingItems) / itemsPerSecond)
	}

	// Error rate (errors per minute)
	var errorRate float64
	if elapsedSeconds > 0 {
		errorRate = float64(totalErrors) * 60.0 / float64(elapsedSeconds)
	}

	// Calculate confidence based on progress and time stability
	confidence := "low"
	if totalItemsProcessed > 0 && elapsedSeconds > 30 {
		// Calculate progress percentage
		progressPercent := 0.0
		if totalItemsTotal > 0 {
			progressPercent = (float64(totalItemsProcessed) / float64(totalItemsTotal)) * 100.0
		}
		
		// Use a simple confidence calculation similar to the one in scan utilities
		timeStability := 1.0 // We don't have variance data here, so assume stable
		if elapsedSeconds > 300 { // 5 minutes
			timeStability = 0.8
		}
		
		progressFactor := progressPercent / 100.0
		confidenceScore := progressFactor * timeStability
		
		if confidenceScore > 0.7 {
			confidence = "high"
		} else if confidenceScore > 0.3 {
			confidence = "medium"
		}
	}

	// Update stats
	stats["total_items"] = totalItemsProcessed
	stats["total_errors"] = totalErrors
	stats["elapsed_seconds"] = elapsedSeconds
	stats["estimated_remaining_seconds"] = estimatedRemainingSeconds
	stats["estimation_confidence"] = confidence
	stats["overall_items_per_second"] = itemsPerSecond
	stats["overall_bytes_per_second"] = bytesPerSecond
	stats["error_rate"] = errorRate

	return stats
}

// GetScanStatus returns the status of an async scan.
// Supports both routes:
// - GET /api/v1/volumes/:id/scan/status (id = volumeID)
// - GET /api/v1/scans/:id/status (id = scanID)
// @Summary Get scan status
// @Description Get the status of a volume scan by volume ID or scan ID
// @Tags scan
// @Accept json
// @Produce json
// @Param id path string true "Volume ID or Scan ID"
// @Success 200 {object} map[string]interface{} "Scan status information"
// @Failure 400 {object} map[string]interface{} "Bad request"
// @Failure 404 {object} map[string]interface{} "Scan not found"
// @Failure 500 {object} map[string]interface{} "Internal server error"
// @Router /scans/{id}/status [get]
// @Router /volumes/{id}/scan/status [get]
func (h *Handler) GetScanStatus(c *gin.Context) {
	id := c.Param("name")
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
// @Summary Bulk scan volumes
// @Description Scan multiple volumes at once, with support for async processing
// @Tags scan
// @Accept json
// @Produce json
// @Param request body models.BulkScanRequest true "Bulk scan request"
// @Success 200 {object} map[string]interface{} "Bulk scan results"
// @Failure 400 {object} map[string]interface{} "Bad request"
// @Failure 500 {object} map[string]interface{} "Internal server error"
// @Router /volumes/bulk-scan [post]
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
		"hardened_mode":    h.scheduler.IsHardenedMode(),
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
// @Param volumeId path string true "Volume ID"
// @Success 200 {object} models.FilesystemIndexingResponse
// @Failure 400 {object} models.ErrorResponse
// @Failure 404 {object} models.ErrorResponse
// @Failure 503 {object} models.ErrorResponse "Filesystem indexing not enabled"
// @Router /volumes/{volumeId}/filesystem/status [get]
func (h *Handler) GetFilesystemIndexingStatus(c *gin.Context) {
	volumeID := c.Param("volumeId")
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
			"volume_id":       progress.VolumeID,
			"status":          progress.Status,
			"started_at":      progress.StartedAt,
			"last_update":     progress.LastUpdate,
			"folders_scanned": progress.FoldersScanned,
			"files_scanned":   progress.FilesScanned,
			"bytes_processed": progress.BytesProcessed,
			"errors_count":    progress.ErrorsCount,
			"current_path":    progress.CurrentPath,
			"current_depth":   progress.CurrentDepth,
			"folders_per_sec": progress.FoldersPerSec,
			"files_per_sec":   progress.FilesPerSec,
			"last_error":      progress.LastError,
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
	volumeID := c.Param("name")
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
		TriggerFilesystemIndexing(ctx context.Context, volumeID string, deltaMode bool) error
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

		// Trigger filesystem indexing
		if err := indexingScanner.TriggerFilesystemIndexing(c.Request.Context(), volumeID, req.DeltaMode); err != nil {
			c.JSON(http.StatusInternalServerError, models.ErrorResponse{
				Error:   "Failed to trigger filesystem indexing",
				Code:    "INDEXING_TRIGGER_FAILED",
				Details: map[string]any{"message": err.Error()},
			})
			return
		}

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
			"mime_detection":       false,
			"file_hashing":         false,
			"media_classification": false,
			"delta_scanning":       false,
			"skip_rules":           false,
			"progress_tracking":    false,
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
	volumeID := c.Param("name")
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
	volumeID := c.Param("name")
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

// GetScanErrors returns scan errors with filtering and pagination
// GET /api/v1/scans/{scanId}/errors
// @Summary Get scan errors
// @Description Get detailed error information for a scan with filtering and pagination
// @Tags scan
// @Accept json
// @Produce json
// @Param scanId path string true "Scan ID"
// @Param phase query string false "Filter by phase name"
// @Param error_type query string false "Filter by error type"
// @Param limit query int false "Limit number of results (default: 50)"
// @Param offset query int false "Offset for pagination (default: 0)"
// @Success 200 {object} map[string]interface{} "Scan errors with pagination"
// @Failure 400 {object} models.ErrorResponse
// @Failure 404 {object} models.ErrorResponse
// @Router /scans/{scanId}/errors [get]
func (h *Handler) GetScanErrors(c *gin.Context) {
	scanID := c.Param("id")
	if scanID == "" {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Error:   "Scan ID is required",
			Code:    "MISSING_SCAN_ID",
			Details: map[string]any{"message": "Scan ID parameter is missing from the request"},
		})
		return
	}

	if h.store == nil {
		c.JSON(http.StatusServiceUnavailable, models.ErrorResponse{
			Error:   "Progress tracking not available",
			Code:    "PROGRESS_TRACKING_DISABLED",
			Details: map[string]any{"message": "Database progress tracking is not configured"},
		})
		return
	}

	// Parse query parameters
	phaseFilter := c.Query("phase")
	errorTypeFilter := c.Query("error_type")
	limit := 50 // Default limit
	if limitParam := c.Query("limit"); limitParam != "" {
		if l, err := strconv.Atoi(limitParam); err == nil && l > 0 && l <= 200 {
			limit = l
		}
	}
	offset := 0
	if offsetParam := c.Query("offset"); offsetParam != "" {
		if o, err := strconv.Atoi(offsetParam); err == nil && o >= 0 {
			offset = o
		}
	}

	scanProgressRepo := h.store.ScanProgress()

	// Get filtered errors
	errors, err := scanProgressRepo.GetScanErrorsFiltered(c.Request.Context(), coremodels.ScanErrorFilterParams{
		ScanID:    scanID,
		PhaseName: phaseFilter,
		ErrorType: errorTypeFilter,
		Limit:     limit,
		Offset:    offset,
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{
			Error:   "Failed to retrieve scan errors",
			Code:    "SCAN_ERRORS_RETRIEVAL_FAILED",
			Details: map[string]any{"message": err.Error(), "scan_id": scanID},
		})
		return
	}

	// Get total count for pagination
	totalCount, err := scanProgressRepo.GetScanErrorsCount(c.Request.Context(), scanID, phaseFilter, errorTypeFilter)
	if err != nil {
		totalCount = int64(len(errors)) // Fallback to current result count
	}

	c.JSON(http.StatusOK, gin.H{
		"scan_id": scanID,
		"errors":  errors,
		"pagination": gin.H{
			"limit":       limit,
			"offset":      offset,
			"total":       totalCount,
			"has_next":    int64(offset+limit) < totalCount,
			"has_prev":    offset > 0,
			"next_offset": offset + limit,
			"prev_offset": max(0, offset-limit),
		},
		"filters": gin.H{
			"phase":      phaseFilter,
			"error_type": errorTypeFilter,
		},
	})
}

// GetActiveScans returns all currently active scans
// GET /api/v1/scans/active
// @Summary Get active scans
// @Description Get list of all currently active/running scans
// @Tags scan
// @Accept json
// @Produce json
// @Param limit query int false "Limit number of results (default: 20)"
// @Param offset query int false "Offset for pagination (default: 0)"
// @Success 200 {object} map[string]interface{} "Active scans with pagination"
// @Failure 500 {object} models.ErrorResponse
// @Router /scans/active [get]
func (h *Handler) GetActiveScans(c *gin.Context) {
	if h.store == nil {
		c.JSON(http.StatusServiceUnavailable, models.ErrorResponse{
			Error:   "Progress tracking not available",
			Code:    "PROGRESS_TRACKING_DISABLED",
			Details: map[string]any{"message": "Database progress tracking is not configured"},
		})
		return
	}

	// Parse pagination parameters
	limit := 20 // Default limit
	if limitParam := c.Query("limit"); limitParam != "" {
		if l, err := strconv.Atoi(limitParam); err == nil && l > 0 && l <= 100 {
			limit = l
		}
	}
	offset := 0
	if offsetParam := c.Query("offset"); offsetParam != "" {
		if o, err := strconv.Atoi(offsetParam); err == nil && o >= 0 {
			offset = o
		}
	}

	scanProgressRepo := h.store.ScanProgress()

	// Get active scans
	activeScans, err := scanProgressRepo.GetActiveScans(c.Request.Context(), limit, offset)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{
			Error:   "Failed to retrieve active scans",
			Code:    "ACTIVE_SCANS_RETRIEVAL_FAILED",
			Details: map[string]any{"message": err.Error()},
		})
		return
	}

	// Get total count
	totalCount, err := scanProgressRepo.GetActiveScansCount(c.Request.Context())
	if err != nil {
		totalCount = int64(len(activeScans)) // Fallback
	}

	c.JSON(http.StatusOK, gin.H{
		"active_scans": activeScans,
		"pagination": gin.H{
			"limit":       limit,
			"offset":      offset,
			"total":       totalCount,
			"has_next":    int64(offset+limit) < totalCount,
			"has_prev":    offset > 0,
			"next_offset": offset + limit,
			"prev_offset": max(0, offset-limit),
		},
		"summary": gin.H{
			"total_active":       totalCount,
			"current_page_count": len(activeScans),
		},
	})
}

// GetRecentScanErrors returns recent scan errors across all scans
// GET /api/v1/scans/recent-errors
// @Summary Get recent scan errors
// @Description Get recent scan errors across all scans with filtering
// @Tags scan
// @Accept json
// @Produce json
// @Param hours query int false "Hours back to search (default: 24)"
// @Param error_type query string false "Filter by error type"
// @Param phase query string false "Filter by phase name"
// @Param limit query int false "Limit number of results (default: 50)"
// @Success 200 {object} map[string]interface{} "Recent scan errors"
// @Failure 500 {object} models.ErrorResponse
// @Router /scans/recent-errors [get]
func (h *Handler) GetRecentScanErrors(c *gin.Context) {
	if h.store == nil {
		c.JSON(http.StatusServiceUnavailable, models.ErrorResponse{
			Error:   "Progress tracking not available",
			Code:    "PROGRESS_TRACKING_DISABLED",
			Details: map[string]any{"message": "Database progress tracking is not configured"},
		})
		return
	}

	// Parse parameters
	hours := 24 // Default: last 24 hours
	if hoursParam := c.Query("hours"); hoursParam != "" {
		if h, err := strconv.Atoi(hoursParam); err == nil && h > 0 && h <= 168 { // Max 1 week
			hours = h
		}
	}

	errorTypeFilter := c.Query("error_type")
	phaseFilter := c.Query("phase")
	limit := 50
	if limitParam := c.Query("limit"); limitParam != "" {
		if l, err := strconv.Atoi(limitParam); err == nil && l > 0 && l <= 200 {
			limit = l
		}
	}

	scanProgressRepo := h.store.ScanProgress()

	// Get recent errors
	recentErrors, err := scanProgressRepo.GetRecentScanErrors(c.Request.Context(), coremodels.RecentErrorsParams{
		HoursBack: hours,
		ErrorType: errorTypeFilter,
		PhaseName: phaseFilter,
		Limit:     limit,
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{
			Error:   "Failed to retrieve recent scan errors",
			Code:    "RECENT_ERRORS_RETRIEVAL_FAILED",
			Details: map[string]any{"message": err.Error()},
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"recent_errors": recentErrors,
		"parameters": gin.H{
			"hours_back": hours,
			"error_type": errorTypeFilter,
			"phase":      phaseFilter,
			"limit":      limit,
		},
		"summary": gin.H{
			"total_errors": len(recentErrors),
			"time_range":   fmt.Sprintf("Last %d hours", hours),
		},
	})
}

// calculateOverallStatus determines overall scan status from phases
func (h *Handler) calculateOverallStatus(phases []coremodels.ScanPhase) string {
	if len(phases) == 0 {
		return "unknown"
	}

	hasRunning := false
	hasFailed := false
	completedCount := 0

	for _, phase := range phases {
		switch phase.Status {
		case "running", "pending":
			hasRunning = true
		case "failed":
			hasFailed = true
		case "completed":
			completedCount++
		}
	}

	if hasRunning {
		return "running"
	}
	if hasFailed {
		return "failed"
	}
	if completedCount == len(phases) {
		return "completed"
	}
	return "partial"
}

// max returns the maximum of two integers
func max(a, b int) int {
	if a > b {
		return a
	}
	return b
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
				"name":            "ffprobe",
				"supported_types": []string{"video/*", "audio/*"},
				"features":        []string{"duration", "bitrate", "resolution", "codec", "hdr_detection", "fps", "channels"},
				"required_tools":  []string{"ffprobe"},
			},
			{
				"name":            "exif",
				"supported_types": []string{"image/*"},
				"features":        []string{"dimensions", "camera_info", "datetime", "gps", "orientation"},
				"required_tools":  []string{"exiftool"},
			},
			{
				"name":            "subtitle",
				"supported_types": []string{"text/vtt", "application/x-subrip", "text/x-ssa", "text/x-ass"},
				"features":        []string{"language", "cue_count", "coverage", "format"},
				"required_tools":  []string{}, // No external tools required
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
