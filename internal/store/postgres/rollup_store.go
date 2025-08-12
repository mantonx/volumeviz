package postgres

import (
	"context"
	"fmt"
	"time"

	"github.com/mantonx/volumeviz/internal/store/generated/postgres"
	"github.com/mantonx/volumeviz/internal/store/interfaces"
	"github.com/mantonx/volumeviz/internal/store/models"
)

// PostgresRollupStore implements RollupStore interface for PostgreSQL
type PostgresRollupStore struct {
	*PostgresInfrastructureStore
}

// NewPostgresRollupStore creates a new PostgreSQL rollup store
func NewPostgresRollupStore(infra *PostgresInfrastructureStore) interfaces.RollupStore {
	return &PostgresRollupStore{
		PostgresInfrastructureStore: infra,
	}
}

// CreateDirRollup creates a new directory rollup record
func (s *PostgresRollupStore) CreateDirRollup(ctx context.Context, rollup *models.DirRollup) (*models.DirRollup, error) {
	params := postgres.CreateDirRollupParams{
		DirID:      rollup.DirID,
		SizeBytes:  rollup.SizeBytes,
		FileCount:  rollup.FileCount,
		ComputedAt: rollup.ComputedAt,
	}
	
	row, err := s.queries.CreateDirRollup(ctx, params)
	if err != nil {
		return nil, fmt.Errorf("failed to create directory rollup: %w", err)
	}

	return fromPostgresDirRollup(&row), nil
}

// GetDirRollup retrieves a directory rollup by ID
func (s *PostgresRollupStore) GetDirRollup(ctx context.Context, id int64) (*models.DirRollup, error) {
	row, err := s.queries.GetDirRollup(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("failed to get directory rollup: %w", err)
	}

	return fromPostgresDirRollup(&row), nil
}

// GetLatestDirRollup retrieves the latest rollup for a directory
func (s *PostgresRollupStore) GetLatestDirRollup(ctx context.Context, dirID int64) (*models.DirRollup, error) {
	row, err := s.queries.GetLatestDirRollup(ctx, dirID)
	if err != nil {
		return nil, fmt.Errorf("failed to get latest directory rollup: %w", err)
	}

	return fromPostgresDirRollup(&row), nil
}

// GetDirRollupHistory retrieves rollup history for a directory
func (s *PostgresRollupStore) GetDirRollupHistory(ctx context.Context, dirID int64, limit int32) ([]*models.DirRollup, error) {
	rows, err := s.queries.GetDirRollupHistory(ctx, postgres.GetDirRollupHistoryParams{
		DirID: dirID,
		Limit: limit,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to get directory rollup history: %w", err)
	}

	rollups := make([]*models.DirRollup, len(rows))
	for i, row := range rows {
		rollups[i] = fromPostgresDirRollup(&row)
	}

	return rollups, nil
}

// GetDirRollupsInTimeRange retrieves rollups within a time range
func (s *PostgresRollupStore) GetDirRollupsInTimeRange(ctx context.Context, dirID int64, startTime, endTime time.Time) ([]*models.DirRollup, error) {
	rows, err := s.queries.GetDirRollupsInTimeRange(ctx, postgres.GetDirRollupsInTimeRangeParams{
		DirID:        dirID,
		ComputedAt:   startTime,
		ComputedAt_2: endTime,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to get directory rollups in time range: %w", err)
	}

	rollups := make([]*models.DirRollup, len(rows))
	for i, row := range rows {
		rollups[i] = fromPostgresDirRollup(&row)
	}

	return rollups, nil
}

// DeleteOldRollups deletes rollups older than the cutoff time
func (s *PostgresRollupStore) DeleteOldRollups(ctx context.Context, cutoffTime time.Time) error {
	err := s.queries.DeleteOldRollups(ctx, cutoffTime)
	if err != nil {
		return fmt.Errorf("failed to delete old rollups: %w", err)
	}
	return nil
}

// DeleteRollupsByDirID deletes all rollups for a directory
func (s *PostgresRollupStore) DeleteRollupsByDirID(ctx context.Context, dirID int64) error {
	err := s.queries.DeleteRollupsByDirId(ctx, dirID)
	if err != nil {
		return fmt.Errorf("failed to delete rollups by directory ID: %w", err)
	}
	return nil
}

// CountRollupsByDirID counts rollups for a directory
func (s *PostgresRollupStore) CountRollupsByDirID(ctx context.Context, dirID int64) (int64, error) {
	count, err := s.queries.CountRollupsByDirId(ctx, dirID)
	if err != nil {
		return 0, fmt.Errorf("failed to count rollups by directory ID: %w", err)
	}
	return count, nil
}

// GetRollupStats gets overall rollup statistics
func (s *PostgresRollupStore) GetRollupStats(ctx context.Context) (*models.RollupStats, error) {
	row, err := s.queries.GetRollupStats(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to get rollup stats: %w", err)
	}

	// Convert interface{} values to appropriate types
	var oldestRollup, newestRollup *time.Time
	if row.OldestRollup != nil {
		if t, ok := row.OldestRollup.(time.Time); ok {
			oldestRollup = &t
		}
	}
	if row.NewestRollup != nil {
		if t, ok := row.NewestRollup.(time.Time); ok {
			newestRollup = &t
		}
	}

	return &models.RollupStats{
		TotalRollups:           row.TotalRollups,
		DirectoriesWithRollups: row.DirectoriesWithRollups,
		OldestRollup:           oldestRollup,
		NewestRollup:           newestRollup,
	}, nil
}

// BulkInsertDirRollups performs bulk insertion of directory rollups
func (s *PostgresRollupStore) BulkInsertDirRollups(ctx context.Context, rollups []*models.DirRollup, params models.BulkInsertParams) error {
	// Convert to PostgreSQL batch insert format
	var bulkParams []postgres.BulkInsertDirRollupsParams
	for _, rollup := range rollups {
		bulkParams = append(bulkParams, postgres.BulkInsertDirRollupsParams{
			DirID:      rollup.DirID,
			SizeBytes:  rollup.SizeBytes,
			FileCount:  rollup.FileCount,
			ComputedAt: rollup.ComputedAt,
		})
	}

	// Execute bulk insert
	_, err := s.queries.BulkInsertDirRollups(ctx, bulkParams)
	if err != nil {
		return fmt.Errorf("failed to bulk insert directory rollups: %w", err)
	}

	return nil
}