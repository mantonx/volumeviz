// Package metrics provides HTTP handlers for volume metrics and historical data
// Serves data for trend analysis, growth tracking, and capacity forecasting
package metrics

import (
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/mantonx/volumeviz/internal/database"
)

// Handler handles HTTP requests for volume metrics
type Handler struct {
	metricsRepo *database.VolumeMetricsRepository
}

// NewHandler creates a new metrics handler
func NewHandler(db *database.DB) *Handler {
	return &Handler{
		metricsRepo: database.NewVolumeMetricsRepository(db),
	}
}

// GetVolumeMetrics returns historical metrics for a specific volume
// GET /api/v1/volumes/{id}/metrics?timeRange=1d&interval=1h
func (h *Handler) GetVolumeMetrics(c *gin.Context) {
	volumeID := c.Param("id")
	if err := validateVolumeID(volumeID); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Parse and validate query parameters
	timeRange := c.DefaultQuery("timeRange", "7d")
	interval := c.DefaultQuery("interval", "1h")

	// Validate time range
	if err := validateTimeRange(timeRange); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":    "invalid time range",
			"details":  err.Error(),
			"provided": timeRange,
		})
		return
	}

	// Convert time range to duration
	duration, err := parseTimeRange(timeRange)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "failed to parse time range",
			"details": err.Error(),
		})
		return
	}

	startTime := time.Now().Add(-duration)
	endTime := time.Now()

	// Query historical metrics
	metrics, err := h.metricsRepo.GetMetrics(c.Request.Context(), volumeID, startTime, endTime, 1000)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch metrics", "details": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"volume_id": volumeID,
		"timeRange": timeRange,
		"interval":  interval,
		"startTime": startTime,
		"endTime":   endTime,
		"metrics":   metrics,
	})
}

// GetVolumeTrends returns trend analysis for one or more volumes
// GET /api/v1/volumes/trends?volumeIds=vol1,vol2&timeRange=30d
func (h *Handler) GetVolumeTrends(c *gin.Context) {
	volumeIDsParam := c.Query("volumeIds")
	timeRange := c.DefaultQuery("timeRange", "30d")

	var volumeIDs []string
	if volumeIDsParam != "" {
		// Split comma-separated volume IDs
		volumeIDs = parseVolumeIDs(volumeIDsParam)
	} else {
		// Get all volumes if none specified
		volumes, err := h.metricsRepo.GetAllActiveVolumeIDs(c.Request.Context())
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch volumes"})
			return
		}
		volumeIDs = volumes
	}

	// Validate time range parameter
	validTimeRanges := []string{"1h", "6h", "1d", "7d", "30d", "90d", "1y"}
	isValid := false
	for _, valid := range validTimeRanges {
		if timeRange == valid {
			isValid = true
			break
		}
	}
	if !isValid {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "invalid time range",
			"details": "timeRange must be one of: " + strings.Join(validTimeRanges, ", "),
		})
		return
	}

	duration, err := parseTimeRange(timeRange)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "failed to parse time range",
			"details": err.Error(),
		})
		return
	}

	startTime := time.Now().Add(-duration)
	endTime := time.Now()

	// Calculate trends for volumes
	days := int(duration.Hours() / 24)
	if days < 1 {
		days = 1
	}

	trends, err := h.metricsRepo.GetTrends(c.Request.Context(), volumeIDs, days)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to calculate trends"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"timeRange": timeRange,
		"startTime": startTime,
		"endTime":   endTime,
		"trends":    trends,
	})
}

// GetVolumeHistory returns paginated historical data
// GET /api/v1/volumes/history?limit=100&offset=0&volumeId=vol1
func (h *Handler) GetVolumeHistory(c *gin.Context) {
	limit, err := strconv.Atoi(c.DefaultQuery("limit", "100"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "invalid limit parameter",
			"details": "limit must be a valid integer",
		})
		return
	}

	offset, err := strconv.Atoi(c.DefaultQuery("offset", "0"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "invalid offset parameter",
			"details": "offset must be a valid integer",
		})
		return
	}

	volumeID := c.Query("volumeId")

	// Validate pagination limits
	if limit < 1 || limit > 1000 {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":    "invalid limit parameter",
			"details":  "limit must be between 1 and 1000",
			"provided": limit,
		})
		return
	}

	if offset < 0 {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":    "invalid offset parameter",
			"details":  "offset must be non-negative",
			"provided": offset,
		})
		return
	}

	// Get historical data with pagination
	endTime := time.Now()
	startTime := endTime.Add(-90 * 24 * time.Hour) // Last 90 days

	history, err := h.metricsRepo.GetMetrics(c.Request.Context(), volumeID, startTime, endTime, limit+offset)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch history"})
		return
	}

	// Apply pagination
	total := len(history)
	start := offset
	end := offset + limit

	if start >= total {
		history = []database.VolumeMetrics{}
	} else {
		if end > total {
			end = total
		}
		history = history[start:end]
	}

	c.JSON(http.StatusOK, gin.H{
		"history": history,
		"pagination": gin.H{
			"limit":  limit,
			"offset": offset,
			"total":  total,
		},
	})
}

// GetGrowthRates returns growth rate analysis
// GET /api/v1/volumes/growth-rates?period=daily&volumeIds=vol1,vol2
func (h *Handler) GetGrowthRates(c *gin.Context) {
	period := c.DefaultQuery("period", "daily") // daily, weekly, monthly
	volumeIDsParam := c.Query("volumeIds")

	var volumeIDs []string
	if volumeIDsParam != "" {
		volumeIDs = parseVolumeIDs(volumeIDsParam)
	} else {
		volumes, err := h.metricsRepo.GetAllActiveVolumeIDs(c.Request.Context())
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch volumes"})
			return
		}
		volumeIDs = volumes
	}

	growthRates := make(map[string]interface{})
	for _, volumeID := range volumeIDs {
		// Get recent metrics to calculate growth rates
		endTime := time.Now()
		var startTime time.Time

		switch period {
		case "weekly":
			startTime = endTime.Add(-7 * 24 * time.Hour)
		case "monthly":
			startTime = endTime.Add(-30 * 24 * time.Hour)
		default: // daily
			startTime = endTime.Add(-24 * time.Hour)
		}

		metrics, err := h.metricsRepo.GetMetrics(c.Request.Context(), volumeID, startTime, endTime, 100)
		if err != nil || len(metrics) < 2 {
			continue
		}

		// Calculate growth rate
		latest := metrics[0]
		oldest := metrics[len(metrics)-1]
		timeDiff := latest.MetricTimestamp.Sub(oldest.MetricTimestamp).Hours()
		sizeDiff := latest.TotalSize - oldest.TotalSize

		var rate float64
		if timeDiff > 0 {
			rate = float64(sizeDiff) / timeDiff // bytes per hour
		}

		growthRates[volumeID] = map[string]interface{}{
			"period":     period,
			"rate":       rate,
			"dataPoints": len(metrics),
			"startSize":  oldest.TotalSize,
			"endSize":    latest.TotalSize,
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"period":      period,
		"growthRates": growthRates,
	})
}

// GetCapacityForecast returns capacity forecasting data
// GET /api/v1/volumes/{id}/capacity-forecast?days=30
func (h *Handler) GetCapacityForecast(c *gin.Context) {
	volumeID := c.Param("id")
	if volumeID == "" {
		volumeID = c.Query("volumeId") // fallback to query param
	}

	if err := validateVolumeID(volumeID); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	days, err := strconv.Atoi(c.DefaultQuery("days", "30"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "invalid days parameter",
			"details": "days must be a valid integer",
		})
		return
	}
	if days < 1 || days > 365 {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":    "invalid days parameter",
			"details":  "days must be between 1 and 365",
			"provided": days,
		})
		return
	}

	forecast, err := h.generateCapacityForecast(c, volumeID, days)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to generate forecast"})
		return
	}

	c.JSON(http.StatusOK, forecast)
}

// Helper functions

// validateTimeRange checks if a time range string is valid
func validateTimeRange(timeRange string) error {
	validTimeRanges := []string{"1h", "6h", "1d", "7d", "30d", "90d", "1y"}
	for _, valid := range validTimeRanges {
		if timeRange == valid {
			return nil
		}
	}
	return fmt.Errorf("timeRange must be one of: %s", strings.Join(validTimeRanges, ", "))
}

// validateVolumeID checks if volume ID is not empty and has reasonable length
func validateVolumeID(volumeID string) error {
	if volumeID == "" {
		return fmt.Errorf("volume ID is required")
	}
	if len(volumeID) > 255 {
		return fmt.Errorf("volume ID too long (max 255 characters)")
	}
	return nil
}

func parseTimeRange(timeRange string) (time.Duration, error) {
	switch timeRange {
	case "1h":
		return time.Hour, nil
	case "6h":
		return 6 * time.Hour, nil
	case "1d":
		return 24 * time.Hour, nil
	case "7d":
		return 7 * 24 * time.Hour, nil
	case "30d":
		return 30 * 24 * time.Hour, nil
	case "90d":
		return 90 * 24 * time.Hour, nil
	case "1y":
		return 365 * 24 * time.Hour, nil
	default:
		// Try to parse as duration
		return time.ParseDuration(timeRange)
	}
}

func parseVolumeIDs(param string) []string {
	// Split by comma and trim whitespace
	var ids []string
	for _, id := range strings.Split(param, ",") {
		if trimmed := strings.TrimSpace(id); trimmed != "" {
			ids = append(ids, trimmed)
		}
	}
	return ids
}

// generateCapacityForecast creates a simple capacity forecast based on historical data
func (h *Handler) generateCapacityForecast(c *gin.Context, volumeID string, days int) (map[string]interface{}, error) {
	// Get recent metrics for trend analysis
	endTime := time.Now()
	startTime := endTime.Add(-30 * 24 * time.Hour) // Look back 30 days

	metrics, err := h.metricsRepo.GetMetrics(c.Request.Context(), volumeID, startTime, endTime, 100)
	if err != nil {
		return nil, err
	}

	if len(metrics) < 2 {
		// Not enough data for forecast
		return map[string]interface{}{
			"volumeId":    volumeID,
			"error":       "insufficient historical data",
			"dataPoints":  len(metrics),
			"minRequired": 2,
		}, nil
	}

	// Simple linear projection based on recent growth
	latest := metrics[0]
	oldest := metrics[len(metrics)-1]

	timeDiff := latest.MetricTimestamp.Sub(oldest.MetricTimestamp).Hours() / 24 // days
	sizeDiff := latest.TotalSize - oldest.TotalSize
	dailyGrowth := float64(sizeDiff) / timeDiff

	currentSize := latest.TotalSize
	projectedSize := currentSize + int64(dailyGrowth*float64(days))

	forecast := map[string]interface{}{
		"volumeId":      volumeID,
		"forecastDays":  days,
		"currentSize":   currentSize,
		"projectedSize": projectedSize,
		"growthRate":    dailyGrowth,
		"confidence":    0.7, // Simple model has moderate confidence
		"dataPoints":    len(metrics),
	}

	// Add capacity warnings if growth is significant
	if dailyGrowth > 10*1024*1024 { // > 10MB per day
		forecast["alerts"] = []map[string]interface{}{
			{
				"type":     "rapid_growth",
				"message":  fmt.Sprintf("Volume growing at %.1f MB per day", dailyGrowth/(1024*1024)),
				"severity": "warning",
			},
		}
	}

	return forecast, nil
}
