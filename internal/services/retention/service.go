package retention

import (
	"context"
	"log"
	"time"

	"github.com/mantonx/volumeviz/internal/repo"
)

// Service handles automatic data retention and cleanup
type Service struct {
	retentionRepo repo.RetentionRepo
	ticker        *time.Ticker
	done          chan bool
}

// NewService creates a new retention service
func NewService(retentionRepo repo.RetentionRepo) *Service {
	return &Service{
		retentionRepo: retentionRepo,
		done:          make(chan bool),
	}
}

// Start begins the retention cleanup process
// Runs daily at the configured interval
func (s *Service) Start(interval time.Duration) {
	log.Printf("Starting retention service (interval: %v)", interval)

	s.ticker = time.NewTicker(interval)

	// Run immediately on startup
	go s.runCleanup()

	// Run periodically
	go func() {
		for {
			select {
			case <-s.ticker.C:
				s.runCleanup()
			case <-s.done:
				return
			}
		}
	}()
}

// Stop stops the retention service
func (s *Service) Stop() {
	log.Println("Stopping retention service")
	if s.ticker != nil {
		s.ticker.Stop()
	}
	s.done <- true
}

// runCleanup executes all retention policies
func (s *Service) runCleanup() {
	ctx := context.Background()
	log.Println("Running retention cleanup...")

	// Default retention periods
	const (
		scanJobRetention      = 30 * 24 * time.Hour  // 30 days
		scanMetricsRetention  = 90 * 24 * time.Hour  // 90 days
		dailyStatsRetention   = 7 * 24 * time.Hour   // 7 days (scan phases & errors)
		fileMetadataRetention = 180 * 24 * time.Hour // 180 days
		inactiveFilesRetention = 60 * 24 * time.Hour // 60 days
	)

	var totalDeleted int64
	var totalFreed int64

	// 1. Prune old scan jobs
	if result, err := s.retentionRepo.PruneScanJobs(ctx, scanJobRetention); err != nil {
		log.Printf("Error pruning scan jobs: %v", err)
	} else {
		log.Printf("Pruned %d old scan jobs (freed ~%d bytes)", result.RecordsDeleted, result.BytesFreed)
		totalDeleted += result.RecordsDeleted
		totalFreed += result.BytesFreed
	}

	// 2. Prune scan performance metrics
	if result, err := s.retentionRepo.PruneVolumeMetrics(ctx, scanMetricsRetention); err != nil {
		log.Printf("Error pruning scan metrics: %v", err)
	} else {
		log.Printf("Pruned %d old scan metrics (freed ~%d bytes)", result.RecordsDeleted, result.BytesFreed)
		totalDeleted += result.RecordsDeleted
		totalFreed += result.BytesFreed
	}

	// 3. Prune scan phases and errors
	if result, err := s.retentionRepo.PruneDailyStats(ctx, dailyStatsRetention); err != nil {
		log.Printf("Error pruning daily stats: %v", err)
	} else {
		log.Printf("Pruned %d old scan phases/errors (freed ~%d bytes)", result.RecordsDeleted, result.BytesFreed)
		totalDeleted += result.RecordsDeleted
		totalFreed += result.BytesFreed
	}

	// 4. Prune old file metadata
	if result, err := s.retentionRepo.PruneFileMetadata(ctx, fileMetadataRetention); err != nil {
		log.Printf("Error pruning file metadata: %v", err)
	} else {
		log.Printf("Pruned %d old file metadata records (freed ~%d bytes)", result.RecordsDeleted, result.BytesFreed)
		totalDeleted += result.RecordsDeleted
		totalFreed += result.BytesFreed
	}

	// 5. Prune inactive files
	if result, err := s.retentionRepo.PruneInactiveFiles(ctx, inactiveFilesRetention); err != nil {
		log.Printf("Error pruning inactive files: %v", err)
	} else {
		log.Printf("Pruned %d inactive files (freed ~%d bytes)", result.RecordsDeleted, result.BytesFreed)
		totalDeleted += result.RecordsDeleted
		totalFreed += result.BytesFreed
	}

	log.Printf("Retention cleanup complete: %d total records deleted, ~%d bytes freed", totalDeleted, totalFreed)
}

// GetStats returns current retention statistics
func (s *Service) GetStats(ctx context.Context) (map[string]int64, error) {
	return s.retentionRepo.GetRetentionStats(ctx)
}
