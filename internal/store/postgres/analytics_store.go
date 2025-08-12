package postgres

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgtype"
	"github.com/mantonx/volumeviz/internal/store/generated/postgres"
	"github.com/mantonx/volumeviz/internal/store/interfaces"
	"github.com/mantonx/volumeviz/internal/store/models"
)

// PostgresAnalyticsStore implements AnalyticsStore interface for PostgreSQL
type PostgresAnalyticsStore struct {
	*PostgresInfrastructureStore
}

// Helper functions for pgtype conversion
func int64Value(p pgtype.Int8) int64 {
	if !p.Valid {
		return 0
	}
	return p.Int64
}

func float64Value(p pgtype.Float8) float64 {
	if !p.Valid {
		return 0.0
	}
	return p.Float64
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
		VolumeID:              params.VolumeID,
		SnapshotDate:          params.SnapshotDate,
		SnapshotType:          params.SnapshotType,
		TotalSize:             params.TotalSize,
		FileCount:             params.FileCount,
		DirectoryCount:        params.DirectoryCount,
		LargestFile:           params.LargestFile,
		GrowthBytes:           pgtype.Int8{Int64: params.GrowthBytes, Valid: params.GrowthBytes != 0},
		GrowthFiles:           pgtype.Int8{Int64: params.GrowthFiles, Valid: params.GrowthFiles != 0},
		GrowthRateBytesPerDay: pgtype.Float8{Float64: params.GrowthRateBytesPerDay, Valid: params.GrowthRateBytesPerDay != 0.0},
		ScanMethod:            params.ScanMethod,
		ScanDurationMs:        pgtype.Int8{Int64: params.ScanDurationMs, Valid: params.ScanDurationMs != 0},
	}

	row, err := s.queries.CreateUsageSnapshot(ctx, snapshotParams)
	if err != nil {
		return nil, fmt.Errorf("failed to create usage snapshot: %w", err)
	}

	return &models.UsageSnapshot{
		ID:                    row.ID,
		VolumeID:              row.VolumeID,
		SnapshotDate:          row.SnapshotDate,
		SnapshotType:          row.SnapshotType,
		TotalSize:             row.TotalSize,
		FileCount:             row.FileCount,
		DirectoryCount:        row.DirectoryCount,
		LargestFile:           row.LargestFile,
		GrowthBytes:           int64Value(row.GrowthBytes),
		GrowthFiles:           int64Value(row.GrowthFiles),
		GrowthRateBytesPerDay: float64Value(row.GrowthRateBytesPerDay),
		ScanMethod:            row.ScanMethod,
		ScanDurationMs:        int64Value(row.ScanDurationMs),
		CreatedAt:             row.CreatedAt,
		UpdatedAt:             row.UpdatedAt,
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
		ID:                    row.ID,
		VolumeID:              row.VolumeID,
		SnapshotDate:          row.SnapshotDate,
		SnapshotType:          row.SnapshotType,
		TotalSize:             row.TotalSize,
		FileCount:             row.FileCount,
		DirectoryCount:        row.DirectoryCount,
		LargestFile:           row.LargestFile,
		GrowthBytes:           int64Value(row.GrowthBytes),
		GrowthFiles:           int64Value(row.GrowthFiles),
		GrowthRateBytesPerDay: float64Value(row.GrowthRateBytesPerDay),
		ScanMethod:            row.ScanMethod,
		ScanDurationMs:        int64Value(row.ScanDurationMs),
		CreatedAt:             row.CreatedAt,
		UpdatedAt:             row.UpdatedAt,
	}, nil
}

// Get7DayTrend retrieves 7-day trend data for a volume
func (s *PostgresAnalyticsStore) Get7DayTrend(ctx context.Context, volumeID string) (*models.TrendData, error) {
	row, err := s.queries.Get7DayTrend(ctx, volumeID)
	if err != nil {
		return nil, fmt.Errorf("failed to get 7-day trend: %w", err)
	}

	// Convert interface{} values to appropriate types
	var avgGrowthRate float64
	if row.AvgGrowthRate != nil {
		if val, ok := row.AvgGrowthRate.(float64); ok {
			avgGrowthRate = val
		}
	}
	
	var totalGrowth int64
	if row.TotalGrowth != nil {
		if val, ok := row.TotalGrowth.(int64); ok {
			totalGrowth = val
		}
	}
	
	var periodStart, periodEnd time.Time
	if row.PeriodStart != nil {
		if val, ok := row.PeriodStart.(time.Time); ok {
			periodStart = val
		}
	}
	if row.PeriodEnd != nil {
		if val, ok := row.PeriodEnd.(time.Time); ok {
			periodEnd = val
		}
	}

	return &models.TrendData{
		VolumeID:       volumeID,
		StartDate:      periodStart,
		EndDate:        periodEnd,
		GrowthBytes:    totalGrowth,
		DailyGrowthAvg: avgGrowthRate,
		DataPoints:     int(row.DataPoints),
	}, nil
}

// Get30DayTrend retrieves 30-day trend data for a volume
func (s *PostgresAnalyticsStore) Get30DayTrend(ctx context.Context, volumeID string) (*models.TrendData, error) {
	row, err := s.queries.Get30DayTrend(ctx, volumeID)
	if err != nil {
		return nil, fmt.Errorf("failed to get 30-day trend: %w", err)
	}

	// Convert interface{} values to appropriate types
	var avgGrowthRate float64
	if row.AvgGrowthRate != nil {
		if val, ok := row.AvgGrowthRate.(float64); ok {
			avgGrowthRate = val
		}
	}
	
	var totalGrowth int64
	if row.TotalGrowth != nil {
		if val, ok := row.TotalGrowth.(int64); ok {
			totalGrowth = val
		}
	}
	
	var periodStart, periodEnd time.Time
	if row.PeriodStart != nil {
		if val, ok := row.PeriodStart.(time.Time); ok {
			periodStart = val
		}
	}
	if row.PeriodEnd != nil {
		if val, ok := row.PeriodEnd.(time.Time); ok {
			periodEnd = val
		}
	}

	return &models.TrendData{
		VolumeID:       volumeID,
		StartDate:      periodStart,
		EndDate:        periodEnd,
		GrowthBytes:    totalGrowth,
		DailyGrowthAvg: avgGrowthRate,
		DataPoints:     int(row.DataPoints),
	}, nil
}

// GetGrowthDeltas retrieves growth delta information
func (s *PostgresAnalyticsStore) GetGrowthDeltas(ctx context.Context, params models.GetGrowthDeltasParams) (*models.GrowthDeltasResult, error) {
	// The generated query expects different parameters
	queryParams := postgres.GetGrowthDeltasParams{
		VolumeID:     params.VolumeID,
		SnapshotType: "daily", // Default snapshot type
		Limit:        30,      // Default limit
	}

	row, err := s.queries.GetGrowthDeltas(ctx, queryParams)
	if err != nil {
		return nil, fmt.Errorf("failed to get growth deltas: %w", err)
	}

	// Convert interface{} values to appropriate types
	var totalGrowth int64
	if row.TotalSizeChange != nil {
		if val, ok := row.TotalSizeChange.(int64); ok {
			totalGrowth = val
		}
	}
	
	var growthRate float64
	if row.AvgSizeChangePerDay != nil {
		if val, ok := row.AvgSizeChangePerDay.(float64); ok {
			growthRate = val
		}
	}

	return &models.GrowthDeltasResult{
		VolumeID:    params.VolumeID,
		TotalGrowth: totalGrowth,
		GrowthRate:  growthRate,
	}, nil
}

// GetVolumeStepSeries retrieves step series data for visualization
func (s *PostgresAnalyticsStore) GetVolumeStepSeries(ctx context.Context, params models.GetVolumeStepSeriesParams) ([]*models.StepSeriesPoint, error) {
	// The generated query expects different parameters
	queryParams := postgres.GetVolumeStepSeriesParams{
		VolumeID:     params.VolumeID,
		SnapshotType: "daily", // Default snapshot type
		SnapshotDate: params.EndDate, // Use end date as snapshot date
	}

	rows, err := s.queries.GetVolumeStepSeries(ctx, queryParams)
	if err != nil {
		return nil, fmt.Errorf("failed to get volume step series: %w", err)
	}

	points := make([]*models.StepSeriesPoint, len(rows))
	for i, row := range rows {
		points[i] = &models.StepSeriesPoint{
			Timestamp: row.Date,
			Value:     row.TotalSize,
		}
	}

	return points, nil
}

// GetTrendSlope calculates trend slope for a volume
func (s *PostgresAnalyticsStore) GetTrendSlope(ctx context.Context, params models.GetTrendSlopeParams) (*models.TrendSlopeResult, error) {
	// The generated query expects different parameters
	queryParams := postgres.GetTrendSlopeParams{
		VolumeID:     params.VolumeID,
		SnapshotType: "daily", // Default snapshot type
		SnapshotDate: params.EndDate, // Use end date as snapshot date
	}

	row, err := s.queries.GetTrendSlope(ctx, queryParams)
	if err != nil {
		return nil, fmt.Errorf("failed to get trend slope: %w", err)
	}

	// Convert interface{} value to float64
	var slope float64
	if row.Slope != nil {
		if val, ok := row.Slope.(float64); ok {
			slope = val
		}
	}

	return &models.TrendSlopeResult{
		VolumeID: params.VolumeID,
		Slope:    slope,
		RSquared: 0.0, // Not provided by query, using default
	}, nil
}

// Rollup performs rollup operations with configurable options
func (s *PostgresAnalyticsStore) Rollup(ctx context.Context, volumeID string, opts *models.RollupOptions) (*models.RollupResult, error) {
	// For now, this is a placeholder implementation
	// The actual rollup logic would be more complex and may involve multiple queries
	return &models.RollupResult{
		DirectoriesProcessed: 0,
		RollupsCreated:      0,
		RollupsUpdated:      0,
		ProcessingTime:      0,
		ErrorCount:          0,
		LastError:           fmt.Errorf("rollup not implemented for PostgreSQL yet"),
	}, nil
}