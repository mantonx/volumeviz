package alerts

import (
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/mantonx/volumeviz/internal/core/interfaces"
	"github.com/mantonx/volumeviz/internal/models"
	"github.com/mantonx/volumeviz/internal/store"
)

// Handler handles alerts-related HTTP requests
type Handler struct {
	store       store.Store
	alertEngine interfaces.AlertEngine
}

// NewHandler creates a new alerts handler
func NewHandler(store store.Store, alertEngine interfaces.AlertEngine) *Handler {
	return &Handler{
		store:       store,
		alertEngine: alertEngine,
	}
}

// Alert Rules endpoints

// CreateAlertRule creates a new alert rule
// @Summary Create alert rule
// @Description Create a new alert rule
// @Tags alerts
// @Accept json
// @Produce json
// @Param rule body models.CreateAlertRuleParams true "Alert rule to create"
// @Success 201 {object} models.AlertRule
// @Failure 400 {object} models.ErrorResponse
// @Failure 500 {object} models.ErrorResponse
// @Router /alerts/rules [post]
func (h *Handler) CreateAlertRule(c *gin.Context) {
	var params models.CreateAlertRuleParams
	if err := c.ShouldBindJSON(&params); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body", "details": err.Error()})
		return
	}

	// Validate the rule query
	if err := h.alertEngine.GetEvaluator().ValidateRuleQuery(c.Request.Context(), params.Query); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid query", "details": err.Error()})
		return
	}

	// Create the rule
	rule, err := h.store.Alerts().CreateAlertRule(c.Request.Context(), params)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create alert rule", "details": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, rule)
}

// GetAlertRules lists alert rules with pagination
// @Summary List alert rules
// @Description Get a list of alert rules with pagination
// @Tags alerts
// @Accept json
// @Produce json
// @Param limit query int false "Number of items to return (default: 50, max: 100)"
// @Param offset query int false "Number of items to skip (default: 0)"
// @Param enabled query bool false "Filter by enabled status"
// @Success 200 {object} models.ErrorResponse
// @Failure 500 {object} models.ErrorResponse
// @Router /alerts/rules [get]
func (h *Handler) GetAlertRules(c *gin.Context) {
	// Parse pagination parameters
	limit := 50
	if l := c.Query("limit"); l != "" {
		if parsed, err := strconv.Atoi(l); err == nil && parsed > 0 && parsed <= 100 {
			limit = parsed
		}
	}

	offset := 0
	if o := c.Query("offset"); o != "" {
		if parsed, err := strconv.Atoi(o); err == nil && parsed >= 0 {
			offset = parsed
		}
	}

	// Check if filtering by enabled status
	enabledFilter := c.Query("enabled")

	var rules []*models.AlertRule
	var err error

	if enabledFilter == "true" {
		rules, err = h.store.Alerts().ListEnabledAlertRules(c.Request.Context())
	} else {
		rules, err = h.store.Alerts().ListAlertRules(c.Request.Context(), int32(limit), int32(offset))
	}

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve alert rules", "details": err.Error()})
		return
	}

	// Get total count for pagination
	total, err := h.store.Alerts().CountAlertRules(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to count alert rules", "details": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"rules": rules,
		"pagination": gin.H{
			"limit":  limit,
			"offset": offset,
			"total":  total,
		},
	})
}

// GetAlertRule gets a specific alert rule
// @Summary Get alert rule
// @Description Get a specific alert rule by ID
// @Tags alerts
// @Accept json
// @Produce json
// @Param id path int true "Alert rule ID"
// @Success 200 {object} models.AlertRule
// @Failure 404 {object} models.ErrorResponse
// @Failure 500 {object} models.ErrorResponse
// @Router /alerts/rules/{id} [get]
func (h *Handler) GetAlertRule(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid rule ID"})
		return
	}

	rule, err := h.store.Alerts().GetAlertRule(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Alert rule not found"})
		return
	}

	c.JSON(http.StatusOK, rule)
}

// UpdateAlertRule updates an existing alert rule
// @Summary Update alert rule
// @Description Update an existing alert rule
// @Tags alerts
// @Accept json
// @Produce json
// @Param id path int true "Alert rule ID"
// @Param rule body models.UpdateAlertRuleParams true "Alert rule updates"
// @Success 200 {object} models.ErrorResponse
// @Failure 400 {object} models.ErrorResponse
// @Failure 404 {object} models.ErrorResponse
// @Failure 500 {object} models.ErrorResponse
// @Router /alerts/rules/{id} [put]
func (h *Handler) UpdateAlertRule(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid rule ID"})
		return
	}

	var params models.UpdateAlertRuleParams
	if err := c.ShouldBindJSON(&params); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body", "details": err.Error()})
		return
	}

	params.ID = id

	// Validate the rule query if provided
	if params.Query != "" {
		if err := h.alertEngine.GetEvaluator().ValidateRuleQuery(c.Request.Context(), params.Query); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid query", "details": err.Error()})
			return
		}
	}

	// Update the rule
	if err := h.store.Alerts().UpdateAlertRule(c.Request.Context(), params); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update alert rule", "details": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Alert rule updated successfully"})
}

// DeleteAlertRule deletes an alert rule
// @Summary Delete alert rule
// @Description Delete an alert rule and all associated alerts
// @Tags alerts
// @Accept json
// @Produce json
// @Param id path int true "Alert rule ID"
// @Success 204
// @Failure 404 {object} models.ErrorResponse
// @Failure 500 {object} models.ErrorResponse
// @Router /alerts/rules/{id} [delete]
func (h *Handler) DeleteAlertRule(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid rule ID"})
		return
	}

	if err := h.store.Alerts().DeleteAlertRule(c.Request.Context(), id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete alert rule", "details": err.Error()})
		return
	}

	c.Status(http.StatusNoContent)
}

// TestAlertRule tests an alert rule against current metrics
// @Summary Test alert rule
// @Description Test an alert rule against current metrics without creating alerts
// @Tags alerts
// @Accept json
// @Produce json
// @Param id path int true "Alert rule ID"
// @Success 200 {object} models.ErrorResponse
// @Failure 404 {object} models.ErrorResponse
// @Failure 500 {object} models.ErrorResponse
// @Router /alerts/rules/{id}/test [post]
func (h *Handler) TestAlertRule(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid rule ID"})
		return
	}

	// Get the rule
	rule, err := h.store.Alerts().GetAlertRule(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Alert rule not found"})
		return
	}

	// Test the rule
	results, err := h.alertEngine.GetEvaluator().TestRule(c.Request.Context(), rule)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to test rule", "details": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"rule":      rule,
		"results":   results,
		"tested_at": time.Now(),
	})
}

// Alert Destinations endpoints

// CreateAlertDestination creates a new alert destination
// @Summary Create alert destination
// @Description Create a new alert destination
// @Tags alerts
// @Accept json
// @Produce json
// @Param destination body models.CreateAlertDestinationParams true "Alert destination to create"
// @Success 201 {object} models.AlertDestination
// @Failure 400 {object} models.ErrorResponse
// @Failure 500 {object} models.ErrorResponse
// @Router /alerts/destinations [post]
func (h *Handler) CreateAlertDestination(c *gin.Context) {
	var params models.CreateAlertDestinationParams
	if err := c.ShouldBindJSON(&params); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body", "details": err.Error()})
		return
	}

	// Validate the destination configuration
	destination := &models.AlertDestination{
		Type:   params.Type,
		Config: params.Config,
	}
	if err := h.alertEngine.ValidateDestination(c.Request.Context(), destination); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid destination configuration", "details": err.Error()})
		return
	}

	// Create the destination
	createdDestination, err := h.store.Alerts().CreateAlertDestination(c.Request.Context(), params)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create alert destination", "details": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, createdDestination)
}

// GetAlertDestinations lists alert destinations
// @Summary List alert destinations
// @Description Get a list of alert destinations with pagination
// @Tags alerts
// @Accept json
// @Produce json
// @Param limit query int false "Number of items to return (default: 50, max: 100)"
// @Param offset query int false "Number of items to skip (default: 0)"
// @Param enabled query bool false "Filter by enabled status"
// @Success 200 {object} models.ErrorResponse
// @Failure 500 {object} models.ErrorResponse
// @Router /alerts/destinations [get]
func (h *Handler) GetAlertDestinations(c *gin.Context) {
	// Parse pagination parameters
	limit := 50
	if l := c.Query("limit"); l != "" {
		if parsed, err := strconv.Atoi(l); err == nil && parsed > 0 && parsed <= 100 {
			limit = parsed
		}
	}

	offset := 0
	if o := c.Query("offset"); o != "" {
		if parsed, err := strconv.Atoi(o); err == nil && parsed >= 0 {
			offset = parsed
		}
	}

	// Check if filtering by enabled status
	enabledFilter := c.Query("enabled")

	var destinations []*models.AlertDestination
	var err error

	if enabledFilter == "true" {
		destinations, err = h.store.Alerts().ListEnabledAlertDestinations(c.Request.Context())
	} else {
		destinations, err = h.store.Alerts().ListAlertDestinations(c.Request.Context(), int32(limit), int32(offset))
	}

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve alert destinations", "details": err.Error()})
		return
	}

	// Get total count for pagination
	total, err := h.store.Alerts().CountAlertDestinations(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to count alert destinations", "details": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"destinations": destinations,
		"pagination": gin.H{
			"limit":  limit,
			"offset": offset,
			"total":  total,
		},
	})
}

// GetAlertDestination gets a specific alert destination
// @Summary Get alert destination
// @Description Get a specific alert destination by ID
// @Tags alerts
// @Accept json
// @Produce json
// @Param id path int true "Alert destination ID"
// @Success 200 {object} models.AlertDestination
// @Failure 404 {object} models.ErrorResponse
// @Failure 500 {object} models.ErrorResponse
// @Router /alerts/destinations/{id} [get]
func (h *Handler) GetAlertDestination(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid destination ID"})
		return
	}

	destination, err := h.store.Alerts().GetAlertDestination(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Alert destination not found"})
		return
	}

	c.JSON(http.StatusOK, destination)
}

// UpdateAlertDestination updates an existing alert destination
// @Summary Update alert destination
// @Description Update an existing alert destination
// @Tags alerts
// @Accept json
// @Produce json
// @Param id path int true "Alert destination ID"
// @Param destination body models.UpdateAlertDestinationParams true "Alert destination updates"
// @Success 200 {object} models.ErrorResponse
// @Failure 400 {object} models.ErrorResponse
// @Failure 404 {object} models.ErrorResponse
// @Failure 500 {object} models.ErrorResponse
// @Router /alerts/destinations/{id} [put]
func (h *Handler) UpdateAlertDestination(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid destination ID"})
		return
	}

	var params models.UpdateAlertDestinationParams
	if err := c.ShouldBindJSON(&params); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body", "details": err.Error()})
		return
	}

	params.ID = id

	// Validate the destination configuration if provided
	if params.Config != nil {
		destination := &models.AlertDestination{
			Type:   params.Type,
			Config: params.Config,
		}
		if err := h.alertEngine.ValidateDestination(c.Request.Context(), destination); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid destination configuration", "details": err.Error()})
			return
		}
	}

	// Update the destination
	if err := h.store.Alerts().UpdateAlertDestination(c.Request.Context(), params); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update alert destination", "details": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Alert destination updated successfully"})
}

// DeleteAlertDestination deletes an alert destination
// @Summary Delete alert destination
// @Description Delete an alert destination
// @Tags alerts
// @Accept json
// @Produce json
// @Param id path int true "Alert destination ID"
// @Success 204
// @Failure 404 {object} models.ErrorResponse
// @Failure 500 {object} models.ErrorResponse
// @Router /alerts/destinations/{id} [delete]
func (h *Handler) DeleteAlertDestination(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid destination ID"})
		return
	}

	if err := h.store.Alerts().DeleteAlertDestination(c.Request.Context(), id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete alert destination", "details": err.Error()})
		return
	}

	c.Status(http.StatusNoContent)
}

// TestAlertDestination tests an alert destination
// @Summary Test alert destination
// @Description Send a test message to an alert destination
// @Tags alerts
// @Accept json
// @Produce json
// @Param id path int true "Alert destination ID"
// @Param request body object true "Test message request"
// @Success 200 {object} models.ErrorResponse
// @Failure 400 {object} models.ErrorResponse
// @Failure 404 {object} models.ErrorResponse
// @Failure 500 {object} models.ErrorResponse
// @Router /alerts/destinations/{id}/test [post]
func (h *Handler) TestAlertDestination(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid destination ID"})
		return
	}

	var request struct {
		Message string `json:"message"`
	}
	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body", "details": err.Error()})
		return
	}

	if request.Message == "" {
		request.Message = "Test message from VolumeViz alerts system"
	}

	// Test the destination
	if err := h.alertEngine.TestDestination(c.Request.Context(), id, request.Message); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to send test message", "details": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":   "Test message sent successfully",
		"tested_at": time.Now(),
	})
}

// Engine Management endpoints

// GetEngineStatus gets the alerts engine status
// @Summary Get alerts engine status
// @Description Get comprehensive alerts engine status and statistics
// @Tags alerts
// @Accept json
// @Produce json
// @Success 200 {object} models.ErrorResponse
// @Failure 500 {object} models.ErrorResponse
// @Router /alerts/engine/status [get]
func (h *Handler) GetEngineStatus(c *gin.Context) {
	stats, err := h.alertEngine.GetStats(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get engine stats", "details": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"engine":       stats,
		"retrieved_at": time.Now(),
	})
}

// TriggerEvaluation manually triggers alert evaluation
// @Summary Trigger alert evaluation
// @Description Manually trigger evaluation of all alert rules
// @Tags alerts
// @Accept json
// @Produce json
// @Success 200 {object} models.ErrorResponse
// @Failure 500 {object} models.ErrorResponse
// @Router /alerts/engine/evaluate [post]
func (h *Handler) TriggerEvaluation(c *gin.Context) {
	if err := h.alertEngine.TriggerEvaluation(c.Request.Context()); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to trigger evaluation", "details": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":      "Alert evaluation triggered successfully",
		"triggered_at": time.Now(),
	})
}

// GetAlerts lists alerts with pagination and filtering
// @Summary List alerts
// @Description Get a list of alerts with pagination and filtering
// @Tags alerts
// @Accept json
// @Produce json
// @Param limit query int false "Number of items to return (default: 50, max: 100)"
// @Param offset query int false "Number of items to skip (default: 0)"
// @Param status query string false "Filter by status (firing, resolved)"
// @Param rule_id query int false "Filter by rule ID"
// @Success 200 {object} models.ErrorResponse
// @Failure 500 {object} models.ErrorResponse
// @Router /alerts [get]
func (h *Handler) GetAlerts(c *gin.Context) {
	// Parse pagination parameters
	limit := 50
	if l := c.Query("limit"); l != "" {
		if parsed, err := strconv.Atoi(l); err == nil && parsed > 0 && parsed <= 100 {
			limit = parsed
		}
	}

	offset := 0
	if o := c.Query("offset"); o != "" {
		if parsed, err := strconv.Atoi(o); err == nil && parsed >= 0 {
			offset = parsed
		}
	}

	// Check for rule ID filter
	var alerts []*models.Alert
	var err error

	if ruleIDStr := c.Query("rule_id"); ruleIDStr != "" {
		if ruleID, parseErr := strconv.ParseInt(ruleIDStr, 10, 64); parseErr == nil {
			alerts, err = h.store.Alerts().ListAlertsByRule(c.Request.Context(), ruleID, int32(limit), int32(offset))
		} else {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid rule_id parameter"})
			return
		}
	} else if c.Query("status") == "firing" {
		alerts, err = h.store.Alerts().ListActiveAlerts(c.Request.Context(), int32(limit), int32(offset))
	} else {
		alerts, err = h.store.Alerts().ListAlerts(c.Request.Context(), int32(limit), int32(offset))
	}

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve alerts", "details": err.Error()})
		return
	}

	// Get total count for pagination
	total, err := h.store.Alerts().CountAlerts(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to count alerts", "details": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"alerts": alerts,
		"pagination": gin.H{
			"limit":  limit,
			"offset": offset,
			"total":  total,
		},
	})
}

// GetAlert gets a specific alert
// @Summary Get alert
// @Description Get a specific alert by ID
// @Tags alerts
// @Accept json
// @Produce json
// @Param id path int true "Alert ID"
// @Success 200 {object} models.Alert
// @Failure 404 {object} models.ErrorResponse
// @Failure 500 {object} models.ErrorResponse
// @Router /alerts/{id} [get]
func (h *Handler) GetAlert(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid alert ID"})
		return
	}

	alert, err := h.store.Alerts().GetAlert(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Alert not found"})
		return
	}

	c.JSON(http.StatusOK, alert)
}

// Alert Routes endpoints

// CreateAlertRoute creates a new alert route
// @Summary Create alert route
// @Description Create a new alert route (rule -> destination mapping)
// @Tags alerts
// @Accept json
// @Produce json
// @Param route body models.CreateAlertRouteParams true "Alert route to create"
// @Success 201 {object} models.AlertRoute
// @Failure 400 {object} models.ErrorResponse
// @Failure 500 {object} models.ErrorResponse
// @Router /alerts/routes [post]
func (h *Handler) CreateAlertRoute(c *gin.Context) {
	var params models.CreateAlertRouteParams
	if err := c.ShouldBindJSON(&params); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body", "details": err.Error()})
		return
	}

	// Validate route matchers
	if err := h.alertEngine.GetRouter().ValidateRouteMatchers(params.Matchers); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid route matchers", "details": err.Error()})
		return
	}

	// Create the route
	route, err := h.store.Alerts().CreateAlertRoute(c.Request.Context(), params)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create alert route", "details": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, route)
}

// GetAlertRoutes lists alert routes
// @Summary List alert routes
// @Description Get a list of alert routes with pagination
// @Tags alerts
// @Accept json
// @Produce json
// @Param limit query int false "Number of items to return (default: 50, max: 100)"
// @Param offset query int false "Number of items to skip (default: 0)"
// @Param destination_id query int false "Filter by destination ID"
// @Success 200 {object} models.ErrorResponse
// @Failure 500 {object} models.ErrorResponse
// @Router /alerts/routes [get]
func (h *Handler) GetAlertRoutes(c *gin.Context) {
	// Parse pagination parameters
	limit := 50
	if l := c.Query("limit"); l != "" {
		if parsed, err := strconv.Atoi(l); err == nil && parsed > 0 && parsed <= 100 {
			limit = parsed
		}
	}

	offset := 0
	if o := c.Query("offset"); o != "" {
		if parsed, err := strconv.Atoi(o); err == nil && parsed >= 0 {
			offset = parsed
		}
	}

	// Check for destination ID filter
	var routes []*models.AlertRoute
	var err error

	if destIDStr := c.Query("destination_id"); destIDStr != "" {
		if destID, parseErr := strconv.ParseInt(destIDStr, 10, 64); parseErr == nil {
			routes, err = h.store.Alerts().ListRoutesByDestination(c.Request.Context(), destID)
		} else {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid destination_id parameter"})
			return
		}
	} else {
		routes, err = h.store.Alerts().ListAlertRoutes(c.Request.Context(), int32(limit), int32(offset))
	}

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve alert routes", "details": err.Error()})
		return
	}

	// Get total count for pagination
	total, err := h.store.Alerts().CountAlertRoutes(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to count alert routes", "details": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"routes": routes,
		"pagination": gin.H{
			"limit":  limit,
			"offset": offset,
			"total":  total,
		},
	})
}

// GetAlertRoute gets a specific alert route
// @Summary Get alert route
// @Description Get a specific alert route by ID
// @Tags alerts
// @Accept json
// @Produce json
// @Param id path int true "Alert route ID"
// @Success 200 {object} models.AlertRoute
// @Failure 404 {object} models.ErrorResponse
// @Failure 500 {object} models.ErrorResponse
// @Router /alerts/routes/{id} [get]
func (h *Handler) GetAlertRoute(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid route ID"})
		return
	}

	route, err := h.store.Alerts().GetAlertRoute(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Alert route not found"})
		return
	}

	c.JSON(http.StatusOK, route)
}

// UpdateAlertRoute updates an existing alert route
// @Summary Update alert route
// @Description Update an existing alert route
// @Tags alerts
// @Accept json
// @Produce json
// @Param id path int true "Alert route ID"
// @Param route body models.UpdateAlertRouteParams true "Alert route updates"
// @Success 200 {object} models.ErrorResponse
// @Failure 400 {object} models.ErrorResponse
// @Failure 404 {object} models.ErrorResponse
// @Failure 500 {object} models.ErrorResponse
// @Router /alerts/routes/{id} [put]
func (h *Handler) UpdateAlertRoute(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid route ID"})
		return
	}

	var params models.UpdateAlertRouteParams
	if err := c.ShouldBindJSON(&params); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body", "details": err.Error()})
		return
	}

	params.ID = id

	// Validate route matchers if provided
	if params.Matchers != nil {
		if err := h.alertEngine.GetRouter().ValidateRouteMatchers(params.Matchers); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid route matchers", "details": err.Error()})
			return
		}
	}

	// Update the route
	if err := h.store.Alerts().UpdateAlertRoute(c.Request.Context(), params); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update alert route", "details": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Alert route updated successfully"})
}

// DeleteAlertRoute deletes an alert route
// @Summary Delete alert route
// @Description Delete an alert route
// @Tags alerts
// @Accept json
// @Produce json
// @Param id path int true "Alert route ID"
// @Success 204
// @Failure 404 {object} models.ErrorResponse
// @Failure 500 {object} models.ErrorResponse
// @Router /alerts/routes/{id} [delete]
func (h *Handler) DeleteAlertRoute(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid route ID"})
		return
	}

	if err := h.store.Alerts().DeleteAlertRoute(c.Request.Context(), id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete alert route", "details": err.Error()})
		return
	}

	c.Status(http.StatusNoContent)
}

// GetDeliveryHistory gets delivery history for alerts
// @Summary Get delivery history
// @Description Get delivery history with pagination and filtering
// @Tags alerts
// @Accept json
// @Produce json
// @Param limit query int false "Number of items to return (default: 50, max: 100)"
// @Param offset query int false "Number of items to skip (default: 0)"
// @Param alert_id query int false "Filter by alert ID"
// @Param destination_id query int false "Filter by destination ID"
// @Param status query string false "Filter by delivery status"
// @Success 200 {object} models.ErrorResponse
// @Failure 500 {object} models.ErrorResponse
// @Router /alerts/deliveries [get]
func (h *Handler) GetDeliveryHistory(c *gin.Context) {
	// Parse pagination parameters
	limit := 50
	if l := c.Query("limit"); l != "" {
		if parsed, err := strconv.Atoi(l); err == nil && parsed > 0 && parsed <= 100 {
			limit = parsed
		}
	}

	offset := 0
	if o := c.Query("offset"); o != "" {
		if parsed, err := strconv.Atoi(o); err == nil && parsed >= 0 {
			offset = parsed
		}
	}

	// Apply filters
	var deliveries []*models.AlertDelivery
	var err error

	if alertIDStr := c.Query("alert_id"); alertIDStr != "" {
		if alertID, parseErr := strconv.ParseInt(alertIDStr, 10, 64); parseErr == nil {
			deliveries, err = h.store.Alerts().ListDeliveriesByAlert(c.Request.Context(), alertID)
		} else {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid alert_id parameter"})
			return
		}
	} else if destIDStr := c.Query("destination_id"); destIDStr != "" {
		if destID, parseErr := strconv.ParseInt(destIDStr, 10, 64); parseErr == nil {
			deliveries, err = h.store.Alerts().ListDeliveriesByDestination(c.Request.Context(), destID, int32(limit), int32(offset))
		} else {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid destination_id parameter"})
			return
		}
	} else {
		deliveries, err = h.store.Alerts().ListAlertDeliveries(c.Request.Context(), int32(limit), int32(offset))
	}

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve delivery history", "details": err.Error()})
		return
	}

	// Get total count for pagination
	total, err := h.store.Alerts().CountAlertDeliveries(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to count deliveries", "details": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"deliveries": deliveries,
		"pagination": gin.H{
			"limit":  limit,
			"offset": offset,
			"total":  total,
		},
	})
}
