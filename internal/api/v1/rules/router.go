package rules

import (
	"github.com/gin-gonic/gin"
)

// SetupRoutes sets up the rules API routes
func SetupRoutes(r *gin.RouterGroup, handler *Handler) {
	// Rules CRUD
	r.POST("/rules", handler.CreateRule)
	r.GET("/rules", handler.ListRules)
	r.GET("/rules/:id", handler.GetRule)
	r.PUT("/rules/:id", handler.UpdateRule)
	r.DELETE("/rules/:id", handler.DeleteRule)

	// Rule state management
	r.POST("/rules/:id/enable", handler.EnableRule)
	r.POST("/rules/:id/disable", handler.DisableRule)

	// Rule evaluation and preview
	r.POST("/rules/preview", handler.PreviewRuleEvaluation)

	// Rule templates
	r.GET("/rules/templates", handler.GetRuleTemplates)

	// Rule schema and validation
	r.GET("/rules/schema", handler.GetSchema)
	r.POST("/rules/validate", handler.ValidateRule)

	// Tracking rules configuration
	r.GET("/tracking/rules", handler.GetTrackingRulesConfig)
	r.PUT("/tracking/rules", handler.UpdateTrackingRulesConfig)

	// Preview tracking rules against current catalog
	r.POST("/tracking/preview", handler.PreviewTrackingRules)

	// Per-mount overrides
	r.POST("/tracking/overrides", handler.CreateMountOverride)
	r.GET("/tracking/overrides", handler.ListMountOverrides)
	r.DELETE("/tracking/overrides/:mount_id", handler.DeleteMountOverride)

	// Apply tracking rules
	r.POST("/tracking/apply", handler.ApplyTrackingRules)
}
