// Package mounts provides API handlers for Docker mount catalog operations
package mounts

import (
	"log"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/mantonx/volumeviz/internal/db/sqlc"
	"github.com/mantonx/volumeviz/internal/services/docker"
)

// Handler handles mount catalog API requests
type Handler struct {
	mountCatalogService *docker.MountCatalogService
}

// NewHandler creates a new mounts handler
func NewHandler(mountCatalogService *docker.MountCatalogService) *Handler {
	return &Handler{
		mountCatalogService: mountCatalogService,
	}
}

// MountCatalogResponse represents a mount catalog entry in API response
type MountCatalogResponse struct {
	ID                 int64    `json:"id" example:"1"`
	MountID            string   `json:"mount_id" example:"vol_abc123"`
	MountType          string   `json:"mount_type" example:"volume" enums:"volume,bind,tmpfs"`
	VolumeName         *string  `json:"volume_name,omitempty" example:"my-app-data" swaggertype:"string"`
	VolumeDriver       *string  `json:"volume_driver,omitempty" example:"local" swaggertype:"string"`
	VolumeScope        *string  `json:"volume_scope,omitempty" example:"local" swaggertype:"string"`
	SourcePath         string   `json:"source_path" example:"/var/lib/docker/volumes/my-app-data/_data"`
	ContainerCount     int32    `json:"container_count" example:"2"`
	IsOrphaned         bool     `json:"is_orphaned" example:"false"`
	ComposeProject     *string  `json:"compose_project,omitempty" example:"myapp" swaggertype:"string"`
	ComposeServices    []string `json:"compose_services" example:"web,api"`
	ComposeVersion     *string  `json:"compose_version,omitempty" example:"3.8" swaggertype:"string"`
	DiscoverySource    string   `json:"discovery_source" example:"docker_engine"`
	IsTracked          bool     `json:"is_tracked" example:"true"`
	FirstDiscoveredAt  string   `json:"first_discovered_at" swaggertype:"string" format:"date-time" example:"2024-01-01T12:00:00Z"`
	LastSeenAt         string   `json:"last_seen_at" swaggertype:"string" format:"date-time" example:"2024-01-01T14:30:00Z"`
	TrackingEnabledAt  *string  `json:"tracking_enabled_at,omitempty" swaggertype:"string" format:"date-time" example:"2024-01-01T12:00:00Z"`
	TrackingDisabledAt *string  `json:"tracking_disabled_at,omitempty" swaggertype:"string" format:"date-time"`
	CreatedAt          string   `json:"created_at" swaggertype:"string" format:"date-time" example:"2024-01-01T12:00:00Z"`
	UpdatedAt          string   `json:"updated_at" swaggertype:"string" format:"date-time" example:"2024-01-01T14:30:00Z"`
}

// MountCatalogSummaryResponse represents mount catalog summary
type MountCatalogSummaryResponse struct {
	TotalMounts     int64 `json:"total_mounts" example:"25"`
	VolumeMounts    int64 `json:"volume_mounts" example:"15"`
	BindMounts      int64 `json:"bind_mounts" example:"8"`
	TmpfsMounts     int64 `json:"tmpfs_mounts" example:"2"`
	OrphanedMounts  int64 `json:"orphaned_mounts" example:"3"`
	TrackedMounts   int64 `json:"tracked_mounts" example:"20"`
	ComposeProjects int64 `json:"compose_projects" example:"5"`
}

// ListMountCatalogRequest represents request parameters for listing mounts
type ListMountCatalogRequest struct {
	Page           int    `form:"page" binding:"min=1"`
	PageSize       int    `form:"page_size" binding:"min=1,max=100"`
	Sort           string `form:"sort"`
	Query          string `form:"q"`
	MountID        string `form:"mount_id"`
	VolumeName     string `form:"volume_name"`
	ComposeProject string `form:"compose_project"`
	ComposeService string `form:"compose_service"`
	MountType      string `form:"type"`
	Status         string `form:"status"`
	IsOrphaned     string `form:"is_orphaned"`
	IsTracked      string `form:"is_tracked"`
}

// DiscoverMountsRequest represents request to trigger mount discovery
type DiscoverMountsRequest struct {
	Force bool `json:"force" form:"force" example:"false"`
}

// DiscoverMountsResponse represents response from mount discovery
type DiscoverMountsResponse struct {
	Message   string `json:"message" example:"Mount discovery completed successfully"`
	Triggered bool   `json:"triggered" example:"true"`
}

// @Summary Get mount catalog summary
// @Description Returns summary statistics for the Docker mount catalog including counts by type, orphaned status, and tracking status
// @Tags docker-mounts
// @Produce json
// @Success 200 {object} MountCatalogSummaryResponse
// @Failure 500 {object} object
// @Router /api/v1/mounts/summary [get]
func (h *Handler) GetMountCatalogSummary(c *gin.Context) {
	summary, err := h.mountCatalogService.GetMountCatalogSummary(c.Request.Context())
	if err != nil {
		log.Printf("[API] Failed to get mount catalog summary: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to get mount catalog summary",
		})
		return
	}

	response := MountCatalogSummaryResponse{
		TotalMounts:     summary.TotalMounts,
		VolumeMounts:    summary.VolumeMounts,
		BindMounts:      summary.BindMounts,
		TmpfsMounts:     summary.TmpfsMounts,
		OrphanedMounts:  summary.OrphanedMounts,
		TrackedMounts:   summary.TrackedMounts,
		ComposeProjects: summary.ComposeProjects,
	}

	c.JSON(http.StatusOK, response)
}

// @Summary List mount catalog entries
// @Description Returns paginated list of Docker mount catalog entries with advanced filtering, search, and sorting capabilities
// @Tags docker-mounts
// @Produce json
// @Param page query int false "Page number (default: 1)" minimum(1) example(1)
// @Param page_size query int false "Page size (default: 25)" minimum(1) maximum(100) example(25)
// @Param sort query string false "Sort by: mount_type, compose_project, last_seen, container_count" example("mount_type")
// @Param q query string false "Search query for general text search across mount fields" example("myapp")
// @Param mount_id query string false "Filter by mount ID (partial match)" example("vol_")
// @Param volume_name query string false "Filter by volume name (partial match)" example("data")
// @Param compose_project query string false "Filter by Compose project (partial match)" example("myproject")
// @Param compose_service query string false "Filter by Compose service (partial match)" example("web")
// @Param type query string false "Filter by mount type" enums(volume,bind,tmpfs) example("volume")
// @Param status query string false "Filter by status" enums(orphaned,active) example("active")
// @Param is_orphaned query string false "Filter by orphaned status" enums(true,false) example("false")
// @Param is_tracked query string false "Filter by tracking status" enums(true,false) example("true")
// @Success 200 {object} object
// @Failure 400 {object} object
// @Failure 500 {object} object
// @Router /api/v1/mounts [get]
func (h *Handler) ListMountCatalog(c *gin.Context) {
	var req ListMountCatalogRequest
	if err := c.ShouldBindQuery(&req); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "Invalid query parameters",
			"details": err.Error(),
		})
		return
	}

	// Set defaults
	if req.Page == 0 {
		req.Page = 1
	}
	if req.PageSize == 0 {
		req.PageSize = 25
	}
	if req.Sort == "" {
		req.Sort = "mount_type"
	}

	offset := (req.Page - 1) * req.PageSize

	var mounts []sqlc.DockerMountCatalog
	var err error

	// Check if we need to use search or simple list
	hasFilters := req.Query != "" || req.MountID != "" || req.VolumeName != "" ||
		req.ComposeProject != "" || req.ComposeService != "" || req.MountType != "" ||
		req.Status != "" || req.IsOrphaned != "" || req.IsTracked != ""

	if hasFilters {
		// Use search with filters
		filters := docker.SearchFilters{
			Query:          req.Query,
			MountID:        req.MountID,
			VolumeName:     req.VolumeName,
			ComposeProject: req.ComposeProject,
			ComposeService: req.ComposeService,
			MountType:      req.MountType,
			Status:         req.Status,
			Limit:          int32(req.PageSize),
			Offset:         int32(offset),
		}

		// Parse boolean filters
		if req.IsOrphaned != "" {
			if orphaned, err := strconv.ParseBool(req.IsOrphaned); err == nil {
				filters.IsOrphaned = orphaned
				filters.IsOrphanedSet = true
			}
		}
		if req.IsTracked != "" {
			if tracked, err := strconv.ParseBool(req.IsTracked); err == nil {
				filters.IsTracked = tracked
				filters.IsTrackedSet = true
			}
		}

		mounts, err = h.mountCatalogService.SearchMountCatalog(c.Request.Context(), filters)
	} else {
		// Use simple list
		mounts, err = h.mountCatalogService.ListMountCatalogEntries(
			c.Request.Context(),
			int32(req.PageSize),
			int32(offset),
		)
	}

	if err != nil {
		log.Printf("[API] Failed to list mount catalog: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to list mount catalog",
		})
		return
	}

	// Convert to response format
	response := make([]MountCatalogResponse, len(mounts))
	for i, mount := range mounts {
		response[i] = h.convertToMountCatalogResponse(mount)
	}

	c.JSON(http.StatusOK, gin.H{
		"mounts": response,
		"pagination": gin.H{
			"page":      req.Page,
			"page_size": req.PageSize,
			"total":     len(response), // Note: This is just the current page, not total count
		},
		"filters": gin.H{
			"sort":            req.Sort,
			"q":               req.Query,
			"mount_id":        req.MountID,
			"volume_name":     req.VolumeName,
			"compose_project": req.ComposeProject,
			"compose_service": req.ComposeService,
			"type":            req.MountType,
			"status":          req.Status,
			"is_orphaned":     req.IsOrphaned,
			"is_tracked":      req.IsTracked,
		},
	})
}

// @Summary Trigger mount discovery
// @Description Triggers discovery and cataloging of Docker mounts from the Docker Engine. Scans all running containers and volumes to build/update the mount catalog.
// @Tags docker-mounts
// @Accept json
// @Produce json
// @Param request body DiscoverMountsRequest false "Discovery options"
// @Success 200 {object} DiscoverMountsResponse
// @Failure 400 {object} object
// @Failure 500 {object} object
// @Router /api/v1/mounts/discover [post]
func (h *Handler) DiscoverMounts(c *gin.Context) {
	var req DiscoverMountsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		// If JSON binding fails, try form binding for simple POST
		if err := c.ShouldBind(&req); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error":   "Invalid request format",
				"details": err.Error(),
			})
			return
		}
	}

	log.Printf("[API] Starting mount discovery (force: %v)", req.Force)

	err := h.mountCatalogService.DiscoverMounts(c.Request.Context())
	if err != nil {
		log.Printf("[API] Failed to discover mounts: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "Failed to discover mounts",
			"details": err.Error(),
		})
		return
	}

	response := DiscoverMountsResponse{
		Message:   "Mount discovery completed successfully",
		Triggered: true,
	}

	c.JSON(http.StatusOK, response)
}

// @Summary Get mount details
// @Description Returns detailed metadata for a specific mount including volume info, compose metadata, and tracking status
// @Tags docker-mounts
// @Produce json
// @Param id path string true "Mount ID" example("vol_abc123")
// @Success 200 {object} MountCatalogResponse
// @Failure 400 {object} object
// @Failure 404 {object} object
// @Failure 500 {object} object
// @Router /api/v1/mounts/{id} [get]
func (h *Handler) GetMountDetails(c *gin.Context) {
	mountID := c.Param("id")
	if mountID == "" {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Mount ID is required",
		})
		return
	}

	// Convert mountID to int64
	mountIDInt, err := strconv.ParseInt(mountID, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid mount ID format",
		})
		return
	}

	// Get mount details from database
	mount, err := h.mountCatalogService.GetMountDetails(c.Request.Context(), mountIDInt)
	if err != nil {
		if err.Error() == "no rows in result set" {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error":    "Mount not found",
				"mount_id": mountID,
			})
			return
		}
		log.Printf("[API] Failed to get mount details: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to get mount details",
		})
		return
	}

	response := h.convertToMountCatalogResponse(*mount)
	c.JSON(http.StatusOK, response)
}

// @Summary Update mount tracking status
// @Description Enable or disable tracking for a specific mount. When tracking is enabled, the mount will be included in volume scans and analysis.
// @Tags docker-mounts
// @Accept json
// @Produce json
// @Param mount_id path string true "Mount ID" example("vol_abc123")
// @Param request body object true "Tracking status" example({"is_tracked": true})
// @Success 200 {object} MountCatalogResponse
// @Failure 400 {object} object
// @Failure 404 {object} object
// @Failure 501 {object} object
// @Router /api/v1/mounts/{mount_id}/tracking [put]
func (h *Handler) UpdateMountTracking(c *gin.Context) {
	mountID := c.Param("mount_id")
	if mountID == "" {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Mount ID is required",
		})
		return
	}

	var req struct {
		IsTracked bool `json:"is_tracked" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "Invalid request format",
			"details": err.Error(),
		})
		return
	}

	// Note: This would need to be implemented in the mount catalog service
	// For now, return a not implemented response
	c.JSON(http.StatusNotImplemented, gin.H{
		"error":      "Mount tracking update not yet implemented",
		"mount_id":   mountID,
		"is_tracked": req.IsTracked,
	})
}

// convertToMountCatalogResponse converts SQLC model to API response
func (h *Handler) convertToMountCatalogResponse(mount sqlc.DockerMountCatalog) MountCatalogResponse {
	response := MountCatalogResponse{
		ID:                mount.ID,
		MountID:           mount.MountID,
		MountType:         mount.MountType,
		SourcePath:        mount.SourcePath,
		ContainerCount:    mount.ContainerCount,
		IsOrphaned:        mount.IsOrphaned,
		ComposeServices:   mount.ComposeServices,
		DiscoverySource:   mount.DiscoverySource,
		IsTracked:         mount.IsTracked,
		FirstDiscoveredAt: mount.FirstDiscoveredAt.Time.Format("2006-01-02T15:04:05Z"),
		LastSeenAt:        mount.LastSeenAt.Time.Format("2006-01-02T15:04:05Z"),
		CreatedAt:         mount.CreatedAt.Format("2006-01-02T15:04:05Z"),
		UpdatedAt:         mount.UpdatedAt.Format("2006-01-02T15:04:05Z"),
	}

	// Handle nullable fields
	if mount.VolumeName.Valid {
		response.VolumeName = &mount.VolumeName.String
	}
	if mount.VolumeDriver.Valid {
		response.VolumeDriver = &mount.VolumeDriver.String
	}
	if mount.VolumeScope.Valid {
		response.VolumeScope = &mount.VolumeScope.String
	}
	if mount.ComposeProject.Valid {
		response.ComposeProject = &mount.ComposeProject.String
	}
	if mount.ComposeVersion.Valid {
		response.ComposeVersion = &mount.ComposeVersion.String
	}
	if mount.TrackingEnabledAt.Valid {
		timestamp := mount.TrackingEnabledAt.Time.Format("2006-01-02T15:04:05Z")
		response.TrackingEnabledAt = &timestamp
	}
	if mount.TrackingDisabledAt.Valid {
		timestamp := mount.TrackingDisabledAt.Time.Format("2006-01-02T15:04:05Z")
		response.TrackingDisabledAt = &timestamp
	}

	return response
}
