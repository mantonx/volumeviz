package repo

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/mantonx/volumeviz/internal/db/sqlc"
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
	// GetRecentScanErrors(ctx context.Context, params models.RecentErrorsParams) ([]*models.ScanProgressError, error)
}

// scanProgressRepo implements ScanProgressRepo using pgx queries
type scanProgressRepo struct {
	pool    *pgxpool.Pool
	queries *sqlc.Queries
}

// NewScanProgressRepo creates a new scan progress repository
func NewScanProgressRepo(pool *pgxpool.Pool) ScanProgressRepo {
	return &scanProgressRepo{
		pool:    pool,
		queries: sqlc.New(pool),
	}
}

// NewScanProgressRepoFromConn creates a scan progress repository from a single connection
// This is a placeholder for future transaction support
func NewScanProgressRepoFromConn(conn *pgx.Conn) ScanProgressRepo {
	// This is not implemented yet - for now return nil
	// TODO: Implement proper transaction support
	return nil
}

// NewSQLiteScanProgressRepo creates a new SQLite scan progress repository
func NewSQLiteScanProgressRepo(db *sql.DB) ScanProgressRepo {
	// TODO: Implement SQLite-specific version
	return nil
}

// =============================================================================
// SCAN PHASES OPERATIONS
// =============================================================================

func (r *scanProgressRepo) CreateScanPhase(ctx context.Context, params models.CreateScanPhaseParams) (*models.ScanPhase, error) {
	query := `
		INSERT INTO scan_phases (scan_id, phase_name, status, items_total, started_at)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING id, created_at, updated_at`

	var id int64
	var createdAt, updatedAt time.Time

	err := r.pool.QueryRow(ctx, query,
		params.ScanID,
		params.PhaseName,
		params.Status,
		params.ItemsTotal,
		params.StartedAt,
	).Scan(&id, &createdAt, &updatedAt)

	if err != nil {
		return nil, err
	}

	return &models.ScanPhase{
		ID:         id,
		ScanID:     params.ScanID,
		PhaseName:  params.PhaseName,
		Status:     params.Status,
		ItemsTotal: params.ItemsTotal,
		StartedAt:  params.StartedAt,
		CreatedAt:    createdAt,
		UpdatedAt:    updatedAt,
	}, nil
}

func (r *scanProgressRepo) GetScanPhasesByID(ctx context.Context, scanID string) ([]*models.ScanPhase, error) {
	query := `
		SELECT DISTINCT ON (phase_name)
			id, scan_id, phase_name, status, progress_percent, items_total,
			items_processed, items_failed,
			throughput_items_per_sec,
			started_at, completed_at, duration_ms,
			current_item, error_message,
			created_at, updated_at
		FROM scan_phases
		WHERE scan_id = $1
		ORDER BY phase_name, updated_at DESC`

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
		SELECT id, scan_id, phase_name, status, progress_percent, items_total,
			items_processed, items_failed,
			throughput_items_per_sec,
			started_at, completed_at, duration_ms,
			current_item, error_message,
			created_at, updated_at
		FROM scan_phases
		WHERE scan_id = $1 AND phase_name = $2`

	row := r.pool.QueryRow(ctx, query, scanID, phaseName)
	return r.scanPhaseFromRow(row)
}

func (r *scanProgressRepo) UpdateScanPhaseProgress(ctx context.Context, params models.UpdateScanPhaseParams) error {
	query := `
		UPDATE scan_phases SET
			status = COALESCE($3, status),
			progress_percent = COALESCE($4, progress_percent),
			items_processed = COALESCE($5, items_processed),
			items_total = COALESCE($6, items_total),
			items_failed = COALESCE($7, items_failed),
			current_item = COALESCE($8, current_item),
			throughput_items_per_sec = COALESCE($9, throughput_items_per_sec),
			updated_at = NOW()
		WHERE scan_id = $1 AND phase_name = $2`

	_, err := r.pool.Exec(ctx, query,
		params.ScanID,
		params.PhaseName,
		params.Status,
		params.Progress,
		params.ItemsProcessed,
		params.ItemsTotal,
		params.ItemsFailed,
		params.CurrentItem,
		params.ItemsPerSecond,
	)

	return err
}

func (r *scanProgressRepo) CompleteScanPhase(ctx context.Context, scanID, phaseName string) error {
	query := `
		UPDATE scan_phases SET
			status = 'completed',
			progress_percent = 100,
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
	// scan_performance_metrics uses key-value structure (metric_name, metric_value, metric_unit)
	// Insert each metric as a separate row

	metrics := map[string]struct {
		value float64
		unit  string
	}{
		"elapsed_seconds":             {float64(params.ElapsedSeconds), "seconds"},
		"items_per_second":            {params.ItemsPerSecond, "items/sec"},
		"bytes_per_second":            {float64(params.BytesPerSecond), "bytes/sec"},
		"errors_per_minute":           {params.ErrorsPerMinute, "errors/min"},
		"items_processed":             {float64(params.ItemsProcessed), "items"},
		"bytes_processed":             {float64(params.BytesProcessed), "bytes"},
		"errors_count":                {float64(params.ErrorsCount), "count"},
		"cpu_usage_percent":           {params.CpuUsagePercent, "percent"},
		"memory_usage_bytes":          {float64(params.MemoryUsageBytes), "bytes"},
		"queue_depth":                 {float64(params.QueueDepth), "count"},
		"active_workers":              {float64(params.ActiveWorkers), "count"},
		"estimated_remaining_seconds": {float64(params.EstimatedRemainingSeconds), "seconds"},
	}

	for metricName, metric := range metrics {
		query := `
			INSERT INTO scan_performance_metrics (scan_id, phase, metric_name, metric_value, metric_unit, measured_at)
			VALUES ($1, $2, $3, $4, $5, NOW())`

		_, err := r.pool.Exec(ctx, query, params.ScanID, params.PhaseName, metricName, metric.value, metric.unit)
		if err != nil {
			return fmt.Errorf("failed to record metric %s: %w", metricName, err)
		}
	}

	return nil
}

func (r *scanProgressRepo) GetLatestPerformanceMetrics(ctx context.Context, scanID, phaseName string) (*models.ScanPerformanceMetrics, error) {
	// scan_performance_metrics uses key-value structure
	// Query all metrics for the most recent measured_at timestamp

	query := `
		SELECT DISTINCT ON (metric_name)
			metric_name, metric_value, measured_at
		FROM scan_performance_metrics
		WHERE scan_id = $1 AND phase = $2
		ORDER BY metric_name, measured_at DESC`

	rows, err := r.pool.Query(ctx, query, scanID, phaseName)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	metrics := &models.ScanPerformanceMetrics{
		ScanID:    scanID,
		PhaseName: phaseName,
	}

	var latestMeasuredAt time.Time

	for rows.Next() {
		var metricName string
		var metricValue float64
		var measuredAt time.Time

		if err := rows.Scan(&metricName, &metricValue, &measuredAt); err != nil {
			return nil, err
		}

		if measuredAt.After(latestMeasuredAt) {
			latestMeasuredAt = measuredAt
		}

		// Map metric names to struct fields
		switch metricName {
		case "elapsed_seconds":
			metrics.ElapsedSeconds = int(metricValue)
		case "items_per_second":
			metrics.ItemsPerSecond = metricValue
		case "bytes_per_second":
			metrics.BytesPerSecond = int64(metricValue)
		case "errors_per_minute":
			metrics.ErrorsPerMinute = metricValue
		case "items_processed":
			metrics.ItemsProcessed = int64(metricValue)
		case "bytes_processed":
			metrics.BytesProcessed = int64(metricValue)
		case "errors_count":
			metrics.ErrorsCount = int64(metricValue)
		case "cpu_usage_percent":
			metrics.CpuUsagePercent = metricValue
		case "memory_usage_bytes":
			metrics.MemoryUsageBytes = int64(metricValue)
		case "queue_depth":
			metrics.QueueDepth = int(metricValue)
		case "active_workers":
			metrics.ActiveWorkers = int(metricValue)
		case "estimated_remaining_seconds":
			metrics.EstimatedRemainingSeconds = int(metricValue)
		}
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	metrics.MeasuredAt = latestMeasuredAt

	return metrics, nil
}

// =============================================================================
// SUMMARY AND OVERVIEW OPERATIONS
// =============================================================================

func (r *scanProgressRepo) GetActiveScansSummary(ctx context.Context) ([]*models.ActiveScanSummary, error) {
	// Use the SQLC generated query to get active scans from the view
	activeScans, err := r.queries.GetActiveScans(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to get active scans: %w", err)
	}

	// For each active scan, get the current running phase details
	result := make([]*models.ActiveScanSummary, 0, len(activeScans))
	for _, scan := range activeScans {
		// Get phase details for this scan
		phases, err := r.GetScanPhasesByID(ctx, scan.ScanID)
		if err != nil {
			return nil, fmt.Errorf("failed to get phases for scan %s: %w", scan.ScanID, err)
		}

		// Find the currently running phase, or the most recent phase
		var currentPhase *models.ScanPhase
		for _, phase := range phases {
			if phase.Status == "running" {
				currentPhase = phase
				break
			}
		}
		// If no running phase, use the first one (most recent)
		if currentPhase == nil && len(phases) > 0 {
			currentPhase = phases[0]
		}

		// Calculate overall progress from view data
		overallProgress := 0
		if scan.OverallProgressPercent != nil {
			if floatVal, ok := scan.OverallProgressPercent.(float64); ok {
				overallProgress = int(floatVal)
			}
		}

		// Calculate elapsed seconds
		elapsedSeconds := 0
		if scan.DurationSeconds.Valid {
			elapsedSeconds = int(scan.DurationSeconds.Int.Int64())
		}

		summary := &models.ActiveScanSummary{
			ScanID:          scan.ScanID,
			VolumeID:        stringFromPgText(scan.VolumeID),
			JobStatus:       scan.Status,
			OverallProgress: overallProgress,
			ElapsedSeconds:  elapsedSeconds,
		}

		if scan.StartedAt.Valid {
			summary.JobStartedAt = scan.StartedAt.Time
		}

		// Add phase details if we have them
		if currentPhase != nil {
			summary.CurrentPhase = currentPhase.PhaseName
			summary.PhaseName = currentPhase.PhaseName
			summary.PhaseStatus = currentPhase.Status
			summary.PhaseProgress = currentPhase.Progress
			summary.ItemsProcessed = currentPhase.ItemsProcessed
			summary.ItemsTotal = currentPhase.ItemsTotal
			summary.CurrentItem = currentPhase.CurrentItem
			summary.ItemsPerSecond = currentPhase.ItemsPerSecond
			summary.PhaseErrors = currentPhase.ItemsFailed
		}

		result = append(result, summary)
	}

	return result, nil
}

func (r *scanProgressRepo) GetScanProgressSummary(ctx context.Context, scanID string) (*models.ScanProgressSummary, error) {
	// Use the SQLC generated query to get scan progress summary from the view
	phaseRows, err := r.queries.GetScanProgressSummary(ctx, scanID)
	if err != nil {
		return nil, fmt.Errorf("failed to get scan progress summary: %w", err)
	}

	if len(phaseRows) == 0 {
		return nil, fmt.Errorf("scan not found: %s", scanID)
	}

	// The view returns one row per phase, so we need to aggregate
	firstRow := phaseRows[0]
	summary := &models.ScanProgressSummary{
		ScanID:    scanID,
		VolumeID:  stringFromPgText(firstRow.VolumeID),
		JobStatus: firstRow.ScanStatus,
	}

	if firstRow.ScanStartedAt.Valid {
		summary.StartedAt = firstRow.ScanStartedAt.Time
	}

	// Aggregate phase data
	var totalItems, processedItems, successfulItems, failedItems int64
	var completedPhases, runningPhases, failedPhases int
	var currentPhaseName string

	for _, row := range phaseRows {
		// Count phase statuses
		phaseStatus := stringFromPgText(row.PhaseStatus)
		switch phaseStatus {
		case "completed":
			completedPhases++
		case "running":
			runningPhases++
			if currentPhaseName == "" {
				currentPhaseName = stringFromPgText(row.PhaseName)
			}
		case "failed":
			failedPhases++
		}

		// Sum items
		if row.ItemsTotal.Valid {
			totalItems += row.ItemsTotal.Int64
		}
		if row.ItemsProcessed.Valid {
			processedItems += row.ItemsProcessed.Int64
		}
		// TODO: ItemsSuccessful field doesn't exist in current schema
		// if row.ItemsSuccessful.Valid {
		// 	successfulItems += row.ItemsSuccessful.Int64
		// }
		if row.ItemsFailed.Valid {
			failedItems += row.ItemsFailed.Int64
		}
	}

	summary.TotalPhases = len(phaseRows)
	summary.CompletedPhases = completedPhases
	summary.RunningPhases = runningPhases
	summary.FailedPhases = failedPhases
	summary.CurrentPhase = currentPhaseName
	summary.TotalItems = totalItems
	summary.ProcessedItems = processedItems
	summary.SuccessfulItems = successfulItems
	summary.FailedItems = failedItems
	summary.TotalErrors = failedItems // Approximate

	// Calculate overall progress
	if totalItems > 0 {
		summary.OverallProgress = int((processedItems * 100) / totalItems)
	}

	return summary, nil
}

func (r *scanProgressRepo) GetRecentErrorsSummary(ctx context.Context, hours int, limit int32) ([]*models.RecentErrorSummary, error) {
	// TODO: recent_scan_errors view doesn't exist - returning empty for now
	return []*models.RecentErrorSummary{}, nil

	/* // Use the SQLC generated query to get recent scan errors from the view
	errorRows, err := r.queries.GetRecentScanErrors(ctx, sqlc.GetRecentScanErrorsParams{
		Limit:  limit,
		Offset: 0,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to get recent scan errors: %w", err)
	}

	// Convert from SQLC types to model types
	result := make([]*models.RecentErrorSummary, 0, len(errorRows))
	for _, row := range errorRows {
		summary := &models.RecentErrorSummary{
			ScanID:        row.ScanID,
			VolumeID:      stringFromPgText(row.VolumeID),
			PhaseName:     stringFromPgText(row.PhaseName),
			ErrorType:     row.ErrorType,
			ErrorCategory: stringFromPgText(row.ErrorCategory),
			Severity:      stringFromPgText(row.Severity),
			Component:     stringFromPgText(row.Component),
			ItemPath:      stringFromPgText(row.ItemPath),
			ErrorMessage:  row.ErrorMessage,
		}

		if row.OccurredAt.Valid {
			summary.OccurredAt = row.OccurredAt.Time
		}

		if row.RetryCount.Valid {
			summary.RetryCount = int(row.RetryCount.Int32)
		}

		result = append(result, summary)
	}

	return result, nil */ // end of commented function
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

// Helper function to scan a scan phase from a database row
func (r *scanProgressRepo) scanPhaseFromRow(scanner interface {
	Scan(dest ...interface{}) error
}) (*models.ScanPhase, error) {
	var phase models.ScanPhase
	var progressPercent, itemsTotal, itemsProcessed, itemsFailed sql.NullInt64
	var durationMs sql.NullInt64
	var throughputItemsPerSec sql.NullFloat64
	var startedAt, completedAt sql.NullTime
	var currentItem, errorMessage sql.NullString

	// SELECT id, scan_id, phase_name, status, progress_percent, items_total,
	//     items_processed, items_failed,
	//     throughput_items_per_sec,
	//     started_at, completed_at, duration_ms,
	//     current_item, error_message,
	//     created_at, updated_at

	err := scanner.Scan(
		&phase.ID, &phase.ScanID, &phase.PhaseName, &phase.Status,
		&progressPercent, &itemsTotal, &itemsProcessed, &itemsFailed,
		&throughputItemsPerSec,
		&startedAt, &completedAt, &durationMs,
		&currentItem, &errorMessage,
		&phase.CreatedAt, &phase.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}

	if progressPercent.Valid {
		phase.Progress = int(progressPercent.Int64)
	}
	if itemsTotal.Valid {
		phase.ItemsTotal = itemsTotal.Int64
	}
	if itemsProcessed.Valid {
		phase.ItemsProcessed = itemsProcessed.Int64
	}
	if itemsFailed.Valid {
		phase.ItemsFailed = itemsFailed.Int64
	}
	if throughputItemsPerSec.Valid {
		phase.ItemsPerSecond = throughputItemsPerSec.Float64
	}
	if startedAt.Valid {
		phase.StartedAt = &startedAt.Time
	}
	if completedAt.Valid {
		phase.CompletedAt = &completedAt.Time
	}
	if durationMs.Valid {
		phase.DurationMs = durationMs.Int64
	}
	if currentItem.Valid {
		phase.CurrentItem = currentItem.String
	}
	if errorMessage.Valid {
		phase.ErrorMessage = errorMessage.String
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

// NOTE: Removed unused helper functions that referenced non-existent views:
// - performanceMetricsFromRow (now handled inline in GetLatestPerformanceMetrics)
// - activeScanSummaryFromRow (active_scans view doesn't exist)
// - scanProgressSummaryFromRow (scan_progress_summary view doesn't exist)
// - recentErrorSummaryFromRow (recent_scan_errors view doesn't exist)

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
	// Use GetActiveScansSummary which uses the active_scans view
	summaries, err := r.GetActiveScansSummary(ctx)
	if err != nil {
		return nil, err
	}

	// Apply pagination
	start := offset
	if start >= len(summaries) {
		return []models.ActiveScanSummary{}, nil
	}

	end := start + limit
	if end > len(summaries) {
		end = len(summaries)
	}

	// Convert from pointers to values
	result := make([]models.ActiveScanSummary, 0, end-start)
	for i := start; i < end; i++ {
		if summaries[i] != nil {
			result = append(result, *summaries[i])
		}
	}

	return result, nil
}

// GetActiveScansCount returns the count of active scans
func (r *scanProgressRepo) GetActiveScansCount(ctx context.Context) (int64, error) {
	// TODO: active_scans view doesn't exist - query scan_jobs directly
	query := "SELECT COUNT(*) FROM scan_jobs WHERE status IN ('pending', 'running')"
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

// stringFromPgText converts a pgtype.Text to a string, handling null values
func stringFromPgText(t pgtype.Text) string {
	if t.Valid {
		return t.String
	}
	return ""
}
