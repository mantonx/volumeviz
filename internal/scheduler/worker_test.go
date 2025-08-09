package scheduler

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/mantonx/volumeviz/internal/core/interfaces"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
)

func TestWorkerProcessTaskSuccess(t *testing.T) {
	scheduler, mockScanner, mockRepo, _, mockMetrics := createTestScheduler()
	ctx := context.Background()

	// Create a worker
	worker := &worker{
		id:        0,
		scheduler: scheduler,
		ctx:       ctx,
	}

	// Create a test task
	task := &ScanTask{
		ScanID:     "test-scan-123",
		VolumeName: "test-volume",
		Method:     "diskus",
		Priority:   1,
		CreatedAt:  time.Now(),
		Timeout:    30 * time.Second,
		MaxRetries: 1,
	}

	// Mock successful scan
	scanResult := &interfaces.ScanResult{
		VolumeID:       "test-volume",
		TotalSize:      1024000,
		FileCount:      100,
		DirectoryCount: 10,
		Method:         "diskus",
		ScannedAt:      time.Now(),
		Duration:       5 * time.Second,
	}

	mockScanner.On("ScanVolume", mock.AnythingOfType("*context.timerCtx"), "test-volume").Return(scanResult, nil)
	mockRepo.On("InsertScanRun", ctx, mock.AnythingOfType("*database.ScanJob")).Return(nil)
	mockRepo.On("UpdateScanRun", ctx, mock.AnythingOfType("*database.ScanJob")).Return(nil)
	mockRepo.On("InsertVolumeStats", ctx, mock.AnythingOfType("*database.VolumeScanStats")).Return(nil)

	// Expect metrics calls
	mockMetrics.On("ScanStarted", "diskus").Once()
	mockMetrics.On("UpdateSchedulerWorkerUtilization", mock.AnythingOfType("float64")).Times(2) // Start and end
	mockMetrics.On("ScanCompleted", "test-volume", "diskus", mock.AnythingOfType("time.Duration"), int64(1024000)).Once()
	mockMetrics.On("ScanFinished", "diskus").Once()

	// Process the task
	worker.processTask(task)

	// Verify expectations
	mockScanner.AssertExpectations(t)
	mockRepo.AssertExpectations(t)
	mockMetrics.AssertExpectations(t)
}

func TestWorkerProcessTaskFailure(t *testing.T) {
	scheduler, mockScanner, mockRepo, _, mockMetrics := createTestScheduler()
	ctx := context.Background()

	// Create a worker
	worker := &worker{
		id:        0,
		scheduler: scheduler,
		ctx:       ctx,
	}

	// Create a test task
	task := &ScanTask{
		ScanID:     "test-scan-123",
		VolumeName: "test-volume",
		Method:     "diskus",
		Priority:   1,
		CreatedAt:  time.Now(),
		Timeout:    30 * time.Second,
		MaxRetries: 1,
	}

	// Mock failed scan
	scanError := errors.New("scan failed: permission denied")
	mockScanner.On("ScanVolume", mock.AnythingOfType("*context.timerCtx"), "test-volume").Return(nil, scanError)
	mockRepo.On("InsertScanRun", ctx, mock.AnythingOfType("*database.ScanJob")).Return(nil)
	mockRepo.On("UpdateScanRun", ctx, mock.AnythingOfType("*database.ScanJob")).Return(nil)

	// Expect metrics calls for failure
	mockMetrics.On("ScanStarted", "diskus").Once()
	mockMetrics.On("UpdateSchedulerWorkerUtilization", mock.AnythingOfType("float64")).Times(2) // Start and end
	mockMetrics.On("RecordScanFailure", "diskus", "scan_error").Once()
	mockMetrics.On("ScanFinished", "diskus").Once()

	// Process the task
	worker.processTask(task)

	// Verify expectations
	mockScanner.AssertExpectations(t)
	mockRepo.AssertExpectations(t)
	mockMetrics.AssertExpectations(t)

	// Verify failure metrics were updated
	assert.Equal(t, int64(1), scheduler.status.TotalFailed)
	assert.Equal(t, int64(1), scheduler.metrics.CompletedScans["failed"])
	assert.Equal(t, int64(1), scheduler.metrics.ErrorCounts["scan_error"])
}

func TestWorkerProcessTaskTimeout(t *testing.T) {
	scheduler, mockScanner, mockRepo, _, mockMetrics := createTestScheduler()
	ctx := context.Background()

	// Create a worker
	worker := &worker{
		id:        0,
		scheduler: scheduler,
		ctx:       ctx,
	}

	// Create a test task with very short timeout
	task := &ScanTask{
		ScanID:     "test-scan-123",
		VolumeName: "test-volume",
		Method:     "diskus",
		Priority:   1,
		CreatedAt:  time.Now(),
		Timeout:    1 * time.Millisecond, // Very short timeout
		MaxRetries: 1,
	}

	// Mock scan that takes longer than timeout
	mockScanner.On("ScanVolume", mock.AnythingOfType("*context.timerCtx"), "test-volume").Return(nil, context.DeadlineExceeded)
	mockRepo.On("InsertScanRun", ctx, mock.AnythingOfType("*database.ScanJob")).Return(nil)
	mockRepo.On("UpdateScanRun", ctx, mock.AnythingOfType("*database.ScanJob")).Return(nil)

	// Expect metrics calls for failure
	mockMetrics.On("ScanStarted", "diskus").Once()
	mockMetrics.On("UpdateSchedulerWorkerUtilization", mock.AnythingOfType("float64")).Times(2) // Start and end
	mockMetrics.On("RecordScanFailure", "diskus", "scan_error").Once()
	mockMetrics.On("ScanFinished", "diskus").Once()

	// Process the task
	worker.processTask(task)

	// Verify expectations
	mockScanner.AssertExpectations(t)
	mockRepo.AssertExpectations(t)
	mockMetrics.AssertExpectations(t)
}

func TestWorkerProcessTaskDatabaseError(t *testing.T) {
	scheduler, _, mockRepo, _, mockMetrics := createTestScheduler()
	ctx := context.Background()

	// Create a worker
	worker := &worker{
		id:        0,
		scheduler: scheduler,
		ctx:       ctx,
	}

	// Create a test task
	task := &ScanTask{
		ScanID:     "test-scan-123",
		VolumeName: "test-volume",
		Method:     "diskus",
		Priority:   1,
		CreatedAt:  time.Now(),
		Timeout:    30 * time.Second,
		MaxRetries: 1,
	}

	// Mock database error when inserting scan run
	dbError := errors.New("database connection failed")
	mockRepo.On("InsertScanRun", ctx, mock.AnythingOfType("*database.ScanJob")).Return(dbError)

	// Expect metrics calls
	mockMetrics.On("ScanStarted", "diskus").Once()
	mockMetrics.On("UpdateSchedulerWorkerUtilization", mock.AnythingOfType("float64")).Times(2) // Start and end

	// Process the task - should handle DB error gracefully
	worker.processTask(task)

	// Verify expectations
	mockRepo.AssertExpectations(t)
	mockMetrics.AssertExpectations(t)
}

func TestWorkerProcessTaskVolumeStatsError(t *testing.T) {
	scheduler, mockScanner, mockRepo, _, mockMetrics := createTestScheduler()
	ctx := context.Background()

	// Create a worker
	worker := &worker{
		id:        0,
		scheduler: scheduler,
		ctx:       ctx,
	}

	// Create a test task
	task := &ScanTask{
		ScanID:     "test-scan-123",
		VolumeName: "test-volume",
		Method:     "diskus",
		Priority:   1,
		CreatedAt:  time.Now(),
		Timeout:    30 * time.Second,
		MaxRetries: 1,
	}

	// Mock successful scan
	scanResult := &interfaces.ScanResult{
		VolumeID:       "test-volume",
		TotalSize:      1024000,
		FileCount:      100,
		DirectoryCount: 10,
		Method:         "diskus",
		ScannedAt:      time.Now(),
		Duration:       5 * time.Second,
	}

	mockScanner.On("ScanVolume", mock.AnythingOfType("*context.timerCtx"), "test-volume").Return(scanResult, nil)
	mockRepo.On("InsertScanRun", ctx, mock.AnythingOfType("*database.ScanJob")).Return(nil)
	mockRepo.On("UpdateScanRun", ctx, mock.AnythingOfType("*database.ScanJob")).Return(nil)
	
	// Mock error when inserting volume stats
	statsError := errors.New("failed to insert volume stats")
	mockRepo.On("InsertVolumeStats", ctx, mock.AnythingOfType("*database.VolumeScanStats")).Return(statsError)

	// Expect metrics calls - scan should still be considered successful
	mockMetrics.On("ScanStarted", "diskus").Once()
	mockMetrics.On("UpdateSchedulerWorkerUtilization", mock.AnythingOfType("float64")).Times(2) // Start and end
	mockMetrics.On("ScanCompleted", "test-volume", "diskus", mock.AnythingOfType("time.Duration"), int64(1024000)).Once()
	mockMetrics.On("ScanFinished", "diskus").Once()

	// Process the task
	worker.processTask(task)

	// Verify expectations
	mockScanner.AssertExpectations(t)
	mockRepo.AssertExpectations(t)
	mockMetrics.AssertExpectations(t)
}

func TestWorkerUpdateActiveScans(t *testing.T) {
	scheduler, _, _, _, mockMetrics := createTestScheduler()
	ctx := context.Background()

	// Create a worker
	worker := &worker{
		id:        0,
		scheduler: scheduler,
		ctx:       ctx,
	}

	// Test increasing active scans
	mockMetrics.On("UpdateSchedulerWorkerUtilization", mock.AnythingOfType("float64")).Twice()

	worker.updateActiveScans(1)
	assert.Equal(t, 1, scheduler.status.ActiveScans)
	assert.Equal(t, 1, scheduler.metrics.ActiveScans)

	// Test decreasing active scans
	worker.updateActiveScans(-1)
	assert.Equal(t, 0, scheduler.status.ActiveScans)
	assert.Equal(t, 0, scheduler.metrics.ActiveScans)

	mockMetrics.AssertExpectations(t)
}

func TestWorkerConcurrency(t *testing.T) {
	scheduler, mockScanner, mockRepo, _, mockMetrics := createTestScheduler()
	
	// Start scheduler with multiple workers
	ctx := context.Background()
	mockMetrics.On("SetSchedulerRunningStatus", true).Once()
	mockMetrics.On("UpdateSchedulerQueueDepth", mock.AnythingOfType("int")).Maybe()
	mockMetrics.On("UpdateSchedulerWorkerUtilization", mock.AnythingOfType("float64")).Maybe()
	mockMetrics.On("ScanStarted", mock.AnythingOfType("string")).Maybe()
	mockMetrics.On("ScanCompleted", mock.AnythingOfType("string"), mock.AnythingOfType("string"), mock.AnythingOfType("time.Duration"), mock.AnythingOfType("int64")).Maybe()
	mockMetrics.On("ScanFinished", mock.AnythingOfType("string")).Maybe()

	scheduler.Start(ctx)
	defer scheduler.Stop(ctx)

	// Create multiple tasks
	numTasks := 5
	tasksDone := make(chan bool, numTasks)

	// Mock scanner to signal when tasks are done
	mockScanner.On("ScanVolume", mock.AnythingOfType("*context.timerCtx"), mock.AnythingOfType("string")).Return(
		&interfaces.ScanResult{
			VolumeID:  "test-volume",
			TotalSize: 1024,
			Method:    "diskus",
			ScannedAt: time.Now(),
			Duration:  10 * time.Millisecond,
		}, nil).Run(func(args mock.Arguments) {
		tasksDone <- true
	})

	mockRepo.On("InsertScanRun", mock.AnythingOfType("*context.cancelCtx"), mock.AnythingOfType("*database.ScanJob")).Return(nil)
	mockRepo.On("UpdateScanRun", mock.AnythingOfType("*context.cancelCtx"), mock.AnythingOfType("*database.ScanJob")).Return(nil)
	mockRepo.On("InsertVolumeStats", mock.AnythingOfType("*context.cancelCtx"), mock.AnythingOfType("*database.VolumeScanStats")).Return(nil)

	// Enqueue multiple volumes
	scanIDs := make([]string, numTasks)
	for i := 0; i < numTasks; i++ {
		scanID, err := scheduler.EnqueueVolume("test-volume-" + string(rune('0'+i)))
		assert.NoError(t, err)
		scanIDs[i] = scanID
	}

	// Wait for all tasks to complete
	completedTasks := 0
	timeout := time.After(5 * time.Second)

	for completedTasks < numTasks {
		select {
		case <-tasksDone:
			completedTasks++
		case <-timeout:
			t.Fatalf("Timeout waiting for tasks to complete. Completed: %d/%d", completedTasks, numTasks)
		}
	}

	// Verify all tasks were processed
	assert.Equal(t, numTasks, completedTasks)

	// Note: We use Maybe() for mock expectations because the exact number of calls
	// depends on timing and worker pool behavior, which can vary in concurrent execution
}

func TestWorkerShutdown(t *testing.T) {
	scheduler, _, _, _, mockMetrics := createTestScheduler()
	
	// Start scheduler
	ctx := context.Background()
	mockMetrics.On("SetSchedulerRunningStatus", mock.AnythingOfType("bool")).Maybe()
	mockMetrics.On("UpdateSchedulerQueueDepth", mock.AnythingOfType("int")).Maybe()
	mockMetrics.On("UpdateSchedulerWorkerUtilization", mock.AnythingOfType("float64")).Maybe()

	scheduler.Start(ctx)

	// Verify workers are running
	assert.True(t, scheduler.IsRunning())
	assert.Len(t, scheduler.workers, 2) // From config

	// Stop scheduler
	stopCtx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()

	err := scheduler.Stop(stopCtx)
	assert.NoError(t, err)
	assert.False(t, scheduler.IsRunning())
}