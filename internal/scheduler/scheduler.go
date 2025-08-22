package scheduler

import (
	"context"
	"fmt"
	"log"
	"math/rand"
	"regexp"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/mantonx/volumeviz/internal/interfaces"
	"github.com/mantonx/volumeviz/internal/models"
	"github.com/mantonx/volumeviz/internal/store"
)

// Scheduler implements the ScanScheduler interface with hardened scan orchestration
type Scheduler struct {
	config           *SchedulerConfig
	scanner          interfaces.VolumeScanner
	repository       ScanRepository
	volumeProvider   VolumeProvider
	metricsCollector interfaces.MetricsCollector
	// Enhanced store integration for atomic operations
	store            store.Store

	// Worker pool and queue
	taskQueue chan *ScanTask
	workers   []*worker
	workerWG  sync.WaitGroup

	// Hardened features
	watchdog         *Watchdog
	heartbeatConfig  HeartbeatConfig

	// Scheduler state
	running     bool
	ctx         context.Context
	cancel      context.CancelFunc
	schedulerWG sync.WaitGroup

	// Metrics and status
	metrics     *SchedulerMetrics
	status      *SchedulerStatus
	statusMutex sync.RWMutex

	// Skip pattern regex
	skipPattern *regexp.Regexp

	// Rate limiting
	lastEnqueueAll time.Time
	rateLimitMutex sync.Mutex

	// Graceful shutdown
	shuttingDown   bool
	shutdownMutex  sync.RWMutex
}

// worker represents a scan worker goroutine with heartbeat capabilities
type worker struct {
	id        int
	scheduler *Scheduler
	ctx       context.Context
	// Hardened worker stats
	processedJobs int64
	errorCount    int64
	statsMutex    sync.RWMutex
}

// HeartbeatConfig holds heartbeat configuration
type HeartbeatConfig struct {
	Interval        time.Duration
	Timeout         time.Duration
	WatchdogEnabled bool
}


// NewScheduler creates a new scan scheduler with hardened features
func NewScheduler(
	config *SchedulerConfig,
	scanner interfaces.VolumeScanner,
	repository ScanRepository,
	volumeProvider VolumeProvider,
	metricsCollector interfaces.MetricsCollector,
	store store.Store,
) (*Scheduler, error) {
	// Compile skip pattern if provided
	var skipPattern *regexp.Regexp
	if config.SkipPattern != "" {
		compiled, err := regexp.Compile(config.SkipPattern)
		if err != nil {
			return nil, fmt.Errorf("invalid skip pattern %q: %w", config.SkipPattern, err)
		}
		skipPattern = compiled
	}

	// Create heartbeat configuration from scan config
	heartbeatConfig := HeartbeatConfig{
		Interval:        7 * time.Second, // Default 7s heartbeat
		Timeout:         5 * time.Minute, // Default 5m timeout
		WatchdogEnabled: true,
	}

	scheduler := &Scheduler{
		config:           config,
		scanner:          scanner,
		repository:       repository,
		volumeProvider:   volumeProvider,
		metricsCollector: metricsCollector,
		store:            store,
		taskQueue:        make(chan *ScanTask, config.QueueSize),
		skipPattern:      skipPattern,
		heartbeatConfig:  heartbeatConfig,
		metrics: &SchedulerMetrics{
			CompletedScans: make(map[string]int64),
			ScanDurations:  make(map[string]float64),
			ErrorCounts:    make(map[string]int64),
		},
		status: &SchedulerStatus{
			WorkerCount: config.Concurrency,
		},
	}

	// Create watchdog if store is available
	if store != nil && heartbeatConfig.WatchdogEnabled {
		watchdogConfig := HardenedScanConfig{
			WatchdogInterval: 30 * time.Second,
			ScanTimeout:      heartbeatConfig.Timeout,
		}
		scheduler.watchdog = NewWatchdog(watchdogConfig, store)
	}

	return scheduler, nil
}

// Start starts the scan scheduler
func (s *Scheduler) Start(ctx context.Context) error {
	if !s.config.Enabled {
		log.Printf("[INFO] Scan scheduler disabled")
		if s.metricsCollector != nil {
			s.metricsCollector.SetSchedulerRunningStatus(false)
		}
		return nil
	}

	s.statusMutex.Lock()
	if s.running {
		s.statusMutex.Unlock()
		return fmt.Errorf("scheduler already running")
	}
	s.running = true
	s.statusMutex.Unlock()

	s.ctx, s.cancel = context.WithCancel(ctx)

	log.Printf("[INFO] Starting scan scheduler (interval: %v, concurrency: %d, queue size: %d, hardened: %v)",
		s.config.Interval, s.config.Concurrency, s.config.QueueSize, s.store != nil)

	// Mark any existing in-flight jobs as failed (from previous instance)
	if s.store != nil && s.watchdog != nil {
		err := s.watchdog.MarkInFlightJobsAsFailed("Scheduler restart - previous instance terminated")
		if err != nil {
			log.Printf("[WARN] Failed to mark in-flight jobs as failed during startup: %v", err)
		}
	}

	// Update metrics for scheduler start
	if s.metricsCollector != nil {
		s.metricsCollector.SetSchedulerRunningStatus(true)
		s.metricsCollector.UpdateSchedulerQueueDepth(0)
		s.metricsCollector.UpdateSchedulerWorkerUtilization(0.0)
	}

	// Start worker pool
	s.workers = make([]*worker, s.config.Concurrency)
	for i := 0; i < s.config.Concurrency; i++ {
		s.workers[i] = &worker{
			id:        i,
			scheduler: s,
			ctx:       s.ctx,
		}
		s.workerWG.Add(1)
		go s.workers[i].run()
	}

	// Start watchdog if enabled
	if s.watchdog != nil {
		s.watchdog.Start()
	}

	// Start periodic scheduler
	s.schedulerWG.Add(1)
	go s.runPeriodicScheduler()

	return nil
}

// Stop stops the scan scheduler
func (s *Scheduler) Stop(ctx context.Context) error {
	s.statusMutex.Lock()
	if !s.running {
		s.statusMutex.Unlock()
		return nil
	}
	s.running = false
	s.statusMutex.Unlock()

	log.Printf("[INFO] Stopping scan scheduler...")

	// Update metrics for scheduler stop
	if s.metricsCollector != nil {
		s.metricsCollector.SetSchedulerRunningStatus(false)
		s.metricsCollector.UpdateSchedulerQueueDepth(0)
		s.metricsCollector.UpdateSchedulerWorkerUtilization(0.0)
	}

	// Cancel context to stop all workers
	if s.cancel != nil {
		s.cancel()
	}

	// Stop watchdog if enabled
	if s.watchdog != nil {
		s.watchdog.Stop()
	}

	// Wait for scheduler and workers to finish
	done := make(chan struct{})
	go func() {
		s.schedulerWG.Wait()
		s.workerWG.Wait()
		close(done)
	}()

	select {
	case <-done:
		log.Printf("[INFO] Scan scheduler stopped")
	case <-ctx.Done():
		log.Printf("[WARN] Scan scheduler stop timeout")
	}

	return nil
}

// IsRunning returns whether the scheduler is currently running
func (s *Scheduler) IsRunning() bool {
	s.statusMutex.RLock()
	defer s.statusMutex.RUnlock()
	return s.running
}

// GetStatus returns the current scheduler status
func (s *Scheduler) GetStatus() *SchedulerStatus {
	s.statusMutex.RLock()
	defer s.statusMutex.RUnlock()

	// Create a copy to avoid race conditions
	status := *s.status
	status.QueueDepth = len(s.taskQueue)
	status.Running = s.running

	return &status
}

// GetMetrics returns current scheduler metrics
func (s *Scheduler) GetMetrics() *SchedulerMetrics {
	s.statusMutex.RLock()
	defer s.statusMutex.RUnlock()

	// Create a copy to avoid race conditions
	metrics := &SchedulerMetrics{
		QueueDepth:        len(s.taskQueue),
		ActiveScans:       s.metrics.ActiveScans,
		CompletedScans:    make(map[string]int64),
		ScanDurations:     make(map[string]float64),
		ErrorCounts:       make(map[string]int64),
		WorkerUtilization: s.calculateWorkerUtilizationLocked(),
	}

	// Copy maps
	for k, v := range s.metrics.CompletedScans {
		metrics.CompletedScans[k] = v
	}
	for k, v := range s.metrics.ScanDurations {
		metrics.ScanDurations[k] = v
	}
	for k, v := range s.metrics.ErrorCounts {
		metrics.ErrorCounts[k] = v
	}

	return metrics
}

// GetDetailedMetrics returns enhanced metrics including worker and watchdog stats (hardened mode)
func (s *Scheduler) GetDetailedMetrics() *EnhancedSchedulerMetrics {
	status := s.GetStatus()
	
	// Collect worker stats
	workerStats := make([]WorkerStats, len(s.workers))
	for i, worker := range s.workers {
		workerStats[i] = worker.GetStats()
	}
	
	// Get watchdog stats if available
	var watchdogStats *WatchdogStats
	if s.watchdog != nil {
		stats := s.watchdog.GetStats()
		watchdogStats = &stats
	}
	
	return &EnhancedSchedulerMetrics{
		QueueDepth:        status.QueueDepth,
		ActiveScans:       status.ActiveScans,
		WorkerUtilization: s.calculateWorkerUtilization(),
		WorkerStats:       workerStats,
		WatchdogStats:     watchdogStats,
		IsHardened:        s.store != nil,
		HeartbeatInterval: s.heartbeatConfig.Interval,
		WatchdogEnabled:   s.watchdog != nil,
	}
}

// IsHardenedMode returns true if the scheduler is running with hardened features
func (s *Scheduler) IsHardenedMode() bool {
	return s.store != nil
}

// GetWorkerStats returns statistics for all workers
func (s *Scheduler) GetWorkerStats() []WorkerStats {
	stats := make([]WorkerStats, len(s.workers))
	for i, worker := range s.workers {
		stats[i] = worker.GetStats()
	}
	return stats
}

// GetWatchdogStats returns watchdog statistics if watchdog is enabled
func (s *Scheduler) GetWatchdogStats() *WatchdogStats {
	if s.watchdog == nil {
		return nil
	}
	stats := s.watchdog.GetStats()
	return &stats
}

// EnqueueVolume enqueues a single volume for scanning with atomic duplication prevention
func (s *Scheduler) EnqueueVolume(volumeName string) (string, error) {
	if !s.IsRunning() {
		return "", fmt.Errorf("scheduler not running")
	}

	// Check for shutdown
	s.shutdownMutex.RLock()
	if s.shuttingDown {
		s.shutdownMutex.RUnlock()
		return "", fmt.Errorf("scheduler is shutting down")
	}
	s.shutdownMutex.RUnlock()

	// Check if volume should be skipped
	if s.shouldSkipVolume(volumeName) {
		return "", fmt.Errorf("volume %s matches skip pattern", volumeName)
	}

	// Check if volume allows bind mount scanning if it's a bind mount
	if s.isBindMount(volumeName) && !s.isBindMountAllowed(volumeName) {
		return "", fmt.Errorf("bind mount %s not in allow list", volumeName)
	}

	// Use store for atomic active scan check and enqueuing (if available)
	if s.store != nil {
		// Check if volume already has an active scan (atomic check)
		hasActive, err := s.store.Scans().HasActiveScanForVolume(s.ctx, volumeName)
		if err != nil {
			return "", fmt.Errorf("failed to check active scans for volume %s: %w", volumeName, err)
		}
		
		if hasActive {
			return "", fmt.Errorf("volume %s already has an active scan", volumeName)
		}

		// Create scan job in database
		scanID := uuid.New().String()
		scanJob := models.CreateScanJobParams{
			ScanID:   scanID,
			VolumeID: volumeName,
			Status:   "queued",
			Method:   s.selectScanMethod(),
		}
		
		// Insert scan job atomically
		_, err = s.store.Scans().CreateScanJob(s.ctx, scanJob)
		if err != nil {
			return "", fmt.Errorf("failed to create scan job: %w", err)
		}
		
		log.Printf("[INFO] Enqueued volume %s for scanning using hardened store (scan_id: %s)", volumeName, scanID)
		return scanID, nil
	}

	// Fallback to legacy queue-based enqueuing
	scanID := uuid.New().String()
	task := &ScanTask{
		ScanID:     scanID,
		VolumeName: volumeName,
		Method:     s.selectScanMethod(),
		Priority:   1, // Normal priority for manual scans
		CreatedAt:  time.Now(),
		Timeout:    s.config.TimeoutPerVolume,
		MaxRetries: 1,
	}

	select {
	case s.taskQueue <- task:
		log.Printf("[INFO] Enqueued volume %s for scanning (scan_id: %s)", volumeName, scanID)
		// Update queue depth metrics
		if s.metricsCollector != nil {
			s.metricsCollector.UpdateSchedulerQueueDepth(len(s.taskQueue))
			s.metricsCollector.UpdateSchedulerWorkerUtilization(s.calculateWorkerUtilization())
		}
		return scanID, nil
	default:
		return "", fmt.Errorf("scan queue full")
	}
}

// EnqueueAllVolumes enqueues all volumes for scanning with rate limiting
func (s *Scheduler) EnqueueAllVolumes() (string, error) {
	if !s.IsRunning() {
		return "", fmt.Errorf("scheduler not running")
	}

	// Rate limiting: only allow one EnqueueAllVolumes call per minute
	s.rateLimitMutex.Lock()
	if time.Since(s.lastEnqueueAll) < time.Minute {
		s.rateLimitMutex.Unlock()
		return "", fmt.Errorf("rate limited: try again in %v", time.Minute-time.Since(s.lastEnqueueAll))
	}
	s.lastEnqueueAll = time.Now()
	s.rateLimitMutex.Unlock()

	// Get all volumes
	volumes, err := s.volumeProvider.ListVolumes(s.ctx)
	if err != nil {
		return "", fmt.Errorf("failed to list volumes: %w", err)
	}

	batchID := uuid.New().String()
	enqueuedCount := 0

	for _, volume := range volumes {
		// Check if volume should be skipped
		if s.shouldSkipVolume(volume.Name) {
			continue
		}

		// Check bind mount policy
		if s.isBindMount(volume.Name) && !s.isBindMountAllowed(volume.Name) {
			continue
		}

		scanID := uuid.New().String()
		task := &ScanTask{
			ScanID:     scanID,
			VolumeName: volume.Name,
			Method:     s.selectScanMethod(),
			Priority:   0, // Lower priority for batch scans
			CreatedAt:  time.Now(),
			Timeout:    s.config.TimeoutPerVolume,
			MaxRetries: 1,
		}

		select {
		case s.taskQueue <- task:
			enqueuedCount++
		default:
			log.Printf("[WARN] Scan queue full, could not enqueue volume %s", volume.Name)
			goto done
		}
	}

done:
	log.Printf("[INFO] Enqueued %d volumes for scanning (batch_id: %s)", enqueuedCount, batchID)
	return batchID, nil
}

// GetScanStatus returns the status of a specific scan
func (s *Scheduler) GetScanStatus(scanID string) (*ScanStatus, error) {
	scanRun, err := s.repository.GetScanRunByID(s.ctx, scanID)
	if err != nil {
		return nil, fmt.Errorf("failed to get scan status: %w", err)
	}

	if scanRun == nil {
		return nil, fmt.Errorf("scan not found")
	}

	status := &ScanStatus{
		ScanID:      scanRun.ScanID,
		VolumeName:  scanRun.VolumeID, // Note: VolumeID in ScanJob corresponds to volume name
		Status:      scanRun.Status,
		Method:      scanRun.Method,
		Progress:    int(*scanRun.Progress),
		StartedAt:   scanRun.StartedAt,
		CompletedAt: scanRun.CompletedAt,
	}

	if scanRun.StartedAt != nil && scanRun.CompletedAt != nil {
		duration := scanRun.CompletedAt.Sub(*scanRun.StartedAt)
		status.Duration = &duration
	}

	if scanRun.ErrorMessage != nil {
		status.Error = *scanRun.ErrorMessage
	}

	return status, nil
}

// runPeriodicScheduler runs the periodic scheduling loop
func (s *Scheduler) runPeriodicScheduler() {
	defer s.schedulerWG.Done()

	ticker := time.NewTicker(s.config.Interval)
	defer ticker.Stop()

	log.Printf("[INFO] Periodic scheduler started (interval: %v)", s.config.Interval)

	// Run initial scan after a short delay
	initialDelay := time.Duration(rand.Intn(30)) * time.Second
	select {
	case <-time.After(initialDelay):
		s.runScheduledScan()
	case <-s.ctx.Done():
		return
	}

	for {
		select {
		case <-ticker.C:
			s.runScheduledScan()
		case <-s.ctx.Done():
			return
		}
	}
}

// runScheduledScan performs a scheduled scan of all volumes
func (s *Scheduler) runScheduledScan() {
	s.statusMutex.Lock()
	now := time.Now()
	s.status.LastRunAt = &now
	next := now.Add(s.config.Interval)
	s.status.NextRunAt = &next
	s.statusMutex.Unlock()

	log.Printf("[INFO] Starting scheduled scan")

	_, err := s.EnqueueAllVolumes()
	if err != nil {
		log.Printf("[ERROR] Failed to enqueue volumes for scheduled scan: %v", err)
		s.statusMutex.Lock()
		s.metrics.ErrorCounts["enqueue"]++
		s.statusMutex.Unlock()
	}
}

// Helper methods

func (s *Scheduler) shouldSkipVolume(volumeName string) bool {
	if s.skipPattern == nil {
		return false
	}
	return s.skipPattern.MatchString(volumeName)
}

func (s *Scheduler) isBindMount(volumeName string) bool {
	// Simple heuristic: bind mounts typically contain path separators
	// More sophisticated detection would require Docker API integration
	return strings.Contains(volumeName, "/") || strings.Contains(volumeName, "\\")
}

func (s *Scheduler) isBindMountAllowed(volumeName string) bool {
	if !s.config.BindMountsEnabled {
		return false
	}

	for _, allowedPath := range s.config.BindAllowList {
		if strings.HasPrefix(volumeName, allowedPath) {
			return true
		}
	}

	return false
}

func (s *Scheduler) selectScanMethod() string {
	if len(s.config.MethodsOrder) > 0 {
		return s.config.MethodsOrder[0]
	}
	return "du" // fallback
}

func (s *Scheduler) calculateWorkerUtilization() float64 {
	s.statusMutex.RLock()
	defer s.statusMutex.RUnlock()
	return s.calculateWorkerUtilizationLocked()
}

// calculateWorkerUtilizationLocked calculates utilization without locking (caller must hold lock)
func (s *Scheduler) calculateWorkerUtilizationLocked() float64 {
	if s.config.Concurrency == 0 {
		return 0.0
	}
	return float64(s.metrics.ActiveScans) / float64(s.config.Concurrency)
}

// run executes the worker loop with hardened claim support
func (w *worker) run() {
	defer w.scheduler.workerWG.Done()

	log.Printf("[INFO] Worker %d started (hardened: %v)", w.id, w.scheduler.store != nil)

	for {
		select {
		case task := <-w.scheduler.taskQueue:
			// Update queue depth metrics after dequeue
			if w.scheduler.metricsCollector != nil {
				w.scheduler.metricsCollector.UpdateSchedulerQueueDepth(len(w.scheduler.taskQueue))
			}
			w.processTask(task)
		case <-w.ctx.Done():
			log.Printf("[INFO] Worker %d stopped", w.id)
			return
		case <-time.After(1 * time.Second):
			// Try to claim work from store if available (hardened mode)
			if w.scheduler.store != nil {
				w.tryClaimScanJob()
			}
		}
	}
}

// tryClaimScanJob attempts to atomically claim a scan job from the store
func (w *worker) tryClaimScanJob() {
	// Try to claim next available scan job
	scanJob, err := w.scheduler.store.Scans().ClaimNextScanJob(w.ctx, time.Now())
	if err != nil {
		// No jobs available or error - just continue
		return
	}
	
	if scanJob == nil {
		// No jobs available
		return
	}
	
	log.Printf("[INFO] Worker %d claimed scan job %s (volume: %s)", w.id, scanJob.ScanID, scanJob.VolumeID)
	
	// Process the claimed scan job with heartbeats
	w.processClaimedScanJob(scanJob)
}

// processClaimedScanJob processes a scan job claimed from the store with heartbeat support
func (w *worker) processClaimedScanJob(scanJob *models.ScanJob) {
	w.updateActiveScans(1)
	defer w.updateActiveScans(-1)
	w.incrementProcessedJobs()

	log.Printf("[INFO] Worker %d processing claimed scan %s (volume: %s)", w.id, scanJob.ScanID, scanJob.VolumeID)

	// Start heartbeat goroutine
	heartbeatCtx, heartbeatCancel := context.WithCancel(w.ctx)
	defer heartbeatCancel()
	
	go w.runHeartbeat(heartbeatCtx, scanJob.ScanID)

	// Update metrics
	if w.scheduler.metricsCollector != nil {
		w.scheduler.metricsCollector.ScanStarted(scanJob.Method)
	}

	// Create timeout context
	ctx, cancel := context.WithTimeout(w.ctx, w.scheduler.heartbeatConfig.Timeout)
	defer cancel()

	// Perform the scan
	result, err := w.scheduler.scanner.ScanVolume(ctx, scanJob.VolumeID)
	completedAt := time.Now()
	
	// Stop heartbeat
	heartbeatCancel()

	if err != nil {
		// Handle failure
		log.Printf("[ERROR] Worker %d scan failed for volume %s: %v", w.id, scanJob.VolumeID, err)
		w.incrementErrorCount()
		
		// Complete scan job as failed
		if completeErr := w.scheduler.store.Scans().CompletesScanJob(ctx, scanJob.ScanID); completeErr != nil {
			log.Printf("[ERROR] Worker %d failed to mark scan job as failed: %v", w.id, completeErr)
		}

		w.scheduler.statusMutex.Lock()
		w.scheduler.status.TotalFailed++
		w.scheduler.metrics.CompletedScans["failed"]++
		w.scheduler.metrics.ErrorCounts["scan_error"]++
		w.scheduler.statusMutex.Unlock()

		if w.scheduler.metricsCollector != nil {
			w.scheduler.metricsCollector.RecordScanFailure(scanJob.Method, "scan_error")
		}
	} else {
		// Handle success
		duration := completedAt.Sub(*scanJob.StartedAt)
		log.Printf("[INFO] Worker %d completed scan for volume %s (size: %d bytes, duration: %v)",
			w.id, scanJob.VolumeID, result.TotalSize, duration)

		// Complete scan job as successful
		if completeErr := w.scheduler.store.Scans().CompletesScanJob(ctx, scanJob.ScanID); completeErr != nil {
			log.Printf("[ERROR] Worker %d failed to mark scan job as completed: %v", w.id, completeErr)
		}

		// Insert complete scan result including filesystem capacity if repository is available
		if w.scheduler.repository != nil {
			if err := w.scheduler.repository.InsertScanResult(w.ctx, result); err != nil {
				log.Printf("[ERROR] Worker %d failed to insert scan result: %v", w.id, err)
			}
		}

		w.scheduler.statusMutex.Lock()
		w.scheduler.status.TotalCompleted++
		w.scheduler.metrics.CompletedScans["completed"]++
		// Update average duration for this method
		currentAvg := w.scheduler.metrics.ScanDurations[scanJob.Method]
		w.scheduler.metrics.ScanDurations[scanJob.Method] = (currentAvg + duration.Seconds()) / 2
		w.scheduler.statusMutex.Unlock()

		if w.scheduler.metricsCollector != nil {
			w.scheduler.metricsCollector.ScanCompleted(scanJob.VolumeID, scanJob.Method, duration, result.TotalSize)
		}
	}

	// Update metrics
	if w.scheduler.metricsCollector != nil {
		w.scheduler.metricsCollector.ScanFinished(scanJob.Method)
	}
}

// runHeartbeat sends periodic heartbeat updates for a scan job
func (w *worker) runHeartbeat(ctx context.Context, scanID string) {
	ticker := time.NewTicker(w.scheduler.heartbeatConfig.Interval)
	defer ticker.Stop()

	progress := int32(0)
	
	for {
		select {
		case <-ticker.C:
			// Estimate progress based on elapsed time (simple heuristic)
			progress += 10
			if progress > 90 {
				progress = 90 // Cap at 90%
			}
			
			err := w.scheduler.store.Scans().UpdateScanJobHeartbeat(ctx, scanID, progress)
			if err != nil {
				log.Printf("[WARN] Worker %d failed to send heartbeat for scan %s: %v", w.id, scanID, err)
				return
			}
			
			log.Printf("[DEBUG] Worker %d sent heartbeat for scan %s (progress: %d%%)", w.id, scanID, progress)
		case <-ctx.Done():
			return
		}
	}
}

// Helper methods for worker stats
func (w *worker) incrementProcessedJobs() {
	w.statsMutex.Lock()
	w.processedJobs++
	w.statsMutex.Unlock()
}

func (w *worker) incrementErrorCount() {
	w.statsMutex.Lock()
	w.errorCount++
	w.statsMutex.Unlock()
}

func (w *worker) GetStats() WorkerStats {
	w.statsMutex.RLock()
	defer w.statsMutex.RUnlock()
	
	return WorkerStats{
		ID:             w.id,
		ProcessedCount: w.processedJobs,
		ErrorCount:     w.errorCount,
		IsActive:       false, // Simple worker doesn't track current scan
	}
}

// processTask processes a single scan task
func (w *worker) processTask(task *ScanTask) {
	w.updateActiveScans(1)
	defer w.updateActiveScans(-1)

	log.Printf("[INFO] Worker %d processing scan %s (volume: %s)", w.id, task.ScanID, task.VolumeName)

	// Create scan run record - using models types now
	scanRun := &models.ScanJob{
		ScanID:   task.ScanID,
		VolumeID: task.VolumeName,
		Status:   "running",
		Method:   task.Method,
		Progress: new(int32), // Initialize as pointer
	}
	now := time.Now()
	scanRun.StartedAt = &now

	// Insert initial scan run
	if err := w.scheduler.repository.InsertScanRun(w.ctx, scanRun); err != nil {
		log.Printf("[ERROR] Worker %d failed to insert scan run: %v", w.id, err)
		return
	}

	// Update metrics
	if w.scheduler.metricsCollector != nil {
		w.scheduler.metricsCollector.ScanStarted(task.Method)
	}

	// Create timeout context
	ctx, cancel := context.WithTimeout(w.ctx, task.Timeout)
	defer cancel()

	// Perform the scan
	result, err := w.scheduler.scanner.ScanVolume(ctx, task.VolumeName)
	completedAt := time.Now()
	duration := completedAt.Sub(now)

	// Update scan run with results
	scanRun.CompletedAt = &completedAt
	progress := int32(100)
	scanRun.Progress = &progress

	if err != nil {
		// Handle failure
		scanRun.Status = "failed"
		errorMsg := err.Error()
		scanRun.ErrorMessage = &errorMsg

		log.Printf("[ERROR] Worker %d scan failed for volume %s: %v", w.id, task.VolumeName, err)

		w.scheduler.statusMutex.Lock()
		w.scheduler.status.TotalFailed++
		w.scheduler.metrics.CompletedScans["failed"]++
		w.scheduler.metrics.ErrorCounts["scan_error"]++
		w.scheduler.statusMutex.Unlock()

		if w.scheduler.metricsCollector != nil {
			w.scheduler.metricsCollector.RecordScanFailure(task.Method, "scan_error")
		}
	} else {
		// Handle success
		scanRun.Status = "completed"

		log.Printf("[INFO] Worker %d completed scan for volume %s (size: %d bytes, duration: %v)",
			w.id, task.VolumeName, result.TotalSize, duration)

		// Insert complete scan result including filesystem capacity
		if err := w.scheduler.repository.InsertScanResult(w.ctx, result); err != nil {
			log.Printf("[ERROR] Worker %d failed to insert scan result: %v", w.id, err)
		}

		w.scheduler.statusMutex.Lock()
		w.scheduler.status.TotalCompleted++
		w.scheduler.metrics.CompletedScans["completed"]++
		// Update average duration for this method
		currentAvg := w.scheduler.metrics.ScanDurations[task.Method]
		w.scheduler.metrics.ScanDurations[task.Method] = (currentAvg + duration.Seconds()) / 2
		w.scheduler.statusMutex.Unlock()

		if w.scheduler.metricsCollector != nil {
			w.scheduler.metricsCollector.ScanCompleted(task.VolumeName, task.Method, duration, result.TotalSize)
		}
	}

	// Update scan run in database
	if err := w.scheduler.repository.UpdateScanRun(w.ctx, scanRun); err != nil {
		log.Printf("[ERROR] Worker %d failed to update scan run: %v", w.id, err)
	}

	// Update metrics
	if w.scheduler.metricsCollector != nil {
		w.scheduler.metricsCollector.ScanFinished(task.Method)
	}
}

func (w *worker) updateActiveScans(delta int) {
	w.scheduler.statusMutex.Lock()
	w.scheduler.status.ActiveScans += delta
	w.scheduler.metrics.ActiveScans += delta

	// Update worker utilization metrics
	if w.scheduler.metricsCollector != nil {
		utilization := w.scheduler.calculateWorkerUtilizationLocked()
		w.scheduler.metricsCollector.UpdateSchedulerWorkerUtilization(utilization)
	}
	w.scheduler.statusMutex.Unlock()
}
