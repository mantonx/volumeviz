package scheduler

import (
	"context"
	"fmt"
	"log"
	"time"

	"github.com/mantonx/volumeviz/internal/interfaces"
	"github.com/mantonx/volumeviz/internal/services/volumes"
	"github.com/mantonx/volumeviz/internal/store"
)

// VolumeSyncJob handles background synchronization of Docker volumes to database
type VolumeSyncJob struct {
	reconciliationService *volumes.ReconciliationService
	config                VolumeSyncConfig
	running               bool
}

// VolumeSyncConfig holds configuration for volume sync job
type VolumeSyncConfig struct {
	Enabled        bool
	Interval       time.Duration
	OrganizationID int64
}

// NewVolumeSyncJob creates a new volume synchronization job
func NewVolumeSyncJob(
	dockerService interfaces.DockerService,
	store store.Store,
	config VolumeSyncConfig,
) (*VolumeSyncJob, error) {
	if !config.Enabled {
		return &VolumeSyncJob{
			config:  config,
			running: false,
		}, nil
	}

	reconciliationConfig := volumes.ReconciliationConfig{
		Enabled:        config.Enabled,
		Interval:       config.Interval,
		OrganizationID: config.OrganizationID,
		BatchSize:      0, // No limit
	}

	reconciliationService := volumes.NewReconciliationService(
		dockerService,
		store,
		reconciliationConfig,
	)

	return &VolumeSyncJob{
		reconciliationService: reconciliationService,
		config:                config,
		running:               false,
	}, nil
}

// Start begins the volume sync job
func (j *VolumeSyncJob) Start(ctx context.Context) error {
	if !j.config.Enabled {
		log.Printf("[INFO] Volume sync job disabled")
		return nil
	}

	if j.running {
		return fmt.Errorf("volume sync job already running")
	}

	log.Printf("[INFO] Starting volume sync job (interval: %v)", j.config.Interval)

	if err := j.reconciliationService.Start(ctx); err != nil {
		return fmt.Errorf("failed to start reconciliation service: %w", err)
	}

	j.running = true
	return nil
}

// Stop gracefully stops the volume sync job
func (j *VolumeSyncJob) Stop() error {
	if !j.running {
		return nil
	}

	log.Printf("[INFO] Stopping volume sync job...")

	if j.reconciliationService != nil {
		if err := j.reconciliationService.Stop(); err != nil {
			return fmt.Errorf("failed to stop reconciliation service: %w", err)
		}
	}

	j.running = false
	log.Printf("[INFO] Volume sync job stopped")
	return nil
}

// IsRunning returns whether the job is currently running
func (j *VolumeSyncJob) IsRunning() bool {
	return j.running
}

// GetMetrics returns metrics from the reconciliation service
func (j *VolumeSyncJob) GetMetrics() interface{} {
	if j.reconciliationService == nil {
		return nil
	}
	return j.reconciliationService.GetMetrics()
}

// TriggerSync manually triggers a synchronization cycle
func (j *VolumeSyncJob) TriggerSync(ctx context.Context) error {
	if !j.running {
		return fmt.Errorf("volume sync job not running")
	}

	if j.reconciliationService == nil {
		return fmt.Errorf("reconciliation service not initialized")
	}

	return j.reconciliationService.TriggerReconciliation(ctx)
}

// DefaultVolumeSyncConfig returns default configuration for volume sync job
func DefaultVolumeSyncConfig() VolumeSyncConfig {
	return VolumeSyncConfig{
		Enabled:        true,
		Interval:       60 * time.Second,
		OrganizationID: 1, // Default organization
	}
}
