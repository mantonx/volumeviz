package lifecycle

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/mantonx/volumeviz/internal/repo"
	"github.com/mantonx/volumeviz/internal/store"
)

// Mock store for testing
type mockStore struct {
	mock.Mock
}

func (m *mockStore) WithTx(ctx context.Context, fn func(store.TxStore) error) error {
	args := m.Called(ctx, fn)
	return args.Error(0)
}

func (m *mockStore) Volumes() repo.VolumesRepo {
	args := m.Called()
	return args.Get(0).(repo.VolumesRepo)
}

func (m *mockStore) Scans() repo.ScansRepo {
	args := m.Called()
	return args.Get(0).(repo.ScansRepo)
}

func (m *mockStore) Retention() repo.RetentionRepo {
	args := m.Called()
	return args.Get(0).(repo.RetentionRepo)
}

// Implement other store interface methods as needed
func (m *mockStore) CreateUsageSnapshot(ctx context.Context, params store.CreateUsageSnapshotParams) (*store.UsageSnapshot, error) {
	args := m.Called(ctx, params)
	return args.Get(0).(*store.UsageSnapshot), args.Error(1)
}

func (m *mockStore) GetLatestSnapshot(ctx context.Context, volumeID, snapshotType string) (*store.UsageSnapshot, error) {
	args := m.Called(ctx, volumeID, snapshotType)
	return args.Get(0).(*store.UsageSnapshot), args.Error(1)
}

func (m *mockStore) Get7DayTrend(ctx context.Context, volumeID string) (*store.TrendData, error) {
	args := m.Called(ctx, volumeID)
	return args.Get(0).(*store.TrendData), args.Error(1)
}

func (m *mockStore) Get30DayTrend(ctx context.Context, volumeID string) (*store.TrendData, error) {
	args := m.Called(ctx, volumeID)
	return args.Get(0).(*store.TrendData), args.Error(1)
}

func (m *mockStore) GetVolumeStepSeries(ctx context.Context, params store.GetVolumeStepSeriesParams) ([]*store.StepSeriesPoint, error) {
	args := m.Called(ctx, params)
	return args.Get(0).([]*store.StepSeriesPoint), args.Error(1)
}

func (m *mockStore) GetTrendSlope(ctx context.Context, params store.GetTrendSlopeParams) (*store.TrendSlope, error) {
	args := m.Called(ctx, params)
	return args.Get(0).(*store.TrendSlope), args.Error(1)
}

func (m *mockStore) GetGrowthDeltas(ctx context.Context, params store.GetGrowthDeltasParams) (*store.GrowthDeltas, error) {
	args := m.Called(ctx, params)
	return args.Get(0).(*store.GrowthDeltas), args.Error(1)
}

// Mock retention repo
type mockRetentionRepo struct {
	mock.Mock
}

func (m *mockRetentionRepo) PruneVolumeMetrics(ctx context.Context, ttlDays int) (int64, error) {
	args := m.Called(ctx, ttlDays)
	return args.Get(0).(int64), args.Error(1)
}

func (m *mockRetentionRepo) PruneVolumeSizes(ctx context.Context, ttlDays int) (int64, error) {
	args := m.Called(ctx, ttlDays)
	return args.Get(0).(int64), args.Error(1)
}

func (m *mockRetentionRepo) PruneScanJobs(ctx context.Context, ttlDays int) (int64, error) {
	args := m.Called(ctx, ttlDays)
	return args.Get(0).(int64), args.Error(1)
}

func (m *mockRetentionRepo) CreateDailyRollupTable(ctx context.Context) error {
	args := m.Called(ctx)
	return args.Error(0)
}

func (m *mockRetentionRepo) RollupDailyMetrics(ctx context.Context) error {
	args := m.Called(ctx)
	return args.Error(0)
}

func TestRetentionService_Lifecycle(t *testing.T) {
	// Create mocks
	mockStore := new(mockStore)
	mockRepo := new(mockRetentionRepo)
	
	// Setup expectations
	mockStore.On("Retention").Return(mockRepo)
	mockRepo.On("PruneVolumeMetrics", mock.Anything, 7).Return(int64(10), nil)
	mockRepo.On("PruneVolumeSizes", mock.Anything, 30).Return(int64(5), nil)
	mockRepo.On("PruneScanJobs", mock.Anything, 30).Return(int64(3), nil)
	mockRepo.On("CreateDailyRollupTable", mock.Anything).Return(nil)
	mockRepo.On("RollupDailyMetrics", mock.Anything).Return(nil)
	
	cfg := Config{
		Enabled:        true,
		MetricsTTLDays: 7,
		SizesTTLDays:   30,
		RollupEnabled:  true,
		Interval:       1 * time.Hour,
		InitialDelay:   0,
	}
	
	service := New(mockStore, cfg)
	
	// Test runOnce
	ctx := context.Background()
	service.runOnce(ctx)
	
	// Verify all expectations were met
	mockStore.AssertExpectations(t)
	mockRepo.AssertExpectations(t)
}

func TestRetentionService_DisabledConfig(t *testing.T) {
	mockStore := new(mockStore)
	
	cfg := Config{
		Enabled: false,
	}
	
	service := New(mockStore, cfg)
	service.Start()
	
	// Service should exit immediately when disabled
	select {
	case <-service.doneCh:
		// Expected
	case <-time.After(100 * time.Millisecond):
		t.Fatal("Service did not exit when disabled")
	}
}

func TestRetentionService_StartStop(t *testing.T) {
	mockStore := new(mockStore)
	mockRepo := new(mockRetentionRepo)
	
	// Setup expectations for at least one run
	mockStore.On("Retention").Return(mockRepo).Maybe()
	mockRepo.On("PruneVolumeMetrics", mock.Anything, mock.Anything).Return(int64(0), nil).Maybe()
	mockRepo.On("PruneVolumeSizes", mock.Anything, mock.Anything).Return(int64(0), nil).Maybe()
	mockRepo.On("PruneScanJobs", mock.Anything, mock.Anything).Return(int64(0), nil).Maybe()
	
	cfg := Config{
		Enabled:        true,
		MetricsTTLDays: 7,
		SizesTTLDays:   30,
		RollupEnabled:  false,
		Interval:       10 * time.Second, // Long interval to avoid multiple runs
		InitialDelay:   50 * time.Millisecond,
	}
	
	service := New(mockStore, cfg)
	service.Start()
	
	// Let it run briefly
	time.Sleep(100 * time.Millisecond)
	
	// Stop the service
	service.Stop()
	
	// Verify service stopped
	select {
	case <-service.doneCh:
		// Already closed, good
	default:
		assert.Fail(t, "Service doneCh should be closed after Stop()")
	}
}