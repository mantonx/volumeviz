package scheduler

import (
	"context"
	"fmt"
	"log"
	"regexp"
	"sync"
	"time"
	"math/rand"
	"strings"

	"github.com/google/uuid"
	"github.com/mantonx/volumeviz/internal/core/interfaces"
	"github.com/mantonx/volumeviz/internal/database"
)

// Scheduler implements the ScanScheduler interface
type Scheduler struct {
	config         *SchedulerConfig
	scanner        interfaces.VolumeScanner
	repository     ScanRepository
	volumeProvider VolumeProvider
	metricsCollector interfaces.MetricsCollector
	
	// Worker pool and queue
	taskQueue      chan *ScanTask
	workers        []*worker
	workerWG       sync.WaitGroup
	
	// Scheduler state
	running        bool
	ctx            context.Context
	cancel         context.CancelFunc
	schedulerWG    sync.WaitGroup
	
	// Metrics and status
	metrics        *SchedulerMetrics
	status         *SchedulerStatus
	statusMutex    sync.RWMutex
	
	// Skip pattern regex
	skipPattern    *regexp.Regexp
	
	// Rate limiting
	lastEnqueueAll time.Time
	rateLimitMutex sync.Mutex
}

// worker represents a scan worker goroutine
type worker struct {
	id        int
	scheduler *Scheduler
	ctx       context.Context
}

// NewScheduler creates a new scan scheduler
func NewScheduler(
	config *SchedulerConfig,
	scanner interfaces.VolumeScanner,
	repository ScanRepository,
	volumeProvider VolumeProvider,
	metricsCollector interfaces.MetricsCollector,
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
	
	scheduler := &Scheduler{
		config:           config,
		scanner:          scanner,
		repository:       repository,
		volumeProvider:   volumeProvider,
		metricsCollector: metricsCollector,
		taskQueue:        make(chan *ScanTask, config.QueueSize),
		skipPattern:      skipPattern,
		metrics: &SchedulerMetrics{
			CompletedScans: make(map[string]int64),
			ScanDurations:  make(map[string]float64),
			ErrorCounts:    make(map[string]int64),
		},
		status: &SchedulerStatus{
			WorkerCount: config.Concurrency,
		},
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
	
	log.Printf("[INFO] Starting scan scheduler (interval: %v, concurrency: %d, queue size: %d)",
		s.config.Interval, s.config.Concurrency, s.config.QueueSize)
	
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
		WorkerUtilization: s.calculateWorkerUtilization(),
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

// EnqueueVolume enqueues a single volume for scanning
func (s *Scheduler) EnqueueVolume(volumeName string) (string, error) {
	if !s.IsRunning() {
		return "", fmt.Errorf("scheduler not running")
	}
	
	// Check if volume should be skipped
	if s.shouldSkipVolume(volumeName) {
		return "", fmt.Errorf("volume %s matches skip pattern", volumeName)
	}
	
	// Check if volume allows bind mount scanning if it's a bind mount
	if s.isBindMount(volumeName) && !s.isBindMountAllowed(volumeName) {
		return "", fmt.Errorf("bind mount %s not in allow list", volumeName)
	}
	
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
		ScanID:     scanRun.ScanID,
		VolumeName: scanRun.VolumeID, // Note: VolumeID in ScanJob corresponds to volume name
		Status:     scanRun.Status,
		Method:     scanRun.Method,
		Progress:   scanRun.Progress,
		StartedAt:  scanRun.StartedAt,
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
	if s.config.Concurrency == 0 {
		return 0.0
	}
	return float64(s.metrics.ActiveScans) / float64(s.config.Concurrency)
}

// run executes the worker loop
func (w *worker) run() {
	defer w.scheduler.workerWG.Done()
	
	log.Printf("[INFO] Worker %d started", w.id)
	
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
		}
	}
}

// processTask processes a single scan task
func (w *worker) processTask(task *ScanTask) {
	w.updateActiveScans(1)
	defer w.updateActiveScans(-1)
	
	log.Printf("[INFO] Worker %d processing scan %s (volume: %s)", w.id, task.ScanID, task.VolumeName)
	
	// Create scan run record
	scanRun := &database.ScanJob{
		ScanID:   task.ScanID,
		VolumeID: task.VolumeName,
		Status:   "running",
		Method:   task.Method,
		Progress: 0,
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
	scanRun.Progress = 100
	
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
		
		// Insert volume stats
		stats := &database.VolumeScanStats{
			VolumeName: task.VolumeName,
			SizeBytes:  result.TotalSize,
			ScanMethod: result.Method,
			DurationMs: duration.Milliseconds(),
			Timestamp:  completedAt,
		}
		
		if result.FileCount > 0 {
			stats.FileCount = &result.FileCount
		}
		
		if err := w.scheduler.repository.InsertVolumeStats(w.ctx, stats); err != nil {
			log.Printf("[ERROR] Worker %d failed to insert volume stats: %v", w.id, err)
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
		utilization := w.scheduler.calculateWorkerUtilization()
		w.scheduler.metricsCollector.UpdateSchedulerWorkerUtilization(utilization)
	}
	w.scheduler.statusMutex.Unlock()
}