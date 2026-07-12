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
	"github.com/mantonx/volumeviz/internal/realtime"
	"github.com/mantonx/volumeviz/internal/store"
)

// Scheduler implements the ScanScheduler interface with hardened scan orchestration
type Scheduler struct {
	config              *SchedulerConfig
	scanner             interfaces.VolumeScanner
	repository          ScanRepository
	volumeProvider      VolumeProvider
	metricsCollector    interfaces.MetricsCollector
	enrichmentManager   interfaces.EnrichmentManager
	// Enhanced store integration for atomic operations
	store               store.Store
	progressBroadcaster realtime.BroadcasterInterface

	// Worker pool and queue
	taskQueue chan *ScanTask
	workers   []*worker
	workerWG  sync.WaitGroup

	// Hardened features
	watchdog        *Watchdog
	heartbeatConfig HeartbeatConfig

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
	shuttingDown  bool
	shutdownMutex sync.RWMutex
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
	progressBroadcaster realtime.BroadcasterInterface,
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
		config:              config,
		scanner:             scanner,
		repository:          repository,
		volumeProvider:      volumeProvider,
		metricsCollector:    metricsCollector,
		store:               store,
		progressBroadcaster: progressBroadcaster,
		taskQueue:           make(chan *ScanTask, config.QueueSize),
		skipPattern:         skipPattern,
		heartbeatConfig:     heartbeatConfig,
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

// SetEnrichmentManager sets the enrichment manager for media enrichment phase
func (s *Scheduler) SetEnrichmentManager(manager interfaces.EnrichmentManager) {
	s.enrichmentManager = manager
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

	// Handle existing in-flight jobs from previous instance
	if s.store != nil && s.watchdog != nil {
		// Mark in-flight jobs as paused (instead of failed) for graceful restart
		err := s.watchdog.MarkInFlightJobsAsPaused("Scheduler restart - previous instance terminated")
		if err != nil {
			log.Printf("[WARN] Failed to mark in-flight jobs as paused during startup: %v", err)
		} else {
			// Attempt to resume paused scans using resume manager
			go func() {
				ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
				defer cancel()

				resumeManager := NewResumeManager(s.store, s.scanner, s.progressBroadcaster)
				if err := resumeManager.ResumePausedScans(ctx); err != nil {
					log.Printf("[ERROR] Failed to resume paused scans: %v", err)
				}
			}()
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
		
		// Get organization ID from volume (system-level lookup for scheduler)
		var organizationID *int64
		if volume, err := s.store.Volumes().GetVolumeByVolumeIDSystemLevel(s.ctx, volumeName); err == nil {
			organizationID = volume.OrganizationID
		}
		
		scanJob := models.CreateScanJobParams{
			ScanID:         scanID,
			VolumeID:       volumeName,
			OrganizationID: organizationID,
			Status:         "pending",
			Method:         s.selectScanMethod(),
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

	// Create a separate ticker for resume operations (check every 2 minutes)
	resumeTicker := time.NewTicker(2 * time.Minute)
	defer resumeTicker.Stop()

	// Create a ticker for real-time WebSocket broadcasts (every second)
	broadcastTicker := time.NewTicker(3 * time.Second)
	defer broadcastTicker.Stop()

	// Create a ticker for volume state broadcasts (every 5 seconds for non-scan updates)
	volumeStateTicker := time.NewTicker(5 * time.Second)
	defer volumeStateTicker.Stop()

	log.Printf("[INFO] Periodic scheduler started (interval: %v, resume check: 2m, broadcast: 1s, volume state: 5s)", s.config.Interval)

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
		case <-resumeTicker.C:
			s.runPeriodicResumeCheck()
		case <-broadcastTicker.C:
			s.broadcastAllScansProgress()
		case <-volumeStateTicker.C:
			s.broadcastVolumeStates()
		case <-s.ctx.Done():
			return
		}
	}
}

// broadcastAllScansProgress broadcasts progress updates for all scans regardless of status
// This provides continuous real-time updates for running, paused, failed, and completed scans
func (s *Scheduler) broadcastAllScansProgress() {
	if s.progressBroadcaster == nil || s.store == nil {
		return
	}

	// Get all recent scans (running, paused, failed, completed)
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	scansRepo := s.store.Scans()
	if scansRepo == nil {
		return
	}

	// Get recent scan jobs for real-time broadcasting (all statuses)
	recentScanJobs, err := scansRepo.ListScanJobs(ctx, 20, 0)
	if err != nil {
		return
	}

	// Only broadcast progress for actively running scans to avoid message flooding
	// For completed/failed scans, we'll rely on the frontend fetching historical data
	for _, scanJob := range recentScanJobs {
		// Only broadcast for running scans to prevent infinite message loops
		if scanJob.Status == "running" {
			go func(scanID, volumeID, status string) {
				if err := s.progressBroadcaster.BroadcastComprehensiveScanProgress(context.Background(), scanID, volumeID); err != nil {
					// Log error but don't disrupt the scheduler
					if strings.Contains(err.Error(), "no rows") {
						// Scan data might not be available yet - this is normal
						return
					}
					log.Printf("[WARN] Failed to broadcast progress for scan %s (status: %s): %v", scanID, status, err)
				}
			}(scanJob.ScanID, scanJob.VolumeID, scanJob.Status)
		}
	}
}

// broadcastVolumeStates broadcasts current volume states for volumes without recent scans
// This ensures the frontend always has up-to-date information about all volumes
func (s *Scheduler) broadcastVolumeStates() {
	if s.progressBroadcaster == nil {
		return
	}

	// For now, volume state updates are handled by the frontend fetching latest data
	// when receiving the continuous progress updates from broadcastAllScansProgress
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

// runPeriodicResumeCheck checks for and resumes failed/paused scans
func (s *Scheduler) runPeriodicResumeCheck() {
	if s.store == nil {
		return
	}

	log.Printf("[INFO] Checking for failed/paused scans to resume")

	// Create resume manager and check for paused scans
	go func() {
		ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
		defer cancel()

		resumeManager := NewResumeManager(s.store, s.scanner, s.progressBroadcaster)
		if err := resumeManager.ResumePausedScans(ctx); err != nil {
			log.Printf("[ERROR] Periodic resume check failed: %v", err)
			s.statusMutex.Lock()
			s.metrics.ErrorCounts["resume"]++
			s.statusMutex.Unlock()
		}
	}()
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

// selectScanMethod returns the scan method label recorded on scan_jobs rows
// for display/audit purposes. This does not select actual scan behavior —
// the scanner only has one method (Walker, see internal/services/scanner/
// walker.go) since diskus/du were removed as external dependencies once
// benchmarking showed a parallelized Go walker matched or beat both.
func (s *Scheduler) selectScanMethod() string {
	return "walker"
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
		case <-w.ctx.Done():
			log.Printf("[INFO] Worker %d stopped", w.id)
			return
		case <-time.After(1 * time.Second):
			// Try to claim work from store (hardened mode)
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

	// Ensure scan job is marked as failed if we panic or exit early
	var scanCompleted bool
	defer func() {
		if !scanCompleted {
			// Mark as failed if we didn't complete normally
			if err := recover(); err != nil {
				log.Printf("[ERROR] Worker %d panic during scan %s: %v", w.id, scanJob.ScanID, err)
				errorMsg := fmt.Sprintf("Scan panic: %v", err)
				if failErr := w.scheduler.store.Scans().FailScanJob(context.Background(), scanJob.ScanID, errorMsg); failErr != nil {
					log.Printf("[ERROR] Worker %d failed to mark panicked scan as failed: %v", w.id, failErr)
				}
			}
		}
	}()

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

	// Initialize database progress tracking before starting scan
	if w.scheduler.store != nil {
		w.initializeDatabaseProgressTracking(ctx, scanJob.ScanID, scanJob.VolumeID)
	}

	// Broadcast scan started event
	if w.scheduler.progressBroadcaster != nil {
		w.scheduler.progressBroadcaster.BroadcastScanStarted(scanJob.ScanID, scanJob.VolumeID)
	}

	// Perform the scan
	result, err := w.scheduler.scanner.ScanVolume(ctx, scanJob.VolumeID)
	completedAt := time.Now()

	// Stop heartbeat
	heartbeatCancel()

	if err != nil {
		// Handle failure
		log.Printf("[ERROR] Worker %d scan failed for volume %s: %v", w.id, scanJob.VolumeID, err)
		w.incrementErrorCount()

		// Mark all scan phases as failed first
		if w.scheduler.store != nil && w.scheduler.store.ScanProgress() != nil {
			phases := []string{"volume_scan", "filesystem_indexing", "media_enrichment"}
			for _, phase := range phases {
				if phaseErr := w.scheduler.store.ScanProgress().FailScanPhase(ctx, scanJob.ScanID, phase, err.Error()); phaseErr != nil {
					log.Printf("[ERROR] Worker %d failed to mark phase %s as failed for scan %s: %v", w.id, phase, scanJob.ScanID, phaseErr)
				} else {
					log.Printf("[INFO] Worker %d marked phase %s as failed for scan %s", w.id, phase, scanJob.ScanID)
				}
			}
		}

		// Mark scan job as failed with error message
		if failErr := w.scheduler.store.Scans().FailScanJob(ctx, scanJob.ScanID, err.Error()); failErr != nil {
			log.Printf("[ERROR] Worker %d failed to mark scan job as failed: %v", w.id, failErr)
		}

		// Broadcast scan error
		if w.scheduler.progressBroadcaster != nil {
			w.scheduler.progressBroadcaster.BroadcastScanError(scanJob.ScanID, scanJob.VolumeID, err.Error(), "scan_failure")
		}

		w.scheduler.statusMutex.Lock()
		w.scheduler.status.TotalFailed++
		w.scheduler.metrics.CompletedScans["failed"]++
		w.scheduler.metrics.ErrorCounts["scan_error"]++
		w.scheduler.statusMutex.Unlock()

		if w.scheduler.metricsCollector != nil {
			w.scheduler.metricsCollector.RecordScanFailure(scanJob.Method, "scan_error")
		}

		// Mark scan as completed (even though it failed)
		scanCompleted = true
	} else {
		// Handle success
		duration := completedAt.Sub(*scanJob.StartedAt)
		log.Printf("[INFO] Worker %d completed scan for volume %s (size: %d bytes, duration: %v)",
			w.id, scanJob.VolumeID, result.TotalSize, duration)

		// Complete volume_scan phase with actual file count data
		if w.scheduler.store != nil && w.scheduler.store.ScanProgress() != nil {
			// Update volume_scan phase with completion status and file count
			completedStatus := "completed"
			progress := 100
			itemsProcessed := int64(result.FileCount)
			itemsTotal := int64(result.FileCount + result.DirectoryCount)
			itemsSuccessful := int64(result.FileCount)

			updateParams := models.UpdateScanPhaseParams{
				ScanID:          scanJob.ScanID,
				PhaseName:       "volume_scan",
				Status:          &completedStatus,
				Progress:        &progress,
				ItemsProcessed:  &itemsProcessed,
				ItemsTotal:      &itemsTotal,
				ItemsSuccessful: &itemsSuccessful,
			}

			if err := w.scheduler.store.ScanProgress().UpdateScanPhaseProgress(ctx, updateParams); err != nil {
				log.Printf("[ERROR] Worker %d failed to update volume_scan phase for scan %s: %v", w.id, scanJob.ScanID, err)
			} else {
				log.Printf("[INFO] Worker %d completed volume_scan phase for scan %s (processed %d files)", w.id, scanJob.ScanID, result.FileCount)
			}

			// Trigger filesystem indexing with scan ID for progress tracking
			if err := w.scheduler.scanner.TriggerFilesystemIndexingWithScanID(ctx, scanJob.VolumeID, true, scanJob.ScanID); err != nil {
				log.Printf("[ERROR] Worker %d failed to trigger filesystem indexing for scan %s: %v", w.id, scanJob.ScanID, err)
				// Update filesystem_indexing phase as failed
				if failErr := w.scheduler.store.ScanProgress().FailScanPhase(ctx, scanJob.ScanID, "filesystem_indexing", err.Error()); failErr != nil {
					log.Printf("[ERROR] Worker %d failed to mark filesystem_indexing phase as failed for scan %s: %v", w.id, scanJob.ScanID, failErr)
				}
			} else {
				log.Printf("[INFO] Worker %d triggered filesystem indexing for scan %s", w.id, scanJob.ScanID)
			}

			// Trigger media enrichment phase (will wait for filesystem indexing to complete)
			if w.scheduler.enrichmentManager != nil {
				go func(scanID, volumeID string) {
					if err := w.scheduler.enrichmentManager.EnrichVolumeWithScanID(context.Background(), volumeID, scanID); err != nil {
						log.Printf("[ERROR] Worker failed to trigger media enrichment for scan %s: %v", scanID, err)
						// Update media_enrichment phase as failed
						if failErr := w.scheduler.store.ScanProgress().FailScanPhase(context.Background(), scanID, "media_enrichment", err.Error()); failErr != nil {
							log.Printf("[ERROR] Worker failed to mark media_enrichment phase as failed for scan %s: %v", scanID, failErr)
						}
					} else {
						log.Printf("[INFO] Worker triggered media enrichment for scan %s", scanID)
					}
				}(scanJob.ScanID, scanJob.VolumeID)
			} else {
				log.Printf("[WARN] Worker %d: enrichment manager not available, skipping media enrichment for scan %s", w.id, scanJob.ScanID)
			}
		}

		// Don't mark scan job as completed here - let it complete naturally
		// when all phases are actually finished. The scan job will be marked
		// as completed by the watchdog or when the last phase finishes.

		// Broadcast scan progress (not completion yet)
		if w.scheduler.progressBroadcaster != nil {
			if err := w.scheduler.progressBroadcaster.BroadcastComprehensiveScanProgress(ctx, scanJob.ScanID, scanJob.VolumeID); err != nil {
				log.Printf("[WARN] Worker %d failed to broadcast progress for scan %s: %v", w.id, scanJob.ScanID, err)
			}
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

		// Mark scan as successfully completed
		scanCompleted = true
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

			// Broadcast comprehensive progress update
			if w.scheduler.progressBroadcaster != nil {
				scanJob, getErr := w.scheduler.store.Scans().GetScanJobByScanID(ctx, scanID)
				if getErr == nil && scanJob != nil {
					if broadcastErr := w.scheduler.progressBroadcaster.BroadcastComprehensiveScanProgress(ctx, scanID, scanJob.VolumeID); broadcastErr != nil {
						log.Printf("[WARN] Worker %d failed to broadcast progress for scan %s: %v", w.id, scanID, broadcastErr)
					}
				}
			}
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

// initializeDatabaseProgressTracking creates scan phases in the database for detailed tracking
func (w *worker) initializeDatabaseProgressTracking(ctx context.Context, scanID, volumeID string) {
	scanProgressRepo := w.scheduler.store.ScanProgress()
	if scanProgressRepo == nil {
		log.Printf("[WARN] Worker %d: ScanProgress repo is nil for scan %s", w.id, scanID)
		return
	}

	log.Printf("[INFO] Worker %d initializing database progress for scan %s (volume: %s)", w.id, scanID, volumeID)

	now := time.Now()

	// Create volume scan phase
	_, err := scanProgressRepo.CreateScanPhase(ctx, models.CreateScanPhaseParams{
		ScanID:     scanID,
		PhaseName:  "volume_scan",
		PhaseOrder: 1,
		Status:     "running",
		StartedAt:  &now,
		Metadata:   "{}",
	})
	if err != nil {
		log.Printf("[ERROR] Worker %d failed to create volume_scan phase for scan %s: %v", w.id, scanID, err)
	} else {
		log.Printf("[INFO] Worker %d successfully created volume_scan phase for scan %s", w.id, scanID)
	}

	// Create filesystem indexing phase
	_, err = scanProgressRepo.CreateScanPhase(ctx, models.CreateScanPhaseParams{
		ScanID:     scanID,
		PhaseName:  "filesystem_indexing",
		PhaseOrder: 2,
		Status:     "pending",
		Metadata:   "{}",
	})
	if err != nil {
		log.Printf("[ERROR] Worker %d failed to create filesystem_indexing phase for scan %s: %v", w.id, scanID, err)
	} else {
		log.Printf("[INFO] Worker %d successfully created filesystem_indexing phase for scan %s", w.id, scanID)
	}

	// Create media enrichment phase
	_, err = scanProgressRepo.CreateScanPhase(ctx, models.CreateScanPhaseParams{
		ScanID:     scanID,
		PhaseName:  "media_enrichment",
		PhaseOrder: 3,
		Status:     "pending",
		Metadata:   "{}",
	})
	if err != nil {
		log.Printf("[ERROR] Worker %d failed to create media_enrichment phase for scan %s: %v", w.id, scanID, err)
	} else {
		log.Printf("[INFO] Worker %d successfully created media_enrichment phase for scan %s", w.id, scanID)
	}

	log.Printf("[INFO] Worker %d completed database progress initialization for scan %s", w.id, scanID)

	// Broadcast initial comprehensive progress state
	if w.scheduler.progressBroadcaster != nil {
		if err := w.scheduler.progressBroadcaster.BroadcastComprehensiveScanProgress(ctx, scanID, volumeID); err != nil {
			log.Printf("[WARN] Worker %d failed to broadcast initial progress for scan %s: %v", w.id, scanID, err)
		}
	}
}
