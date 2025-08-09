package scheduler

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	"github.com/mantonx/volumeviz/internal/database"
)

// Repository implements the ScanRepository interface using SQL database
type Repository struct {
	db *database.DB
}

// NewRepository creates a new scan repository
func NewRepository(db *database.DB) *Repository {
	return &Repository{
		db: db,
	}
}

// Volume stats operations

// InsertVolumeStats inserts a new volume statistics record
func (r *Repository) InsertVolumeStats(ctx context.Context, stats *database.VolumeScanStats) error {
	query := `
		INSERT INTO volume_stats (volume_name, size_bytes, file_count, scan_method, duration_ms, ts, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`
	
	now := time.Now()
	_, err := r.db.ExecContext(ctx, query,
		stats.VolumeName,
		stats.SizeBytes,
		stats.FileCount,
		stats.ScanMethod,
		stats.DurationMs,
		stats.Timestamp,
		now,
		now,
	)
	
	if err != nil {
		return fmt.Errorf("failed to insert volume stats: %w", err)
	}
	
	return nil
}

// GetVolumeStatsByName retrieves volume statistics for a specific volume
func (r *Repository) GetVolumeStatsByName(ctx context.Context, volumeName string, limit int) ([]*database.VolumeScanStats, error) {
	query := `
		SELECT id, volume_name, size_bytes, file_count, scan_method, duration_ms, ts, created_at, updated_at
		FROM volume_stats 
		WHERE volume_name = $1 
		ORDER BY ts DESC 
		LIMIT $2`
	
	rows, err := r.db.QueryContext(ctx, query, volumeName, limit)
	if err != nil {
		return nil, fmt.Errorf("failed to query volume stats: %w", err)
	}
	defer rows.Close()
	
	var stats []*database.VolumeScanStats
	for rows.Next() {
		stat := &database.VolumeScanStats{}
		err := rows.Scan(
			&stat.ID,
			&stat.VolumeName,
			&stat.SizeBytes,
			&stat.FileCount,
			&stat.ScanMethod,
			&stat.DurationMs,
			&stat.Timestamp,
			&stat.CreatedAt,
			&stat.UpdatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan volume stats row: %w", err)
		}
		stats = append(stats, stat)
	}
	
	return stats, rows.Err()
}

// GetLatestVolumeStats retrieves the latest volume statistics for a specific volume
func (r *Repository) GetLatestVolumeStats(ctx context.Context, volumeName string) (*database.VolumeScanStats, error) {
	stats, err := r.GetVolumeStatsByName(ctx, volumeName, 1)
	if err != nil {
		return nil, err
	}
	
	if len(stats) == 0 {
		return nil, nil
	}
	
	return stats[0], nil
}

// Scan runs operations

// InsertScanRun inserts a new scan run record
func (r *Repository) InsertScanRun(ctx context.Context, run *database.ScanJob) error {
	query := `
		INSERT INTO scan_runs (scan_id, volume_id, status, progress, method, started_at, completed_at, error_message, result_id, estimated_duration, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`
	
	now := time.Now()
	_, err := r.db.ExecContext(ctx, query,
		run.ScanID,
		run.VolumeID,
		run.Status,
		run.Progress,
		run.Method,
		run.StartedAt,
		run.CompletedAt,
		run.ErrorMessage,
		run.ResultID,
		run.EstimatedDuration,
		now,
		now,
	)
	
	if err != nil {
		return fmt.Errorf("failed to insert scan run: %w", err)
	}
	
	return nil
}

// UpdateScanRun updates an existing scan run record
func (r *Repository) UpdateScanRun(ctx context.Context, run *database.ScanJob) error {
	query := `
		UPDATE scan_runs 
		SET status = $2, progress = $3, completed_at = $4, error_message = $5, result_id = $6, updated_at = $7
		WHERE scan_id = $1`
	
	now := time.Now()
	result, err := r.db.ExecContext(ctx, query,
		run.ScanID,
		run.Status,
		run.Progress,
		run.CompletedAt,
		run.ErrorMessage,
		run.ResultID,
		now,
	)
	
	if err != nil {
		return fmt.Errorf("failed to update scan run: %w", err)
	}
	
	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("failed to get rows affected: %w", err)
	}
	
	if rowsAffected == 0 {
		return fmt.Errorf("scan run not found: %s", run.ScanID)
	}
	
	return nil
}

// GetScanRunByID retrieves a scan run by its ID
func (r *Repository) GetScanRunByID(ctx context.Context, scanID string) (*database.ScanJob, error) {
	query := `
		SELECT id, scan_id, volume_id, status, progress, method, started_at, completed_at, error_message, result_id, estimated_duration, created_at, updated_at
		FROM scan_runs 
		WHERE scan_id = $1`
	
	row := r.db.QueryRowContext(ctx, query, scanID)
	
	run := &database.ScanJob{}
	err := row.Scan(
		&run.ID,
		&run.ScanID,
		&run.VolumeID,
		&run.Status,
		&run.Progress,
		&run.Method,
		&run.StartedAt,
		&run.CompletedAt,
		&run.ErrorMessage,
		&run.ResultID,
		&run.EstimatedDuration,
		&run.CreatedAt,
		&run.UpdatedAt,
	)
	
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get scan run: %w", err)
	}
	
	return run, nil
}

// GetActiveScanRuns retrieves all currently active scan runs
func (r *Repository) GetActiveScanRuns(ctx context.Context) ([]*database.ScanJob, error) {
	query := `
		SELECT id, scan_id, volume_id, status, progress, method, started_at, completed_at, error_message, result_id, estimated_duration, created_at, updated_at
		FROM scan_runs 
		WHERE status IN ('queued', 'running')
		ORDER BY created_at DESC`
	
	rows, err := r.db.QueryContext(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("failed to query active scan runs: %w", err)
	}
	defer rows.Close()
	
	var runs []*database.ScanJob
	for rows.Next() {
		run := &database.ScanJob{}
		err := rows.Scan(
			&run.ID,
			&run.ScanID,
			&run.VolumeID,
			&run.Status,
			&run.Progress,
			&run.Method,
			&run.StartedAt,
			&run.CompletedAt,
			&run.ErrorMessage,
			&run.ResultID,
			&run.EstimatedDuration,
			&run.CreatedAt,
			&run.UpdatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan scan run row: %w", err)
		}
		runs = append(runs, run)
	}
	
	return runs, rows.Err()
}

// Volume operations

// ListVolumes retrieves all volumes from the database
func (r *Repository) ListVolumes(ctx context.Context) ([]*database.Volume, error) {
	query := `
		SELECT id, volume_id, name, driver, mountpoint, labels, options, scope, status, last_scanned, is_active, created_at, updated_at
		FROM volumes 
		WHERE is_active = true
		ORDER BY name`
	
	rows, err := r.db.QueryContext(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("failed to query volumes: %w", err)
	}
	defer rows.Close()
	
	var volumes []*database.Volume
	for rows.Next() {
		volume := &database.Volume{}
		err := rows.Scan(
			&volume.ID,
			&volume.VolumeID,
			&volume.Name,
			&volume.Driver,
			&volume.Mountpoint,
			&volume.Labels,
			&volume.Options,
			&volume.Scope,
			&volume.Status,
			&volume.LastScanned,
			&volume.IsActive,
			&volume.CreatedAt,
			&volume.UpdatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan volume row: %w", err)
		}
		volumes = append(volumes, volume)
	}
	
	return volumes, rows.Err()
}

// UpsertVolume inserts or updates a volume record
func (r *Repository) UpsertVolume(ctx context.Context, volume *database.Volume) error {
	// First try to update
	updateQuery := `
		UPDATE volumes 
		SET name = $2, driver = $3, mountpoint = $4, labels = $5, options = $6, scope = $7, status = $8, last_scanned = $9, is_active = $10, updated_at = $11
		WHERE volume_id = $1`
	
	now := time.Now()
	result, err := r.db.ExecContext(ctx, updateQuery,
		volume.VolumeID,
		volume.Name,
		volume.Driver,
		volume.Mountpoint,
		volume.Labels,
		volume.Options,
		volume.Scope,
		volume.Status,
		volume.LastScanned,
		volume.IsActive,
		now,
	)
	
	if err != nil {
		return fmt.Errorf("failed to update volume: %w", err)
	}
	
	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("failed to get rows affected: %w", err)
	}
	
	if rowsAffected > 0 {
		return nil // Update successful
	}
	
	// If no rows affected, insert new record
	insertQuery := `
		INSERT INTO volumes (volume_id, name, driver, mountpoint, labels, options, scope, status, last_scanned, is_active, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`
	
	_, err = r.db.ExecContext(ctx, insertQuery,
		volume.VolumeID,
		volume.Name,
		volume.Driver,
		volume.Mountpoint,
		volume.Labels,
		volume.Options,
		volume.Scope,
		volume.Status,
		volume.LastScanned,
		volume.IsActive,
		now,
		now,
	)
	
	if err != nil {
		return fmt.Errorf("failed to insert volume: %w", err)
	}
	
	return nil
}

// VolumeProvider implementation

// VolumeProviderImpl implements the VolumeProvider interface
type VolumeProviderImpl struct {
	repository *Repository
}

// NewVolumeProvider creates a new volume provider
func NewVolumeProvider(repository *Repository) *VolumeProviderImpl {
	return &VolumeProviderImpl{
		repository: repository,
	}
}

// ListVolumes retrieves all volumes
func (vp *VolumeProviderImpl) ListVolumes(ctx context.Context) ([]*database.Volume, error) {
	return vp.repository.ListVolumes(ctx)
}

// GetVolume retrieves a specific volume by name
func (vp *VolumeProviderImpl) GetVolume(ctx context.Context, volumeName string) (*database.Volume, error) {
	query := `
		SELECT id, volume_id, name, driver, mountpoint, labels, options, scope, status, last_scanned, is_active, created_at, updated_at
		FROM volumes 
		WHERE name = $1`
	
	row := vp.repository.db.QueryRowContext(ctx, query, volumeName)
	
	volume := &database.Volume{}
	err := row.Scan(
		&volume.ID,
		&volume.VolumeID,
		&volume.Name,
		&volume.Driver,
		&volume.Mountpoint,
		&volume.Labels,
		&volume.Options,
		&volume.Scope,
		&volume.Status,
		&volume.LastScanned,
		&volume.IsActive,
		&volume.CreatedAt,
		&volume.UpdatedAt,
	)
	
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get volume: %w", err)
	}
	
	return volume, nil
}