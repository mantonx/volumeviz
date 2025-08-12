package snapshots

import (
	"context"
	"fmt"
	"log"
	"time"

	"github.com/mantonx/volumeviz/internal/store"
)

// RetentionService handles cleanup and compaction of usage snapshots
type RetentionService struct {
	store store.Store
}

// NewRetentionService creates a new retention service
func NewRetentionService(store store.Store) *RetentionService {
	return &RetentionService{
		store: store,
	}
}

// CompactAndCleanup performs the complete retention process:
// 1. Compacts daily snapshots to weekly averages
// 2. Deletes old daily snapshots (>90 days)
// 3. Deletes old weekly snapshots (>1 year)
func (rs *RetentionService) CompactAndCleanup(ctx context.Context) error {
	log.Println("Starting usage snapshots retention process")

	// Step 1: Compact daily snapshots to weekly
	if err := rs.compactDailyToWeekly(ctx); err != nil {
		return fmt.Errorf("failed to compact daily snapshots: %w", err)
	}

	// Step 2: Clean up old daily snapshots
	if err := rs.cleanupOldDailySnapshots(ctx); err != nil {
		return fmt.Errorf("failed to cleanup old daily snapshots: %w", err)
	}

	// Step 3: Clean up old weekly snapshots
	if err := rs.cleanupOldWeeklySnapshots(ctx); err != nil {
		return fmt.Errorf("failed to cleanup old weekly snapshots: %w", err)
	}

	log.Println("Usage snapshots retention process completed successfully")
	return nil
}

// compactDailyToWeekly converts old daily snapshots into weekly averages
func (rs *RetentionService) compactDailyToWeekly(ctx context.Context) error {
	log.Println("Compacting daily snapshots to weekly averages")

	// TODO: Implement compaction logic when Store interface is updated
	log.Println("Daily to weekly compaction completed (stub)")
	return nil
}

// cleanupOldDailySnapshots removes daily snapshots older than 90 days
func (rs *RetentionService) cleanupOldDailySnapshots(ctx context.Context) error {
	log.Println("Cleaning up old daily snapshots (>90 days)")

	// TODO: Implement cleanup logic when Store interface is updated
	log.Println("Old daily snapshots cleanup completed (stub)")
	return nil
}

// cleanupOldWeeklySnapshots removes weekly snapshots older than 1 year
func (rs *RetentionService) cleanupOldWeeklySnapshots(ctx context.Context) error {
	log.Println("Cleaning up old weekly snapshots (>1 year)")

	// TODO: Implement cleanup logic when Store interface is updated
	log.Println("Old weekly snapshots cleanup completed (stub)")
	return nil
}

// GetRetentionStats returns statistics about the retention process
func (rs *RetentionService) GetRetentionStats(ctx context.Context) (*RetentionStats, error) {
	// This would query the database for retention statistics
	// For now, return basic stats
	return &RetentionStats{
		LastCompactionRun:    time.Now().Add(-24 * time.Hour), // Mock last run
		DailySnapshotsCount:  0,                               // Would query actual counts
		WeeklySnapshotsCount: 0,
	}, nil
}

// RetentionStats holds statistics about the retention process
type RetentionStats struct {
	LastCompactionRun    time.Time `json:"last_compaction_run"`
	DailySnapshotsCount  int       `json:"daily_snapshots_count"`
	WeeklySnapshotsCount int       `json:"weekly_snapshots_count"`
}
