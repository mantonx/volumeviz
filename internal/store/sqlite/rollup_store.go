package sqlite

import (
	"context"
	"fmt"
	"time"

	sqlite "github.com/mantonx/volumeviz/internal/store/generated/sqlite"
	"github.com/mantonx/volumeviz/internal/store/interfaces"
	"github.com/mantonx/volumeviz/internal/store/models"
)

// SQLiteRollupStore implements RollupStore interface using SQLite
type SQLiteRollupStore struct {
	infraStore *SQLiteInfrastructureStore
}

// NewSQLiteRollupStore creates a new SQLite rollup store
func NewSQLiteRollupStore(infraStore *SQLiteInfrastructureStore) *SQLiteRollupStore {
	return &SQLiteRollupStore{
		infraStore: infraStore,
	}
}

// CreateDirRollup creates a new directory rollup
func (s *SQLiteRollupStore) CreateDirRollup(ctx context.Context, rollup *models.DirRollup) (*models.DirRollup, error) {
	dbRollup, err := s.infraStore.GetQueries().CreateDirRollup(ctx, sqlite.CreateDirRollupParams{
		DirID:      rollup.DirID,
		SizeBytes:  rollup.SizeBytes,
		FileCount:  rollup.FileCount,
		ComputedAt: rollup.CreatedAt.Format(time.RFC3339),
	})
	if err != nil {
		return nil, fmt.Errorf("failed to create dir rollup: %w", err)
	}
	return fromSQLiteDirRollup(dbRollup)
}

// GetDirRollup retrieves a directory rollup by ID
func (s *SQLiteRollupStore) GetDirRollup(ctx context.Context, id int64) (*models.DirRollup, error) {
	dbRollup, err := s.infraStore.GetQueries().GetDirRollup(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("failed to get dir rollup: %w", err)
	}
	return fromSQLiteDirRollup(dbRollup)
}

// GetLatestDirRollup retrieves the latest rollup for a directory
func (s *SQLiteRollupStore) GetLatestDirRollup(ctx context.Context, dirID int64) (*models.DirRollup, error) {
	dbRollup, err := s.infraStore.GetQueries().GetLatestDirRollup(ctx, dirID)
	if err != nil {
		return nil, fmt.Errorf("failed to get latest dir rollup: %w", err)
	}
	return fromSQLiteDirRollup(dbRollup)
}

// GetDirRollupHistory retrieves rollup history for a directory
func (s *SQLiteRollupStore) GetDirRollupHistory(ctx context.Context, dirID int64, limit int32) ([]*models.DirRollup, error) {
	dbRollups, err := s.infraStore.GetQueries().GetDirRollupHistory(ctx, sqlite.GetDirRollupHistoryParams{
		DirID: dirID,
		Limit: int64(limit),
	})
	if err != nil {
		return nil, fmt.Errorf("failed to get dir rollup history: %w", err)
	}

	rollups := make([]*models.DirRollup, len(dbRollups))
	for i, dbRollup := range dbRollups {
		rollup, err := fromSQLiteDirRollup(dbRollup)
		if err != nil {
			return nil, err
		}
		rollups[i] = rollup
	}
	return rollups, nil
}

// GetDirRollupsInTimeRange retrieves rollups for a directory within a time range
func (s *SQLiteRollupStore) GetDirRollupsInTimeRange(ctx context.Context, dirID int64, startTime, endTime time.Time) ([]*models.DirRollup, error) {
	dbRollups, err := s.infraStore.GetQueries().GetDirRollupsInTimeRange(ctx, sqlite.GetDirRollupsInTimeRangeParams{
		DirID:        dirID,
		ComputedAt:   startTime.Format(time.RFC3339),
		ComputedAt_2: endTime.Format(time.RFC3339),
	})
	if err != nil {
		return nil, fmt.Errorf("failed to get dir rollups in time range: %w", err)
	}

	rollups := make([]*models.DirRollup, len(dbRollups))
	for i, dbRollup := range dbRollups {
		rollup, err := fromSQLiteDirRollup(dbRollup)
		if err != nil {
			return nil, err
		}
		rollups[i] = rollup
	}
	return rollups, nil
}

// BulkInsertDirRollups performs bulk insertion of directory rollups
func (s *SQLiteRollupStore) BulkInsertDirRollups(ctx context.Context, rollups []*models.DirRollup, params interfaces.BulkInsertParams) error {
	if len(rollups) == 0 {
		return nil
	}

	chunkSize := defaultChunkSize()
	if params.BatchSize > 0 {
		chunkSize = params.BatchSize
	}

	chunks := chunkSlice(rollups, chunkSize)
	for _, chunk := range chunks {
		if err := s.executeBatchInsertDirRollups(ctx, chunk); err != nil {
			return fmt.Errorf("failed to execute batch insert: %w", err)
		}
	}

	return nil
}

// DeleteOldRollups deletes rollups older than the specified cutoff time
func (s *SQLiteRollupStore) DeleteOldRollups(ctx context.Context, cutoffTime time.Time) error {
	err := s.infraStore.GetQueries().DeleteOldRollups(ctx, cutoffTime.Format(time.RFC3339))
	if err != nil {
		return fmt.Errorf("failed to delete old rollups: %w", err)
	}
	return nil
}

// DeleteRollupsByDirID deletes all rollups for a specific directory
func (s *SQLiteRollupStore) DeleteRollupsByDirID(ctx context.Context, dirID int64) error {
	err := s.infraStore.GetQueries().DeleteRollupsByDirId(ctx, dirID)
	if err != nil {
		return fmt.Errorf("failed to delete rollups by dir ID: %w", err)
	}
	return nil
}

// CountRollupsByDirID counts rollups for a specific directory
func (s *SQLiteRollupStore) CountRollupsByDirID(ctx context.Context, dirID int64) (int64, error) {
	count, err := s.infraStore.GetQueries().CountRollupsByDirId(ctx, dirID)
	if err != nil {
		return 0, fmt.Errorf("failed to count rollups by dir ID: %w", err)
	}
	return count, nil
}

// GetRollupStats retrieves aggregate rollup statistics
func (s *SQLiteRollupStore) GetRollupStats(ctx context.Context) (*models.RollupStats, error) {
	stats, err := s.infraStore.GetQueries().GetRollupStats(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to get rollup stats: %w", err)
	}

	return &models.RollupStats{
		TotalRollups: stats.TotalRollups,
		OldestRollup: parseTimeFromString(stats.OldestRollup),
		NewestRollup: parseTimeFromString(stats.NewestRollup),
	}, nil
}

// executeBatchInsertDirRollups executes a batch insert for directory rollups
func (s *SQLiteRollupStore) executeBatchInsertDirRollups(ctx context.Context, rollups []*models.DirRollup) error {
	for _, rollup := range rollups {
		_, err := s.infraStore.GetQueries().CreateDirRollup(ctx, sqlite.CreateDirRollupParams{
			DirID:      rollup.DirID,
			SizeBytes:  rollup.SizeBytes,
			FileCount:  rollup.FileCount,
			ComputedAt: rollup.CreatedAt.Format(time.RFC3339),
		})
		if err != nil {
			return err
		}
	}
	return nil
}

// parseTimeFromString safely parses a time string, returning zero time if empty or invalid
func parseTimeFromString(timeStr interface{}) *time.Time {
	if timeStr == nil {
		return nil
	}
	if str, ok := timeStr.(string); ok && str != "" {
		if t, err := parseSQLiteTime(str); err == nil {
			return &t
		}
	}
	return nil
}