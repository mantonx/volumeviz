package aggregate

import (
	"log"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/mantonx/volumeviz/internal/models"
	"github.com/mantonx/volumeviz/internal/store"
)

// Handler handles aggregate API requests
type Handler struct {
	store store.Store
}

// NewHandler creates a new aggregate handler
func NewHandler(store store.Store) *Handler {
	return &Handler{
		store: store,
	}
}

// GetAggregate godoc
// @Summary Get aggregated file system data
// @Description Get hierarchical file system data with aggregated sizes and counts for visualization
// @Tags Explorer
// @Accept json
// @Produce json
// @Param volumeId query string true "Volume ID" example("media-library")
// @Param path query string false "Starting path" default("/") example("/movies")
// @Param maxDepth query int false "Maximum depth to traverse" default(3) minimum(1) maximum(10)
// @Param stat query string false "Statistic to aggregate" default("size") Enums(size, count)
// @Param minSize query int false "Minimum size filter in bytes" example(1048576)
// @Param limit query int false "Maximum nodes to return" default(1000) maximum(10000)
// @Success 200 {object} models.AggregateResponse
// @Failure 400 {object} models.ErrorResponse
// @Failure 500 {object} models.ErrorResponse
// @Router /api/v1/fs/aggregate [get]
func (h *Handler) GetAggregate(c *gin.Context) {
	// Parse parameters
	volumeID := c.Query("volumeId")
	if volumeID == "" {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Error: "volumeId is required",
		})
		return
	}

	path := c.DefaultQuery("path", "/")
	maxDepth := h.parseInt(c.Query("maxDepth"), 3, 1, 10)
	limit := h.parseInt(c.Query("limit"), 1000, 1, 10000)
	minSize := h.parseInt64(c.Query("minSize"), 0, 0, 0)

	// Start timing
	start := time.Now()

	// Get aggregate data from files repository
	filesRepo := h.store.Files()
	nodes, stats, err := filesRepo.GetAggregateData(c.Request.Context(), volumeID, path, maxDepth, minSize, limit)
	if err != nil {
		log.Printf("Failed to get aggregate data for volume %s, path %s: %v", volumeID, path, err)
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{
			Error: "Failed to retrieve aggregate data",
		})
		return
	}

	// Build response
	response := models.AggregateResponse{
		Nodes: nodes,
		Stats: stats,
		Metadata: models.AggregateMetadata{
			CacheHit:      false, // TODO: Implement caching
			ComputeTimeMs: time.Since(start).Milliseconds(),
			Timestamp:     time.Now(),
			Truncated:     len(nodes) >= limit,
		},
	}

	c.JSON(http.StatusOK, response)
}

// parseInt parses an integer with defaults and bounds
func (h *Handler) parseInt(value string, defaultValue, min, max int) int {
	if value == "" {
		return defaultValue
	}
	result, err := strconv.Atoi(value)
	if err != nil {
		return defaultValue
	}
	if min > 0 && result < min {
		return min
	}
	if max > 0 && result > max {
		return max
	}
	return result
}

// parseInt64 parses an int64 with defaults and bounds
func (h *Handler) parseInt64(value string, defaultValue, min, max int64) int64 {
	if value == "" {
		return defaultValue
	}
	result, err := strconv.ParseInt(value, 10, 64)
	if err != nil {
		return defaultValue
	}
	if min > 0 && result < min {
		return min
	}
	if max > 0 && result > max {
		return max
	}
	return result
}


// RegisterRoutes registers the aggregate routes
func (h *Handler) RegisterRoutes(g *gin.RouterGroup) {
	g.GET("/fs/aggregate", h.GetAggregate)
}