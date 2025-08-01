package scan

import (
	"fmt"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/username/volumeviz/internal/core/interfaces"
	"github.com/username/volumeviz/internal/core/models"
)

// Handler handles scan-related HTTP requests
type Handler struct {
	scanner interfaces.VolumeScanner
}

// NewHandler creates a new scan handler
func NewHandler(scanner interfaces.VolumeScanner) *Handler {
	return &Handler{
		scanner: scanner,
	}
}

// GetVolumeSize returns volume size information
// GET /api/v1/volumes/:id/size
func (h *Handler) GetVolumeSize(c *gin.Context) {
	volumeID := c.Param("id")

	if volumeID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "Volume ID is required",
			"code":    "MISSING_VOLUME_ID",
			"details": "Volume ID parameter is missing from the request",
		})
		return
	}

	result, err := h.scanner.ScanVolume(c.Request.Context(), volumeID)
	if err != nil {
		h.handleScanError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"volume_id": volumeID,
		"result":    result,
		"cached":    result.CacheHit,
	})
}

// RefreshVolumeSize forces a refresh of volume size calculation
// POST /api/v1/volumes/:id/size/refresh
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

	var req models.RefreshRequest
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
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Volume size refreshed",
		"result":  result,
	})
}

// GetScanStatus returns the status of an async scan
// GET /api/v1/scans/:id/status
func (h *Handler) GetScanStatus(c *gin.Context) {
	scanID := c.Param("id")

	if scanID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "Scan ID is required",
			"code":    "MISSING_SCAN_ID",
			"details": "Scan ID parameter is missing from the request",
		})
		return
	}

	progress, err := h.scanner.GetScanProgress(scanID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error":   "Scan not found",
			"code":    "SCAN_NOT_FOUND",
			"details": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, progress)
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
	scanErr, ok := err.(*models.ScanError)
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
	case models.ErrorCodeScanQueueTimeout:
		response["suggestion"] = "Retry the request or scan smaller directories"
		c.JSON(http.StatusRequestTimeout, response)

	case models.ErrorCodePathValidationFailed:
		response["suggestion"] = "Ensure the volume exists and is accessible"
		c.JSON(http.StatusBadRequest, response)

	case models.ErrorCodeVolumeNotFound:
		response["suggestion"] = "Check that the volume ID is correct"
		c.JSON(http.StatusNotFound, response)

	case models.ErrorCodePermissionDenied:
		response["suggestion"] = "Check VolumeViz permissions for accessing the volume"
		c.JSON(http.StatusForbidden, response)

	case models.ErrorCodeAllMethodsFailed:
		response["suggestion"] = "Check VolumeViz permissions and available disk space"
		c.JSON(http.StatusInternalServerError, response)

	case models.ErrorCodeScanCancelled:
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

	if strings.Contains(volumeID, "..") || strings.Contains(volumeID, "/") {
		return fmt.Errorf("volume ID contains invalid characters")
	}

	if len(volumeID) > 255 {
		return fmt.Errorf("volume ID too long (max 255 characters)")
	}

	return nil
}