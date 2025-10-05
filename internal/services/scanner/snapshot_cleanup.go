package scanner

import (
	"context"
	"log"
	"time"

	"github.com/mantonx/volumeviz/internal/store"
)

// SnapshotCleanup handles cleanup of old snapshots based on retention policy
type SnapshotCleanup struct {
	store                 store.Store
	retentionDays         int
	logger                *log.Logger
	cleanupInterval       time.Duration
	runOnStartup          bool
	stopChan              chan struct{}
	lastCleanupTime       time.Time
	totalSnapshotsDeleted int64
}

// NewSnapshotCleanup creates a new snapshot cleanup service
func NewSnapshotCleanup(
	store store.Store,
	retentionDays int,
	cleanupInterval time.Duration,
	runOnStartup bool,
	logger *log.Logger,
) *SnapshotCleanup {
	return &SnapshotCleanup{
		store:           store,
		retentionDays:   retentionDays,
		logger:          logger,
		cleanupInterval: cleanupInterval,
		runOnStartup:    runOnStartup,
		stopChan:        make(chan struct{}),
	}
}

// Start begins the periodic cleanup process
func (sc *SnapshotCleanup) Start(ctx context.Context) {
	if sc.logger != nil {
		sc.logger.Printf("Starting snapshot cleanup service (retention=%d days, interval=%s, run_on_startup=%v)",
			sc.retentionDays, sc.cleanupInterval, sc.runOnStartup)
	}

	// Run cleanup immediately on startup if configured
	if sc.runOnStartup {
		if err := sc.RunCleanup(ctx); err != nil && sc.logger != nil {
			sc.logger.Printf("Error during startup snapshot cleanup: %v", err)
		}
	}

	// Start periodic cleanup
	ticker := time.NewTicker(sc.cleanupInterval)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			if err := sc.RunCleanup(ctx); err != nil && sc.logger != nil {
				sc.logger.Printf("Error during scheduled snapshot cleanup: %v", err)
			}
		case <-sc.stopChan:
			if sc.logger != nil {
				sc.logger.Printf("Stopping snapshot cleanup service")
			}
			return
		case <-ctx.Done():
			if sc.logger != nil {
				sc.logger.Printf("Snapshot cleanup service stopped due to context cancellation")
			}
			return
		}
	}
}

// Stop stops the cleanup service
func (sc *SnapshotCleanup) Stop() {
	close(sc.stopChan)
}

// RunCleanup performs a single cleanup operation
func (sc *SnapshotCleanup) RunCleanup(ctx context.Context) error {
	startTime := time.Now()

	if sc.logger != nil {
		sc.logger.Printf("Starting snapshot cleanup (retention=%d days)", sc.retentionDays)
	}

	// Calculate cutoff time
	cutoffTime := time.Now().AddDate(0, 0, -sc.retentionDays)

	// Delete old snapshots
	deletedCount, err := sc.store.Snapshots().DeleteOldSnapshots(ctx, cutoffTime)
	if err != nil {
		if sc.logger != nil {
			sc.logger.Printf("Failed to delete old snapshots: %v", err)
		}
		return err
	}

	sc.totalSnapshotsDeleted += deletedCount
	sc.lastCleanupTime = time.Now()

	duration := time.Since(startTime)

	if sc.logger != nil {
		sc.logger.Printf("Snapshot cleanup completed (deleted=%d, duration=%s, total_deleted=%d)",
			deletedCount, duration, sc.totalSnapshotsDeleted)
	}

	return nil
}

// GetStats returns cleanup statistics
func (sc *SnapshotCleanup) GetStats() map[string]interface{} {
	return map[string]interface{}{
		"retention_days":          sc.retentionDays,
		"cleanup_interval":        sc.cleanupInterval.String(),
		"last_cleanup_time":       sc.lastCleanupTime,
		"total_snapshots_deleted": sc.totalSnapshotsDeleted,
	}
}

// CleanupOldSnapshots is a convenience function to manually trigger cleanup
func CleanupOldSnapshots(ctx context.Context, store store.Store, retentionDays int, logger *log.Logger) error {
	cleanup := NewSnapshotCleanup(store, retentionDays, 24*time.Hour, false, logger)
	return cleanup.RunCleanup(ctx)
}
