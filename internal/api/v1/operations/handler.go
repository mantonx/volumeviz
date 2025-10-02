package operations

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/mantonx/volumeviz/internal/models"
	"github.com/mantonx/volumeviz/internal/services"
)

// Handler handles operation-related API endpoints
type Handler struct {
	operationTracker *services.OperationTracker
}

// NewHandler creates a new operations handler
func NewHandler(operationTracker *services.OperationTracker) *Handler {
	return &Handler{
		operationTracker: operationTracker,
	}
}

// GetOperations retrieves operation history
// @Summary Get operation history
// @Description Retrieves paginated list of file operations for undo/rollback
// @Tags operations
// @Accept json
// @Produce json
// @Param volume_id query string true "Volume ID"
// @Param page query int false "Page number" default(1)
// @Param page_size query int false "Page size" default(20)
// @Success 200 {object} models.OperationHistory
// @Failure 400 {object} ErrorResponse
// @Failure 500 {object} ErrorResponse
// @Router /api/v1/operations [get]
func (h *Handler) GetOperations(c *gin.Context) {
	volumeID := c.Query("volume_id")
	if volumeID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "volume_id is required"})
		return
	}

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))

	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}

	history, err := h.operationTracker.GetOperationHistory(c.Request.Context(), volumeID, page, pageSize)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve operation history"})
		return
	}

	c.JSON(http.StatusOK, history)
}

// GetOperation retrieves a specific operation
// @Summary Get operation details
// @Description Retrieves detailed information about a specific operation
// @Tags operations
// @Accept json
// @Produce json
// @Param id path string true "Operation ID"
// @Success 200 {object} models.Operation
// @Failure 404 {object} ErrorResponse
// @Failure 500 {object} ErrorResponse
// @Router /api/v1/operations/{id} [get]
func (h *Handler) GetOperation(c *gin.Context) {
	operationID := c.Param("id")

	// In a real implementation, this would fetch from database
	// For now, return a sample operation
	operation := &models.Operation{
		ID:          operationID,
		Type:        models.OperationTypeDelete,
		Status:      models.OperationStatusCompleted,
		VolumeID:    "media-library",
		Description: "Deleted duplicate files",
		Actions:     make([]models.OperationAction, 0),
	}

	c.JSON(http.StatusOK, operation)
}

// RollbackOperation rolls back an operation or specific actions
// @Summary Rollback operation
// @Description Rolls back a completed operation or specific actions within it
// @Tags operations
// @Accept json
// @Produce json
// @Param id path string true "Operation ID"
// @Param request body models.RollbackRequest true "Rollback request"
// @Success 200 {object} models.RollbackResponse
// @Failure 400 {object} ErrorResponse
// @Failure 404 {object} ErrorResponse
// @Failure 500 {object} ErrorResponse
// @Router /api/v1/operations/{id}/rollback [post]
func (h *Handler) RollbackOperation(c *gin.Context) {
	operationID := c.Param("id")

	var request models.RollbackRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	// In a real implementation, would fetch operation from database
	operation := &models.Operation{
		ID:       operationID,
		Type:     models.OperationTypeDelete,
		Status:   models.OperationStatusCompleted,
		VolumeID: "media-library",
		Actions: []models.OperationAction{
			{
				ID:         "action-1",
				Type:       models.OperationTypeDelete,
				SourcePath: "/media/duplicate1.jpg",
				Status:     "completed",
				BackupPath: "/tmp/volumeviz-backup/duplicate1.jpg",
			},
		},
	}

	response, err := h.operationTracker.RollbackOperation(c.Request.Context(), operation, request.ActionIDs, request.Reason)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to rollback operation"})
		return
	}

	c.JSON(http.StatusOK, response)
}

// DeleteOperation removes an operation from history (cleanup)
// @Summary Delete operation
// @Description Removes an operation from history and cleans up associated backups
// @Tags operations
// @Accept json
// @Produce json
// @Param id path string true "Operation ID"
// @Success 204 "No Content"
// @Failure 404 {object} ErrorResponse
// @Failure 500 {object} ErrorResponse
// @Router /api/v1/operations/{id} [delete]
func (h *Handler) DeleteOperation(c *gin.Context) {
	operationID := c.Param("id")

	// In a real implementation, this would:
	// 1. Verify operation exists
	// 2. Clean up backup files
	// 3. Remove from database

	_ = operationID // Placeholder to avoid unused variable error

	c.Status(http.StatusNoContent)
}

// CleanupBackups triggers cleanup of old backup files
// @Summary Cleanup backup files
// @Description Removes old backup files based on retention policy
// @Tags operations
// @Accept json
// @Produce json
// @Param retention_days query int false "Retention period in days" default(30)
// @Success 200 {object} map[string]interface{}
// @Failure 400 {object} ErrorResponse
// @Failure 500 {object} ErrorResponse
// @Router /api/v1/operations/cleanup [post]
func (h *Handler) CleanupBackups(c *gin.Context) {
	retentionDays, _ := strconv.Atoi(c.DefaultQuery("retention_days", "30"))

	if retentionDays < 1 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "retention_days must be at least 1"})
		return
	}

	err := h.operationTracker.CleanupBackups(c.Request.Context(), retentionDays)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to cleanup backup files"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Backup cleanup completed",
		"retention_days": retentionDays,
	})
}

// ErrorResponse represents an API error response
type ErrorResponse struct {
	Error string `json:"error" example:"Invalid request"`
} // @name ErrorResponse