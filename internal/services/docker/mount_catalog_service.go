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

	"github.com/docker/docker/api/types"
	"github.com/docker/docker/api/types/volume"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/mantonx/volumeviz/internal/db/sqlc"
	"github.com/mantonx/volumeviz/internal/interfaces"
	"github.com/mantonx/volumeviz/internal/store"
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
	store   store.Store
}

// NewMountCatalogService creates a new mount catalog service
func NewMountCatalogService(client interfaces.DockerClient, queries *sqlc.Queries, store store.Store) *MountCatalogService {
	return &MountCatalogService{
		client:  client,
		queries: queries,
		store:   store,
	}
}

// DiscoverMounts discovers all Docker mounts and updates the catalog (system-level operation)
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

	// Note: Stale mount cleanup would be implemented with custom logic
	// using the available mount catalog and attachment queries

	log.Printf("[MOUNT-CATALOG] Mount discovery completed. Discovered %d mounts", len(discoveredMountIDs))
	return nil
}

// processVolume processes a Docker volume and updates catalog
func (s *MountCatalogService) processVolume(ctx context.Context, vol volume.Volume, containers []types.Container) error {
	_ = vol.Name // mountID no longer used in simplified version

	// Volume labels and options are no longer stored in the consolidated schema

	// Find containers using this volume
	containerCount := 0

	for _, container := range containers {
		containerInfo, err := s.client.InspectContainer(ctx, container.ID)
		if err != nil {
			continue
		}

		// Check if container uses this volume
		for _, mount := range containerInfo.Mounts {
			if mount.Type == "volume" && mount.Name == vol.Name {
				containerCount++
				break
			}
		}
	}

	// Continue with mount catalog entry creation

	// Get existing mount catalog entries for this volume
	existingMount, err := s.queries.GetDockerMountByMountId(ctx, vol.Name)
	if err != nil {
		log.Printf("[MOUNT-CATALOG] No existing mount found for volume %s: %v", vol.Name, err)
	}

	// Create or update mount catalog entry for this volume
	if err != nil {
		// Create new mount catalog entry
		volumeLabelsJSON, _ := json.Marshal(vol.Labels)
		volumeOptionsJSON, _ := json.Marshal(vol.Options)
		
		params := sqlc.CreateDockerMountParams{
			MountID:         vol.Name,
			MountType:       "volume",
			VolumeName:      pgtype.Text{String: vol.Name, Valid: true},
			VolumeDriver:    pgtype.Text{String: vol.Driver, Valid: vol.Driver != ""},
			VolumeOptions:   volumeOptionsJSON,
			VolumeLabels:    volumeLabelsJSON,
			VolumeScope:     pgtype.Text{String: vol.Scope, Valid: vol.Scope != ""},
			SourcePath:      vol.Name,
			ContainerCount:  int32(containerCount),
			IsOrphaned:      containerCount == 0,
			DiscoverySource: "docker_engine",
			IsTracked:       containerCount > 0,
		}

		_, err = s.queries.CreateDockerMount(ctx, params)
		if err != nil {
			return utils.WrapErrorf(err, "failed to create docker mount entry for volume %s", vol.Name)
		}
		log.Printf("[MOUNT-CATALOG] Created docker mount entry for volume %s", vol.Name)
	} else {
		// Volume exists, update container count and orphan status
		err = s.queries.UpdateMountContainerCount(ctx, sqlc.UpdateMountContainerCountParams{
			ID:             existingMount.ID,
			ContainerCount: int32(containerCount),
		})
		if err != nil {
			log.Printf("[MOUNT-CATALOG] Failed to update container count for volume %s: %v", vol.Name, err)
		}
	}

	// Process container attachments for this volume - simplified for now
	// TODO: Properly implement volume attachment processing
	return nil
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

// processNonVolumeMount processes bind mounts and tmpfs (simplified)
func (s *MountCatalogService) processNonVolumeMount(ctx context.Context, mount types.MountPoint, containerInfo types.ContainerJSON) error {
	// Temporarily simplified - mount catalog processing for bind/tmpfs mounts
	// TODO: Implement proper bind/tmpfs mount catalog handling with new schema
	log.Printf("[MOUNT-CATALOG] Processing %s mount: %s -> %s (simplified)", mount.Type, mount.Source, mount.Destination)

	return nil
}

// processVolumeAttachments processes container attachments for a volume (simplified)
func (s *MountCatalogService) processVolumeAttachments(ctx context.Context, mountCatalogID int64, volumeName string, containers []types.Container) error {
	// Temporarily simplified - volume attachment processing disabled
	// TODO: Implement proper volume attachment handling with new schema
	log.Printf("[MOUNT-CATALOG] Processing attachments for volume %s (simplified)", volumeName)
	return nil
}

// createOrUpdateAttachment creates or updates a mount attachment (simplified)
func (s *MountCatalogService) createOrUpdateAttachment(ctx context.Context, mountCatalogID int64, mount types.MountPoint, containerInfo types.ContainerJSON) error {
	// Temporarily simplified - attachment creation/update disabled
	// TODO: Implement proper attachment handling with new schema
	log.Printf("[MOUNT-CATALOG] Processing attachment for container %s (simplified)", containerInfo.ID)
	return nil
}

// markOrphanedVolumes marks volumes not found in discovery as orphaned (simplified)
func (s *MountCatalogService) markOrphanedVolumes(ctx context.Context, discoveredMountIDs map[string]bool) error {
	// Temporarily simplified - orphaned volume marking disabled  
	// TODO: Implement proper orphaned volume detection with new schema
	log.Printf("[MOUNT-CATALOG] Marking orphaned volumes (simplified) - found %d discovered volumes", len(discoveredMountIDs))
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
func (s *MountCatalogService) GetMountDetails(ctx context.Context, mountID int64) (*sqlc.DockerMountCatalog, error) {
	mount, err := s.queries.GetDockerMount(ctx, mountID)
	if err != nil {
		return nil, err
	}
	return &mount, nil
}

// MountCatalogSummary represents a summary of mount catalog data
type MountCatalogSummary struct {
	TotalMounts     int64
	VolumeMounts    int64
	BindMounts      int64
	TmpfsMounts     int64
	OrphanedMounts  int64
	TrackedMounts   int64
	ComposeProjects int64
}

// GetMountCatalogSummary returns a summary of the mount catalog
func (s *MountCatalogService) GetMountCatalogSummary(ctx context.Context) (*MountCatalogSummary, error) {
	// Get mount counts by type
	volumeCount, err := s.queries.CountMountsByType(ctx, "volume")
	if err != nil {
		return nil, err
	}
	
	bindCount, err := s.queries.CountMountsByType(ctx, "bind")
	if err != nil {
		return nil, err
	}
	
	tmpfsCount, err := s.queries.CountMountsByType(ctx, "tmpfs")
	if err != nil {
		return nil, err
	}

	// Get orphaned and tracked mounts
	orphanedMounts, err := s.queries.ListOrphanedMounts(ctx)
	if err != nil {
		return nil, err
	}

	trackedMounts, err := s.queries.ListTrackedMounts(ctx)
	if err != nil {
		return nil, err
	}

	// Aggregate the data
	summary := &MountCatalogSummary{
		TotalMounts:     volumeCount + bindCount + tmpfsCount,
		VolumeMounts:    volumeCount,
		BindMounts:      bindCount,
		TmpfsMounts:     tmpfsCount,
		OrphanedMounts:  int64(len(orphanedMounts)),
		TrackedMounts:   int64(len(trackedMounts)),
		ComposeProjects: 0, // We'll implement this later if needed
	}

	return summary, nil
}

// ListMountCatalogEntries returns paginated mount catalog entries
func (s *MountCatalogService) ListMountCatalogEntries(ctx context.Context, limit, offset int32) ([]sqlc.DockerMountCatalog, error) {
	params := sqlc.ListMountCatalogEntriesParams{
		Limit:  limit,
		Offset: offset,
	}
	return s.queries.ListMountCatalogEntries(ctx, params)
}

// DiscoverOrganizationMounts discovers Docker mounts for a specific organization
func (s *MountCatalogService) DiscoverOrganizationMounts(ctx context.Context, organizationID int64) error {
	// Validate organization context
	if err := s.validateOrganizationAccess(ctx, organizationID); err != nil {
		return utils.WrapErrorf(err, "organization %d access validation failed", organizationID)
	}

	log.Printf("[MOUNT-CATALOG] Starting mount discovery for organization %d", organizationID)

	// Get organization volumes only
	volumes, err := s.store.Volumes().ListVolumesForOrganization(ctx, organizationID, 1000, 0)
	if err != nil {
		return utils.WrapErrorf(err, "failed to list volumes for organization %d", organizationID)
	}

	// Get all Docker volumes to cross-reference
	dockerVolumeResp, err := s.client.ListVolumes(ctx, nil)
	if err != nil {
		return utils.WrapError(err, "failed to list Docker volumes")
	}

	// Get all containers to map mounts
	containers, err := s.client.ListContainers(ctx, nil)
	if err != nil {
		return utils.WrapError(err, "failed to list Docker containers")
	}

	// Track discovered mount IDs for this organization
	discoveredMountIDs := make(map[string]bool)

	// Process organization volumes that have Docker counterparts
	for _, vol := range volumes {
		// Find matching Docker volume
		for _, dockerVol := range dockerVolumeResp.Volumes {
			if dockerVol != nil && dockerVol.Name == vol.ID {
				discoveredMountIDs[vol.ID] = true
				if err := s.processOrganizationVolume(ctx, *dockerVol, containers, organizationID); err != nil {
					log.Printf("[MOUNT-CATALOG] Failed to process organization volume %s: %v", vol.ID, err)
				}
				break
			}
		}
	}

	// Process containers for organization-specific bind mounts
	if err := s.processOrganizationContainerMounts(ctx, containers, organizationID, discoveredMountIDs); err != nil {
		log.Printf("[MOUNT-CATALOG] Failed to process organization container mounts: %v", err)
	}

	log.Printf("[MOUNT-CATALOG] Mount discovery completed for organization %d. Discovered %d mounts", organizationID, len(discoveredMountIDs))
	return nil
}

// GetOrganizationMountCatalogSummary returns mount catalog summary for a specific organization
func (s *MountCatalogService) GetOrganizationMountCatalogSummary(ctx context.Context, organizationID int64) (*MountCatalogSummary, error) {
	// Validate organization context
	if err := s.validateOrganizationAccess(ctx, organizationID); err != nil {
		return nil, utils.WrapErrorf(err, "organization %d access validation failed", organizationID)
	}

	// Get organization volumes to filter mount catalog
	volumes, err := s.store.Volumes().ListVolumesForOrganization(ctx, organizationID, 1000, 0)
	if err != nil {
		return nil, utils.WrapErrorf(err, "failed to list volumes for organization %d", organizationID)
	}

	// Create volume ID set for filtering
	volumeIDs := make(map[string]bool)
	for _, vol := range volumes {
		volumeIDs[vol.ID] = true
	}

	// Get all mount catalog entries and filter by organization volumes
	allMounts, err := s.queries.ListMountCatalogEntries(ctx, sqlc.ListMountCatalogEntriesParams{
		Limit:  10000, // Large limit to get all mounts
		Offset: 0,
	})
	if err != nil {
		return nil, utils.WrapError(err, "failed to list mount catalog entries")
	}

	// Filter and categorize mounts for this organization
	var volumeCount, bindCount, tmpfsCount, orphanedCount, trackedCount int64
	for _, mount := range allMounts {
		// Check if this mount belongs to organization volumes
		if mount.VolumeName.Valid && volumeIDs[mount.VolumeName.String] {
			switch mount.MountType {
			case "volume":
				volumeCount++
			case "bind":
				bindCount++
			case "tmpfs":
				tmpfsCount++
			}

			if mount.IsOrphaned {
				orphanedCount++
			}
			if mount.IsTracked {
				trackedCount++
			}
		}
	}

	return &MountCatalogSummary{
		TotalMounts:     volumeCount + bindCount + tmpfsCount,
		VolumeMounts:    volumeCount,
		BindMounts:      bindCount,
		TmpfsMounts:     tmpfsCount,
		OrphanedMounts:  orphanedCount,
		TrackedMounts:   trackedCount,
		ComposeProjects: 0, // TODO: Implement compose project detection
	}, nil
}

// ListOrganizationMountCatalogEntries returns paginated mount catalog entries for a specific organization
func (s *MountCatalogService) ListOrganizationMountCatalogEntries(ctx context.Context, organizationID int64, limit, offset int32) ([]sqlc.DockerMountCatalog, error) {
	// Validate organization context
	if err := s.validateOrganizationAccess(ctx, organizationID); err != nil {
		return nil, utils.WrapErrorf(err, "organization %d access validation failed", organizationID)
	}

	// Get organization volumes to filter mount catalog
	volumes, err := s.store.Volumes().ListVolumesForOrganization(ctx, organizationID, 1000, 0)
	if err != nil {
		return nil, utils.WrapErrorf(err, "failed to list volumes for organization %d", organizationID)
	}

	// Create volume ID set for filtering
	volumeIDs := make(map[string]bool)
	for _, vol := range volumes {
		volumeIDs[vol.ID] = true
	}

	// Get all mount catalog entries and filter by organization volumes
	allMounts, err := s.queries.ListMountCatalogEntries(ctx, sqlc.ListMountCatalogEntriesParams{
		Limit:  limit * 2, // Get more to account for filtering
		Offset: offset,
	})
	if err != nil {
		return nil, utils.WrapError(err, "failed to list mount catalog entries")
	}

	// Filter mounts for this organization
	var organizationMounts []sqlc.DockerMountCatalog
	for _, mount := range allMounts {
		if mount.VolumeName.Valid && volumeIDs[mount.VolumeName.String] {
			organizationMounts = append(organizationMounts, mount)
			if int32(len(organizationMounts)) >= limit {
				break
			}
		}
	}

	return organizationMounts, nil
}

// validateOrganizationAccess validates that the organization context is valid
func (s *MountCatalogService) validateOrganizationAccess(ctx context.Context, organizationID int64) error {
	// Get organization from store to validate it exists
	org, err := s.store.Organizations().GetOrganization(ctx, organizationID)
	if err != nil {
		return utils.WrapErrorf(err, "organization %d not found", organizationID)
	}

	if org == nil {
		return utils.NewError("organization %d does not exist", organizationID)
	}

	log.Printf("[MOUNT-CATALOG] Validated access to organization %d (%s)", organizationID, org.Name)
	return nil
}

// processOrganizationVolume processes a Docker volume for a specific organization
func (s *MountCatalogService) processOrganizationVolume(ctx context.Context, vol volume.Volume, containers []types.Container, organizationID int64) error {
	log.Printf("[MOUNT-CATALOG] Processing volume %s for organization %d", vol.Name, organizationID)
	
	// Use existing volume processing logic but add organization context logging
	return s.processVolume(ctx, vol, containers)
}

// processOrganizationContainerMounts processes bind mounts and tmpfs for organization containers
func (s *MountCatalogService) processOrganizationContainerMounts(ctx context.Context, containers []types.Container, organizationID int64, discoveredMountIDs map[string]bool) error {
	log.Printf("[MOUNT-CATALOG] Processing container mounts for organization %d", organizationID)
	
	// Filter containers that belong to organization volumes (simplified approach)
	// In a full implementation, we'd need container-to-organization mapping
	for _, container := range containers {
		if err := s.processContainerMounts(ctx, container, discoveredMountIDs); err != nil {
			log.Printf("[MOUNT-CATALOG] Failed to process container mounts for organization %d, container %s: %v", organizationID, container.ID, err)
		}
	}
	
	return nil
}

// SearchMountCatalog searches mount catalog with filters (simplified)
func (s *MountCatalogService) SearchMountCatalog(ctx context.Context, filters SearchFilters) ([]sqlc.DockerMountCatalog, error) {
	// Temporarily simplified - mount catalog search disabled
	// TODO: Implement proper search functionality with new schema
	log.Printf("[MOUNT-CATALOG] Search requested with query: '%s' (simplified)", filters.Query)
	return []sqlc.DockerMountCatalog{}, nil
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
