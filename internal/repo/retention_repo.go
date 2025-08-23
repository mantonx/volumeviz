package repo

import (
	"context"
	"fmt"

	"github.com/mantonx/volumeviz/internal/db/sqlc"
)

// RetentionRepo handles data retention operations
// This repo accepts sqlc.Queries (injected by store) and performs cleanup operations
type RetentionRepo interface {
	// PruneVolumeMetrics removes volume_metrics entries older than the specified days
	PruneVolumeMetrics(ctx context.Context, ttlDays int) (int64, error)

	// PruneVolumeSizes removes volume_sizes entries older than the specified days (legacy compatibility)
	PruneVolumeSizes(ctx context.Context, ttlDays int) (int64, error)

	// PruneScanJobs removes completed/failed scan_jobs entries older than the specified days
	PruneScanJobs(ctx context.Context, ttlDays int) (int64, error)

	// PruneDailyStats removes stats_daily entries older than the specified days
	PruneDailyStats(ctx context.Context, ttlDays int) (int64, error)

	// PruneFileMetadata removes file_metadata entries older than the specified days
	PruneFileMetadata(ctx context.Context, ttlDays int) (int64, error)

	// PruneInactiveFiles removes files from inactive volumes older than the specified days
	PruneInactiveFiles(ctx context.Context, ttlDays int) (int64, error)

	// PruneInactiveFolders removes folders from inactive volumes older than the specified days
	PruneInactiveFolders(ctx context.Context, ttlDays int) (int64, error)

	// VacuumAnalyze performs database maintenance
	VacuumAnalyze(ctx context.Context) error

	// CreateDailyRollupTable ensures the daily rollup table exists (legacy compatibility)
	CreateDailyRollupTable(ctx context.Context) error

	// RollupDailyMetrics creates or updates daily aggregates (legacy compatibility)
	RollupDailyMetrics(ctx context.Context) error
}

type retentionRepo struct {
	queries *sqlc.Queries
}

// NewRetentionRepo creates a new retention repository
func NewRetentionRepo(queries *sqlc.Queries) RetentionRepo {
	return &retentionRepo{queries: queries}
}

func (r *retentionRepo) PruneVolumeMetrics(ctx context.Context, ttlDays int) (int64, error) {
	// Count before deletion for metrics
	count, err := r.queries.CountVolumeMetrics(ctx, ttlDays)
	if err != nil {
		return 0, fmt.Errorf("failed to count volume metrics to prune: %w", err)
	}

	// Perform the deletion
	err = r.queries.PruneVolumeMetrics(ctx, ttlDays)
	if err != nil {
		return 0, fmt.Errorf("failed to prune volume metrics: %w", err)
	}

	return count, nil
}

func (r *retentionRepo) PruneVolumeSizes(ctx context.Context, ttlDays int) (int64, error) {
	// Volume sizes are not included in the current retention queries
	// This table may not need automatic pruning based on the schema
	return 0, nil
}

func (r *retentionRepo) PruneScanJobs(ctx context.Context, ttlDays int) (int64, error) {
	// Count before deletion for metrics
	count, err := r.queries.CountOldScanJobs(ctx, ttlDays)
	if err != nil {
		return 0, fmt.Errorf("failed to count scan jobs to prune: %w", err)
	}

	// Perform the deletion
	err = r.queries.PruneScanJobs(ctx, ttlDays)
	if err != nil {
		return 0, fmt.Errorf("failed to prune scan jobs: %w", err)
	}

	return count, nil
}

func (r *retentionRepo) CreateDailyRollupTable(ctx context.Context) error {
	// Daily stats table already exists in the schema (stats_daily)
	// No additional table creation needed
	return nil
}

func (r *retentionRepo) PruneDailyStats(ctx context.Context, ttlDays int) (int64, error) {
	// Count before deletion for metrics
	count, err := r.queries.CountOldDailyStats(ctx, ttlDays)
	if err != nil {
		return 0, fmt.Errorf("failed to count daily stats to prune: %w", err)
	}

	// Perform the deletion
	err = r.queries.PruneDailyStats(ctx, ttlDays)
	if err != nil {
		return 0, fmt.Errorf("failed to prune daily stats: %w", err)
	}

	return count, nil
}

func (r *retentionRepo) PruneFileMetadata(ctx context.Context, ttlDays int) (int64, error) {
	// Count before deletion for metrics
	count, err := r.queries.CountOldFileMetadata(ctx, ttlDays)
	if err != nil {
		return 0, fmt.Errorf("failed to count file metadata to prune: %w", err)
	}

	// Perform the deletion
	err = r.queries.PruneFileMetadata(ctx, ttlDays)
	if err != nil {
		return 0, fmt.Errorf("failed to prune file metadata: %w", err)
	}

	return count, nil
}

func (r *retentionRepo) PruneInactiveFiles(ctx context.Context, ttlDays int) (int64, error) {
	// Count before deletion for metrics
	count, err := r.queries.CountInactiveFiles(ctx, ttlDays)
	if err != nil {
		return 0, fmt.Errorf("failed to count inactive files to prune: %w", err)
	}

	// Perform the deletion
	err = r.queries.PruneInactiveFiles(ctx, ttlDays)
	if err != nil {
		return 0, fmt.Errorf("failed to prune inactive files: %w", err)
	}

	return count, nil
}

func (r *retentionRepo) PruneInactiveFolders(ctx context.Context, ttlDays int) (int64, error) {
	// Count before deletion for metrics
	count, err := r.queries.CountInactiveFolders(ctx, ttlDays)
	if err != nil {
		return 0, fmt.Errorf("failed to count inactive folders to prune: %w", err)
	}

	// Perform the deletion
	err = r.queries.PruneInactiveFolders(ctx, ttlDays)
	if err != nil {
		return 0, fmt.Errorf("failed to prune inactive folders: %w", err)
	}

	return count, nil
}

func (r *retentionRepo) VacuumAnalyze(ctx context.Context) error {
	err := r.queries.VacuumAnalyze(ctx)
	if err != nil {
		return fmt.Errorf("failed to vacuum analyze database: %w", err)
	}

	return nil
}

func (r *retentionRepo) RollupDailyMetrics(ctx context.Context) error {
	// Daily metrics rollup would be handled by the stats service
	// This is just a placeholder for the interface
	return nil
}
