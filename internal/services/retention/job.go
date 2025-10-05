package retention

import (
	"context"
	"log"
	"time"

	"github.com/mantonx/volumeviz/internal/config"
	"github.com/mantonx/volumeviz/internal/repo"
)

// Job handles data retention and cleanup
type Job struct {
	retentionRepo repo.RetentionRepo
	config        *config.RetentionConfig
}

// NewJob creates a new retention job
func NewJob(retentionRepo repo.RetentionRepo, cfg *config.RetentionConfig) *Job {
	return &Job{
		retentionRepo: retentionRepo,
		config:        cfg,
	}
}

// Name returns the job name
func (j *Job) Name() string {
	return "retention-cleanup"
}

// Description returns the job description
func (j *Job) Description() string {
	return "Automatic data retention cleanup to prevent database bloat"
}

// Run executes the retention cleanup job
func (j *Job) Run(ctx context.Context) error {
	log.Println("[Retention] Running cleanup...")

	// Convert day counts to durations
	retentionPeriods := struct {
		scanJobs      time.Duration
		scanMetrics   time.Duration
		dailyStats    time.Duration
		fileMetadata  time.Duration
		inactiveFiles time.Duration
	}{
		scanJobs:      time.Duration(j.config.ScanJobsRetentionDays) * 24 * time.Hour,
		scanMetrics:   time.Duration(j.config.ScanMetricsRetentionDays) * 24 * time.Hour,
		dailyStats:    time.Duration(j.config.ScanPhasesRetentionDays) * 24 * time.Hour,
		fileMetadata:  time.Duration(j.config.FileMetadataRetentionDays) * 24 * time.Hour,
		inactiveFiles: time.Duration(j.config.InactiveFilesRetentionDays) * 24 * time.Hour,
	}

	var totalDeleted int64
	var totalFreed int64

	// 1. Prune old scan jobs
	if result, err := j.retentionRepo.PruneScanJobs(ctx, retentionPeriods.scanJobs); err != nil {
		log.Printf("[Retention] Error pruning scan jobs: %v", err)
	} else {
		log.Printf("[Retention] Pruned %d old scan jobs (freed ~%d bytes)", result.RecordsDeleted, result.BytesFreed)
		totalDeleted += result.RecordsDeleted
		totalFreed += result.BytesFreed
	}

	// 2. Prune scan performance metrics
	if result, err := j.retentionRepo.PruneVolumeMetrics(ctx, retentionPeriods.scanMetrics); err != nil {
		log.Printf("[Retention] Error pruning scan metrics: %v", err)
	} else {
		log.Printf("[Retention] Pruned %d old scan metrics (freed ~%d bytes)", result.RecordsDeleted, result.BytesFreed)
		totalDeleted += result.RecordsDeleted
		totalFreed += result.BytesFreed
	}

	// 3. Prune scan phases and errors
	if result, err := j.retentionRepo.PruneDailyStats(ctx, retentionPeriods.dailyStats); err != nil {
		log.Printf("[Retention] Error pruning daily stats: %v", err)
	} else {
		log.Printf("[Retention] Pruned %d old scan phases/errors (freed ~%d bytes)", result.RecordsDeleted, result.BytesFreed)
		totalDeleted += result.RecordsDeleted
		totalFreed += result.BytesFreed
	}

	// 4. Prune old file metadata
	if result, err := j.retentionRepo.PruneFileMetadata(ctx, retentionPeriods.fileMetadata); err != nil {
		log.Printf("[Retention] Error pruning file metadata: %v", err)
	} else {
		log.Printf("[Retention] Pruned %d old file metadata records (freed ~%d bytes)", result.RecordsDeleted, result.BytesFreed)
		totalDeleted += result.RecordsDeleted
		totalFreed += result.BytesFreed
	}

	// 5. Prune inactive files
	if result, err := j.retentionRepo.PruneInactiveFiles(ctx, retentionPeriods.inactiveFiles); err != nil {
		log.Printf("[Retention] Error pruning inactive files: %v", err)
	} else {
		log.Printf("[Retention] Pruned %d inactive files (freed ~%d bytes)", result.RecordsDeleted, result.BytesFreed)
		totalDeleted += result.RecordsDeleted
		totalFreed += result.BytesFreed
	}

	log.Printf("[Retention] Cleanup complete: %d total records deleted, ~%d bytes freed", totalDeleted, totalFreed)
	return nil
}

// GetStats returns current retention statistics
func (j *Job) GetStats(ctx context.Context) (map[string]int64, error) {
	return j.retentionRepo.GetRetentionStats(ctx)
}
