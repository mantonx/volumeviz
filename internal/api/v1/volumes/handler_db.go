// Package volumes provides HTTP handlers for Docker volume operations
// This file contains the database-first approach for listing volumes
package volumes

import (
	"context"
	"encoding/json"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgtype"
	"github.com/mantonx/volumeviz/internal/api/middleware"
	"github.com/mantonx/volumeviz/internal/api/models"
	apiutils "github.com/mantonx/volumeviz/internal/api/utils"
	"github.com/mantonx/volumeviz/internal/db/sqlc"
	coremodels "github.com/mantonx/volumeviz/internal/models"
	"github.com/mantonx/volumeviz/internal/utils"
)

// getVolumesFromDatabase retrieves volumes from the database (<100ms)
// This is the database-first approach that replaces Docker API calls
// Phase 3: Now with cache-aside pattern for even better performance
func (h *Handler) getVolumesFromDatabase(ctx context.Context, pagination *apiutils.PaginationParams, sortParams []apiutils.SortParam, filters *apiutils.VolumeFilters) ([]models.VolumeV1, int64, error) {
	// Get organization ID from context
	orgID, hasOrg := middleware.GetOrganizationID(ctx)
	if !hasOrg {
		// Fallback to default organization if not in multi-tenant context
		orgID = 1
	}

	queries, ok := h.store.Queries().(*sqlc.Queries)
	if !ok {
		// Fallback to Docker API if database not available
		return h.getVolumesFromDocker(ctx, pagination, sortParams, filters)
	}

	// Fetch ALL volumes from database for the organization
	// We filter and paginate in memory because the system volume filter
	// cannot be efficiently expressed in SQL (requires regex + hex checking)
	// This is acceptable because:
	// 1. Volume lists are typically small (hundreds, not millions)
	// 2. We have caching for frequently accessed volumes
	// 3. Filtering in-memory is very fast
	dbVolumes, err := queries.ListVolumes(ctx, sqlc.ListVolumesParams{
		OrganizationID: pgtype.Int8{Int64: orgID, Valid: true},
		Limit:          10000, // Fetch all volumes (reasonable upper limit)
		Offset:         0,
	})
	if err != nil {
		// Fallback to Docker API on database error
		return h.getVolumesFromDocker(ctx, pagination, sortParams, filters)
	}

	// Phase 3: Try cache-aside pattern if cache is enabled
	var cachedVolumes map[string]models.VolumeV1
	var volumesToFetch []string

	if h.cache != nil {
		// Collect volume IDs to check in cache
		volumeIDs := make([]string, 0, len(dbVolumes))
		for _, dbVol := range dbVolumes {
			volumeIDs = append(volumeIDs, dbVol.VolumeID)
		}

		// Try to get volumes from cache
		cachedVolumes, volumesToFetch = h.cache.GetMultiple(volumeIDs)
	} else {
		// No cache, fetch all volumes
		volumesToFetch = make([]string, 0, len(dbVolumes))
		for _, dbVol := range dbVolumes {
			volumesToFetch = append(volumesToFetch, dbVol.VolumeID)
		}
	}

	// Convert DB volumes to API format (only for cache misses or when cache is disabled)
	apiVolumes := make([]models.VolumeV1, 0, len(dbVolumes))
	freshVolumes := make([]models.VolumeV1, 0, len(volumesToFetch))

	for _, dbVol := range dbVolumes {
		// Apply filters first
		if !h.volumePassesDBFilters(dbVol, filters) {
			continue
		}

		// Check if we have this volume in cache
		if cachedVol, found := cachedVolumes[dbVol.VolumeID]; found {
			// Use cached version
			apiVolumes = append(apiVolumes, cachedVol)
			continue
		}

		// Cache miss - convert from DB
		apiVol := h.convertDBVolumeToAPI(dbVol)

		// Enhance with additional data if needed
		if h.store != nil {
			// Get filesystem capacity from scan results
			if fsInfo, err := h.store.Stats().GetVolumeFilesystemCapacity(ctx, dbVol.VolumeID); err == nil && fsInfo != nil {
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
		}

		apiVolumes = append(apiVolumes, apiVol)
		freshVolumes = append(freshVolumes, apiVol)
	}

	// Update cache with freshly fetched volumes (Phase 3)
	if h.cache != nil && len(freshVolumes) > 0 {
		h.cache.SetMultiple(freshVolumes)
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

// convertDBVolumeToAPI converts a database volume to API format
func (h *Handler) convertDBVolumeToAPI(dbVol sqlc.Volumes) models.VolumeV1 {
	// Extract driver from new driver column (fallback to filesystem type)
	driver := "local"
	if dbVol.Driver.Valid && dbVol.Driver.String != "" {
		driver = dbVol.Driver.String
	} else if dbVol.FilesystemType.Valid {
		driver = dbVol.FilesystemType.String
	}

	// Extract scope
	scope := "local"
	if dbVol.Scope.Valid && dbVol.Scope.String != "" {
		scope = dbVol.Scope.String
	}

	// Parse labels from JSONB
	labels := make(map[string]string)
	if len(dbVol.Labels) > 0 && string(dbVol.Labels) != "{}" {
		_ = json.Unmarshal(dbVol.Labels, &labels)
	}

	// Parse options from JSONB
	options := make(map[string]string)
	if len(dbVol.Options) > 0 && string(dbVol.Options) != "{}" {
		_ = json.Unmarshal(dbVol.Options, &options)
	}

	// Determine volume type and mount point display
	volumeType := "local" // Default to local
	mountpoint := dbVol.MountPoint

	if options["type"] == "none" && options["device"] != "" {
		// This is a bind mount - determine if it's network or local based on device path
		devicePath := options["device"]
		mountpoint = devicePath // Show the actual source path

		// Check if it's a network mount (CIFS/SMB, NFS, etc.)
		if isNetworkPath(devicePath) {
			volumeType = "network"
		} else {
			volumeType = "bind"
		}
	}

	// Extract size
	var sizeBytes *int64
	if dbVol.TotalSizeBytes.Valid && dbVol.TotalSizeBytes.Int64 > 0 {
		sizeBytes = &dbVol.TotalSizeBytes.Int64
	}

	// Extract last scan time
	var lastScanAt *time.Time
	if dbVol.LastScanAt.Valid {
		lastScanAt = &dbVol.LastScanAt.Time
	}

	// Determine orphaned status
	containerCount := 0
	if dbVol.ContainerCount.Valid {
		containerCount = int(dbVol.ContainerCount.Int32)
	}
	isOrphaned := containerCount == 0

	// Determine system volume status
	isSystem := h.isSystemVolumeByName(dbVol.VolumeID)

	// Calculate status
	status := computeVolumeStatus(nil, isOrphaned, containerCount)

	return models.VolumeV1{
		Name:             dbVol.VolumeID,
		Driver:           driver,
		VolumeType:       volumeType,  // "local", "bind", or "network"
		CreatedAt:        dbVol.CreatedAt,
		Labels:           labels,
		Scope:            scope,
		Mountpoint:       mountpoint, // Shows actual device path for bind mounts
		Options:          options,     // Include options for frontend inspection
		SizeBytes:        sizeBytes,
		LastScanAt:       lastScanAt,
		AttachmentsCount: containerCount,
		ContainerNames:   dbVol.ContainerNames,
		IsSystem:         isSystem,
		IsOrphaned:       isOrphaned,
		Status:           status,
	}
}

// isNetworkPath checks if a path is a network mount (CIFS/SMB, NFS, etc.)
func isNetworkPath(path string) bool {
	// Check for common network mount patterns
	// CIFS/SMB mounts often start with /cifs/, //server/, or \\server\
	// NFS mounts often start with /nfs/ or server:/path
	if strings.HasPrefix(path, "/cifs/") {
		return true
	}
	if strings.HasPrefix(path, "/smb/") {
		return true
	}
	if strings.HasPrefix(path, "/nfs/") {
		return true
	}
	if strings.HasPrefix(path, "//") {
		return true
	}
	if strings.HasPrefix(path, "\\\\") {
		return true
	}
	// NFS-style: server:/path
	if strings.Contains(path, ":") && !strings.HasPrefix(path, "/") {
		return true
	}
	return false
}

// volumePassesDBFilters checks if a database volume passes the given filters
func (h *Handler) volumePassesDBFilters(dbVol sqlc.Volumes, filters *apiutils.VolumeFilters) bool {
	// Skip inactive volumes
	if dbVol.IsActive.Valid && !dbVol.IsActive.Bool {
		return false
	}

	// Apply system filter
	if !filters.System && h.isSystemVolumeByName(dbVol.VolumeID) {
		return false
	}

	// Apply driver filter
	if filters.Driver != "" && dbVol.FilesystemType.Valid && dbVol.FilesystemType.String != filters.Driver {
		return false
	}

	// Apply search query
	if filters.Query != "" {
		query := filters.Query
		// Check if volume name or display name contains query
		if !utils.ContainsIgnoreCase(dbVol.VolumeID, query) {
			if !dbVol.DisplayName.Valid || !utils.ContainsIgnoreCase(dbVol.DisplayName.String, query) {
				return false
			}
		}
	}

	// Apply date filters
	if filters.CreatedAfter != nil && dbVol.CreatedAt.Before(*filters.CreatedAfter) {
		return false
	}
	if filters.CreatedBefore != nil && dbVol.CreatedAt.After(*filters.CreatedBefore) {
		return false
	}

	// Apply orphaned filter
	if filters.Orphaned != nil {
		containerCount := 0
		if dbVol.ContainerCount.Valid {
			containerCount = int(dbVol.ContainerCount.Int32)
		}
		isOrphaned := containerCount == 0
		if *filters.Orphaned != isOrphaned {
			return false
		}
	}

	return true
}

// isSystemVolumeByName checks if a volume is a system volume based on its name
func (h *Handler) isSystemVolumeByName(volumeName string) bool {
	// Check against system volume regex
	if h.systemVolumeRegex != nil && h.systemVolumeRegex.MatchString(volumeName) {
		return true
	}

	// Check for anonymous volumes (64-char hex names)
	if isAnonymousVolume(volumeName) {
		return true
	}

	return false
}

// isSystemVolumeByCoreModel is a helper that wraps the existing method
func (h *Handler) isSystemVolumeByCoreModel(vol coremodels.Volume) bool {
	return h.isSystemVolume(vol)
}

// getVolumeFromDatabase retrieves a single volume from database with all details
func (h *Handler) getVolumeFromDatabase(ctx context.Context, volumeName string) (*models.VolumeDetailV1, error) {
	// Get organization ID from context
	orgID, hasOrg := middleware.GetOrganizationID(ctx)
	if !hasOrg {
		orgID = 1 // Default organization
	}

	queries, ok := h.store.Queries().(*sqlc.Queries)
	if !ok {
		return nil, nil // Signal to use Docker API fallback
	}

	// Get volume from database
	dbVol, err := queries.GetVolumeByVolumeID(ctx, sqlc.GetVolumeByVolumeIDParams{
		VolumeID:       volumeName,
		OrganizationID: pgtype.Int8{Int64: orgID, Valid: true},
	})
	if err != nil {
		return nil, err
	}

	// Parse labels from JSONB
	labels := make(map[string]string)
	if len(dbVol.Labels) > 0 && string(dbVol.Labels) != "{}" {
		_ = json.Unmarshal(dbVol.Labels, &labels)
	}

	// Parse options from JSONB
	options := make(map[string]string)
	if len(dbVol.Options) > 0 && string(dbVol.Options) != "{}" {
		_ = json.Unmarshal(dbVol.Options, &options)
	}

	// Determine volume type and mount point display
	volumeType := "local"
	mountpoint := dbVol.MountPoint

	if typeOpt, hasType := options["type"]; hasType && typeOpt == "none" {
		if deviceOpt, hasDevice := options["device"]; hasDevice && deviceOpt != "" {
			mountpoint = deviceOpt
			if isNetworkPath(deviceOpt) {
				volumeType = "network"
			} else {
				volumeType = "bind"
			}
		}
	}

	// Get container attachments from Docker (fallback since we don't have a direct query)
	attachments := []models.AttachmentV1{}
	if containers, err := h.dockerService.GetVolumeContainers(ctx, volumeName); err == nil {
		for _, container := range containers {
			attachments = append(attachments, models.AttachmentV1{
				ContainerID:   container.ContainerID,
				ContainerName: container.Name,
				MountPath:     container.MountPath,
				RW:            container.AccessMode == "rw",
			})
		}
	}

	// Get filesystem capacity
	var filesystemCapacity *models.FilesystemCapacity
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

	// Get latest scan status
	var scanStatus *string
	var scanProgress *int
	var lastScanID *string
	if latestScans, err := queries.ListScanJobsByVolume(ctx, sqlc.ListScanJobsByVolumeParams{
		VolumeID: pgtype.Text{String: volumeName, Valid: true},
		Limit:    1,
		Offset:   0,
	}); err == nil && len(latestScans) > 0 {
		latestScan := latestScans[0]
		scanStatus = &latestScan.Status
		lastScanID = &latestScan.ScanID
		if latestScan.TotalFiles.Valid && latestScan.ScannedFiles.Valid && latestScan.TotalFiles.Int64 > 0 {
			progress := int((latestScan.ScannedFiles.Int64 * 100) / latestScan.TotalFiles.Int64)
			scanProgress = &progress
		}
	}

	// Convert size to pointer
	var sizeBytes *int64
	if dbVol.TotalSizeBytes.Valid {
		sizeBytes = &dbVol.TotalSizeBytes.Int64
	}

	// Convert LastScanAt to pointer
	var lastScanAt *time.Time
	if dbVol.LastScanAt.Valid {
		lastScanAt = &dbVol.LastScanAt.Time
	}

	return &models.VolumeDetailV1{
		Name:               dbVol.VolumeID,
		Driver:             dbVol.Driver.String,
		VolumeType:         volumeType,
		CreatedAt:          dbVol.CreatedAt,
		Labels:             labels,
		Scope:              dbVol.Scope.String,
		Mountpoint:         mountpoint,
		SizeBytes:          sizeBytes,
		LastScanAt:         lastScanAt,
		Attachments:        attachments,
		IsSystem:           h.isSystemVolumeByName(volumeName),
		IsOrphaned:         len(attachments) == 0,
		FilesystemCapacity: filesystemCapacity,
		ScanStatus:         scanStatus,
		ScanProgress:       scanProgress,
		LastScanID:         lastScanID,
		Meta: map[string]interface{}{
			"driver_opts": options,
		},
	}, nil
}
