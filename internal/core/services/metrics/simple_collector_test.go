package metrics

import (
	"bytes"
	"log"
	"testing"
	"time"

	"github.com/mantonx/volumeviz/internal/core/interfaces"
	"github.com/stretchr/testify/assert"
)

func TestNewSimpleMetricsCollector(t *testing.T) {
	logger := log.New(bytes.NewBuffer(nil), "", 0)
	collector := NewSimpleMetricsCollector(logger)

	assert.NotNil(t, collector)
	assert.Implements(t, (*interfaces.MetricsCollector)(nil), collector)

	// Cast to concrete type to test internal structure
	simple, ok := collector.(*SimpleMetricsCollector)
	assert.True(t, ok)
	assert.NotNil(t, simple.stats)
	assert.Equal(t, logger, simple.logger)
}

func TestSimpleMetricsCollector_CacheHit(t *testing.T) {
	var logBuf bytes.Buffer
	logger := log.New(&logBuf, "", 0)
	collector := NewSimpleMetricsCollector(logger).(*SimpleMetricsCollector)

	// Record first cache hit
	collector.CacheHit("vol-1")

	stats := collector.GetStats()
	assert.Equal(t, 1, stats["cache_hits"])

	// Record second cache hit
	collector.CacheHit("vol-2")

	stats = collector.GetStats()
	assert.Equal(t, 2, stats["cache_hits"])

	// Check logging
	logOutput := logBuf.String()
	assert.Contains(t, logOutput, "CACHE_HIT volume=vol-1")
	assert.Contains(t, logOutput, "CACHE_HIT volume=vol-2")
}

func TestSimpleMetricsCollector_CacheMiss(t *testing.T) {
	var logBuf bytes.Buffer
	logger := log.New(&logBuf, "", 0)
	collector := NewSimpleMetricsCollector(logger).(*SimpleMetricsCollector)

	// Record cache misses
	collector.CacheMiss("vol-1")
	collector.CacheMiss("vol-2")

	stats := collector.GetStats()
	assert.Equal(t, 2, stats["cache_misses"])

	// Check logging
	logOutput := logBuf.String()
	assert.Contains(t, logOutput, "CACHE_MISS volume=vol-1")
	assert.Contains(t, logOutput, "CACHE_MISS volume=vol-2")
}

func TestSimpleMetricsCollector_ScanCompleted(t *testing.T) {
	var logBuf bytes.Buffer
	logger := log.New(&logBuf, "", 0)
	collector := NewSimpleMetricsCollector(logger).(*SimpleMetricsCollector)

	duration := 30 * time.Second
	size := int64(1024000)

	// Record completed scans
	collector.ScanCompleted("vol-1", "du", duration, size)
	collector.ScanCompleted("vol-2", "native", duration, size*2)
	collector.ScanCompleted("vol-3", "du", duration, size)

	stats := collector.GetStats()
	assert.Equal(t, 3, stats["scans_completed"])
	assert.Equal(t, 2, stats["scans_by_method_du"])
	assert.Equal(t, 1, stats["scans_by_method_native"])

	// Check logging
	logOutput := logBuf.String()
	assert.Contains(t, logOutput, "SCAN_COMPLETED volume=vol-1 method=du")
	assert.Contains(t, logOutput, "SCAN_COMPLETED volume=vol-2 method=native")
	assert.Contains(t, logOutput, "size=1024000")
	assert.Contains(t, logOutput, "size=2048000")
}

func TestSimpleMetricsCollector_RecordScanAttempt(t *testing.T) {
	var logBuf bytes.Buffer
	logger := log.New(&logBuf, "", 0)
	collector := NewSimpleMetricsCollector(logger).(*SimpleMetricsCollector)

	duration := 15 * time.Second

	// Record successful attempts
	collector.RecordScanAttempt("du", duration, true)
	collector.RecordScanAttempt("native", duration, true)

	// Record failed attempts
	collector.RecordScanAttempt("du", duration, false)

	stats := collector.GetStats()
	assert.Equal(t, 3, stats["scan_attempts"])
	assert.Equal(t, 1, stats["scan_success_du"])
	assert.Equal(t, 1, stats["scan_success_native"])
	assert.Equal(t, 1, stats["scan_failure_du"])

	// Check logging
	logOutput := logBuf.String()
	assert.Contains(t, logOutput, "SCAN_ATTEMPT method=du duration=15s status=SUCCESS")
	assert.Contains(t, logOutput, "SCAN_ATTEMPT method=native duration=15s status=SUCCESS")
	assert.Contains(t, logOutput, "SCAN_ATTEMPT method=du duration=15s status=FAILURE")
}

func TestSimpleMetricsCollector_ScanQueueDepth(t *testing.T) {
	var logBuf bytes.Buffer
	logger := log.New(&logBuf, "", 0)
	collector := NewSimpleMetricsCollector(logger).(*SimpleMetricsCollector)

	// Set queue depth to 0 (should not log)
	collector.ScanQueueDepth(0)
	stats := collector.GetStats()
	assert.Equal(t, 0, stats["scan_queue_depth"])

	// Set queue depth to 5 (should log)
	collector.ScanQueueDepth(5)
	stats = collector.GetStats()
	assert.Equal(t, 5, stats["scan_queue_depth"])

	// Check logging (only depth > 0 should be logged)
	logOutput := logBuf.String()
	assert.NotContains(t, logOutput, "depth=0")
	assert.Contains(t, logOutput, "SCAN_QUEUE_DEPTH depth=5")
}

func TestSimpleMetricsCollector_RecordScanFailure(t *testing.T) {
	var logBuf bytes.Buffer
	logger := log.New(&logBuf, "", 0)
	collector := NewSimpleMetricsCollector(logger).(*SimpleMetricsCollector)

	// Record scan failures
	collector.RecordScanFailure("du", "PERMISSION_DENIED")
	collector.RecordScanFailure("du", "PERMISSION_DENIED")
	collector.RecordScanFailure("native", "TIMEOUT")

	stats := collector.GetStats()
	assert.Equal(t, 2, stats["scan_failures_du_PERMISSION_DENIED"])
	assert.Equal(t, 1, stats["scan_failures_native_TIMEOUT"])

	// Check logging
	logOutput := logBuf.String()
	assert.Contains(t, logOutput, "SCAN_FAILURE method=du error_code=PERMISSION_DENIED")
	assert.Contains(t, logOutput, "SCAN_FAILURE method=native error_code=TIMEOUT")
}

func TestSimpleMetricsCollector_UpdateVolumeMetrics(t *testing.T) {
	var logBuf bytes.Buffer
	logger := log.New(&logBuf, "", 0)
	collector := NewSimpleMetricsCollector(logger).(*SimpleMetricsCollector)

	// Update volume metrics
	collector.UpdateVolumeMetrics("vol-1", "test-volume", "local", "ext4", 2048000, 1500, "du")

	stats := collector.GetStats()
	assert.Equal(t, int64(2048000), stats["volume_vol-1_size"])
	assert.Equal(t, 1500, stats["volume_vol-1_file_count"])
	assert.NotNil(t, stats["volume_vol-1_last_scan"]) // Unix timestamp

	// Check logging
	logOutput := logBuf.String()
	assert.Contains(t, logOutput, "VOLUME_METRICS volume_id=vol-1 name=test-volume")
	assert.Contains(t, logOutput, "driver=local fs_type=ext4 size=2048000 files=1500 method=du")
}

func TestSimpleMetricsCollector_SetDockerConnectionStatus(t *testing.T) {
	var logBuf bytes.Buffer
	logger := log.New(&logBuf, "", 0)
	collector := NewSimpleMetricsCollector(logger).(*SimpleMetricsCollector)

	// Set connected
	collector.SetDockerConnectionStatus(true)
	stats := collector.GetStats()
	assert.Equal(t, true, stats["docker_connected"])

	// Set disconnected
	collector.SetDockerConnectionStatus(false)
	stats = collector.GetStats()
	assert.Equal(t, false, stats["docker_connected"])

	// Check logging
	logOutput := logBuf.String()
	assert.Contains(t, logOutput, "DOCKER_STATUS status=CONNECTED")
	assert.Contains(t, logOutput, "DOCKER_STATUS status=DISCONNECTED")
}

func TestSimpleMetricsCollector_SetCacheSize(t *testing.T) {
	var logBuf bytes.Buffer
	logger := log.New(&logBuf, "", 0)
	collector := NewSimpleMetricsCollector(logger).(*SimpleMetricsCollector)

	collector.SetCacheSize(100)
	stats := collector.GetStats()
	assert.Equal(t, 100, stats["cache_size"])

	// Check logging
	logOutput := logBuf.String()
	assert.Contains(t, logOutput, "CACHE_SIZE size=100")
}

func TestSimpleMetricsCollector_SetActiveScanners(t *testing.T) {
	var logBuf bytes.Buffer
	logger := log.New(&logBuf, "", 0)
	collector := NewSimpleMetricsCollector(logger).(*SimpleMetricsCollector)

	collector.SetActiveScanners(3)
	stats := collector.GetStats()
	assert.Equal(t, 3, stats["active_scanners"])

	// Check logging
	logOutput := logBuf.String()
	assert.Contains(t, logOutput, "ACTIVE_SCANNERS count=3")
}

func TestSimpleMetricsCollector_ScanStartedFinished(t *testing.T) {
	var logBuf bytes.Buffer
	logger := log.New(&logBuf, "", 0)
	collector := NewSimpleMetricsCollector(logger).(*SimpleMetricsCollector)

	// Start scans
	collector.ScanStarted("du")
	collector.ScanStarted("du")
	collector.ScanStarted("native")

	stats := collector.GetStats()
	assert.Equal(t, 2, stats["scans_in_progress_du"])
	assert.Equal(t, 1, stats["scans_in_progress_native"])

	// Finish scans
	collector.ScanFinished("du")
	collector.ScanFinished("native")

	stats = collector.GetStats()
	assert.Equal(t, 1, stats["scans_in_progress_du"])
	assert.Equal(t, 0, stats["scans_in_progress_native"])

	// Check logging
	logOutput := logBuf.String()
	assert.Contains(t, logOutput, "SCAN_STARTED method=du")
	assert.Contains(t, logOutput, "SCAN_STARTED method=native")
	assert.Contains(t, logOutput, "SCAN_FINISHED method=du")
	assert.Contains(t, logOutput, "SCAN_FINISHED method=native")
}

func TestSimpleMetricsCollector_SchedulerMethods(t *testing.T) {
	var logBuf bytes.Buffer
	logger := log.New(&logBuf, "", 0)
	collector := NewSimpleMetricsCollector(logger).(*SimpleMetricsCollector)

	// Set scheduler running status
	collector.SetSchedulerRunningStatus(true)
	stats := collector.GetStats()
	assert.Equal(t, true, stats["scheduler_running"])

	collector.SetSchedulerRunningStatus(false)
	stats = collector.GetStats()
	assert.Equal(t, false, stats["scheduler_running"])

	// Update queue depth
	collector.UpdateSchedulerQueueDepth(0) // Should not log
	collector.UpdateSchedulerQueueDepth(5) // Should log
	stats = collector.GetStats()
	assert.Equal(t, 5, stats["scheduler_queue_depth"])

	// Update worker utilization
	collector.UpdateSchedulerWorkerUtilization(0.05) // Should not log (below 10%)
	collector.UpdateSchedulerWorkerUtilization(0.75) // Should log
	stats = collector.GetStats()
	assert.Equal(t, 0.75, stats["scheduler_worker_utilization"])

	// Check logging
	logOutput := logBuf.String()
	assert.Contains(t, logOutput, "SCHEDULER_STATUS status=RUNNING")
	assert.Contains(t, logOutput, "SCHEDULER_STATUS status=STOPPED")
	assert.NotContains(t, logOutput, "depth=0")
	assert.Contains(t, logOutput, "SCHEDULER_QUEUE_DEPTH depth=5")
	assert.NotContains(t, logOutput, "utilization=0.05")
	assert.Contains(t, logOutput, "SCHEDULER_WORKER_UTILIZATION utilization=0.75")
}

func TestSimpleMetricsCollector_GetStats(t *testing.T) {
	collector := NewSimpleMetricsCollector(nil).(*SimpleMetricsCollector)

	// Add some data
	collector.CacheHit("vol-1")
	collector.CacheMiss("vol-2")
	collector.SetCacheSize(50)

	// Get stats
	stats := collector.GetStats()
	assert.Equal(t, 1, stats["cache_hits"])
	assert.Equal(t, 1, stats["cache_misses"])
	assert.Equal(t, 50, stats["cache_size"])

	// Modify returned stats (should not affect internal state)
	stats["cache_hits"] = 999

	// Verify internal state unchanged
	newStats := collector.GetStats()
	assert.Equal(t, 1, newStats["cache_hits"])
}

func TestSimpleMetricsCollector_Reset(t *testing.T) {
	collector := NewSimpleMetricsCollector(nil).(*SimpleMetricsCollector)

	// Add some data
	collector.CacheHit("vol-1")
	collector.CacheMiss("vol-2")
	collector.SetCacheSize(50)

	stats := collector.GetStats()
	assert.NotEmpty(t, stats)

	// Reset
	collector.Reset()

	stats = collector.GetStats()
	assert.Empty(t, stats)
}

func TestSimpleMetricsCollector_NilLogger(t *testing.T) {
	// Create collector without logger
	collector := NewSimpleMetricsCollector(nil).(*SimpleMetricsCollector)

	// Should not panic when logging
	assert.NotPanics(t, func() {
		collector.CacheHit("vol-1")
		collector.CacheMiss("vol-2")
		collector.ScanCompleted("vol-3", "du", time.Second, 1024)
		collector.RecordScanAttempt("native", time.Second, true)
		collector.SetDockerConnectionStatus(true)
	})

	// Stats should still be recorded
	stats := collector.GetStats()
	assert.Equal(t, 1, stats["cache_hits"])
	assert.Equal(t, 1, stats["cache_misses"])
	assert.Equal(t, true, stats["docker_connected"])
}

func TestSimpleMetricsCollector_ConcurrentAccess(t *testing.T) {
	collector := NewSimpleMetricsCollector(nil).(*SimpleMetricsCollector)

	// Test concurrent writes don't cause data races
	done := make(chan bool, 10)

	for i := 0; i < 10; i++ {
		go func(id int) {
			defer func() { done <- true }()

			// Perform various operations
			collector.CacheHit("vol-" + string(rune(id)))
			collector.CacheMiss("vol-miss-" + string(rune(id)))
			collector.ScanCompleted("vol-scan-"+string(rune(id)), "du", time.Second, 1024)
			collector.SetCacheSize(id * 10)

			// Read stats
			stats := collector.GetStats()
			assert.NotNil(t, stats)
		}(i)
	}

	// Wait for all goroutines
	for i := 0; i < 10; i++ {
		<-done
	}

	// Verify final state
	stats := collector.GetStats()
	assert.NotEmpty(t, stats)
}

func TestSimpleMetricsCollector_InvalidStateCoverage(t *testing.T) {
	collector := NewSimpleMetricsCollector(nil).(*SimpleMetricsCollector)

	// Manually corrupt stats to test type assertion branches
	collector.mu.Lock()
	collector.stats["cache_hits"] = "invalid" // Non-int value
	collector.mu.Unlock()

	// This should reset the invalid value and set it to 1
	collector.CacheHit("vol-1")

	stats := collector.GetStats()
	assert.Equal(t, 1, stats["cache_hits"])

	// Test ScanFinished with zero count
	collector.mu.Lock()
	collector.stats["scans_in_progress_test"] = 0
	collector.mu.Unlock()

	// Should not go negative
	collector.ScanFinished("test")
	stats = collector.GetStats()
	assert.Equal(t, 0, stats["scans_in_progress_test"])
}
