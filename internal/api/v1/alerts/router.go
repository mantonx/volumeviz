package alerts

import (
	"github.com/gin-gonic/gin"
	"github.com/mantonx/volumeviz/internal/core/interfaces"
	"github.com/mantonx/volumeviz/internal/store"
)

// Router handles alerts-related routes
type Router struct {
	handler *Handler
}

// NewRouter creates a new alerts router
func NewRouter(store store.Store, alertEngine interfaces.AlertEngine) *Router {
	return &Router{
		handler: NewHandler(store, alertEngine),
	}
}

// RegisterRoutes registers all alerts-related routes
func (r *Router) RegisterRoutes(group *gin.RouterGroup) {
	// Main alerts group
	alerts := group.Group("/alerts")
	{
		// Alert rules management
		rules := alerts.Group("/rules")
		{
			rules.POST("", r.handler.CreateAlertRule)
			rules.GET("", r.handler.GetAlertRules)
			rules.GET("/:id", r.handler.GetAlertRule)
			rules.PUT("/:id", r.handler.UpdateAlertRule)
			rules.DELETE("/:id", r.handler.DeleteAlertRule)
			rules.POST("/:id/test", r.handler.TestAlertRule)
		}

		// Alert destinations management
		destinations := alerts.Group("/destinations")
		{
			destinations.POST("", r.handler.CreateAlertDestination)
			destinations.GET("", r.handler.GetAlertDestinations)
			destinations.GET("/:id", r.handler.GetAlertDestination)
			destinations.PUT("/:id", r.handler.UpdateAlertDestination)
			destinations.DELETE("/:id", r.handler.DeleteAlertDestination)
			destinations.POST("/:id/test", r.handler.TestAlertDestination)
		}

		// Alert routes management (rule -> destination mapping)
		routes := alerts.Group("/routes")
		{
			routes.POST("", r.handler.CreateAlertRoute)
			routes.GET("", r.handler.GetAlertRoutes)
			routes.GET("/:id", r.handler.GetAlertRoute)
			routes.PUT("/:id", r.handler.UpdateAlertRoute)
			routes.DELETE("/:id", r.handler.DeleteAlertRoute)
		}

		// Engine management
		engine := alerts.Group("/engine")
		{
			engine.GET("/status", r.handler.GetEngineStatus)
			engine.POST("/evaluate", r.handler.TriggerEvaluation)
		}

		// Alert instances
		alerts.GET("", r.handler.GetAlerts)
		alerts.GET("/:id", r.handler.GetAlert)

		// Delivery history
		alerts.GET("/deliveries", r.handler.GetDeliveryHistory)
	}
}

// GetHandler returns the alerts handler for external access
func (r *Router) GetHandler() *Handler {
	return r.handler
}