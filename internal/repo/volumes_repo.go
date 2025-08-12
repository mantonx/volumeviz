package repo

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgtype"
	"github.com/mantonx/volumeviz/internal/db/sqlc"
	"github.com/mantonx/volumeviz/internal/models"
)

// VolumesRepo handles volume, container, and mount operations
// This repo accepts sqlc.Queries (injected by store) and returns domain models
type VolumesRepo interface {
	// Volume operations
	CreateVolume(ctx context.Context, params models.CreateVolumeParams) (*models.Volume, error)
	GetVolumeByID(ctx context.Context, id int64) (*models.Volume, error)
	GetVolumeByVolumeID(ctx context.Context, volumeID string) (*models.Volume, error)
	ListVolumes(ctx context.Context, limit, offset int32) ([]*models.Volume, error)
	UpdateVolume(ctx context.Context, params models.UpdateVolumeParams) (*time.Time, error)
	UpdateLastScanned(ctx context.Context, volumeID string, lastScanned time.Time) error
	SoftDeleteVolume(ctx context.Context, id int64) error
	UpsertVolume(ctx context.Context, params models.CreateVolumeParams) (*models.Volume, error)
	GetVolumeStats(ctx context.Context) (*models.VolumeStats, error)
	CountVolumes(ctx context.Context) (int64, error)

	// Container operations
	CreateContainer(ctx context.Context, params models.CreateContainerParams) (*models.Container, error)
	GetContainerByContainerID(ctx context.Context, containerID string) (*models.Container, error)
	UpsertContainer(ctx context.Context, params models.CreateContainerParams) (*models.Container, error)

	// Volume mount operations
	CreateVolumeMount(ctx context.Context, params models.CreateVolumeMountParams) (*models.VolumeMount, error)
	UpsertVolumeMount(ctx context.Context, params models.CreateVolumeMountParams) (*models.VolumeMount, error)
	GetVolumeMountsByVolume(ctx context.Context, volumeID string) ([]*models.VolumeMount, error)
}

// volumesRepo implements VolumesRepo using sqlc generated queries
type volumesRepo struct {
	queries *sqlc.Queries
}

// NewVolumesRepo creates a new volumes repository
func NewVolumesRepo(queries *sqlc.Queries) VolumesRepo {
	return &volumesRepo{queries: queries}
}

// =============================================================================
// VOLUME OPERATIONS
// =============================================================================

func (r *volumesRepo) CreateVolume(ctx context.Context, params models.CreateVolumeParams) (*models.Volume, error) {
	labels, _ := json.Marshal(params.Labels)
	options, _ := json.Marshal(params.Options)

	result, err := r.queries.CreateVolume(ctx, sqlc.CreateVolumeParams{
		VolumeID:   params.VolumeID,
		Name:       params.Name,
		Driver:     params.Driver,
		Mountpoint: params.Mountpoint,
		Labels:     pgtype.Text{String: string(labels), Valid: len(labels) > 0},
		Options:    pgtype.Text{String: string(options), Valid: len(options) > 0},
		Scope:      pgtype.Text{String: params.Scope, Valid: params.Scope != ""},
		Status:     pgtype.Text{String: params.Status, Valid: params.Status != ""},
		IsActive:   pgtype.Bool{Bool: params.IsActive, Valid: true},
	})
	if err != nil {
		return nil, fmt.Errorf("failed to create volume: %w", err)
	}

	return &models.Volume{
		ID:         result.ID,
		VolumeID:   params.VolumeID,
		Name:       params.Name,
		Driver:     params.Driver,
		Mountpoint: params.Mountpoint,
		Labels:     params.Labels,
		Options:    params.Options,
		Scope:      params.Scope,
		Status:     params.Status,
		IsActive:   params.IsActive,
		CreatedAt:  result.CreatedAt,
		UpdatedAt:  result.UpdatedAt,
	}, nil
}

func (r *volumesRepo) GetVolumeByID(ctx context.Context, id int64) (*models.Volume, error) {
	row, err := r.queries.GetVolumeByID(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("failed to get volume by ID: %w", err)
	}

	return r.convertRowToVolume(row)
}

func (r *volumesRepo) GetVolumeByVolumeID(ctx context.Context, volumeID string) (*models.Volume, error) {
	row, err := r.queries.GetVolumeByVolumeID(ctx, volumeID)
	if err != nil {
		return nil, fmt.Errorf("failed to get volume by volume ID: %w", err)
	}

	return r.convertRowToVolume(row)
}

func (r *volumesRepo) ListVolumes(ctx context.Context, limit, offset int32) ([]*models.Volume, error) {
	rows, err := r.queries.ListVolumes(ctx, sqlc.ListVolumesParams{
		Limit:  limit,
		Offset: offset,
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

func (r *volumesRepo) UpdateVolume(ctx context.Context, params models.UpdateVolumeParams) (*time.Time, error) {
	labels, _ := json.Marshal(params.Labels)
	options, _ := json.Marshal(params.Options)

	updatedAt, err := r.queries.UpdateVolume(ctx, sqlc.UpdateVolumeParams{
		ID:         params.ID,
		Name:       params.Name,
		Driver:     params.Driver,
		Mountpoint: params.Mountpoint,
		Labels:     pgtype.Text{String: string(labels), Valid: len(labels) > 0},
		Options:    pgtype.Text{String: string(options), Valid: len(options) > 0},
		Scope:      pgtype.Text{String: params.Scope, Valid: params.Scope != ""},
		Status:     pgtype.Text{String: params.Status, Valid: params.Status != ""},
		IsActive:   pgtype.Bool{Bool: params.IsActive, Valid: true},
	})
	if err != nil {
		return nil, fmt.Errorf("failed to update volume: %w", err)
	}

	return &updatedAt, nil
}

func (r *volumesRepo) UpdateLastScanned(ctx context.Context, volumeID string, lastScanned time.Time) error {
	err := r.queries.UpdateLastScanned(ctx, sqlc.UpdateLastScannedParams{
		VolumeID:    volumeID,
		LastScanned: pgtype.Timestamp{Time: lastScanned, Valid: true},
	})
	if err != nil {
		return fmt.Errorf("failed to update last scanned: %w", err)
	}
	return nil
}

func (r *volumesRepo) SoftDeleteVolume(ctx context.Context, id int64) error {
	err := r.queries.SoftDeleteVolume(ctx, id)
	if err != nil {
		return fmt.Errorf("failed to soft delete volume: %w", err)
	}
	return nil
}

func (r *volumesRepo) UpsertVolume(ctx context.Context, params models.CreateVolumeParams) (*models.Volume, error) {
	labels, _ := json.Marshal(params.Labels)
	options, _ := json.Marshal(params.Options)

	result, err := r.queries.UpsertVolume(ctx, sqlc.UpsertVolumeParams{
		VolumeID:   params.VolumeID,
		Name:       params.Name,
		Driver:     params.Driver,
		Mountpoint: params.Mountpoint,
		Labels:     pgtype.Text{String: string(labels), Valid: len(labels) > 0},
		Options:    pgtype.Text{String: string(options), Valid: len(options) > 0},
		Scope:      pgtype.Text{String: params.Scope, Valid: params.Scope != ""},
		Status:     pgtype.Text{String: params.Status, Valid: params.Status != ""},
		IsActive:   pgtype.Bool{Bool: params.IsActive, Valid: true},
	})
	if err != nil {
		return nil, fmt.Errorf("failed to upsert volume: %w", err)
	}

	return &models.Volume{
		ID:         result.ID,
		VolumeID:   params.VolumeID,
		Name:       params.Name,
		Driver:     params.Driver,
		Mountpoint: params.Mountpoint,
		Labels:     params.Labels,
		Options:    params.Options,
		Scope:      params.Scope,
		Status:     params.Status,
		IsActive:   params.IsActive,
		CreatedAt:  result.CreatedAt,
		UpdatedAt:  result.UpdatedAt,
	}, nil
}

func (r *volumesRepo) GetVolumeStats(ctx context.Context) (*models.VolumeStats, error) {
	stats, err := r.queries.GetVolumeStats(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to get volume stats: %w", err)
	}

	result := &models.VolumeStats{
		TotalVolumes:   stats.TotalVolumes,
		UniqueDrivers:  stats.UniqueDrivers,
	}

	// Handle interface{} types with type assertions
	if activeVols, ok := stats.ActiveVolumes.(int64); ok {
		result.ActiveVolumes = activeVols
	}
	if scannedVols, ok := stats.ScannedVolumes.(int64); ok {
		result.ScannedVolumes = scannedVols
	}

	// Handle timestamp interfaces
	if newest, ok := stats.NewestVolume.(time.Time); ok {
		result.NewestVolume = &newest
	}
	if oldest, ok := stats.OldestVolume.(time.Time); ok {
		result.OldestVolume = &oldest
	}

	return result, nil
}

func (r *volumesRepo) CountVolumes(ctx context.Context) (int64, error) {
	count, err := r.queries.CountVolumes(ctx)
	if err != nil {
		return 0, fmt.Errorf("failed to count volumes: %w", err)
	}
	return count, nil
}

// =============================================================================
// CONTAINER OPERATIONS
// =============================================================================

func (r *volumesRepo) CreateContainer(ctx context.Context, params models.CreateContainerParams) (*models.Container, error) {
	labels, _ := json.Marshal(params.Labels)

	var startedAt, finishedAt pgtype.Timestamp
	if params.StartedAt != nil {
		startedAt = pgtype.Timestamp{Time: *params.StartedAt, Valid: true}
	}
	if params.FinishedAt != nil {
		finishedAt = pgtype.Timestamp{Time: *params.FinishedAt, Valid: true}
	}

	result, err := r.queries.CreateContainer(ctx, sqlc.CreateContainerParams{
		ContainerID: params.ContainerID,
		Name:        params.Name,
		Image:       params.Image,
		State:       params.State,
		Status:      pgtype.Text{String: params.Status, Valid: params.Status != ""},
		Labels:      pgtype.Text{String: string(labels), Valid: len(labels) > 0},
		StartedAt:   startedAt,
		FinishedAt:  finishedAt,
		IsActive:    pgtype.Bool{Bool: params.IsActive, Valid: true},
	})
	if err != nil {
		return nil, fmt.Errorf("failed to create container: %w", err)
	}

	return &models.Container{
		ID:          result.ID,
		ContainerID: params.ContainerID,
		Name:        params.Name,
		Image:       params.Image,
		State:       params.State,
		Status:      params.Status,
		Labels:      params.Labels,
		StartedAt:   params.StartedAt,
		FinishedAt:  params.FinishedAt,
		IsActive:    params.IsActive,
		CreatedAt:   result.CreatedAt,
		UpdatedAt:   result.UpdatedAt,
	}, nil
}

func (r *volumesRepo) GetContainerByContainerID(ctx context.Context, containerID string) (*models.Container, error) {
	row, err := r.queries.GetContainerByContainerID(ctx, containerID)
	if err != nil {
		return nil, fmt.Errorf("failed to get container by container ID: %w", err)
	}

	var labels map[string]string
	if row.Labels.Valid && len(row.Labels.String) > 0 {
		if err := json.Unmarshal([]byte(row.Labels.String), &labels); err != nil {
			return nil, fmt.Errorf("failed to unmarshal container labels: %w", err)
		}
	}

	container := &models.Container{
		ID:          row.ID,
		ContainerID: row.ContainerID,
		Name:        row.Name,
		Image:       row.Image,
		State:       row.State,
		Status:      row.Status.String,
		Labels:      labels,
		IsActive:    row.IsActive.Bool,
		CreatedAt:   row.CreatedAt,
		UpdatedAt:   row.UpdatedAt,
	}

	if row.StartedAt.Valid {
		container.StartedAt = &row.StartedAt.Time
	}
	if row.FinishedAt.Valid {
		container.FinishedAt = &row.FinishedAt.Time
	}

	return container, nil
}

func (r *volumesRepo) UpsertContainer(ctx context.Context, params models.CreateContainerParams) (*models.Container, error) {
	labels, _ := json.Marshal(params.Labels)

	var startedAt, finishedAt pgtype.Timestamp
	if params.StartedAt != nil {
		startedAt = pgtype.Timestamp{Time: *params.StartedAt, Valid: true}
	}
	if params.FinishedAt != nil {
		finishedAt = pgtype.Timestamp{Time: *params.FinishedAt, Valid: true}
	}

	result, err := r.queries.UpsertContainer(ctx, sqlc.UpsertContainerParams{
		ContainerID: params.ContainerID,
		Name:        params.Name,
		Image:       params.Image,
		State:       params.State,
		Status:      pgtype.Text{String: params.Status, Valid: params.Status != ""},
		Labels:      pgtype.Text{String: string(labels), Valid: len(labels) > 0},
		StartedAt:   startedAt,
		FinishedAt:  finishedAt,
		IsActive:    pgtype.Bool{Bool: params.IsActive, Valid: true},
	})
	if err != nil {
		return nil, fmt.Errorf("failed to upsert container: %w", err)
	}

	return &models.Container{
		ID:          result.ID,
		ContainerID: params.ContainerID,
		Name:        params.Name,
		Image:       params.Image,
		State:       params.State,
		Status:      params.Status,
		Labels:      params.Labels,
		StartedAt:   params.StartedAt,
		FinishedAt:  params.FinishedAt,
		IsActive:    params.IsActive,
		CreatedAt:   result.CreatedAt,
		UpdatedAt:   result.UpdatedAt,
	}, nil
}

// =============================================================================
// VOLUME MOUNT OPERATIONS
// =============================================================================

func (r *volumesRepo) CreateVolumeMount(ctx context.Context, params models.CreateVolumeMountParams) (*models.VolumeMount, error) {
	result, err := r.queries.CreateVolumeMount(ctx, sqlc.CreateVolumeMountParams{
		VolumeID:    params.VolumeID,
		ContainerID: params.ContainerID,
		MountPath:   params.MountPath,
		AccessMode:  params.AccessMode,
		IsActive:    pgtype.Bool{Bool: params.IsActive, Valid: true},
	})
	if err != nil {
		return nil, fmt.Errorf("failed to create volume mount: %w", err)
	}

	return &models.VolumeMount{
		ID:          result.ID,
		VolumeID:    params.VolumeID,
		ContainerID: params.ContainerID,
		MountPath:   params.MountPath,
		AccessMode:  params.AccessMode,
		IsActive:    params.IsActive,
		CreatedAt:   result.CreatedAt,
		UpdatedAt:   result.UpdatedAt,
	}, nil
}

func (r *volumesRepo) UpsertVolumeMount(ctx context.Context, params models.CreateVolumeMountParams) (*models.VolumeMount, error) {
	result, err := r.queries.UpsertVolumeMount(ctx, sqlc.UpsertVolumeMountParams{
		VolumeID:    params.VolumeID,
		ContainerID: params.ContainerID,
		MountPath:   params.MountPath,
		AccessMode:  params.AccessMode,
		IsActive:    pgtype.Bool{Bool: params.IsActive, Valid: true},
	})
	if err != nil {
		return nil, fmt.Errorf("failed to upsert volume mount: %w", err)
	}

	return &models.VolumeMount{
		ID:          result.ID,
		VolumeID:    params.VolumeID,
		ContainerID: params.ContainerID,
		MountPath:   params.MountPath,
		AccessMode:  params.AccessMode,
		IsActive:    params.IsActive,
		CreatedAt:   result.CreatedAt,
		UpdatedAt:   result.UpdatedAt,
	}, nil
}

func (r *volumesRepo) GetVolumeMountsByVolume(ctx context.Context, volumeID string) ([]*models.VolumeMount, error) {
	rows, err := r.queries.GetVolumeMountsByVolume(ctx, volumeID)
	if err != nil {
		return nil, fmt.Errorf("failed to get volume mounts by volume: %w", err)
	}

	mounts := make([]*models.VolumeMount, 0, len(rows))
	for _, row := range rows {
		mount := &models.VolumeMount{
			ID:          row.ID,
			VolumeID:    row.VolumeID,
			ContainerID: row.ContainerID,
			MountPath:   row.MountPath,
			AccessMode:  row.AccessMode,
			IsActive:    row.IsActive.Bool,
			CreatedAt:   row.CreatedAt,
			UpdatedAt:   row.UpdatedAt,
		}
		mounts = append(mounts, mount)
	}

	return mounts, nil
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
			ID:         v.ID,
			VolumeID:   v.VolumeID,
			Name:       v.Name,
			Driver:     v.Driver,
			Mountpoint: v.Mountpoint,
			Scope:      v.Scope.String,
			Status:     v.Status.String,
			IsActive:   v.IsActive.Bool,
			CreatedAt:  v.CreatedAt,
			UpdatedAt:  v.UpdatedAt,
		}

		// Handle optional timestamp
		if v.LastScanned.Valid {
			volume.LastScanned = &v.LastScanned.Time
		}

		// Parse JSON fields
		if v.Labels.Valid && len(v.Labels.String) > 0 {
			if err := json.Unmarshal([]byte(v.Labels.String), &volume.Labels); err != nil {
				return nil, fmt.Errorf("failed to unmarshal labels: %w", err)
			}
		}

		if v.Options.Valid && len(v.Options.String) > 0 {
			if err := json.Unmarshal([]byte(v.Options.String), &volume.Options); err != nil {
				return nil, fmt.Errorf("failed to unmarshal options: %w", err)
			}
		}

	default:
		return nil, fmt.Errorf("unsupported row type: %T", row)
	}

	return volume, nil
}