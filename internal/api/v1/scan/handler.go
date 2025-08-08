// Package scan provides HTTP handlers for volume scanning operations
// Handles size calculations and performance metrics
package scan

import (
	"fmt"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/mantonx/volumeviz/internal/api/models"
	"github.com/mantonx/volumeviz/internal/core/interfaces"
	"github.com/mantonx/volumeviz/internal/database"
	"github.com/mantonx/volumeviz/internal/utils"
	"github.com/mantonx/volumeviz/internal/websocket"
	coremodels "github.com/mantonx/volumeviz/internal/core/models"
)

// Handler handles scan-related HTTP requests
// Provides endpoints for volume size scanning and metrics
type Handler struct {
	scanner       interfaces.VolumeScanner
	hub           *websocket.Hub
	metricsRepo   *database.VolumeMetricsRepository
}

// NewHandler creates a new scan handler
// Pass in your volume scanner implementation, WebSocket hub, and metrics repository
func NewHandler(scanner interfaces.VolumeScanner, hub *websocket.Hub, metricsRepo *database.VolumeMetricsRepository) *Handler {
	return &Handler{
		scanner:     scanner,
		hub:         hub,
		metricsRepo: metricsRepo,
	}
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

	// Save historical metrics if repository is available
	if h.metricsRepo != nil {
		err := h.metricsRepo.SaveMetrics(
			c.Request.Context(),
			volumeID,
			result.TotalSize,
			int64(result.FileCount),
			int64(result.DirectoryCount),
			result.Method,
		)
		if err != nil {
			// Log error but don't fail the request
			// In production, use proper logging
			fmt.Printf("Failed to save metrics for volume %s: %v\n", volumeID, err)
		}
	}

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
			"details": "Volume ID parameter is missing from the request",
		})
		return
	}

	var req coremodels.RefreshRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		// If JSON binding fails, use defaults
		req.Async = false
	}

	if req.Async {
		scanID, err := h.scanner.ScanVolumeAsync(c.Request.Context(), volumeID)
		if err != nil {
			h.handleScanError(c, err)
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

	result, err := h.scanner.ScanVolume(c.Request.Context(), volumeID)
	if err != nil {
		h.handleScanError(c, err)
		// Broadcast scan error via WebSocket
		if h.hub != nil {
			h.hub.BroadcastScanError(volumeID, err.Error(), "SCAN_ERROR")
		}
		return
	}

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

	c.JSON(http.StatusOK, gin.H{
		"message": "Volume size refreshed",
		"result":  result,
	})
}

// GetScanStatus returns the status of an async scan by volume ID
// GET /api/v1/volumes/:id/scan/status
func (h *Handler) GetScanStatus(c *gin.Context) {
	volumeID := c.Param("id")

	if volumeID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "Volume ID is required",
			"code":    "MISSING_VOLUME_ID",
			"details": "Volume ID parameter is missing from the request",
		})
		return
	}

	// Try to get scan progress by volume ID
	// First, try to cast scanner to access volume-based method
	if volumeScanner, ok := h.scanner.(interface {
		GetScanProgressByVolume(volumeID string) (*interfaces.ScanProgress, error)
	}); ok {
		progress, err := volumeScanner.GetScanProgressByVolume(volumeID)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{
				"error":   "No active scan found for volume",
				"code":    "NO_ACTIVE_SCAN",
				"details": fmt.Sprintf("No active scan found for volume %s", volumeID),
			})
			return
		}
		c.JSON(http.StatusOK, progress)
		return
	}

	// Fallback to old method if new interface not available
	c.JSON(http.StatusNotFound, gin.H{
		"error":   "No active scan found for volume",
		"code":    "NO_ACTIVE_SCAN",
		"details": fmt.Sprintf("No active scan found for volume %s", volumeID),
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
			"error":   "At least one volume ID is required",
			"code":    "EMPTY_VOLUME_LIST",
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

	case coremodels.ErrorCodeScanCancelled:
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