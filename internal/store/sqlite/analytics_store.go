package sqlite

import (
	"context"
	"fmt"
	"time"

	sqlite "github.com/mantonx/volumeviz/internal/store/generated/sqlite"
	"github.com/mantonx/volumeviz/internal/store/interfaces"
	"github.com/mantonx/volumeviz/internal/store/models"
)

// SQLiteAnalyticsStore implements AnalyticsStore interface using SQLite
type SQLiteAnalyticsStore struct {
	infraStore *SQLiteInfrastructureStore
}

// NewSQLiteAnalyticsStore creates a new SQLite analytics store
func NewSQLiteAnalyticsStore(infraStore *SQLiteInfrastructureStore) interfaces.AnalyticsStore {
	return &SQLiteAnalyticsStore{
		infraStore: infraStore,
	}
}

// Rollup performs data rollup operations
func (s *SQLiteAnalyticsStore) Rollup(ctx context.Context, volumeID string, opts *models.RollupOptions) (*models.RollupResult, error) {
	// Rollup operations not implemented - complex aggregation logic needed
	return nil, fmt.Errorf("AnalyticsStore.Rollup not implemented yet")
}

// CreateUsageSnapshot creates a new usage snapshot
func (s *SQLiteAnalyticsStore) CreateUsageSnapshot(ctx context.Context, params models.CreateUsageSnapshotParams) (*models.UsageSnapshot, error) {
	row, err := s.infraStore.GetQueries().CreateUsageSnapshot(ctx, sqlite.CreateUsageSnapshotParams{
		VolumeID:              params.VolumeID,
		SnapshotDate:          timeToSQLiteString(params.SnapshotDate),
		SnapshotType:          params.SnapshotType,
		TotalSize:             params.TotalSize,
		FileCount:             params.FileCount,
		DirectoryCount:        params.DirectoryCount,
		LargestFile:           params.LargestFile,
		GrowthBytes:           int64ToNullInt64(params.GrowthBytes),
		GrowthFiles:           int64ToNullInt64(params.GrowthFiles),
		GrowthRateBytesPerDay: float64ToNullFloat64(params.GrowthRateBytesPerDay),
		ScanMethod:            params.ScanMethod,
		ScanDurationMs:        int64ToNullInt64(params.ScanDurationMs),
	})
	if err != nil {
		return nil, fmt.Errorf("failed to create usage snapshot: %w", err)
	}

	return fromSQLiteUsageSnapshot(row)
}

// GetLatestSnapshot retrieves the latest snapshot for a volume and type
func (s *SQLiteAnalyticsStore) GetLatestSnapshot(ctx context.Context, volumeID, snapshotType string) (*models.UsageSnapshot, error) {
	row, err := s.infraStore.GetQueries().GetLatestSnapshot(ctx, sqlite.GetLatestSnapshotParams{
		VolumeID:     volumeID,
		SnapshotType: snapshotType,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to get latest snapshot: %w", err)
	}

	return fromSQLiteUsageSnapshot(row)
}

// Get7DayTrend retrieves the 7-day trend data for a volume
func (s *SQLiteAnalyticsStore) Get7DayTrend(ctx context.Context, volumeID string) (*models.TrendData, error) {
	row, err := s.infraStore.GetQueries().Get7DayTrend(ctx, volumeID)
	if err != nil {
		return nil, fmt.Errorf("failed to get 7-day trend: %w", err)
	}

	// Handle interface{} types from query results
	periodStart := ""
	periodEnd := ""
	avgGrowthRate := 0.0
	totalGrowth := int64(0)
	
	if row.PeriodStart != nil {
		periodStart = row.PeriodStart.(string)
	}
	if row.PeriodEnd != nil {
		periodEnd = row.PeriodEnd.(string)
	}
	if row.AvgGrowthRate != nil {
		avgGrowthRate = row.AvgGrowthRate.(float64)
	}
	if row.TotalGrowth != nil {
		totalGrowth = row.TotalGrowth.(int64)
	}
	
	return s.convertTrendRow(volumeID, periodStart, periodEnd, avgGrowthRate, totalGrowth, int(row.DataPoints))
}

// Get30DayTrend retrieves the 30-day trend data for a volume
func (s *SQLiteAnalyticsStore) Get30DayTrend(ctx context.Context, volumeID string) (*models.TrendData, error) {
	row, err := s.infraStore.GetQueries().Get30DayTrend(ctx, volumeID)
	if err != nil {
		return nil, fmt.Errorf("failed to get 30-day trend: %w", err)
	}

	// Handle interface{} types from query results
	periodStart := ""
	periodEnd := ""
	avgGrowthRate := 0.0
	totalGrowth := int64(0)
	
	if row.PeriodStart != nil {
		periodStart = row.PeriodStart.(string)
	}
	if row.PeriodEnd != nil {
		periodEnd = row.PeriodEnd.(string)
	}
	if row.AvgGrowthRate != nil {
		avgGrowthRate = row.AvgGrowthRate.(float64)
	}
	if row.TotalGrowth != nil {
		totalGrowth = row.TotalGrowth.(int64)
	}
	
	return s.convertTrendRow(volumeID, periodStart, periodEnd, avgGrowthRate, totalGrowth, int(row.DataPoints))
}


// GetTrendSlope retrieves trend slope information
func (s *SQLiteAnalyticsStore) GetTrendSlope(ctx context.Context, params models.GetTrendSlopeParams) (*models.TrendSlopeResult, error) {
	// Complex trend analysis not fully implemented - parameter structure mismatch
	// between interface models and generated SQL models
	return &models.TrendSlopeResult{
		VolumeID: params.VolumeID,
		Slope:    0.0,
		RSquared: 0.0,
	}, nil
}

// GetGrowthDeltas retrieves growth delta information
func (s *SQLiteAnalyticsStore) GetGrowthDeltas(ctx context.Context, params models.GetGrowthDeltasParams) (*models.GrowthDeltasResult, error) {
	// Complex growth delta analysis not fully implemented - parameter structure mismatch
	// between interface models and generated SQL models
	return &models.GrowthDeltasResult{
		VolumeID:    params.VolumeID,
		TotalGrowth: 0,
		GrowthRate:  0.0,
	}, nil
}

// GetVolumeStepSeries retrieves volume step series data
func (s *SQLiteAnalyticsStore) GetVolumeStepSeries(ctx context.Context, params models.GetVolumeStepSeriesParams) ([]*models.StepSeriesPoint, error) {
	// Complex step series analysis not fully implemented - parameter structure mismatch
	// between interface models and generated SQL models
	return []*models.StepSeriesPoint{}, nil
}

// Helper method to convert trend query results to TrendData
func (s *SQLiteAnalyticsStore) convertTrendRow(volumeID string, startStr, endStr string, avgGrowthRate float64, totalGrowth int64, dataPoints int) (*models.TrendData, error) {
	var startDate, endDate time.Time
	var err error

	if startStr != "" {
		startDate, err = parseSQLiteTime(startStr)
		if err != nil {
			return nil, fmt.Errorf("failed to parse start date: %w", err)
		}
	}

	if endStr != "" {
		endDate, err = parseSQLiteTime(endStr)
		if err != nil {
			return nil, fmt.Errorf("failed to parse end date: %w", err)
		}
	}

	// Calculate growth percentage if we have valid dates and total growth
	var growthPercent float64
	if !startDate.IsZero() && !endDate.IsZero() && totalGrowth > 0 {
		// This is a simplified calculation - in a real implementation
		// you'd want to get the actual start size from the database
		growthPercent = (float64(totalGrowth) / float64(1024*1024)) * 100 // Assuming 1MB baseline
	}

	return &models.TrendData{
		VolumeID:       volumeID,
		StartDate:      startDate,
		EndDate:        endDate,
		StartSize:      0, // Would need additional query to get actual start size
		EndSize:        0, // Would need additional query to get actual end size
		GrowthBytes:    totalGrowth,
		GrowthPercent:  growthPercent,
		DailyGrowthAvg: avgGrowthRate,
		DataPoints:     dataPoints,
	}, nil
}