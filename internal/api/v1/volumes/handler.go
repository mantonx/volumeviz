// Package volumes provides HTTP handlers for Docker volume operations
// Includes listing, filtering, and retrieving volume details
package volumes

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/mantonx/volumeviz/internal/api/models"
	"github.com/mantonx/volumeviz/internal/interfaces"
	coremodels "github.com/mantonx/volumeviz/internal/models"
	"github.com/mantonx/volumeviz/internal/utils"
	"github.com/mantonx/volumeviz/internal/websocket"
)

// Handler handles volume-related HTTP requests
// Provides REST endpoints for Docker volume operations
type Handler struct {
	dockerService interfaces.DockerService
	hub           *websocket.Hub
}

// NewHandler creates a new volume handler
// Pass in your Docker service and WebSocket hub to get started
func NewHandler(dockerService interfaces.DockerService, hub *websocket.Hub) *Handler {
	return &Handler{
		dockerService: dockerService,
		hub:           hub,
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
	userOnly := c.DefaultQuery("user_only", "false") == "true"

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

	// Filter for user volumes only if requested
	if userOnly {
		volumes = filterUserVolumes(volumes)
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

	// Broadcast volume updates via WebSocket (only if not a filtered query)
	if h.hub != nil && driver == "" && labelKey == "" {
		wsVolumes := make([]websocket.VolumeData, len(volumes))
		for i, vol := range volumes {
			wsVolumes[i] = websocket.VolumeData{
				ID:         vol.ID,
				Name:       vol.Name,
				Driver:     vol.Driver,
				Mountpoint: vol.Mountpoint,
				CreatedAt:  vol.CreatedAt,
			}
		}
		h.hub.BroadcastVolumeUpdate(wsVolumes)
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
// Using our utils for consistency
func containsIgnoreCase(s, substr string) bool {
	return utils.ContainsIgnoreCase(s, substr)
}

// filterUserVolumes filters volumes to only return user-mounted volumes
// Excludes Docker infrastructure volumes and anonymous volumes
func filterUserVolumes(volumes []coremodels.Volume) []coremodels.Volume {
	var userVolumes []coremodels.Volume

	for _, vol := range volumes {
		if isUserVolume(vol) {
			userVolumes = append(userVolumes, vol)
		}
	}

	return userVolumes
}

// isUserVolume determines if a volume is a user-mounted volume
// User volumes typically have:
// - options.device pointing to real user directories (like /cifs/fictionalserver/tv)
// - Named volumes that aren't Docker infrastructure
// - Not anonymous Docker volumes (random hash names)
func isUserVolume(vol coremodels.Volume) bool {
	// Check if volume has a device option pointing to user data
	if device, hasDevice := vol.Options["device"]; hasDevice {
		// User-mounted volumes typically have paths like:
		// /cifs/fictionalserver/tv, /mnt/storage, /home/user/data, etc.
		// Exclude Docker internal paths
		if strings.HasPrefix(device, "/var/lib/docker/") ||
			strings.HasPrefix(device, "/var/lib/containers/") {
			return false
		}
		// If it has a device path that's not Docker internal, it's likely user-mounted
		return true
	}

	// Check for named volumes that look like user volumes
	// User volumes often have descriptive names like "tv-shows-readonly", "media-storage"
	// Exclude Docker infrastructure patterns
	if isInfrastructureVolume(vol.Name) {
		return false
	}

	// Check if it's an anonymous volume (Docker generates random hex names)
	if isAnonymousVolume(vol.Name) {
		return false
	}

	// If it's a named volume (not anonymous) and not infrastructure, it's likely user-created
	return len(vol.Name) > 0
}

// isInfrastructureVolume checks if a volume name indicates Docker infrastructure
func isInfrastructureVolume(name string) bool {
	infrastructurePatterns := []string{
		"docker_",
		"_data",
		"postgres_data",
		"mysql_data",
		"redis_data",
		"elasticsearch_data",
		"mongodb_data",
		"grafana_",
		"prometheus_",
		"nginx_",
		"traefik_",
	}

	lowerName := strings.ToLower(name)
	for _, pattern := range infrastructurePatterns {
		if strings.Contains(lowerName, pattern) {
			return true
		}
	}

	return false
}

// isAnonymousVolume checks if a volume name looks like an anonymous Docker volume
// Anonymous volumes typically have random hex names like "a1b2c3d4e5f6..."
func isAnonymousVolume(name string) bool {
	// Anonymous volumes are typically 64-character hex strings
	if len(name) == 64 {
		// Check if it's all hexadecimal characters
		for _, char := range name {
			if !((char >= '0' && char <= '9') || (char >= 'a' && char <= 'f')) {
				return false
			}
		}
		return true
	}

	// Some anonymous volumes might be shorter hex strings
	if len(name) >= 12 && len(name) <= 64 {
		// Check if it looks like a hex string with no meaningful name parts
		hasAlpha := false
		for _, char := range name {
			if (char >= 'a' && char <= 'z') || (char >= 'A' && char <= 'Z') {
				hasAlpha = true
				break
			}
		}
		// If it's all numbers and hex chars with no meaningful letters, likely anonymous
		if !hasAlpha {
			return true
		}
	}

	return false
}
