package rules

import (
	"fmt"
	"net/http"
	"regexp"

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
	r.GET("/rules/schema", getSchema)
	r.POST("/rules/validate", validateRule)

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

// getSchema returns the schema for building rules
func getSchema(c *gin.Context) {
	response := &GetSchemaResponse{
		Fields:    AvailableFields,
		Operators: AvailableOperators,
	}

	c.JSON(http.StatusOK, response)
}

// validateRule validates a rule configuration
func validateRule(c *gin.Context) {
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
