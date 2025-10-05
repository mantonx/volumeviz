package scanner

import (
	"context"
	"log"
	"time"

	"github.com/mantonx/volumeviz/internal/store"
)

// SnapshotCleanupJob implements the Job interface for scheduled snapshot cleanup
type SnapshotCleanupJob struct {
	store         store.Store
	retentionDays int
}

// NewSnapshotCleanupJob creates a new snapshot cleanup job
func NewSnapshotCleanupJob(store store.Store, retentionDays int) *SnapshotCleanupJob {
	return &SnapshotCleanupJob{
		store:         store,
		retentionDays: retentionDays,
	}
}

// Name returns the job name
func (j *SnapshotCleanupJob) Name() string {
	return "snapshot-cleanup"
}

// Description returns the job description
func (j *SnapshotCleanupJob) Description() string {
	return "Cleanup old volume snapshots to free database space"
}

// Run executes the snapshot cleanup job
func (j *SnapshotCleanupJob) Run(ctx context.Context) error {
	log.Printf("[SnapshotCleanup] Running cleanup (retention=%d days)...", j.retentionDays)

	// Calculate cutoff time
	cutoffTime := time.Now().AddDate(0, 0, -j.retentionDays)

	// Delete old snapshots
	deletedCount, err := j.store.Snapshots().DeleteOldSnapshots(ctx, cutoffTime)
	if err != nil {
		log.Printf("[SnapshotCleanup] Error deleting old snapshots: %v", err)
		return err
	}

	log.Printf("[SnapshotCleanup] Cleanup complete: deleted %d snapshots older than %s",
		deletedCount, cutoffTime.Format(time.RFC3339))

	return nil
}
