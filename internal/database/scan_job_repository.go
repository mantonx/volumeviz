package database

import (
	"database/sql"
	"time"
)

// ScanJobRepository handles scan job-related database operations
type ScanJobRepository struct {
	*BaseRepository
}

// NewScanJobRepository creates a new scan job repository
func NewScanJobRepository(db *DB) *ScanJobRepository {
	return &ScanJobRepository{
		BaseRepository: NewBaseRepository(db),
	}
}

// WithTx returns a new scan job repository instance using the provided transaction
func (r *ScanJobRepository) WithTx(tx *Tx) *ScanJobRepository {
	return &ScanJobRepository{
		BaseRepository: r.BaseRepository.WithTx(tx),
	}
}

// Create inserts a new scan job
func (r *ScanJobRepository) Create(job *ScanJob) error {
	fields := StructToMap(job, "id", "created_at", "updated_at")
	query, args := BuildInsertQuery(TableNames.ScanJobs, fields)
	query += " RETURNING id, created_at, updated_at"

	executor := r.getExecutor()
	err := executor.QueryRow(query, args...).Scan(
		&job.ID,
		&job.CreatedAt,
		&job.UpdatedAt,
	)

	return err
}

// GetByID retrieves a scan job by its database ID
func (r *ScanJobRepository) GetByID(id int) (*ScanJob, error) {
	query := `
		SELECT id, scan_id, volume_id, status, progress, method, 
		       started_at, completed_at, error_message, result_id, 
		       estimated_duration, created_at, updated_at
		FROM scan_jobs 
		WHERE id = $1
	`

	executor := r.getExecutor()
	return r.scanScanJob(executor.QueryRow(query, id))
}

// GetByScanID retrieves a scan job by its scan_id
func (r *ScanJobRepository) GetByScanID(scanID string) (*ScanJob, error) {
	query := `
		SELECT id, scan_id, volume_id, status, progress, method, 
		       started_at, completed_at, error_message, result_id, 
		       estimated_duration, created_at, updated_at
		FROM scan_jobs 
		WHERE scan_id = $1
	`

	executor := r.getExecutor()
	return r.scanScanJob(executor.QueryRow(query, scanID))
}

// GetByVolumeID retrieves the latest scan job for a volume
func (r *ScanJobRepository) GetByVolumeID(volumeID string) (*ScanJob, error) {
	query := `
		SELECT id, scan_id, volume_id, status, progress, method, 
		       started_at, completed_at, error_message, result_id, 
		       estimated_duration, created_at, updated_at
		FROM scan_jobs 
		WHERE volume_id = $1
		ORDER BY created_at DESC
		LIMIT 1
	`

	executor := r.getExecutor()
	return r.scanScanJob(executor.QueryRow(query, volumeID))
}

// GetActiveJobs retrieves all currently active (queued or running) scan jobs
func (r *ScanJobRepository) GetActiveJobs() ([]*ScanJob, error) {
	query := `
		SELECT id, scan_id, volume_id, status, progress, method, 
		       started_at, completed_at, error_message, result_id, 
		       estimated_duration, created_at, updated_at
		FROM scan_jobs 
		WHERE status IN ('queued', 'running')
		ORDER BY created_at ASC
	`

	executor := r.getExecutor()
	rows, err := executor.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	return ScanRows(rows, r.scanScanJobRow)
}

// GetJobsByStatus retrieves scan jobs by status
func (r *ScanJobRepository) GetJobsByStatus(status string) ([]*ScanJob, error) {
	query := `
		SELECT id, scan_id, volume_id, status, progress, method, 
		       started_at, completed_at, error_message, result_id, 
		       estimated_duration, created_at, updated_at
		FROM scan_jobs 
		WHERE status = $1
		ORDER BY created_at DESC
	`

	executor := r.getExecutor()
	rows, err := executor.Query(query, status)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	return ScanRows(rows, r.scanScanJobRow)
}

// List retrieves scan jobs with optional filtering and pagination
func (r *ScanJobRepository) List(options *FilterOptions) (*PaginatedResult[ScanJob], error) {
	selectFields := []string{"id", "scan_id", "volume_id", "status", "progress", "method",
		"started_at", "completed_at", "error_message", "result_id",
		"estimated_duration", "created_at", "updated_at"}

	return ListWithPagination(
		r.getExecutor(),
		selectFields,
		TableNames.ScanJobs,
		options,
		r.scanScanJobRow,
		r.getScanJobCount,
	)
}

// UpdateStatus updates the status and progress of a scan job
func (r *ScanJobRepository) UpdateStatus(scanID string, status string, progress int) error {
	query := `
		UPDATE scan_jobs 
		SET status = $2, progress = $3, updated_at = CURRENT_TIMESTAMP
		WHERE scan_id = $1
	`

	executor := r.getExecutor()
	result, err := executor.Exec(query, scanID, status, progress)
	if err != nil {
		return err
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return err
	}

	if rowsAffected == 0 {
		return sql.ErrNoRows
	}

	return nil
}

// StartJob marks a scan job as started
func (r *ScanJobRepository) StartJob(scanID string) error {
	query := `
		UPDATE scan_jobs 
		SET status = 'running', started_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
		WHERE scan_id = $1 AND status = 'queued'
	`

	executor := r.getExecutor()
	result, err := executor.Exec(query, scanID)
	if err != nil {
		return err
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return err
	}

	if rowsAffected == 0 {
		return sql.ErrNoRows
	}

	return nil
}

// CompleteJob marks a scan job as completed with optional result
func (r *ScanJobRepository) CompleteJob(scanID string, resultID *int, errorMessage *string) error {
	var query string
	var args []interface{}

	if errorMessage != nil {
		// Job failed
		query = `
			UPDATE scan_jobs 
			SET status = 'failed', 
			    completed_at = CURRENT_TIMESTAMP, 
			    error_message = $2,
			    progress = 0,
			    updated_at = CURRENT_TIMESTAMP
			WHERE scan_id = $1
		`
		args = []interface{}{scanID, *errorMessage}
	} else {
		// Job completed successfully
		query = `
			UPDATE scan_jobs 
			SET status = 'completed', 
			    completed_at = CURRENT_TIMESTAMP, 
			    result_id = $2,
			    progress = 100,
			    updated_at = CURRENT_TIMESTAMP
			WHERE scan_id = $1
		`
		args = []interface{}{scanID, resultID}
	}

	executor := r.getExecutor()
	result, err := executor.Exec(query, args...)
	if err != nil {
		return err
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return err
	}

	if rowsAffected == 0 {
		return sql.ErrNoRows
	}

	return nil
}

// CancelJob marks a scan job as canceled
func (r *ScanJobRepository) CancelJob(scanID string) error {
	query := `
		UPDATE scan_jobs 
		SET status = 'canceled', 
		    completed_at = CURRENT_TIMESTAMP,
		    updated_at = CURRENT_TIMESTAMP
		WHERE scan_id = $1 AND status IN ('queued', 'running')
	`

	executor := r.getExecutor()
	result, err := executor.Exec(query, scanID)
	if err != nil {
		return err
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return err
	}

	if rowsAffected == 0 {
		return sql.ErrNoRows
	}

	return nil
}

// CleanupOldJobs removes completed/failed jobs older than the specified duration
func (r *ScanJobRepository) CleanupOldJobs(olderThan time.Duration) (int, error) {
	cutoffTime := time.Now().Add(-olderThan)

	query := `
		DELETE FROM scan_jobs 
		WHERE status IN ('completed', 'failed', 'canceled') 
		  AND completed_at < $1
	`

	executor := r.getExecutor()
	result, err := executor.Exec(query, cutoffTime)
	if err != nil {
		return 0, err
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return 0, err
	}

	return int(rowsAffected), nil
}

// GetJobStats returns scan job statistics
func (r *ScanJobRepository) GetJobStats() (*ScanJobStats, error) {
	query := `
		SELECT 
			COUNT(*) as total_jobs,
			COUNT(*) FILTER (WHERE status = 'queued') as queued_jobs,
			COUNT(*) FILTER (WHERE status = 'running') as running_jobs,
			COUNT(*) FILTER (WHERE status = 'completed') as completed_jobs,
			COUNT(*) FILTER (WHERE status = 'failed') as failed_jobs,
			COUNT(*) FILTER (WHERE status = 'canceled') as canceled_jobs,
			AVG(EXTRACT(EPOCH FROM (completed_at - started_at))) FILTER (WHERE status = 'completed' AND started_at IS NOT NULL AND completed_at IS NOT NULL) as avg_duration_seconds
		FROM scan_jobs
		WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
	`

	executor := r.getExecutor()
	stats := &ScanJobStats{}
	var avgDuration sql.NullFloat64

	err := executor.QueryRow(query).Scan(
		&stats.TotalJobs,
		&stats.QueuedJobs,
		&stats.RunningJobs,
		&stats.CompletedJobs,
		&stats.FailedJobs,
		&stats.CancelledJobs,
		&avgDuration,
	)

	if err != nil {
		return nil, err
	}

	if avgDuration.Valid {
		duration := time.Duration(avgDuration.Float64 * float64(time.Second))
		stats.AvgDuration = &duration
	}

	return stats, nil
}

// scanScanJob scans a single scan job from a row
// scanJobScanner contains unified scanning functions for ScanJob entities
var scanJobScanner = UnifiedScanFunc[ScanJob](func(scanner RowScanner) (*ScanJob, error) {
	job := &ScanJob{}
	var startedAt, completedAt sql.NullTime
	var errorMessage sql.NullString
	var resultID sql.NullInt32
	var estimatedDuration sql.NullInt64

	err := scanner.Scan(
		&job.ID,
		&job.ScanID,
		&job.VolumeID,
		&job.Status,
		&job.Progress,
		&job.Method,
		&startedAt,
		&completedAt,
		&errorMessage,
		&resultID,
		&estimatedDuration,
		&job.CreatedAt,
		&job.UpdatedAt,
	)

	if err != nil {
		return nil, err
	}

	if startedAt.Valid {
		job.StartedAt = &startedAt.Time
	}
	if completedAt.Valid {
		job.CompletedAt = &completedAt.Time
	}
	if errorMessage.Valid {
		job.ErrorMessage = &errorMessage.String
	}
	if resultID.Valid {
		id := int(resultID.Int32)
		job.ResultID = &id
	}
	if estimatedDuration.Valid {
		duration := time.Duration(estimatedDuration.Int64)
		job.EstimatedDuration = &duration
	}

	return job, nil
})

func (r *ScanJobRepository) scanScanJob(row *sql.Row) (*ScanJob, error) {
	return scanJobScanner.FromRow(row)
}

// scanScanJobRow scans a scan job from a rows result set
func (r *ScanJobRepository) scanScanJobRow(rows *sql.Rows) (*ScanJob, error) {
	return scanJobScanner.FromRows(rows)
}

// getScanJobCount returns the total count of scan jobs matching the filter
func (r *ScanJobRepository) getScanJobCount(options *FilterOptions) (int, error) {
	qb := NewQueryBuilder().
		Select("COUNT(*)").
		From(TableNames.ScanJobs)

	if options != nil {
		filterOptions := *options
		filterOptions.Limit = nil
		filterOptions.Offset = nil
		filterOptions.OrderBy = nil
		filterOptions.ApplyToQuery(qb, "")
	}

	query, args := qb.Build()

	executor := r.getExecutor()
	var count int
	err := executor.QueryRow(query, args...).Scan(&count)
	return count, err
}

// ScanJobStats represents scan job statistics
type ScanJobStats struct {
	TotalJobs     int            `json:"total_jobs"`
	QueuedJobs    int            `json:"queued_jobs"`
	RunningJobs   int            `json:"running_jobs"`
	CompletedJobs int            `json:"completed_jobs"`
	FailedJobs    int            `json:"failed_jobs"`
	CancelledJobs int            `json:"canceled_jobs"`
	AvgDuration   *time.Duration `json:"avg_duration,omitempty"`
}
