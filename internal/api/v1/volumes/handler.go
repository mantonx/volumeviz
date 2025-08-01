package volumes

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/mantonx/volumeviz/internal/api/models"
	coremodels "github.com/mantonx/volumeviz/internal/models"
	"github.com/mantonx/volumeviz/internal/services"
)

// Handler handles volume-related HTTP requests
type Handler struct {
	dockerService *services.DockerService
}

// NewHandler creates a new volume handler
func NewHandler(dockerService *services.DockerService) *Handler {
	return &Handler{
		dockerService: dockerService,
	}
}

// ListVolumes returns all Docker volumes with metadata
// @Summary List Docker volumes
// @Description Get a list of all Docker volumes with optional filtering
// @Tags volumes
// @Accept json
// @Produce json
// @Param driver query string false "Filter by driver type" example(local)
// @Param label_key query string false "Filter by label key"
// @Param label_value query string false "Filter by label value"
// @Success 200 {object} models.VolumeListResponse
// @Failure 500 {object} models.ErrorResponse
// @Router /volumes [get]
func (h *Handler) ListVolumes(c *gin.Context) {
	ctx := c.Request.Context()

	// Check query parameters for filtering
	driver := c.Query("driver")
	labelKey := c.Query("label_key")
	labelValue := c.Query("label_value")

	var volumes []coremodels.Volume
	var err error

	// Apply filters if provided
	if driver != "" {
		volumes, err = h.dockerService.GetVolumesByDriver(ctx, driver)
	} else if labelKey != "" {
		volumes, err = h.dockerService.GetVolumesByLabel(ctx, labelKey, labelValue)
	} else {
		volumes, err = h.dockerService.ListVolumes(ctx)
	}

	if err != nil {
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{
			Error:   "Failed to list volumes",
			Code:    "VOLUME_LIST_ERROR",
			Details: map[string]any{"error": err.Error()},
		})
		return
	}

	// Convert internal models to API models
	apiVolumes := make([]models.VolumeResponse, len(volumes))
	for i, vol := range volumes {
		apiVolumes[i] = models.VolumeResponse{
			ID:         vol.ID,
			Name:       vol.Name,
			Driver:     vol.Driver,
			Mountpoint: vol.Mountpoint,
			CreatedAt:  vol.CreatedAt,
			Labels:     vol.Labels,
			Options:    vol.Options,
		}
	}

	response := models.VolumeListResponse{
		Volumes: apiVolumes,
		Total:   len(apiVolumes),
	}

	c.JSON(http.StatusOK, response)
}

// GetVolume returns detailed information about a specific volume
// @Summary Get volume details
// @Description Get detailed information about a specific Docker volume
// @Tags volumes
// @Accept json
// @Produce json
// @Param id path string true "Volume ID"
// @Success 200 {object} models.VolumeResponse
// @Failure 400 {object} models.ErrorResponse
// @Failure 404 {object} models.ErrorResponse
// @Failure 500 {object} models.ErrorResponse
// @Router /volumes/{id} [get]
func (h *Handler) GetVolume(c *gin.Context) {
	ctx := c.Request.Context()
	volumeID := c.Param("id")

	if volumeID == "" {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Error:   "Volume ID is required",
			Code:    "MISSING_VOLUME_ID",
			Details: map[string]any{"message": "Volume ID parameter is missing from the request"},
		})
		return
	}

	volume, err := h.dockerService.GetVolume(ctx, volumeID)
	if err != nil {
		// Check if it's a not found error
		if isNotFoundError(err) {
			c.JSON(http.StatusNotFound, models.ErrorResponse{
				Error:   "Volume not found",
				Code:    "VOLUME_NOT_FOUND",
				Details: map[string]any{"error": err.Error()},
			})
			return
		}

		c.JSON(http.StatusInternalServerError, models.ErrorResponse{
			Error:   "Failed to get volume",
			Code:    "VOLUME_GET_ERROR",
			Details: map[string]any{"error": err.Error()},
		})
		return
	}

	// Convert to API model
	apiVolume := models.VolumeResponse{
		ID:         volume.ID,
		Name:       volume.Name,
		Driver:     volume.Driver,
		Mountpoint: volume.Mountpoint,
		CreatedAt:  volume.CreatedAt,
		Labels:     volume.Labels,
		Options:    volume.Options,
	}

	c.JSON(http.StatusOK, apiVolume)
}

// GetVolumeContainers returns all containers using a specific volume
// GET /api/v1/volumes/:id/containers
func (h *Handler) GetVolumeContainers(c *gin.Context) {
	ctx := c.Request.Context()
	volumeID := c.Param("id")

	if volumeID == "" {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Error:   "Volume ID is required",
			Code:    "MISSING_VOLUME_ID",
			Details: map[string]any{"message": "Volume ID parameter is missing from the request"},
		})
		return
	}

	// First, verify the volume exists
	_, err := h.dockerService.GetVolume(ctx, volumeID)
	if err != nil {
		if isNotFoundError(err) {
			c.JSON(http.StatusNotFound, models.ErrorResponse{
				Error:   "Volume not found",
				Code:    "VOLUME_NOT_FOUND",
				Details: map[string]any{"error": err.Error()},
			})
			return
		}

		c.JSON(http.StatusInternalServerError, models.ErrorResponse{
			Error:   "Failed to verify volume",
			Code:    "VOLUME_VERIFY_ERROR",
			Details: map[string]any{"error": err.Error()},
		})
		return
	}

	// Get containers using this volume
	containers, err := h.dockerService.GetVolumeContainers(ctx, volumeID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{
			Error:   "Failed to get volume containers",
			Code:    "VOLUME_CONTAINERS_ERROR",
			Details: map[string]any{"error": err.Error()},
		})
		return
	}

	response := coremodels.VolumeDetailResponse{
		Volume: coremodels.Volume{
			ID:   volumeID,
			Name: volumeID,
		},
		Containers: containers,
	}

	c.JSON(http.StatusOK, response)
}

// GetVolumeStats returns volume statistics and usage information
// GET /api/v1/volumes/:id/stats
func (h *Handler) GetVolumeStats(c *gin.Context) {
	ctx := c.Request.Context()
	volumeID := c.Param("id")

	if volumeID == "" {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Error:   "Volume ID is required",
			Code:    "MISSING_VOLUME_ID",
			Details: map[string]any{"message": "Volume ID parameter is missing from the request"},
		})
		return
	}

	volume, err := h.dockerService.GetVolume(ctx, volumeID)
	if err != nil {
		if isNotFoundError(err) {
			c.JSON(http.StatusNotFound, models.ErrorResponse{
				Error:   "Volume not found",
				Code:    "VOLUME_NOT_FOUND",
				Details: map[string]any{"error": err.Error()},
			})
			return
		}

		c.JSON(http.StatusInternalServerError, models.ErrorResponse{
			Error:   "Failed to get volume stats",
			Code:    "VOLUME_STATS_ERROR",
			Details: map[string]any{"error": err.Error()},
		})
		return
	}

	// Get containers using this volume for additional stats
	containers, err := h.dockerService.GetVolumeContainers(ctx, volumeID)
	if err != nil {
		// Don't fail the request if we can't get containers
		containers = []coremodels.VolumeContainer{}
	}

	stats := gin.H{
		"volume_id":       volume.ID,
		"volume_name":     volume.Name,
		"driver":          volume.Driver,
		"mountpoint":      volume.Mountpoint,
		"created_at":      volume.CreatedAt,
		"container_count": len(containers),
		"containers":      containers,
	}

	if volume.UsageData != nil {
		stats["usage"] = gin.H{
			"ref_count": volume.UsageData.RefCount,
			"size":      volume.UsageData.Size,
		}
	}

	c.JSON(http.StatusOK, stats)
}

// isNotFoundError checks if the error is a "not found" type error
func isNotFoundError(err error) bool {
	return err != nil && (
		// Check for common Docker "not found" error patterns
		containsIgnoreCase(err.Error(), "not found") ||
		containsIgnoreCase(err.Error(), "no such") ||
		containsIgnoreCase(err.Error(), "doesn't exist"))
}

// containsIgnoreCase checks if a string contains a substring (case-insensitive)
func containsIgnoreCase(s, substr string) bool {
	return strings.Contains(strings.ToLower(s), strings.ToLower(substr))
}