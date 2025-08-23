package repo

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/mantonx/volumeviz/internal/models"
)

// ScanProgressRepo handles detailed scan progress tracking
type ScanProgressRepo interface {
	// Scan phases operations
	CreateScanPhase(ctx context.Context, params models.CreateScanPhaseParams) (*models.ScanPhase, error)
	GetScanPhasesByID(ctx context.Context, scanID string) ([]*models.ScanPhase, error)
	GetScanPhase(ctx context.Context, scanID, phaseName string) (*models.ScanPhase, error)
	UpdateScanPhaseProgress(ctx context.Context, params models.UpdateScanPhaseParams) error
	CompleteScanPhase(ctx context.Context, scanID, phaseName string) error
	FailScanPhase(ctx context.Context, scanID, phaseName, errorMessage string) error

	// Progress items operations
	CreateProgressItem(ctx context.Context, params models.CreateProgressItemParams) (*models.ScanProgressItem, error)
	UpdateProgressItem(ctx context.Context, params models.UpdateProgressItemParams) error
	GetProgressItems(ctx context.Context, scanID, phaseName string, limit, offset int32) ([]*models.ScanProgressItem, error)
	GetFailedProgressItems(ctx context.Context, scanID, phaseName string, limit int32) ([]*models.ScanProgressItem, error)

	// Error tracking operations
	RecordScanError(ctx context.Context, params models.RecordScanErrorParams) (int64, error)
	GetScanErrors(ctx context.Context, scanID, phaseName string, limit, offset int32) ([]*models.ScanProgressError, error)
	GetRecentErrors(ctx context.Context, hours int, limit int32) ([]*models.ScanProgressError, error)

	// Performance metrics operations
	RecordPerformanceMetrics(ctx context.Context, params models.RecordPerformanceMetricsParams) error
	GetLatestPerformanceMetrics(ctx context.Context, scanID, phaseName string) (*models.ScanPerformanceMetrics, error)

	// Summary and overview operations
	GetActiveScansSummary(ctx context.Context) ([]*models.ActiveScanSummary, error)
	GetScanProgressSummary(ctx context.Context, scanID string) (*models.ScanProgressSummary, error)
	GetRecentErrorsSummary(ctx context.Context, hours int, limit int32) ([]*models.RecentErrorSummary, error)

	// Additional methods needed by API handlers
	GetScanPhases(ctx context.Context, scanID string) ([]models.ScanPhase, error)
	GetScanProgressItems(ctx context.Context, scanID string) ([]models.ScanProgressItem, error)
	GetScanErrorsFiltered(ctx context.Context, params models.ScanErrorFilterParams) ([]*models.ScanProgressError, error)
	GetScanErrorsCount(ctx context.Context, scanID, phaseFilter, errorTypeFilter string) (int64, error)
	GetActiveScans(ctx context.Context, limit, offset int) ([]models.ActiveScanSummary, error)
	GetActiveScansCount(ctx context.Context) (int64, error)
	GetRecentScanErrors(ctx context.Context, params models.RecentErrorsParams) ([]*models.ScanProgressError, error)
}

// scanProgressRepo implements ScanProgressRepo using pgx queries
type scanProgressRepo struct {
	pool *pgxpool.Pool
}

// NewScanProgressRepo creates a new scan progress repository
func NewScanProgressRepo(pool *pgxpool.Pool) ScanProgressRepo {
	return &scanProgressRepo{pool: pool}
}

// NewScanProgressRepoFromConn creates a scan progress repository from a single connection
// This is a placeholder for future transaction support
func NewScanProgressRepoFromConn(conn *pgx.Conn) ScanProgressRepo {
	// This is not implemented yet - for now return nil
	// TODO: Implement proper transaction support
	return nil
}

// =============================================================================
// SCAN PHASES OPERATIONS
// =============================================================================

func (r *scanProgressRepo) CreateScanPhase(ctx context.Context, params models.CreateScanPhaseParams) (*models.ScanPhase, error) {
	query := `
		INSERT INTO scan_phases (scan_id, phase_name, phase_order, status, items_total, 
			current_depth, metadata, started_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		RETURNING id, created_at, updated_at`

	var id int64
	var createdAt, updatedAt time.Time

	err := r.pool.QueryRow(ctx, query,
		params.ScanID,
		params.PhaseName,
		params.PhaseOrder,
		params.Status,
		params.ItemsTotal,
		params.CurrentDepth,
		params.Metadata,
		params.StartedAt,
	).Scan(&id, &createdAt, &updatedAt)

	if err != nil {
		return nil, err
	}

	return &models.ScanPhase{
		ID:           id,
		ScanID:       params.ScanID,
		PhaseName:    params.PhaseName,
		PhaseOrder:   params.PhaseOrder,
		Status:       params.Status,
		ItemsTotal:   params.ItemsTotal,
		CurrentDepth: params.CurrentDepth,
		Metadata:     params.Metadata,
		StartedAt:    params.StartedAt,
		CreatedAt:    createdAt,
		UpdatedAt:    updatedAt,
	}, nil
}

func (r *scanProgressRepo) GetScanPhasesByID(ctx context.Context, scanID string) ([]*models.ScanPhase, error) {
	query := `
		SELECT id, scan_id, phase_name, phase_order, status, progress, items_total,
			items_processed, items_successful, items_failed, items_skipped,
			bytes_total, bytes_processed, items_per_second, bytes_per_second,
			started_at, completed_at, estimated_completion_at, duration_ms,
			current_item, current_depth, error_message, error_count, last_error_at,
			metadata, created_at, updated_at
		FROM scan_phases 
		WHERE scan_id = $1 
		ORDER BY phase_order ASC`

	rows, err := r.pool.Query(ctx, query, scanID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var phases []*models.ScanPhase
	for rows.Next() {
		phase, err := r.scanPhaseFromRow(rows)
		if err != nil {
			return nil, err
		}
		phases = append(phases, phase)
	}

	return phases, rows.Err()
}

func (r *scanProgressRepo) GetScanPhase(ctx context.Context, scanID, phaseName string) (*models.ScanPhase, error) {
	query := `
		SELECT id, scan_id, phase_name, phase_order, status, progress, items_total,
			items_processed, items_successful, items_failed, items_skipped,
			bytes_total, bytes_processed, items_per_second, bytes_per_second,
			started_at, completed_at, estimated_completion_at, duration_ms,
			current_item, current_depth, error_message, error_count, last_error_at,
			metadata, created_at, updated_at
		FROM scan_phases 
		WHERE scan_id = $1 AND phase_name = $2`

	row := r.pool.QueryRow(ctx, query, scanID, phaseName)
	return r.scanPhaseFromRow(row)
}

func (r *scanProgressRepo) UpdateScanPhaseProgress(ctx context.Context, params models.UpdateScanPhaseParams) error {
	query := `
		UPDATE scan_phases SET
			status = COALESCE($3, status),
			progress = COALESCE($4, progress),
			items_processed = COALESCE($5, items_processed),
			items_total = COALESCE($6, items_total),
			items_successful = COALESCE($7, items_successful),
			items_failed = COALESCE($8, items_failed),
			current_item = COALESCE($9, current_item),
			items_per_second = COALESCE($10, items_per_second),
			bytes_per_second = COALESCE($11, bytes_per_second),
			estimated_completion_at = COALESCE($12, estimated_completion_at),
			updated_at = NOW()
		WHERE scan_id = $1 AND phase_name = $2`

	_, err := r.pool.Exec(ctx, query,
		params.ScanID,
		params.PhaseName,
		params.Status,
		params.Progress,
		params.ItemsProcessed,
		params.ItemsTotal,
		params.ItemsSuccessful,
		params.ItemsFailed,
		params.CurrentItem,
		params.ItemsPerSecond,
		params.BytesPerSecond,
		params.EstimatedCompletionAt,
	)

	return err
}

func (r *scanProgressRepo) CompleteScanPhase(ctx context.Context, scanID, phaseName string) error {
	query := `
		UPDATE scan_phases SET
			status = 'completed',
			progress = 100,
			completed_at = NOW(),
			duration_ms = EXTRACT(EPOCH FROM (NOW() - started_at)) * 1000,
			updated_at = NOW()
		WHERE scan_id = $1 AND phase_name = $2`

	_, err := r.pool.Exec(ctx, query, scanID, phaseName)
	return err
}

func (r *scanProgressRepo) FailScanPhase(ctx context.Context, scanID, phaseName, errorMessage string) error {
	query := `
		UPDATE scan_phases SET
			status = 'failed',
			error_message = $3,
			completed_at = NOW(),
			duration_ms = EXTRACT(EPOCH FROM (NOW() - started_at)) * 1000,
			updated_at = NOW()
		WHERE scan_id = $1 AND phase_name = $2`

	_, err := r.pool.Exec(ctx, query, scanID, phaseName, errorMessage)
	return err
}

// =============================================================================
// PROGRESS ITEMS OPERATIONS
// =============================================================================

func (r *scanProgressRepo) CreateProgressItem(ctx context.Context, params models.CreateProgressItemParams) (*models.ScanProgressItem, error) {
	query := `
		INSERT INTO scan_progress_items (scan_id, phase_name, item_type, item_path, 
			item_name, item_size, status, metadata, started_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		RETURNING id, created_at, updated_at`

	var id int64
	var createdAt, updatedAt time.Time

	err := r.pool.QueryRow(ctx, query,
		params.ScanID,
		params.PhaseName,
		params.ItemType,
		params.ItemPath,
		params.ItemName,
		params.ItemSize,
		params.Status,
		params.Metadata,
		params.StartedAt,
	).Scan(&id, &createdAt, &updatedAt)

	if err != nil {
		return nil, err
	}

	return &models.ScanProgressItem{
		ID:        id,
		ScanID:    params.ScanID,
		PhaseName: params.PhaseName,
		ItemType:  params.ItemType,
		ItemPath:  params.ItemPath,
		ItemName:  params.ItemName,
		ItemSize:  params.ItemSize,
		Status:    params.Status,
		Metadata:  params.Metadata,
		StartedAt: params.StartedAt,
		CreatedAt: createdAt,
		UpdatedAt: updatedAt,
	}, nil
}

func (r *scanProgressRepo) UpdateProgressItem(ctx context.Context, params models.UpdateProgressItemParams) error {
	query := `
		UPDATE scan_progress_items SET
			status = COALESCE($3, status),
			progress = COALESCE($4, progress),
			completed_at = COALESCE($5, completed_at),
			duration_ms = COALESCE($6, duration_ms),
			result_data = COALESCE($7, result_data),
			error_message = COALESCE($8, error_message),
			error_details = COALESCE($9, error_details),
			updated_at = NOW()
		WHERE scan_id = $1 AND item_path = $2`

	_, err := r.pool.Exec(ctx, query,
		params.ScanID,
		params.ItemPath,
		params.Status,
		params.Progress,
		params.CompletedAt,
		params.DurationMs,
		params.ResultData,
		params.ErrorMessage,
		params.ErrorDetails,
	)

	return err
}

func (r *scanProgressRepo) GetProgressItems(ctx context.Context, scanID, phaseName string, limit, offset int32) ([]*models.ScanProgressItem, error) {
	query := `
		SELECT id, scan_id, phase_name, item_type, item_path, item_name, item_size,
			status, progress, started_at, completed_at, duration_ms, result_data,
			error_message, error_details, metadata, created_at, updated_at
		FROM scan_progress_items 
		WHERE scan_id = $1 AND phase_name = $2
		ORDER BY created_at DESC 
		LIMIT $3 OFFSET $4`

	rows, err := r.pool.Query(ctx, query, scanID, phaseName, limit, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var items []*models.ScanProgressItem
	for rows.Next() {
		item, err := r.progressItemFromRow(rows)
		if err != nil {
			return nil, err
		}
		items = append(items, item)
	}

	return items, rows.Err()
}

func (r *scanProgressRepo) GetFailedProgressItems(ctx context.Context, scanID, phaseName string, limit int32) ([]*models.ScanProgressItem, error) {
	query := `
		SELECT id, scan_id, phase_name, item_type, item_path, item_name, item_size,
			status, progress, started_at, completed_at, duration_ms, result_data,
			error_message, error_details, metadata, created_at, updated_at
		FROM scan_progress_items 
		WHERE scan_id = $1 AND phase_name = $2 AND status = 'failed'
		ORDER BY created_at DESC 
		LIMIT $3`

	rows, err := r.pool.Query(ctx, query, scanID, phaseName, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var items []*models.ScanProgressItem
	for rows.Next() {
		item, err := r.progressItemFromRow(rows)
		if err != nil {
			return nil, err
		}
		items = append(items, item)
	}

	return items, rows.Err()
}

// =============================================================================
// ERROR TRACKING OPERATIONS
// =============================================================================

func (r *scanProgressRepo) RecordScanError(ctx context.Context, params models.RecordScanErrorParams) (int64, error) {
	query := `
		INSERT INTO scan_errors (scan_id, phase_name, error_type, error_category, 
			severity, component, operation, item_path, item_name, item_type, item_size,
			error_message, error_code, technical_details, context, retry_count, max_retries)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
		RETURNING id`

	var errorID int64
	err := r.pool.QueryRow(ctx, query,
		params.ScanID,
		params.PhaseName,
		params.ErrorType,
		params.ErrorCategory,
		params.Severity,
		params.Component,
		params.Operation,
		params.ItemPath,
		params.ItemName,
		params.ItemType,
		params.ItemSize,
		params.ErrorMessage,
		params.ErrorCode,
		params.TechnicalDetails,
		params.Context,
		params.RetryCount,
		params.MaxRetries,
	).Scan(&errorID)

	return errorID, err
}

func (r *scanProgressRepo) GetScanErrors(ctx context.Context, scanID, phaseName string, limit, offset int32) ([]*models.ScanProgressError, error) {
	query := `
		SELECT id, scan_id, phase_name, error_type, error_category, severity,
			component, operation, item_path, item_name, item_type, item_size,
			error_message, error_code, stack_trace, technical_details,
			occurred_at, context, retry_count, max_retries, retry_after, created_at
		FROM scan_errors 
		WHERE scan_id = $1 AND phase_name = $2
		ORDER BY occurred_at DESC 
		LIMIT $3 OFFSET $4`

	rows, err := r.pool.Query(ctx, query, scanID, phaseName, limit, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var errors []*models.ScanProgressError
	for rows.Next() {
		scanError, err := r.scanErrorFromRow(rows)
		if err != nil {
			return nil, err
		}
		errors = append(errors, scanError)
	}

	return errors, rows.Err()
}

func (r *scanProgressRepo) GetRecentErrors(ctx context.Context, hours int, limit int32) ([]*models.ScanProgressError, error) {
	query := `
		SELECT id, scan_id, phase_name, error_type, error_category, severity,
			component, operation, item_path, item_name, item_type, item_size,
			error_message, error_code, stack_trace, technical_details,
			occurred_at, context, retry_count, max_retries, retry_after, created_at
		FROM scan_errors 
		WHERE occurred_at > NOW() - INTERVAL $1::text::interval
		ORDER BY occurred_at DESC 
		LIMIT $2`

	rows, err := r.pool.Query(ctx, query, fmt.Sprintf("%d hours", hours), limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var errors []*models.ScanProgressError
	for rows.Next() {
		scanError, err := r.scanErrorFromRow(rows)
		if err != nil {
			return nil, err
		}
		errors = append(errors, scanError)
	}

	return errors, rows.Err()
}

// =============================================================================
// PERFORMANCE METRICS OPERATIONS
// =============================================================================

func (r *scanProgressRepo) RecordPerformanceMetrics(ctx context.Context, params models.RecordPerformanceMetricsParams) error {
	query := `
		INSERT INTO scan_performance_metrics (scan_id, phase_name, elapsed_seconds,
			items_per_second, bytes_per_second, errors_per_minute, items_processed,
			bytes_processed, errors_count, cpu_usage_percent, memory_usage_bytes,
			queue_depth, active_workers, estimated_remaining_seconds, estimated_completion_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`

	_, err := r.pool.Exec(ctx, query,
		params.ScanID,
		params.PhaseName,
		params.ElapsedSeconds,
		params.ItemsPerSecond,
		params.BytesPerSecond,
		params.ErrorsPerMinute,
		params.ItemsProcessed,
		params.BytesProcessed,
		params.ErrorsCount,
		params.CpuUsagePercent,
		params.MemoryUsageBytes,
		params.QueueDepth,
		params.ActiveWorkers,
		params.EstimatedRemainingSeconds,
		params.EstimatedCompletionAt,
	)

	return err
}

func (r *scanProgressRepo) GetLatestPerformanceMetrics(ctx context.Context, scanID, phaseName string) (*models.ScanPerformanceMetrics, error) {
	query := `
		SELECT id, scan_id, phase_name, measured_at, elapsed_seconds, items_per_second,
			bytes_per_second, errors_per_minute, items_processed, bytes_processed,
			errors_count, cpu_usage_percent, memory_usage_bytes, disk_io_read_bytes,
			disk_io_write_bytes, queue_depth, active_workers, estimated_remaining_seconds,
			estimated_completion_at, created_at
		FROM scan_performance_metrics 
		WHERE scan_id = $1 AND phase_name = $2
		ORDER BY measured_at DESC 
		LIMIT 1`

	row := r.pool.QueryRow(ctx, query, scanID, phaseName)
	return r.performanceMetricsFromRow(row)
}

// =============================================================================
// SUMMARY AND OVERVIEW OPERATIONS
// =============================================================================

func (r *scanProgressRepo) GetActiveScansSummary(ctx context.Context) ([]*models.ActiveScanSummary, error) {
	query := `
		SELECT scan_id, volume_id, job_status, current_phase, overall_progress,
			job_started_at, phase_name, phase_status, phase_progress, items_processed,
			items_total, current_item, items_per_second, estimated_completion_at,
			phase_errors, elapsed_seconds
		FROM active_scans
		ORDER BY job_started_at DESC`

	rows, err := r.pool.Query(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var summaries []*models.ActiveScanSummary
	for rows.Next() {
		summary, err := r.activeScanSummaryFromRow(rows)
		if err != nil {
			return nil, err
		}
		summaries = append(summaries, summary)
	}

	return summaries, rows.Err()
}

func (r *scanProgressRepo) GetScanProgressSummary(ctx context.Context, scanID string) (*models.ScanProgressSummary, error) {
	query := `
		SELECT scan_id, volume_id, job_status, current_phase, overall_progress,
			started_at, total_phases, completed_phases, running_phases, failed_phases,
			total_items, processed_items, successful_items, failed_items, total_errors,
			last_activity
		FROM scan_progress_summary
		WHERE scan_id = $1`

	row := r.pool.QueryRow(ctx, query, scanID)
	return r.scanProgressSummaryFromRow(row)
}

func (r *scanProgressRepo) GetRecentErrorsSummary(ctx context.Context, hours int, limit int32) ([]*models.RecentErrorSummary, error) {
	query := `
		SELECT scan_id, volume_id, phase_name, error_type, error_category, severity,
			component, item_path, error_message, occurred_at, retry_count
		FROM recent_scan_errors
		WHERE occurred_at > NOW() - INTERVAL $1::text::interval
		ORDER BY occurred_at DESC 
		LIMIT $2`

	rows, err := r.pool.Query(ctx, query, fmt.Sprintf("%d hours", hours), limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var summaries []*models.RecentErrorSummary
	for rows.Next() {
		summary, err := r.recentErrorSummaryFromRow(rows)
		if err != nil {
			return nil, err
		}
		summaries = append(summaries, summary)
	}

	return summaries, rows.Err()
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

// Helper function to scan a scan phase from a database row
func (r *scanProgressRepo) scanPhaseFromRow(scanner interface {
	Scan(dest ...interface{}) error
}) (*models.ScanPhase, error) {
	var phase models.ScanPhase
	var progress, itemsTotal, itemsProcessed, itemsSuccessful, itemsFailed, itemsSkipped sql.NullInt64
	var bytesTotal, bytesProcessed, bytesPerSecond, durationMs, errorCount sql.NullInt64
	var itemsPerSecond sql.NullFloat64
	var startedAt, completedAt, estimatedCompletionAt, lastErrorAt sql.NullTime
	var currentItem, errorMessage, metadata sql.NullString
	var currentDepth sql.NullInt64

	err := scanner.Scan(
		&phase.ID, &phase.ScanID, &phase.PhaseName, &phase.PhaseOrder, &phase.Status,
		&progress, &itemsTotal, &itemsProcessed, &itemsSuccessful, &itemsFailed, &itemsSkipped,
		&bytesTotal, &bytesProcessed, &itemsPerSecond, &bytesPerSecond,
		&startedAt, &completedAt, &estimatedCompletionAt, &durationMs,
		&currentItem, &currentDepth, &errorMessage, &errorCount, &lastErrorAt,
		&metadata, &phase.CreatedAt, &phase.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}

	if progress.Valid {
		phase.Progress = int(progress.Int64)
	}
	if itemsTotal.Valid {
		phase.ItemsTotal = itemsTotal.Int64
	}
	if itemsProcessed.Valid {
		phase.ItemsProcessed = itemsProcessed.Int64
	}
	if itemsSuccessful.Valid {
		phase.ItemsSuccessful = itemsSuccessful.Int64
	}
	if itemsFailed.Valid {
		phase.ItemsFailed = itemsFailed.Int64
	}
	if itemsSkipped.Valid {
		phase.ItemsSkipped = itemsSkipped.Int64
	}
	if bytesTotal.Valid {
		phase.BytesTotal = bytesTotal.Int64
	}
	if bytesProcessed.Valid {
		phase.BytesProcessed = bytesProcessed.Int64
	}
	if itemsPerSecond.Valid {
		phase.ItemsPerSecond = itemsPerSecond.Float64
	}
	if bytesPerSecond.Valid {
		phase.BytesPerSecond = bytesPerSecond.Int64
	}
	if startedAt.Valid {
		phase.StartedAt = &startedAt.Time
	}
	if completedAt.Valid {
		phase.CompletedAt = &completedAt.Time
	}
	if estimatedCompletionAt.Valid {
		phase.EstimatedCompletionAt = &estimatedCompletionAt.Time
	}
	if durationMs.Valid {
		phase.DurationMs = durationMs.Int64
	}
	if currentItem.Valid {
		phase.CurrentItem = currentItem.String
	}
	if currentDepth.Valid {
		phase.CurrentDepth = int(currentDepth.Int64)
	}
	if errorMessage.Valid {
		phase.ErrorMessage = errorMessage.String
	}
	if errorCount.Valid {
		phase.ErrorCount = errorCount.Int64
	}
	if lastErrorAt.Valid {
		phase.LastErrorAt = &lastErrorAt.Time
	}
	if metadata.Valid {
		phase.Metadata = metadata.String
	}

	return &phase, nil
}

// Helper function to scan a progress item from a database row
func (r *scanProgressRepo) progressItemFromRow(scanner interface {
	Scan(dest ...interface{}) error
}) (*models.ScanProgressItem, error) {
	var item models.ScanProgressItem
	var progress sql.NullInt64
	var startedAt, completedAt sql.NullTime
	var durationMs, itemSize sql.NullInt64
	var resultData, errorMessage, errorDetails, metadata sql.NullString
	var itemName sql.NullString

	err := scanner.Scan(
		&item.ID, &item.ScanID, &item.PhaseName, &item.ItemType, &item.ItemPath, &itemName, &itemSize,
		&item.Status, &progress, &startedAt, &completedAt, &durationMs, &resultData,
		&errorMessage, &errorDetails, &metadata, &item.CreatedAt, &item.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}

	if itemName.Valid {
		item.ItemName = itemName.String
	}
	if itemSize.Valid {
		item.ItemSize = itemSize.Int64
	}
	if progress.Valid {
		item.Progress = int(progress.Int64)
	}
	if startedAt.Valid {
		item.StartedAt = &startedAt.Time
	}
	if completedAt.Valid {
		item.CompletedAt = &completedAt.Time
	}
	if durationMs.Valid {
		item.DurationMs = durationMs.Int64
	}
	if resultData.Valid {
		item.ResultData = resultData.String
	}
	if errorMessage.Valid {
		item.ErrorMessage = errorMessage.String
	}
	if errorDetails.Valid {
		item.ErrorDetails = errorDetails.String
	}
	if metadata.Valid {
		item.Metadata = metadata.String
	}

	return &item, nil
}

// Helper function to scan a scan error from a database row
func (r *scanProgressRepo) scanErrorFromRow(scanner interface {
	Scan(dest ...interface{}) error
}) (*models.ScanProgressError, error) {
	var scanError models.ScanProgressError
	var itemSize sql.NullInt64
	var stackTrace, errorCode, technicalDetails, contextData, itemName, itemType sql.NullString
	var retryCount, maxRetries sql.NullInt64
	var retryAfter sql.NullTime

	err := scanner.Scan(
		&scanError.ID, &scanError.ScanID, &scanError.PhaseName, &scanError.ErrorType,
		&scanError.ErrorCategory, &scanError.Severity, &scanError.Component, &scanError.Operation,
		&scanError.ItemPath, &itemName, &itemType, &itemSize,
		&scanError.ErrorMessage, &errorCode, &stackTrace, &technicalDetails,
		&scanError.OccurredAt, &contextData, &retryCount, &maxRetries, &retryAfter, &scanError.CreatedAt,
	)
	if err != nil {
		return nil, err
	}

	if itemName.Valid {
		scanError.ItemName = itemName.String
	}
	if itemType.Valid {
		scanError.ItemType = itemType.String
	}
	if itemSize.Valid {
		scanError.ItemSize = itemSize.Int64
	}
	if errorCode.Valid {
		scanError.ErrorCode = errorCode.String
	}
	if stackTrace.Valid {
		scanError.StackTrace = stackTrace.String
	}
	if technicalDetails.Valid {
		scanError.TechnicalDetails = technicalDetails.String
	}
	if contextData.Valid {
		scanError.Context = contextData.String
	}
	if retryCount.Valid {
		scanError.RetryCount = int(retryCount.Int64)
	}
	if maxRetries.Valid {
		scanError.MaxRetries = int(maxRetries.Int64)
	}
	if retryAfter.Valid {
		scanError.RetryAfter = &retryAfter.Time
	}

	return &scanError, nil
}

// Helper function to scan performance metrics from a database row
func (r *scanProgressRepo) performanceMetricsFromRow(scanner interface {
	Scan(dest ...interface{}) error
}) (*models.ScanPerformanceMetrics, error) {
	var metrics models.ScanPerformanceMetrics
	var itemsPerSecond, errorsPerMinute, cpuUsagePercent sql.NullFloat64
	var itemsProcessed, bytesProcessed, errorsCount sql.NullInt64
	var memoryUsageBytes, diskIoReadBytes, diskIoWriteBytes sql.NullInt64
	var queueDepth, activeWorkers, estimatedRemainingSeconds sql.NullInt64
	var estimatedCompletionAt sql.NullTime

	err := scanner.Scan(
		&metrics.ID, &metrics.ScanID, &metrics.PhaseName, &metrics.MeasuredAt, &metrics.ElapsedSeconds,
		&itemsPerSecond, &metrics.BytesPerSecond, &errorsPerMinute, &itemsProcessed, &bytesProcessed,
		&errorsCount, &cpuUsagePercent, &memoryUsageBytes, &diskIoReadBytes, &diskIoWriteBytes,
		&queueDepth, &activeWorkers, &estimatedRemainingSeconds, &estimatedCompletionAt, &metrics.CreatedAt,
	)
	if err != nil {
		return nil, err
	}

	if itemsPerSecond.Valid {
		metrics.ItemsPerSecond = itemsPerSecond.Float64
	}
	if errorsPerMinute.Valid {
		metrics.ErrorsPerMinute = errorsPerMinute.Float64
	}
	if itemsProcessed.Valid {
		metrics.ItemsProcessed = itemsProcessed.Int64
	}
	if bytesProcessed.Valid {
		metrics.BytesProcessed = bytesProcessed.Int64
	}
	if errorsCount.Valid {
		metrics.ErrorsCount = errorsCount.Int64
	}
	if cpuUsagePercent.Valid {
		metrics.CpuUsagePercent = cpuUsagePercent.Float64
	}
	if memoryUsageBytes.Valid {
		metrics.MemoryUsageBytes = memoryUsageBytes.Int64
	}
	if diskIoReadBytes.Valid {
		metrics.DiskIoReadBytes = diskIoReadBytes.Int64
	}
	if diskIoWriteBytes.Valid {
		metrics.DiskIoWriteBytes = diskIoWriteBytes.Int64
	}
	if queueDepth.Valid {
		metrics.QueueDepth = int(queueDepth.Int64)
	}
	if activeWorkers.Valid {
		metrics.ActiveWorkers = int(activeWorkers.Int64)
	}
	if estimatedRemainingSeconds.Valid {
		metrics.EstimatedRemainingSeconds = int(estimatedRemainingSeconds.Int64)
	}
	if estimatedCompletionAt.Valid {
		metrics.EstimatedCompletionAt = &estimatedCompletionAt.Time
	}

	return &metrics, nil
}

// Helper function to scan active scan summary from a database row
func (r *scanProgressRepo) activeScanSummaryFromRow(scanner interface {
	Scan(dest ...interface{}) error
}) (*models.ActiveScanSummary, error) {
	var summary models.ActiveScanSummary
	var phaseProgress, itemsProcessed, itemsTotal, phaseErrors, elapsedSeconds sql.NullInt64
	var phaseName, currentItem sql.NullString
	var itemsPerSecond sql.NullFloat64
	var estimatedCompletionAt sql.NullTime
	var phaseStatus sql.NullString

	err := scanner.Scan(
		&summary.ScanID, &summary.VolumeID, &summary.JobStatus, &summary.CurrentPhase, &summary.OverallProgress,
		&summary.JobStartedAt, &phaseName, &phaseStatus, &phaseProgress, &itemsProcessed,
		&itemsTotal, &currentItem, &itemsPerSecond, &estimatedCompletionAt,
		&phaseErrors, &elapsedSeconds,
	)
	if err != nil {
		return nil, err
	}

	if phaseName.Valid {
		summary.PhaseName = phaseName.String
	}
	if phaseStatus.Valid {
		summary.PhaseStatus = phaseStatus.String
	}
	if phaseProgress.Valid {
		summary.PhaseProgress = int(phaseProgress.Int64)
	}
	if itemsProcessed.Valid {
		summary.ItemsProcessed = itemsProcessed.Int64
	}
	if itemsTotal.Valid {
		summary.ItemsTotal = itemsTotal.Int64
	}
	if currentItem.Valid {
		summary.CurrentItem = currentItem.String
	}
	if itemsPerSecond.Valid {
		summary.ItemsPerSecond = itemsPerSecond.Float64
	}
	if estimatedCompletionAt.Valid {
		summary.EstimatedCompletionAt = &estimatedCompletionAt.Time
	}
	if phaseErrors.Valid {
		summary.PhaseErrors = phaseErrors.Int64
	}
	if elapsedSeconds.Valid {
		summary.ElapsedSeconds = int(elapsedSeconds.Int64)
	}

	return &summary, nil
}

// Helper function to scan scan progress summary from a database row
func (r *scanProgressRepo) scanProgressSummaryFromRow(scanner interface {
	Scan(dest ...interface{}) error
}) (*models.ScanProgressSummary, error) {
	var summary models.ScanProgressSummary
	var totalPhases, completedPhases, runningPhases, failedPhases sql.NullInt64
	var totalItems, processedItems, successfulItems, failedItems, totalErrors sql.NullInt64
	var lastActivity sql.NullTime

	err := scanner.Scan(
		&summary.ScanID, &summary.VolumeID, &summary.JobStatus, &summary.CurrentPhase, &summary.OverallProgress,
		&summary.StartedAt, &totalPhases, &completedPhases, &runningPhases, &failedPhases,
		&totalItems, &processedItems, &successfulItems, &failedItems, &totalErrors, &lastActivity,
	)
	if err != nil {
		return nil, err
	}

	if totalPhases.Valid {
		summary.TotalPhases = int(totalPhases.Int64)
	}
	if completedPhases.Valid {
		summary.CompletedPhases = int(completedPhases.Int64)
	}
	if runningPhases.Valid {
		summary.RunningPhases = int(runningPhases.Int64)
	}
	if failedPhases.Valid {
		summary.FailedPhases = int(failedPhases.Int64)
	}
	if totalItems.Valid {
		summary.TotalItems = totalItems.Int64
	}
	if processedItems.Valid {
		summary.ProcessedItems = processedItems.Int64
	}
	if successfulItems.Valid {
		summary.SuccessfulItems = successfulItems.Int64
	}
	if failedItems.Valid {
		summary.FailedItems = failedItems.Int64
	}
	if totalErrors.Valid {
		summary.TotalErrors = totalErrors.Int64
	}
	if lastActivity.Valid {
		summary.LastActivity = &lastActivity.Time
	}

	return &summary, nil
}

// Helper function to scan recent error summary from a database row
func (r *scanProgressRepo) recentErrorSummaryFromRow(scanner interface {
	Scan(dest ...interface{}) error
}) (*models.RecentErrorSummary, error) {
	var summary models.RecentErrorSummary
	var retryCount sql.NullInt64

	err := scanner.Scan(
		&summary.ScanID, &summary.VolumeID, &summary.PhaseName, &summary.ErrorType, &summary.ErrorCategory,
		&summary.Severity, &summary.Component, &summary.ItemPath, &summary.ErrorMessage,
		&summary.OccurredAt, &retryCount,
	)
	if err != nil {
		return nil, err
	}

	if retryCount.Valid {
		summary.RetryCount = int(retryCount.Int64)
	}

	return &summary, nil
}

// =============================================================================
// ADDITIONAL API HANDLER METHODS
// =============================================================================

// GetScanPhases returns scan phases for a scan ID (returns values, not pointers)
func (r *scanProgressRepo) GetScanPhases(ctx context.Context, scanID string) ([]models.ScanPhase, error) {
	phases, err := r.GetScanPhasesByID(ctx, scanID)
	if err != nil {
		return nil, err
	}

	// Convert from []*ScanPhase to []ScanPhase
	result := make([]models.ScanPhase, len(phases))
	for i, phase := range phases {
		if phase != nil {
			result[i] = *phase
		}
	}
	return result, nil
}

// GetScanProgressItems returns progress items for a scan ID (returns values, not pointers)
func (r *scanProgressRepo) GetScanProgressItems(ctx context.Context, scanID string) ([]models.ScanProgressItem, error) {
	query := `
		SELECT id, scan_id, phase_name, item_type, item_path, item_name, item_size,
			status, progress, started_at, completed_at, duration_ms, result_data,
			error_message, error_details, metadata, created_at, updated_at
		FROM scan_progress_items 
		WHERE scan_id = $1 
		ORDER BY created_at ASC`

	rows, err := r.pool.Query(ctx, query, scanID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var items []models.ScanProgressItem
	for rows.Next() {
		item, err := r.progressItemFromRow(rows)
		if err != nil {
			return nil, err
		}
		if item != nil {
			items = append(items, *item)
		}
	}

	return items, rows.Err()
}

// GetScanErrorsFiltered returns filtered scan errors with pagination
func (r *scanProgressRepo) GetScanErrorsFiltered(ctx context.Context, params models.ScanErrorFilterParams) ([]*models.ScanProgressError, error) {
	baseQuery := `
		SELECT id, scan_id, phase_name, error_type, error_category, severity,
			component, operation, item_path, item_name, item_type, item_size,
			error_message, error_code, stack_trace, technical_details,
			occurred_at, context, retry_count, max_retries, retry_after, created_at
		FROM scan_errors 
		WHERE scan_id = $1`

	args := []interface{}{params.ScanID}
	argCount := 1

	if params.PhaseName != "" {
		argCount++
		baseQuery += fmt.Sprintf(" AND phase_name = $%d", argCount)
		args = append(args, params.PhaseName)
	}

	if params.ErrorType != "" {
		argCount++
		baseQuery += fmt.Sprintf(" AND error_type = $%d", argCount)
		args = append(args, params.ErrorType)
	}

	baseQuery += " ORDER BY occurred_at DESC"

	if params.Limit > 0 {
		argCount++
		baseQuery += fmt.Sprintf(" LIMIT $%d", argCount)
		args = append(args, params.Limit)
	}

	if params.Offset > 0 {
		argCount++
		baseQuery += fmt.Sprintf(" OFFSET $%d", argCount)
		args = append(args, params.Offset)
	}

	rows, err := r.pool.Query(ctx, baseQuery, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var errors []*models.ScanProgressError
	for rows.Next() {
		scanError, err := r.scanErrorFromRow(rows)
		if err != nil {
			return nil, err
		}
		errors = append(errors, scanError)
	}

	return errors, rows.Err()
}

// GetScanErrorsCount returns the count of scan errors matching the filters
func (r *scanProgressRepo) GetScanErrorsCount(ctx context.Context, scanID, phaseFilter, errorTypeFilter string) (int64, error) {
	baseQuery := "SELECT COUNT(*) FROM scan_errors WHERE scan_id = $1"
	args := []interface{}{scanID}
	argCount := 1

	if phaseFilter != "" {
		argCount++
		baseQuery += fmt.Sprintf(" AND phase_name = $%d", argCount)
		args = append(args, phaseFilter)
	}

	if errorTypeFilter != "" {
		argCount++
		baseQuery += fmt.Sprintf(" AND error_type = $%d", argCount)
		args = append(args, errorTypeFilter)
	}

	var count int64
	err := r.pool.QueryRow(ctx, baseQuery, args...).Scan(&count)
	return count, err
}

// GetActiveScans returns active scans with pagination (returns values, not pointers)
func (r *scanProgressRepo) GetActiveScans(ctx context.Context, limit, offset int) ([]models.ActiveScanSummary, error) {
	query := `
		SELECT scan_id, volume_id, job_status, current_phase, overall_progress,
			job_started_at, phase_name, phase_status, phase_progress, items_processed,
			items_total, current_item, items_per_second, estimated_completion_at,
			phase_errors, elapsed_seconds
		FROM active_scans
		ORDER BY job_started_at DESC
		LIMIT $1 OFFSET $2`

	rows, err := r.pool.Query(ctx, query, limit, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var summaries []models.ActiveScanSummary
	for rows.Next() {
		summary, err := r.activeScanSummaryFromRow(rows)
		if err != nil {
			return nil, err
		}
		if summary != nil {
			summaries = append(summaries, *summary)
		}
	}

	return summaries, rows.Err()
}

// GetActiveScansCount returns the count of active scans
func (r *scanProgressRepo) GetActiveScansCount(ctx context.Context) (int64, error) {
	query := "SELECT COUNT(*) FROM active_scans"
	var count int64
	err := r.pool.QueryRow(ctx, query).Scan(&count)
	return count, err
}

// GetRecentScanErrors returns recent scan errors across all scans
func (r *scanProgressRepo) GetRecentScanErrors(ctx context.Context, params models.RecentErrorsParams) ([]*models.ScanProgressError, error) {
	baseQuery := `
		SELECT id, scan_id, phase_name, error_type, error_category, severity,
			component, operation, item_path, item_name, item_type, item_size,
			error_message, error_code, stack_trace, technical_details,
			occurred_at, context, retry_count, max_retries, retry_after, created_at
		FROM scan_errors 
		WHERE occurred_at > NOW() - INTERVAL $1::text::interval`

	args := []interface{}{fmt.Sprintf("%d hours", params.HoursBack)}
	argCount := 1

	if params.ErrorType != "" {
		argCount++
		baseQuery += fmt.Sprintf(" AND error_type = $%d", argCount)
		args = append(args, params.ErrorType)
	}

	if params.PhaseName != "" {
		argCount++
		baseQuery += fmt.Sprintf(" AND phase_name = $%d", argCount)
		args = append(args, params.PhaseName)
	}

	baseQuery += " ORDER BY occurred_at DESC"

	if params.Limit > 0 {
		argCount++
		baseQuery += fmt.Sprintf(" LIMIT $%d", argCount)
		args = append(args, params.Limit)
	}

	rows, err := r.pool.Query(ctx, baseQuery, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var errors []*models.ScanProgressError
	for rows.Next() {
		scanError, err := r.scanErrorFromRow(rows)
		if err != nil {
			return nil, err
		}
		errors = append(errors, scanError)
	}

	return errors, rows.Err()
}
