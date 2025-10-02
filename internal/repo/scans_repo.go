package repo

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgtype"
	"github.com/mantonx/volumeviz/internal/db/sqlc"
	sqlcSQLite "github.com/mantonx/volumeviz/internal/db/sqlc-sqlite"
	"github.com/mantonx/volumeviz/internal/models"
	"github.com/mantonx/volumeviz/internal/utils"
)

// ScansRepo handles scan job, file entry, and directory operations
// This repo accepts sqlc.Queries (injected by store) and returns domain models
type ScansRepo interface {
	// Scan job operations
	CreateScanJob(ctx context.Context, params models.CreateScanJobParams) (*models.ScanJob, error)
	GetScanJobByID(ctx context.Context, id int64) (*models.ScanJob, error)
	GetScanJobByScanID(ctx context.Context, scanID string) (*models.ScanJob, error)
	UpdateScanJobStatus(ctx context.Context, id int64, status string) error
	UpdateScanJobProgress(ctx context.Context, scanID string, progress int32) error
	CompletesScanJob(ctx context.Context, scanID string) error
	FailScanJob(ctx context.Context, scanID string, errorMessage string) error
	ListScanJobs(ctx context.Context, limit, offset int32) ([]*models.ScanJob, error)
	// Atomic claim and hardened worker operations
	ClaimNextScanJob(ctx context.Context, startedAt time.Time) (*models.ScanJob, error)
	UpdateScanJobHeartbeat(ctx context.Context, scanID string, progress int32) error
	MarkStaleScanJobsAsFailed(ctx context.Context, timeoutSeconds int) ([]string, error)
	MarkInFlightJobsAsFailed(ctx context.Context, reason string) ([]string, error)
	MarkInFlightJobsAsPaused(ctx context.Context, reason string) ([]string, error)

	// Metrics and monitoring
	GetQueueDepth(ctx context.Context) (int64, error)
	GetActiveScanCount(ctx context.Context) (int64, error)
	GetScanJobsByVolume(ctx context.Context, volumeID string, limit int32) ([]*models.ScanJob, error)
	HasActiveScanForVolume(ctx context.Context, volumeID string) (bool, error)
}

// scansRepo implements ScansRepo using sqlc generated queries
type scansRepo struct {
	queries *sqlc.Queries
}

// NewScansRepo creates a new scans repository
func NewScansRepo(queries *sqlc.Queries) ScansRepo {
	return &scansRepo{queries: queries}
}

// NewSQLiteScansRepo creates a new SQLite scans repository
func NewSQLiteScansRepo(queries *sqlcSQLite.Queries) ScansRepo {
	// TODO: Implement SQLite-specific version
	return &scansRepo{queries: nil}
}

// =============================================================================
// SCAN JOB OPERATIONS
// =============================================================================

func (r *scansRepo) CreateScanJob(ctx context.Context, params models.CreateScanJobParams) (*models.ScanJob, error) {
	var startedAt pgtype.Timestamptz
	if params.StartedAt != nil {
		startedAt = pgtype.Timestamptz{Time: *params.StartedAt, Valid: true}
	}

	volumeID := pgtype.Text{String: params.VolumeID, Valid: true}

	// For now, use the old CreateScanJob method until SQLC is regenerated
	// TODO: This ignores OrganizationID - needs SQLC regeneration to fix
	result, err := r.queries.CreateScanJob(ctx, sqlc.CreateScanJobParams{
		ScanID:    params.ScanID,
		VolumeID:  volumeID,
		Status:    params.Status,
		StartedAt: startedAt,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to create scan job: %w", err)
	}

	// Convert to domain model
	scanJob := &models.ScanJob{
		ScanID:    result.ScanID,
		VolumeID:  params.VolumeID,
		Status:    params.Status,
		Method:    params.Method,
		CreatedAt: result.CreatedAt,
		UpdatedAt: result.UpdatedAt,
	}

	if params.Progress != nil {
		scanJob.Progress = params.Progress
	}
	if params.StartedAt != nil {
		scanJob.StartedAt = params.StartedAt
	}
	if params.CompletedAt != nil {
		scanJob.CompletedAt = params.CompletedAt
	}
	if params.ErrorMessage != nil {
		scanJob.ErrorMessage = params.ErrorMessage
	}
	if params.ResultID != nil {
		scanJob.ResultID = params.ResultID
	}
	if params.EstimatedDuration != nil {
		scanJob.EstimatedDuration = params.EstimatedDuration
	}

	return scanJob, nil
}

func (r *scansRepo) GetScanJobByID(ctx context.Context, id int64) (*models.ScanJob, error) {
	// Note: The database uses scan_id as primary key, not an auto-increment ID
	// This method is not directly supported by the current schema
	return nil, fmt.Errorf("GetScanJobByID not supported - scan_jobs table uses scan_id as primary key, use GetScanJobByScanID instead")
}

func (r *scansRepo) GetScanJobByScanID(ctx context.Context, scanID string) (*models.ScanJob, error) {
	result, err := r.queries.GetScanJobByScanID(ctx, scanID)
	if err != nil {
		return nil, err
	}

	return r.convertScanJobToModel(result), nil
}

func (r *scansRepo) UpdateScanJobStatus(ctx context.Context, id int64, status string) error {
	// Note: UpdateScanJobStatus uses scan_id, not id, and different parameters
	// This method signature needs to be updated to use scanID string instead of id int64
	return fmt.Errorf("UpdateScanJobStatus method signature needs updating - use scanID string instead of id int64")
}

func (r *scansRepo) UpdateScanJobProgress(ctx context.Context, scanID string, progress int32) error {
	// UpdateScanJobProgress uses scanned_files and scanned_bytes, not progress
	// For now, we'll update scanned_files to represent progress
	return r.queries.UpdateScanJobProgress(ctx, sqlc.UpdateScanJobProgressParams{
		ScanID:       scanID,
		ScannedFiles: pgtype.Int8{Int64: int64(progress), Valid: true},
		ScannedBytes: pgtype.Int8{Int64: 0, Valid: true}, // Default to 0 bytes
	})
}

func (r *scansRepo) CompletesScanJob(ctx context.Context, scanID string) error {
	// CompleteScanJob only takes scanID parameter
	return r.queries.CompleteScanJob(ctx, scanID)
}

func (r *scansRepo) FailScanJob(ctx context.Context, scanID string, errorMessage string) error {
	// FailScanJob takes FailScanJobParams with ScanID and ErrorMessage
	return r.queries.FailScanJob(ctx, sqlc.FailScanJobParams{
		ScanID:       scanID,
		ErrorMessage: pgtype.Text{String: errorMessage, Valid: true},
	})
}

func (r *scansRepo) ListScanJobs(ctx context.Context, limit, offset int32) ([]*models.ScanJob, error) {
	results, err := r.queries.ListScanJobs(ctx, sqlc.ListScanJobsParams{
		Limit:  limit,
		Offset: offset,
	})
	if err != nil {
		return nil, err
	}

	jobs := make([]*models.ScanJob, 0, len(results))
	for _, result := range results {
		jobs = append(jobs, r.convertScanJobToModel(result))
	}

	return jobs, nil
}

// =============================================================================
// ATOMIC CLAIM AND HARDENED WORKER OPERATIONS
// =============================================================================

func (r *scansRepo) ClaimNextScanJob(ctx context.Context, startedAt time.Time) (*models.ScanJob, error) {
	row, err := r.queries.ClaimNextScanJob(ctx, pgtype.Timestamptz{Time: startedAt, Valid: true})
	if err != nil {
		return nil, err
	}

	return r.convertScanJobToModel(row), nil
}

func (r *scansRepo) UpdateScanJobHeartbeat(ctx context.Context, scanID string, progress int32) error {
	return r.queries.UpdateScanJobHeartbeat(ctx, scanID)
}

func (r *scansRepo) MarkStaleScanJobsAsFailed(ctx context.Context, timeoutSeconds int) ([]string, error) {
	scanIDs, err := r.queries.MarkStaleScanJobsAsFailed(ctx, int32(timeoutSeconds))
	if err != nil {
		return nil, err
	}
	return scanIDs, nil
}

func (r *scansRepo) MarkInFlightJobsAsFailed(ctx context.Context, reason string) ([]string, error) {
	scanIDs, err := r.queries.MarkInFlightJobsAsFailed(ctx, pgtype.Text{String: reason, Valid: true})
	if err != nil {
		return nil, err
	}
	return scanIDs, nil
}

func (r *scansRepo) MarkInFlightJobsAsPaused(ctx context.Context, reason string) ([]string, error) {
	scanIDs, err := r.queries.MarkInFlightJobsAsPaused(ctx, pgtype.Text{String: reason, Valid: true})
	if err != nil {
		return nil, err
	}
	return scanIDs, nil
}

// =============================================================================
// METRICS AND MONITORING OPERATIONS
// =============================================================================

func (r *scansRepo) GetQueueDepth(ctx context.Context) (int64, error) {
	// Use the available CountScanJobsByStatus to count queued jobs
	return r.queries.CountScanJobsByStatus(ctx, "queued")
}

func (r *scansRepo) GetActiveScanCount(ctx context.Context) (int64, error) {
	// Use the available CountScanJobsByStatus to count running jobs
	return r.queries.CountScanJobsByStatus(ctx, "running")
}

func (r *scansRepo) GetScanJobsByVolume(ctx context.Context, volumeID string, limit int32) ([]*models.ScanJob, error) {
	// Use the available ListScanJobsByVolume
	results, err := r.queries.ListScanJobsByVolume(ctx, sqlc.ListScanJobsByVolumeParams{
		VolumeID: pgtype.Text{String: volumeID, Valid: true},
		Limit:    limit,
		Offset:   0,
	})
	if err != nil {
		return nil, err
	}

	jobs := make([]*models.ScanJob, 0, len(results))
	for _, result := range results {
		jobs = append(jobs, r.convertScanJobToModel(result))
	}

	return jobs, nil
}

func (r *scansRepo) HasActiveScanForVolume(ctx context.Context, volumeID string) (bool, error) {
	// Check if there are any running or queued scans for this volume using available queries
	runningJobs, err := r.queries.ListScanJobsByVolume(ctx, sqlc.ListScanJobsByVolumeParams{
		VolumeID: pgtype.Text{String: volumeID, Valid: true},
		Limit:    1,
		Offset:   0,
	})
	if err != nil {
		return false, err
	}
	
	// Check if any jobs are active
	for _, job := range runningJobs {
		if job.Status == "running" || job.Status == "queued" {
			return true, nil
		}
	}
	return false, nil
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

func (r *scansRepo) convertScanJobToModel(job sqlc.ScanJobs) *models.ScanJob {
	result := &models.ScanJob{
		ScanID:    job.ScanID,
		VolumeID:  "", // Convert pgtype.Text to string
		Status:    job.Status,
		CreatedAt: job.CreatedAt,
		UpdatedAt: job.UpdatedAt,
		// Note: Domain model has different fields than database model
		// Some fields like ID, Method, Progress, etc. don't exist in database
	}

	// Convert pgtype.Text to string
	if job.VolumeID.Valid {
		result.VolumeID = job.VolumeID.String
	}

	// Map available fields from database to domain model
	if job.StartedAt.Valid {
		result.StartedAt = utils.Ptr(job.StartedAt.Time)
	}
	if job.CompletedAt.Valid {
		result.CompletedAt = utils.Ptr(job.CompletedAt.Time)
	}
	if job.ErrorMessage.Valid {
		result.ErrorMessage = utils.Ptr(job.ErrorMessage.String)
	}

	// Map scanned files to scan progress as an approximation
	if job.ScannedFiles.Valid {
		result.FilesScanned = job.ScannedFiles.Int64
	}
	if job.ScannedBytes.Valid {
		result.SizeScanned = job.ScannedBytes.Int64
	}

	return result
}
