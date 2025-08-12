package trends

import (
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/mantonx/volumeviz/internal/services/snapshots"
	"github.com/mantonx/volumeviz/internal/store"
)

// Handler handles trends-related API requests
type Handler struct {
	store           store.Store
	snapshotService *snapshots.SnapshotService
}

// NewHandler creates a new trends handler
func NewHandler(store store.Store) *Handler {
	return &Handler{
		store:           store,
		snapshotService: snapshots.NewSnapshotService(store),
	}
}

// GetVolumeTrends returns trend analysis for a volume
// GET /trends/volumes/:volumeId?days=30
func (h *Handler) GetVolumeTrends(c *gin.Context) {
	volumeID := c.Param("volumeId")

	if volumeID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "volume_id is required",
			"code":    "MISSING_VOLUME_ID",
			"message": "volume_id parameter is required",
		})
		return
	}

	// Parse days parameter (default: 30)
	daysStr := c.DefaultQuery("days", "30")
	days := 30
	if parsed, err := strconv.Atoi(daysStr); err == nil && parsed > 0 && parsed <= 365 {
		days = parsed
	}

	// Get trends data
	trendsData, err := h.snapshotService.GetTrendsData(c.Request.Context(), volumeID, days)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "Failed to get trends data",
			"code":    "TRENDS_ERROR",
			"message": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data": trendsData,
		"meta": gin.H{
			"volume_id":    volumeID,
			"period_days":  days,
			"generated_at": time.Now(),
		},
	})
}

// GetVolumeGrowthDeltas returns growth deltas for a volume
// GET /trends/volumes/:volumeId/deltas?type=daily&limit=30
func (h *Handler) GetVolumeGrowthDeltas(c *gin.Context) {
	volumeID := c.Param("volumeId")

	if volumeID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "volume_id is required",
			"code":    "MISSING_VOLUME_ID",
			"message": "volume_id parameter is required",
		})
		return
	}

	// Parse query parameters
	snapshotType := c.DefaultQuery("type", "daily")
	if snapshotType != "daily" && snapshotType != "weekly" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "type must be 'daily' or 'weekly'",
			"code":    "INVALID_TYPE",
			"message": "snapshot type must be either 'daily' or 'weekly'",
		})
		return
	}

	limitStr := c.DefaultQuery("limit", "30")
	limit := 30
	if parsed, err := strconv.Atoi(limitStr); err == nil && parsed > 0 && parsed <= 100 {
		limit = parsed
	}

	// Calculate date range based on snapshot type and limit
	endDate := time.Now().UTC()
	var startDate time.Time
	if snapshotType == "daily" {
		startDate = endDate.AddDate(0, 0, -limit)
	} else {
		startDate = endDate.AddDate(0, 0, -limit*7) // weekly
	}

	// Get growth deltas
	deltas, err := h.store.GetGrowthDeltas(c.Request.Context(), store.GetGrowthDeltasParams{
		VolumeID:  volumeID,
		StartDate: startDate,
		EndDate:   endDate,
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "Failed to get growth deltas",
			"code":    "DELTAS_ERROR",
			"message": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data": deltas,
		"meta": gin.H{
			"volume_id":     volumeID,
			"snapshot_type": snapshotType,
			"limit":         limit,
			"generated_at":  time.Now(),
		},
	})
}

// GetVolumeStepSeries returns step series data for charting
// GET /trends/volumes/:volumeId/series?type=daily&days=30
func (h *Handler) GetVolumeStepSeries(c *gin.Context) {
	volumeID := c.Param("volumeId")

	if volumeID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "volume_id is required",
			"code":    "MISSING_VOLUME_ID",
			"message": "volume_id parameter is required",
		})
		return
	}

	// Parse query parameters
	snapshotType := c.DefaultQuery("type", "daily")
	if snapshotType != "daily" && snapshotType != "weekly" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "type must be 'daily' or 'weekly'",
			"code":    "INVALID_TYPE",
			"message": "snapshot type must be either 'daily' or 'weekly'",
		})
		return
	}

	daysStr := c.DefaultQuery("days", "30")
	days := 30
	if parsed, err := strconv.Atoi(daysStr); err == nil && parsed > 0 && parsed <= 365 {
		days = parsed
	}

	// Calculate date range
	endDate := time.Now().UTC().Truncate(24 * time.Hour)
	startDate := endDate.AddDate(0, 0, -days)

	// Get step series data
	series, err := h.store.GetVolumeStepSeries(c.Request.Context(), store.GetVolumeStepSeriesParams{
		VolumeID:  volumeID,
		StartDate: startDate,
		EndDate:   endDate,
		StepSize:  "day",
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "Failed to get step series",
			"code":    "SERIES_ERROR",
			"message": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data": series,
		"meta": gin.H{
			"volume_id":     volumeID,
			"snapshot_type": snapshotType,
			"days":          days,
			"start_date":    startDate,
			"data_points":   len(series),
			"generated_at":  time.Now(),
		},
	})
}

// GetVolumeTrendSlope returns trend slope calculation
// GET /trends/volumes/:volumeId/slope?type=daily&days=30
func (h *Handler) GetVolumeTrendSlope(c *gin.Context) {
	volumeID := c.Param("volumeId")

	if volumeID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "volume_id is required",
			"code":    "MISSING_VOLUME_ID",
			"message": "volume_id parameter is required",
		})
		return
	}

	// Parse query parameters
	snapshotType := c.DefaultQuery("type", "daily")
	if snapshotType != "daily" && snapshotType != "weekly" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "type must be 'daily' or 'weekly'",
			"code":    "INVALID_TYPE",
			"message": "snapshot type must be either 'daily' or 'weekly'",
		})
		return
	}

	daysStr := c.DefaultQuery("days", "30")
	days := 30
	if parsed, err := strconv.Atoi(daysStr); err == nil && parsed > 0 && parsed <= 365 {
		days = parsed
	}

	// Calculate date range
	endDate := time.Now().UTC().Truncate(24 * time.Hour)
	startDate := endDate.AddDate(0, 0, -days)

	// Get trend slope
	slope, err := h.store.GetTrendSlope(c.Request.Context(), store.GetTrendSlopeParams{
		VolumeID:  volumeID,
		StartDate: startDate,
		EndDate:   endDate,
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "Failed to get trend slope",
			"code":    "SLOPE_ERROR",
			"message": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data": slope,
		"meta": gin.H{
			"volume_id":     volumeID,
			"snapshot_type": snapshotType,
			"days":          days,
			"start_date":    startDate,
			"generated_at":  time.Now(),
		},
	})
}

// Get7DayTrend returns 7-day trend summary
// GET /trends/volumes/:volumeId/7day
func (h *Handler) Get7DayTrend(c *gin.Context) {
	volumeID := c.Param("volumeId")

	if volumeID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "volume_id is required",
			"code":    "MISSING_VOLUME_ID",
			"message": "volume_id parameter is required",
		})
		return
	}

	// Get 7-day trend
	trend, err := h.store.Get7DayTrend(c.Request.Context(), volumeID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "Failed to get 7-day trend",
			"code":    "TREND_7DAY_ERROR",
			"message": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data": trend,
		"meta": gin.H{
			"volume_id":    volumeID,
			"period":       "7 days",
			"generated_at": time.Now(),
		},
	})
}

// Get30DayTrend returns 30-day trend summary
// GET /trends/volumes/:volumeId/30day
func (h *Handler) Get30DayTrend(c *gin.Context) {
	volumeID := c.Param("volumeId")

	if volumeID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "volume_id is required",
			"code":    "MISSING_VOLUME_ID",
			"message": "volume_id parameter is required",
		})
		return
	}

	// Get 30-day trend
	trend, err := h.store.Get30DayTrend(c.Request.Context(), volumeID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "Failed to get 30-day trend",
			"code":    "TREND_30DAY_ERROR",
			"message": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data": trend,
		"meta": gin.H{
			"volume_id":    volumeID,
			"period":       "30 days",
			"generated_at": time.Now(),
		},
	})
}

// GetAllVolumesTrendsSummary returns a summary of trends for all volumes
// GET /trends/summary
func (h *Handler) GetAllVolumesTrendsSummary(c *gin.Context) {
	// For now, return basic summary structure
	// In a full implementation, this would aggregate trends across all volumes
	summary := gin.H{
		"total_volumes_tracked": 0,
		"volumes_with_growth":   0,
		"volumes_with_decline":  0,
		"average_growth_rate":   0.0,
		"total_storage_growth":  0,
		"period": gin.H{
			"start": time.Now().AddDate(0, 0, -30),
			"end":   time.Now(),
			"days":  30,
		},
		"generated_at": time.Now(),
	}

	c.JSON(http.StatusOK, gin.H{
		"data": summary,
		"meta": gin.H{
			"endpoint": "/trends/summary",
			"note":     "This endpoint returns aggregated trends across all volumes",
		},
	})
}

// CreateSnapshot manually creates a snapshot for a volume
// POST /trends/volumes/:volumeId/snapshots
func (h *Handler) CreateSnapshot(c *gin.Context) {
	volumeID := c.Param("volumeId")

	if volumeID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "volume_id is required",
			"code":    "MISSING_VOLUME_ID",
			"message": "volume_id parameter is required",
		})
		return
	}

	// Parse request body
	var req struct {
		TotalSize      int64  `json:"total_size"`
		FileCount      int64  `json:"file_count"`
		DirectoryCount int64  `json:"directory_count"`
		LargestFile    int64  `json:"largest_file"`
		ScanMethod     string `json:"scan_method"`
		ScanDurationMs int64  `json:"scan_duration_ms"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "Invalid request body",
			"code":    "INVALID_JSON",
			"message": err.Error(),
		})
		return
	}

	// Validate required fields
	if req.ScanMethod == "" {
		req.ScanMethod = "manual"
	}

	// Create snapshot
	params := snapshots.CreateSnapshotParams{
		VolumeID:       volumeID,
		TotalSize:      req.TotalSize,
		FileCount:      req.FileCount,
		DirectoryCount: req.DirectoryCount,
		LargestFile:    req.LargestFile,
		ScanMethod:     req.ScanMethod,
		ScanDurationMs: req.ScanDurationMs,
	}

	snapshot, err := h.snapshotService.CreateDailySnapshot(c.Request.Context(), params)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "Failed to create snapshot",
			"code":    "SNAPSHOT_CREATE_ERROR",
			"message": err.Error(),
		})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"data": snapshot,
		"meta": gin.H{
			"created_at": time.Now(),
			"method":     "manual",
		},
	})
}
