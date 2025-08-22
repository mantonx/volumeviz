// Package docker provides Docker mount catalog services
// Discovers, enumerates, and classifies Docker mounts from Engine API
package docker

import (
	"context"
	"crypto/md5"
	"encoding/json"
	"fmt"
	"log"
	"strconv"
	"strings"

	"github.com/docker/docker/api/types"
	"github.com/docker/docker/api/types/volume"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/mantonx/volumeviz/internal/db/sqlc"
	"github.com/mantonx/volumeviz/internal/interfaces"
	"github.com/mantonx/volumeviz/internal/utils"
)

// Mount type constants
const (
	MountTypeVolume = "volume"
	MountTypeBind   = "bind"
	MountTypeTmpfs  = "tmpfs"
)

// Access mode constants
const (
	AccessModeRW = "rw"
	AccessModeRO = "ro"
)

// MountCatalogService handles Docker mount discovery and cataloging
type MountCatalogService struct {
	client  interfaces.DockerClient
	queries *sqlc.Queries
}

// NewMountCatalogService creates a new mount catalog service
func NewMountCatalogService(client interfaces.DockerClient, queries *sqlc.Queries) *MountCatalogService {
	return &MountCatalogService{
		client:  client,
		queries: queries,
	}
}

// DiscoverMounts discovers all Docker mounts and updates the catalog
func (s *MountCatalogService) DiscoverMounts(ctx context.Context) error {
	log.Println("[MOUNT-CATALOG] Starting mount discovery")

	// Get all volumes from Docker API
	volumeResp, err := s.client.ListVolumes(ctx, nil)
	if err != nil {
		return utils.WrapError(err, "failed to list Docker volumes")
	}

	// Get all containers to map mounts to containers
	containers, err := s.client.ListContainers(ctx, nil)
	if err != nil {
		return utils.WrapError(err, "failed to list Docker containers")
	}

	// Track discovered mount IDs to identify orphaned mounts
	discoveredMountIDs := make(map[string]bool)

	// Process volumes
	for _, vol := range volumeResp.Volumes {
		if vol == nil {
			continue
		}
		
		mountID := vol.Name
		discoveredMountIDs[mountID] = true
		
		if err := s.processVolume(ctx, *vol, containers); err != nil {
			log.Printf("[MOUNT-CATALOG] Failed to process volume %s: %v", vol.Name, err)
		}
	}

	// Process containers to find bind mounts and tmpfs
	for _, container := range containers {
		if err := s.processContainerMounts(ctx, container, discoveredMountIDs); err != nil {
			log.Printf("[MOUNT-CATALOG] Failed to process container mounts %s: %v", container.ID, err)
		}
	}

	// Mark volumes not found as orphaned
	if err := s.markOrphanedVolumes(ctx, discoveredMountIDs); err != nil {
		log.Printf("[MOUNT-CATALOG] Failed to mark orphaned volumes: %v", err)
	}

	// Cleanup stale attachments
	if _, err := s.queries.CleanupStaleAttachments(ctx); err != nil {
		log.Printf("[MOUNT-CATALOG] Failed to cleanup stale attachments: %v", err)
	}

	log.Printf("[MOUNT-CATALOG] Mount discovery completed. Discovered %d mounts", len(discoveredMountIDs))
	return nil
}

// processVolume processes a Docker volume and updates catalog
func (s *MountCatalogService) processVolume(ctx context.Context, vol volume.Volume, containers []types.Container) error {
	mountID := vol.Name
	
	// Convert volume labels to JSON bytes
	volumeLabels, err := s.toJSONBytes(vol.Labels)
	if err != nil {
		log.Printf("[MOUNT-CATALOG] Failed to convert volume labels for %s: %v", mountID, err)
		volumeLabels = []byte("{}")
	}

	// Convert volume options to JSON bytes
	volumeOptions, err := s.toJSONBytes(vol.Options)
	if err != nil {
		log.Printf("[MOUNT-CATALOG] Failed to convert volume options for %s: %v", mountID, err)
		volumeOptions = []byte("{}")
	}

	// Find containers using this volume
	containerCount := 0
	var composeProject *string
	var composeServices []string
	var composeVersion *string
	var composeConfigFiles []string

	for _, container := range containers {
		containerInfo, err := s.client.InspectContainer(ctx, container.ID)
		if err != nil {
			continue
		}

		// Check if container uses this volume
		for _, mount := range containerInfo.Mounts {
			if mount.Type == "volume" && mount.Name == vol.Name {
				containerCount++
				
				// Extract Compose metadata from container labels
				if labels := containerInfo.Config.Labels; labels != nil {
					if project := labels["com.docker.compose.project"]; project != "" {
						composeProject = &project
					}
					if service := labels["com.docker.compose.service"]; service != "" {
						composeServices = append(composeServices, service)
					}
					if version := labels["com.docker.compose.version"]; version != "" {
						composeVersion = &version
					}
					if configFile := labels["com.docker.compose.config-hash"]; configFile != "" {
						composeConfigFiles = append(composeConfigFiles, configFile)
					}
				}
				break
			}
		}
	}

	// Remove duplicates from services
	composeServices = s.removeDuplicates(composeServices)
	composeConfigFiles = s.removeDuplicates(composeConfigFiles)

	// Check if mount already exists
	existingMount, err := s.queries.GetMountCatalogEntry(ctx, mountID)
	if err != nil {
		// Mount doesn't exist, create it
		params := sqlc.CreateMountCatalogEntryParams{
			MountID:            mountID,
			MountType:          MountTypeVolume, // Use string constant
			VolumeName:         pgtype.Text{String: vol.Name, Valid: true},
			VolumeDriver:       pgtype.Text{String: vol.Driver, Valid: true},
			VolumeOptions:      volumeOptions,
			VolumeLabels:       volumeLabels,
			VolumeScope:        pgtype.Text{String: vol.Scope, Valid: true},
			SourcePath:         vol.Mountpoint,
			ContainerCount:     int32(containerCount),
			IsOrphaned:         containerCount == 0,
			ComposeProject:     pgtype.Text{String: s.stringPtrValue(composeProject), Valid: composeProject != nil},
			ComposeServices:    composeServices,
			ComposeVersion:     pgtype.Text{String: s.stringPtrValue(composeVersion), Valid: composeVersion != nil},
			ComposeConfigFiles: composeConfigFiles,
			DiscoverySource:    "docker_engine",
			IsTracked:          false,
		}

		_, err = s.queries.CreateMountCatalogEntry(ctx, params)
		if err != nil {
			return utils.WrapErrorf(err, "failed to create mount catalog entry for volume %s", mountID)
		}
	} else {
		// Mount exists, update it
		params := sqlc.UpdateMountCatalogEntryParams{
			MountID:        mountID,
			VolumeDriver:   pgtype.Text{String: vol.Driver, Valid: true},
			VolumeOptions:  volumeOptions,
			VolumeLabels:   volumeLabels,
			VolumeScope:    pgtype.Text{String: vol.Scope, Valid: true},
			ContainerCount: int32(containerCount),
			IsOrphaned:     containerCount == 0,
			ComposeProject: pgtype.Text{String: s.stringPtrValue(composeProject), Valid: composeProject != nil},
			ComposeServices: composeServices,
			ComposeVersion: pgtype.Text{String: s.stringPtrValue(composeVersion), Valid: composeVersion != nil},
			ComposeConfigFiles: composeConfigFiles,
		}

		_, err = s.queries.UpdateMountCatalogEntry(ctx, params)
		if err != nil {
			return utils.WrapErrorf(err, "failed to update mount catalog entry for volume %s", mountID)
		}
	}

	// Process container attachments for this volume
	return s.processVolumeAttachments(ctx, existingMount.ID, vol.Name, containers)
}

// processContainerMounts processes bind mounts and tmpfs from containers
func (s *MountCatalogService) processContainerMounts(ctx context.Context, container types.Container, discoveredMountIDs map[string]bool) error {
	containerInfo, err := s.client.InspectContainer(ctx, container.ID)
	if err != nil {
		return utils.WrapErrorf(err, "failed to inspect container %s", container.ID)
	}

	for _, mount := range containerInfo.Mounts {
		if mount.Type == "bind" || mount.Type == "tmpfs" {
			mountID := s.generateMountID(mount)
			discoveredMountIDs[mountID] = true
			
			if err := s.processNonVolumeMount(ctx, mount, containerInfo); err != nil {
				log.Printf("[MOUNT-CATALOG] Failed to process %s mount %s: %v", mount.Type, mountID, err)
			}
		}
	}

	return nil
}

// processNonVolumeMount processes bind mounts and tmpfs
func (s *MountCatalogService) processNonVolumeMount(ctx context.Context, mount types.MountPoint, containerInfo types.ContainerJSON) error {
	mountID := s.generateMountID(mount)
	
	var mountType string
	switch mount.Type {
	case "bind":
		mountType = MountTypeBind
	case "tmpfs":
		mountType = MountTypeTmpfs
	default:
		return fmt.Errorf("unsupported mount type: %s", mount.Type)
	}

	sourcePath := mount.Source
	if mount.Type == "tmpfs" {
		sourcePath = "tmpfs"
	}

	// Extract Compose metadata
	var composeProject *string
	var composeVersion *string
	if labels := containerInfo.Config.Labels; labels != nil {
		if project := labels["com.docker.compose.project"]; project != "" {
			composeProject = &project
		}
		if version := labels["com.docker.compose.version"]; version != "" {
			composeVersion = &version
		}
	}

	// Check if mount already exists
	_, err := s.queries.GetMountCatalogEntry(ctx, mountID)
	if err != nil {
		// Mount doesn't exist, create it
		params := sqlc.CreateMountCatalogEntryParams{
			MountID:            mountID,
			MountType:          mountType,
			VolumeName:         pgtype.Text{Valid: false}, // Not applicable for bind/tmpfs
			VolumeDriver:       pgtype.Text{Valid: false},
			VolumeOptions:      []byte("{}"),
			VolumeLabels:       []byte("{}"),
			VolumeScope:        pgtype.Text{Valid: false},
			SourcePath:         sourcePath,
			ContainerCount:     1,
			IsOrphaned:         false,
			ComposeProject:     pgtype.Text{String: s.stringPtrValue(composeProject), Valid: composeProject != nil},
			ComposeServices:    []string{},
			ComposeVersion:     pgtype.Text{String: s.stringPtrValue(composeVersion), Valid: composeVersion != nil},
			ComposeConfigFiles: []string{},
			DiscoverySource:    "docker_engine",
			IsTracked:          false,
		}

		_, err = s.queries.CreateMountCatalogEntry(ctx, params)
		if err != nil {
			return utils.WrapErrorf(err, "failed to create mount catalog entry for %s mount %s", mount.Type, mountID)
		}
	}

	return nil
}

// processVolumeAttachments processes container attachments for a volume
func (s *MountCatalogService) processVolumeAttachments(ctx context.Context, mountCatalogID int64, volumeName string, containers []types.Container) error {
	for _, container := range containers {
		containerInfo, err := s.client.InspectContainer(ctx, container.ID)
		if err != nil {
			continue
		}

		// Check if container uses this volume
		for _, mount := range containerInfo.Mounts {
			if mount.Type == "volume" && mount.Name == volumeName {
				if err := s.createOrUpdateAttachment(ctx, mountCatalogID, mount, containerInfo); err != nil {
					log.Printf("[MOUNT-CATALOG] Failed to create/update attachment for container %s: %v", container.ID, err)
				}
				break
			}
		}
	}

	return nil
}

// createOrUpdateAttachment creates or updates a mount attachment
func (s *MountCatalogService) createOrUpdateAttachment(ctx context.Context, mountCatalogID int64, mount types.MountPoint, containerInfo types.ContainerJSON) error {
	containerLabels, err := s.toJSONB(containerInfo.Config.Labels)
	if err != nil {
		containerLabels = []byte("{}")
	}

	accessMode := AccessModeRW
	if !mount.RW {
		accessMode = AccessModeRO
	}

	// Extract Compose metadata
	var composeProject, composeService, composeConfigHash *string
	var composeContainerNumber *int32
	if labels := containerInfo.Config.Labels; labels != nil {
		if project := labels["com.docker.compose.project"]; project != "" {
			composeProject = &project
		}
		if service := labels["com.docker.compose.service"]; service != "" {
			composeService = &service
		}
		if configHash := labels["com.docker.compose.config-hash"]; configHash != "" {
			composeConfigHash = &configHash
		}
		if containerNumberStr := labels["com.docker.compose.container-number"]; containerNumberStr != "" {
			if num := parseInt32(containerNumberStr); num != nil {
				composeContainerNumber = num
			}
		}
	}

	// Check if attachment already exists
	_, err = s.queries.GetMountAttachment(ctx, sqlc.GetMountAttachmentParams{
		MountCatalogID:  mountCatalogID,
		ContainerID:     containerInfo.ID,
		DestinationPath: mount.Destination,
	})

	if err != nil {
		// Create new attachment
		params := sqlc.CreateMountAttachmentParams{
			MountCatalogID:                    mountCatalogID,
			ContainerID:                       containerInfo.ID,
			ContainerName:                     pgtype.Text{String: containerInfo.Name, Valid: true},
			DestinationPath:                   mount.Destination,
			AccessMode:                        accessMode,
			Propagation:                       pgtype.Text{String: string(mount.Propagation), Valid: mount.Propagation != ""},
			ContainerState:                    pgtype.Text{String: containerInfo.State.Status, Valid: true},
			ContainerImage:                    pgtype.Text{String: containerInfo.Config.Image, Valid: true},
			ContainerLabels:                   containerLabels,
			ContainerComposeProject:           pgtype.Text{String: s.stringPtrValue(composeProject), Valid: composeProject != nil},
			ContainerComposeService:           pgtype.Text{String: s.stringPtrValue(composeService), Valid: composeService != nil},
			ContainerComposeContainerNumber:   pgtype.Int4{Int32: s.int32PtrValue(composeContainerNumber), Valid: composeContainerNumber != nil},
			ContainerComposeConfigHash:        pgtype.Text{String: s.stringPtrValue(composeConfigHash), Valid: composeConfigHash != nil},
		}

		_, err = s.queries.CreateMountAttachment(ctx, params)
		if err != nil {
			return utils.WrapErrorf(err, "failed to create mount attachment for container %s", containerInfo.ID)
		}
	} else {
		// Update existing attachment
		params := sqlc.UpdateMountAttachmentParams{
			MountCatalogID:                    mountCatalogID,
			ContainerID:                       containerInfo.ID,
			DestinationPath:                   mount.Destination,
			ContainerName:                     pgtype.Text{String: containerInfo.Name, Valid: true},
			AccessMode:                        accessMode,
			Propagation:                       pgtype.Text{String: string(mount.Propagation), Valid: mount.Propagation != ""},
			ContainerState:                    pgtype.Text{String: containerInfo.State.Status, Valid: true},
			ContainerImage:                    pgtype.Text{String: containerInfo.Config.Image, Valid: true},
			ContainerLabels:                   containerLabels,
			ContainerComposeProject:           pgtype.Text{String: s.stringPtrValue(composeProject), Valid: composeProject != nil},
			ContainerComposeService:           pgtype.Text{String: s.stringPtrValue(composeService), Valid: composeService != nil},
			ContainerComposeContainerNumber:   pgtype.Int4{Int32: s.int32PtrValue(composeContainerNumber), Valid: composeContainerNumber != nil},
			ContainerComposeConfigHash:        pgtype.Text{String: s.stringPtrValue(composeConfigHash), Valid: composeConfigHash != nil},
		}

		_, err = s.queries.UpdateMountAttachment(ctx, params)
		if err != nil {
			return utils.WrapErrorf(err, "failed to update mount attachment for container %s", containerInfo.ID)
		}
	}

	return nil
}

// markOrphanedVolumes marks volumes not found in discovery as orphaned
func (s *MountCatalogService) markOrphanedVolumes(ctx context.Context, discoveredMountIDs map[string]bool) error {
	// Get all existing mounts
	existingMounts, err := s.queries.ListMountCatalogEntries(ctx, sqlc.ListMountCatalogEntriesParams{
		Column1: "mount_type",
		Limit:   1000,
		Offset:  0,
	})
	if err != nil {
		return utils.WrapError(err, "failed to list existing mounts")
	}

	for _, mount := range existingMounts {
		if !discoveredMountIDs[mount.MountID] {
			// Mark as orphaned
			params := sqlc.UpdateMountCatalogEntryParams{
				MountID:    mount.MountID,
				IsOrphaned: true,
			}

			_, err = s.queries.UpdateMountCatalogEntry(ctx, params)
			if err != nil {
				log.Printf("[MOUNT-CATALOG] Failed to mark mount %s as orphaned: %v", mount.MountID, err)
			}
		}
	}

	return nil
}

// Helper functions

func (s *MountCatalogService) generateMountID(mount types.MountPoint) string {
	// For bind mounts and tmpfs, create a hash of source + destination + type
	h := md5.New()
	h.Write([]byte(fmt.Sprintf("%s:%s:%s", mount.Type, mount.Source, mount.Destination)))
	return fmt.Sprintf("%x", h.Sum(nil))
}

func (s *MountCatalogService) toJSONB(data interface{}) ([]byte, error) {
	if data == nil {
		return []byte("{}"), nil
	}

	bytes, err := json.Marshal(data)
	if err != nil {
		return []byte("{}"), err
	}

	return bytes, nil
}

func (s *MountCatalogService) toJSONBytes(data interface{}) ([]byte, error) {
	if data == nil {
		return []byte("{}"), nil
	}

	bytes, err := json.Marshal(data)
	if err != nil {
		return []byte("{}"), err
	}

	return bytes, nil
}

func (s *MountCatalogService) removeDuplicates(slice []string) []string {
	keys := make(map[string]bool)
	result := []string{}

	for _, item := range slice {
		if !keys[item] {
			keys[item] = true
			result = append(result, item)
		}
	}

	return result
}

func (s *MountCatalogService) stringPtrValue(ptr *string) string {
	if ptr == nil {
		return ""
	}
	return *ptr
}

func (s *MountCatalogService) int32PtrValue(ptr *int32) int32 {
	if ptr == nil {
		return 0
	}
	return *ptr
}

func parseInt32(s string) *int32 {
	if s == "" {
		return nil
	}
	
	var result int32
	parsed, err := strconv.ParseInt(s, 10, 32)
	if err != nil {
		return nil
	}
	result = int32(parsed)
	
	return &result
}

// GetMountDetails returns detailed information for a specific mount
func (s *MountCatalogService) GetMountDetails(ctx context.Context, mountID string) (*sqlc.DockerMountCatalog, error) {
	mount, err := s.queries.GetMountCatalogEntry(ctx, mountID)
	if err != nil {
		return nil, err
	}
	return &mount, nil
}

// GetMountCatalogSummary returns a summary of the mount catalog
func (s *MountCatalogService) GetMountCatalogSummary(ctx context.Context) (*sqlc.GetMountCatalogSummaryRow, error) {
	summary, err := s.queries.GetMountCatalogSummary(ctx)
	if err != nil {
		return nil, err
	}
	return &summary, nil
}

// ListMountCatalogEntries returns paginated mount catalog entries
func (s *MountCatalogService) ListMountCatalogEntries(ctx context.Context, sortBy string, limit, offset int32) ([]sqlc.DockerMountCatalog, error) {
	params := sqlc.ListMountCatalogEntriesParams{
		Column1: sortBy,
		Limit:   limit,
		Offset:  offset,
	}
	return s.queries.ListMountCatalogEntries(ctx, params)
}

// SearchMountCatalog searches mount catalog with filters
func (s *MountCatalogService) SearchMountCatalog(ctx context.Context, filters SearchFilters) ([]sqlc.DockerMountCatalog, error) {
	var mountType interface{}
	if filters.MountType != "" {
		switch strings.ToLower(filters.MountType) {
		case "volume":
			mountType = MountTypeVolume
		case "bind":
			mountType = MountTypeBind
		case "tmpfs":
			mountType = MountTypeTmpfs
		}
	}

	// Handle status filter (orphaned or active)
	if filters.Status != "" {
		switch strings.ToLower(filters.Status) {
		case "orphaned":
			filters.IsOrphaned = true
			filters.IsOrphanedSet = true
		case "active":
			filters.IsOrphaned = false
			filters.IsOrphanedSet = true
		}
	}

	// If Query is provided, it searches across multiple fields
	// We'll use it as a filter for mount_id or volume_name
	searchTerm := filters.Query
	if searchTerm == "" {
		searchTerm = filters.MountID
	}

	params := sqlc.SearchMountCatalogParams{
		Column1: searchTerm,
		Column2: filters.VolumeName,
		Column3: filters.ComposeProject,
		Column4: mountType,
		Column5: filters.IsOrphaned,
		Column6: filters.IsTracked,
		Limit:   filters.Limit,
		Offset:  filters.Offset,
	}

	// TODO: Add support for ComposeService filter when SQL query is updated
	// For now, we'll filter compose_service in memory if needed
	results, err := s.queries.SearchMountCatalog(ctx, params)
	if err != nil {
		return nil, err
	}

	// If ComposeService filter is provided, filter results
	if filters.ComposeService != "" {
		var filtered []sqlc.DockerMountCatalog
		for _, mount := range results {
			for _, service := range mount.ComposeServices {
				if strings.Contains(strings.ToLower(service), strings.ToLower(filters.ComposeService)) {
					filtered = append(filtered, mount)
					break
				}
			}
		}
		return filtered, nil
	}

	return results, nil
}

// SearchFilters defines search criteria for mount catalog
type SearchFilters struct {
	Query          string
	MountID        string
	VolumeName     string
	ComposeProject string
	ComposeService string
	MountType      string
	Status         string
	IsOrphaned     bool
	IsOrphanedSet  bool
	IsTracked      bool
	IsTrackedSet   bool
	Limit          int32
	Offset         int32
}