package postgres

import (
	"context"
	"fmt"
	"time"

	"github.com/mantonx/volumeviz/internal/store/generated/postgres"
	"github.com/mantonx/volumeviz/internal/store/interfaces"
	"github.com/mantonx/volumeviz/internal/store/models"
)

// PostgresAnalyticsStore implements AnalyticsStore interface for PostgreSQL
type PostgresAnalyticsStore struct {
	*PostgresInfrastructureStore
}

// NewPostgresAnalyticsStore creates a new PostgreSQL analytics store
func NewPostgresAnalyticsStore(infra *PostgresInfrastructureStore) interfaces.AnalyticsStore {
	return &PostgresAnalyticsStore{
		PostgresInfrastructureStore: infra,
	}
}

// CreateUsageSnapshot creates a new usage snapshot
func (s *PostgresAnalyticsStore) CreateUsageSnapshot(ctx context.Context, params models.CreateUsageSnapshotParams) (*models.UsageSnapshot, error) {
	snapshotParams := postgres.CreateUsageSnapshotParams{
		VolumeID:       params.VolumeID,
		SnapshotDate:   params.SnapshotDate,
		SnapshotType:   params.SnapshotType,
		TotalSize:      params.TotalSize,
		FileCount:      params.FileCount,
		DirectoryCount: params.DirectoryCount,
		LargestFile:    params.LargestFile,
		ScanMethod:     params.ScanMethod,
	}

	row, err := s.queries.CreateUsageSnapshot(ctx, snapshotParams)
	if err != nil {
		return nil, fmt.Errorf("failed to create usage snapshot: %w", err)
	}

	return &models.UsageSnapshot{
		ID:             row.ID,
		VolumeID:       row.VolumeID,
		SnapshotDate:   row.SnapshotDate,
		SnapshotType:   row.SnapshotType,
		TotalSize:      row.TotalSize,
		FileCount:      row.FileCount,
		DirectoryCount: row.DirectoryCount,
		LargestFile:    row.LargestFile,
		ScanMethod:     row.ScanMethod,
		CreatedAt:      row.CreatedAt,
		UpdatedAt:      row.UpdatedAt,
	}, nil
}

// GetLatestSnapshot retrieves the latest snapshot for a volume and type
func (s *PostgresAnalyticsStore) GetLatestSnapshot(ctx context.Context, volumeID, snapshotType string) (*models.UsageSnapshot, error) {
	row, err := s.queries.GetLatestSnapshot(ctx, postgres.GetLatestSnapshotParams{
		VolumeID:     volumeID,
		SnapshotType: snapshotType,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to get latest snapshot: %w", err)
	}

	return &models.UsageSnapshot{
		ID:             row.ID,
		VolumeID:       row.VolumeID,
		SnapshotDate:   row.SnapshotDate,
		SnapshotType:   row.SnapshotType,
		TotalSize:      row.TotalSize,
		FileCount:      row.FileCount,
		DirectoryCount: row.DirectoryCount,
		LargestFile:    row.LargestFile,
		ScanMethod:     row.ScanMethod,
		CreatedAt:      row.CreatedAt,
		UpdatedAt:      row.UpdatedAt,
	}, nil
}

// Get7DayTrend retrieves 7-day trend data for a volume
func (s *PostgresAnalyticsStore) Get7DayTrend(ctx context.Context, volumeID string) (*models.TrendData, error) {
	row, err := s.queries.Get7DayTrend(ctx, volumeID)
	if err != nil {
		return nil, fmt.Errorf("failed to get 7-day trend: %w", err)
	}

	return &models.TrendData{
		StartSize:      row.StartSize,
		EndSize:        row.EndSize,
		StartFileCount: row.StartFileCount,
		EndFileCount:   row.EndFileCount,
		GrowthBytes:    row.GrowthBytes,
		GrowthFiles:    row.GrowthFiles,
		GrowthRate:     row.GrowthRate,
		TrendPeriod:    "7_days",
	}, nil
}

// Get30DayTrend retrieves 30-day trend data for a volume
func (s *PostgresAnalyticsStore) Get30DayTrend(ctx context.Context, volumeID string) (*models.TrendData, error) {
	row, err := s.queries.Get30DayTrend(ctx, volumeID)
	if err != nil {
		return nil, fmt.Errorf("failed to get 30-day trend: %w", err)
	}

	return &models.TrendData{
		StartSize:      row.StartSize,
		EndSize:        row.EndSize,
		StartFileCount: row.StartFileCount,
		EndFileCount:   row.EndFileCount,
		GrowthBytes:    row.GrowthBytes,
		GrowthFiles:    row.GrowthFiles,
		GrowthRate:     row.GrowthRate,
		TrendPeriod:    "30_days",
	}, nil
}

// GetGrowthDeltas retrieves growth delta information
func (s *PostgresAnalyticsStore) GetGrowthDeltas(ctx context.Context, params models.GetGrowthDeltasParams) (*models.GrowthDeltasResult, error) {
	queryParams := postgres.GetGrowthDeltasParams{
		VolumeID:    params.VolumeID,
		StartDate:   params.StartDate,
		EndDate:     params.EndDate,
	}

	row, err := s.queries.GetGrowthDeltas(ctx, queryParams)
	if err != nil {
		return nil, fmt.Errorf("failed to get growth deltas: %w", err)
	}

	return &models.GrowthDeltasResult{
		VolumeID:       row.VolumeID,
		StartDate:      row.StartDate,
		EndDate:        row.EndDate,
		TotalGrowth:    row.TotalGrowth,
		FileGrowth:     row.FileGrowth,
		AvgDailyGrowth: row.AvgDailyGrowth,
		MaxDailyGrowth: row.MaxDailyGrowth,
	}, nil
}

// GetVolumeStepSeries retrieves step series data for visualization
func (s *PostgresAnalyticsStore) GetVolumeStepSeries(ctx context.Context, params models.GetVolumeStepSeriesParams) ([]*models.StepSeriesPoint, error) {
	queryParams := postgres.GetVolumeStepSeriesParams{
		VolumeID:     params.VolumeID,
		StartDate:    params.StartDate,
		EndDate:      params.EndDate,
		StepInterval: params.StepInterval,
	}

	rows, err := s.queries.GetVolumeStepSeries(ctx, queryParams)
	if err != nil {
		return nil, fmt.Errorf("failed to get volume step series: %w", err)
	}

	points := make([]*models.StepSeriesPoint, len(rows))
	for i, row := range rows {
		points[i] = &models.StepSeriesPoint{
			Timestamp:   row.Timestamp,
			TotalSize:   row.TotalSize,
			FileCount:   row.FileCount,
			GrowthBytes: row.GrowthBytes,
			GrowthFiles: row.GrowthFiles,
		}
	}

	return points, nil
}

// GetTrendSlope calculates trend slope for a volume
func (s *PostgresAnalyticsStore) GetTrendSlope(ctx context.Context, params models.GetTrendSlopeParams) (*models.TrendSlopeResult, error) {
	queryParams := postgres.GetTrendSlopeParams{
		VolumeID:   params.VolumeID,
		StartDate:  params.StartDate,
		EndDate:    params.EndDate,
		MetricType: params.MetricType,
	}

	row, err := s.queries.GetTrendSlope(ctx, queryParams)
	if err != nil {
		return nil, fmt.Errorf("failed to get trend slope: %w", err)
	}

	return &models.TrendSlopeResult{
		VolumeID:       row.VolumeID,
		MetricType:     row.MetricType,
		Slope:          row.Slope,
		RSquared:       row.RSquared,
		TrendDirection: row.TrendDirection,
		Confidence:     row.Confidence,
	}, nil
}

// Rollup performs rollup operations with configurable options
func (s *PostgresAnalyticsStore) Rollup(ctx context.Context, volumeID string, opts *models.RollupOptions) (*models.RollupResult, error) {
	// For now, this is a placeholder implementation
	// The actual rollup logic would be more complex and may involve multiple queries
	return &models.RollupResult{
		VolumeID:         volumeID,
		ProcessedRecords: 0,
		StartTime:        time.Now(),
		EndTime:          time.Now(),
		Success:          true,
	}, fmt.Errorf("rollup not implemented for PostgreSQL yet")
}