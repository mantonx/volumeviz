package system

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/username/volumeviz/internal/services"
)

// Handler handles system-related HTTP requests
type Handler struct {
	dockerService *services.DockerService
}

// NewHandler creates a new system handler
func NewHandler(dockerService *services.DockerService) *Handler {
	return &Handler{
		dockerService: dockerService,
	}
}

// GetSystemInfo returns system information
// GET /api/v1/system/info
func (h *Handler) GetSystemInfo(c *gin.Context) {
	ctx := c.Request.Context()
	
	version, err := h.dockerService.GetVersion(ctx)
	dockerAvailable := h.dockerService.IsDockerAvailable(ctx)
	
	info := gin.H{
		"service": "volumeviz",
		"version": "1.0.0", // TODO: Get from build info
		"docker": gin.H{
			"available": dockerAvailable,
		},
	}
	
	if err == nil && dockerAvailable {
		info["docker"] = gin.H{
			"available":   true,
			"version":     version.Version,
			"api_version": version.APIVersion,
		}
	}
	
	c.JSON(http.StatusOK, info)
}

// GetVersion returns API version information
// GET /api/v1/system/version
func (h *Handler) GetVersion(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"api_version": "v1",
		"service":     "volumeviz",
		"version":     "1.0.0", // TODO: Get from build info
		"endpoints": gin.H{
			"health":  "/api/v1/health",
			"volumes": "/api/v1/volumes",
			"system":  "/api/v1/system",
		},
	})
}