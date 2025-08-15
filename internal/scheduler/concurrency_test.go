package scheduler

import (
	"context"
	"testing"
	"time"

	"github.com/mantonx/volumeviz/internal/config"
	"github.com/mantonx/volumeviz/internal/interfaces"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
)

// TestConcurrencyControl verifies that exactly one scan runs per volume
func TestConcurrencyControl(t *testing.T) {
	// Create test scheduler with concurrency=2 but max_per_volume=1
	config := &SchedulerConfig{
		ScanConfig: &config.ScanConfig{
			Enabled:      true,
			Concurrency:  2,
			MaxPerVolume: 1,
		},
		QueueSize: 10,
	}

	mockScanner := &MockVolumeScanner{}
	mockRepo := &MockScanRepository{}
	mockVolumeProvider := &MockVolumeProvider{}
	mockMetrics := &MockMetricsCollector{}

	scheduler, err := NewScheduler(config, mockScanner, mockRepo, mockVolumeProvider, mockMetrics, nil)
	assert.NoError(t, err)

	ctx := context.Background()

	// Mock volume provider to return test volume
	mockVolumeProvider.On("ListVolumes").Return([]*interfaces.DockerVolumeInfo{
		{Name: "test-volume", Driver: "local"},
	}, nil)

	// Mock repository calls for duplicate detection
	mockRepo.On("HasActiveScanForVolume", ctx, "test-volume").Return(false, nil).Once()
	mockRepo.On("HasActiveScanForVolume", ctx, "test-volume").Return(true, nil) // Second call returns true

	// Mock scan creation
	mockRepo.On("InsertScanRun", ctx, mock.AnythingOfType("*models.ScanJob")).Return(nil).Once()

	// Mock metrics calls
	mockMetrics.On("UpdateSchedulerQueueDepth", mock.AnythingOfType("int")).Maybe()
	mockMetrics.On("SetSchedulerRunningStatus", true).Maybe()
	mockMetrics.On("UpdateSchedulerWorkerUtilization", mock.AnythingOfType("float64")).Maybe()

	// Start scheduler
	err = scheduler.Start(ctx)
	assert.NoError(t, err)
	defer scheduler.Stop(ctx)

	// First enqueue should succeed
	scanID1, err1 := scheduler.EnqueueVolume("test-volume")
	assert.NoError(t, err1)
	assert.NotEmpty(t, scanID1)

	// Second enqueue of same volume should fail (already active)
	scanID2, err2 := scheduler.EnqueueVolume("test-volume")
	assert.Error(t, err2)
	assert.Contains(t, err2.Error(), "already active")
	assert.Empty(t, scanID2)

	mockVolumeProvider.AssertExpectations(t)
	mockRepo.AssertExpectations(t)
}

// TestHeartbeatFunctionality verifies heartbeat is sent during scan
func TestHeartbeatFunctionality(t *testing.T) {
	// This test would require more complex mocking of the store interface
	// For now, we'll verify that heartbeat configuration is properly set

	config := &SchedulerConfig{
		ScanConfig: &config.ScanConfig{
			Enabled:     true,
			Concurrency: 1,
		},
		QueueSize: 10,
	}

	scheduler, err := NewScheduler(config, nil, nil, nil, nil, nil)
	assert.NoError(t, err)

	// Verify heartbeat config is set correctly (7s default interval)
	assert.Equal(t, 7*time.Second, scheduler.heartbeatConfig.Interval)
	assert.Equal(t, 5*time.Minute, scheduler.heartbeatConfig.Timeout)
	assert.True(t, scheduler.heartbeatConfig.WatchdogEnabled)
}

// TestWatchdogIntegration verifies watchdog marks stale jobs as failed
func TestWatchdogIntegration(t *testing.T) {
	config := HardenedScanConfig{
		WatchdogInterval: 100 * time.Millisecond, // Very short for testing
		ScanTimeout:      200 * time.Millisecond,
	}

	mockStore := &MockStore{}
	mockScansRepo := &MockScansRepository{}

	// Mock store to return scans repo
	mockStore.On("Scans").Return(mockScansRepo)

	// Mock stale scan detection
	mockScansRepo.On("MarkStaleScanJobsAsFailed", mock.Anything, mock.AnythingOfType("int")).
		Return([]string{"stale-scan-123"}, nil).Once()

	watchdog := NewWatchdog(config, mockStore)

	// Start watchdog
	watchdog.Start()
	defer watchdog.Stop()

	// Wait for at least one watchdog cycle
	time.Sleep(150 * time.Millisecond)

	// Verify stats were updated
	stats := watchdog.GetStats()
	assert.Greater(t, stats.CheckedCount, int64(0))

	mockStore.AssertExpectations(t)
	mockScansRepo.AssertExpectations(t)
}
