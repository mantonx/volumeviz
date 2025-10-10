package scheduler

import (
	"context"
	"fmt"
	"log"
	"time"

	"github.com/mantonx/volumeviz/internal/services/volumes"
)

// SizeCalculationJob handles background volume size calculation
type SizeCalculationJob struct {
	workerPool     *volumes.SizeWorkerPool
	config         SizeCalculationJobConfig
	running        bool
	stopChan       chan struct{}
	organizationID int64
}

// SizeCalculationJobConfig holds configuration for size calculation job
type SizeCalculationJobConfig struct {
	Enabled        bool          // Whether the job is enabled
	Interval       time.Duration // How often to discover and queue volumes
	OrganizationID int64         // Organization ID to process
}

// NewSizeCalculationJob creates a new size calculation job
func NewSizeCalculationJob(
	workerPool *volumes.SizeWorkerPool,
	config SizeCalculationJobConfig,
) (*SizeCalculationJob, error) {
	if workerPool == nil {
		return nil, fmt.Errorf("worker pool cannot be nil")
	}

	if !config.Enabled {
		log.Printf("[SIZE-CALC-JOB] Size calculation job is disabled")
		return nil, nil
	}

	job := &SizeCalculationJob{
		workerPool:     workerPool,
		config:         config,
		stopChan:       make(chan struct{}),
		organizationID: config.OrganizationID,
	}

	log.Printf("[SIZE-CALC-JOB] Size calculation job configured (interval: %v, org: %d)",
		config.Interval, config.OrganizationID)

	return job, nil
}

// Start starts the size calculation job
func (j *SizeCalculationJob) Start(ctx context.Context) error {
	if j.running {
		return fmt.Errorf("size calculation job already running")
	}

	j.running = true
	log.Printf("[SIZE-CALC-JOB] Starting size calculation job (interval: %v)", j.config.Interval)

	// Start the worker pool first
	if err := j.workerPool.Start(ctx); err != nil {
		return fmt.Errorf("failed to start worker pool: %w", err)
	}

	// Run initial discovery immediately
	go func() {
		if err := j.discoverAndQueueVolumes(ctx); err != nil {
			log.Printf("[SIZE-CALC-JOB] Initial volume discovery failed: %v", err)
		}
	}()

	// Start periodic discovery
	go j.runPeriodicDiscovery(ctx)

	return nil
}

// Stop stops the size calculation job
func (j *SizeCalculationJob) Stop() error {
	if !j.running {
		return nil
	}

	log.Printf("[SIZE-CALC-JOB] Stopping size calculation job...")

	// Signal stop
	close(j.stopChan)

	// Stop worker pool
	if err := j.workerPool.Stop(); err != nil {
		log.Printf("[SIZE-CALC-JOB] Error stopping worker pool: %v", err)
	}

	j.running = false
	log.Printf("[SIZE-CALC-JOB] Size calculation job stopped")
	return nil
}

// runPeriodicDiscovery runs volume discovery on a schedule
func (j *SizeCalculationJob) runPeriodicDiscovery(ctx context.Context) {
	ticker := time.NewTicker(j.config.Interval)
	defer ticker.Stop()

	for {
		select {
		case <-j.stopChan:
			return
		case <-ctx.Done():
			return
		case <-ticker.C:
			if err := j.discoverAndQueueVolumes(ctx); err != nil {
				log.Printf("[SIZE-CALC-JOB] Volume discovery failed: %v", err)
			}
		}
	}
}

// discoverAndQueueVolumes discovers volumes needing size calculation and queues them
func (j *SizeCalculationJob) discoverAndQueueVolumes(ctx context.Context) error {
	log.Printf("[SIZE-CALC-JOB] Starting volume discovery for organization %d", j.organizationID)
	startTime := time.Now()

	err := j.workerPool.DiscoverAndQueueVolumes(ctx, j.organizationID)
	if err != nil {
		return fmt.Errorf("failed to discover and queue volumes: %w", err)
	}

	duration := time.Since(startTime)
	metrics := j.workerPool.GetMetrics()

	log.Printf("[SIZE-CALC-JOB] Volume discovery completed in %v (queued: %d, queue size: %d)",
		duration.Round(time.Millisecond), metrics["jobs_queued"], metrics["queue_size"])

	return nil
}

// GetStatus returns the current status of the job
func (j *SizeCalculationJob) GetStatus() map[string]interface{} {
	status := map[string]interface{}{
		"enabled":         j.config.Enabled,
		"running":         j.running,
		"interval":        j.config.Interval.String(),
		"organization_id": j.organizationID,
	}

	if j.running {
		status["worker_pool_status"] = j.workerPool.GetStatus()
		status["worker_pool_metrics"] = j.workerPool.GetMetrics()
	}

	return status
}
