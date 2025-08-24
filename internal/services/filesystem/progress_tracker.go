package filesystem

import (
	"context"
	"fmt"
	"time"

	"github.com/mantonx/volumeviz/internal/models"
	"github.com/mantonx/volumeviz/internal/store"
)

// ProgressTracker handles throttled progress updates to prevent database flooding
type ProgressTracker struct {
	store             store.Store
	throttler         *ProgressThrottler
	updateInterval    time.Duration
}

// NewProgressTracker creates a new progress tracker
func NewProgressTracker(store store.Store, updateInterval time.Duration) *ProgressTracker {
	return &ProgressTracker{
		store:          store,
		throttler:      NewProgressThrottler(store, updateInterval),
		updateInterval: updateInterval,
	}
}

// StartPeriodicFlush starts periodic flushing of pending updates
func (pt *ProgressTracker) StartPeriodicFlush(ctx context.Context) {
	pt.throttler.StartPeriodicFlush(ctx)
}

// QueueProgressUpdate queues a throttled progress update
func (pt *ProgressTracker) QueueProgressUpdate(scanID string, progress *IndexingProgress) {
	itemsProcessed := progress.FilesScanned + progress.FoldersScanned
	itemsTotal := progress.TotalFiles + progress.TotalFolders

	// Calculate progress percentage
	progressPercent := 0
	previousProgress := 0
	
	if itemsTotal > 0 {
		// Calculate previous progress for milestone detection
		previousProcessed := itemsProcessed - 1
		if previousProcessed > 0 {
			previousProgress = int((previousProcessed * 100) / itemsTotal)
		}
		
		progressPercent = int((itemsProcessed * 100) / itemsTotal)
		if progressPercent > 100 {
			progressPercent = 100
		}
	} else if itemsProcessed > 0 {
		// No total counts yet but processing files - show minimal progress
		if itemsProcessed >= 100 {
			progressPercent = int(1 + (itemsProcessed-100)/1000)
			if progressPercent > 10 {
				progressPercent = 10
			}
		}
	}

	// Queue throttled update
	update := models.UpdateScanPhaseParams{
		ScanID:         scanID,
		PhaseName:      "filesystem_indexing",
		Progress:       &progressPercent,
		ItemsProcessed: &itemsProcessed,
		ItemsTotal:     &itemsTotal,
		CurrentItem:    &progress.CurrentPath,
	}

	// Force update at important milestones (every 10% or at specific file counts)
	forceUpdate := false
	if progressPercent > 0 && previousProgress > 0 {
		// Force update at every 10% milestone
		if progressPercent/10 > previousProgress/10 {
			forceUpdate = true
			fmt.Printf("[ProgressTracker] Milestone reached: %d%% complete (Files: %d, Folders: %d)\n",
				progressPercent, progress.FilesScanned, progress.FoldersScanned)
		}
	}
	
	// Also force update at specific file count milestones for user feedback
	if progress.FilesScanned == 100 || progress.FilesScanned == 1000 || progress.FilesScanned == 10000 || 
	   progress.FilesScanned == 100000 || (progress.FilesScanned > 0 && progress.FilesScanned%500000 == 0) {
		forceUpdate = true
	}

	// Send the update (forced or throttled)
	var err error
	if forceUpdate {
		err = pt.throttler.ForceUpdate(context.Background(), scanID, update)
	} else {
		err = pt.throttler.QueueUpdate(context.Background(), scanID, update)
	}
	
	if err != nil {
		fmt.Printf("[ProgressTracker] Failed to queue progress update: %v\n", err)
	}
}

// UpdatePhaseStatus updates the database with scan phase status
func (pt *ProgressTracker) UpdatePhaseStatus(ctx context.Context, scanID, phaseName, status, errorMessage string) {
	scanProgressRepo := pt.store.ScanProgress()

	if status == "completed" {
		// Use CompleteScanPhase for proper completion handling
		err := scanProgressRepo.CompleteScanPhase(ctx, scanID, phaseName)
		if err != nil {
			fmt.Printf("Failed to complete %s phase for scan %s: %v\n", phaseName, scanID, err)
		} else {
			fmt.Printf("Completed %s phase for scan %s\n", phaseName, scanID)
		}
	} else if status == "failed" {
		err := scanProgressRepo.FailScanPhase(ctx, scanID, phaseName, errorMessage)
		if err != nil {
			fmt.Printf("Failed to mark %s phase as failed for scan %s: %v\n", phaseName, scanID, err)
		}
	} else if status == "running" {
		// Update phase progress to running
		updateParams := models.UpdateScanPhaseParams{
			ScanID:    scanID,
			PhaseName: phaseName,
			Status:    &status,
		}

		err := scanProgressRepo.UpdateScanPhaseProgress(ctx, updateParams)
		if err != nil {
			fmt.Printf("Failed to update %s phase status for scan %s: %v\n", phaseName, scanID, err)
		} else {
			fmt.Printf("Started %s phase for scan %s\n", phaseName, scanID)
		}
	}
}

// FlushPending flushes any pending throttled updates
func (pt *ProgressTracker) FlushPending(ctx context.Context, scanID string) {
	if pt.throttler != nil {
		pt.throttler.FlushPending(ctx, scanID)
	}
}

// GetStats returns throttling statistics
func (pt *ProgressTracker) GetStats(scanID string) (int, int) {
	if pt.throttler != nil {
		updates, throttled := pt.throttler.GetStats(scanID)
		return int(updates), int(throttled)
	}
	return 0, 0
}

// Cleanup cleans up tracking data for a scan
func (pt *ProgressTracker) Cleanup(scanID string) {
	if pt.throttler != nil {
		pt.throttler.Cleanup(scanID)
	}
}