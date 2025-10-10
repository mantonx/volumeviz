// Package volumes provides services for volume management and synchronization
package volumes

import (
	"context"
	"fmt"
	"log"
	"sync"
	"time"

	"github.com/jackc/pgx/v5/pgtype"
	"github.com/mantonx/volumeviz/internal/db/sqlc"
	"github.com/mantonx/volumeviz/internal/interfaces"
	"github.com/mantonx/volumeviz/internal/models"
	"github.com/mantonx/volumeviz/internal/store"
)

// ReconciliationService synchronizes Docker volumes to the database
// This service runs in the background and keeps the database in sync with Docker state
type ReconciliationService struct {
	dockerService interfaces.DockerService
	store         store.Store
	config        ReconciliationConfig

	// Service state
	running bool
	ctx     context.Context
	cancel  context.CancelFunc
	wg      sync.WaitGroup
	mu      sync.RWMutex

	// Metrics
	metrics *ReconciliationMetrics
}

// ReconciliationConfig holds configuration for the reconciliation service
type ReconciliationConfig struct {
	// Enabled controls whether reconciliation is active
	Enabled bool

	// Interval is how often to sync Docker volumes to database
	Interval time.Duration

	// OrganizationID is the organization to sync volumes for (0 for all)
	OrganizationID int64

	// BatchSize for processing volumes (0 = unlimited)
	BatchSize int
}

// ReconciliationMetrics tracks reconciliation statistics
type ReconciliationMetrics struct {
	mu                    sync.RWMutex
	LastRunAt             time.Time
	LastRunDuration       time.Duration
	TotalRuns             int64
	SuccessfulRuns        int64
	FailedRuns            int64
	TotalVolumesProcessed int64
	TotalVolumesCreated   int64
	TotalVolumesUpdated   int64
	TotalVolumesDeleted   int64
	LastError             error
}

// DefaultReconciliationConfig returns default configuration
func DefaultReconciliationConfig() ReconciliationConfig {
	return ReconciliationConfig{
		Enabled:        true,
		Interval:       60 * time.Second,
		OrganizationID: 1, // Default organization
		BatchSize:      0, // No limit
	}
}

// NewReconciliationService creates a new reconciliation service
func NewReconciliationService(
	dockerService interfaces.DockerService,
	store store.Store,
	config ReconciliationConfig,
) *ReconciliationService {
	return &ReconciliationService{
		dockerService: dockerService,
		store:         store,
		config:        config,
		metrics:       &ReconciliationMetrics{},
	}
}

// Start begins the reconciliation service
func (s *ReconciliationService) Start(ctx context.Context) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if !s.config.Enabled {
		log.Printf("[INFO] Volume reconciliation service disabled")
		return nil
	}

	if s.running {
		return fmt.Errorf("reconciliation service already running")
	}

	s.ctx, s.cancel = context.WithCancel(ctx)
	s.running = true

	log.Printf("[INFO] Starting volume reconciliation service (interval: %v, org: %d)",
		s.config.Interval, s.config.OrganizationID)

	// Run initial reconciliation immediately
	go func() {
		if err := s.runReconciliation(s.ctx); err != nil {
			log.Printf("[WARN] Initial volume reconciliation failed: %v", err)
		}
	}()

	// Start periodic reconciliation
	s.wg.Add(1)
	go s.reconciliationLoop()

	return nil
}

// Stop gracefully stops the reconciliation service
func (s *ReconciliationService) Stop() error {
	s.mu.Lock()
	if !s.running {
		s.mu.Unlock()
		return nil
	}
	s.running = false
	s.mu.Unlock()

	log.Printf("[INFO] Stopping volume reconciliation service...")

	if s.cancel != nil {
		s.cancel()
	}

	// Wait for reconciliation loop to finish (with timeout)
	done := make(chan struct{})
	go func() {
		s.wg.Wait()
		close(done)
	}()

	select {
	case <-done:
		log.Printf("[INFO] Volume reconciliation service stopped successfully")
	case <-time.After(10 * time.Second):
		log.Printf("[WARN] Volume reconciliation service stop timeout")
	}

	return nil
}

// reconciliationLoop runs the reconciliation process on a timer
func (s *ReconciliationService) reconciliationLoop() {
	defer s.wg.Done()

	ticker := time.NewTicker(s.config.Interval)
	defer ticker.Stop()

	for {
		select {
		case <-s.ctx.Done():
			log.Printf("[INFO] Reconciliation loop context cancelled")
			return

		case <-ticker.C:
			if err := s.runReconciliation(s.ctx); err != nil {
				log.Printf("[ERROR] Volume reconciliation failed: %v", err)
			}
		}
	}
}

// runReconciliation performs a single reconciliation cycle
func (s *ReconciliationService) runReconciliation(ctx context.Context) error {
	startTime := time.Now()
	log.Printf("[DEBUG] Starting volume reconciliation cycle")

	// Update metrics
	s.metrics.mu.Lock()
	s.metrics.TotalRuns++
	s.metrics.LastRunAt = startTime
	s.metrics.mu.Unlock()

	// Get all Docker volumes
	dockerVolumes, err := s.dockerService.ListVolumes(ctx)
	if err != nil {
		s.recordError(err)
		return fmt.Errorf("failed to list Docker volumes: %w", err)
	}

	log.Printf("[DEBUG] Found %d Docker volumes to reconcile", len(dockerVolumes))

	// Track statistics for this run
	var (
		volumesProcessed int64
		volumesCreated   int64
		volumesUpdated   int64
		volumesDeleted   int64
	)

	// Create a map of Docker volume IDs for quick lookup
	dockerVolumeMap := make(map[string]models.Volume)
	for _, vol := range dockerVolumes {
		dockerVolumeMap[vol.VolumeID] = vol
	}

	// Reconcile each Docker volume to database
	for _, dockerVolume := range dockerVolumes {
		select {
		case <-ctx.Done():
			return ctx.Err()
		default:
		}

		created, updated, err := s.reconcileVolume(ctx, dockerVolume)
		if err != nil {
			log.Printf("[WARN] Failed to reconcile volume %s: %v", dockerVolume.VolumeID, err)
			continue
		}

		volumesProcessed++
		if created {
			volumesCreated++
		} else if updated {
			volumesUpdated++
		}
	}

	// Mark volumes as inactive if they no longer exist in Docker
	deleted, err := s.markInactiveVolumes(ctx, dockerVolumeMap)
	if err != nil {
		log.Printf("[WARN] Failed to mark inactive volumes: %v", err)
	} else {
		volumesDeleted = deleted
	}

	// Update metrics
	duration := time.Since(startTime)
	s.metrics.mu.Lock()
	s.metrics.LastRunDuration = duration
	s.metrics.SuccessfulRuns++
	s.metrics.TotalVolumesProcessed += volumesProcessed
	s.metrics.TotalVolumesCreated += volumesCreated
	s.metrics.TotalVolumesUpdated += volumesUpdated
	s.metrics.TotalVolumesDeleted += volumesDeleted
	s.metrics.LastError = nil
	s.metrics.mu.Unlock()

	log.Printf("[INFO] Volume reconciliation completed: processed=%d created=%d updated=%d deleted=%d duration=%v",
		volumesProcessed, volumesCreated, volumesUpdated, volumesDeleted, duration)

	return nil
}

// reconcileVolume syncs a single Docker volume to the database
// Returns (created, updated, error)
func (s *ReconciliationService) reconcileVolume(ctx context.Context, dockerVolume models.Volume) (bool, bool, error) {
	queries, ok := s.store.Queries().(*sqlc.Queries)
	if !ok {
		return false, false, fmt.Errorf("invalid queries type")
	}

	// Get container information for this volume
	containers, err := s.dockerService.GetVolumeContainers(ctx, dockerVolume.VolumeID)
	if err != nil {
		// Don't fail reconciliation if we can't get containers
		log.Printf("[DEBUG] Could not get containers for volume %s: %v", dockerVolume.VolumeID, err)
		containers = []models.VolumeContainer{}
	}

	// Extract container names
	containerNames := make([]string, len(containers))
	for i, container := range containers {
		containerNames[i] = container.Name
	}

	// Check if volume already exists in database
	existingVolume, err := queries.GetVolumeByVolumeID(ctx, sqlc.GetVolumeByVolumeIDParams{
		VolumeID:       dockerVolume.VolumeID,
		OrganizationID: pgtype.Int8{Int64: s.config.OrganizationID, Valid: true},
	})

	isCreate := false
	isUpdate := false

	if err != nil {
		// Volume doesn't exist, create it
		isCreate = true

		// Determine display name (use label if available, otherwise volume name)
		displayName := dockerVolume.Name
		if label, ok := dockerVolume.Labels["com.docker.compose.project"]; ok {
			displayName = label + "/" + dockerVolume.Name
		}

		// Get size from Docker if available
		var totalSizeBytes pgtype.Int8
		if dockerVolume.UsageData != nil && dockerVolume.UsageData.Size > 0 {
			totalSizeBytes = pgtype.Int8{Int64: dockerVolume.UsageData.Size, Valid: true}
		}

		_, err = queries.CreateVolume(ctx, sqlc.CreateVolumeParams{
			VolumeID:       dockerVolume.VolumeID,
			DisplayName:    pgtype.Text{String: displayName, Valid: true},
			MountPoint:     dockerVolume.Mountpoint,
			ContainerNames: containerNames,
			IsActive:       pgtype.Bool{Bool: true, Valid: true},
			TotalSizeBytes: totalSizeBytes,
			FilesystemType: pgtype.Text{String: dockerVolume.Driver, Valid: true},
			ContainerCount: pgtype.Int4{Int32: int32(len(containers)), Valid: true},
			FirstSeenAt:    pgtype.Timestamptz{Time: dockerVolume.CreatedAt, Valid: true},
			OrganizationID: pgtype.Int8{Int64: s.config.OrganizationID, Valid: true},
		})

		if err != nil {
			return false, false, fmt.Errorf("failed to create volume: %w", err)
		}

		log.Printf("[DEBUG] Created volume in database: %s", dockerVolume.VolumeID)
	} else {
		// Volume exists, update it if needed
		if s.needsUpdate(existingVolume, dockerVolume, containerNames) {
			isUpdate = true

			// Get size from Docker if available (preserve existing if not)
			var totalSizeBytes pgtype.Int8
			if dockerVolume.UsageData != nil && dockerVolume.UsageData.Size > 0 {
				totalSizeBytes = pgtype.Int8{Int64: dockerVolume.UsageData.Size, Valid: true}
			} else {
				totalSizeBytes = existingVolume.TotalSizeBytes
			}

			_, err = queries.UpdateVolume(ctx, sqlc.UpdateVolumeParams{
				VolumeID:       dockerVolume.VolumeID,
				DisplayName:    existingVolume.DisplayName,
				MountPoint:     dockerVolume.Mountpoint,
				ContainerNames: containerNames,
				IsActive:       pgtype.Bool{Bool: true, Valid: true},
				TotalSizeBytes: totalSizeBytes,
				FilesystemType: pgtype.Text{String: dockerVolume.Driver, Valid: true},
				ContainerCount: pgtype.Int4{Int32: int32(len(containers)), Valid: true},
				OrganizationID: pgtype.Int8{Int64: s.config.OrganizationID, Valid: true},
			})

			if err != nil {
				return false, false, fmt.Errorf("failed to update volume: %w", err)
			}

			log.Printf("[DEBUG] Updated volume in database: %s", dockerVolume.VolumeID)
		}
	}

	return isCreate, isUpdate, nil
}

// needsUpdate checks if the database volume needs to be updated
func (s *ReconciliationService) needsUpdate(dbVolume sqlc.Volumes, dockerVolume models.Volume, containerNames []string) bool {
	// Check if mount point changed
	if dbVolume.MountPoint != dockerVolume.Mountpoint {
		return true
	}

	// Check if container count changed
	if dbVolume.ContainerCount.Int32 != int32(len(containerNames)) {
		return true
	}

	// Check if is_active changed
	if !dbVolume.IsActive.Bool {
		return true
	}

	// Check if filesystem type changed
	if dbVolume.FilesystemType.String != dockerVolume.Driver {
		return true
	}

	return false
}

// markInactiveVolumes marks volumes in database as inactive if they no longer exist in Docker
func (s *ReconciliationService) markInactiveVolumes(ctx context.Context, dockerVolumeMap map[string]models.Volume) (int64, error) {
	queries, ok := s.store.Queries().(*sqlc.Queries)
	if !ok {
		return 0, fmt.Errorf("invalid queries type")
	}

	// Get all active volumes from database
	dbVolumes, err := queries.ListActiveVolumes(ctx, pgtype.Int8{Int64: s.config.OrganizationID, Valid: true})
	if err != nil {
		return 0, fmt.Errorf("failed to list active volumes: %w", err)
	}

	var deletedCount int64

	// Check each database volume against Docker
	for _, dbVolume := range dbVolumes {
		if _, exists := dockerVolumeMap[dbVolume.VolumeID]; !exists {
			// Volume exists in DB but not in Docker - mark as inactive
			err = queries.SoftDeleteVolume(ctx, sqlc.SoftDeleteVolumeParams{
				VolumeID:       dbVolume.VolumeID,
				OrganizationID: pgtype.Int8{Int64: s.config.OrganizationID, Valid: true},
			})

			if err != nil {
				log.Printf("[WARN] Failed to mark volume %s as inactive: %v", dbVolume.VolumeID, err)
				continue
			}

			log.Printf("[DEBUG] Marked volume as inactive: %s", dbVolume.VolumeID)
			deletedCount++
		}
	}

	return deletedCount, nil
}

// recordError records an error in metrics
func (s *ReconciliationService) recordError(err error) {
	s.metrics.mu.Lock()
	defer s.metrics.mu.Unlock()

	s.metrics.FailedRuns++
	s.metrics.LastError = err
}

// GetMetrics returns current reconciliation metrics
func (s *ReconciliationService) GetMetrics() ReconciliationMetrics {
	s.metrics.mu.RLock()
	defer s.metrics.mu.RUnlock()

	return ReconciliationMetrics{
		LastRunAt:             s.metrics.LastRunAt,
		LastRunDuration:       s.metrics.LastRunDuration,
		TotalRuns:             s.metrics.TotalRuns,
		SuccessfulRuns:        s.metrics.SuccessfulRuns,
		FailedRuns:            s.metrics.FailedRuns,
		TotalVolumesProcessed: s.metrics.TotalVolumesProcessed,
		TotalVolumesCreated:   s.metrics.TotalVolumesCreated,
		TotalVolumesUpdated:   s.metrics.TotalVolumesUpdated,
		TotalVolumesDeleted:   s.metrics.TotalVolumesDeleted,
		LastError:             s.metrics.LastError,
	}
}

// IsRunning returns whether the service is currently running
func (s *ReconciliationService) IsRunning() bool {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.running
}

// TriggerReconciliation manually triggers a reconciliation cycle
func (s *ReconciliationService) TriggerReconciliation(ctx context.Context) error {
	s.mu.RLock()
	if !s.running {
		s.mu.RUnlock()
		return fmt.Errorf("reconciliation service not running")
	}
	s.mu.RUnlock()

	log.Printf("[INFO] Manual reconciliation triggered")
	return s.runReconciliation(ctx)
}
