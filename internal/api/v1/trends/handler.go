package trends

import (
	"context"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/mantonx/volumeviz/internal/interfaces"
	"github.com/mantonx/volumeviz/internal/models"
	"github.com/mantonx/volumeviz/internal/store"
)

// Handler handles trends-related API requests
type Handler struct {
	store        store.Store
	statsService interfaces.StatsService // New daily stats service
}

// NewHandler creates a new trends handler
func NewHandler(store store.Store, statsService interfaces.StatsService) *Handler {
	return &Handler{
		store:        store,
		statsService: statsService,
	}
}

// GetVolumeTrends returns trend analysis for a volume
// @Summary Get volume trends
// @Description Get trend analysis for a specific volume over a specified time period
// @Tags trends
// @Accept json
// @Produce json
// @Param volumeId path string true "Volume ID"
// @Param days query int false "Number of days to analyze (default: 30, max: 365)"
// @Success 200 {object} map[string]interface{} "Volume trends data"
// @Failure 400 {object} map[string]interface{} "Bad request"
// @Failure 500 {object} map[string]interface{} "Internal server error"
// @Router /trends/volumes/{volumeId} [get]
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

	// Calculate date range
	endDate := time.Now().Truncate(24 * time.Hour)
	startDate := endDate.AddDate(0, 0, -days)

	// Get comprehensive trends data using our daily stats service
	trendsData, err := h.getTrendsDataFromStats(c.Request.Context(), volumeID, startDate, endDate, days)
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
			"volume_id":   volumeID,
			"period_days": days,
			"date_range": gin.H{
				"start": startDate.Format("2006-01-02"),
				"end":   endDate.Format("2006-01-02"),
			},
			"generated_at": time.Now(),
		},
	})
}

// GetVolumeGrowthDeltas returns growth deltas for a volume
// @Summary Get volume growth deltas
// @Description Get growth deltas (changes) for a volume over time
// @Tags trends
// @Accept json
// @Produce json
// @Param volumeId path string true "Volume ID"
// @Param type query string false "Delta type (daily, weekly)" default(daily)
// @Param limit query int false "Number of deltas to return (default: 30)"
// @Success 200 {object} map[string]interface{} "Volume growth deltas"
// @Failure 400 {object} map[string]interface{} "Bad request"
// @Failure 500 {object} map[string]interface{} "Internal server error"
// @Router /trends/volumes/{volumeId}/deltas [get]
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

	// Calculate date range
	days := limit
	if snapshotType == "weekly" {
		days = limit * 7
	}
	endDate := time.Now().Truncate(24 * time.Hour)
	startDate := endDate.AddDate(0, 0, -days)

	// Get volume stats history for growth deltas
	volumeStats, err := h.statsService.GetVolumeStatsHistory(c.Request.Context(), volumeID, startDate, endDate)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "Failed to get growth deltas",
			"code":    "DELTAS_ERROR",
			"message": err.Error(),
		})
		return
	}

	// Format as growth deltas
	deltas := make([]gin.H, len(volumeStats))
	for i, stat := range volumeStats {
		deltas[i] = gin.H{
			"date":          stat.Date.Format("2006-01-02"),
			"added_bytes":   stat.AddedBytes,
			"removed_bytes": stat.RemovedBytes,
			"net_change":    stat.AddedBytes - stat.RemovedBytes,
			"added_files":   stat.AddedFiles,
			"removed_files": stat.RemovedFiles,
			"files_change":  stat.AddedFiles - stat.RemovedFiles,
			"total_bytes":   stat.TotalBytes,
			"total_files":   stat.FilesCount,
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"data": deltas,
		"meta": gin.H{
			"volume_id":     volumeID,
			"snapshot_type": snapshotType,
			"limit":         limit,
			"date_range": gin.H{
				"start": startDate.Format("2006-01-02"),
				"end":   endDate.Format("2006-01-02"),
			},
			"generated_at": time.Now(),
		},
	})
}

// GetVolumeStepSeries returns step series data for charting
// @Summary Get volume step series
// @Description Get step series data for a volume suitable for time-series charting
// @Tags trends
// @Accept json
// @Produce json
// @Param volumeId path string true "Volume ID"
// @Param type query string false "Series type (daily, weekly)" default(daily)
// @Param days query int false "Number of days to include (default: 30)"
// @Success 200 {object} map[string]interface{} "Volume step series data"
// @Failure 400 {object} map[string]interface{} "Bad request"
// @Failure 500 {object} map[string]interface{} "Internal server error"
// @Router /trends/volumes/{volumeId}/series [get]
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

	// Get volume stats history for step series data
	volumeStats, err := h.statsService.GetVolumeStatsHistory(c.Request.Context(), volumeID, startDate, endDate)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "Failed to get step series",
			"code":    "SERIES_ERROR",
			"message": err.Error(),
		})
		return
	}

	// Convert stats to step series format
	series := make([]gin.H, len(volumeStats))
	for i, stat := range volumeStats {
		series[i] = gin.H{
			"date":        stat.Date.Format("2006-01-02"),
			"total_bytes": stat.TotalBytes,
			"total_files": stat.FilesCount,
			"step_value":  stat.TotalBytes, // Use total bytes as the primary step value
		}
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
// @Summary Get volume trend slope
// @Description Calculate the trend slope for a volume to determine growth rate
// @Tags trends
// @Accept json
// @Produce json
// @Param volumeId path string true "Volume ID"
// @Param type query string false "Trend type (daily, weekly)" default(daily)
// @Param days query int false "Number of days to analyze (default: 30)"
// @Success 200 {object} map[string]interface{} "Volume trend slope data"
// @Failure 400 {object} map[string]interface{} "Bad request"
// @Failure 500 {object} map[string]interface{} "Internal server error"
// @Router /trends/volumes/{volumeId}/slope [get]
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

	// Get trend analysis to calculate slope
	trendAnalysis, err := h.statsService.GetTrendAnalysis(c.Request.Context(), volumeID, startDate, endDate)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "Failed to get trend slope",
			"code":    "SLOPE_ERROR",
			"message": err.Error(),
		})
		return
	}

	// Calculate slope from trend analysis data
	var slope gin.H
	if len(trendAnalysis) > 0 {
		latest := trendAnalysis[0]
		var bytesSlope, filesSlope interface{}

		// Use the growth rates as slope indicators
		if latest.BytesGrowthRate7d != nil {
			bytesSlope = *latest.BytesGrowthRate7d
		}
		if latest.BytesGrowthRate30d != nil && days >= 30 {
			bytesSlope = *latest.BytesGrowthRate30d
		}

		// For files, calculate a simple slope if we have enough data
		if len(trendAnalysis) >= 2 {
			first := trendAnalysis[len(trendAnalysis)-1]
			filesSlope = float64(latest.FilesCount-first.FilesCount) / float64(days)
		}

		slope = gin.H{
			"bytes_slope":      bytesSlope,
			"files_slope":      filesSlope,
			"period_days":      days,
			"growth_rate_7d":   latest.BytesGrowthRate7d,
			"growth_rate_30d":  latest.BytesGrowthRate30d,
			"bytes_change_7d":  latest.BytesChange7d,
			"bytes_change_30d": latest.BytesChange30d,
			"files_change_7d":  latest.FilesChange7d,
			"files_change_30d": latest.FilesChange30d,
		}
	} else {
		slope = gin.H{
			"bytes_slope":      0,
			"files_slope":      0,
			"period_days":      days,
			"growth_rate_7d":   nil,
			"growth_rate_30d":  nil,
			"bytes_change_7d":  0,
			"bytes_change_30d": 0,
			"files_change_7d":  0,
			"files_change_30d": 0,
		}
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
// @Summary Get 7-day trend
// @Description Get 7-day trend summary for a volume
// @Tags trends
// @Accept json
// @Produce json
// @Param volumeId path string true "Volume ID"
// @Success 200 {object} map[string]interface{} "7-day trend summary"
// @Failure 400 {object} map[string]interface{} "Bad request"
// @Failure 500 {object} map[string]interface{} "Internal server error"
// @Router /trends/volumes/{volumeId}/7day [get]
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

	// Get 7-day trend data using our stats service
	endDate := time.Now().Truncate(24 * time.Hour)
	startDate := endDate.AddDate(0, 0, -7)

	trendAnalysis, err := h.statsService.GetTrendAnalysis(c.Request.Context(), volumeID, startDate, endDate)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "Failed to get 7-day trend",
			"code":    "TREND_7DAY_ERROR",
			"message": err.Error(),
		})
		return
	}

	// Format trend data
	var summary gin.H
	if len(trendAnalysis) > 0 {
		latest := trendAnalysis[0] // Most recent data
		summary = gin.H{
			"current_size":      latest.TotalBytes,
			"current_files":     latest.FilesCount,
			"bytes_change_7d":   latest.BytesChange7d,
			"files_change_7d":   latest.FilesChange7d,
			"bytes_growth_rate": latest.BytesGrowthRate7d,
		}
	} else {
		summary = gin.H{
			"current_size":      0,
			"current_files":     0,
			"bytes_change_7d":   0,
			"files_change_7d":   0,
			"bytes_growth_rate": nil,
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"data": gin.H{
			"summary":        summary,
			"trend_analysis": trendAnalysis,
		},
		"meta": gin.H{
			"volume_id": volumeID,
			"period":    "7 days",
			"date_range": gin.H{
				"start": startDate.Format("2006-01-02"),
				"end":   endDate.Format("2006-01-02"),
			},
			"generated_at": time.Now(),
		},
	})
}

// Get30DayTrend returns 30-day trend summary
// @Summary Get 30-day trend
// @Description Get 30-day trend summary for a volume
// @Tags trends
// @Accept json
// @Produce json
// @Param volumeId path string true "Volume ID"
// @Success 200 {object} map[string]interface{} "30-day trend summary"
// @Failure 400 {object} map[string]interface{} "Bad request"
// @Failure 500 {object} map[string]interface{} "Internal server error"
// @Router /trends/volumes/{volumeId}/30day [get]
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

	// Get 30-day trend data using our stats service
	endDate := time.Now().Truncate(24 * time.Hour)
	startDate := endDate.AddDate(0, 0, -30)

	trendAnalysis, err := h.statsService.GetTrendAnalysis(c.Request.Context(), volumeID, startDate, endDate)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "Failed to get 30-day trend",
			"code":    "TREND_30DAY_ERROR",
			"message": err.Error(),
		})
		return
	}

	// Format trend data
	var summary gin.H
	if len(trendAnalysis) > 0 {
		latest := trendAnalysis[0] // Most recent data
		summary = gin.H{
			"current_size":      latest.TotalBytes,
			"current_files":     latest.FilesCount,
			"bytes_change_30d":  latest.BytesChange30d,
			"files_change_30d":  latest.FilesChange30d,
			"bytes_growth_rate": latest.BytesGrowthRate30d,
		}
	} else {
		summary = gin.H{
			"current_size":      0,
			"current_files":     0,
			"bytes_change_30d":  0,
			"files_change_30d":  0,
			"bytes_growth_rate": nil,
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"data": gin.H{
			"summary":        summary,
			"trend_analysis": trendAnalysis,
		},
		"meta": gin.H{
			"volume_id": volumeID,
			"period":    "30 days",
			"date_range": gin.H{
				"start": startDate.Format("2006-01-02"),
				"end":   endDate.Format("2006-01-02"),
			},
			"generated_at": time.Now(),
		},
	})
}

// GetAllVolumesTrendsSummary returns a summary of trends for all volumes
// @Summary Get all volumes trends summary
// @Description Get aggregated trends summary for all volumes in the system
// @Tags trends
// @Accept json
// @Produce json
// @Success 200 {object} map[string]interface{} "All volumes trends summary"
// @Failure 500 {object} map[string]interface{} "Internal server error"
// @Router /trends/summary [get]
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

// getTrendsDataFromStats creates comprehensive trends data using our daily stats service
func (h *Handler) getTrendsDataFromStats(ctx context.Context, volumeID string, startDate, endDate time.Time, days int) (interface{}, error) {
	// Get volume stats history
	volumeStats, err := h.statsService.GetVolumeStatsHistory(ctx, volumeID, startDate, endDate)
	if err != nil {
		return nil, err
	}

	// Get trend analysis data
	trendAnalysis, err := h.statsService.GetTrendAnalysis(ctx, volumeID, startDate, endDate)
	if err != nil {
		return nil, err
	}

	// Get latest volume stats for current totals
	latestStats, err := h.statsService.GetLatestVolumeStats(ctx, volumeID)
	if err != nil {
		// Not an error if no stats exist yet
		latestStats = nil
	}

	// Get media composition
	mediaComposition, err := h.statsService.GetMediaKindComposition(ctx, volumeID, startDate, endDate)
	if err != nil {
		// Not critical, continue without composition data
		mediaComposition = nil
	}

	// Get top growing folders
	topGrowingFolders, err := h.statsService.GetTopGrowingFolders(ctx, volumeID, days, 10)
	if err != nil {
		// Not critical, continue without folder data
		topGrowingFolders = nil
	}

	// Calculate summary metrics
	var totalGrowthBytes int64
	var totalGrowthFiles int64
	var avgDailyGrowthBytes float64
	var avgDailyGrowthFiles float64

	if len(volumeStats) > 0 {
		for _, stat := range volumeStats {
			totalGrowthBytes += stat.AddedBytes - stat.RemovedBytes
			totalGrowthFiles += stat.AddedFiles - stat.RemovedFiles
		}
		if days > 0 {
			avgDailyGrowthBytes = float64(totalGrowthBytes) / float64(days)
			avgDailyGrowthFiles = float64(totalGrowthFiles) / float64(days)
		}
	}

	// Build comprehensive response
	trendsData := gin.H{
		"volume_id": volumeID,
		"summary": gin.H{
			"current_size":           getCurrentSize(latestStats),
			"current_files":          getCurrentFiles(latestStats),
			"total_growth_bytes":     totalGrowthBytes,
			"total_growth_files":     totalGrowthFiles,
			"avg_daily_growth_bytes": avgDailyGrowthBytes,
			"avg_daily_growth_files": avgDailyGrowthFiles,
		},
		"daily_stats":         volumeStats,
		"trend_analysis":      trendAnalysis,
		"media_composition":   mediaComposition,
		"top_growing_folders": topGrowingFolders,
	}

	return trendsData, nil
}

// Helper functions for current stats
func getCurrentSize(stats *models.DailyStat) int64 {
	if stats != nil {
		return stats.TotalBytes
	}
	return 0
}

func getCurrentFiles(stats *models.DailyStat) int64 {
	if stats != nil {
		return stats.FilesCount
	}
	return 0
}
