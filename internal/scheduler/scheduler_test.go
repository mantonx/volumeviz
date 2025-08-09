package scheduler

import (
	"context"
	"testing"
	"time"

	"github.com/mantonx/volumeviz/internal/config"
	"github.com/mantonx/volumeviz/internal/core/interfaces"
	"github.com/mantonx/volumeviz/internal/database"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
)

// MockVolumeScanner implements interfaces.VolumeScanner for testing
type MockVolumeScanner struct {
	mock.Mock
}

func (m *MockVolumeScanner) ScanVolume(ctx context.Context, volumeID string) (*interfaces.ScanResult, error) {
	args := m.Called(ctx, volumeID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*interfaces.ScanResult), args.Error(1)
}

func (m *MockVolumeScanner) ScanVolumeAsync(ctx context.Context, volumeID string) (string, error) {
	args := m.Called(ctx, volumeID)
	return args.String(0), args.Error(1)
}

func (m *MockVolumeScanner) GetScanProgress(scanID string) (*interfaces.ScanProgress, error) {
	args := m.Called(scanID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*interfaces.ScanProgress), args.Error(1)
}

func (m *MockVolumeScanner) GetAvailableMethods() []interfaces.MethodInfo {
	args := m.Called()
	return args.Get(0).([]interfaces.MethodInfo)
}

func (m *MockVolumeScanner) ClearCache(volumeID string) error {
	args := m.Called(volumeID)
	return args.Error(0)
}

// MockScanRepository implements ScanRepository for testing
type MockScanRepository struct {
	mock.Mock
}

func (m *MockScanRepository) InsertVolumeStats(ctx context.Context, stats *database.VolumeScanStats) error {
	args := m.Called(ctx, stats)
	return args.Error(0)
}

func (m *MockScanRepository) GetVolumeStatsByName(ctx context.Context, volumeName string, limit int) ([]*database.VolumeScanStats, error) {
	args := m.Called(ctx, volumeName, limit)
	return args.Get(0).([]*database.VolumeScanStats), args.Error(1)
}

func (m *MockScanRepository) GetLatestVolumeStats(ctx context.Context, volumeName string) (*database.VolumeScanStats, error) {
	args := m.Called(ctx, volumeName)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*database.VolumeScanStats), args.Error(1)
}

func (m *MockScanRepository) InsertScanRun(ctx context.Context, run *database.ScanJob) error {
	args := m.Called(ctx, run)
	return args.Error(0)
}

func (m *MockScanRepository) UpdateScanRun(ctx context.Context, run *database.ScanJob) error {
	args := m.Called(ctx, run)
	return args.Error(0)
}

func (m *MockScanRepository) GetScanRunByID(ctx context.Context, scanID string) (*database.ScanJob, error) {
	args := m.Called(ctx, scanID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*database.ScanJob), args.Error(1)
}

func (m *MockScanRepository) GetActiveScanRuns(ctx context.Context) ([]*database.ScanJob, error) {
	args := m.Called(ctx)
	return args.Get(0).([]*database.ScanJob), args.Error(1)
}

func (m *MockScanRepository) ListVolumes(ctx context.Context) ([]*database.Volume, error) {
	args := m.Called(ctx)
	return args.Get(0).([]*database.Volume), args.Error(1)
}

func (m *MockScanRepository) UpsertVolume(ctx context.Context, volume *database.Volume) error {
	args := m.Called(ctx, volume)
	return args.Error(0)
}

// MockVolumeProvider implements VolumeProvider for testing
type MockVolumeProvider struct {
	mock.Mock
}

func (m *MockVolumeProvider) ListVolumes(ctx context.Context) ([]*database.Volume, error) {
	args := m.Called(ctx)
	return args.Get(0).([]*database.Volume), args.Error(1)
}

func (m *MockVolumeProvider) GetVolume(ctx context.Context, volumeName string) (*database.Volume, error) {
	args := m.Called(ctx, volumeName)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*database.Volume), args.Error(1)
}

// MockMetricsCollector implements interfaces.MetricsCollector for testing
type MockMetricsCollector struct {
	mock.Mock
}

func (m *MockMetricsCollector) CacheHit(volumeID string) {
	m.Called(volumeID)
}

func (m *MockMetricsCollector) CacheMiss(volumeID string) {
	m.Called(volumeID)
}

func (m *MockMetricsCollector) ScanCompleted(volumeID, method string, duration time.Duration, size int64) {
	m.Called(volumeID, method, duration, size)
}

func (m *MockMetricsCollector) RecordScanAttempt(method string, duration time.Duration, success bool) {
	m.Called(method, duration, success)
}

func (m *MockMetricsCollector) ScanQueueDepth(depth int) {
	m.Called(depth)
}

func (m *MockMetricsCollector) RecordScanFailure(method, errorCode string) {
	m.Called(method, errorCode)
}

func (m *MockMetricsCollector) UpdateVolumeMetrics(volumeID, volumeName, driver, filesystemType string, size int64, fileCount int, scanMethod string) {
	m.Called(volumeID, volumeName, driver, filesystemType, size, fileCount, scanMethod)
}

func (m *MockMetricsCollector) SetDockerConnectionStatus(connected bool) {
	m.Called(connected)
}

func (m *MockMetricsCollector) SetCacheSize(size int) {
	m.Called(size)
}

func (m *MockMetricsCollector) SetActiveScanners(count int) {
	m.Called(count)
}

func (m *MockMetricsCollector) ScanStarted(method string) {
	m.Called(method)
}

func (m *MockMetricsCollector) ScanFinished(method string) {
	m.Called(method)
}

func (m *MockMetricsCollector) SetSchedulerRunningStatus(running bool) {
	m.Called(running)
}

func (m *MockMetricsCollector) UpdateSchedulerQueueDepth(depth int) {
	m.Called(depth)
}

func (m *MockMetricsCollector) UpdateSchedulerWorkerUtilization(utilization float64) {
	m.Called(utilization)
}

// Helper function to create a test scheduler
func createTestScheduler() (*Scheduler, *MockVolumeScanner, *MockScanRepository, *MockVolumeProvider, *MockMetricsCollector) {
	mockScanner := &MockVolumeScanner{}
	mockRepo := &MockScanRepository{}
	mockProvider := &MockVolumeProvider{}
	mockMetrics := &MockMetricsCollector{}

	schedulerConfig := &SchedulerConfig{
		ScanConfig: &config.ScanConfig{
			Enabled:              true,
			Interval:             5 * time.Minute,
			Concurrency:          2,
			TimeoutPerVolume:     30 * time.Second,
			MethodsOrder:         []string{"diskus", "du"},
			BindMountsEnabled:    false,
			BindAllowList:        []string{},
			SkipPattern:          "^test_",
		},
		QueueSize: 10,
	}

	scheduler, _ := NewScheduler(schedulerConfig, mockScanner, mockRepo, mockProvider, mockMetrics)
	return scheduler, mockScanner, mockRepo, mockProvider, mockMetrics
}

func TestNewScheduler(t *testing.T) {
	schedulerConfig := &SchedulerConfig{
		ScanConfig: &config.ScanConfig{
			Enabled:              true,
			Interval:             5 * time.Minute,
			Concurrency:          2,
			TimeoutPerVolume:     30 * time.Second,
			MethodsOrder:         []string{"diskus", "du"},
			BindMountsEnabled:    false,
			BindAllowList:        []string{},
			SkipPattern:          "",
		},
		QueueSize: 10,
	}

	mockScanner := &MockVolumeScanner{}
	mockRepo := &MockScanRepository{}
	mockProvider := &MockVolumeProvider{}
	mockMetrics := &MockMetricsCollector{}

	scheduler, err := NewScheduler(schedulerConfig, mockScanner, mockRepo, mockProvider, mockMetrics)

	assert.NoError(t, err)
	assert.NotNil(t, scheduler)
	assert.Equal(t, schedulerConfig, scheduler.config)
	assert.Equal(t, mockScanner, scheduler.scanner)
	assert.Equal(t, mockRepo, scheduler.repository)
	assert.Equal(t, mockProvider, scheduler.volumeProvider)
	assert.Equal(t, mockMetrics, scheduler.metricsCollector)
	assert.False(t, scheduler.running)
}

func TestNewSchedulerWithInvalidSkipPattern(t *testing.T) {
	schedulerConfig := &SchedulerConfig{
		ScanConfig: &config.ScanConfig{
			Enabled:              true,
			Interval:             5 * time.Minute,
			Concurrency:          2,
			TimeoutPerVolume:     30 * time.Second,
			MethodsOrder:         []string{"diskus", "du"},
			BindMountsEnabled:    false,
			BindAllowList:        []string{},
			SkipPattern:          "[invalid-regex",
		},
		QueueSize: 10,
	}

	mockScanner := &MockVolumeScanner{}
	mockRepo := &MockScanRepository{}
	mockProvider := &MockVolumeProvider{}
	mockMetrics := &MockMetricsCollector{}

	scheduler, err := NewScheduler(schedulerConfig, mockScanner, mockRepo, mockProvider, mockMetrics)

	assert.Error(t, err)
	assert.Nil(t, scheduler)
	assert.Contains(t, err.Error(), "invalid skip pattern")
}

func TestSchedulerStart(t *testing.T) {
	scheduler, _, _, _, mockMetrics := createTestScheduler()
	ctx := context.Background()

	// Expect metrics calls when starting
	mockMetrics.On("SetSchedulerRunningStatus", true).Once()
	mockMetrics.On("UpdateSchedulerQueueDepth", 0).Once()
	mockMetrics.On("UpdateSchedulerWorkerUtilization", 0.0).Once()

	// Expect metrics calls when stopping
	mockMetrics.On("SetSchedulerRunningStatus", false).Once()
	mockMetrics.On("UpdateSchedulerQueueDepth", 0).Once()
	mockMetrics.On("UpdateSchedulerWorkerUtilization", 0.0).Once()

	err := scheduler.Start(ctx)

	assert.NoError(t, err)
	assert.True(t, scheduler.IsRunning())

	// Clean up
	scheduler.Stop(ctx)
	mockMetrics.AssertExpectations(t)
}

func TestSchedulerStartWhenDisabled(t *testing.T) {
	scheduler, _, _, _, mockMetrics := createTestScheduler()
	scheduler.config.Enabled = false
	ctx := context.Background()

	mockMetrics.On("SetSchedulerRunningStatus", false).Once()

	err := scheduler.Start(ctx)

	assert.NoError(t, err)
	assert.False(t, scheduler.IsRunning())
	mockMetrics.AssertExpectations(t)
}

func TestSchedulerStartAlreadyRunning(t *testing.T) {
	scheduler, _, _, _, mockMetrics := createTestScheduler()
	ctx := context.Background()

	// Start first time
	mockMetrics.On("SetSchedulerRunningStatus", true).Once()
	mockMetrics.On("UpdateSchedulerQueueDepth", 0).Once()
	mockMetrics.On("UpdateSchedulerWorkerUtilization", 0.0).Once()

	// Expect stop metrics for cleanup
	mockMetrics.On("SetSchedulerRunningStatus", false).Once()
	mockMetrics.On("UpdateSchedulerQueueDepth", 0).Once()
	mockMetrics.On("UpdateSchedulerWorkerUtilization", 0.0).Once()

	err := scheduler.Start(ctx)
	assert.NoError(t, err)

	// Try to start again
	err = scheduler.Start(ctx)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "already running")

	// Clean up
	scheduler.Stop(ctx)
	mockMetrics.AssertExpectations(t)
}

func TestSchedulerStop(t *testing.T) {
	scheduler, _, _, _, mockMetrics := createTestScheduler()
	ctx := context.Background()

	// Start scheduler
	mockMetrics.On("SetSchedulerRunningStatus", true).Once()
	mockMetrics.On("UpdateSchedulerQueueDepth", 0).Once()
	mockMetrics.On("UpdateSchedulerWorkerUtilization", 0.0).Once()

	scheduler.Start(ctx)
	assert.True(t, scheduler.IsRunning())

	// Stop scheduler
	mockMetrics.On("SetSchedulerRunningStatus", false).Once()
	mockMetrics.On("UpdateSchedulerQueueDepth", 0).Once()
	mockMetrics.On("UpdateSchedulerWorkerUtilization", 0.0).Once()

	err := scheduler.Stop(ctx)

	assert.NoError(t, err)
	assert.False(t, scheduler.IsRunning())
	mockMetrics.AssertExpectations(t)
}

func TestSchedulerStopWhenNotRunning(t *testing.T) {
	scheduler, _, _, _, _ := createTestScheduler()
	ctx := context.Background()

	err := scheduler.Stop(ctx)
	assert.NoError(t, err)
	assert.False(t, scheduler.IsRunning())
}

func TestEnqueueVolume(t *testing.T) {
	scheduler, _, _, _, mockMetrics := createTestScheduler()
	ctx := context.Background()

	// Start scheduler
	mockMetrics.On("SetSchedulerRunningStatus", true).Once()
	mockMetrics.On("UpdateSchedulerQueueDepth", 0).Twice() // Once on start, once on enqueue
	mockMetrics.On("UpdateSchedulerWorkerUtilization", mock.AnythingOfType("float64")).Times(3) // Start, enqueue, stop

	// Stop scheduler
	mockMetrics.On("SetSchedulerRunningStatus", false).Once()
	mockMetrics.On("UpdateSchedulerQueueDepth", 0).Once()

	scheduler.Start(ctx)

	scanID, err := scheduler.EnqueueVolume("test-volume")

	assert.NoError(t, err)
	assert.NotEmpty(t, scanID)

	// Clean up
	scheduler.Stop(ctx)
	mockMetrics.AssertExpectations(t)
}

func TestEnqueueVolumeWhenNotRunning(t *testing.T) {
	scheduler, _, _, _, _ := createTestScheduler()

	scanID, err := scheduler.EnqueueVolume("test-volume")

	assert.Error(t, err)
	assert.Empty(t, scanID)
	assert.Contains(t, err.Error(), "scheduler not running")
}

func TestEnqueueVolumeSkipPattern(t *testing.T) {
	scheduler, _, _, _, mockMetrics := createTestScheduler()
	ctx := context.Background()

	// Start scheduler
	mockMetrics.On("SetSchedulerRunningStatus", true).Once()
	mockMetrics.On("UpdateSchedulerQueueDepth", 0).Once()
	mockMetrics.On("UpdateSchedulerWorkerUtilization", 0.0).Once()

	// Stop scheduler
	mockMetrics.On("SetSchedulerRunningStatus", false).Once()
	mockMetrics.On("UpdateSchedulerQueueDepth", 0).Once()
	mockMetrics.On("UpdateSchedulerWorkerUtilization", 0.0).Once()

	scheduler.Start(ctx)

	// Try to enqueue a volume that matches skip pattern
	scanID, err := scheduler.EnqueueVolume("test_volume") // matches ^test_ pattern

	assert.Error(t, err)
	assert.Empty(t, scanID)
	assert.Contains(t, err.Error(), "matches skip pattern")

	// Clean up
	scheduler.Stop(ctx)
	mockMetrics.AssertExpectations(t)
}

func TestEnqueueAllVolumes(t *testing.T) {
	scheduler, _, _, mockProvider, mockMetrics := createTestScheduler()
	ctx := context.Background()

	// Mock volumes
	volumes := []*database.Volume{
		{Name: "volume1"},
		{Name: "volume2"},
	}
	mockProvider.On("ListVolumes", mock.AnythingOfType("*context.cancelCtx")).Return(volumes, nil)

	// Start scheduler
	mockMetrics.On("SetSchedulerRunningStatus", true).Once()
	mockMetrics.On("UpdateSchedulerQueueDepth", mock.AnythingOfType("int")).Times(3) // Start + 2 enqueues
	mockMetrics.On("UpdateSchedulerWorkerUtilization", mock.AnythingOfType("float64")).Times(3)

	// Stop scheduler
	mockMetrics.On("SetSchedulerRunningStatus", false).Once()
	mockMetrics.On("UpdateSchedulerQueueDepth", 0).Once()
	mockMetrics.On("UpdateSchedulerWorkerUtilization", 0.0).Once()

	scheduler.Start(ctx)

	batchID, err := scheduler.EnqueueAllVolumes()

	assert.NoError(t, err)
	assert.NotEmpty(t, batchID)

	// Clean up
	scheduler.Stop(ctx)
	mockProvider.AssertExpectations(t)
	mockMetrics.AssertExpectations(t)
}

func TestEnqueueAllVolumesRateLimit(t *testing.T) {
	scheduler, _, _, mockProvider, mockMetrics := createTestScheduler()
	ctx := context.Background()

	// Mock volumes
	volumes := []*database.Volume{
		{Name: "volume1"},
	}
	mockProvider.On("ListVolumes", mock.AnythingOfType("*context.cancelCtx")).Return(volumes, nil).Once()

	// Start scheduler
	mockMetrics.On("SetSchedulerRunningStatus", true).Once()
	mockMetrics.On("UpdateSchedulerQueueDepth", mock.AnythingOfType("int")).Twice()
	mockMetrics.On("UpdateSchedulerWorkerUtilization", mock.AnythingOfType("float64")).Twice()

	// Stop scheduler
	mockMetrics.On("SetSchedulerRunningStatus", false).Once()
	mockMetrics.On("UpdateSchedulerQueueDepth", 0).Once()
	mockMetrics.On("UpdateSchedulerWorkerUtilization", 0.0).Once()

	scheduler.Start(ctx)

	// First call should succeed
	batchID1, err1 := scheduler.EnqueueAllVolumes()
	assert.NoError(t, err1)
	assert.NotEmpty(t, batchID1)

	// Second immediate call should be rate limited
	batchID2, err2 := scheduler.EnqueueAllVolumes()
	assert.Error(t, err2)
	assert.Empty(t, batchID2)
	assert.Contains(t, err2.Error(), "rate limited")

	// Clean up
	scheduler.Stop(ctx)
	mockProvider.AssertExpectations(t)
	mockMetrics.AssertExpectations(t)
}

func TestGetStatus(t *testing.T) {
	scheduler, _, _, _, _ := createTestScheduler()

	status := scheduler.GetStatus()

	assert.NotNil(t, status)
	assert.False(t, status.Running)
	assert.Equal(t, 2, status.WorkerCount) // From config
	assert.Equal(t, 0, status.QueueDepth)
	assert.Equal(t, 0, status.ActiveScans)
}

func TestGetMetrics(t *testing.T) {
	scheduler, _, _, _, _ := createTestScheduler()

	metrics := scheduler.GetMetrics()

	assert.NotNil(t, metrics)
	assert.Equal(t, 0, metrics.QueueDepth)
	assert.Equal(t, 0, metrics.ActiveScans)
	assert.NotNil(t, metrics.CompletedScans)
	assert.NotNil(t, metrics.ScanDurations)
	assert.NotNil(t, metrics.ErrorCounts)
	assert.Equal(t, 0.0, metrics.WorkerUtilization)
}

func TestShouldSkipVolume(t *testing.T) {
	scheduler, _, _, _, _ := createTestScheduler()

	// Test with skip pattern ^test_
	assert.True(t, scheduler.shouldSkipVolume("test_volume"))
	assert.True(t, scheduler.shouldSkipVolume("test_123"))
	assert.False(t, scheduler.shouldSkipVolume("my_test_volume"))
	assert.False(t, scheduler.shouldSkipVolume("volume"))
}

func TestIsBindMount(t *testing.T) {
	scheduler, _, _, _, _ := createTestScheduler()

	// Test bind mount detection heuristics
	assert.True(t, scheduler.isBindMount("/home/user/data"))
	assert.True(t, scheduler.isBindMount("C:\\Users\\data"))
	assert.False(t, scheduler.isBindMount("volume_name"))
	assert.False(t, scheduler.isBindMount("docker_volume"))
}

func TestIsBindMountAllowed(t *testing.T) {
	scheduler, _, _, _, _ := createTestScheduler()
	
	// Configure bind mounts
	scheduler.config.BindMountsEnabled = true
	scheduler.config.BindAllowList = []string{"/home/user", "/mnt/data"}

	assert.True(t, scheduler.isBindMountAllowed("/home/user/documents"))
	assert.True(t, scheduler.isBindMountAllowed("/mnt/data/files"))
	assert.False(t, scheduler.isBindMountAllowed("/etc/passwd"))
	assert.False(t, scheduler.isBindMountAllowed("/root/secret"))

	// Test when bind mounts disabled
	scheduler.config.BindMountsEnabled = false
	assert.False(t, scheduler.isBindMountAllowed("/home/user/documents"))
}

func TestSelectScanMethod(t *testing.T) {
	scheduler, _, _, _, _ := createTestScheduler()

	method := scheduler.selectScanMethod()
	assert.Equal(t, "diskus", method) // First in MethodsOrder

	// Test fallback when no methods configured
	scheduler.config.MethodsOrder = []string{}
	method = scheduler.selectScanMethod()
	assert.Equal(t, "du", method) // Fallback
}

func TestCalculateWorkerUtilization(t *testing.T) {
	scheduler, _, _, _, _ := createTestScheduler()

	// Initially no active scans
	utilization := scheduler.calculateWorkerUtilization()
	assert.Equal(t, 0.0, utilization)

	// Simulate one active scan (1/2 workers = 50%)
	scheduler.metrics.ActiveScans = 1
	utilization = scheduler.calculateWorkerUtilization()
	assert.Equal(t, 0.5, utilization)

	// Simulate all workers busy (2/2 workers = 100%)
	scheduler.metrics.ActiveScans = 2
	utilization = scheduler.calculateWorkerUtilization()
	assert.Equal(t, 1.0, utilization)
}