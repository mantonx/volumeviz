package repo

import (
	"context"
	"database/sql"
	"time"

	"github.com/jackc/pgx/v5/pgtype"
	"github.com/mantonx/volumeviz/internal/db/sqlc"
	sqlcSQLite "github.com/mantonx/volumeviz/internal/db/sqlc-sqlite"
)

// RetentionRepo handles data retention and cleanup operations
type RetentionRepo interface {
	PruneVolumeMetrics(ctx context.Context, retentionPeriod time.Duration) (*RetentionResult, error)
	PruneScanJobs(ctx context.Context, retentionPeriod time.Duration) (*RetentionResult, error)
	PruneDailyStats(ctx context.Context, retentionPeriod time.Duration) (*RetentionResult, error)
	PruneFileMetadata(ctx context.Context, retentionPeriod time.Duration) (*RetentionResult, error)
	PruneInactiveFiles(ctx context.Context, retentionPeriod time.Duration) (*RetentionResult, error)
	GetRetentionStats(ctx context.Context) (map[string]int64, error)
	CreateDailyRollupTable(ctx context.Context) error
	RollupDailyMetrics(ctx context.Context) error
}

// retentionRepo implements RetentionRepo using sqlc generated queries
type retentionRepo struct {
	queries *sqlc.Queries
}

// retentionRepoSQLite implements RetentionRepo using SQLite sqlc generated queries
type retentionRepoSQLite struct {
	queries *sqlcSQLite.Queries
}

// NewRetentionRepo creates a new retention repository
func NewRetentionRepo(queries *sqlc.Queries) RetentionRepo {
	return &retentionRepo{queries: queries}
}

// NewSQLiteRetentionRepo creates a new SQLite retention repository
func NewSQLiteRetentionRepo(queries *sqlcSQLite.Queries) RetentionRepo {
	return &retentionRepoSQLite{queries: queries}
}

// RetentionResult represents the result of a retention operation
type RetentionResult struct {
	RecordsDeleted int64
	BytesFreed     int64
}

// =============================================================================
// PostgreSQL Implementation
// =============================================================================

// PruneVolumeMetrics removes old scan performance metrics
func (r *retentionRepo) PruneVolumeMetrics(ctx context.Context, retentionPeriod time.Duration) (*RetentionResult, error) {
	cutoffTime := time.Now().Add(-retentionPeriod)

	// Count old metrics before deletion
	countBefore, err := r.queries.CountOldScanMetrics(ctx, pgtype.Timestamptz{
		Time:  cutoffTime,
		Valid: true,
	})
	if err != nil {
		return nil, err
	}

	// Delete old metrics
	err = r.queries.DeleteOldScanMetrics(ctx, pgtype.Timestamptz{
		Time:  cutoffTime,
		Valid: true,
	})
	if err != nil {
		return nil, err
	}

	return &RetentionResult{
		RecordsDeleted: countBefore,
		BytesFreed:     countBefore * 256, // Rough estimate of bytes per metric record
	}, nil
}

// PruneScanJobs removes old scan job records
func (r *retentionRepo) PruneScanJobs(ctx context.Context, retentionPeriod time.Duration) (*RetentionResult, error) {
	cutoffTime := time.Now().Add(-retentionPeriod)
	
	// First count how many records will be deleted for reporting
	countBefore, err := r.queries.CountScanJobsByStatus(ctx, "completed")
	if err != nil {
		return nil, err
	}
	failedCount, err := r.queries.CountScanJobsByStatus(ctx, "failed") 
	if err != nil {
		return nil, err
	}
	cancelledCount, err := r.queries.CountScanJobsByStatus(ctx, "cancelled")
	if err != nil {
		return nil, err
	}
	totalBefore := countBefore + failedCount + cancelledCount

	// Delete old scan jobs using the existing SQLC query
	err = r.queries.DeleteOldScanJobs(ctx, pgtype.Timestamptz{
		Time: cutoffTime,
		Valid: true,
	})
	if err != nil {
		return nil, err
	}

	// Count remaining records to calculate how many were deleted
	countAfter, _ := r.queries.CountScanJobsByStatus(ctx, "completed")
	failedAfter, _ := r.queries.CountScanJobsByStatus(ctx, "failed") 
	cancelledAfter, _ := r.queries.CountScanJobsByStatus(ctx, "cancelled")
	totalAfter := countAfter + failedAfter + cancelledAfter
	
	recordsDeleted := totalBefore - totalAfter

	return &RetentionResult{
		RecordsDeleted: recordsDeleted,
		BytesFreed:     recordsDeleted * 1024, // Rough estimate of bytes per record
	}, nil
}

// PruneDailyStats removes old scan phases and scan errors
func (r *retentionRepo) PruneDailyStats(ctx context.Context, retentionPeriod time.Duration) (*RetentionResult, error) {
	cutoffTime := time.Now().Add(-retentionPeriod)

	var totalDeleted int64 = 0

	// Prune scan phases
	phaseCount, err := r.queries.CountOldScanPhases(ctx, cutoffTime)
	if err != nil {
		return nil, err
	}

	err = r.queries.DeleteOldScanPhases(ctx, cutoffTime)
	if err != nil {
		return nil, err
	}
	totalDeleted += phaseCount

	// Prune scan errors
	errorCount, err := r.queries.CountOldScanErrors(ctx, pgtype.Timestamptz{
		Time:  cutoffTime,
		Valid: true,
	})
	if err != nil {
		return nil, err
	}

	err = r.queries.DeleteOldScanErrors(ctx, pgtype.Timestamptz{
		Time:  cutoffTime,
		Valid: true,
	})
	if err != nil {
		return nil, err
	}
	totalDeleted += errorCount

	return &RetentionResult{
		RecordsDeleted: totalDeleted,
		BytesFreed:     totalDeleted * 512, // Rough estimate
	}, nil
}

// PruneFileMetadata removes old file metadata
func (r *retentionRepo) PruneFileMetadata(ctx context.Context, retentionPeriod time.Duration) (*RetentionResult, error) {
	cutoffTime := time.Now().Add(-retentionPeriod)
	
	// Count old metadata before deletion
	countBefore, err := r.queries.CountOldFileMetadata(ctx, pgtype.Timestamptz{
		Time: cutoffTime,
		Valid: true,
	})
	if err != nil {
		return nil, err
	}

	// Delete old file metadata
	err = r.queries.DeleteOldFileMetadata(ctx, pgtype.Timestamptz{
		Time: cutoffTime,
		Valid: true,
	})
	if err != nil {
		return nil, err
	}

	return &RetentionResult{
		RecordsDeleted: countBefore,
		BytesFreed:     countBefore * 2048, // Rough estimate of bytes per metadata record
	}, nil
}

// PruneInactiveFiles removes records for files that haven't been seen recently
func (r *retentionRepo) PruneInactiveFiles(ctx context.Context, retentionPeriod time.Duration) (*RetentionResult, error) {
	cutoffTime := time.Now().Add(-retentionPeriod)
	
	// Count old files before deletion
	countBefore, err := r.queries.CountOldFiles(ctx, pgtype.Timestamptz{
		Time: cutoffTime,
		Valid: true,
	})
	if err != nil {
		return nil, err
	}

	// Delete old files
	err = r.queries.DeleteOldFiles(ctx, pgtype.Timestamptz{
		Time: cutoffTime,
		Valid: true,
	})
	if err != nil {
		return nil, err
	}

	return &RetentionResult{
		RecordsDeleted: countBefore,
		BytesFreed:     countBefore * 512, // Rough estimate of bytes per file record
	}, nil
}

// GetRetentionStats returns statistics about data eligible for retention
func (r *retentionRepo) GetRetentionStats(ctx context.Context) (map[string]int64, error) {
	// Get stats for data older than 30 days
	cutoffTime := time.Now().AddDate(0, 0, -30)

	stats, err := r.queries.GetRetentionStats(ctx, cutoffTime)
	if err != nil {
		return nil, err
	}

	return map[string]int64{
		"scan_phases":   stats.OldScanPhases,
		"scan_errors":   stats.OldScanErrors,
		"scan_metrics":  stats.OldScanMetrics,
		"file_metadata": stats.OldFileMetadata,
		"old_files":     stats.OldFiles,
		"old_scan_jobs": stats.OldScanJobs,
	}, nil
}

// CreateDailyRollupTable creates the daily rollup table if it doesn't exist
func (r *retentionRepo) CreateDailyRollupTable(ctx context.Context) error {
	// TODO: Implement when schema and queries are available
	return nil
}

// RollupDailyMetrics performs daily metric rollup aggregation
func (r *retentionRepo) RollupDailyMetrics(ctx context.Context) error {
	// TODO: Implement when schema and queries are available
	return nil
}

// =============================================================================
// SQLite Implementation
// =============================================================================

// PruneVolumeMetrics removes old scan performance metrics
func (r *retentionRepoSQLite) PruneVolumeMetrics(ctx context.Context, retentionPeriod time.Duration) (*RetentionResult, error) {
	cutoffTime := time.Now().Add(-retentionPeriod)

	// SQLite version - query methods should be similar but check sqlc-sqlite generation
	// For now, return empty result as SQLite retention queries need to be added separately
	// TODO: Implement SQLite-specific retention queries
	_ = cutoffTime // Avoid unused variable error
	return &RetentionResult{RecordsDeleted: 0, BytesFreed: 0}, nil
}

// PruneScanJobs removes old scan job records
func (r *retentionRepoSQLite) PruneScanJobs(ctx context.Context, retentionPeriod time.Duration) (*RetentionResult, error) {
	cutoffTime := time.Now().Add(-retentionPeriod)
	
	// First count how many records will be deleted for reporting
	countBefore, err := r.queries.CountScanJobsByStatus(ctx, "completed")
	if err != nil {
		return nil, err
	}
	failedCount, err := r.queries.CountScanJobsByStatus(ctx, "failed") 
	if err != nil {
		return nil, err
	}
	cancelledCount, err := r.queries.CountScanJobsByStatus(ctx, "cancelled")
	if err != nil {
		return nil, err
	}
	totalBefore := countBefore + failedCount + cancelledCount

	// Delete old scan jobs using the existing SQLC query
	err = r.queries.DeleteOldScanJobs(ctx, sql.NullString{
		String: cutoffTime.Format(time.RFC3339),
		Valid: true,
	})
	if err != nil {
		return nil, err
	}

	// Count remaining records to calculate how many were deleted
	countAfter, _ := r.queries.CountScanJobsByStatus(ctx, "completed")
	failedAfter, _ := r.queries.CountScanJobsByStatus(ctx, "failed") 
	cancelledAfter, _ := r.queries.CountScanJobsByStatus(ctx, "cancelled")
	totalAfter := countAfter + failedAfter + cancelledAfter
	
	recordsDeleted := totalBefore - totalAfter

	return &RetentionResult{
		RecordsDeleted: recordsDeleted,
		BytesFreed:     recordsDeleted * 1024, // Rough estimate of bytes per record
	}, nil
}

// PruneDailyStats removes old scan phases and scan errors
func (r *retentionRepoSQLite) PruneDailyStats(ctx context.Context, retentionPeriod time.Duration) (*RetentionResult, error) {
	cutoffTime := time.Now().Add(-retentionPeriod)

	// SQLite version - query methods should be similar but check sqlc-sqlite generation
	// TODO: Implement SQLite-specific retention queries
	_ = cutoffTime // Avoid unused variable error
	return &RetentionResult{RecordsDeleted: 0, BytesFreed: 0}, nil
}

// PruneFileMetadata removes old file metadata
func (r *retentionRepoSQLite) PruneFileMetadata(ctx context.Context, retentionPeriod time.Duration) (*RetentionResult, error) {
	cutoffTime := time.Now().Add(-retentionPeriod)
	
	// Count old metadata before deletion
	countBefore, err := r.queries.CountOldFileMetadata(ctx, sql.NullString{
		String: cutoffTime.Format(time.RFC3339),
		Valid: true,
	})
	if err != nil {
		return nil, err
	}

	// Delete old file metadata
	err = r.queries.DeleteOldFileMetadata(ctx, sql.NullString{
		String: cutoffTime.Format(time.RFC3339),
		Valid: true,
	})
	if err != nil {
		return nil, err
	}

	return &RetentionResult{
		RecordsDeleted: countBefore,
		BytesFreed:     countBefore * 2048, // Rough estimate of bytes per metadata record
	}, nil
}

// PruneInactiveFiles removes records for files that haven't been seen recently
func (r *retentionRepoSQLite) PruneInactiveFiles(ctx context.Context, retentionPeriod time.Duration) (*RetentionResult, error) {
	cutoffTime := time.Now().Add(-retentionPeriod)
	
	// Count old files before deletion
	countBefore, err := r.queries.CountOldFiles(ctx, sql.NullString{
		String: cutoffTime.Format(time.RFC3339),
		Valid: true,
	})
	if err != nil {
		return nil, err
	}

	// Delete old files
	err = r.queries.DeleteOldFiles(ctx, sql.NullString{
		String: cutoffTime.Format(time.RFC3339),
		Valid: true,
	})
	if err != nil {
		return nil, err
	}

	return &RetentionResult{
		RecordsDeleted: countBefore,
		BytesFreed:     countBefore * 512, // Rough estimate of bytes per file record
	}, nil
}

// GetRetentionStats returns statistics about data eligible for retention
func (r *retentionRepoSQLite) GetRetentionStats(ctx context.Context) (map[string]int64, error) {
	// TODO: Implement SQLite-specific retention stats
	return map[string]int64{
		"scan_phases":   0,
		"scan_errors":   0,
		"scan_metrics":  0,
		"file_metadata": 0,
		"old_files":     0,
		"old_scan_jobs": 0,
	}, nil
}

// CreateDailyRollupTable creates the daily rollup table if it doesn't exist
func (r *retentionRepoSQLite) CreateDailyRollupTable(ctx context.Context) error {
	// TODO: Implement when schema and queries are available
	return nil
}

// RollupDailyMetrics performs daily metric rollup aggregation
func (r *retentionRepoSQLite) RollupDailyMetrics(ctx context.Context) error {
	// TODO: Implement when schema and queries are available
	return nil
}