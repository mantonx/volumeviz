package repo

import (
	"context"
	"time"

	"github.com/jackc/pgx/v5/pgtype"
	"github.com/mantonx/volumeviz/internal/db/sqlc"
	"github.com/mantonx/volumeviz/internal/models"
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
	ListScanJobs(ctx context.Context, limit, offset int32) ([]*models.ScanJob, error)
	// Additional operations that would be available if queries existed
	// ListScanJobsByVolume(ctx context.Context, volumeID string) ([]*models.ScanJob, error)
}

// scansRepo implements ScansRepo using sqlc generated queries
type scansRepo struct {
	queries *sqlc.Queries
}

// NewScansRepo creates a new scans repository
func NewScansRepo(queries *sqlc.Queries) ScansRepo {
	return &scansRepo{queries: queries}
}

// =============================================================================
// SCAN JOB OPERATIONS
// =============================================================================

func (r *scansRepo) CreateScanJob(ctx context.Context, params models.CreateScanJobParams) (*models.ScanJob, error) {
	var progress pgtype.Int4
	if params.Progress != nil {
		progress = pgtype.Int4{Int32: *params.Progress, Valid: true}
	}

	var startedAt, completedAt pgtype.Timestamp
	if params.StartedAt != nil {
		startedAt = pgtype.Timestamp{Time: *params.StartedAt, Valid: true}
	}
	if params.CompletedAt != nil {
		completedAt = pgtype.Timestamp{Time: *params.CompletedAt, Valid: true}
	}

	var errorMessage pgtype.Text
	if params.ErrorMessage != nil {
		errorMessage = pgtype.Text{String: *params.ErrorMessage, Valid: true}
	}

	var resultID, estimatedDuration pgtype.Int8
	if params.ResultID != nil {
		resultID = pgtype.Int8{Int64: *params.ResultID, Valid: true}
	}
	if params.EstimatedDuration != nil {
		estimatedDuration = pgtype.Int8{Int64: *params.EstimatedDuration, Valid: true}
	}

	result, err := r.queries.CreateScanJob(ctx, sqlc.CreateScanJobParams{
		ScanID:            params.ScanID,
		VolumeID:          params.VolumeID,
		Status:            params.Status,
		Progress:          progress,
		Method:            params.Method,
		StartedAt:         startedAt,
		CompletedAt:       completedAt,
		ErrorMessage:      errorMessage,
		ResultID:          resultID,
		EstimatedDuration: estimatedDuration,
	})
	if err != nil {
		return nil, err
	}

	// Construct the full model from params and result
	scanJob := &models.ScanJob{
		ID:        result.ID,
		ScanID:    params.ScanID,
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
	result, err := r.queries.GetScanJobByID(ctx, id)
	if err != nil {
		return nil, err
	}

	return r.convertScanJobToModel(result), nil
}

func (r *scansRepo) GetScanJobByScanID(ctx context.Context, scanID string) (*models.ScanJob, error) {
	result, err := r.queries.GetScanJobByScanID(ctx, scanID)
	if err != nil {
		return nil, err
	}

	return r.convertScanJobToModel(result), nil
}

func (r *scansRepo) UpdateScanJobStatus(ctx context.Context, id int64, status string) error {
	_, err := r.queries.UpdateScanJobStatus(ctx, sqlc.UpdateScanJobStatusParams{
		ID:       id,
		Status:   status,
		Progress: pgtype.Int4{}, // Optional progress field
		ErrorMessage: pgtype.Text{}, // Optional error message field
	})
	return err
}

func (r *scansRepo) UpdateScanJobProgress(ctx context.Context, scanID string, progress int32) error {
	return r.queries.UpdateScanJobProgress(ctx, sqlc.UpdateScanJobProgressParams{
		ScanID:   scanID,
		Progress: pgtype.Int4{Int32: progress, Valid: true},
	})
}

func (r *scansRepo) CompletesScanJob(ctx context.Context, scanID string) error {
	_, err := r.queries.CompleteScanJob(ctx, sqlc.CompleteScanJobParams{
		ScanID:      scanID,
		Status:      "completed",
		CompletedAt: pgtype.Timestamp{Time: time.Now(), Valid: true},
		ResultID:    pgtype.Int8{}, // Optional result ID
	})
	return err
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
// HELPER FUNCTIONS
// =============================================================================

func (r *scansRepo) convertScanJobToModel(job sqlc.ScanJobs) *models.ScanJob {
	result := &models.ScanJob{
		ID:        job.ID,
		ScanID:    job.ScanID,
		VolumeID:  job.VolumeID,
		Status:    job.Status,
		Method:    job.Method,
		CreatedAt: job.CreatedAt,
		UpdatedAt: job.UpdatedAt,
	}

	if job.Progress.Valid {
		result.Progress = &job.Progress.Int32
	}
	if job.StartedAt.Valid {
		result.StartedAt = &job.StartedAt.Time
	}
	if job.CompletedAt.Valid {
		result.CompletedAt = &job.CompletedAt.Time
	}
	if job.ErrorMessage.Valid {
		result.ErrorMessage = &job.ErrorMessage.String
	}
	if job.ResultID.Valid {
		result.ResultID = &job.ResultID.Int64
	}
	if job.EstimatedDuration.Valid {
		result.EstimatedDuration = &job.EstimatedDuration.Int64
	}

	return result
}

