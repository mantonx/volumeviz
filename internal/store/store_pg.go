package store

import (
	"context"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/mantonx/volumeviz/internal/db"
	"github.com/mantonx/volumeviz/internal/db/sqlc"
	"github.com/mantonx/volumeviz/internal/repo"
)

// pgStore implements Store using PostgreSQL
type pgStore struct {
	conn *db.PostgreSQLConnection
}

// NewPostgreSQLStore creates a new PostgreSQL store
func NewPostgreSQLStore(conn *db.PostgreSQLConnection) Store {
	return &pgStore{conn: conn}
}

// WithTx executes a function within a database transaction
func (s *pgStore) WithTx(ctx context.Context, fn func(TxStore) error) error {
	return pgx.BeginFunc(ctx, s.conn.Pool, func(tx pgx.Tx) error {
		txStore := &pgTxStore{
			tx:      tx,
			queries: s.conn.Queries.WithTx(tx),
		}
		return fn(txStore)
	})
}

// Volumes returns a volumes repository using the pool connection
func (s *pgStore) Volumes() repo.VolumesRepo {
	return repo.NewVolumesRepo(s.conn.Queries)
}

// Scans returns a scans repository using the pool connection
func (s *pgStore) Scans() repo.ScansRepo {
	return repo.NewScansRepo(s.conn.Queries)
}

// Retention returns a retention repository using the pool connection
func (s *pgStore) Retention() repo.RetentionRepo {
	return repo.NewRetentionRepo(s.conn.Queries)
}

// Analytics and snapshots methods - these will delegate to the appropriate repositories
// For now, returning stub implementations to maintain interface compatibility

func (s *pgStore) CreateUsageSnapshot(ctx context.Context, params CreateUsageSnapshotParams) (*UsageSnapshot, error) {
	// TODO: Implement when analytics repository is added
	return &UsageSnapshot{
		ID:             1,
		VolumeID:       params.VolumeID,
		SnapshotDate:   params.SnapshotDate,
		SnapshotType:   params.SnapshotType,
		TotalSize:      params.TotalSize,
		FileCount:      params.FileCount,
		DirectoryCount: params.DirectoryCount,
		LargestFile:    params.LargestFile,
		ScanMethod:     params.ScanMethod,
		CreatedAt:      time.Now(),
		UpdatedAt:      time.Now(),
	}, nil
}

func (s *pgStore) GetLatestSnapshot(ctx context.Context, volumeID, snapshotType string) (*UsageSnapshot, error) {
	// TODO: Implement when analytics repository is added
	return &UsageSnapshot{
		ID:           1,
		VolumeID:     volumeID,
		SnapshotType: snapshotType,
		CreatedAt:    time.Now(),
		UpdatedAt:    time.Now(),
	}, nil
}

func (s *pgStore) Get7DayTrend(ctx context.Context, volumeID string) (*TrendData, error) {
	// TODO: Implement when analytics repository is added
	return &TrendData{
		VolumeID:              volumeID,
		TrendPeriod:           "7day",
		GrowthRateBytesPerDay: 0,
		GrowthRateFilesPerDay: 0,
	}, nil
}

func (s *pgStore) Get30DayTrend(ctx context.Context, volumeID string) (*TrendData, error) {
	// TODO: Implement when analytics repository is added
	return &TrendData{
		VolumeID:              volumeID,
		TrendPeriod:           "30day",
		GrowthRateBytesPerDay: 0,
		GrowthRateFilesPerDay: 0,
	}, nil
}

func (s *pgStore) GetVolumeStepSeries(ctx context.Context, params GetVolumeStepSeriesParams) ([]*StepSeriesPoint, error) {
	// TODO: Implement when analytics repository is added
	return []*StepSeriesPoint{
		{
			Timestamp: time.Now(),
			Size:      0,
			FileCount: 0,
		},
	}, nil
}

func (s *pgStore) GetTrendSlope(ctx context.Context, params GetTrendSlopeParams) (*TrendSlope, error) {
	// TODO: Implement when analytics repository is added
	return &TrendSlope{
		SizeSlope:      0,
		FileCountSlope: 0,
	}, nil
}

func (s *pgStore) GetGrowthDeltas(ctx context.Context, params GetGrowthDeltasParams) (*GrowthDeltas, error) {
	// TODO: Implement when analytics repository is added
	return &GrowthDeltas{
		VolumeID:   params.VolumeID,
		SizeGrowth: 0,
		FileGrowth: 0,
		GrowthRate: 0,
		Period:     "7d",
	}, nil
}

// pgTxStore implements TxStore for PostgreSQL transactions
type pgTxStore struct {
	tx      pgx.Tx
	queries *sqlc.Queries
}

// Volumes returns a volumes repository using the transaction connection
func (s *pgTxStore) Volumes() repo.VolumesRepo {
	return repo.NewVolumesRepo(s.queries)
}

// Scans returns a scans repository using the transaction connection
func (s *pgTxStore) Scans() repo.ScansRepo {
	return repo.NewScansRepo(s.queries)
}

// Retention returns a retention repository using the transaction connection
func (s *pgTxStore) Retention() repo.RetentionRepo {
	return repo.NewRetentionRepo(s.queries)
}