package health

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/mantonx/volumeviz/internal/models"
	"github.com/mantonx/volumeviz/internal/services"
)

// Handler handles health-related HTTP requests
type Handler struct {
	dockerService *services.DockerService
}

// NewHandler creates a new health handler
func NewHandler(dockerService *services.DockerService) *Handler {
	return &Handler{
		dockerService: dockerService,
	}
}

// GetDockerHealth returns Docker daemon health status
// GET /api/v1/health/docker
func (h *Handler) GetDockerHealth(c *gin.Context) {
	ctx := c.Request.Context()

	// Get Docker version and connection status
	version, versionErr := h.dockerService.GetVersion(ctx)
	dockerAvailable := h.dockerService.IsDockerAvailable(ctx)

	health := models.DockerHealth{
		Status: "healthy",
	}

	if !dockerAvailable || versionErr != nil {
		health.Status = "unhealthy"
		health.Message = "Docker daemon is not available"
		if versionErr != nil {
			health.Message = versionErr.Error()
		}
	} else {
		health.Version = version.Version
		health.APIVersion = version.APIVersion
		health.GoVersion = version.GoVersion
		health.GitCommit = version.GitCommit
		health.BuildTime = version.BuildTime
	}

	statusCode := http.StatusOK
	switch health.Status {
	case "unhealthy":
		statusCode = http.StatusServiceUnavailable
	case "degraded":
		statusCode = http.StatusPartialContent
	}

	c.JSON(statusCode, health)
}

// GetAppHealth returns application health status
// GET /api/v1/health
func (h *Handler) GetAppHealth(c *gin.Context) {
	ctx := c.Request.Context()

	// Check Docker connectivity
	dockerAvailable := h.dockerService.IsDockerAvailable(ctx)

	health := gin.H{
		"status":    "healthy",
		"timestamp": time.Now().Unix(),
		"checks": gin.H{
			"docker": gin.H{
				"status": func() string {
					if dockerAvailable {
						return "healthy"
					}
					return "unhealthy"
				}(),
			},
		},
	}

	// Set overall status based on dependencies
	if !dockerAvailable {
		health["status"] = "degraded"
	}

	statusCode := http.StatusOK
	if health["status"] == "degraded" {
		statusCode = http.StatusPartialContent
	}

	c.JSON(statusCode, health)
}

// GetReadiness returns readiness status for Kubernetes
// GET /api/v1/health/ready
func (h *Handler) GetReadiness(c *gin.Context) {
	ctx := c.Request.Context()
	
	// Check if all critical dependencies are available
	dockerAvailable := h.dockerService.IsDockerAvailable(ctx)
	
	if dockerAvailable {
		c.JSON(http.StatusOK, gin.H{
			"status": "ready",
		})
	} else {
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"status": "not ready",
			"reason": "docker unavailable",
		})
	}
}

// GetLiveness returns liveness status for Kubernetes
// GET /api/v1/health/live
func (h *Handler) GetLiveness(c *gin.Context) {
	// Simple liveness check - if we can respond, we're alive
	c.JSON(http.StatusOK, gin.H{
		"status": "alive",
	})
}