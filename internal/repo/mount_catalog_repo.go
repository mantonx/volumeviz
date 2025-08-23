package repo

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/mantonx/volumeviz/internal/db/sqlc"
)

// MountCatalogRepository provides access to Docker mount catalog data operations
type MountCatalogRepository struct {
	queries *sqlc.Queries
	db      *pgx.Conn
}

// NewMountCatalogRepository creates a new mount catalog repository
func NewMountCatalogRepository(queries *sqlc.Queries, db *pgx.Conn) *MountCatalogRepository {
	return &MountCatalogRepository{
		queries: queries,
		db:      db,
	}
}

// MountCatalogEntry represents a Docker mount catalog entry
type MountCatalogEntry struct {
	ID                int64             `json:"id"`
	MountID           string            `json:"mount_id"`
	MountType         string            `json:"mount_type"`       // volume, bind, tmpfs
	VolumeName        *string           `json:"volume_name"`      // Docker volume name
	VolumeDriver      *string           `json:"volume_driver"`    // Volume driver
	SourcePath        string            `json:"source_path"`      // Source path (host path for bind mounts)
	ComposeProject    *string           `json:"compose_project"`  // Compose project name
	ComposeServices   []string          `json:"compose_services"` // Compose service names
	IsOrphaned        bool              `json:"is_orphaned"`      // No active containers
	IsTracked         bool              `json:"is_tracked"`       // Currently being tracked
	ContainerCount    int32             `json:"container_count"`  // Number of containers using this mount
	FirstDiscoveredAt *time.Time        `json:"first_discovered_at"`
	LastSeenAt        *time.Time        `json:"last_seen_at"`
	DiscoverySource   string            `json:"discovery_source"`
	Metadata          map[string]string `json:"metadata"` // Additional metadata
}

// Helper function to convert from SQLC model to domain model
func (r *MountCatalogRepository) convertFromSQLCMount(mount sqlc.DockerMountCatalog) *MountCatalogEntry {
	return &MountCatalogEntry{
		ID:                mount.ID,
		MountID:           mount.MountID,
		MountType:         mount.MountType,
		VolumeName:        nullTextToStringPtr(mount.VolumeName),
		VolumeDriver:      nullTextToStringPtr(mount.VolumeDriver),
		SourcePath:        mount.SourcePath,
		ComposeProject:    nullTextToStringPtr(mount.ComposeProject),
		ComposeServices:   mount.ComposeServices,
		IsOrphaned:        mount.IsOrphaned,
		IsTracked:         mount.IsTracked,
		ContainerCount:    mount.ContainerCount,
		FirstDiscoveredAt: nullTimestampToTimePtr2(mount.FirstDiscoveredAt),
		LastSeenAt:        nullTimestampToTimePtr2(mount.LastSeenAt),
		DiscoverySource:   mount.DiscoverySource,
		Metadata:          make(map[string]string), // Initialize empty metadata
	}
}

// GetMountByMountID retrieves a mount by mount ID string
func (r *MountCatalogRepository) GetMountByMountID(ctx context.Context, mountID string) (*MountCatalogEntry, error) {
	mount, err := r.queries.GetMountCatalogEntry(ctx, mountID)
	if err != nil {
		return nil, fmt.Errorf("failed to get mount by mount ID: %w", err)
	}

	return r.convertFromSQLCMount(mount), nil
}

// ListMounts retrieves all mounts with optional filtering
func (r *MountCatalogRepository) ListMounts(ctx context.Context, limit, offset int32) ([]*MountCatalogEntry, error) {
	params := sqlc.ListMountCatalogEntriesParams{
		Limit:  limit,
		Offset: offset,
	}

	mounts, err := r.queries.ListMountCatalogEntries(ctx, params)
	if err != nil {
		return nil, fmt.Errorf("failed to list mounts: %w", err)
	}

	entries := make([]*MountCatalogEntry, len(mounts))
	for i, mount := range mounts {
		entries[i] = r.convertFromSQLCMount(mount)
	}

	return entries, nil
}

// ListAllMounts retrieves all mounts without pagination
func (r *MountCatalogRepository) ListAllMounts(ctx context.Context) ([]*MountCatalogEntry, error) {
	// Use a large limit to get all mounts
	return r.ListMounts(ctx, 10000, 0)
}

// ListMountsByType retrieves mounts filtered by type
func (r *MountCatalogRepository) ListMountsByType(ctx context.Context, mountType string) ([]*MountCatalogEntry, error) {
	params := sqlc.ListMountCatalogEntriesByTypeParams{
		MountType: mountType,
		Limit:     1000,
		Offset:    0,
	}

	mounts, err := r.queries.ListMountCatalogEntriesByType(ctx, params)
	if err != nil {
		return nil, fmt.Errorf("failed to list mounts by type: %w", err)
	}

	entries := make([]*MountCatalogEntry, len(mounts))
	for i, mount := range mounts {
		entries[i] = r.convertFromSQLCMount(mount)
	}

	return entries, nil
}

// ListTrackedMounts retrieves all currently tracked mounts
func (r *MountCatalogRepository) ListTrackedMounts(ctx context.Context) ([]*MountCatalogEntry, error) {
	params := sqlc.ListTrackedMountsParams{
		Limit:  1000,
		Offset: 0,
	}

	mounts, err := r.queries.ListTrackedMounts(ctx, params)
	if err != nil {
		return nil, fmt.Errorf("failed to list tracked mounts: %w", err)
	}

	entries := make([]*MountCatalogEntry, len(mounts))
	for i, mount := range mounts {
		entries[i] = r.convertFromSQLCMount(mount)
	}

	return entries, nil
}

// ListOrphanedMounts retrieves all orphaned mounts
func (r *MountCatalogRepository) ListOrphanedMounts(ctx context.Context) ([]*MountCatalogEntry, error) {
	params := sqlc.ListOrphanedMountsParams{
		Limit:  1000,
		Offset: 0,
	}

	mounts, err := r.queries.ListOrphanedMounts(ctx, params)
	if err != nil {
		return nil, fmt.Errorf("failed to list orphaned mounts: %w", err)
	}

	entries := make([]*MountCatalogEntry, len(mounts))
	for i, mount := range mounts {
		entries[i] = r.convertFromSQLCMount(mount)
	}

	return entries, nil
}

// UpdateMountTrackingStatus updates the tracking status of a mount
func (r *MountCatalogRepository) UpdateMountTrackingStatus(ctx context.Context, mountID string, isTracked bool) error {
	params := sqlc.UpdateMountTrackingStatusParams{
		MountID:   mountID,
		IsTracked: isTracked,
	}

	_, err := r.queries.UpdateMountTrackingStatus(ctx, params)
	if err != nil {
		return fmt.Errorf("failed to update mount tracking status: %w", err)
	}

	return nil
}

// GetMountCatalogSummary retrieves summary statistics for the mount catalog
func (r *MountCatalogRepository) GetMountCatalogSummary(ctx context.Context) (*MountCatalogSummary, error) {
	// For now, return empty summary as we'd need to implement this query
	// This would require adding a summary query to the SQL files
	return &MountCatalogSummary{
		TotalMounts:    0,
		TrackedMounts:  0,
		OrphanedMounts: 0,
		VolumeCount:    0,
		BindCount:      0,
		TmpfsCount:     0,
	}, nil
}

// MountCatalogSummary represents summary statistics for the mount catalog
type MountCatalogSummary struct {
	TotalMounts    int64 `json:"total_mounts"`
	TrackedMounts  int64 `json:"tracked_mounts"`
	OrphanedMounts int64 `json:"orphaned_mounts"`
	VolumeCount    int64 `json:"volume_count"`
	BindCount      int64 `json:"bind_count"`
	TmpfsCount     int64 `json:"tmpfs_count"`
}

// Helper function to convert pgtype.Timestamp to *time.Time
func nullTimestampToTimePtr2(nt pgtype.Timestamp) *time.Time {
	if !nt.Valid {
		return nil
	}
	return &nt.Time
}
