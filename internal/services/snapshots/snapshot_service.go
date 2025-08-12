package snapshots

import (
	"context"
	"fmt"
	"log"
	"time"

	"github.com/mantonx/volumeviz/internal/store"
)

// SnapshotService handles creating and managing usage snapshots
type SnapshotService struct {
	store store.Store
}

// NewSnapshotService creates a new snapshot service
func NewSnapshotService(store store.Store) *SnapshotService {
	return &SnapshotService{
		store: store,
	}
}

// CreateDailySnapshot creates a daily usage snapshot for a volume
func (ss *SnapshotService) CreateDailySnapshot(ctx context.Context, params CreateSnapshotParams) (*store.UsageSnapshot, error) {
	// Calculate growth from previous snapshot
	growth, err := ss.calculateGrowth(ctx, params.VolumeID, "daily")
	if err != nil {
		log.Printf("Warning: failed to calculate growth for volume %s: %v", params.VolumeID, err)
		// Continue with zero growth values
	}

	// Calculate growth rate (bytes per day)
	growthRate := float64(0)
	if growth.DaysSinceLastSnapshot > 0 {
		growthRate = float64(growth.SizeGrowth) / float64(growth.DaysSinceLastSnapshot)
	}

	snapshot, err := ss.store.CreateUsageSnapshot(ctx, store.CreateUsageSnapshotParams{
		VolumeID:              params.VolumeID,
		SnapshotDate:          time.Now().UTC().Truncate(24 * time.Hour), // Today's date
		SnapshotType:          "daily",
		TotalSize:             params.TotalSize,
		FileCount:             params.FileCount,
		DirectoryCount:        params.DirectoryCount,
		LargestFile:           params.LargestFile,
		GrowthBytes:           growth.SizeGrowth,
		GrowthFiles:           growth.FileGrowth,
		GrowthRateBytesPerDay: growthRate,
		ScanMethod:            params.ScanMethod,
		ScanDurationMs:        params.ScanDurationMs,
	})

	if err != nil {
		return nil, fmt.Errorf("failed to create daily snapshot: %w", err)
	}

	log.Printf("Created daily snapshot for volume %s: %d bytes, %d files",
		params.VolumeID, params.TotalSize, params.FileCount)

	return snapshot, nil
}

// calculateGrowth calculates growth metrics compared to the previous snapshot
func (ss *SnapshotService) calculateGrowth(ctx context.Context, volumeID, snapshotType string) (*GrowthMetrics, error) {
	latestSnapshot, err := ss.store.GetLatestSnapshot(ctx, volumeID, snapshotType)

	if err != nil {
		// No previous snapshot exists
		return &GrowthMetrics{}, nil
	}

	// Calculate days since last snapshot
	now := time.Now().UTC().Truncate(24 * time.Hour)
	daysSince := int64(now.Sub(latestSnapshot.SnapshotDate).Hours() / 24)

	return &GrowthMetrics{
		SizeGrowth:            0, // Will be calculated when creating the new snapshot
		FileGrowth:            0, // Will be calculated when creating the new snapshot
		DaysSinceLastSnapshot: daysSince,
		PreviousSnapshotDate:  latestSnapshot.SnapshotDate,
		PreviousSize:          latestSnapshot.TotalSize,
		PreviousFileCount:     latestSnapshot.FileCount,
	}, nil
}

// GetTrendsData retrieves trend analysis data for a volume
func (ss *SnapshotService) GetTrendsData(ctx context.Context, volumeID string, days int) (*TrendsData, error) {
	// Get 7-day trend
	trend7Day, err := ss.store.Get7DayTrend(ctx, volumeID)
	if err != nil {
		return nil, fmt.Errorf("failed to get 7-day trend: %w", err)
	}

	// Get 30-day trend
	trend30Day, err := ss.store.Get30DayTrend(ctx, volumeID)
	if err != nil {
		return nil, fmt.Errorf("failed to get 30-day trend: %w", err)
	}

	// Get step series data
	startDate := time.Now().UTC().AddDate(0, 0, -days).Truncate(24 * time.Hour)
	stepSeries, err := ss.store.GetVolumeStepSeries(ctx, store.GetVolumeStepSeriesParams{
		VolumeID:     volumeID,
		SnapshotType: "daily",
		Date:         startDate,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to get step series: %w", err)
	}

	// Calculate slope for trend line
	slope, err := ss.store.GetTrendSlope(ctx, store.GetTrendSlopeParams{
		VolumeID:     volumeID,
		SnapshotType: "daily",
		Date:         startDate,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to get trend slope: %w", err)
	}

	return &TrendsData{
		VolumeID:   volumeID,
		Trend7Day:  trend7Day,
		Trend30Day: trend30Day,
		StepSeries: stepSeries,
		TrendSlope: slope.Slope,
		DataPoints: int(slope.DataPoints),
		PeriodDays: days,
	}, nil
}

// CreateSnapshotParams holds parameters for creating a snapshot
type CreateSnapshotParams struct {
	VolumeID       string
	TotalSize      int64
	FileCount      int64
	DirectoryCount int64
	LargestFile    int64
	ScanMethod     string
	ScanDurationMs int64
}

// GrowthMetrics holds growth calculation results
type GrowthMetrics struct {
	SizeGrowth            int64
	FileGrowth            int64
	DaysSinceLastSnapshot int64
	PreviousSnapshotDate  time.Time
	PreviousSize          int64
	PreviousFileCount     int64
}

// TrendsData holds trend analysis results
type TrendsData struct {
	VolumeID   string                   `json:"volume_id"`
	Trend7Day  *store.TrendData         `json:"trend_7_day"`
	Trend30Day *store.TrendData         `json:"trend_30_day"`
	StepSeries []*store.StepSeriesPoint `json:"step_series"`
	TrendSlope float64                  `json:"trend_slope"`
	DataPoints int                      `json:"data_points"`
	PeriodDays int                      `json:"period_days"`
}
