package trends

import (
	"context"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	apimodels "github.com/mantonx/volumeviz/internal/api/models"
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
// @Param aggregation query string false "Bucket size for daily_stats: day, week, or month (default: day)"
// @Success 200 {object} apimodels.VolumeTrendsDataV1 "Volume trends data"
// @Failure 400 {object} map[string]interface{} "Bad request"
// @Failure 500 {object} map[string]interface{} "Internal server error"
// @Router /api/v1/trends/volumes/{volumeId} [get]
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

	aggregation := c.DefaultQuery("aggregation", "day")
	if aggregation != "day" && aggregation != "week" && aggregation != "month" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "aggregation must be 'day', 'week', or 'month'",
			"code":    "INVALID_AGGREGATION",
			"message": "aggregation must be 'day', 'week', or 'month'",
		})
		return
	}

	// Calculate date range
	endDate := time.Now().Truncate(24 * time.Hour)
	startDate := endDate.AddDate(0, 0, -days)

	// Get comprehensive trends data using our daily stats service
	trendsData, err := h.getTrendsDataFromStats(c.Request.Context(), volumeID, startDate, endDate, days, aggregation)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "Failed to get trends data",
			"code":    "TRENDS_ERROR",
			"message": err.Error(),
		})
		return
	}

	trendsData.Aggregation = aggregation
	trendsData.Period = apimodels.TrendsPeriodV1{Start: startDate, End: endDate, Days: days}
	trendsData.GeneratedAt = time.Now()

	c.JSON(http.StatusOK, trendsData)
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
// @Router /api/v1/trends/volumes/{volumeId}/deltas [get]
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
// @Router /api/v1/trends/volumes/{volumeId}/series [get]
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
// @Router /api/v1/trends/volumes/{volumeId}/slope [get]
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
// @Router /api/v1/trends/volumes/{volumeId}/7day [get]
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
// @Router /api/v1/trends/volumes/{volumeId}/30day [get]
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

// volumeTrendsSummaryLimit caps how many volumes GetAllVolumesTrendsSummary
// will pull daily stats for in one request
const volumeTrendsSummaryLimit = 500

// GetAllVolumesTrendsSummary returns a summary of trends for all volumes
// @Summary Get all volumes trends summary
// @Description Get aggregated trends summary for all volumes in the system
// @Tags trends
// @Accept json
// @Produce json
// @Success 200 {object} apimodels.AllVolumesTrendsSummaryV1 "All volumes trends summary"
// @Failure 500 {object} map[string]interface{} "Internal server error"
// @Router /api/v1/trends/summary [get]
func (h *Handler) GetAllVolumesTrendsSummary(c *gin.Context) {
	const days = 30
	endDate := time.Now().Truncate(24 * time.Hour)
	startDate := endDate.AddDate(0, 0, -days)

	// System-wide summary: not scoped to a single organization, matching this
	// endpoint's route (no org context in the URL)
	volumes, err := h.store.Volumes().ListAllVolumes(c.Request.Context(), volumeTrendsSummaryLimit, 0)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "Failed to list volumes",
			"code":    "VOLUMES_ERROR",
			"message": err.Error(),
		})
		return
	}

	volumeSummaries := make([]apimodels.VolumeTrendsSummaryEntryV1, 0, len(volumes))
	volumesWithGrowth := 0
	volumesWithDecline := 0
	var totalStorageGrowth int64
	var growthRateSum float64
	volumesWithStats := 0

	for _, volume := range volumes {
		stats, err := h.statsService.GetVolumeStatsHistory(c.Request.Context(), volume.VolumeID, startDate, endDate)
		if err != nil || len(stats) == 0 {
			continue
		}

		var volumeGrowth int64
		for _, stat := range stats {
			volumeGrowth += stat.AddedBytes - stat.RemovedBytes
		}

		latest := stats[0]
		var growthRatePercent float64
		baseline := latest.TotalBytes - volumeGrowth
		if baseline > 0 {
			growthRatePercent = float64(volumeGrowth) / float64(baseline) * 100
		}

		if volumeGrowth > 0 {
			volumesWithGrowth++
		} else if volumeGrowth < 0 {
			volumesWithDecline++
		}
		totalStorageGrowth += volumeGrowth
		growthRateSum += growthRatePercent
		volumesWithStats++

		dataPoints := make([]apimodels.VolumeTrendsDataPointV1, len(stats))
		for i, stat := range stats {
			dataPoints[i] = apimodels.VolumeTrendsDataPointV1{
				Date:      stat.Date.Format("2006-01-02"),
				TotalSize: stat.TotalBytes,
				FileCount: stat.FilesCount,
			}
		}

		volumeSummaries = append(volumeSummaries, apimodels.VolumeTrendsSummaryEntryV1{
			VolumeID: volume.VolumeID,
			Statistics: apimodels.VolumeTrendsSummaryStatsV1{
				TotalGrowth:       volumeGrowth,
				GrowthRatePercent: growthRatePercent,
				CurrentSize:       latest.TotalBytes,
			},
			DataPoints: dataPoints,
		})
	}

	var averageGrowthRate float64
	if volumesWithStats > 0 {
		averageGrowthRate = growthRateSum / float64(volumesWithStats)
	}

	summary := apimodels.AllVolumesTrendsSummaryV1{
		TotalVolumesTracked: len(volumes),
		VolumesWithGrowth:   volumesWithGrowth,
		VolumesWithDecline:  volumesWithDecline,
		AverageGrowthRate:   averageGrowthRate,
		TotalStorageGrowth:  totalStorageGrowth,
		Volumes:             volumeSummaries,
		Period: apimodels.TrendsPeriodV1{
			Start: startDate,
			End:   endDate,
			Days:  days,
		},
		GeneratedAt: time.Now(),
	}

	c.JSON(http.StatusOK, summary)
}

// getTrendsDataFromStats creates comprehensive trends data using our daily stats service
func (h *Handler) getTrendsDataFromStats(ctx context.Context, volumeID string, startDate, endDate time.Time, days int, aggregation string) (apimodels.VolumeTrendsDataV1, error) {
	// Get volume stats history
	volumeStats, err := h.statsService.GetVolumeStatsHistory(ctx, volumeID, startDate, endDate)
	if err != nil {
		return apimodels.VolumeTrendsDataV1{}, err
	}
	volumeStats = bucketDailyStats(volumeStats, aggregation)

	// Get trend analysis data
	trendAnalysis, err := h.statsService.GetTrendAnalysis(ctx, volumeID, startDate, endDate)
	if err != nil {
		return apimodels.VolumeTrendsDataV1{}, err
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

	capacityForecast := buildCapacityForecast(volumeStats, avgDailyGrowthBytes, endDate)

	trendsData := apimodels.VolumeTrendsDataV1{
		VolumeID: volumeID,
		Summary: apimodels.TrendsSummaryStatsV1{
			CurrentSize:         getCurrentSize(latestStats),
			CurrentFiles:        getCurrentFiles(latestStats),
			TotalGrowthBytes:    totalGrowthBytes,
			TotalGrowthFiles:    totalGrowthFiles,
			AvgDailyGrowthBytes: avgDailyGrowthBytes,
			AvgDailyGrowthFiles: avgDailyGrowthFiles,
		},
		DailyStats:        dailyStatsToV1(volumeStats),
		TrendAnalysis:     trendAnalysisToV1(trendAnalysis),
		MediaComposition:  mediaCompositionToV1(mediaComposition),
		TopGrowingFolders: topGrowingFoldersToV1(topGrowingFolders),
		CapacityForecast:  capacityForecast,
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

func dailyStatsToV1(stats []*models.DailyStat) []apimodels.DailyStatV1 {
	out := make([]apimodels.DailyStatV1, len(stats))
	for i, stat := range stats {
		out[i] = apimodels.DailyStatV1{
			Date:               stat.Date.Format("2006-01-02"),
			TotalBytes:         stat.TotalBytes,
			FilesCount:         stat.FilesCount,
			AddedBytes:         stat.AddedBytes,
			RemovedBytes:       stat.RemovedBytes,
			AddedFiles:         stat.AddedFiles,
			RemovedFiles:       stat.RemovedFiles,
			DiskTotalBytes:     stat.DiskTotalBytes,
			DiskAvailableBytes: stat.DiskAvailableBytes,
		}
	}
	return out
}

func trendAnalysisToV1(analysis []*models.TrendAnalysis) []apimodels.TrendAnalysisV1 {
	if analysis == nil {
		return nil
	}
	out := make([]apimodels.TrendAnalysisV1, len(analysis))
	for i, a := range analysis {
		out[i] = apimodels.TrendAnalysisV1{
			Date:               a.Date.Format("2006-01-02"),
			FilesCount:         a.FilesCount,
			TotalBytes:         a.TotalBytes,
			BytesChange7d:      a.BytesChange7d,
			FilesChange7d:      a.FilesChange7d,
			BytesChange30d:     a.BytesChange30d,
			FilesChange30d:     a.FilesChange30d,
			BytesGrowthRate7d:  a.BytesGrowthRate7d,
			BytesGrowthRate30d: a.BytesGrowthRate30d,
		}
	}
	return out
}

func mediaCompositionToV1(composition []*models.MediaKindComposition) []apimodels.MediaKindCompositionV1 {
	if composition == nil {
		return nil
	}
	out := make([]apimodels.MediaKindCompositionV1, len(composition))
	for i, c := range composition {
		out[i] = apimodels.MediaKindCompositionV1{
			MediaKind:       c.MediaKind,
			Date:            c.Date.Format("2006-01-02"),
			FilesCount:      c.FilesCount,
			TotalBytes:      c.TotalBytes,
			PercentOfVolume: c.PercentOfVolume,
		}
	}
	return out
}

func topGrowingFoldersToV1(folders []*models.TopGrowingFolder) []apimodels.TopGrowingFolderV1 {
	if folders == nil {
		return nil
	}
	out := make([]apimodels.TopGrowingFolderV1, len(folders))
	for i, f := range folders {
		out[i] = apimodels.TopGrowingFolderV1{
			FolderID:           f.FolderID,
			FolderName:         f.FolderName,
			FolderPath:         f.FolderPath,
			TotalAddedBytes:    f.TotalAddedBytes,
			TotalAddedFiles:    f.TotalAddedFiles,
			AvgDailyAddedBytes: f.AvgDailyAddedBytes,
			DaysTracked:        f.DaysTracked,
		}
	}
	return out
}

// bucketDailyStats groups daily stat rows into week or month buckets,
// summing the added/removed deltas within each bucket and keeping the most
// recent row's point-in-time totals (TotalBytes/FilesCount/disk capacity) as
// that bucket's representative snapshot. "day" aggregation is a no-op since
// daily_stats is already daily-granular - there's no finer-grained data
// source (e.g. hourly) to bucket up from.
func bucketDailyStats(stats []*models.DailyStat, aggregation string) []*models.DailyStat {
	if aggregation == "day" || len(stats) == 0 {
		return stats
	}

	// stats is ordered by date DESC; bucketKey groups dates that fall in the
	// same ISO week or same calendar month
	bucketKey := func(d time.Time) time.Time {
		if aggregation == "month" {
			return time.Date(d.Year(), d.Month(), 1, 0, 0, 0, 0, d.Location())
		}
		// week: bucket by the Monday that starts that ISO week
		weekday := int(d.Weekday())
		if weekday == 0 {
			weekday = 7 // ISO: Sunday is 7, not 0
		}
		return d.AddDate(0, 0, -(weekday - 1)).Truncate(24 * time.Hour)
	}

	buckets := make([]*models.DailyStat, 0, len(stats))
	var current *models.DailyStat
	var currentKey time.Time

	for _, stat := range stats {
		key := bucketKey(stat.Date)
		if current == nil || !key.Equal(currentKey) {
			// stats[0] (most recent) becomes each new bucket's snapshot values;
			// subsequent same-bucket rows only contribute their deltas below
			snapshot := *stat
			current = &snapshot
			current.Date = key
			currentKey = key
			buckets = append(buckets, current)
			continue
		}
		current.AddedBytes += stat.AddedBytes
		current.RemovedBytes += stat.RemovedBytes
		current.AddedFiles += stat.AddedFiles
		current.RemovedFiles += stat.RemovedFiles
	}

	return buckets
}

// capacityForecastDays is how far forward to project storage growth
const capacityForecastDays = 90

// buildCapacityForecast projects a volume's size forward from its most recent
// known size using its observed average daily growth rate, and (if the host
// filesystem's available space was captured during a recent scan) reports how
// many days remain until that growth would exhaust the available disk space.
// Returns nil if there isn't enough data to make an honest projection.
func buildCapacityForecast(volumeStats []*models.DailyStat, avgDailyGrowthBytes float64, asOf time.Time) *apimodels.CapacityForecastV1 {
	if len(volumeStats) == 0 {
		return nil
	}

	// volumeStats is ordered by date DESC (see GetVolumeStatsHistory), so the
	// first entry with data is the most recent
	latest := volumeStats[0]
	currentSize := latest.TotalBytes

	var availableBytes *int64
	for _, stat := range volumeStats {
		if stat.DiskAvailableBytes != nil {
			availableBytes = stat.DiskAvailableBytes
			break
		}
	}

	series := make([]apimodels.CapacityForecastPointV1, 0, capacityForecastDays)
	for i := 1; i <= capacityForecastDays; i++ {
		projected := currentSize + int64(avgDailyGrowthBytes*float64(i))
		if projected < 0 {
			projected = 0
		}
		series = append(series, apimodels.CapacityForecastPointV1{
			Date:               asOf.AddDate(0, 0, i),
			ProjectedSizeBytes: projected,
		})
	}

	forecast := &apimodels.CapacityForecastV1{
		DailyGrowthBytes: avgDailyGrowthBytes,
		CurrentSizeBytes: currentSize,
		Series:           series,
	}

	if availableBytes != nil {
		forecast.DiskAvailableBytes = availableBytes
		if avgDailyGrowthBytes > 0 {
			daysUntilFull := int(float64(*availableBytes) / avgDailyGrowthBytes)
			forecast.DaysUntilCapacity = &daysUntilFull
		}
		// Flat or shrinking usage: DaysUntilCapacity stays nil (no meaningful exhaustion date)
	}

	return forecast
}
