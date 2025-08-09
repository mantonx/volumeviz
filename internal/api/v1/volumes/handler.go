// Package volumes provides HTTP handlers for Docker volume operations
// Includes listing, filtering, and retrieving volume details
package volumes

import (
	"context"
	"fmt"
	"net/http"
	"regexp"
	"sort"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/mantonx/volumeviz/internal/api/models"
	apiutils "github.com/mantonx/volumeviz/internal/api/utils"
	"github.com/mantonx/volumeviz/internal/database"
	"github.com/mantonx/volumeviz/internal/interfaces"
	coremodels "github.com/mantonx/volumeviz/internal/models"
	"github.com/mantonx/volumeviz/internal/utils"
	"github.com/mantonx/volumeviz/internal/websocket"
)

// Handler handles volume-related HTTP requests
// Provides REST endpoints for Docker volume operations
type Handler struct {
	dockerService    interfaces.DockerService
	hub              *websocket.Hub
	database         *database.DB
	systemVolumeRegex *regexp.Regexp
}

// NewHandler creates a new volume handler
// Pass in your Docker service, WebSocket hub, and database to get started
func NewHandler(dockerService interfaces.DockerService, hub *websocket.Hub, db *database.DB) *Handler {
	// Default system volume regex pattern
	pattern := `^(docker_|builder_|containerd|_data$)`
	regex, _ := regexp.Compile(pattern)
	
	return &Handler{
		dockerService:     dockerService,
		hub:               hub,
		database:          db,
		systemVolumeRegex: regex,
	}
}

// ListVolumes returns paginated Docker volumes with metadata
// Implements GET /api/v1/volumes with pagination, sorting, and filtering
func (h *Handler) ListVolumes(c *gin.Context) {
	ctx := c.Request.Context()

	// Parse pagination params
	pagination, err := apiutils.ParsePaginationParams(c)
	if err != nil {
		apiutils.RespondWithBadRequest(c, err.Error(), nil)
		return
	}

	// Parse sort params
	allowedSortFields := []string{"name", "driver", "created_at", "size_bytes"}
	sortParams, err := apiutils.ParseSortParams(c, allowedSortFields)
	if err != nil {
		apiutils.RespondWithBadRequest(c, err.Error(), nil)
		return
	}

	// Parse volume filters
	filters, err := apiutils.ParseVolumeFilters(c)
	if err != nil {
		apiutils.RespondWithBadRequest(c, err.Error(), nil)
		return
	}

	// Try to get volumes from database first
	var apiVolumes []models.VolumeV1
	var total int64

	if h.database != nil {
		apiVolumes, total, err = h.getVolumesFromDB(ctx, pagination, sortParams, filters)
		if err != nil {
			// Fall back to Docker API if DB fails
			apiVolumes, total, err = h.getVolumesFromDocker(ctx, pagination, sortParams, filters)
		}
	} else {
		// No database, use Docker API
		apiVolumes, total, err = h.getVolumesFromDocker(ctx, pagination, sortParams, filters)
	}

	if err != nil {
		apiutils.RespondWithInternalError(c, "Failed to list volumes", err)
		return
	}

	// Build filters map for response
	filtersMap := make(map[string]interface{})
	if filters.Query != "" {
		filtersMap["q"] = filters.Query
	}
	if filters.Driver != "" {
		filtersMap["driver"] = filters.Driver
	}
	if filters.Orphaned != nil {
		filtersMap["orphaned"] = *filters.Orphaned
	}
	if filters.System {
		filtersMap["system"] = filters.System
	}

	// Build paginated response
	response := apiutils.BuildPagedResponse(apiVolumes, pagination, total, sortParams, filtersMap)
	c.JSON(http.StatusOK, response)
}

// getVolumesFromDB retrieves volumes from the database with filtering and pagination
func (h *Handler) getVolumesFromDB(ctx context.Context, pagination *apiutils.PaginationParams, sortParams []apiutils.SortParam, filters *apiutils.VolumeFilters) ([]models.VolumeV1, int64, error) {
	// TODO: Implement database query with filters
	// For now, return empty to fall back to Docker API
	return nil, 0, fmt.Errorf("database query not yet implemented")
}

// getVolumesFromDocker retrieves volumes from Docker API with filtering
func (h *Handler) getVolumesFromDocker(ctx context.Context, pagination *apiutils.PaginationParams, sortParams []apiutils.SortParam, filters *apiutils.VolumeFilters) ([]models.VolumeV1, int64, error) {
	// Get all volumes from Docker
	volumes, err := h.dockerService.ListVolumes(ctx)
	if err != nil {
		return nil, 0, err
	}

	// Apply filters
	filtered := h.filterVolumes(volumes, filters)

	// Convert to API format
	apiVolumes := make([]models.VolumeV1, 0, len(filtered))
	for _, vol := range filtered {
		apiVol := h.convertToAPIVolume(vol)
		apiVolumes = append(apiVolumes, apiVol)
	}

	// Sort volumes
	h.sortVolumes(apiVolumes, sortParams)

	// Calculate total before pagination
	total := int64(len(apiVolumes))

	// Apply pagination
	start := pagination.Offset
	end := pagination.Offset + pagination.Limit
	if start > len(apiVolumes) {
		start = len(apiVolumes)
	}
	if end > len(apiVolumes) {
		end = len(apiVolumes)
	}
	apiVolumes = apiVolumes[start:end]

	return apiVolumes, total, nil
}

// filterVolumes applies filters to the volume list
func (h *Handler) filterVolumes(volumes []coremodels.Volume, filters *apiutils.VolumeFilters) []coremodels.Volume {
	filtered := make([]coremodels.Volume, 0, len(volumes))

	for _, vol := range volumes {
		// Apply system filter
		if !filters.System && h.isSystemVolume(vol) {
			continue
		}

		// Apply driver filter
		if filters.Driver != "" && vol.Driver != filters.Driver {
			continue
		}

		// Apply search query
		if filters.Query != "" && !h.volumeMatchesQuery(vol, filters.Query) {
			continue
		}

		// Apply date filters
		if filters.CreatedAfter != nil && vol.CreatedAt.Before(*filters.CreatedAfter) {
			continue
		}
		if filters.CreatedBefore != nil && vol.CreatedAt.After(*filters.CreatedBefore) {
			continue
		}

		// Apply orphaned filter (requires container check)
		if filters.Orphaned != nil {
			containers, _ := h.dockerService.GetVolumeContainers(context.Background(), vol.ID)
			isOrphaned := len(containers) == 0
			if *filters.Orphaned != isOrphaned {
				continue
			}
		}

		filtered = append(filtered, vol)
	}

	return filtered
}

// convertToAPIVolume converts internal volume model to API format
func (h *Handler) convertToAPIVolume(vol coremodels.Volume) models.VolumeV1 {
	// Get container count for attachments_count
	containers, _ := h.dockerService.GetVolumeContainers(context.Background(), vol.ID)
	attachmentsCount := len(containers)

	// Get size if available from volume usage data
	var sizeBytes *int64
	if vol.UsageData != nil && vol.UsageData.Size >= 0 {
		sizeBytes = &vol.UsageData.Size
	}

	return models.VolumeV1{
		Name:             vol.Name,
		Driver:           vol.Driver,
		CreatedAt:        vol.CreatedAt,
		Labels:           vol.Labels,
		Scope:            vol.Scope,
		Mountpoint:       vol.Mountpoint,
		SizeBytes:        sizeBytes,
		AttachmentsCount: attachmentsCount,
		IsSystem:         h.isSystemVolume(vol),
		IsOrphaned:       attachmentsCount == 0,
	}
}

// isSystemVolume checks if a volume is a system/infrastructure volume
func (h *Handler) isSystemVolume(vol coremodels.Volume) bool {
	// Check against system volume regex
	if h.systemVolumeRegex != nil && h.systemVolumeRegex.MatchString(vol.Name) {
		return true
	}

	// Check for anonymous volumes (64-char hex names)
	if isAnonymousVolume(vol.Name) {
		return true
	}

	return false
}

// volumeMatchesQuery checks if a volume matches the search query
func (h *Handler) volumeMatchesQuery(vol coremodels.Volume, query string) bool {
	query = strings.ToLower(query)

	// Check name
	if strings.Contains(strings.ToLower(vol.Name), query) {
		return true
	}

	// Check labels
	for key, value := range vol.Labels {
		if strings.Contains(strings.ToLower(key), query) || strings.Contains(strings.ToLower(value), query) {
			return true
		}
	}

	return false
}

// sortVolumes sorts volumes based on sort parameters
func (h *Handler) sortVolumes(volumes []models.VolumeV1, sortParams []apiutils.SortParam) {
	if len(sortParams) == 0 {
		// Default sort by name ascending
		sortParams = []apiutils.SortParam{{Field: "name", Direction: "asc"}}
	}

	// TODO: Implement multi-field sorting
	// For now, just use the first sort field
	if len(sortParams) > 0 {
		param := sortParams[0]
		switch param.Field {
		case "name":
			if param.Direction == "asc" {
				sortVolumesByName(volumes, true)
			} else {
				sortVolumesByName(volumes, false)
			}
		case "created_at":
			if param.Direction == "asc" {
				sortVolumesByCreatedAt(volumes, true)
			} else {
				sortVolumesByCreatedAt(volumes, false)
			}
		case "size_bytes":
			if param.Direction == "asc" {
				sortVolumesBySize(volumes, true)
			} else {
				sortVolumesBySize(volumes, false)
			}
		case "driver":
			if param.Direction == "asc" {
				sortVolumesByDriver(volumes, true)
			} else {
				sortVolumesByDriver(volumes, false)
			}
		}
	}
}

// Sorting helper functions
func sortVolumesByName(volumes []models.VolumeV1, asc bool) {
	sort.Slice(volumes, func(i, j int) bool {
		if asc {
			return volumes[i].Name < volumes[j].Name
		}
		return volumes[i].Name > volumes[j].Name
	})
}

func sortVolumesByCreatedAt(volumes []models.VolumeV1, asc bool) {
	sort.Slice(volumes, func(i, j int) bool {
		if asc {
			return volumes[i].CreatedAt.Before(volumes[j].CreatedAt)
		}
		return volumes[i].CreatedAt.After(volumes[j].CreatedAt)
	})
}

func sortVolumesBySize(volumes []models.VolumeV1, asc bool) {
	sort.Slice(volumes, func(i, j int) bool {
		sizeI := int64(0)
		sizeJ := int64(0)
		if volumes[i].SizeBytes != nil {
			sizeI = *volumes[i].SizeBytes
		}
		if volumes[j].SizeBytes != nil {
			sizeJ = *volumes[j].SizeBytes
		}
		if asc {
			return sizeI < sizeJ
		}
		return sizeI > sizeJ
	})
}

func sortVolumesByDriver(volumes []models.VolumeV1, asc bool) {
	sort.Slice(volumes, func(i, j int) bool {
		if asc {
			return volumes[i].Driver < volumes[j].Driver
		}
		return volumes[i].Driver > volumes[j].Driver
	})
}

// GetVolume returns detailed information about a specific volume
// Implements GET /api/v1/volumes/{name}
func (h *Handler) GetVolume(c *gin.Context) {
	ctx := c.Request.Context()
	volumeName := c.Param("name")

	if volumeName == "" {
		apiutils.RespondWithBadRequest(c, "Volume name is required", nil)
		return
	}

	// Get volume from Docker
	volume, err := h.dockerService.GetVolume(ctx, volumeName)
	if err != nil {
		if isNotFoundError(err) {
			apiutils.RespondWithNotFound(c, fmt.Sprintf("Volume '%s' not found", volumeName))
			return
		}
		apiutils.RespondWithInternalError(c, "Failed to get volume", err)
		return
	}

	// Get container attachments
	containers, err := h.dockerService.GetVolumeContainers(ctx, volumeName)
	if err != nil {
		// Don't fail the request, just log the error
		containers = []coremodels.VolumeContainer{}
	}

	// Convert containers to attachments
	attachments := make([]models.AttachmentV1, len(containers))
	for i, container := range containers {
		attachments[i] = models.AttachmentV1{
			ContainerID:   container.ID,
			ContainerName: container.Name,
			MountPath:     container.MountPath,
			RW:            container.AccessMode == "rw",
		}
	}

	// Get size if available
	var sizeBytes *int64
	if volume.UsageData != nil && volume.UsageData.Size >= 0 {
		sizeBytes = &volume.UsageData.Size
	}

	// Build response
	response := models.VolumeDetailV1{
		Name:        volume.Name,
		Driver:      volume.Driver,
		CreatedAt:   volume.CreatedAt,
		Labels:      volume.Labels,
		Scope:       volume.Scope,
		Mountpoint:  volume.Mountpoint,
		SizeBytes:   sizeBytes,
		Attachments: attachments,
		IsSystem:    h.isSystemVolume(*volume),
		IsOrphaned:  len(attachments) == 0,
		Meta: map[string]interface{}{
			"driver_opts": volume.Options,
		},
	}

	c.JSON(http.StatusOK, response)
}

// GetVolumeAttachments returns all containers using a specific volume
// Implements GET /api/v1/volumes/{name}/attachments
func (h *Handler) GetVolumeAttachments(c *gin.Context) {
	ctx := c.Request.Context()
	volumeName := c.Param("name")

	if volumeName == "" {
		apiutils.RespondWithBadRequest(c, "Volume name is required", nil)
		return
	}

	// First, verify the volume exists
	_, err := h.dockerService.GetVolume(ctx, volumeName)
	if err != nil {
		if isNotFoundError(err) {
			apiutils.RespondWithNotFound(c, fmt.Sprintf("Volume '%s' not found", volumeName))
			return
		}
		apiutils.RespondWithInternalError(c, "Failed to verify volume", err)
		return
	}

	// Get containers using this volume
	containers, err := h.dockerService.GetVolumeContainers(ctx, volumeName)
	if err != nil {
		apiutils.RespondWithInternalError(c, "Failed to get volume attachments", err)
		return
	}

	// Convert to API format
	attachments := make([]models.AttachmentV1, len(containers))
	for i, container := range containers {
		attachments[i] = models.AttachmentV1{
			ContainerID:   container.ID,
			ContainerName: container.Name,
			MountPath:     container.MountPath,
			RW:            container.AccessMode == "rw",
			// TODO: Add first_seen and last_seen from database
		}
	}

	response := models.AttachmentsListV1{
		Data:  attachments,
		Total: len(attachments),
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

// GetOrphanedVolumes returns all volumes with zero attachments
// Implements GET /api/v1/reports/orphaned
func (h *Handler) GetOrphanedVolumes(c *gin.Context) {
	ctx := c.Request.Context()

	// Parse pagination params
	pagination, err := apiutils.ParsePaginationParams(c)
	if err != nil {
		apiutils.RespondWithBadRequest(c, err.Error(), nil)
		return
	}

	// Parse sort params - default to size_bytes:desc
	allowedSortFields := []string{"name", "driver", "created_at", "size_bytes"}
	sortParams, err := apiutils.ParseSortParams(c, allowedSortFields)
	if err != nil {
		apiutils.RespondWithBadRequest(c, err.Error(), nil)
		return
	}
	if len(sortParams) == 0 {
		sortParams = []apiutils.SortParam{{Field: "size_bytes", Direction: "desc"}}
	}

	// Parse system filter
	includeSystem := c.DefaultQuery("system", "false") == "true"

	// Get all volumes
	volumes, err := h.dockerService.ListVolumes(ctx)
	if err != nil {
		apiutils.RespondWithInternalError(c, "Failed to list volumes", err)
		return
	}

	// Filter for orphaned volumes only
	orphaned := make([]models.OrphanedVolumeV1, 0)
	for _, vol := range volumes {
		// Skip system volumes unless requested
		if !includeSystem && h.isSystemVolume(vol) {
			continue
		}

		// Check if volume has any containers
		containers, _ := h.dockerService.GetVolumeContainers(ctx, vol.ID)
		if len(containers) == 0 {
			// Get size if available
			var sizeBytes int64
			if vol.UsageData != nil && vol.UsageData.Size >= 0 {
				sizeBytes = vol.UsageData.Size
			}

			orphaned = append(orphaned, models.OrphanedVolumeV1{
				Name:      vol.Name,
				Driver:    vol.Driver,
				SizeBytes: sizeBytes,
				CreatedAt: vol.CreatedAt,
				IsSystem:  h.isSystemVolume(vol),
			})
		}
	}

	// Sort orphaned volumes
	h.sortOrphanedVolumes(orphaned, sortParams)

	// Calculate total before pagination
	total := int64(len(orphaned))

	// Apply pagination
	start := pagination.Offset
	end := pagination.Offset + pagination.Limit
	if start > len(orphaned) {
		start = len(orphaned)
	}
	if end > len(orphaned) {
		end = len(orphaned)
	}
	orphaned = orphaned[start:end]

	// Build paginated response
	response := apiutils.BuildPagedResponse(orphaned, pagination, total, sortParams, nil)
	c.JSON(http.StatusOK, response)
}

// sortOrphanedVolumes sorts orphaned volumes based on sort parameters
func (h *Handler) sortOrphanedVolumes(volumes []models.OrphanedVolumeV1, sortParams []apiutils.SortParam) {
	if len(sortParams) == 0 {
		return
	}

	param := sortParams[0]
	switch param.Field {
	case "name":
		sort.Slice(volumes, func(i, j int) bool {
			if param.Direction == "asc" {
				return volumes[i].Name < volumes[j].Name
			}
			return volumes[i].Name > volumes[j].Name
		})
	case "driver":
		sort.Slice(volumes, func(i, j int) bool {
			if param.Direction == "asc" {
				return volumes[i].Driver < volumes[j].Driver
			}
			return volumes[i].Driver > volumes[j].Driver
		})
	case "created_at":
		sort.Slice(volumes, func(i, j int) bool {
			if param.Direction == "asc" {
				return volumes[i].CreatedAt.Before(volumes[j].CreatedAt)
			}
			return volumes[i].CreatedAt.After(volumes[j].CreatedAt)
		})
	case "size_bytes":
		sort.Slice(volumes, func(i, j int) bool {
			if param.Direction == "asc" {
				return volumes[i].SizeBytes < volumes[j].SizeBytes
			}
			return volumes[i].SizeBytes > volumes[j].SizeBytes
		})
	}
}
