// Package volumes provides volume management services
package volumes

import (
	"context"
	"fmt"
	"log"
	"sync"
	"sync/atomic"
	"time"

	"github.com/jackc/pgx/v5/pgtype"
	"github.com/mantonx/volumeviz/internal/db/sqlc"
	"github.com/mantonx/volumeviz/internal/interfaces"
	"github.com/mantonx/volumeviz/internal/store"
)

// Priority levels for size calculation jobs
type Priority int

const (
	PriorityHigh       Priority = 1 // New volumes (never scanned)
	PriorityMedium     Priority = 2 // Volumes with containers attached
	PriorityLow        Priority = 3 // Orphaned volumes
	PriorityMaintenance Priority = 4 // Volumes >30 days since scan
)

// SizeCalculationJob represents a job in the worker queue
type SizeCalculationJob struct {
	VolumeID       string
	Driver         string
	MountPoint     string
	Priority       Priority
	OrganizationID int64
	ContainerCount int
	LastScanAt     *time.Time
	QueuedAt       time.Time
}

// SizeWorkerConfig holds configuration for the worker pool
type SizeWorkerConfig struct {
	WorkerCount            int           // Number of concurrent workers
	MaxQueueSize           int           // Maximum number of jobs in queue
	StaleScanThreshold     time.Duration // Age after which scan is considered stale (30 days)
	ErrorBackoffDuration   time.Duration // How long to wait before retrying failed jobs
	EnableIntelligentQueue bool          // Whether to use priority-based scheduling
}

// DefaultSizeWorkerConfig returns sensible defaults
func DefaultSizeWorkerConfig() SizeWorkerConfig {
	return SizeWorkerConfig{
		WorkerCount:            2,
		MaxQueueSize:           1000,
		StaleScanThreshold:     30 * 24 * time.Hour, // 30 days
		ErrorBackoffDuration:   5 * time.Minute,
		EnableIntelligentQueue: true,
	}
}

// Broadcaster interface for real-time updates (Phase 3)
type Broadcaster interface {
	BroadcastVolumeSizeUpdate(volumeID string, sizeBytes int64, calculationTime float64)
}

// CacheInvalidator interface for cache invalidation (Phase 3)
type CacheInvalidator interface {
	Invalidate(volumeID string)
}

// SizeWorkerPool manages a pool of workers for size calculation
type SizeWorkerPool struct {
	dockerService interfaces.DockerService
	store         store.Store
	calculator    *SizeCalculator
	config        SizeWorkerConfig
	broadcaster   Broadcaster      // Optional: for real-time WebSocket updates (Phase 3)
	cache         CacheInvalidator // Optional: for cache invalidation (Phase 3)

	// Job queue (priority-based)
	jobQueue   chan *SizeCalculationJob
	jobQueueMu sync.RWMutex
	jobMap     map[string]*SizeCalculationJob // Track jobs to prevent duplicates

	// Worker management
	workers     []*sizeWorker
	workerCtx   context.Context
	workerStop  context.CancelFunc
	workerWg    sync.WaitGroup
	running     atomic.Bool
	shuttingDown atomic.Bool

	// Metrics
	jobsQueued      atomic.Int64
	jobsProcessed   atomic.Int64
	jobsSucceeded   atomic.Int64
	jobsFailed      atomic.Int64
	jobsSkipped     atomic.Int64
	totalProcessing atomic.Int64 // Duration in milliseconds
}

// sizeWorker represents a single worker in the pool
type sizeWorker struct {
	id            int
	pool          *SizeWorkerPool
	ctx           context.Context
	currentJob    atomic.Pointer[SizeCalculationJob]
	jobsProcessed atomic.Int64
}

// NewSizeWorkerPool creates a new worker pool for size calculations
func NewSizeWorkerPool(
	dockerService interfaces.DockerService,
	store store.Store,
	calculator *SizeCalculator,
	config SizeWorkerConfig,
) *SizeWorkerPool {
	return &SizeWorkerPool{
		dockerService: dockerService,
		store:         store,
		calculator:    calculator,
		config:        config,
		jobQueue:      make(chan *SizeCalculationJob, config.MaxQueueSize),
		jobMap:        make(map[string]*SizeCalculationJob),
		broadcaster:   nil, // Optional, set via SetBroadcaster()
	}
}

// SetBroadcaster sets the broadcaster for real-time updates (Phase 3)
func (p *SizeWorkerPool) SetBroadcaster(broadcaster Broadcaster) {
	p.broadcaster = broadcaster
}

// SetCache sets the cache invalidator for this worker pool (Phase 3)
func (p *SizeWorkerPool) SetCache(cache CacheInvalidator) {
	p.cache = cache
}

// Start starts the worker pool
func (p *SizeWorkerPool) Start(ctx context.Context) error {
	if p.running.Load() {
		return fmt.Errorf("worker pool already running")
	}

	p.workerCtx, p.workerStop = context.WithCancel(ctx)
	p.running.Store(true)

	// Create and start workers
	p.workers = make([]*sizeWorker, p.config.WorkerCount)
	for i := 0; i < p.config.WorkerCount; i++ {
		worker := &sizeWorker{
			id:   i,
			pool: p,
			ctx:  p.workerCtx,
		}
		p.workers[i] = worker

		p.workerWg.Add(1)
		go worker.run()
	}

	log.Printf("[SIZE-WORKER] Started %d workers (queue size: %d)", p.config.WorkerCount, p.config.MaxQueueSize)
	return nil
}

// Stop stops the worker pool gracefully
func (p *SizeWorkerPool) Stop() error {
	if !p.running.Load() {
		return nil
	}

	p.shuttingDown.Store(true)
	log.Printf("[SIZE-WORKER] Shutting down worker pool...")

	// Stop accepting new jobs
	p.workerStop()

	// Close job queue
	close(p.jobQueue)

	// Wait for workers to finish
	p.workerWg.Wait()

	p.running.Store(false)
	log.Printf("[SIZE-WORKER] Worker pool stopped")
	return nil
}

// QueueJob adds a volume to the job queue if not already queued
func (p *SizeWorkerPool) QueueJob(job *SizeCalculationJob) error {
	if p.shuttingDown.Load() {
		return fmt.Errorf("worker pool is shutting down")
	}

	// Check if job already queued
	p.jobQueueMu.Lock()
	if _, exists := p.jobMap[job.VolumeID]; exists {
		p.jobQueueMu.Unlock()
		p.jobsSkipped.Add(1)
		log.Printf("[SIZE-WORKER] Job for volume %s already queued, skipping", job.VolumeID)
		return nil
	}
	p.jobMap[job.VolumeID] = job
	p.jobQueueMu.Unlock()

	// Add to queue
	job.QueuedAt = time.Now()
	select {
	case p.jobQueue <- job:
		p.jobsQueued.Add(1)
		log.Printf("[SIZE-WORKER] Queued job for volume %s (priority: %d)", job.VolumeID, job.Priority)
		return nil
	default:
		// Queue is full
		p.jobQueueMu.Lock()
		delete(p.jobMap, job.VolumeID)
		p.jobQueueMu.Unlock()
		return fmt.Errorf("job queue is full")
	}
}

// DiscoverAndQueueVolumes scans the database for volumes needing size calculation
func (p *SizeWorkerPool) DiscoverAndQueueVolumes(ctx context.Context, organizationID int64) error {
	queries, ok := p.store.Queries().(*sqlc.Queries)
	if !ok {
		return fmt.Errorf("database queries not available")
	}

	// Get all active volumes
	volumes, err := queries.ListVolumes(ctx, sqlc.ListVolumesParams{
		OrganizationID: pgtype.Int8{Int64: organizationID, Valid: true},
		Limit:          10000, // High limit to get all volumes
		Offset:         0,
	})
	if err != nil {
		return fmt.Errorf("failed to list volumes: %w", err)
	}

	queued := 0
	for _, vol := range volumes {
		// Skip inactive volumes
		if vol.IsActive.Valid && !vol.IsActive.Bool {
			continue
		}

		// Determine priority
		priority := p.calculatePriority(vol)

		// Get mount point
		mountPoint := vol.MountPoint

		// Create job
		job := &SizeCalculationJob{
			VolumeID:       vol.VolumeID,
			Driver:         p.getDriver(vol),
			MountPoint:     mountPoint,
			Priority:       priority,
			OrganizationID: organizationID,
			ContainerCount: p.getContainerCount(vol),
			LastScanAt:     p.getLastScanAt(vol),
		}

		// Queue the job
		if err := p.QueueJob(job); err != nil {
			log.Printf("[SIZE-WORKER] Failed to queue job for %s: %v", vol.VolumeID, err)
			continue
		}
		queued++
	}

	log.Printf("[SIZE-WORKER] Discovered and queued %d volumes for size calculation", queued)
	return nil
}

// calculatePriority determines the priority for a volume
func (p *SizeWorkerPool) calculatePriority(vol sqlc.Volumes) Priority {
	// High priority: Never scanned
	if !vol.LastScanAt.Valid {
		return PriorityHigh
	}

	// Medium priority: Has containers attached
	if vol.ContainerCount.Valid && vol.ContainerCount.Int32 > 0 {
		return PriorityMedium
	}

	// Maintenance priority: Scan is stale (>30 days old)
	if vol.LastScanAt.Valid {
		age := time.Since(vol.LastScanAt.Time)
		if age > p.config.StaleScanThreshold {
			return PriorityMaintenance
		}
	}

	// Low priority: Orphaned volumes
	return PriorityLow
}

// getDriver extracts the driver from volume
func (p *SizeWorkerPool) getDriver(vol sqlc.Volumes) string {
	if vol.FilesystemType.Valid {
		return vol.FilesystemType.String
	}
	return "local"
}

// getContainerCount extracts container count
func (p *SizeWorkerPool) getContainerCount(vol sqlc.Volumes) int {
	if vol.ContainerCount.Valid {
		return int(vol.ContainerCount.Int32)
	}
	return 0
}

// getLastScanAt extracts last scan time
func (p *SizeWorkerPool) getLastScanAt(vol sqlc.Volumes) *time.Time {
	if vol.LastScanAt.Valid {
		return &vol.LastScanAt.Time
	}
	return nil
}

// run is the main worker loop
func (w *sizeWorker) run() {
	defer w.pool.workerWg.Done()

	log.Printf("[SIZE-WORKER-%d] Worker started", w.id)

	for {
		select {
		case <-w.ctx.Done():
			log.Printf("[SIZE-WORKER-%d] Worker stopped", w.id)
			return

		case job, ok := <-w.pool.jobQueue:
			if !ok {
				// Channel closed
				log.Printf("[SIZE-WORKER-%d] Job queue closed, worker stopping", w.id)
				return
			}

			// Process the job
			w.processJob(job)
		}
	}
}

// processJob processes a single size calculation job
func (w *sizeWorker) processJob(job *SizeCalculationJob) {
	w.currentJob.Store(job)
	defer w.currentJob.Store(nil)

	// Remove from job map
	w.pool.jobQueueMu.Lock()
	delete(w.pool.jobMap, job.VolumeID)
	w.pool.jobQueueMu.Unlock()

	startTime := time.Now()
	log.Printf("[SIZE-WORKER-%d] Processing job for volume %s (priority: %d, queued: %v ago)",
		w.id, job.VolumeID, job.Priority, time.Since(job.QueuedAt).Round(time.Second))

	// Calculate size
	result, err := w.pool.calculator.CalculateSize(w.ctx, job.VolumeID, job.Driver, job.MountPoint)

	w.pool.jobsProcessed.Add(1)
	w.jobsProcessed.Add(1)
	duration := time.Since(startTime)
	w.pool.totalProcessing.Add(duration.Milliseconds())

	if err != nil {
		w.pool.jobsFailed.Add(1)
		log.Printf("[SIZE-WORKER-%d] Failed to calculate size for %s: %v (duration: %v)", w.id, job.VolumeID, err, duration)
		return
	}

	// Store result
	if err := w.pool.calculator.StoreResult(w.ctx, result, job.OrganizationID); err != nil {
		log.Printf("[SIZE-WORKER-%d] Failed to store result for %s: %v", w.id, job.VolumeID, err)
		w.pool.jobsFailed.Add(1)
		return
	}

	w.pool.jobsSucceeded.Add(1)
	log.Printf("[SIZE-WORKER-%d] Successfully processed %s: %d bytes in %v",
		w.id, job.VolumeID, result.TotalSizeBytes, duration.Round(time.Millisecond))

	// Broadcast size update via WebSocket (Phase 3)
	if w.pool.broadcaster != nil {
		w.pool.broadcaster.BroadcastVolumeSizeUpdate(
			job.VolumeID,
			result.TotalSizeBytes,
			duration.Seconds(),
		)
	}

	// Invalidate cache since size was updated (Phase 3)
	if w.pool.cache != nil {
		w.pool.cache.Invalidate(job.VolumeID)
	}
}

// GetMetrics returns current worker pool metrics
func (p *SizeWorkerPool) GetMetrics() map[string]int64 {
	avgProcessingTime := int64(0)
	if processed := p.jobsProcessed.Load(); processed > 0 {
		avgProcessingTime = p.totalProcessing.Load() / processed
	}

	return map[string]int64{
		"jobs_queued":         p.jobsQueued.Load(),
		"jobs_processed":      p.jobsProcessed.Load(),
		"jobs_succeeded":      p.jobsSucceeded.Load(),
		"jobs_failed":         p.jobsFailed.Load(),
		"jobs_skipped":        p.jobsSkipped.Load(),
		"queue_size":          int64(len(p.jobQueue)),
		"worker_count":        int64(len(p.workers)),
		"avg_processing_time": avgProcessingTime, // milliseconds
	}
}

// GetStatus returns the current status of the worker pool
func (p *SizeWorkerPool) GetStatus() string {
	if !p.running.Load() {
		return "stopped"
	}
	if p.shuttingDown.Load() {
		return "shutting_down"
	}
	return "running"
}
