package snapshots

import (
	"fmt"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/mantonx/volumeviz/internal/store"
)

// Handler handles snapshot-related API requests
type Handler struct {
	store store.Store
}

// NewHandler creates a new snapshots handler
func NewHandler(store store.Store) *Handler {
	return &Handler{
		store: store,
	}
}

// GetStats returns aggregate snapshot statistics
// @Summary Get snapshot statistics
// @Description Get aggregate statistics about volume snapshots
// @Tags snapshots
// @Produce json
// @Success 200 {object} map[string]interface{}
// @Failure 500 {object} map[string]interface{}
// @Router /snapshots/stats [get]
func (h *Handler) GetStats(c *gin.Context) {
	ctx := c.Request.Context()

	stats, err := h.store.Snapshots().GetStats(ctx)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to get snapshot statistics",
			"detail": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"total_snapshots":       stats.TotalSnapshots,
		"total_volumes":         stats.TotalVolumes,
		"total_size_tracked":    stats.TotalSizeTracked,
		"total_files_tracked":   stats.TotalFilesTracked,
		"avg_scan_duration_ms":  stats.AvgScanDurationMS,
	})
}

// GetVolumeSnapshots returns snapshots for a specific volume
// @Summary Get volume snapshots
// @Description Get snapshot history for a specific volume
// @Tags snapshots
// @Produce json
// @Param volume_id path string true "Volume ID"
// @Param limit query int false "Limit number of results" default(10)
// @Success 200 {object} map[string]interface{}
// @Failure 400 {object} map[string]interface{}
// @Failure 500 {object} map[string]interface{}
// @Router /snapshots/volumes/{volume_id} [get]
func (h *Handler) GetVolumeSnapshots(c *gin.Context) {
	ctx := c.Request.Context()
	volumeID := c.Param("volume_id")

	if volumeID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "volume_id is required",
		})
		return
	}

	// Get limit from query params (default 10)
	limit := 10
	if limitStr := c.Query("limit"); limitStr != "" {
		if l, err := c.GetQuery("limit"); err {
			if parsed, parseErr := parseLimit(l); parseErr == nil {
				limit = parsed
			}
		}
	}

	snapshots, err := h.store.Snapshots().GetSnapshots(ctx, volumeID, limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to get volume snapshots",
			"detail": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"volume_id": volumeID,
		"count":     len(snapshots),
		"snapshots": snapshots,
	})
}

// GetLatestSnapshot returns the latest snapshot for a volume
// @Summary Get latest snapshot
// @Description Get the most recent snapshot for a specific volume
// @Tags snapshots
// @Produce json
// @Param volume_id path string true "Volume ID"
// @Success 200 {object} map[string]interface{}
// @Failure 400 {object} map[string]interface{}
// @Failure 404 {object} map[string]interface{}
// @Failure 500 {object} map[string]interface{}
// @Router /snapshots/volumes/{volume_id}/latest [get]
func (h *Handler) GetLatestSnapshot(c *gin.Context) {
	ctx := c.Request.Context()
	volumeID := c.Param("volume_id")

	if volumeID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "volume_id is required",
		})
		return
	}

	snapshot, err := h.store.Snapshots().GetLatestSnapshot(ctx, volumeID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error": "No snapshot found for volume",
			"volume_id": volumeID,
		})
		return
	}

	c.JSON(http.StatusOK, snapshot)
}

// RegisterRoutes registers snapshot routes
func (h *Handler) RegisterRoutes(router *gin.RouterGroup) {
	snapshots := router.Group("/snapshots")
	{
		snapshots.GET("/stats", h.GetStats)
		snapshots.GET("/volumes/:volume_id", h.GetVolumeSnapshots)
		snapshots.GET("/volumes/:volume_id/latest", h.GetLatestSnapshot)
	}
}

func parseLimit(s string) (int, error) {
	var limit int
	if _, err := fmt.Sscanf(s, "%d", &limit); err != nil {
		return 10, err
	}
	if limit < 1 {
		limit = 1
	}
	if limit > 100 {
		limit = 100
	}
	return limit, nil
}
