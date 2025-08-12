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
	
	// PruneVolumeSizes removes volume_sizes entries older than the specified days
	PruneVolumeSizes(ctx context.Context, ttlDays int) (int64, error)
	
	// PruneScanJobs removes completed/failed scan_jobs entries older than the specified days
	PruneScanJobs(ctx context.Context, ttlDays int) (int64, error)
	
	// CreateDailyRollupTable ensures the daily rollup table exists
	CreateDailyRollupTable(ctx context.Context) error
	
	// RollupDailyMetrics creates or updates daily aggregates for the last 7 days
	RollupDailyMetrics(ctx context.Context) error
}

type retentionRepo struct {
	queries *sqlc.Queries
}

// NewRetentionRepo creates a new retention repository
func NewRetentionRepo(queries *sqlc.Queries) RetentionRepo {
	return &retentionRepo{queries: queries}
}

// Note: Since these are maintenance operations that aren't part of the main sqlc queries,
// we'll need to add them to a new SQL file or implement them using the existing queries.
// For now, returning stub implementations to maintain the architecture.

func (r *retentionRepo) PruneVolumeMetrics(ctx context.Context, ttlDays int) (int64, error) {
	// TODO: Implement when retention queries are added to sqlc
	return 0, fmt.Errorf("retention queries not yet implemented in sqlc")
}

func (r *retentionRepo) PruneVolumeSizes(ctx context.Context, ttlDays int) (int64, error) {
	// TODO: Implement when retention queries are added to sqlc
	return 0, fmt.Errorf("retention queries not yet implemented in sqlc")
}

func (r *retentionRepo) PruneScanJobs(ctx context.Context, ttlDays int) (int64, error) {
	// TODO: Implement when retention queries are added to sqlc
	return 0, fmt.Errorf("retention queries not yet implemented in sqlc")
}

func (r *retentionRepo) CreateDailyRollupTable(ctx context.Context) error {
	// TODO: Implement when retention queries are added to sqlc
	return fmt.Errorf("retention queries not yet implemented in sqlc")
}

func (r *retentionRepo) RollupDailyMetrics(ctx context.Context) error {
	// TODO: Implement when retention queries are added to sqlc
	return fmt.Errorf("retention queries not yet implemented in sqlc")
}