package metrics

import (
	"log"
	"sync"
	"time"

	"github.com/mantonx/volumeviz/internal/interfaces"
)

// SimpleMetricsCollector implements basic metrics collection with logging
type SimpleMetricsCollector struct {
	mu     sync.RWMutex
	stats  map[string]any
	logger *log.Logger
}

// NewSimpleMetricsCollector creates a new simple metrics collector
func NewSimpleMetricsCollector(logger *log.Logger) interfaces.MetricsCollector {
	return &SimpleMetricsCollector{
		stats:  make(map[string]any),
		logger: logger,
	}
}

// CacheHit records a cache hit
func (s *SimpleMetricsCollector) CacheHit(volumeID string) {
	s.mu.Lock()
	defer s.mu.Unlock()

	key := "cache_hits"
	if count, exists := s.stats[key]; exists {
		if intCount, ok := count.(int); ok {
			s.stats[key] = intCount + 1
		} else {
			s.stats[key] = 1
		}
	} else {
		s.stats[key] = 1
	}

	if s.logger != nil {
		s.logger.Printf("CACHE_HIT volume=%s", volumeID)
	}
}

// CacheMiss records a cache miss
func (s *SimpleMetricsCollector) CacheMiss(volumeID string) {
	s.mu.Lock()
	defer s.mu.Unlock()

	key := "cache_misses"
	if count, exists := s.stats[key]; exists {
		if intCount, ok := count.(int); ok {
			s.stats[key] = intCount + 1
		} else {
			s.stats[key] = 1
		}
	} else {
		s.stats[key] = 1
	}

	if s.logger != nil {
		s.logger.Printf("CACHE_MISS volume=%s", volumeID)
	}
}

// ScanCompleted records a completed scan
func (s *SimpleMetricsCollector) ScanCompleted(volumeID, method string, duration time.Duration, size int64) {
	s.mu.Lock()
	defer s.mu.Unlock()

	// Record successful scans
	key := "scans_completed"
	if count, exists := s.stats[key]; exists {
		if intCount, ok := count.(int); ok {
			s.stats[key] = intCount + 1
		} else {
			s.stats[key] = 1
		}
	} else {
		s.stats[key] = 1
	}

	// Record by method
	methodKey := "scans_by_method_" + method
	if count, exists := s.stats[methodKey]; exists {
		if intCount, ok := count.(int); ok {
			s.stats[methodKey] = intCount + 1
		} else {
			s.stats[methodKey] = 1
		}
	} else {
		s.stats[methodKey] = 1
	}

	if s.logger != nil {
		s.logger.Printf("SCAN_COMPLETED volume=%s method=%s duration=%v size=%d",
			volumeID, method, duration, size)
	}
}

// RecordScanAttempt records a scan attempt (success or failure)
func (s *SimpleMetricsCollector) RecordScanAttempt(method string, duration time.Duration, success bool) {
	s.mu.Lock()
	defer s.mu.Unlock()

	// Record total attempts
	key := "scan_attempts"
	if count, exists := s.stats[key]; exists {
		if intCount, ok := count.(int); ok {
			s.stats[key] = intCount + 1
		} else {
			s.stats[key] = 1
		}
	} else {
		s.stats[key] = 1
	}

	// Record by method and result
	var resultKey string
	if success {
		resultKey = "scan_success_" + method
	} else {
		resultKey = "scan_failure_" + method
	}

	if count, exists := s.stats[resultKey]; exists {
		if intCount, ok := count.(int); ok {
			s.stats[resultKey] = intCount + 1
		} else {
			s.stats[resultKey] = 1
		}
	} else {
		s.stats[resultKey] = 1
	}

	if s.logger != nil {
		status := "SUCCESS"
		if !success {
			status = "FAILURE"
		}
		s.logger.Printf("SCAN_ATTEMPT method=%s duration=%v status=%s",
			method, duration, status)
	}
}

// ScanQueueDepth records the current scan queue depth
func (s *SimpleMetricsCollector) ScanQueueDepth(depth int) {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.stats["scan_queue_depth"] = depth

	if s.logger != nil && depth > 0 {
		s.logger.Printf("SCAN_QUEUE_DEPTH depth=%d", depth)
	}
}

// RecordScanFailure records a scan failure with error context
func (s *SimpleMetricsCollector) RecordScanFailure(method, errorCode string) {
	s.mu.Lock()
	defer s.mu.Unlock()

	key := "scan_failures_" + method + "_" + errorCode
	if count, exists := s.stats[key]; exists {
		if intCount, ok := count.(int); ok {
			s.stats[key] = intCount + 1
		} else {
			s.stats[key] = 1
		}
	} else {
		s.stats[key] = 1
	}

	if s.logger != nil {
		s.logger.Printf("SCAN_FAILURE method=%s error_code=%s", method, errorCode)
	}
}

// UpdateVolumeMetrics updates comprehensive volume metrics
func (s *SimpleMetricsCollector) UpdateVolumeMetrics(volumeID, volumeName, driver, filesystemType string, size int64, fileCount int, scanMethod string) {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.stats["volume_"+volumeID+"_size"] = size
	s.stats["volume_"+volumeID+"_file_count"] = fileCount
	s.stats["volume_"+volumeID+"_last_scan"] = time.Now().Unix()

	if s.logger != nil {
		s.logger.Printf("VOLUME_METRICS volume_id=%s name=%s driver=%s fs_type=%s size=%d files=%d method=%s",
			volumeID, volumeName, driver, filesystemType, size, fileCount, scanMethod)
	}
}

// SetDockerConnectionStatus updates Docker connection health
func (s *SimpleMetricsCollector) SetDockerConnectionStatus(connected bool) {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.stats["docker_connected"] = connected

	if s.logger != nil {
		status := "CONNECTED"
		if !connected {
			status = "DISCONNECTED"
		}
		s.logger.Printf("DOCKER_STATUS status=%s", status)
	}
}

// SetCacheSize updates cache size metric
func (s *SimpleMetricsCollector) SetCacheSize(size int) {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.stats["cache_size"] = size

	if s.logger != nil {
		s.logger.Printf("CACHE_SIZE size=%d", size)
	}
}

// SetActiveScanners updates active scanners count
func (s *SimpleMetricsCollector) SetActiveScanners(count int) {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.stats["active_scanners"] = count

	if s.logger != nil {
		s.logger.Printf("ACTIVE_SCANNERS count=%d", count)
	}
}

// ScanStarted records when a scan starts
func (s *SimpleMetricsCollector) ScanStarted(method string) {
	s.mu.Lock()
	defer s.mu.Unlock()

	key := "scans_in_progress_" + method
	if count, exists := s.stats[key]; exists {
		if intCount, ok := count.(int); ok {
			s.stats[key] = intCount + 1
		} else {
			s.stats[key] = 1
		}
	} else {
		s.stats[key] = 1
	}

	if s.logger != nil {
		s.logger.Printf("SCAN_STARTED method=%s", method)
	}
}

// ScanFinished records when a scan finishes (success or failure)
func (s *SimpleMetricsCollector) ScanFinished(method string) {
	s.mu.Lock()
	defer s.mu.Unlock()

	key := "scans_in_progress_" + method
	if count, exists := s.stats[key]; exists {
		if current, ok := count.(int); ok && current > 0 {
			s.stats[key] = current - 1
		}
	}

	if s.logger != nil {
		s.logger.Printf("SCAN_FINISHED method=%s", method)
	}
}

// SetSchedulerRunningStatus updates scheduler running status
func (s *SimpleMetricsCollector) SetSchedulerRunningStatus(running bool) {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.stats["scheduler_running"] = running

	if s.logger != nil {
		status := "RUNNING"
		if !running {
			status = "STOPPED"
		}
		s.logger.Printf("SCHEDULER_STATUS status=%s", status)
	}
}

// UpdateSchedulerQueueDepth updates scheduler queue depth
func (s *SimpleMetricsCollector) UpdateSchedulerQueueDepth(depth int) {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.stats["scheduler_queue_depth"] = depth

	if s.logger != nil && depth > 0 {
		s.logger.Printf("SCHEDULER_QUEUE_DEPTH depth=%d", depth)
	}
}

// UpdateSchedulerWorkerUtilization updates scheduler worker utilization
func (s *SimpleMetricsCollector) UpdateSchedulerWorkerUtilization(utilization float64) {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.stats["scheduler_worker_utilization"] = utilization

	if s.logger != nil && utilization > 0.1 { // Only log when utilization is above 10%
		s.logger.Printf("SCHEDULER_WORKER_UTILIZATION utilization=%.2f", utilization)
	}
}

// StatsJobStarted records when a stats job starts
func (s *SimpleMetricsCollector) StatsJobStarted(jobType string, volumeID string) {
	s.mu.Lock()
	defer s.mu.Unlock()

	key := "stats_jobs_started_" + jobType
	if count, exists := s.stats[key]; exists {
		if intCount, ok := count.(int); ok {
			s.stats[key] = intCount + 1
		} else {
			s.stats[key] = 1
		}
	} else {
		s.stats[key] = 1
	}

	if s.logger != nil {
		s.logger.Printf("STATS_JOB_STARTED job_type=%s volume_id=%s", jobType, volumeID)
	}
}

// StatsJobCompleted records when a stats job completes successfully
func (s *SimpleMetricsCollector) StatsJobCompleted(jobType string, volumeID string, duration time.Duration, recordsProcessed int) {
	s.mu.Lock()
	defer s.mu.Unlock()

	key := "stats_jobs_completed_" + jobType
	if count, exists := s.stats[key]; exists {
		if intCount, ok := count.(int); ok {
			s.stats[key] = intCount + 1
		} else {
			s.stats[key] = 1
		}
	} else {
		s.stats[key] = 1
	}

	if s.logger != nil {
		s.logger.Printf("STATS_JOB_COMPLETED job_type=%s volume_id=%s duration=%v records=%d",
			jobType, volumeID, duration, recordsProcessed)
	}
}

// StatsJobFailed records when a stats job fails
func (s *SimpleMetricsCollector) StatsJobFailed(jobType string, volumeID string, duration time.Duration, errorType string) {
	s.mu.Lock()
	defer s.mu.Unlock()

	key := "stats_jobs_failed_" + jobType + "_" + errorType
	if count, exists := s.stats[key]; exists {
		if intCount, ok := count.(int); ok {
			s.stats[key] = intCount + 1
		} else {
			s.stats[key] = 1
		}
	} else {
		s.stats[key] = 1
	}

	if s.logger != nil {
		s.logger.Printf("STATS_JOB_FAILED job_type=%s volume_id=%s duration=%v error_type=%s",
			jobType, volumeID, duration, errorType)
	}
}

// UpdateStatsJobQueueDepth updates the stats job queue depth
func (s *SimpleMetricsCollector) UpdateStatsJobQueueDepth(depth int) {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.stats["stats_job_queue_depth"] = depth

	if s.logger != nil && depth > 0 {
		s.logger.Printf("STATS_JOB_QUEUE_DEPTH depth=%d", depth)
	}
}

// SetStatsServiceStatus updates stats service status
func (s *SimpleMetricsCollector) SetStatsServiceStatus(enabled bool) {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.stats["stats_service_enabled"] = enabled

	if s.logger != nil {
		status := "ENABLED"
		if !enabled {
			status = "DISABLED"
		}
		s.logger.Printf("STATS_SERVICE_STATUS status=%s", status)
	}
}

// GetStats returns a copy of current statistics
func (s *SimpleMetricsCollector) GetStats() map[string]any {
	s.mu.RLock()
	defer s.mu.RUnlock()

	// Return a copy
	stats := make(map[string]any)
	for k, v := range s.stats {
		stats[k] = v
	}
	return stats
}

// Reset clears all statistics
func (s *SimpleMetricsCollector) Reset() {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.stats = make(map[string]any)
}
