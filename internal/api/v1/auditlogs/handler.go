package auditlogs

import (
	"encoding/csv"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/mantonx/volumeviz/internal/api/middleware"
	"github.com/mantonx/volumeviz/internal/api/models"
	"github.com/mantonx/volumeviz/internal/audit"
)

// Handler handles audit-log browsing/export API requests
type Handler struct {
	auditLogger audit.Logger
}

// NewHandler creates a new audit-logs handler
func NewHandler(auditLogger audit.Logger) *Handler {
	return &Handler{auditLogger: auditLogger}
}

const (
	defaultLimit = 25
	maxLimit     = 200
)

func parseFilters(c *gin.Context) audit.SearchFilters {
	orgID, _ := middleware.GetOrganizationID(c.Request.Context())

	limit := int32(defaultLimit)
	if parsed, err := strconv.Atoi(c.Query("limit")); err == nil && parsed > 0 && parsed <= maxLimit {
		limit = int32(parsed)
	}

	offset := int32(0)
	if parsed, err := strconv.Atoi(c.Query("offset")); err == nil && parsed >= 0 {
		offset = int32(parsed)
	}

	filters := audit.SearchFilters{
		OrganizationID: orgID,
		Limit:          limit,
		Offset:         offset,
	}
	if action := c.Query("action"); action != "" {
		filters.Action = &action
	}
	if status := c.Query("status"); status != "" {
		filters.Status = &status
	}
	if search := c.Query("search"); search != "" {
		filters.Search = &search
	}
	return filters
}

func toEntry(e *audit.Event) models.AuditLogEntryV1 {
	entry := models.AuditLogEntryV1{
		ID:           e.ID,
		Username:     e.Username,
		Email:        e.Email,
		Action:       e.Action,
		ResourceType: e.ResourceType,
		ResourceID:   e.ResourceID,
		IPAddress:    e.IPAddress,
		Status:       e.Status,
		Details:      e.Details,
		Timestamp:    e.Timestamp,
	}
	if e.UserID != nil {
		entry.UserID = *e.UserID
	}
	return entry
}

// SearchAuditLogs returns a paginated, filterable list of audit-log entries
// for the current organization
// @Summary Search audit logs
// @Description Search and filter audit-log events (who did what, when) for the current organization. Admin only.
// @Tags audit-logs
// @Accept json
// @Produce json
// @Param action query string false "Filter by exact action name (e.g. volume.delete)"
// @Param status query string false "Filter by status (success, failure)"
// @Param search query string false "Free-text search across username, action, and details"
// @Param limit query int false "Number of entries to return (default 25, max 200)"
// @Param offset query int false "Number of entries to skip for pagination"
// @Success 200 {object} models.AuditLogSearchResponse
// @Failure 500 {object} map[string]interface{} "Internal server error"
// @Router /api/v1/audit-logs [get]
func (h *Handler) SearchAuditLogs(c *gin.Context) {
	filters := parseFilters(c)

	events, total, err := h.auditLogger.SearchEvents(c.Request.Context(), filters)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "Failed to search audit logs",
			"code":    "AUDIT_LOG_SEARCH_ERROR",
			"message": err.Error(),
		})
		return
	}

	response := models.AuditLogSearchResponse{
		Logs:   make([]models.AuditLogEntryV1, len(events)),
		Total:  total,
		Limit:  filters.Limit,
		Offset: filters.Offset,
	}
	for i, e := range events {
		response.Logs[i] = toEntry(e)
	}

	c.JSON(http.StatusOK, response)
}

// exportMaxRows caps how many rows a single CSV export can contain, to keep
// the request bounded regardless of how large the audit log has grown
const exportMaxRows = 10000

// ExportAuditLogs streams the filtered audit-log results as a CSV file
// @Summary Export audit logs as CSV
// @Description Export filtered audit-log events for the current organization as a CSV file. Admin only.
// @Tags audit-logs
// @Accept json
// @Produce text/csv
// @Param action query string false "Filter by exact action name (e.g. volume.delete)"
// @Param status query string false "Filter by status (success, failure)"
// @Param search query string false "Free-text search across username, action, and details"
// @Success 200 {file} file "CSV file"
// @Failure 500 {object} map[string]interface{} "Internal server error"
// @Router /api/v1/audit-logs/export [get]
func (h *Handler) ExportAuditLogs(c *gin.Context) {
	filters := parseFilters(c)
	filters.Limit = exportMaxRows
	filters.Offset = 0

	events, _, err := h.auditLogger.SearchEvents(c.Request.Context(), filters)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "Failed to export audit logs",
			"code":    "AUDIT_LOG_EXPORT_ERROR",
			"message": err.Error(),
		})
		return
	}

	c.Header("Content-Type", "text/csv")
	c.Header("Content-Disposition", `attachment; filename="audit-logs.csv"`)

	writer := csv.NewWriter(c.Writer)
	_ = writer.Write([]string{"id", "timestamp", "username", "action", "resource_type", "resource_id", "ip_address", "status"})
	for _, e := range events {
		_ = writer.Write([]string{
			strconv.FormatInt(e.ID, 10),
			e.Timestamp.Format("2006-01-02T15:04:05Z07:00"),
			e.Username,
			e.Action,
			e.ResourceType,
			e.ResourceID,
			e.IPAddress,
			e.Status,
		})
	}
	writer.Flush()
}
