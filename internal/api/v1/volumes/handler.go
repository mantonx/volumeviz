// Package volumes provides HTTP handlers for Docker volume operations
// Includes listing, filtering, and retrieving volume details
package volumes

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"regexp"
	"sort"
	"strings"
	"time"

	cerrdefs "github.com/containerd/errdefs"
	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/mantonx/volumeviz/internal/api/middleware"
	"github.com/mantonx/volumeviz/internal/api/models"
	apiutils "github.com/mantonx/volumeviz/internal/api/utils"
	"github.com/mantonx/volumeviz/internal/audit"
	"github.com/mantonx/volumeviz/internal/config"
	"github.com/mantonx/volumeviz/internal/db/sqlc"
	"github.com/mantonx/volumeviz/internal/interfaces"
	coremodels "github.com/mantonx/volumeviz/internal/models"
	"github.com/mantonx/volumeviz/internal/realtime"
	"github.com/mantonx/volumeviz/internal/store"
	"github.com/mantonx/volumeviz/internal/utils"
)

// Handler handles volume-related HTTP requests
// Provides REST endpoints for Docker volume operations
type Handler struct {
	dockerService     interfaces.DockerService
	store             store.Store // Modern store interface using sqlc
	realtimePublisher *realtime.Broadcaster
	systemVolumeRegex *regexp.Regexp
	volumeScanner     interfaces.VolumeScanner // VolumeViz scanner for size calculation
	volumeMapping     *config.VolumeMappingConfig
	cache             VolumeCache  // In-memory cache for volume data (Phase 3)
	auditLogger       audit.Logger // Audit trail for destructive operations; nil-safe, defaults to no-op
}

// VolumeCache interface for caching volume data
type VolumeCache interface {
	Get(volumeID string) (models.VolumeV1, bool)
	GetMultiple(volumeIDs []string) (map[string]models.VolumeV1, []string)
	Set(volumeID string, volume models.VolumeV1)
	SetMultiple(volumes []models.VolumeV1)
	Invalidate(volumeID string)
	InvalidateAll()
	GetStats() interface{}
}

// NewHandler creates a new volume handler with store interface
// Pass in your Docker service, store, realtime publisher, and optional volume scanner
func NewHandler(dockerService interfaces.DockerService, store store.Store, publisher *realtime.Broadcaster) *Handler {
	return NewHandlerWithScanner(dockerService, store, publisher, nil)
}

// NewHandlerWithScanner creates a new volume handler with volume scanner for size calculation
func NewHandlerWithScanner(dockerService interfaces.DockerService, store store.Store, publisher *realtime.Broadcaster, scanner interfaces.VolumeScanner) *Handler {
	// Default system volume regex pattern
	pattern := `^(docker_|builder_|containerd|_data$)`
	regex, err := regexp.Compile(pattern)
	if err != nil {
		// Fall back to nil regex if pattern is invalid
		regex = nil
	}

	return &Handler{
		dockerService:     dockerService,
		store:             store,
		realtimePublisher: publisher,
		systemVolumeRegex: regex,
		volumeScanner:     scanner,
		volumeMapping:     config.NewVolumeMappingConfig(),
		cache:             nil,                   // Cache is optional, set via SetCache()
		auditLogger:       audit.NewNoopLogger(), // Overridden via SetAuditLogger() when audit logging is enabled
	}
}

// SetCache sets the volume cache on the handler (Phase 3 optimization)
func (h *Handler) SetCache(cache VolumeCache) {
	h.cache = cache
}

// SetAuditLogger sets the audit logger used to record destructive operations
// (e.g. volume deletion). Defaults to a no-op logger if never called.
func (h *Handler) SetAuditLogger(logger audit.Logger) {
	if logger != nil {
		h.auditLogger = logger
	}
}

// GetCacheStats returns cache statistics
// @Summary Get volume cache statistics
// @Description Returns statistics about the volume cache (hit rate, size, etc.)
// @Tags volumes
// @Accept json
// @Produce json
// @Success 200 {object} map[string]interface{} "Cache statistics"
// @Router /api/v1/volumes/cache/stats [get]
func (h *Handler) GetCacheStats(c *gin.Context) {
	if h.cache == nil {
		c.JSON(http.StatusOK, gin.H{
			"enabled": false,
			"message": "Cache is not enabled",
		})
		return
	}

	stats := h.cache.GetStats()
	c.JSON(http.StatusOK, stats)
}

// InvalidateCache clears the volume cache
// @Summary Invalidate volume cache
// @Description Clears all entries from the volume cache
// @Tags volumes
// @Accept json
// @Produce json
// @Success 200 {object} map[string]interface{} "Cache invalidated"
// @Router /api/v1/volumes/cache/invalidate [post]
func (h *Handler) InvalidateCache(c *gin.Context) {
	if h.cache == nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Cache is not enabled",
		})
		return
	}

	h.cache.InvalidateAll()
	c.JSON(http.StatusOK, gin.H{
		"message": "Cache invalidated successfully",
	})
}

// Helper function to determine if volume is system-managed

// ListVolumes returns paginated Docker volumes with metadata
// @Summary List Docker volumes
// @Description Get paginated list of Docker volumes with filtering, sorting, and search capabilities
// @Tags volumes
// @Accept json
// @Produce json
// @Param page query int false "Page number for pagination (default: 1)"
// @Param page_size query int false "Number of items per page (default: 25, max: 100)"
// @Param sort query string false "Sort field and direction (e.g., 'name:asc', 'created_at:desc'). Available fields: name, driver, created_at, size_bytes, type, status, compose_project, containers"
// @Param q query string false "Search query to filter volumes by name"
// @Param driver query string false "Filter by volume driver" Enums(local, nfs, cifs, overlay2)
// @Param orphaned query bool false "Filter orphaned volumes (not attached to any container)"
// @Param system query bool false "Include system volumes (default: false)"
// @Param created_after query string false "Filter volumes created after date (RFC3339 format)"
// @Param created_before query string false "Filter volumes created before date (RFC3339 format)"
// @Success 200 {object} models.VolumesListResponse "Paginated list of volumes with aggregate summary"
// @Failure 400 {object} models.ErrorResponse "Bad request"
// @Failure 500 {object} models.ErrorResponse "Internal server error"
// @Router /api/v1/volumes [get]
func (h *Handler) ListVolumes(c *gin.Context) {
	ctx := c.Request.Context()

	// Parse pagination params
	pagination, err := apiutils.ParsePaginationParams(c)
	if err != nil {
		apiutils.RespondWithBadRequest(c, err.Error(), nil)
		return
	}

	// Parse sort params - expanded to support frontend requirements
	allowedSortFields := []string{"name", "driver", "created_at", "size_bytes", "type", "status", "compose_project", "containers", "readonly", "last_seen", "growth_rate"}
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

	// Get volumes from database (fast, <100ms)
	// The reconciliation service keeps the database in sync with Docker
	// Fallback to Docker API if database is unavailable
	apiVolumes, total, summary, err := h.getVolumesFromDatabase(ctx, pagination, sortParams, filters)

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
	c.JSON(http.StatusOK, models.VolumesListResponse{
		Data:     apiVolumes,
		Page:     pagination.Page,
		PageSize: pagination.PageSize,
		Total:    total,
		Sort:     apiutils.BuildSortString(sortParams),
		Filters:  filtersMap,
		Summary:  summary,
	})
}

// volumePassesFilters checks if a volume passes the given filters
func (h *Handler) volumePassesFilters(vol models.VolumeV1, filters *apiutils.VolumeFilters) bool {
	// Apply system filter
	if !filters.System && vol.IsSystem {
		return false
	}

	// Apply driver filter
	if filters.Driver != "" && vol.Driver != filters.Driver {
		return false
	}

	// Apply search query
	if filters.Query != "" {
		query := strings.ToLower(filters.Query)
		if !strings.Contains(strings.ToLower(vol.Name), query) &&
			!strings.Contains(strings.ToLower(vol.Driver), query) {
			return false
		}
	}

	// Apply date filters
	if filters.CreatedAfter != nil && vol.CreatedAt.Before(*filters.CreatedAfter) {
		return false
	}
	if filters.CreatedBefore != nil && vol.CreatedAt.After(*filters.CreatedBefore) {
		return false
	}

	// TODO: Apply orphaned filter (requires container check)

	return true
}

// getVolumesFromDocker retrieves volumes from Docker API with filtering
func (h *Handler) getVolumesFromDocker(ctx context.Context, pagination *apiutils.PaginationParams, sortParams []apiutils.SortParam, filters *apiutils.VolumeFilters) ([]models.VolumeV1, int64, models.VolumeListSummaryV1, error) {
	// Get organization ID from context
	orgID, hasOrg := middleware.GetOrganizationID(ctx)

	// Get all volumes from Docker
	volumes, err := h.dockerService.ListVolumes(ctx)
	if err != nil {
		return nil, 0, models.VolumeListSummaryV1{}, err
	}

	// Apply basic filters first
	filtered := h.filterVolumes(volumes, filters)

	// OPTIMIZATION: Batch-fetch all organization volumes upfront to avoid N+1 queries
	// This single query replaces what used to be N queries (one per volume)
	volumeMetadataMap := make(map[string]*sqlc.Volumes)
	if hasOrg && h.store != nil {
		if queries, ok := h.store.Queries().(*sqlc.Queries); ok {
			dbVolumes, err := queries.ListVolumes(ctx, sqlc.ListVolumesParams{
				OrganizationID: pgtype.Int8{Int64: orgID, Valid: true},
				Limit:          10000, // Large limit to get all volumes
				Offset:         0,
			})
			if err == nil {
				for i := range dbVolumes {
					volumeMetadataMap[dbVolumes[i].VolumeID] = &dbVolumes[i]
				}
			}
		}
	}

	// Filter by organization using the pre-fetched map
	if hasOrg && len(volumeMetadataMap) > 0 {
		orgFiltered := make([]coremodels.Volume, 0)
		for _, vol := range filtered {
			if _, exists := volumeMetadataMap[vol.VolumeID]; exists {
				orgFiltered = append(orgFiltered, vol)
			}
		}
		filtered = orgFiltered
	}

	// Batch fetch container information for all volumes to avoid N+1 queries
	volumeNames := make([]string, len(filtered))
	for i, vol := range filtered {
		volumeNames[i] = vol.VolumeID
	}

	containerMap, err := h.dockerService.GetVolumeContainersBatch(ctx, volumeNames)
	if err != nil {
		// Log error but continue with empty container map
		containerMap = make(map[string][]coremodels.VolumeContainer)
	}

	// Convert to API format and enhance with VolumeViz scanner data
	apiVolumes := make([]models.VolumeV1, 0, len(filtered))
	for _, vol := range filtered {
		// Get containers for this volume from the batch result
		volumeContainers := containerMap[vol.VolumeID]
		apiVol := h.convertToAPIVolumeWithContainers(vol, volumeContainers)

		// Enhance with database information if store is available
		if h.store != nil {
			// Get filesystem capacity from previous scans
			if fsInfo, err := h.store.Stats().GetVolumeFilesystemCapacity(ctx, vol.VolumeID); err == nil && fsInfo != nil {
				apiVol.FilesystemCapacity = &models.FilesystemCapacity{
					TotalBytes:     fsInfo.TotalBytes,
					AvailableBytes: fsInfo.AvailableBytes,
					UsedBytes:      fsInfo.UsedBytes,
					UsagePercent:   fsInfo.UsagePercent,
					BlockSize:      fsInfo.BlockSize,
					TotalBlocks:    fsInfo.TotalBlocks,
					FreeBlocks:     fsInfo.FreeBlocks,
				}
			}

			// Get last scan timestamp from pre-fetched metadata map
			if hasOrg {
				if dbVol, ok := volumeMetadataMap[vol.VolumeID]; ok && dbVol.LastScanAt.Valid {
					apiVol.LastScanAt = &dbVol.LastScanAt.Time
				}
			}

			// OPTIMIZATION: Skip expensive N+1 queries for list view
			// These fields (scan status, file counts) are only needed for detail view
			// Fetching them here causes N queries (one per volume), significantly slowing down the list endpoint
			// TODO: These should be fetched only when viewing a specific volume's details

			// Get latest scan status and progress (DISABLED for list view performance)
			// if queries, ok := h.store.Queries().(*sqlc.Queries); ok {
			// 	if latestScans, err := queries.ListScanJobsByVolume(ctx, sqlc.ListScanJobsByVolumeParams{
			// 		VolumeID: pgtype.Text{String: vol.VolumeID, Valid: true},
			// 		Limit:    1,
			// 		Offset:   0,
			// 	}); err == nil && len(latestScans) > 0 {
			// 		latestScan := latestScans[0]
			// 		apiVol.ScanStatus = &latestScan.Status
			// 		apiVol.LastScanID = &latestScan.ScanID
			// 		// Calculate progress from scanned/total files
			// 		if latestScan.TotalFiles.Valid && latestScan.ScannedFiles.Valid && latestScan.TotalFiles.Int64 > 0 {
			// 			progress := int((latestScan.ScannedFiles.Int64 * 100) / latestScan.TotalFiles.Int64)
			// 			apiVol.ScanProgress = &progress
			// 		}
			// 		// Update overall status based on scan status
			// 		apiVol.Status = computeVolumeStatus(&latestScan.Status, apiVol.IsOrphaned, apiVol.AttachmentsCount)
			// 	}

			// 	// Get file and folder counts from indexed files (DISABLED for list view performance)
			// 	fileCount, err := queries.CountFilesByVolume(ctx, vol.VolumeID)
			// 	if err == nil && fileCount > 0 {
			// 		apiVol.FileCount = &fileCount
			// 	}

			// 	folderCount, err := queries.CountFoldersByVolume(ctx, vol.VolumeID)
			// 	if err == nil && folderCount > 0 {
			// 		apiVol.FolderCount = &folderCount
			// 	}
			// }
		}

		// Check for cached scan results from Docker volume usage data (no new scan triggered)
		if vol.UsageData != nil && vol.UsageData.Size >= 0 {
			apiVol.SizeBytes = &vol.UsageData.Size
		} else if h.store != nil {
			// Check database for cached scan results (no new scan triggered)
			if totalSize, err := h.store.Stats().GetLatestVolumeTotalSize(ctx, vol.VolumeID); err == nil && totalSize != nil {
				apiVol.SizeBytes = totalSize
			}
		}

		// Skip real-time scanning to avoid blocking API responses
		// Background scanning will populate size data asynchronously
		// Users can refresh to see updated scan results
		//
		// Note: Commenting out synchronous scanning to prevent 20+ second API timeouts
		// The VolumeViz scanner should run in background via scheduled jobs instead
		/*
			if h.volumeScanner != nil && apiVol.SizeBytes == nil {
				if scanResult, err := h.volumeScanner.ScanVolume(ctx, vol.VolumeID); err == nil {
					apiVol.SizeBytes = &scanResult.TotalSize
					// Add filesystem capacity information if available and not already retrieved from database
					if apiVol.FilesystemCapacity == nil && scanResult.FilesystemCapacity != nil {
						apiVol.FilesystemCapacity = &models.FilesystemCapacity{
							TotalBytes:     scanResult.FilesystemCapacity.TotalBytes,
							AvailableBytes: scanResult.FilesystemCapacity.AvailableBytes,
							UsedBytes:      scanResult.FilesystemCapacity.UsedBytes,
							UsagePercent:   scanResult.FilesystemCapacity.UsagePercent,
							BlockSize:      scanResult.FilesystemCapacity.BlockSize,
							TotalBlocks:    scanResult.FilesystemCapacity.TotalBlocks,
							FreeBlocks:     scanResult.FilesystemCapacity.FreeBlocks,
						}
					}
				}
			}
		*/

		apiVolumes = append(apiVolumes, apiVol)
	}

	// Sort volumes
	h.sortVolumes(apiVolumes, sortParams)

	// Calculate total and summary stats before pagination - these must reflect
	// every volume matching the filters, not just the page being returned.
	total := int64(len(apiVolumes))
	summary := summarizeVolumes(apiVolumes)

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

	return apiVolumes, total, summary, nil
}

// summarizeVolumes computes aggregate stats across a full (unpaginated) set
// of volumes, so dashboard-style stat tiles stay correct once the result
// exceeds a single page.
func summarizeVolumes(volumes []models.VolumeV1) models.VolumeListSummaryV1 {
	summary := models.VolumeListSummaryV1{TotalVolumes: int64(len(volumes))}
	for _, vol := range volumes {
		if vol.IsOrphaned {
			summary.OrphanedVolumes++
		}
		if vol.IsTracked != nil && *vol.IsTracked {
			summary.TrackedVolumes++
		}
		if vol.SizeBytes != nil {
			summary.TotalSizeBytes += *vol.SizeBytes
		}
	}
	return summary
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
			containers, err := h.dockerService.GetVolumeContainers(context.Background(), vol.VolumeID)
			if err != nil {
				// Skip this volume if we can't check containers
				continue
			}
			isOrphaned := len(containers) == 0
			if *filters.Orphaned != isOrphaned {
				continue
			}
		}

		filtered = append(filtered, vol)
	}

	return filtered
}

// convertToAPIVolume converts internal volume model to API format (legacy method)
// This method fetches containers individually - use convertToAPIVolumeWithContainers for better performance
func (h *Handler) convertToAPIVolume(vol coremodels.Volume) models.VolumeV1 {
	// Get container information for attachments_count and container names
	containers, err := h.dockerService.GetVolumeContainers(context.Background(), vol.VolumeID)
	if err != nil {
		containers = []coremodels.VolumeContainer{}
	}

	// Enrich with database tracking data if available
	if h.store != nil {
		// Use default org ID (1) when not in authenticated context
		dbVol, err := h.store.Volumes().GetVolumeByVolumeID(context.Background(), 1, vol.VolumeID)
		if err == nil && dbVol != nil {
			// Populate tracking fields from database
			vol.IsTracked = dbVol.IsTracked
			vol.TrackedAt = dbVol.TrackedAt
			vol.UntrackedAt = dbVol.UntrackedAt
		}
	}

	return h.convertToAPIVolumeWithContainers(vol, containers)
}

// convertToAPIVolumeWithContainers converts a core volume model to API format with pre-fetched containers
func (h *Handler) convertToAPIVolumeWithContainers(vol coremodels.Volume, containers []coremodels.VolumeContainer) models.VolumeV1 {
	attachmentsCount := len(containers)

	// Extract container names
	containerNames := make([]string, len(containers))
	for i, container := range containers {
		containerNames[i] = container.Name
	}

	// Get size if available from volume usage data
	var sizeBytes *int64
	if vol.UsageData != nil && vol.UsageData.Size >= 0 {
		sizeBytes = &vol.UsageData.Size
	}

	// Determine the best mountpoint to display
	// Priority: 1) Configured container path 2) Original mountpoint
	displayMountpoint := vol.Mountpoint
	if h.volumeMapping != nil {
		if configuredPath, exists := h.volumeMapping.GetContainerPath(vol.Name); exists {
			displayMountpoint = configuredPath
		}
	}

	isOrphaned := attachmentsCount == 0

	return models.VolumeV1{
		Name:             vol.Name,
		Driver:           vol.Driver,
		CreatedAt:        vol.CreatedAt,
		Labels:           vol.Labels,
		Scope:            vol.Scope,
		Mountpoint:       displayMountpoint,
		SizeBytes:        sizeBytes,
		LastScanAt:       vol.LastScanned, // Map LastScanned to LastScanAt
		AttachmentsCount: attachmentsCount,
		ContainerNames:   containerNames,
		IsSystem:         h.isSystemVolume(vol),
		IsOrphaned:       isOrphaned,
		Status:           computeVolumeStatus(nil, isOrphaned, attachmentsCount), // Will be updated later with scan status
		IsTracked:        vol.IsTracked,
		TrackedAt:        vol.TrackedAt,
		UntrackedAt:      vol.UntrackedAt,
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

// computeVolumeStatus computes the overall volume status from scan status and orphaned state
func computeVolumeStatus(scanStatus *string, isOrphaned bool, attachmentsCount int) string {
	// Priority order: scanning > error > inactive (orphaned with no containers) > active
	if scanStatus != nil {
		switch *scanStatus {
		case "running", "pending":
			return "scanning"
		case "failed":
			return "error"
		}
	}

	// If orphaned (no containers attached), mark as inactive
	if isOrphaned || attachmentsCount == 0 {
		return "inactive"
	}

	// Default to active
	return "active"
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
		case "type":
			// For volumes, type is always "volume", but we'll support it for consistency
			sortVolumesByType(volumes, param.Direction == "asc")
		case "status":
			sortVolumesByStatus(volumes, param.Direction == "asc")
		case "compose_project":
			sortVolumesByComposeProject(volumes, param.Direction == "asc")
		case "containers":
			sortVolumesByContainers(volumes, param.Direction == "asc")
		case "readonly":
			sortVolumesByReadonly(volumes, param.Direction == "asc")
		case "last_seen":
			sortVolumesByLastSeen(volumes, param.Direction == "asc")
		case "growth_rate":
			sortVolumesByGrowthRate(volumes, param.Direction == "asc")
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

func sortVolumesByType(volumes []models.VolumeV1, asc bool) {
	// For volumes, type is always "volume", so this will result in no sorting
	// but we implement it for consistency with frontend expectations
	sort.Slice(volumes, func(i, j int) bool {
		typeI := "volume"
		typeJ := "volume"
		if asc {
			return typeI < typeJ
		}
		return typeI > typeJ
	})
}

func sortVolumesByStatus(volumes []models.VolumeV1, asc bool) {
	sort.Slice(volumes, func(i, j int) bool {
		statusI := "active" // Default status
		statusJ := "active"

		// Determine status based on orphaned state
		if volumes[i].IsOrphaned {
			statusI = "orphaned"
		}
		if volumes[j].IsOrphaned {
			statusJ = "orphaned"
		}

		if asc {
			return statusI < statusJ
		}
		return statusI > statusJ
	})
}

func sortVolumesByComposeProject(volumes []models.VolumeV1, asc bool) {
	sort.Slice(volumes, func(i, j int) bool {
		projectI := ""
		projectJ := ""

		// Extract compose project from labels
		if volumes[i].Labels != nil {
			if project, ok := volumes[i].Labels["com.docker.compose.project"]; ok {
				projectI = project
			}
		}
		if volumes[j].Labels != nil {
			if project, ok := volumes[j].Labels["com.docker.compose.project"]; ok {
				projectJ = project
			}
		}

		if asc {
			return projectI < projectJ
		}
		return projectI > projectJ
	})
}

func sortVolumesByContainers(volumes []models.VolumeV1, asc bool) {
	sort.Slice(volumes, func(i, j int) bool {
		countI := volumes[i].AttachmentsCount
		countJ := volumes[j].AttachmentsCount

		if asc {
			return countI < countJ
		}
		return countI > countJ
	})
}

func sortVolumesByReadonly(volumes []models.VolumeV1, asc bool) {
	sort.Slice(volumes, func(i, j int) bool {
		// Volumes are typically read-write, but we can check mount options
		// For now, assume all volumes are read-write (false for readonly)
		readonlyI := false
		readonlyJ := false

		if asc {
			return !readonlyI && readonlyJ // false < true in ascending order
		}
		return readonlyI && !readonlyJ // true > false in descending order
	})
}

func sortVolumesByLastSeen(volumes []models.VolumeV1, asc bool) {
	sort.Slice(volumes, func(i, j int) bool {
		timeI := volumes[i].CreatedAt // Fallback to created_at
		timeJ := volumes[j].CreatedAt

		// Use LastScanAt if available
		if volumes[i].LastScanAt != nil {
			timeI = *volumes[i].LastScanAt
		}
		if volumes[j].LastScanAt != nil {
			timeJ = *volumes[j].LastScanAt
		}

		if asc {
			return timeI.Before(timeJ)
		}
		return timeI.After(timeJ)
	})
}

func sortVolumesByGrowthRate(volumes []models.VolumeV1, asc bool) {
	sort.Slice(volumes, func(i, j int) bool {
		// Growth rate is not currently calculated for volumes
		// This would require historical size data
		// For now, sort by size as a proxy
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

// GetVolume returns detailed information about a specific volume
// @Summary Get volume details
// @Description Get detailed information about a specific Docker volume by name
// @Tags volumes
// @Accept json
// @Produce json
// @Param name path string true "Volume name"
// @Success 200 {object} models.VolumeV1 "Volume details"
// @Failure 400 {object} models.ErrorResponse "Bad request"
// @Failure 404 {object} models.ErrorResponse "Volume not found"
// @Failure 500 {object} models.ErrorResponse "Internal server error"
// @Router /api/v1/volumes/{name} [get]
func (h *Handler) GetVolume(c *gin.Context) {
	ctx := c.Request.Context()
	volumeName := c.Param("name")

	if volumeName == "" {
		apiutils.RespondWithBadRequest(c, "Volume name is required", nil)
		return
	}

	// Try database first for better performance (avoids Docker API calls)
	if h.store != nil {
		if volumeDetail, err := h.getVolumeFromDatabase(ctx, volumeName); err == nil && volumeDetail != nil {
			c.JSON(http.StatusOK, volumeDetail)
			return
		}
		// If not found in database or error, fall through to Docker API
	}

	// Fallback: Get volume from Docker as the source of truth for volume metadata
	volume, err := h.dockerService.GetVolume(ctx, volumeName)

	if err != nil {
		if isNotFoundError(err) {
			apiutils.RespondWithNotFound(c, fmt.Sprintf("Volume '%s' not found", volumeName))
			return
		}
		apiutils.RespondWithInternalError(c, "Failed to get volume", err)
		return
	}

	// Check organization access if organization context is available
	if orgID, hasOrg := middleware.GetOrganizationID(ctx); hasOrg && h.store != nil {
		if dbVol, err := h.store.Volumes().GetVolumeByVolumeID(ctx, orgID, volumeName); err == nil {
			if dbVol.OrganizationID == nil || *dbVol.OrganizationID != orgID {
				apiutils.RespondWithNotFound(c, fmt.Sprintf("Volume '%s' not found", volumeName))
				return
			}
		} else {
			// Volume not in database, deny access when organization context is required
			apiutils.RespondWithNotFound(c, fmt.Sprintf("Volume '%s' not found", volumeName))
			return
		}
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
			ContainerID:   container.ContainerID,
			ContainerName: container.Name,
			MountPath:     container.MountPath,
			RW:            container.AccessMode == "rw",
		}
	}

	// Get size if available
	var sizeBytes *int64
	var filesystemCapacity *models.FilesystemCapacity
	var lastScanAt *time.Time
	var scanStatus *string
	var scanProgress *int
	var lastScanID *string
	var isTracked *bool
	var trackedAt *time.Time
	var untrackedAt *time.Time

	// Enhance with database information if store is available
	if h.store != nil {
		// Get filesystem capacity from previous scans
		if fsInfo, err := h.store.Stats().GetVolumeFilesystemCapacity(ctx, volumeName); err == nil && fsInfo != nil {
			filesystemCapacity = &models.FilesystemCapacity{
				TotalBytes:     fsInfo.TotalBytes,
				AvailableBytes: fsInfo.AvailableBytes,
				UsedBytes:      fsInfo.UsedBytes,
				UsagePercent:   fsInfo.UsagePercent,
				BlockSize:      fsInfo.BlockSize,
				TotalBlocks:    fsInfo.TotalBlocks,
				FreeBlocks:     fsInfo.FreeBlocks,
			}
		}

		// Get last scan timestamp and tracking status from database
		orgID, hasOrg := middleware.GetOrganizationID(ctx)
		if !hasOrg {
			orgID = 1 // Default when auth is disabled
		}
		if dbVol, err := h.store.Volumes().GetVolumeByVolumeID(ctx, orgID, volumeName); err == nil {
			if dbVol.LastScanned != nil {
				lastScanAt = dbVol.LastScanned
			}
			// Get tracking status
			isTracked = dbVol.IsTracked
			trackedAt = dbVol.TrackedAt
			untrackedAt = dbVol.UntrackedAt
		}

		// Get latest scan status and progress
		if queries, ok := h.store.Queries().(*sqlc.Queries); ok {
			if latestScans, err := queries.ListScanJobsByVolume(ctx, sqlc.ListScanJobsByVolumeParams{
				VolumeID: pgtype.Text{String: volumeName, Valid: true},
				Limit:    1,
				Offset:   0,
			}); err == nil && len(latestScans) > 0 {
				latestScan := latestScans[0]
				scanStatus = &latestScan.Status
				lastScanID = &latestScan.ScanID
				// Calculate progress from scanned/total files
				if latestScan.TotalFiles.Valid && latestScan.ScannedFiles.Valid && latestScan.TotalFiles.Int64 > 0 {
					progress := int((latestScan.ScannedFiles.Int64 * 100) / latestScan.TotalFiles.Int64)
					scanProgress = &progress
				}
			}
		}
	}

	// Get size from Docker UsageData if available
	if volume.UsageData != nil && volume.UsageData.Size >= 0 {
		sizeBytes = &volume.UsageData.Size
	}
	// If not available, try to get from database (cached from previous scans)
	if sizeBytes == nil && h.store != nil {
		if orgID, hasOrg := middleware.GetOrganizationID(ctx); hasOrg {
			if dbVol, err := h.store.Volumes().GetVolumeByVolumeID(ctx, orgID, volumeName); err == nil && dbVol.UsageData != nil {
				sizeBytes = &dbVol.UsageData.Size
			}
		}
	}
	// Note: We do NOT perform live scanning here as it's too slow for API responses.
	// Users should trigger scans explicitly via the scan endpoint.

	// Determine volume type and mount point display
	volumeType := "local" // Default to local
	mountpoint := volume.Mountpoint

	if typeOpt, hasType := volume.Options["type"]; hasType && typeOpt == "none" {
		if deviceOpt, hasDevice := volume.Options["device"]; hasDevice && deviceOpt != "" {
			// This is a bind mount - use the actual source path
			mountpoint = deviceOpt

			// Check if it's a network mount (CIFS/SMB, NFS, etc.)
			if isNetworkPath(deviceOpt) {
				volumeType = "network"
			} else {
				volumeType = "bind"
			}
		}
	}

	// Build response
	response := models.VolumeDetailV1{
		Name:               volume.Name,
		Driver:             volume.Driver,
		VolumeType:         volumeType,
		CreatedAt:          volume.CreatedAt,
		Labels:             volume.Labels,
		Scope:              volume.Scope,
		Mountpoint:         mountpoint,
		SizeBytes:          sizeBytes,
		LastScanAt:         lastScanAt,
		Attachments:        attachments,
		IsSystem:           h.isSystemVolume(*volume),
		IsOrphaned:         len(attachments) == 0,
		FilesystemCapacity: filesystemCapacity,
		ScanStatus:         scanStatus,
		ScanProgress:       scanProgress,
		LastScanID:         lastScanID,
		IsTracked:          isTracked,
		TrackedAt:          trackedAt,
		UntrackedAt:        untrackedAt,
		Meta: map[string]interface{}{
			"driver_opts": volume.Options,
		},
	}

	c.JSON(http.StatusOK, response)
}

// GetVolumeAttachments returns all containers using a specific volume
// @Summary Get volume attachments
// @Description Get list of containers that have the specified volume mounted
// @Tags volumes
// @Accept json
// @Produce json
// @Param name path string true "Volume name"
// @Success 200 {object} apiutils.PagedResponse "List of container attachments"
// @Failure 400 {object} models.ErrorResponse "Bad request"
// @Failure 404 {object} models.ErrorResponse "Volume not found"
// @Failure 500 {object} models.ErrorResponse "Internal server error"
// @Router /api/v1/volumes/{name}/attachments [get]
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

	// Check organization access if organization context is available
	if orgID, hasOrg := middleware.GetOrganizationID(ctx); hasOrg && h.store != nil {
		if dbVol, err := h.store.Volumes().GetVolumeByVolumeID(ctx, orgID, volumeName); err == nil {
			if dbVol.OrganizationID == nil || *dbVol.OrganizationID != orgID {
				apiutils.RespondWithNotFound(c, fmt.Sprintf("Volume '%s' not found", volumeName))
				return
			}
		} else {
			// Volume not in database, deny access when organization context is required
			apiutils.RespondWithNotFound(c, fmt.Sprintf("Volume '%s' not found", volumeName))
			return
		}
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
			ContainerID:   container.ContainerID,
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
// @Summary Get volume statistics
// @Description Get detailed statistics and usage information for a specific volume
// @Tags volumes
// @Accept json
// @Produce json
// @Param name path string true "Volume name"
// @Success 200 {object} models.VolumeStatsResponse "Volume statistics"
// @Failure 400 {object} models.ErrorResponse "Bad request"
// @Failure 404 {object} models.ErrorResponse "Volume not found"
// @Failure 500 {object} models.ErrorResponse "Internal server error"
// @Router /api/v1/volumes/{name}/stats [get]
func (h *Handler) GetVolumeStats(c *gin.Context) {
	ctx := c.Request.Context()
	volumeID := c.Param("name")

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

	// Check organization access if organization context is available
	if orgID, hasOrg := middleware.GetOrganizationID(ctx); hasOrg && h.store != nil {
		if dbVol, err := h.store.Volumes().GetVolumeByVolumeID(ctx, orgID, volumeID); err == nil {
			if dbVol.OrganizationID == nil || *dbVol.OrganizationID != orgID {
				c.JSON(http.StatusNotFound, models.ErrorResponse{
					Error:   "Volume not found",
					Code:    "VOLUME_NOT_FOUND",
					Details: map[string]any{"volume_id": volumeID},
				})
				return
			}
		} else {
			// Volume not in database, deny access when organization context is required
			c.JSON(http.StatusNotFound, models.ErrorResponse{
				Error:   "Volume not found",
				Code:    "VOLUME_NOT_FOUND",
				Details: map[string]any{"volume_id": volumeID},
			})
			return
		}
	}

	// Get containers using this volume for additional stats
	containers, err := h.dockerService.GetVolumeContainers(ctx, volumeID)
	if err != nil {
		// Don't fail the request if we can't get containers
		containers = []coremodels.VolumeContainer{}
	}

	stats := gin.H{
		"volume_id":       volume.VolumeID,
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
// @Summary Get orphaned volumes
// @Description Get paginated list of volumes that are not attached to any containers
// @Tags volumes
// @Accept json
// @Produce json
// @Param page query int false "Page number for pagination (default: 1)"
// @Param page_size query int false "Number of items per page (default: 25, max: 100)"
// @Param sort query string false "Sort field and direction (e.g., 'name:asc', 'size_bytes:desc'). Available fields: name, size_bytes, created_at"
// @Success 200 {object} apiutils.PagedResponse "Paginated list of orphaned volumes"
// @Failure 400 {object} models.ErrorResponse "Bad request"
// @Failure 500 {object} models.ErrorResponse "Internal server error"
// @Router /api/v1/reports/orphaned [get]
func (h *Handler) GetOrphanedVolumes(c *gin.Context) {
	ctx := c.Request.Context()

	// Parse pagination params
	pagination, err := apiutils.ParsePaginationParams(c)
	if err != nil {
		apiutils.RespondWithBadRequest(c, err.Error(), nil)
		return
	}

	// Parse sort params - default to size_bytes:desc, expanded to support frontend requirements
	allowedSortFields := []string{"name", "driver", "created_at", "size_bytes", "type", "status", "compose_project", "containers", "readonly", "last_seen", "growth_rate"}
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
		containers, err := h.dockerService.GetVolumeContainers(ctx, vol.VolumeID)
		if err != nil {
			// Skip this volume if we can't check containers
			continue
		}
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

// ExportVolumesCSV exports volumes list as CSV
// @Summary Export volumes as CSV
// @Description Export filtered and sorted volumes list in CSV format
// @Tags volumes
// @Accept json
// @Produce text/csv
// @Param page query int false "Page number for pagination (default: 1)"
// @Param page_size query int false "Number of items per page (default: 1000, max: 10000 for exports)"
// @Param sort query string false "Sort field and direction"
// @Param q query string false "Search query to filter volumes by name"
// @Param driver query string false "Filter by volume driver"
// @Param orphaned query bool false "Filter orphaned volumes"
// @Param system query bool false "Include system volumes"
// @Success 200 {file} file "CSV file download"
// @Failure 400 {object} models.ErrorResponse "Bad request"
// @Failure 500 {object} models.ErrorResponse "Internal server error"
// @Router /api/v1/volumes/export/csv [get]
func (h *Handler) ExportVolumesCSV(c *gin.Context) {
	ctx := c.Request.Context()

	// Parse pagination params with higher limits for export
	pagination := &apiutils.PaginationParams{
		Page:     1,
		PageSize: 1000,
		Limit:    1000,
		Offset:   0,
	}
	if page := c.Query("page"); page != "" {
		fmt.Sscanf(page, "%d", &pagination.Page)
	}
	if pageSize := c.Query("page_size"); pageSize != "" {
		fmt.Sscanf(pageSize, "%d", &pagination.PageSize)
		if pagination.PageSize > 10000 {
			pagination.PageSize = 10000
		}
	}
	pagination.Limit = pagination.PageSize
	pagination.Offset = (pagination.Page - 1) * pagination.PageSize

	// Parse sort params
	allowedSortFields := []string{"name", "driver", "created_at", "size_bytes", "type", "status", "compose_project", "containers", "readonly", "last_seen", "growth_rate"}
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

	// Get volumes from Docker API (same as ListVolumes endpoint)
	volumes, _, _, err := h.getVolumesFromDocker(ctx, pagination, sortParams, filters)
	if err != nil {
		apiutils.RespondWithInternalError(c, "Failed to fetch volumes for export", err)
		return
	}

	// Set CSV headers
	timestamp := time.Now().Format("20060102_150405")
	filename := fmt.Sprintf("volumes_export_%s.csv", timestamp)
	c.Header("Content-Type", "text/csv")
	c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=%s", filename))

	// Write CSV header
	c.Writer.Write([]byte("Volume ID,Name,Driver,Mountpoint,Created At,Size (Bytes),Size (Human),Status\n"))

	// Write CSV rows
	for _, vol := range volumes {
		createdAt := vol.CreatedAt.Format(time.RFC3339)

		// Get size from SizeBytes field
		sizeBytes := int64(0)
		if vol.SizeBytes != nil {
			sizeBytes = *vol.SizeBytes
		}
		sizeHuman := formatBytes(sizeBytes)

		// Use Name as Volume ID since API doesn't return ID
		volumeID := vol.Name

		row := fmt.Sprintf("%s,%s,%s,%s,%s,%d,%s,%s\n",
			escapeCSV(volumeID),
			escapeCSV(vol.Name),
			escapeCSV(vol.Driver),
			escapeCSV(vol.Mountpoint),
			createdAt,
			sizeBytes,
			sizeHuman,
			escapeCSV(vol.Status),
		)
		c.Writer.Write([]byte(row))
	}
}

// ExportVolumesJSON exports volumes list as JSON
// @Summary Export volumes as JSON
// @Description Export filtered and sorted volumes list in JSON format
// @Tags volumes
// @Accept json
// @Produce application/json
// @Param page query int false "Page number for pagination (default: 1)"
// @Param page_size query int false "Number of items per page (default: 1000, max: 10000 for exports)"
// @Param sort query string false "Sort field and direction"
// @Param q query string false "Search query to filter volumes by name"
// @Param driver query string false "Filter by volume driver"
// @Param orphaned query bool false "Filter orphaned volumes"
// @Param system query bool false "Include system volumes"
// @Success 200 {object} map[string]interface{} "JSON export"
// @Failure 400 {object} models.ErrorResponse "Bad request"
// @Failure 500 {object} models.ErrorResponse "Internal server error"
// @Router /api/v1/volumes/export/json [get]
func (h *Handler) ExportVolumesJSON(c *gin.Context) {
	ctx := c.Request.Context()

	// Parse pagination params with higher limits for export
	pagination := &apiutils.PaginationParams{
		Page:     1,
		PageSize: 1000,
		Limit:    1000,
		Offset:   0,
	}
	if page := c.Query("page"); page != "" {
		fmt.Sscanf(page, "%d", &pagination.Page)
	}
	if pageSize := c.Query("page_size"); pageSize != "" {
		fmt.Sscanf(pageSize, "%d", &pagination.PageSize)
		if pagination.PageSize > 10000 {
			pagination.PageSize = 10000
		}
	}
	pagination.Limit = pagination.PageSize
	pagination.Offset = (pagination.Page - 1) * pagination.PageSize

	// Parse sort params
	allowedSortFields := []string{"name", "driver", "created_at", "size_bytes", "type", "status", "compose_project", "containers", "readonly", "last_seen", "growth_rate"}
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

	// Get volumes from Docker API (same as ListVolumes endpoint)
	volumes, _, _, err := h.getVolumesFromDocker(ctx, pagination, sortParams, filters)
	if err != nil {
		apiutils.RespondWithInternalError(c, "Failed to fetch volumes for export", err)
		return
	}

	// Convert to export format
	exportData := make([]map[string]interface{}, 0, len(volumes))
	for _, vol := range volumes {
		createdAt := vol.CreatedAt.Format(time.RFC3339)

		// Get size from SizeBytes field
		sizeBytes := int64(0)
		if vol.SizeBytes != nil {
			sizeBytes = *vol.SizeBytes
		}

		var lastScanned *string
		if vol.LastScanAt != nil {
			formatted := vol.LastScanAt.Format(time.RFC3339)
			lastScanned = &formatted
		}

		item := map[string]interface{}{
			"volume_id":    vol.Name, // Use Name as Volume ID since API doesn't return ID
			"name":         vol.Name,
			"driver":       vol.Driver,
			"mountpoint":   vol.Mountpoint,
			"created_at":   createdAt,
			"size_bytes":   sizeBytes,
			"size_human":   formatBytes(sizeBytes),
			"status":       vol.Status,
			"last_scanned": lastScanned,
		}
		exportData = append(exportData, item)
	}

	// Set JSON download headers
	timestamp := time.Now().Format("20060102_150405")
	filename := fmt.Sprintf("volumes_export_%s.json", timestamp)
	c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=%s", filename))

	c.JSON(http.StatusOK, gin.H{
		"exported_at": time.Now().Format(time.RFC3339),
		"total_count": len(exportData),
		"volumes":     exportData,
	})
}

// escapeCSV escapes special characters in CSV fields
func escapeCSV(field string) string {
	// If field contains comma, quote, or newline, wrap in quotes and escape internal quotes
	if strings.ContainsAny(field, ",\"\n\r") {
		field = strings.ReplaceAll(field, "\"", "\"\"")
		return fmt.Sprintf("\"%s\"", field)
	}
	return field
}

// formatBytes formats bytes into human-readable format
func formatBytes(bytes int64) string {
	const unit = 1024
	if bytes < unit {
		return fmt.Sprintf("%d B", bytes)
	}
	div, exp := int64(unit), 0
	for n := bytes / unit; n >= unit; n /= unit {
		div *= unit
		exp++
	}
	return fmt.Sprintf("%.1f %ciB", float64(bytes)/float64(div), "KMGTPE"[exp])
}

// =============================================================================
// Volume Tracking Endpoints
// =============================================================================

// TrackVolume tracks a single volume
// @Summary Track a volume
// @Description Set a volume to tracked status. When tracked, the volume will be scanned and its data indexed.
// @Tags volumes
// @ID postVolumesVolumeIdTrack
// @Accept json
// @Produce json
// @Param name path string true "Volume name"
// @Success 200 {object} models.VolumeV1 "Volume successfully tracked"
// @Failure 400 {object} models.ErrorResponse "Invalid request"
// @Failure 404 {object} models.ErrorResponse "Volume not found"
// @Failure 500 {object} models.ErrorResponse "Internal server error"
// @Router /api/v1/volumes/{name}/track [post]
func (h *Handler) TrackVolume(c *gin.Context) {
	volumeID := c.Param("name")
	if volumeID == "" {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Error:   "Missing volume ID",
			Message: "Volume ID is required",
		})
		return
	}

	// Get organization ID from context, or use default when auth is disabled
	orgID, hasOrg := middleware.GetOrganizationID(c.Request.Context())
	if !hasOrg {
		// When authentication is disabled, use default organization ID
		orgID = 1
	}

	// Track the volume
	volume, err := h.store.Volumes().SetVolumeTracked(c.Request.Context(), orgID, volumeID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{
			Error:   "Failed to track volume",
			Message: err.Error(),
		})
		return
	}

	// Invalidate cache if enabled
	if h.cache != nil {
		h.cache.Invalidate(volumeID)
	}

	// Convert to API model (volume is already in domain model format)
	apiVolume := h.convertToAPIVolume(*volume)

	c.JSON(http.StatusOK, apiVolume)
}

// UntrackVolume untracks a single volume
// @Summary Untrack a volume
// @Description Set a volume to untracked status and remove its data from the database. The Docker volume itself remains intact.
// @Tags volumes
// @ID postVolumesVolumeIdUntrack
// @Accept json
// @Produce json
// @Param name path string true "Volume name"
// @Success 200 {object} models.VolumeV1 "Volume successfully untracked"
// @Failure 400 {object} models.ErrorResponse "Invalid request"
// @Failure 404 {object} models.ErrorResponse "Volume not found"
// @Failure 500 {object} models.ErrorResponse "Internal server error"
// @Router /api/v1/volumes/{name}/untrack [post]
func (h *Handler) UntrackVolume(c *gin.Context) {
	volumeID := c.Param("name")
	if volumeID == "" {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Error:   "Missing volume ID",
			Message: "Volume ID is required",
		})
		return
	}

	// Get organization ID from context, or use default when auth is disabled
	orgID, hasOrg := middleware.GetOrganizationID(c.Request.Context())
	if !hasOrg {
		// When authentication is disabled, use default organization ID
		orgID = 1
	}

	// Untrack the volume
	volume, err := h.store.Volumes().SetVolumeUntracked(c.Request.Context(), orgID, volumeID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{
			Error:   "Failed to untrack volume",
			Message: err.Error(),
		})
		return
	}

	// Invalidate cache if enabled
	if h.cache != nil {
		h.cache.Invalidate(volumeID)
	}

	// Convert to API model (volume is already in domain model format)
	apiVolume := h.convertToAPIVolume(*volume)

	c.JSON(http.StatusOK, apiVolume)
}

// BulkTrackVolumesRequest represents a bulk track request
type BulkTrackVolumesRequest struct {
	VolumeIDs []string `json:"volume_ids" binding:"required"`
}

// BulkTrackVolumesResponse represents a bulk track response
type BulkTrackVolumesResponse struct {
	Succeeded []string `json:"succeeded"`
	Failed    []struct {
		VolumeID string `json:"volume_id"`
		Error    string `json:"error"`
	} `json:"failed,omitempty"`
}

// BulkTrackVolumes tracks multiple volumes at once
// @Summary Bulk track volumes
// @Description Track multiple volumes in a single request
// @Tags volumes
// @ID postVolumesBulkTrack
// @Accept json
// @Produce json
// @Param request body BulkTrackVolumesRequest true "Volume IDs to track"
// @Success 200 {object} BulkTrackVolumesResponse "Bulk track results"
// @Failure 400 {object} models.ErrorResponse "Invalid request"
// @Failure 500 {object} models.ErrorResponse "Internal server error"
// @Router /api/v1/volumes/bulk-track [post]
func (h *Handler) BulkTrackVolumes(c *gin.Context) {
	var req BulkTrackVolumesRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Error:   "Invalid request body",
			Message: err.Error(),
		})
		return
	}

	if len(req.VolumeIDs) == 0 {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Error:   "Empty volume list",
			Message: "At least one volume ID is required",
		})
		return
	}

	// Get organization ID from context, or use default when auth is disabled
	orgID, hasOrg := middleware.GetOrganizationID(c.Request.Context())
	if !hasOrg {
		// When authentication is disabled, use default organization ID
		orgID = 1
	}

	var response BulkTrackVolumesResponse
	response.Succeeded = make([]string, 0)
	response.Failed = make([]struct {
		VolumeID string `json:"volume_id"`
		Error    string `json:"error"`
	}, 0)

	// Track each volume
	for _, volumeID := range req.VolumeIDs {
		_, err := h.store.Volumes().SetVolumeTracked(c.Request.Context(), orgID, volumeID)
		if err != nil {
			response.Failed = append(response.Failed, struct {
				VolumeID string `json:"volume_id"`
				Error    string `json:"error"`
			}{
				VolumeID: volumeID,
				Error:    err.Error(),
			})
		} else {
			response.Succeeded = append(response.Succeeded, volumeID)
			// Invalidate cache if enabled
			if h.cache != nil {
				h.cache.Invalidate(volumeID)
			}
		}
	}

	c.JSON(http.StatusOK, response)
}

// =============================================================================
// Volume Deletion Endpoints
//
// These are the first endpoints in VolumeViz that mutate real Docker state
// (every other write path only flips a flag in VolumeViz's own database).
// Deletion is permanent and cannot be undone, so this section is deliberately
// more defensive than the rest of the handler:
//   - Requires RoleAdmin (stricter than the RoleOperator floor every other
//     mutation gets from middleware.ProtectMutatingOperations).
//   - Re-checks live container attachment immediately before calling Docker,
//     rather than trusting any previously-computed/cached orphan status —
//     orphan status isn't persisted anywhere in this codebase, it's always
//     computed fresh from GetVolumeContainers, so this guard *is* the
//     freshest data available, not a stale-cache workaround.
//   - Always calls Docker with force=false, so the daemon's own "volume is
//     in use" rejection remains a final backstop even if the guard above
//     raced with a container attaching between the check and the call.
//   - Every attempt (success or failure) is written to the audit log.
// =============================================================================

// deleteVolumeError carries the HTTP status a failed deleteOneVolume call
// should map to, so DeleteVolume can respond with the right status/body
// while BulkDeleteVolumes can just record .Error() per failed item.
type deleteVolumeError struct {
	status  int
	message string
}

func (e *deleteVolumeError) Error() string { return e.message }

// deleteOneVolume performs the full guarded delete of a single volume:
// org-ownership check, live in-use check, real Docker removal, VolumeViz DB
// row cleanup, cache invalidation, and audit logging. Shared by both
// DeleteVolume and BulkDeleteVolumes so the safety checks can't drift
// between the single and bulk code paths.
func (h *Handler) deleteOneVolume(ctx context.Context, orgID int64, volumeID string) error {
	logDetails := map[string]interface{}{"volume_id": volumeID}
	writeAudit := func(status string, err error) {
		if h.auditLogger == nil {
			return
		}
		details := make(map[string]interface{}, len(logDetails)+1)
		for k, v := range logDetails {
			details[k] = v
		}
		if err != nil {
			details["error"] = err.Error()
		}
		_ = h.auditLogger.LogEvent(ctx, audit.Event{
			OrganizationID: orgID,
			Action:         "VOLUME_DELETE",
			ResourceType:   "volume",
			ResourceID:     volumeID,
			Status:         status,
			Details:        details,
		})
	}

	// Org-ownership check — same boundary GetVolume/GetVolumeAttachments
	// already enforce, required here since this is a destructive operation.
	if h.store != nil {
		dbVol, err := h.store.Volumes().GetVolumeByVolumeID(ctx, orgID, volumeID)
		if err != nil || dbVol == nil || dbVol.OrganizationID == nil || *dbVol.OrganizationID != orgID {
			notFoundErr := &deleteVolumeError{status: http.StatusNotFound, message: fmt.Sprintf("volume '%s' not found", volumeID)}
			writeAudit("failure", notFoundErr)
			return notFoundErr
		}
	}

	// Live in-use guard: re-derive attachment state fresh, immediately
	// before deleting, rather than trusting any earlier computation.
	containers, err := h.dockerService.GetVolumeContainers(ctx, volumeID)
	if err != nil {
		writeAudit("failure", err)
		return &deleteVolumeError{status: http.StatusInternalServerError, message: fmt.Sprintf("failed to verify volume is unattached: %s", err.Error())}
	}
	if len(containers) > 0 {
		names := make([]string, len(containers))
		for i, c := range containers {
			names[i] = c.Name
		}
		logDetails["attached_containers"] = names
		conflictErr := &deleteVolumeError{status: http.StatusConflict, message: fmt.Sprintf("volume '%s' is still attached to %d container(s)", volumeID, len(containers))}
		writeAudit("failure", conflictErr)
		return conflictErr
	}

	// Real Docker deletion. force=false is intentional and not configurable
	// via this handler — Docker's own in-use protection stays as the final
	// backstop against deleting an attached volume.
	if err := h.dockerService.RemoveVolume(ctx, volumeID, false); err != nil {
		switch {
		case cerrdefs.IsNotFound(err):
			// Already gone — treat as success (idempotent), still clean up
			// VolumeViz's own row below rather than returning early.
		case cerrdefs.IsConflict(err):
			conflictErr := &deleteVolumeError{status: http.StatusConflict, message: fmt.Sprintf("volume '%s' is in use", volumeID)}
			writeAudit("failure", conflictErr)
			return conflictErr
		default:
			writeAudit("failure", err)
			return &deleteVolumeError{status: http.StatusInternalServerError, message: fmt.Sprintf("failed to remove volume: %s", err.Error())}
		}
	}

	// Clean up VolumeViz's own record so the deleted volume doesn't linger
	// in the UI until the next reconciliation pass.
	if h.store != nil {
		if err := h.store.Volumes().HardDeleteVolume(ctx, orgID, volumeID); err != nil {
			// The real Docker volume is already gone at this point — a
			// failure here is a local bookkeeping issue, not a reason to
			// report the whole delete as failed to the caller. Still audit
			// it distinctly so it's visible.
			logDetails["db_cleanup_error"] = err.Error()
		}
	}

	if h.cache != nil {
		h.cache.Invalidate(volumeID)
	}

	writeAudit("success", nil)
	return nil
}

// DeleteVolume permanently deletes a single Docker volume
// @Summary Delete a volume
// @Description Permanently delete a Docker volume. Requires admin role. The volume must not be attached to any container — Docker itself enforces this. This action cannot be undone.
// @Tags volumes
// @ID deleteVolumesVolumeId
// @Accept json
// @Produce json
// @Param name path string true "Volume name"
// @Success 200 {object} map[string]interface{} "Volume successfully deleted"
// @Failure 400 {object} models.ErrorResponse "Invalid request"
// @Failure 404 {object} models.ErrorResponse "Volume not found"
// @Failure 409 {object} models.ErrorResponse "Volume is still attached to a container"
// @Failure 500 {object} models.ErrorResponse "Internal server error"
// @Router /api/v1/volumes/{name} [delete]
func (h *Handler) DeleteVolume(c *gin.Context) {
	volumeID := c.Param("name")
	if volumeID == "" {
		apiutils.RespondWithBadRequest(c, "Volume name is required", nil)
		return
	}

	orgID, hasOrg := middleware.GetOrganizationID(c.Request.Context())
	if !hasOrg {
		orgID = 1
	}

	if err := h.deleteOneVolume(c.Request.Context(), orgID, volumeID); err != nil {
		var delErr *deleteVolumeError
		if errors.As(err, &delErr) {
			switch delErr.status {
			case http.StatusNotFound:
				apiutils.RespondWithNotFound(c, delErr.message)
			case http.StatusConflict:
				apiutils.RespondWithConflict(c, delErr.message, nil)
			default:
				apiutils.RespondWithInternalError(c, delErr.message, nil)
			}
			return
		}
		apiutils.RespondWithInternalError(c, "Failed to delete volume", err)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":   fmt.Sprintf("Volume '%s' deleted", volumeID),
		"volume_id": volumeID,
	})
}

// BulkDeleteVolumesRequest represents a bulk delete request
type BulkDeleteVolumesRequest struct {
	VolumeIDs []string `json:"volume_ids" binding:"required"`
}

// BulkDeleteVolumesResponse represents a bulk delete response
type BulkDeleteVolumesResponse struct {
	Succeeded []string `json:"succeeded"`
	Failed    []struct {
		VolumeID string `json:"volume_id"`
		Error    string `json:"error"`
	} `json:"failed,omitempty"`
}

// BulkDeleteVolumes deletes multiple volumes at once. This is also how
// "prune all orphaned volumes" is implemented: the frontend fetches the
// orphan list once, shows it to the user for confirmation, then submits
// exactly those IDs here — the set of volumes actually deleted is always
// exactly what the caller asked for, never re-derived server-side at
// execution time, so there's no risk of deleting something the user never
// saw named in a confirmation dialog.
// @Summary Bulk delete volumes
// @Description Permanently delete multiple volumes in a single request. Requires admin role. Each volume must be unattached; failures for individual volumes don't stop the rest of the batch. This action cannot be undone.
// @Tags volumes
// @ID postVolumesBulkDelete
// @Accept json
// @Produce json
// @Param request body BulkDeleteVolumesRequest true "Volume IDs to delete"
// @Success 200 {object} BulkDeleteVolumesResponse "Bulk delete results"
// @Failure 400 {object} models.ErrorResponse "Invalid request"
// @Failure 500 {object} models.ErrorResponse "Internal server error"
// @Router /api/v1/volumes/bulk-delete [post]
func (h *Handler) BulkDeleteVolumes(c *gin.Context) {
	var req BulkDeleteVolumesRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		apiutils.RespondWithBadRequest(c, "Invalid request body", map[string]interface{}{"error": err.Error()})
		return
	}
	if len(req.VolumeIDs) == 0 {
		apiutils.RespondWithBadRequest(c, "At least one volume ID is required", nil)
		return
	}

	orgID, hasOrg := middleware.GetOrganizationID(c.Request.Context())
	if !hasOrg {
		orgID = 1
	}

	var response BulkDeleteVolumesResponse
	response.Succeeded = make([]string, 0)
	response.Failed = make([]struct {
		VolumeID string `json:"volume_id"`
		Error    string `json:"error"`
	}, 0)

	for _, volumeID := range req.VolumeIDs {
		if err := h.deleteOneVolume(c.Request.Context(), orgID, volumeID); err != nil {
			response.Failed = append(response.Failed, struct {
				VolumeID string `json:"volume_id"`
				Error    string `json:"error"`
			}{
				VolumeID: volumeID,
				Error:    err.Error(),
			})
		} else {
			response.Succeeded = append(response.Succeeded, volumeID)
		}
	}

	c.JSON(http.StatusOK, response)
}

// BulkUntrackVolumes untracks multiple volumes at once
// @Summary Bulk untrack volumes
// @Description Untrack multiple volumes in a single request
// @Tags volumes
// @ID postVolumesBulkUntrack
// @Accept json
// @Produce json
// @Param request body BulkTrackVolumesRequest true "Volume IDs to untrack"
// @Success 200 {object} BulkTrackVolumesResponse "Bulk untrack results"
// @Failure 400 {object} models.ErrorResponse "Invalid request"
// @Failure 500 {object} models.ErrorResponse "Internal server error"
// @Router /api/v1/volumes/bulk-untrack [post]
func (h *Handler) BulkUntrackVolumes(c *gin.Context) {
	var req BulkTrackVolumesRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Error:   "Invalid request body",
			Message: err.Error(),
		})
		return
	}

	if len(req.VolumeIDs) == 0 {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Error:   "Empty volume list",
			Message: "At least one volume ID is required",
		})
		return
	}

	// Get organization ID from context, or use default when auth is disabled
	orgID, hasOrg := middleware.GetOrganizationID(c.Request.Context())
	if !hasOrg {
		// When authentication is disabled, use default organization ID
		orgID = 1
	}

	var response BulkTrackVolumesResponse
	response.Succeeded = make([]string, 0)
	response.Failed = make([]struct {
		VolumeID string `json:"volume_id"`
		Error    string `json:"error"`
	}, 0)

	// Untrack each volume
	for _, volumeID := range req.VolumeIDs {
		_, err := h.store.Volumes().SetVolumeUntracked(c.Request.Context(), orgID, volumeID)
		if err != nil {
			response.Failed = append(response.Failed, struct {
				VolumeID string `json:"volume_id"`
				Error    string `json:"error"`
			}{
				VolumeID: volumeID,
				Error:    err.Error(),
			})
		} else {
			response.Succeeded = append(response.Succeeded, volumeID)
			// Invalidate cache if enabled
			if h.cache != nil {
				h.cache.Invalidate(volumeID)
			}
		}
	}

	c.JSON(http.StatusOK, response)
}
