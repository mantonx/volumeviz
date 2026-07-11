package rules

import (
	"context"
	"fmt"
	"net/http"
	"regexp"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/mantonx/volumeviz/internal/repo"
	"github.com/mantonx/volumeviz/internal/services/rules"
)

// Handler handles tracking rules API requests
type Handler struct {
	rulesRepo      *repo.TrackingRulesRepository
	mountsRepo     *repo.MountCatalogRepository
	rulesEngine    *rules.TrackingRulesEngine
	previewService *rules.EvaluationPreviewService
}

// NewHandler creates a new rules handler
func NewHandler(
	rulesRepo *repo.TrackingRulesRepository,
	mountsRepo *repo.MountCatalogRepository,
	rulesEngine *rules.TrackingRulesEngine,
	previewService *rules.EvaluationPreviewService,
) *Handler {
	return &Handler{
		rulesRepo:      rulesRepo,
		mountsRepo:     mountsRepo,
		rulesEngine:    rulesEngine,
		previewService: previewService,
	}
}

// CreateRule creates a new tracking rule
// @Summary Create a new tracking rule
// @Description Creates a new tracking rule for mount filtering
// @Tags tracking-rules
// @Accept json
// @Produce json
// @Param rule body CreateRuleRequest true "Rule to create"
// @Success 201 {object} RuleResponse
// @Failure 400 {object} gin.H
// @Failure 500 {object} gin.H
// @Router /api/v1/rules [post]
func (h *Handler) CreateRule(c *gin.Context) {
	var req CreateRuleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body", "details": err.Error()})
		return
	}

	// Validate request
	if req.Name == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Rule name is required"})
		return
	}

	if req.Action != "include" && req.Action != "exclude" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Action must be 'include' or 'exclude'"})
		return
	}

	// Convert to domain model
	rule := &repo.TrackingRule{
		Name:        req.Name,
		Description: req.Description,
		Action:      req.Action,
		Priority:    req.Priority,
		IsEnabled:   req.IsEnabled,
		Conditions:  convertConditionsFromAPI(req.Conditions),
		CreatedBy:   req.CreatedBy,
	}

	// Create rule
	createdRule, err := h.rulesRepo.CreateRule(c.Request.Context(), rule)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create rule", "details": err.Error()})
		return
	}

	// Convert to response
	response := convertRuleToResponse(createdRule)
	c.JSON(http.StatusCreated, response)
}

// GetRule retrieves a tracking rule by ID
// @Summary Get a tracking rule by ID
// @Description Retrieves a single tracking rule by its ID
// @Tags tracking-rules
// @Produce json
// @Param id path int true "Rule ID"
// @Success 200 {object} RuleResponse
// @Failure 400 {object} gin.H
// @Failure 404 {object} gin.H
// @Router /api/v1/rules/{id} [get]
func (h *Handler) GetRule(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid rule ID", "details": err.Error()})
		return
	}

	rule, err := h.rulesRepo.GetRule(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Rule not found", "details": err.Error()})
		return
	}

	response := convertRuleToResponse(rule)
	c.JSON(http.StatusOK, response)
}

// ListRules lists all tracking rules with optional filtering
// @Summary List tracking rules
// @Description Lists all tracking rules with optional filtering by enabled status or action
// @Tags tracking-rules
// @Produce json
// @Param enabled query bool false "Filter by enabled status"
// @Param action query string false "Filter by action (include/exclude)"
// @Success 200 {object} ListRulesResponse
// @Failure 500 {object} gin.H
// @Router /api/v1/rules [get]
func (h *Handler) ListRules(c *gin.Context) {
	enabledOnly := c.Query("enabled") == "true"
	action := c.Query("action")

	var rulesList []*repo.TrackingRule
	var err error

	if enabledOnly {
		rulesList, err = h.rulesRepo.ListEnabledRules(c.Request.Context())
	} else {
		rulesList, err = h.rulesRepo.ListRules(c.Request.Context())
	}

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to list rules", "details": err.Error()})
		return
	}

	// Filter by action if specified
	if action != "" {
		filtered := make([]*repo.TrackingRule, 0)
		for _, rule := range rulesList {
			if rule.Action == action {
				filtered = append(filtered, rule)
			}
		}
		rulesList = filtered
	}

	// Convert to response
	response := &ListRulesResponse{
		Rules: make([]*RuleResponse, len(rulesList)),
		Total: int32(len(rulesList)),
	}

	for i, rule := range rulesList {
		response.Rules[i] = convertRuleToResponse(rule)
	}

	c.JSON(http.StatusOK, response)
}

// UpdateRule updates a tracking rule
// @Summary Update a tracking rule
// @Description Updates an existing tracking rule
// @Tags tracking-rules
// @Accept json
// @Produce json
// @Param id path int true "Rule ID"
// @Param rule body UpdateRuleRequest true "Rule updates"
// @Success 200 {object} RuleResponse
// @Failure 400 {object} gin.H
// @Failure 404 {object} gin.H
// @Failure 500 {object} gin.H
// @Router /api/v1/rules/{id} [put]
func (h *Handler) UpdateRule(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid rule ID", "details": err.Error()})
		return
	}

	var req UpdateRuleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body", "details": err.Error()})
		return
	}

	// Get existing rule
	existingRule, err := h.rulesRepo.GetRule(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Rule not found", "details": err.Error()})
		return
	}

	// Update fields
	if req.Name != nil {
		existingRule.Name = *req.Name
	}
	if req.Description != nil {
		existingRule.Description = req.Description
	}
	if req.Action != nil {
		if *req.Action != "include" && *req.Action != "exclude" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Action must be 'include' or 'exclude'"})
			return
		}
		existingRule.Action = *req.Action
	}
	if req.Priority != nil {
		existingRule.Priority = *req.Priority
	}
	if req.IsEnabled != nil {
		existingRule.IsEnabled = *req.IsEnabled
	}
	if req.Conditions != nil {
		existingRule.Conditions = convertConditionsFromAPI(*req.Conditions)
	}

	// Update rule
	updatedRule, err := h.rulesRepo.UpdateRule(c.Request.Context(), existingRule)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update rule", "details": err.Error()})
		return
	}

	response := convertRuleToResponse(updatedRule)
	c.JSON(http.StatusOK, response)
}

// DeleteRule deletes a tracking rule
// @Summary Delete a tracking rule
// @Description Deletes a tracking rule by ID
// @Tags tracking-rules
// @Param id path int true "Rule ID"
// @Success 204
// @Failure 400 {object} gin.H
// @Failure 500 {object} gin.H
// @Router /api/v1/rules/{id} [delete]
func (h *Handler) DeleteRule(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid rule ID", "details": err.Error()})
		return
	}

	err = h.rulesRepo.DeleteRule(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete rule", "details": err.Error()})
		return
	}

	c.Status(http.StatusNoContent)
}

// EnableRule enables a tracking rule
// @Summary Enable a tracking rule
// @Description Enables a tracking rule by setting is_enabled to true
// @Tags tracking-rules
// @Produce json
// @Param id path int true "Rule ID"
// @Success 200 {object} RuleResponse
// @Failure 400 {object} gin.H
// @Failure 404 {object} gin.H
// @Failure 500 {object} gin.H
// @Router /api/v1/rules/{id}/enable [put]
func (h *Handler) EnableRule(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid rule ID", "details": err.Error()})
		return
	}

	// Get and update rule
	rule, err := h.rulesRepo.GetRule(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Rule not found", "details": err.Error()})
		return
	}

	rule.IsEnabled = true
	updatedRule, err := h.rulesRepo.UpdateRule(c.Request.Context(), rule)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to enable rule", "details": err.Error()})
		return
	}

	response := convertRuleToResponse(updatedRule)
	c.JSON(http.StatusOK, response)
}

// DisableRule disables a tracking rule
// @Summary Disable a tracking rule
// @Description Disables a tracking rule by setting is_enabled to false
// @Tags tracking-rules
// @Produce json
// @Param id path int true "Rule ID"
// @Success 200 {object} RuleResponse
// @Failure 400 {object} gin.H
// @Failure 404 {object} gin.H
// @Failure 500 {object} gin.H
// @Router /api/v1/rules/{id}/disable [put]
func (h *Handler) DisableRule(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid rule ID", "details": err.Error()})
		return
	}

	// Get and update rule
	rule, err := h.rulesRepo.GetRule(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Rule not found", "details": err.Error()})
		return
	}

	rule.IsEnabled = false
	updatedRule, err := h.rulesRepo.UpdateRule(c.Request.Context(), rule)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to disable rule", "details": err.Error()})
		return
	}

	response := convertRuleToResponse(updatedRule)
	c.JSON(http.StatusOK, response)
}

// PreviewRuleEvaluation previews rule evaluation results
func (h *Handler) PreviewRuleEvaluation(c *gin.Context) {
	var req *rules.PreviewRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body", "details": err.Error()})
		return
	}

	// Set defaults
	if req == nil {
		req = &rules.PreviewRequest{
			IncludeRuleDetails: false,
			IncludeUnmatched:   false,
			DryRun:             true,
		}
	}

	// Perform preview
	preview, err := h.previewService.PreviewRuleEvaluation(c.Request.Context(), req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to preview rule evaluation", "details": err.Error()})
		return
	}

	c.JSON(http.StatusOK, preview)
}

// GetRuleTemplates lists available rule templates
// @Summary Get rule templates
// @Description Lists available rule templates for quick rule creation
// @Tags tracking-rules
// @Produce json
// @Param category query string false "Filter by template category"
// @Param builtin query bool false "Filter builtin templates only"
// @Success 200 {object} ListRuleTemplatesResponse
// @Router /api/v1/rules/templates [get]
func (h *Handler) GetRuleTemplates(c *gin.Context) {
	category := c.Query("category")
	builtinOnly := c.Query("builtin") == "true"

	// For now, return a static list of templates
	// In a full implementation, this would query the database
	templates := getStaticRuleTemplates()

	// Filter by category
	if category != "" {
		filtered := make([]*RuleTemplate, 0)
		for _, template := range templates {
			if template.Category == category {
				filtered = append(filtered, template)
			}
		}
		templates = filtered
	}

	// Filter by builtin
	if builtinOnly {
		filtered := make([]*RuleTemplate, 0)
		for _, template := range templates {
			if template.IsBuiltin {
				filtered = append(filtered, template)
			}
		}
		templates = filtered
	}

	response := &ListRuleTemplatesResponse{
		Templates: templates,
		Total:     int32(len(templates)),
	}

	c.JSON(http.StatusOK, response)
}

// GetTrackingRulesConfig returns the current tracking rules configuration
// @Summary Get tracking rules configuration
// @Description Returns the complete tracking rules configuration with priority ordering
// @Tags tracking-rules-config
// @Produce json
// @Success 200 {object} TrackingRulesConfigResponse
// @Failure 500 {object} gin.H
// @Router /api/v1/tracking/rules [get]
func (h *Handler) GetTrackingRulesConfig(c *gin.Context) {
	rules, err := h.rulesRepo.ListRules(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get tracking rules", "details": err.Error()})
		return
	}

	// Convert to response format and sort by priority
	ruleResponses := make([]*RuleResponse, len(rules))
	for i, rule := range rules {
		ruleResponses[i] = convertRuleToResponse(rule)
	}

	// Sort by priority (ascending - lower priority number = higher priority)
	for i := 0; i < len(ruleResponses); i++ {
		for j := i + 1; j < len(ruleResponses); j++ {
			if ruleResponses[i].Priority > ruleResponses[j].Priority {
				ruleResponses[i], ruleResponses[j] = ruleResponses[j], ruleResponses[i]
			}
		}
	}

	response := &TrackingRulesConfigResponse{
		Rules:   ruleResponses,
		Total:   int32(len(ruleResponses)),
		Enabled: countEnabledRules(ruleResponses),
	}

	c.JSON(http.StatusOK, response)
}

// UpdateTrackingRulesConfig updates the tracking rules configuration (reorder, enable/disable)
// @Summary Update tracking rules configuration
// @Description Updates tracking rules configuration including priority reordering and enable/disable
// @Tags tracking-rules-config
// @Accept json
// @Produce json
// @Param config body UpdateTrackingRulesConfigRequest true "Rules configuration updates"
// @Success 200 {object} TrackingRulesConfigResponse
// @Failure 400 {object} gin.H
// @Failure 500 {object} gin.H
// @Router /api/v1/tracking/rules [put]
func (h *Handler) UpdateTrackingRulesConfig(c *gin.Context) {
	var req UpdateTrackingRulesConfigRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body", "details": err.Error()})
		return
	}

	// Update rules with new configuration
	for _, ruleUpdate := range req.Rules {
		rule, err := h.rulesRepo.GetRule(c.Request.Context(), ruleUpdate.ID)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"error": fmt.Sprintf("Rule with ID %d not found", ruleUpdate.ID),
			})
			return
		}

		// Update priority and enabled status
		rule.Priority = ruleUpdate.Priority
		rule.IsEnabled = ruleUpdate.IsEnabled

		_, err = h.rulesRepo.UpdateRule(c.Request.Context(), rule)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error":   fmt.Sprintf("Failed to update rule %d", ruleUpdate.ID),
				"details": err.Error(),
			})
			return
		}
	}

	// Return updated configuration
	h.GetTrackingRulesConfig(c)
}

// PreviewTrackingRules previews tracking rules against current catalog
// @Summary Preview tracking rules evaluation
// @Description Previews how tracking rules would be applied to the current mount catalog
// @Tags tracking-rules-preview
// @Accept json
// @Produce json
// @Param request body rules.PreviewRequest false "Preview request parameters"
// @Success 200 {object} rules.PreviewResponse
// @Failure 500 {object} gin.H
// @Router /api/v1/tracking/preview [post]
func (h *Handler) PreviewTrackingRules(c *gin.Context) {
	var req *rules.PreviewRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		// Use default request if binding fails
		req = &rules.PreviewRequest{
			IncludeRuleDetails: true,
			IncludeUnmatched:   false,
			DryRun:             true,
		}
	}

	// Set defaults
	if req == nil {
		req = &rules.PreviewRequest{
			IncludeRuleDetails: true,
			IncludeUnmatched:   false,
			DryRun:             true,
		}
	}

	preview, err := h.previewService.PreviewRuleEvaluation(c.Request.Context(), req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "Failed to preview tracking rules",
			"details": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, preview)
}

// CreateMountOverride creates a per-mount tracking override
// @Summary Create mount tracking override
// @Description Creates a per-mount tracking override that supersedes rule-based decisions
// @Tags tracking-overrides
// @Accept json
// @Produce json
// @Param override body CreateMountOverrideRequest true "Mount override to create"
// @Success 201 {object} MountOverrideResponse
// @Failure 400 {object} gin.H
// @Failure 404 {object} gin.H
// @Failure 500 {object} gin.H
// @Router /api/v1/tracking/overrides [post]
func (h *Handler) CreateMountOverride(c *gin.Context) {
	var req CreateMountOverrideRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body", "details": err.Error()})
		return
	}

	// Validate mount ID exists
	_, err := h.mountsRepo.GetMountByMountID(c.Request.Context(), req.MountID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Mount not found", "mount_id": req.MountID})
		return
	}

	// Create override record
	override := &repo.MountTrackingOverride{
		MountID:   req.MountID,
		Action:    req.Action,
		Reason:    req.Reason,
		CreatedBy: req.CreatedBy,
	}

	createdOverride, err := h.rulesRepo.CreateMountOverride(c.Request.Context(), override)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "Failed to create mount override",
			"details": err.Error(),
		})
		return
	}

	response := convertMountOverrideToResponse(createdOverride)
	c.JSON(http.StatusCreated, response)
}

// ListMountOverrides lists all mount tracking overrides
// @Summary List mount tracking overrides
// @Description Lists all per-mount tracking overrides
// @Tags tracking-overrides
// @Produce json
// @Success 200 {object} ListMountOverridesResponse
// @Failure 500 {object} gin.H
// @Router /api/v1/tracking/overrides [get]
func (h *Handler) ListMountOverrides(c *gin.Context) {
	overrides, err := h.rulesRepo.ListMountOverrides(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "Failed to list mount overrides",
			"details": err.Error(),
		})
		return
	}

	response := &ListMountOverridesResponse{
		Overrides: make([]*MountOverrideResponse, len(overrides)),
		Total:     int32(len(overrides)),
	}

	for i, override := range overrides {
		response.Overrides[i] = convertMountOverrideToResponse(override)
	}

	c.JSON(http.StatusOK, response)
}

// DeleteMountOverride deletes a mount tracking override
// @Summary Delete mount tracking override
// @Description Deletes a per-mount tracking override by mount ID
// @Tags tracking-overrides
// @Param mount_id path string true "Mount ID"
// @Success 204
// @Failure 400 {object} gin.H
// @Failure 500 {object} gin.H
// @Router /api/v1/tracking/overrides/{mount_id} [delete]
func (h *Handler) DeleteMountOverride(c *gin.Context) {
	mountID := c.Param("mount_id")
	if mountID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Mount ID is required"})
		return
	}

	err := h.rulesRepo.DeleteMountOverride(c.Request.Context(), mountID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "Failed to delete mount override",
			"details": err.Error(),
		})
		return
	}

	c.Status(http.StatusNoContent)
}

// ApplyTrackingRules applies tracking rules to update mount tracking status
// @Summary Apply tracking rules
// @Description Applies tracking rules to update mount tracking status in the catalog
// @Tags tracking-rules-apply
// @Accept json
// @Produce json
// @Param request body ApplyTrackingRulesRequest false "Apply request parameters"
// @Success 200 {object} ApplyTrackingRulesResponse
// @Failure 500 {object} gin.H
// @Router /api/v1/tracking/apply [post]
func (h *Handler) ApplyTrackingRules(c *gin.Context) {
	var req ApplyTrackingRulesRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		// Allow empty body - apply all rules
		req.DryRun = false
	}

	// Preview first to get the changes
	previewReq := &rules.PreviewRequest{
		IncludeRuleDetails: false,
		IncludeUnmatched:   false,
		DryRun:             true,
	}

	preview, err := h.previewService.PreviewRuleEvaluation(c.Request.Context(), previewReq)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "Failed to preview rule application",
			"details": err.Error(),
		})
		return
	}

	if req.DryRun {
		c.JSON(http.StatusOK, &ApplyTrackingRulesResponse{
			DryRun:       true,
			ChangesCount: calculateChangesCount(preview),
			Changes:      convertPreviewToChanges(preview),
			AppliedAt:    nil,
		})
		return
	}

	// Apply the changes (update mount tracking status)
	changesCount, changes, err := h.applyTrackingChanges(c.Request.Context(), preview)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "Failed to apply tracking rules",
			"details": err.Error(),
		})
		return
	}

	appliedAt := time.Now()
	response := &ApplyTrackingRulesResponse{
		DryRun:       false,
		ChangesCount: changesCount,
		Changes:      changes,
		AppliedAt:    &appliedAt,
	}

	c.JSON(http.StatusOK, response)
}

// Helper functions for conversion

func convertRuleToResponse(rule *repo.TrackingRule) *RuleResponse {
	return &RuleResponse{
		ID:               rule.ID,
		Name:             rule.Name,
		Description:      rule.Description,
		Action:           rule.Action,
		Priority:         rule.Priority,
		IsEnabled:        rule.IsEnabled,
		Conditions:       convertConditionsToAPI(rule.Conditions),
		MatchCount:       rule.MatchCount,
		LastMatchedAt:    rule.LastMatchedAt,
		LastEvaluationAt: rule.LastEvaluationAt,
		CreatedBy:        rule.CreatedBy,
		CreatedAt:        rule.CreatedAt,
		UpdatedAt:        rule.UpdatedAt,
	}
}

func convertConditionsToAPI(conditions []repo.TrackingCondition) []ConditionRequest {
	apiConditions := make([]ConditionRequest, len(conditions))
	for i, condition := range conditions {
		apiConditions[i] = ConditionRequest{
			FieldName:       condition.FieldName,
			Operator:        condition.Operator,
			Value:           condition.Value,
			Values:          condition.Values,
			IsCaseSensitive: condition.IsCaseSensitive,
		}
	}
	return apiConditions
}

func convertConditionsFromAPI(conditions []ConditionRequest) []repo.TrackingCondition {
	repoConditions := make([]repo.TrackingCondition, len(conditions))
	for i, condition := range conditions {
		repoConditions[i] = repo.TrackingCondition{
			FieldName:       condition.FieldName,
			Operator:        condition.Operator,
			Value:           condition.Value,
			Values:          condition.Values,
			IsCaseSensitive: condition.IsCaseSensitive,
		}
	}
	return repoConditions
}

// Helper functions for new endpoints

func countEnabledRules(rules []*RuleResponse) int32 {
	count := int32(0)
	for _, rule := range rules {
		if rule.IsEnabled {
			count++
		}
	}
	return count
}

func convertMountOverrideToResponse(override *repo.MountTrackingOverride) *MountOverrideResponse {
	return &MountOverrideResponse{
		ID:        override.ID,
		MountID:   override.MountID,
		Action:    override.Action,
		Reason:    override.Reason,
		CreatedBy: override.CreatedBy,
		CreatedAt: override.CreatedAt,
		UpdatedAt: override.UpdatedAt,
	}
}

func calculateChangesCount(preview *rules.PreviewResponse) int32 {
	count := int32(0)
	for _, mountPreview := range preview.MountPreviews {
		if mountPreview.ActionChanged {
			count++
		}
	}
	return count
}

func convertPreviewToChanges(preview *rules.PreviewResponse) []*TrackingChange {
	changes := make([]*TrackingChange, 0)
	for _, mountPreview := range preview.MountPreviews {
		if mountPreview.ActionChanged {
			change := &TrackingChange{
				MountID:   mountPreview.Mount.MountID,
				MountName: mountPreview.Mount.VolumeName,
				MountType: mountPreview.Mount.MountType,
				OldAction: mountPreview.CurrentAction,
				NewAction: mountPreview.PreviewAction,
			}
			if mountPreview.WinningRule != nil {
				change.RuleName = &mountPreview.WinningRule.RuleName
				change.RulePriority = &mountPreview.WinningRule.Priority
			}
			changes = append(changes, change)
		}
	}
	return changes
}

func (h *Handler) applyTrackingChanges(ctx context.Context, preview *rules.PreviewResponse) (int32, []*TrackingChange, error) {
	changes := convertPreviewToChanges(preview)

	// Apply changes to mount catalog (update tracking status)
	for _, change := range changes {
		// change.MountID is the Docker-facing mount identifier (e.g. a
		// volume name), not the mount catalog's numeric primary key —
		// look up the row to get the real ID before updating it.
		mount, err := h.mountsRepo.GetMountByMountID(ctx, change.MountID)
		if err != nil {
			return 0, nil, fmt.Errorf("mount not found %s: %w", change.MountID, err)
		}

		// Update tracking status
		isTracked := change.NewAction == "include"
		err = h.mountsRepo.UpdateMountTrackingStatus(ctx, mount.ID, isTracked)
		if err != nil {
			return 0, nil, fmt.Errorf("failed to update tracking status for mount %s: %w", change.MountID, err)
		}
	}

	return int32(len(changes)), changes, nil
}

// getStaticRuleTemplates returns static rule templates for demo purposes
func getStaticRuleTemplates() []*RuleTemplate {
	return []*RuleTemplate{
		{
			ID:          1,
			Name:        "Include All Docker Volumes",
			Description: "Include all Docker named volumes for tracking",
			Category:    "volume",
			IsBuiltin:   true,
			Tags:        []string{"volume", "basic", "include"},
			TemplateData: map[string]interface{}{
				"name":     "Include All Docker Volumes",
				"action":   "include",
				"priority": 100,
				"conditions": []map[string]interface{}{
					{
						"field_name": "source_type",
						"operator":   "equals",
						"value":      "volume",
					},
				},
			},
			CreatedAt: time.Now(),
			UpdatedAt: time.Now(),
		},
		{
			ID:          2,
			Name:        "Exclude Temporary Mounts",
			Description: "Exclude all tmpfs mounts from tracking",
			Category:    "volume",
			IsBuiltin:   true,
			Tags:        []string{"tmpfs", "exclude", "temporary"},
			TemplateData: map[string]interface{}{
				"name":     "Exclude Temporary Mounts",
				"action":   "exclude",
				"priority": 200,
				"conditions": []map[string]interface{}{
					{
						"field_name": "source_type",
						"operator":   "equals",
						"value":      "tmpfs",
					},
				},
			},
			CreatedAt: time.Now(),
			UpdatedAt: time.Now(),
		},
		{
			ID:          3,
			Name:        "Include Production Compose Projects",
			Description: "Include mounts from production Compose projects",
			Category:    "compose",
			IsBuiltin:   true,
			Tags:        []string{"compose", "production", "include"},
			TemplateData: map[string]interface{}{
				"name":     "Include Production Compose Projects",
				"action":   "include",
				"priority": 150,
				"conditions": []map[string]interface{}{
					{
						"field_name": "compose_project",
						"operator":   "suffix",
						"value":      "_prod",
					},
				},
			},
			CreatedAt: time.Now(),
			UpdatedAt: time.Now(),
		},
		{
			ID:          4,
			Name:        "Include Database Volumes",
			Description: "Include volumes used by database containers",
			Category:    "service",
			IsBuiltin:   true,
			Tags:        []string{"database", "service", "include"},
			TemplateData: map[string]interface{}{
				"name":     "Include Database Volumes",
				"action":   "include",
				"priority": 120,
				"conditions": []map[string]interface{}{
					{
						"field_name": "container_image",
						"operator":   "regex",
						"value":      "(postgres|mysql|mongodb|redis|elasticsearch):",
					},
				},
			},
			CreatedAt: time.Now(),
			UpdatedAt: time.Now(),
		},
	}
}

// GetSchema returns the available fields and operators for building rule conditions
// @Summary Get rule builder schema
// @Description Returns the fields and operators available for building tracking-rule conditions, for use in a dynamic rule-creation form
// @Tags tracking-rules
// @Produce json
// @Success 200 {object} GetSchemaResponse
// @Router /api/v1/rules/schema [get]
func (h *Handler) GetSchema(c *gin.Context) {
	response := &GetSchemaResponse{
		Fields:    AvailableFields,
		Operators: AvailableOperators,
	}

	c.JSON(http.StatusOK, response)
}

// ValidateRule validates a rule configuration without creating it
// @Summary Validate a tracking rule
// @Description Validates a rule's name, action, priority, and conditions (including field/operator compatibility and regex syntax) without persisting it
// @Tags tracking-rules
// @Accept json
// @Produce json
// @Param rule body ValidateRuleRequest true "Rule to validate"
// @Success 200 {object} ValidateRuleResponse
// @Failure 400 {object} gin.H
// @Router /api/v1/rules/validate [post]
func (h *Handler) ValidateRule(c *gin.Context) {
	var req ValidateRuleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body", "details": err.Error()})
		return
	}

	response := &ValidateRuleResponse{
		IsValid:  true,
		Errors:   []ValidationError{},
		Warnings: []ValidationWarning{},
	}

	// Validate name
	if req.Name == "" {
		response.IsValid = false
		response.Errors = append(response.Errors, ValidationError{
			Field:   "name",
			Message: "Rule name is required",
			Code:    "required",
		})
	}

	// Validate action
	if req.Action != "include" && req.Action != "exclude" {
		response.IsValid = false
		response.Errors = append(response.Errors, ValidationError{
			Field:   "action",
			Message: "Action must be 'include' or 'exclude'",
			Code:    "invalid_value",
		})
	}

	// Validate priority
	if req.Priority < 0 {
		response.Warnings = append(response.Warnings, ValidationWarning{
			Field:   "priority",
			Message: "Negative priority values may cause unexpected behavior",
			Code:    "negative_priority",
		})
	}

	// Validate conditions
	if len(req.Conditions) == 0 {
		response.IsValid = false
		response.Errors = append(response.Errors, ValidationError{
			Field:   "conditions",
			Message: "At least one condition is required",
			Code:    "required",
		})
	}

	for i, condition := range req.Conditions {
		// Validate field name
		if !isValidField(condition.FieldName) {
			response.IsValid = false
			response.Errors = append(response.Errors, ValidationError{
				Field:   fmt.Sprintf("conditions[%d].field_name", i),
				Message: fmt.Sprintf("Unknown field '%s'", condition.FieldName),
				Code:    "invalid_field",
			})
		}

		// Validate operator
		if !isValidOperator(condition.Operator) {
			response.IsValid = false
			response.Errors = append(response.Errors, ValidationError{
				Field:   fmt.Sprintf("conditions[%d].operator", i),
				Message: fmt.Sprintf("Unknown operator '%s'", condition.Operator),
				Code:    "invalid_operator",
			})
		}

		// Validate operator compatibility with field
		if !isOperatorValidForField(condition.FieldName, condition.Operator) {
			response.IsValid = false
			response.Errors = append(response.Errors, ValidationError{
				Field:   fmt.Sprintf("conditions[%d].operator", i),
				Message: fmt.Sprintf("Operator '%s' is not valid for field '%s'", condition.Operator, condition.FieldName),
				Code:    "incompatible_operator",
			})
		}

		// Validate values based on operator
		if isMultipleValueOperator(condition.Operator) {
			if len(condition.Values) == 0 {
				response.IsValid = false
				response.Errors = append(response.Errors, ValidationError{
					Field:   fmt.Sprintf("conditions[%d].values", i),
					Message: fmt.Sprintf("Operator '%s' requires multiple values", condition.Operator),
					Code:    "missing_values",
				})
			}
		} else {
			if condition.Value == nil || *condition.Value == "" {
				response.IsValid = false
				response.Errors = append(response.Errors, ValidationError{
					Field:   fmt.Sprintf("conditions[%d].value", i),
					Message: fmt.Sprintf("Operator '%s' requires a single value", condition.Operator),
					Code:    "missing_value",
				})
			}
		}

		// Validate regex patterns
		if condition.Operator == "regex" || condition.Operator == "not_regex" {
			if condition.Value != nil {
				if _, err := regexp.Compile(*condition.Value); err != nil {
					response.IsValid = false
					response.Errors = append(response.Errors, ValidationError{
						Field:   fmt.Sprintf("conditions[%d].value", i),
						Message: fmt.Sprintf("Invalid regular expression: %v", err),
						Code:    "invalid_regex",
					})
				}
			}
		}
	}

	// Add preview if validation passed
	if response.IsValid {
		response.Preview = &ValidationPreview{
			EstimatedMatches: 0, // Would be calculated based on current mounts
			SampleMounts:     []string{},
			Conflicts:        []string{},
		}
	}

	c.JSON(http.StatusOK, response)
}

// Helper functions for validation

func isValidField(fieldName string) bool {
	for _, field := range AvailableFields {
		if field.Name == fieldName {
			return true
		}
	}
	return false
}

func isValidOperator(operator string) bool {
	for _, op := range AvailableOperators {
		if op.Name == operator {
			return true
		}
	}
	return false
}

func isOperatorValidForField(fieldName, operator string) bool {
	for _, field := range AvailableFields {
		if field.Name == fieldName {
			for _, validOp := range field.Operators {
				if validOp == operator {
					return true
				}
			}
			return false
		}
	}
	return false
}

func isMultipleValueOperator(operator string) bool {
	return operator == "in" || operator == "not_in"
}
