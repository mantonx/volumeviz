package health

import (
	"github.com/gin-gonic/gin"
	"github.com/mantonx/volumeviz/internal/database"
	"github.com/mantonx/volumeviz/internal/events"
	"github.com/mantonx/volumeviz/internal/interfaces"
	"github.com/mantonx/volumeviz/internal/scheduler"
)

// Router handles health-related routes
type Router struct {
	handler *Handler
}

// NewRouter creates a new health router
func NewRouter(dockerService interfaces.DockerService, db *database.DB, eventsService events.EventService, scanScheduler scheduler.ScanScheduler) *Router {
	return &Router{
		handler: NewHandler(dockerService, db, eventsService, scanScheduler),
	}
}

// RegisterRoutes registers all health-related routes
func (r *Router) RegisterRoutes(group *gin.RouterGroup) {
	health := group.Group("/health")
	{
		health.GET("", r.handler.GetAppHealth)
		health.GET("/docker", r.handler.GetDockerHealth)
		health.GET("/events", r.handler.GetEventsHealth)
		health.GET("/scheduler", r.handler.GetSchedulerHealth)
		health.GET("/ready", r.handler.GetReadiness)
		health.GET("/live", r.handler.GetLiveness)
	}
}
