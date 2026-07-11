package repo

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgtype"
	"github.com/mantonx/volumeviz/internal/db/sqlc"
	sqlcSQLite "github.com/mantonx/volumeviz/internal/db/sqlc-sqlite"
	"github.com/mantonx/volumeviz/internal/models"
)

// VolumesRepo handles volume, container, and mount operations with organization scoping
// This repo accepts sqlc.Queries (injected by store) and returns domain models
type VolumesRepo interface {
	// Volume operations - all require organization context
	CreateVolume(ctx context.Context, organizationID int64, params models.CreateVolumeParams) (*models.Volume, error)
	GetVolumeByID(ctx context.Context, organizationID int64, volumeID string) (*models.Volume, error)
	GetVolumeByVolumeID(ctx context.Context, organizationID int64, volumeID string) (*models.Volume, error)
	ListVolumes(ctx context.Context, organizationID int64, limit, offset int32) ([]*models.Volume, error)
	UpdateVolume(ctx context.Context, organizationID int64, params models.UpdateVolumeParams) (*models.Volume, error)
	UpdateLastScanned(ctx context.Context, organizationID int64, volumeID string, lastScanned time.Time) error
	SoftDeleteVolume(ctx context.Context, organizationID int64, volumeID string) error
	HardDeleteVolume(ctx context.Context, organizationID int64, volumeID string) error
	UpsertVolume(ctx context.Context, organizationID int64, params models.CreateVolumeParams) (*models.Volume, error)
	GetVolumeStats(ctx context.Context, organizationID int64, volumeID string) (*models.VolumeStats, error)
	CountVolumes(ctx context.Context, organizationID int64) (int64, error)

	// Container operations
	CreateContainer(ctx context.Context, params models.CreateContainerParams) (*models.Container, error)
	GetContainerByContainerID(ctx context.Context, containerID string) (*models.Container, error)
	UpsertContainer(ctx context.Context, params models.CreateContainerParams) (*models.Container, error)

	// Volume mount operations
	CreateVolumeMount(ctx context.Context, params models.CreateVolumeMountParams) (*models.VolumeMount, error)
	UpsertVolumeMount(ctx context.Context, params models.CreateVolumeMountParams) (*models.VolumeMount, error)
	GetVolumeMountsByVolume(ctx context.Context, volumeID string) ([]*models.VolumeMount, error)

	// System-level operations (for services that operate across organizations)
	GetVolumeByVolumeIDSystemLevel(ctx context.Context, volumeID string) (*models.Volume, error)
	ListAllVolumes(ctx context.Context, limit, offset int32) ([]*models.Volume, error)

	// Volume tracking operations
	SetVolumeTracked(ctx context.Context, organizationID int64, volumeID string) (*models.Volume, error)
	SetVolumeUntracked(ctx context.Context, organizationID int64, volumeID string) (*models.Volume, error)
	GetVolumeTrackingStatus(ctx context.Context, organizationID int64, volumeID string) (*models.VolumeTrackingStatus, error)
	ListTrackedVolumes(ctx context.Context, organizationID int64, limit, offset int32) ([]*models.Volume, error)
	ListUntrackedVolumes(ctx context.Context, organizationID int64, limit, offset int32) ([]*models.Volume, error)
	CountTrackedVolumes(ctx context.Context, organizationID int64) (int64, error)
	CountUntrackedVolumes(ctx context.Context, organizationID int64) (int64, error)
}

// volumesRepo implements VolumesRepo using PostgreSQL sqlc generated queries
type volumesRepo struct {
	queries *sqlc.Queries
}

// volumesRepoSQLite implements VolumesRepo using SQLite sqlc generated queries
type volumesRepoSQLite struct {
	queries *sqlcSQLite.Queries
}

// NewVolumesRepo creates a new volumes repository
func NewVolumesRepo(queries *sqlc.Queries) VolumesRepo {
	return &volumesRepo{queries: queries}
}

// NewSQLiteVolumesRepo creates a new SQLite volumes repository
func NewSQLiteVolumesRepo(queries *sqlcSQLite.Queries) VolumesRepo {
	return &volumesRepoSQLite{queries: queries}
}

// =============================================================================
// VOLUME OPERATIONS
// =============================================================================

func (r *volumesRepo) CreateVolume(ctx context.Context, organizationID int64, params models.CreateVolumeParams) (*models.Volume, error) {
	now := time.Now()
	result, err := r.queries.CreateVolume(ctx, sqlc.CreateVolumeParams{
		VolumeID:       params.VolumeID,
		DisplayName:    pgtype.Text{String: params.Name, Valid: params.Name != ""},
		MountPoint:     params.Mountpoint,
		ContainerNames: []string{}, // Initialize as empty
		IsActive:       pgtype.Bool{Bool: params.IsActive, Valid: true},
		TotalSizeBytes: pgtype.Int8{Valid: false},                       // Will be filled later
		UsedSizeBytes:  pgtype.Int8{Valid: false},                       // Will be filled later
		FreeSizeBytes:  pgtype.Int8{Valid: false},                       // Will be filled later
		FilesystemType: pgtype.Text{Valid: false},                       // Will be detected later
		ContainerCount: pgtype.Int4{Valid: false},                       // Will be counted later
		FirstSeenAt:    pgtype.Timestamptz{Time: now, Valid: true},      // Set to current time
		LastScanAt:     pgtype.Timestamptz{Valid: false},                // No scan yet
		LastModifiedAt: pgtype.Timestamptz{Valid: false},                // Will be detected later
		OrganizationID: pgtype.Int8{Int64: organizationID, Valid: true}, // Organization context
	})
	if err != nil {
		return nil, fmt.Errorf("failed to create volume: %w", err)
	}

	return &models.Volume{
		VolumeID:   result.VolumeID,
		Name:       pgTextToString(result.DisplayName),
		Mountpoint: result.MountPoint,
		IsActive:   pgBoolToBool(result.IsActive),
		CreatedAt:  result.CreatedAt,
		UpdatedAt:  result.UpdatedAt,
		// Note: Other fields like ID, Driver, Labels, Options, Scope, Status not in current schema
	}, nil
}

func (r *volumesRepo) GetVolumeByID(ctx context.Context, organizationID int64, volumeID string) (*models.Volume, error) {
	row, err := r.queries.GetVolumeByID(ctx, sqlc.GetVolumeByIDParams{
		VolumeID:       volumeID,
		OrganizationID: pgtype.Int8{Int64: organizationID, Valid: true},
	})
	if err != nil {
		return nil, fmt.Errorf("failed to get volume by ID: %w", err)
	}

	return r.convertRowToVolume(row)
}

func (r *volumesRepo) GetVolumeByVolumeID(ctx context.Context, organizationID int64, volumeID string) (*models.Volume, error) {
	row, err := r.queries.GetVolumeByVolumeID(ctx, sqlc.GetVolumeByVolumeIDParams{
		VolumeID:       volumeID,
		OrganizationID: pgtype.Int8{Int64: organizationID, Valid: true},
	})
	if err != nil {
		return nil, fmt.Errorf("failed to get volume by volume ID: %w", err)
	}

	return r.convertRowToVolume(row)
}

// GetVolumeByVolumeIDSystemLevel gets volume without organization filtering (for system services)
func (r *volumesRepo) GetVolumeByVolumeIDSystemLevel(ctx context.Context, volumeID string) (*models.Volume, error) {
	row, err := r.queries.GetVolumeSystemLevel(ctx, volumeID)
	if err != nil {
		return nil, fmt.Errorf("failed to get volume by volume ID (system level): %w", err)
	}

	return r.convertRowToVolume(row)
}

// ListAllVolumes lists all volumes across organizations (for system services)
func (r *volumesRepo) ListAllVolumes(ctx context.Context, limit, offset int32) ([]*models.Volume, error) {
	rows, err := r.queries.ListAllVolumes(ctx, sqlc.ListAllVolumesParams{
		Limit:  limit,
		Offset: offset,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to list all volumes: %w", err)
	}

	volumes := make([]*models.Volume, 0, len(rows))
	for _, row := range rows {
		volume, err := r.convertRowToVolume(row)
		if err != nil {
			return nil, err
		}
		volumes = append(volumes, volume)
	}

	return volumes, nil
}

func (r *volumesRepo) ListVolumes(ctx context.Context, organizationID int64, limit, offset int32) ([]*models.Volume, error) {
	rows, err := r.queries.ListVolumes(ctx, sqlc.ListVolumesParams{
		OrganizationID: pgtype.Int8{Int64: organizationID, Valid: true},
		Limit:          limit,
		Offset:         offset,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to list volumes: %w", err)
	}

	volumes := make([]*models.Volume, 0, len(rows))
	for _, row := range rows {
		volume, err := r.convertRowToVolume(row)
		if err != nil {
			return nil, err
		}
		volumes = append(volumes, volume)
	}

	return volumes, nil
}

func (r *volumesRepo) UpdateVolume(ctx context.Context, organizationID int64, params models.UpdateVolumeParams) (*models.Volume, error) {
	result, err := r.queries.UpdateVolume(ctx, sqlc.UpdateVolumeParams{
		VolumeID:       params.VolumeID,
		DisplayName:    pgtype.Text{String: params.Name, Valid: params.Name != ""},
		MountPoint:     params.Mountpoint,
		ContainerNames: []string{}, // Update with actual container names if available
		IsActive:       pgtype.Bool{Bool: params.IsActive, Valid: true},
		TotalSizeBytes: pgtype.Int8{Valid: false}, // Update with actual size if available
		UsedSizeBytes:  pgtype.Int8{Valid: false},
		FreeSizeBytes:  pgtype.Int8{Valid: false},
		FilesystemType: pgtype.Text{Valid: false},
		ContainerCount: pgtype.Int4{Valid: false},
		LastScanAt:     pgtype.Timestamptz{Valid: false},
		LastModifiedAt: pgtype.Timestamptz{Valid: false},
		OrganizationID: pgtype.Int8{Int64: organizationID, Valid: true},
	})
	if err != nil {
		return nil, fmt.Errorf("failed to update volume: %w", err)
	}

	// Return a basic volume object with updated values
	return &models.Volume{
		VolumeID:   params.VolumeID,
		Name:       params.Name,
		Mountpoint: params.Mountpoint,
		IsActive:   params.IsActive,
		CreatedAt:  result.CreatedAt,
		UpdatedAt:  result.UpdatedAt,
	}, nil
}

func (r *volumesRepo) UpdateLastScanned(ctx context.Context, organizationID int64, volumeID string, lastScanned time.Time) error {
	err := r.queries.UpdateLastScanned(ctx, sqlc.UpdateLastScannedParams{
		VolumeID:       volumeID,
		LastScanAt:     pgtype.Timestamptz{Time: lastScanned, Valid: true},
		OrganizationID: pgtype.Int8{Int64: organizationID, Valid: true},
	})
	if err != nil {
		return fmt.Errorf("failed to update last scanned time: %w", err)
	}
	return nil
}

func (r *volumesRepo) SoftDeleteVolume(ctx context.Context, organizationID int64, volumeID string) error {
	err := r.queries.SoftDeleteVolume(ctx, sqlc.SoftDeleteVolumeParams{
		VolumeID:       volumeID,
		OrganizationID: pgtype.Int8{Int64: organizationID, Valid: true},
	})
	if err != nil {
		return fmt.Errorf("failed to soft delete volume: %w", err)
	}
	return nil
}

// HardDeleteVolume permanently removes a volume's row from VolumeViz's own
// database. Callers are responsible for having already deleted the real
// Docker volume first — this only cleans up VolumeViz's local record so a
// just-deleted volume doesn't linger in the UI until the next reconciliation
// pass.
func (r *volumesRepo) HardDeleteVolume(ctx context.Context, organizationID int64, volumeID string) error {
	err := r.queries.HardDeleteVolume(ctx, sqlc.HardDeleteVolumeParams{
		VolumeID:       volumeID,
		OrganizationID: pgtype.Int8{Int64: organizationID, Valid: true},
	})
	if err != nil {
		return fmt.Errorf("failed to hard delete volume: %w", err)
	}
	return nil
}

func (r *volumesRepo) UpsertVolume(ctx context.Context, organizationID int64, params models.CreateVolumeParams) (*models.Volume, error) {
	now := time.Now()

	// Convert labels map to JSON bytes
	var labelsJSON []byte
	if params.Labels != nil && len(params.Labels) > 0 {
		var err error
		labelsJSON, err = json.Marshal(params.Labels)
		if err != nil {
			labelsJSON = []byte("{}")
		}
	} else {
		labelsJSON = []byte("{}")
	}

	// Convert options map to JSON bytes
	var optionsJSON []byte
	if params.Options != nil && len(params.Options) > 0 {
		var err error
		optionsJSON, err = json.Marshal(params.Options)
		if err != nil {
			optionsJSON = []byte("{}")
		}
	} else {
		optionsJSON = []byte("{}")
	}

	result, err := r.queries.UpsertVolume(ctx, sqlc.UpsertVolumeParams{
		VolumeID:       params.VolumeID,
		DisplayName:    pgtype.Text{String: params.Name, Valid: params.Name != ""},
		MountPoint:     params.Mountpoint,
		ContainerNames: []string{}, // Initialize as empty
		IsActive:       pgtype.Bool{Bool: params.IsActive, Valid: true},
		TotalSizeBytes: pgtype.Int8{Valid: false},                       // Will be filled later
		UsedSizeBytes:  pgtype.Int8{Valid: false},                       // Will be filled later
		FreeSizeBytes:  pgtype.Int8{Valid: false},                       // Will be filled later
		FilesystemType: pgtype.Text{Valid: false},                       // Will be detected later
		ContainerCount: pgtype.Int4{Valid: false},                       // Will be counted later
		FirstSeenAt:    pgtype.Timestamptz{Time: now, Valid: true},      // Set to current time for new volumes
		LastScanAt:     pgtype.Timestamptz{Valid: false},                // No scan yet
		LastModifiedAt: pgtype.Timestamptz{Valid: false},                // Will be detected later
		OrganizationID: pgtype.Int8{Int64: organizationID, Valid: true}, // Organization context
		Driver:         pgtype.Text{String: params.Driver, Valid: params.Driver != ""},
		Scope:          pgtype.Text{String: params.Scope, Valid: params.Scope != ""},
		Labels:         labelsJSON,
		Options:        optionsJSON,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to upsert volume: %w", err)
	}

	return &models.Volume{
		VolumeID:   result.VolumeID,
		Name:       pgTextToString(result.DisplayName),
		Driver:     pgTextToString(result.Driver),
		Scope:      pgTextToString(result.Scope),
		Mountpoint: result.MountPoint,
		Labels:     params.Labels,  // Pass through original map
		Options:    params.Options, // Pass through original map
		IsActive:   pgBoolToBool(result.IsActive),
		CreatedAt:  result.CreatedAt,
		UpdatedAt:  result.UpdatedAt,
	}, nil
}

func (r *volumesRepo) GetVolumeStats(ctx context.Context, organizationID int64, volumeID string) (*models.VolumeStats, error) {
	// Get total volume count for organization
	totalVolumes, err := r.queries.CountVolumes(ctx, pgtype.Int8{Int64: organizationID, Valid: true})
	if err != nil {
		return nil, fmt.Errorf("failed to count total volumes: %w", err)
	}

	// Get active volumes count for organization
	activeVolumes, err := r.queries.CountActiveVolumes(ctx, pgtype.Int8{Int64: organizationID, Valid: true})
	if err != nil {
		return nil, fmt.Errorf("failed to count active volumes: %w", err)
	}

	return &models.VolumeStats{
		TotalVolumes:   totalVolumes,
		ActiveVolumes:  activeVolumes,
		UniqueDrivers:  0,   // TODO: Implement when volume schema includes driver field
		ScannedVolumes: 0,   // TODO: Count volumes with last_scan_at not null
		NewestVolume:   nil, // TODO: Get MAX(created_at) when volume schema available
		OldestVolume:   nil, // TODO: Get MIN(created_at) when volume schema available
	}, nil
}

func (r *volumesRepo) CountVolumes(ctx context.Context, organizationID int64) (int64, error) {
	count, err := r.queries.CountVolumes(ctx, pgtype.Int8{Int64: organizationID, Valid: true})
	if err != nil {
		return 0, fmt.Errorf("failed to count volumes: %w", err)
	}
	return count, nil
}

// =============================================================================
// CONTAINER OPERATIONS
// =============================================================================

func (r *volumesRepo) CreateContainer(ctx context.Context, params models.CreateContainerParams) (*models.Container, error) {
	// TODO: CreateContainer needs proper container schema - current schema is for docker mount catalog
	return nil, fmt.Errorf("CreateContainer not implemented - requires proper container schema")
}

func (r *volumesRepo) GetContainerByContainerID(ctx context.Context, containerID string) (*models.Container, error) {
	attachment, err := r.queries.GetContainerByContainerID(ctx, containerID)
	if err != nil {
		return nil, err
	}

	// Convert from docker_mount_attachments to Container model
	container := &models.Container{
		ID:          attachment.ID,
		ContainerID: attachment.ContainerID,
		Name:        attachment.ContainerName.String,
		Image:       attachment.ContainerImage.String,
		State:       attachment.ContainerState.String,
		Status:      "", // Not stored in mount attachments table
		IsActive:    attachment.IsActive,
		CreatedAt:   attachment.CreatedAt,
		UpdatedAt:   attachment.UpdatedAt,
	}

	// Parse labels from JSON
	if attachment.ContainerLabels != nil {
		labels := make(map[string]string)
		if err := json.Unmarshal(attachment.ContainerLabels, &labels); err == nil {
			container.Labels = labels
		}
	}

	// Convert timestamps
	if attachment.AttachedAt.Valid {
		container.StartedAt = &attachment.AttachedAt.Time
	}
	if attachment.DetachedAt.Valid {
		container.FinishedAt = &attachment.DetachedAt.Time
	}

	return container, nil
}

func (r *volumesRepo) UpsertContainer(ctx context.Context, params models.CreateContainerParams) (*models.Container, error) {
	// Convert labels to JSON
	labelsJSON, err := json.Marshal(params.Labels)
	if err != nil {
		labelsJSON = []byte("{}")
	}

	// Try INSERT first (using new simple UpsertContainer query)
	sqlcParams := sqlc.UpsertContainerParams{
		MountCatalogID:  pgtype.Int8{Valid: false}, // NULL for standalone container entries (no mount relationship)
		ContainerID:     params.ContainerID,
		ContainerName:   pgtype.Text{String: params.Name, Valid: params.Name != ""},
		DestinationPath: "",   // Not applicable for standalone containers
		AccessMode:      "rw", // Default access mode
		ContainerState:  pgtype.Text{String: params.State, Valid: params.State != ""},
		ContainerImage:  pgtype.Text{String: params.Image, Valid: params.Image != ""},
		ContainerLabels: labelsJSON,
	}

	result, err := r.queries.UpsertContainer(ctx, sqlcParams)
	if err != nil {
		// If insert fails due to constraint violation, try update
		if strings.Contains(err.Error(), "duplicate key") || strings.Contains(err.Error(), "unique constraint") {
			updateParams := sqlc.UpdateContainerParams{
				ContainerID:     params.ContainerID,
				MountCatalogID:  pgtype.Int8{Valid: false}, // NULL for standalone container entries (no mount relationship)
				ContainerName:   pgtype.Text{String: params.Name, Valid: params.Name != ""},
				AccessMode:      "rw",
				ContainerState:  pgtype.Text{String: params.State, Valid: params.State != ""},
				ContainerImage:  pgtype.Text{String: params.Image, Valid: params.Image != ""},
				ContainerLabels: labelsJSON,
			}

			result, err = r.queries.UpdateContainer(ctx, updateParams)
			if err != nil {
				return nil, err
			}
		} else {
			return nil, err
		}
	}

	// Convert back to Container model
	container := &models.Container{
		ID:          result.ID,
		ContainerID: result.ContainerID,
		Name:        result.ContainerName.String,
		Image:       result.ContainerImage.String,
		State:       result.ContainerState.String,
		Status:      params.Status,
		IsActive:    params.IsActive,
		CreatedAt:   result.CreatedAt,
		UpdatedAt:   result.UpdatedAt,
	}

	// Parse labels from JSON
	if result.ContainerLabels != nil {
		labels := make(map[string]string)
		if err := json.Unmarshal(result.ContainerLabels, &labels); err == nil {
			container.Labels = labels
		}
	}

	// Convert timestamps
	if params.StartedAt != nil {
		container.StartedAt = params.StartedAt
	}
	if params.FinishedAt != nil {
		container.FinishedAt = params.FinishedAt
	}

	return container, nil
}

// =============================================================================
// VOLUME MOUNT OPERATIONS
// =============================================================================

func (r *volumesRepo) CreateVolumeMount(ctx context.Context, params models.CreateVolumeMountParams) (*models.VolumeMount, error) {
	// TODO: CreateVolumeMount needs proper volume mount schema - current schema is for docker mount catalog
	return nil, fmt.Errorf("CreateVolumeMount not implemented - requires proper volume mount schema")
}

func (r *volumesRepo) UpsertVolumeMount(ctx context.Context, params models.CreateVolumeMountParams) (*models.VolumeMount, error) {
	sqlcParams := sqlc.UpsertVolumeMountParams{
		MountID:        params.VolumeID, // Use volume ID as mount ID
		MountType:      "volume",        // Default to volume type
		SourcePath:     params.MountPath,
		ContainerCount: 1, // Start with 1 container
	}

	result, err := r.queries.UpsertVolumeMount(ctx, sqlcParams)
	if err != nil {
		return nil, fmt.Errorf("failed to upsert volume mount: %w", err)
	}

	// Convert DockerMountCatalog to VolumeMount
	volumeMount := &models.VolumeMount{
		ID:          result.ID,
		VolumeID:    pgTextToString(result.VolumeName), // Use volume name if available, fallback to mount ID
		ContainerID: params.ContainerID,
		MountPath:   params.MountPath,
		AccessMode:  params.AccessMode,
		IsActive:    params.IsActive,
		CreatedAt:   result.CreatedAt,
		UpdatedAt:   result.UpdatedAt,
	}

	// Use mount ID as volume ID if volume name is not set
	if volumeMount.VolumeID == "" {
		volumeMount.VolumeID = result.MountID
	}

	return volumeMount, nil
}

func (r *volumesRepo) GetVolumeMountsByVolume(ctx context.Context, volumeID string) ([]*models.VolumeMount, error) {
	// Use pgtype.Text for the query parameter
	volumeParam := pgtype.Text{String: volumeID, Valid: true}

	results, err := r.queries.GetVolumeMountsByVolume(ctx, volumeParam)
	if err != nil {
		return nil, fmt.Errorf("failed to get volume mounts by volume: %w", err)
	}

	// Convert DockerMountCatalog entries to VolumeMount domain models
	volumeMounts := make([]*models.VolumeMount, 0, len(results))
	for _, result := range results {
		volumeMount := &models.VolumeMount{
			ID:          result.ID,
			VolumeID:    pgTextToString(result.VolumeName), // Use volume name if available
			ContainerID: "",                                // This will need to be populated from container attachments
			MountPath:   result.SourcePath,
			AccessMode:  "rw",             // Default access mode
			IsActive:    result.IsTracked, // Use tracking status as active status
			CreatedAt:   result.CreatedAt,
			UpdatedAt:   result.UpdatedAt,
		}

		// Use mount ID as volume ID if volume name is not set
		if volumeMount.VolumeID == "" {
			volumeMount.VolumeID = result.MountID
		}

		volumeMounts = append(volumeMounts, volumeMount)
	}

	return volumeMounts, nil
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

// convertRowToVolume converts sqlc model types to domain Volume model
// This handles the different model types that can be returned by various queries
func (r *volumesRepo) convertRowToVolume(row interface{}) (*models.Volume, error) {
	var volume *models.Volume

	switch v := row.(type) {
	case sqlc.Volumes:
		volume = &models.Volume{
			VolumeID:   v.VolumeID,
			Name:       pgTextToString(v.DisplayName),
			Mountpoint: v.MountPoint,
			IsActive:   pgBoolToBool(v.IsActive),
			CreatedAt:  v.CreatedAt,
			UpdatedAt:  v.UpdatedAt,
		}

		// Handle optional timestamp
		if v.LastScanAt.Valid {
			volume.LastScanned = &v.LastScanAt.Time
		}

		// Handle organization ID
		if v.OrganizationID.Valid {
			volume.OrganizationID = &v.OrganizationID.Int64
		}

		// Handle size fields
		if v.TotalSizeBytes.Valid {
			volume.UsageData = &models.VolumeUsage{
				Size: v.TotalSizeBytes.Int64,
			}
		}

		// Handle tracking fields
		isTracked := v.IsTracked
		volume.IsTracked = &isTracked
		if v.TrackedAt.Valid {
			volume.TrackedAt = &v.TrackedAt.Time
		}
		if v.UntrackedAt.Valid {
			volume.UntrackedAt = &v.UntrackedAt.Time
		}

		// Note: Labels, Options, Driver, Scope, Status not in current schema

	default:
		return nil, fmt.Errorf("unsupported row type: %T", row)
	}

	return volume, nil
}

// =============================================================================
// SQLITE IMPLEMENTATION
// TODO: Update SQLite implementation to match organization-scoped interface
// =============================================================================

func (r *volumesRepoSQLite) CreateVolume(ctx context.Context, organizationID int64, params models.CreateVolumeParams) (*models.Volume, error) {
	// SQLite uses different parameter types (strings vs pgtype)
	result, err := r.queries.CreateVolume(ctx, sqlcSQLite.CreateVolumeParams{
		VolumeID:       params.VolumeID,
		DisplayName:    sql.NullString{String: params.Name, Valid: params.Name != ""},
		MountPoint:     params.Mountpoint,
		ContainerNames: sql.NullString{String: "[]", Valid: true},       // JSON array as string
		IsActive:       sql.NullInt64{Int64: 1, Valid: params.IsActive}, // Boolean as integer
		// Other fields will be filled later or default to NULL/0
	})
	if err != nil {
		return nil, fmt.Errorf("failed to create volume: %w", err)
	}

	return &models.Volume{
		VolumeID:   result.VolumeID,
		Name:       sqlNullStringToString(result.DisplayName),
		Mountpoint: result.MountPoint,
		IsActive:   sqlNullIntToBool(result.IsActive),
		CreatedAt:  result.CreatedAt,
		UpdatedAt:  result.UpdatedAt,
	}, nil
}

func (r *volumesRepoSQLite) GetVolumeByID(ctx context.Context, organizationID int64, volumeID string) (*models.Volume, error) {
	// Same issue as PostgreSQL - schema uses string volume_id primary key
	return nil, fmt.Errorf("GetVolumeByID not supported - current schema uses string volume_id primary key, not int64 id")
}

func (r *volumesRepoSQLite) GetVolumeByVolumeID(ctx context.Context, organizationID int64, volumeID string) (*models.Volume, error) {
	// SQLite uses GetVolume instead of GetVolumeByVolumeID
	row, err := r.queries.GetVolume(ctx, volumeID)
	if err != nil {
		return nil, fmt.Errorf("failed to get volume by volume ID: %w", err)
	}

	return r.convertSQLiteRowToVolume(row)
}

// GetVolumeByVolumeIDSystemLevel gets volume without organization filtering (for system services)
func (r *volumesRepoSQLite) GetVolumeByVolumeIDSystemLevel(ctx context.Context, volumeID string) (*models.Volume, error) {
	// For SQLite, we can use GetVolume since it doesn't filter by organization
	row, err := r.queries.GetVolume(ctx, volumeID)
	if err != nil {
		return nil, fmt.Errorf("failed to get volume by volume ID (system level): %w", err)
	}

	return r.convertSQLiteRowToVolume(row)
}

// ListAllVolumes lists all volumes across organizations (for system services)
func (r *volumesRepoSQLite) ListAllVolumes(ctx context.Context, limit, offset int32) ([]*models.Volume, error) {
	// For SQLite, ListVolumes already doesn't filter by organization, so we can use it
	rows, err := r.queries.ListVolumes(ctx, sqlcSQLite.ListVolumesParams{
		Limit:  int64(limit),
		Offset: int64(offset),
	})
	if err != nil {
		return nil, fmt.Errorf("failed to list all volumes: %w", err)
	}

	volumes := make([]*models.Volume, 0, len(rows))
	for _, row := range rows {
		volume, err := r.convertSQLiteRowToVolume(row)
		if err != nil {
			return nil, err
		}
		volumes = append(volumes, volume)
	}

	return volumes, nil
}

func (r *volumesRepoSQLite) ListVolumes(ctx context.Context, organizationID int64, limit, offset int32) ([]*models.Volume, error) {
	rows, err := r.queries.ListVolumes(ctx, sqlcSQLite.ListVolumesParams{
		Limit:  int64(limit),
		Offset: int64(offset),
	})
	if err != nil {
		return nil, fmt.Errorf("failed to list volumes: %w", err)
	}

	volumes := make([]*models.Volume, 0, len(rows))
	for _, row := range rows {
		volume, err := r.convertSQLiteRowToVolume(row)
		if err != nil {
			return nil, err
		}
		volumes = append(volumes, volume)
	}

	return volumes, nil
}

func (r *volumesRepoSQLite) UpdateVolume(ctx context.Context, organizationID int64, params models.UpdateVolumeParams) (*models.Volume, error) {
	result, err := r.queries.UpdateVolume(ctx, sqlcSQLite.UpdateVolumeParams{
		VolumeID:       params.VolumeID,
		DisplayName:    sql.NullString{String: params.Name, Valid: params.Name != ""},
		MountPoint:     params.Mountpoint,
		ContainerNames: sql.NullString{String: "[]", Valid: true},       // JSON array as string
		IsActive:       sql.NullInt64{Int64: 1, Valid: params.IsActive}, // Boolean as integer
		// Other fields handled by SQLC defaults
	})
	if err != nil {
		return nil, fmt.Errorf("failed to update volume: %w", err)
	}

	return &models.Volume{
		VolumeID:   params.VolumeID,
		Name:       params.Name,
		Mountpoint: params.Mountpoint,
		IsActive:   params.IsActive,
		CreatedAt:  result.CreatedAt,
		UpdatedAt:  result.UpdatedAt,
	}, nil
}

func (r *volumesRepoSQLite) UpdateLastScanned(ctx context.Context, organizationID int64, volumeID string, lastScanned time.Time) error {
	err := r.queries.UpdateLastScanned(ctx, sqlcSQLite.UpdateLastScannedParams{
		VolumeID:   volumeID,
		LastScanAt: sql.NullString{String: lastScanned.Format(time.RFC3339), Valid: true},
	})
	if err != nil {
		return fmt.Errorf("failed to update last scanned time: %w", err)
	}
	return nil
}

func (r *volumesRepoSQLite) SoftDeleteVolume(ctx context.Context, organizationID int64, volumeID string) error {
	// Same issue as PostgreSQL - schema uses string volume_id primary key
	return fmt.Errorf("SoftDeleteVolume not supported - current schema uses string volume_id primary key, not int64 id")
}

func (r *volumesRepoSQLite) HardDeleteVolume(ctx context.Context, organizationID int64, volumeID string) error {
	return fmt.Errorf("HardDeleteVolume not supported on SQLite backend")
}

func (r *volumesRepoSQLite) UpsertVolume(ctx context.Context, organizationID int64, params models.CreateVolumeParams) (*models.Volume, error) {
	// SQLite doesn't have UpsertVolume query - would need to be implemented
	// For now, try to create and if it fails, update
	volume, err := r.CreateVolume(ctx, organizationID, params)
	if err != nil {
		// If create failed, try update
		updateParams := models.UpdateVolumeParams{
			VolumeID:   params.VolumeID,
			Name:       params.Name,
			Mountpoint: params.Mountpoint,
			IsActive:   params.IsActive,
		}
		return r.UpdateVolume(ctx, organizationID, updateParams)
	}
	return volume, nil
}

func (r *volumesRepoSQLite) GetVolumeStats(ctx context.Context, organizationID int64, volumeID string) (*models.VolumeStats, error) {
	totalVolumes, err := r.queries.CountVolumes(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to count total volumes: %w", err)
	}

	// Get active volumes count
	activeVolumes, err := r.queries.CountActiveVolumes(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to count active volumes: %w", err)
	}

	return &models.VolumeStats{
		TotalVolumes:   totalVolumes,
		ActiveVolumes:  activeVolumes,
		UniqueDrivers:  0,   // TODO: Count distinct drivers when schema includes driver field
		ScannedVolumes: 0,   // TODO: Count volumes with last_scan_at not null
		NewestVolume:   nil, // TODO: Get MAX(created_at) when needed
		OldestVolume:   nil, // TODO: Get MIN(created_at) when needed
	}, nil
}

func (r *volumesRepoSQLite) CountVolumes(ctx context.Context, organizationID int64) (int64, error) {
	count, err := r.queries.CountVolumes(ctx)
	if err != nil {
		return 0, fmt.Errorf("failed to count volumes: %w", err)
	}
	return count, nil
}

// Container operations - not implemented for SQLite either
func (r *volumesRepoSQLite) CreateContainer(ctx context.Context, params models.CreateContainerParams) (*models.Container, error) {
	return nil, fmt.Errorf("CreateContainer not implemented for SQLite - requires proper container schema")
}

func (r *volumesRepoSQLite) GetContainerByContainerID(ctx context.Context, containerID string) (*models.Container, error) {
	// TODO: Implement SQLite version of GetContainerByContainerID
	// SQLite queries for container management need to be added to queries-sqlite/
	return nil, fmt.Errorf("GetContainerByContainerID not implemented for SQLite - SQLite container queries need to be created")
}

func (r *volumesRepoSQLite) UpsertContainer(ctx context.Context, params models.CreateContainerParams) (*models.Container, error) {
	// TODO: Implement SQLite version of UpsertContainer
	// SQLite queries for container management need to be added to queries-sqlite/
	return nil, fmt.Errorf("UpsertContainer not implemented for SQLite - SQLite container queries need to be created")
}

// Volume mount operations - not implemented for SQLite either
func (r *volumesRepoSQLite) CreateVolumeMount(ctx context.Context, params models.CreateVolumeMountParams) (*models.VolumeMount, error) {
	return nil, fmt.Errorf("CreateVolumeMount not implemented for SQLite - requires proper volume mount schema")
}

func (r *volumesRepoSQLite) UpsertVolumeMount(ctx context.Context, params models.CreateVolumeMountParams) (*models.VolumeMount, error) {
	sqlcParams := sqlcSQLite.UpsertVolumeMountParams{
		MountID:        params.VolumeID, // Use volume ID as mount ID
		MountType:      "volume",        // Default to volume type
		SourcePath:     params.MountPath,
		ContainerCount: 1, // Start with 1 container
	}

	result, err := r.queries.UpsertVolumeMount(ctx, sqlcParams)
	if err != nil {
		return nil, fmt.Errorf("failed to upsert volume mount: %w", err)
	}

	// Convert DockerMountCatalog to VolumeMount
	volumeMount := &models.VolumeMount{
		ID:          result.ID,
		VolumeID:    sqlNullStringToString(result.VolumeName), // Use volume name if available
		ContainerID: params.ContainerID,
		MountPath:   params.MountPath,
		AccessMode:  params.AccessMode,
		IsActive:    params.IsActive,
		CreatedAt:   result.CreatedAt,
		UpdatedAt:   result.UpdatedAt,
	}

	// Use mount ID as volume ID if volume name is not set
	if volumeMount.VolumeID == "" {
		volumeMount.VolumeID = result.MountID
	}

	return volumeMount, nil
}

func (r *volumesRepoSQLite) GetVolumeMountsByVolume(ctx context.Context, volumeID string) ([]*models.VolumeMount, error) {
	// Use SQL NullString for SQLite query parameter
	volumeParam := sql.NullString{String: volumeID, Valid: true}

	results, err := r.queries.GetVolumeMountsByVolume(ctx, volumeParam)
	if err != nil {
		return nil, fmt.Errorf("failed to get volume mounts by volume: %w", err)
	}

	// Convert DockerMountCatalog entries to VolumeMount domain models
	volumeMounts := make([]*models.VolumeMount, 0, len(results))
	for _, result := range results {
		volumeMount := &models.VolumeMount{
			ID:          result.ID,
			VolumeID:    sqlNullStringToString(result.VolumeName), // Use volume name if available
			ContainerID: "",                                       // This will need to be populated from container attachments
			MountPath:   result.SourcePath,
			AccessMode:  "rw",                  // Default access mode
			IsActive:    result.IsTracked == 1, // Convert SQLite integer to boolean
			CreatedAt:   result.CreatedAt,
			UpdatedAt:   result.UpdatedAt,
		}

		// Use mount ID as volume ID if volume name is not set
		if volumeMount.VolumeID == "" {
			volumeMount.VolumeID = result.MountID
		}

		volumeMounts = append(volumeMounts, volumeMount)
	}

	return volumeMounts, nil
}

// SQLite-specific helper functions
func (r *volumesRepoSQLite) convertSQLiteRowToVolume(row interface{}) (*models.Volume, error) {
	var volume *models.Volume

	switch v := row.(type) {
	case sqlcSQLite.Volumes:
		volume = &models.Volume{
			VolumeID:   v.VolumeID,
			Name:       sqlNullStringToString(v.DisplayName),
			Mountpoint: v.MountPoint,
			IsActive:   sqlNullIntToBool(v.IsActive),
			CreatedAt:  v.CreatedAt,
			UpdatedAt:  v.UpdatedAt,
		}

		// Handle optional timestamp (stored as string in SQLite)
		if v.LastScanAt.Valid {
			if t, err := time.Parse(time.RFC3339, v.LastScanAt.String); err == nil {
				volume.LastScanned = &t
			}
		}

	default:
		return nil, fmt.Errorf("unsupported SQLite row type: %T", row)
	}

	return volume, nil
}

// SQLite helper functions
func sqlNullStringToString(ns sql.NullString) string {
	if ns.Valid {
		return ns.String
	}
	return ""
}

func sqlNullIntToBool(ni sql.NullInt64) bool {
	return ni.Valid && ni.Int64 != 0
}

// =============================================================================
// VOLUME TRACKING OPERATIONS (PostgreSQL)
// =============================================================================

func (r *volumesRepo) SetVolumeTracked(ctx context.Context, organizationID int64, volumeID string) (*models.Volume, error) {
	result, err := r.queries.SetVolumeTracked(ctx, sqlc.SetVolumeTrackedParams{
		VolumeID:       volumeID,
		OrganizationID: pgtype.Int8{Int64: organizationID, Valid: true},
	})
	if err != nil {
		return nil, fmt.Errorf("failed to set volume tracked: %w", err)
	}

	return r.convertRowToVolume(result)
}

func (r *volumesRepo) SetVolumeUntracked(ctx context.Context, organizationID int64, volumeID string) (*models.Volume, error) {
	result, err := r.queries.SetVolumeUntracked(ctx, sqlc.SetVolumeUntrackedParams{
		VolumeID:       volumeID,
		OrganizationID: pgtype.Int8{Int64: organizationID, Valid: true},
	})
	if err != nil {
		return nil, fmt.Errorf("failed to set volume untracked: %w", err)
	}

	return r.convertRowToVolume(result)
}

func (r *volumesRepo) GetVolumeTrackingStatus(ctx context.Context, organizationID int64, volumeID string) (*models.VolumeTrackingStatus, error) {
	result, err := r.queries.GetVolumeTrackingStatus(ctx, sqlc.GetVolumeTrackingStatusParams{
		VolumeID:       volumeID,
		OrganizationID: pgtype.Int8{Int64: organizationID, Valid: true},
	})
	if err != nil {
		return nil, fmt.Errorf("failed to get volume tracking status: %w", err)
	}

	status := &models.VolumeTrackingStatus{
		VolumeID:  result.VolumeID,
		IsTracked: result.IsTracked,
	}

	if result.TrackedAt.Valid {
		status.TrackedAt = &result.TrackedAt.Time
	}
	if result.UntrackedAt.Valid {
		status.UntrackedAt = &result.UntrackedAt.Time
	}

	return status, nil
}

func (r *volumesRepo) ListTrackedVolumes(ctx context.Context, organizationID int64, limit, offset int32) ([]*models.Volume, error) {
	results, err := r.queries.ListTrackedVolumes(ctx, sqlc.ListTrackedVolumesParams{
		OrganizationID: pgtype.Int8{Int64: organizationID, Valid: true},
		Limit:          limit,
		Offset:         offset,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to list tracked volumes: %w", err)
	}

	volumes := make([]*models.Volume, len(results))
	for i, v := range results {
		vol, err := r.convertRowToVolume(v)
		if err != nil {
			return nil, fmt.Errorf("failed to convert volume %d: %w", i, err)
		}
		volumes[i] = vol
	}

	return volumes, nil
}

func (r *volumesRepo) ListUntrackedVolumes(ctx context.Context, organizationID int64, limit, offset int32) ([]*models.Volume, error) {
	results, err := r.queries.ListUntrackedVolumes(ctx, sqlc.ListUntrackedVolumesParams{
		OrganizationID: pgtype.Int8{Int64: organizationID, Valid: true},
		Limit:          limit,
		Offset:         offset,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to list untracked volumes: %w", err)
	}

	volumes := make([]*models.Volume, len(results))
	for i, v := range results {
		vol, err := r.convertRowToVolume(v)
		if err != nil {
			return nil, fmt.Errorf("failed to convert volume %d: %w", i, err)
		}
		volumes[i] = vol
	}

	return volumes, nil
}

func (r *volumesRepo) CountTrackedVolumes(ctx context.Context, organizationID int64) (int64, error) {
	count, err := r.queries.CountTrackedVolumes(ctx, pgtype.Int8{Int64: organizationID, Valid: true})
	if err != nil {
		return 0, fmt.Errorf("failed to count tracked volumes: %w", err)
	}

	return count, nil
}

func (r *volumesRepo) CountUntrackedVolumes(ctx context.Context, organizationID int64) (int64, error) {
	count, err := r.queries.CountUntrackedVolumes(ctx, pgtype.Int8{Int64: organizationID, Valid: true})
	if err != nil {
		return 0, fmt.Errorf("failed to count untracked volumes: %w", err)
	}

	return count, nil
}

// =============================================================================
// VOLUME TRACKING OPERATIONS (SQLite) - Stub implementations
// =============================================================================

func (r *volumesRepoSQLite) SetVolumeTracked(ctx context.Context, organizationID int64, volumeID string) (*models.Volume, error) {
	return nil, fmt.Errorf("tracking not yet implemented for SQLite")
}

func (r *volumesRepoSQLite) SetVolumeUntracked(ctx context.Context, organizationID int64, volumeID string) (*models.Volume, error) {
	return nil, fmt.Errorf("tracking not yet implemented for SQLite")
}

func (r *volumesRepoSQLite) GetVolumeTrackingStatus(ctx context.Context, organizationID int64, volumeID string) (*models.VolumeTrackingStatus, error) {
	return nil, fmt.Errorf("tracking not yet implemented for SQLite")
}

func (r *volumesRepoSQLite) ListTrackedVolumes(ctx context.Context, organizationID int64, limit, offset int32) ([]*models.Volume, error) {
	return nil, fmt.Errorf("tracking not yet implemented for SQLite")
}

func (r *volumesRepoSQLite) ListUntrackedVolumes(ctx context.Context, organizationID int64, limit, offset int32) ([]*models.Volume, error) {
	return nil, fmt.Errorf("tracking not yet implemented for SQLite")
}

func (r *volumesRepoSQLite) CountTrackedVolumes(ctx context.Context, organizationID int64) (int64, error) {
	return 0, fmt.Errorf("tracking not yet implemented for SQLite")
}

func (r *volumesRepoSQLite) CountUntrackedVolumes(ctx context.Context, organizationID int64) (int64, error) {
	return 0, fmt.Errorf("tracking not yet implemented for SQLite")
}
