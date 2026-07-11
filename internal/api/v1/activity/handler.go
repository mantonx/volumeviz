package activity

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/mantonx/volumeviz/internal/api/middleware"
	"github.com/mantonx/volumeviz/internal/api/models"
	"github.com/mantonx/volumeviz/internal/audit"
)

// Handler handles recent-activity API requests
type Handler struct {
	auditLogger audit.Logger
}

// NewHandler creates a new activity handler
func NewHandler(auditLogger audit.Logger) *Handler {
	return &Handler{auditLogger: auditLogger}
}

// recentActivityDefaultLimit is how many events GetRecentActivity returns
// when no limit is specified
const recentActivityDefaultLimit = 10

// recentActivityMaxLimit caps how many events a single request can return
const recentActivityMaxLimit = 50

// GetRecentActivity returns the most recent audit-log events for the
// requesting organization
// @Summary Get recent activity
// @Description Get the most recent audit-log events (volume operations, tracking changes, etc.) for the current organization
// @Tags activity
// @Accept json
// @Produce json
// @Param limit query int false "Number of events to return (default 10, max 50)"
// @Success 200 {object} models.RecentActivityResponse
// @Failure 500 {object} map[string]interface{} "Internal server error"
// @Router /api/v1/activity/recent [get]
func (h *Handler) GetRecentActivity(c *gin.Context) {
	limit := int32(recentActivityDefaultLimit)
	if parsed, err := strconv.Atoi(c.DefaultQuery("limit", "")); err == nil && parsed > 0 && parsed <= recentActivityMaxLimit {
		limit = int32(parsed)
	}

	orgID, _ := middleware.GetOrganizationID(c.Request.Context())

	events, err := h.auditLogger.GetEvents(c.Request.Context(), audit.EventFilters{
		OrganizationID: &orgID,
		Limit:          limit,
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "Failed to get recent activity",
			"code":    "ACTIVITY_ERROR",
			"message": err.Error(),
		})
		return
	}

	response := models.RecentActivityResponse{
		Events: make([]models.ActivityEventV1, len(events)),
	}
	for i, e := range events {
		response.Events[i] = models.ActivityEventV1{
			ID:           e.ID,
			Action:       e.Action,
			ResourceType: e.ResourceType,
			ResourceID:   e.ResourceID,
			Status:       e.Status,
			Timestamp:    e.Timestamp,
		}
	}

	c.JSON(http.StatusOK, response)
}
