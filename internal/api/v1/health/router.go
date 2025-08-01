package health

import (
	"github.com/gin-gonic/gin"
	"github.com/username/volumeviz/internal/services"
)

// Router handles health-related routes
type Router struct {
	handler *Handler
}

// NewRouter creates a new health router
func NewRouter(dockerService *services.DockerService) *Router {
	return &Router{
		handler: NewHandler(dockerService),
	}
}

// RegisterRoutes registers all health-related routes
func (r *Router) RegisterRoutes(group *gin.RouterGroup) {
	health := group.Group("/health")
	{
		health.GET("", r.handler.GetAppHealth)
		health.GET("/docker", r.handler.GetDockerHealth)
		health.GET("/ready", r.handler.GetReadiness)
		health.GET("/live", r.handler.GetLiveness)
	}
}