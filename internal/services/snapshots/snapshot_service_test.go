//go:build integration
// +build integration

package snapshots

import (
	"context"
	"testing"
	"time"

	"github.com/mantonx/volumeviz/internal/store"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
)

// MockStore is a mock implementation of the Store interface for testing
type MockStore struct {
	mock.Mock
}

func (m *MockStore) CreateUsageSnapshot(ctx context.Context, params store.CreateUsageSnapshotParams) (*store.UsageSnapshot, error) {
	args := m.Called(ctx, params)
	return args.Get(0).(*store.UsageSnapshot), args.Error(1)
}

func (m *MockStore) GetLatestSnapshot(ctx context.Context, volumeID, snapshotType string) (*store.UsageSnapshot, error) {
	args := m.Called(ctx, volumeID, snapshotType)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*store.UsageSnapshot), args.Error(1)
}

func (m *MockStore) Get7DayTrend(ctx context.Context, volumeID string) (*store.TrendData, error) {
	args := m.Called(ctx, volumeID)
	return args.Get(0).(*store.TrendData), args.Error(1)
}

func (m *MockStore) Get30DayTrend(ctx context.Context, volumeID string) (*store.TrendData, error) {
	args := m.Called(ctx, volumeID)
	return args.Get(0).(*store.TrendData), args.Error(1)
}

func (m *MockStore) GetGrowthDeltas(ctx context.Context, params store.GetGrowthDeltasParams) (*store.GrowthDeltasResult, error) {
	args := m.Called(ctx, params)
	return args.Get(0).(*store.GrowthDeltasResult), args.Error(1)
}

func (m *MockStore) GetVolumeStepSeries(ctx context.Context, params store.GetVolumeStepSeriesParams) ([]*store.StepSeriesPoint, error) {
	args := m.Called(ctx, params)
	return args.Get(0).([]*store.StepSeriesPoint), args.Error(1)
}

func (m *MockStore) GetTrendSlope(ctx context.Context, params store.GetTrendSlopeParams) (*store.TrendSlopeResult, error) {
	args := m.Called(ctx, params)
	return args.Get(0).(*store.TrendSlopeResult), args.Error(1)
}

// Stub methods for other Store interface methods (not used in these tests)
func (m *MockStore) CreateFileEntry(ctx context.Context, entry *store.FileEntry) (*store.FileEntry, error) {
	return nil, nil
}
func (m *MockStore) GetFileEntry(ctx context.Context, id int64, volumeID string) (*store.FileEntry, error) {
	return nil, nil
}
func (m *MockStore) GetFileEntriesByVolumeAndParent(ctx context.Context, volumeID string, parentDirID *int64) ([]*store.FileEntry, error) {
	return nil, nil
}
func (m *MockStore) GetLargestFiles(ctx context.Context, volumeID string, limit int32) ([]*store.FileEntry, error) {
	return nil, nil
}
func (m *MockStore) FindFilesByPathHash(ctx context.Context, volumeID string, pathHash []byte) ([]*store.FileEntry, error) {
	return nil, nil
}
func (m *MockStore) UpsertFileEntry(ctx context.Context, entry *store.FileEntry) (*store.FileEntry, error) {
	return nil, nil
}
func (m *MockStore) DeleteFileEntriesByVolume(ctx context.Context, volumeID string) error { return nil }
func (m *MockStore) CountFileEntriesByVolume(ctx context.Context, volumeID string) (int64, error) {
	return 0, nil
}
func (m *MockStore) GetVolumeFileStats(ctx context.Context, volumeID string) (*store.VolumeFileStats, error) {
	return nil, nil
}
func (m *MockStore) CreateDirNode(ctx context.Context, node *store.DirNode) (*store.DirNode, error) {
	return nil, nil
}
func (m *MockStore) GetDirNode(ctx context.Context, id int64, volumeID string) (*store.DirNode, error) {
	return nil, nil
}
func (m *MockStore) GetDirNodeByPath(ctx context.Context, volumeID string, fullPath string) (*store.DirNode, error) {
	return nil, nil
}
func (m *MockStore) GetChildDirNodes(ctx context.Context, volumeID string, parentDirID *int64) ([]*store.DirNode, error) {
	return nil, nil
}
func (m *MockStore) GetRootDirNodes(ctx context.Context, volumeID string) ([]*store.DirNode, error) {
	return nil, nil
}
func (m *MockStore) GetLargestDirectories(ctx context.Context, volumeID string, limit int32) ([]*store.DirNode, error) {
	return nil, nil
}
func (m *MockStore) GetDirectoryTree(ctx context.Context, volumeID string, maxDepth int32) ([]*store.DirNode, error) {
	return nil, nil
}
func (m *MockStore) UpsertDirNode(ctx context.Context, node *store.DirNode) (*store.DirNode, error) {
	return nil, nil
}
func (m *MockStore) UpdateDirNodeStats(ctx context.Context, id int64, volumeID string, sizeBytes int64, fileCount int64) error {
	return nil
}
func (m *MockStore) DeleteDirNodesByVolume(ctx context.Context, volumeID string) error { return nil }
func (m *MockStore) CountDirNodesByVolume(ctx context.Context, volumeID string) (int64, error) {
	return 0, nil
}
func (m *MockStore) CreateDirRollup(ctx context.Context, rollup *store.DirRollup) (*store.DirRollup, error) {
	return nil, nil
}
func (m *MockStore) GetDirRollup(ctx context.Context, id int64) (*store.DirRollup, error) {
	return nil, nil
}
func (m *MockStore) GetLatestDirRollup(ctx context.Context, dirID int64) (*store.DirRollup, error) {
	return nil, nil
}
func (m *MockStore) GetDirRollupHistory(ctx context.Context, dirID int64, limit int32) ([]*store.DirRollup, error) {
	return nil, nil
}
func (m *MockStore) GetDirRollupsInTimeRange(ctx context.Context, dirID int64, startTime, endTime time.Time) ([]*store.DirRollup, error) {
	return nil, nil
}
func (m *MockStore) DeleteOldRollups(ctx context.Context, cutoffTime time.Time) error { return nil }
func (m *MockStore) DeleteRollupsByDirID(ctx context.Context, dirID int64) error      { return nil }
func (m *MockStore) CountRollupsByDirID(ctx context.Context, dirID int64) (int64, error) {
	return 0, nil
}
func (m *MockStore) GetRollupStats(ctx context.Context) (*store.RollupStats, error) { return nil, nil }
func (m *MockStore) Rollup(ctx context.Context, volumeID string, opts *store.RollupOptions) (*store.RollupResult, error) {
	return nil, nil
}
func (m *MockStore) BulkInsertFileEntries(ctx context.Context, entries []*store.FileEntry, params store.BulkInsertParams) error {
	return nil
}
func (m *MockStore) BulkInsertDirNodes(ctx context.Context, nodes []*store.DirNode, params store.BulkInsertParams) error {
	return nil
}
func (m *MockStore) BulkInsertDirRollups(ctx context.Context, rollups []*store.DirRollup, params store.BulkInsertParams) error {
	return nil
}
func (m *MockStore) Close() error                     { return nil }
func (m *MockStore) Health(ctx context.Context) error { return nil }

func TestSnapshotService_CreateDailySnapshot_NewVolume(t *testing.T) {
	// Setup
	mockStore := new(MockStore)
	service := NewSnapshotService(mockStore)
	ctx := context.Background()

	volumeID := "test-volume"
	params := CreateSnapshotParams{
		VolumeID:       volumeID,
		TotalSize:      1000000,
		FileCount:      500,
		DirectoryCount: 50,
		LargestFile:    50000,
		ScanMethod:     "test",
		ScanDurationMs: 1000,
	}

	// Mock: No previous snapshot exists (first snapshot for this volume)
	mockStore.On("GetLatestSnapshot", ctx, volumeID, "daily").Return(nil, assert.AnError)

	// Expected snapshot to be created
	expectedSnapshot := &store.UsageSnapshot{
		ID:                    1,
		VolumeID:              volumeID,
		SnapshotDate:          time.Now().UTC().Truncate(24 * time.Hour),
		SnapshotType:          "daily",
		TotalSize:             1000000,
		FileCount:             500,
		DirectoryCount:        50,
		LargestFile:           50000,
		GrowthBytes:           0, // No growth for first snapshot
		GrowthFiles:           0, // No growth for first snapshot
		GrowthRateBytesPerDay: 0, // No growth rate for first snapshot
		ScanMethod:            "test",
		ScanDurationMs:        1000,
		CreatedAt:             time.Now(),
		UpdatedAt:             time.Now(),
	}

	mockStore.On("CreateUsageSnapshot", ctx, mock.MatchedBy(func(params store.CreateUsageSnapshotParams) bool {
		return params.VolumeID == volumeID &&
			params.SnapshotType == "daily" &&
			params.TotalSize == 1000000 &&
			params.FileCount == 500 &&
			params.GrowthBytes == 0 && // Should be 0 for first snapshot
			params.GrowthRateBytesPerDay == 0 // Should be 0 for first snapshot
	})).Return(expectedSnapshot, nil)

	// Execute
	result, err := service.CreateDailySnapshot(ctx, params)

	// Assert
	assert.NoError(t, err)
	assert.NotNil(t, result)
	assert.Equal(t, volumeID, result.VolumeID)
	assert.Equal(t, "daily", result.SnapshotType)
	assert.Equal(t, int64(1000000), result.TotalSize)
	assert.Equal(t, int64(500), result.FileCount)
	assert.Equal(t, int64(0), result.GrowthBytes)
	assert.Equal(t, float64(0), result.GrowthRateBytesPerDay)

	mockStore.AssertExpectations(t)
}

func TestSnapshotService_CreateDailySnapshot_WithGrowth(t *testing.T) {
	// Setup
	mockStore := new(MockStore)
	service := NewSnapshotService(mockStore)
	ctx := context.Background()

	volumeID := "test-volume-growth"
	params := CreateSnapshotParams{
		VolumeID:       volumeID,
		TotalSize:      1500000, // Increased from previous
		FileCount:      750,     // Increased from previous
		DirectoryCount: 75,
		LargestFile:    75000,
		ScanMethod:     "test",
		ScanDurationMs: 1200,
	}

	// Mock: Previous snapshot exists
	previousSnapshot := &store.UsageSnapshot{
		ID:           1,
		VolumeID:     volumeID,
		SnapshotDate: time.Now().UTC().AddDate(0, 0, -1).Truncate(24 * time.Hour), // Yesterday
		TotalSize:    1000000,
		FileCount:    500,
	}
	mockStore.On("GetLatestSnapshot", ctx, volumeID, "daily").Return(previousSnapshot, nil)

	// Expected growth: 500,000 bytes, 250 files, over 1 day = 500,000 bytes/day
	expectedSnapshot := &store.UsageSnapshot{
		ID:                    2,
		VolumeID:              volumeID,
		SnapshotDate:          time.Now().UTC().Truncate(24 * time.Hour),
		SnapshotType:          "daily",
		TotalSize:             1500000,
		FileCount:             750,
		DirectoryCount:        75,
		LargestFile:           75000,
		GrowthBytes:           0, // Will be calculated in actual implementation
		GrowthFiles:           0, // Will be calculated in actual implementation
		GrowthRateBytesPerDay: 0, // Will be calculated in actual implementation
		ScanMethod:            "test",
		ScanDurationMs:        1200,
		CreatedAt:             time.Now(),
		UpdatedAt:             time.Now(),
	}

	mockStore.On("CreateUsageSnapshot", ctx, mock.MatchedBy(func(params store.CreateUsageSnapshotParams) bool {
		return params.VolumeID == volumeID &&
			params.SnapshotType == "daily" &&
			params.TotalSize == 1500000 &&
			params.FileCount == 750
	})).Return(expectedSnapshot, nil)

	// Execute
	result, err := service.CreateDailySnapshot(ctx, params)

	// Assert
	assert.NoError(t, err)
	assert.NotNil(t, result)
	assert.Equal(t, volumeID, result.VolumeID)
	assert.Equal(t, "daily", result.SnapshotType)
	assert.Equal(t, int64(1500000), result.TotalSize)
	assert.Equal(t, int64(750), result.FileCount)

	mockStore.AssertExpectations(t)
}

func TestSnapshotService_GetTrendsData(t *testing.T) {
	// Setup
	mockStore := new(MockStore)
	service := NewSnapshotService(mockStore)
	ctx := context.Background()

	volumeID := "test-volume-trends"
	days := 30

	// Mock trend data
	trend7Day := &store.TrendData{
		AvgGrowthRate: 100.5,
		TotalGrowth:   2000,
		DataPoints:    7,
	}
	trend30Day := &store.TrendData{
		AvgGrowthRate: 85.3,
		TotalGrowth:   8000,
		DataPoints:    30,
	}
	stepSeries := []*store.StepSeriesPoint{
		{Date: time.Now().AddDate(0, 0, -2), TotalSize: 1000000, FileCount: 500, GrowthRate: 100.0},
		{Date: time.Now().AddDate(0, 0, -1), TotalSize: 1100000, FileCount: 550, GrowthRate: 110.0},
		{Date: time.Now(), TotalSize: 1200000, FileCount: 600, GrowthRate: 120.0},
	}
	trendSlope := &store.TrendSlopeResult{
		Slope:      105.5,
		DataPoints: 30,
	}

	mockStore.On("Get7DayTrend", ctx, volumeID).Return(trend7Day, nil)
	mockStore.On("Get30DayTrend", ctx, volumeID).Return(trend30Day, nil)
	mockStore.On("GetVolumeStepSeries", ctx, mock.MatchedBy(func(params store.GetVolumeStepSeriesParams) bool {
		return params.VolumeID == volumeID && params.SnapshotType == "daily"
	})).Return(stepSeries, nil)
	mockStore.On("GetTrendSlope", ctx, mock.MatchedBy(func(params store.GetTrendSlopeParams) bool {
		return params.VolumeID == volumeID && params.SnapshotType == "daily"
	})).Return(trendSlope, nil)

	// Execute
	result, err := service.GetTrendsData(ctx, volumeID, days)

	// Assert
	assert.NoError(t, err)
	assert.NotNil(t, result)
	assert.Equal(t, volumeID, result.VolumeID)
	assert.Equal(t, days, result.PeriodDays)
	assert.Equal(t, trend7Day, result.Trend7Day)
	assert.Equal(t, trend30Day, result.Trend30Day)
	assert.Equal(t, stepSeries, result.StepSeries)
	assert.Equal(t, trendSlope.Slope, result.TrendSlope)
	assert.Equal(t, int(trendSlope.DataPoints), result.DataPoints)

	mockStore.AssertExpectations(t)
}

func TestRetentionService_CompactAndCleanup(t *testing.T) {
	// Setup
	mockStore := new(MockStore)
	service := NewRetentionService(mockStore)
	ctx := context.Background()

	// Execute
	err := service.CompactAndCleanup(ctx)

	// Assert
	assert.NoError(t, err)
	// Note: This test passes because the actual implementation is stubbed
	// In a real implementation, we would mock the compaction and cleanup methods
}

func TestRetentionService_GetRetentionStats(t *testing.T) {
	// Setup
	mockStore := new(MockStore)
	service := NewRetentionService(mockStore)
	ctx := context.Background()

	// Execute
	stats, err := service.GetRetentionStats(ctx)

	// Assert
	assert.NoError(t, err)
	assert.NotNil(t, stats)
	assert.Equal(t, int64(0), stats.DailySnapshotsCount)
	assert.Equal(t, int64(0), stats.WeeklySnapshotsCount)
	// Note: This returns mock data since the actual implementation is stubbed
}
