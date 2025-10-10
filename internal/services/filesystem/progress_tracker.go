package filesystem

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/mantonx/volumeviz/internal/models"
	"github.com/mantonx/volumeviz/internal/realtime"
	"github.com/mantonx/volumeviz/internal/store"
	"github.com/mantonx/volumeviz/internal/utils"
)

// ProgressTracker handles throttled progress updates to prevent database flooding
type ProgressTracker struct {
	store               store.Store
	throttler           *ProgressThrottler
	updateInterval      time.Duration
	progressBroadcaster realtime.BroadcasterInterface
	lastBroadcast       time.Time // Throttle WebSocket broadcasts to prevent spam
	broadcastMutex      sync.Mutex // Protects lastBroadcast from concurrent access
}

// NewProgressTracker creates a new progress tracker
func NewProgressTracker(store store.Store, updateInterval time.Duration) *ProgressTracker {
	return &ProgressTracker{
		store:          store,
		throttler:      NewProgressThrottler(store, updateInterval),
		updateInterval: updateInterval,
	}
}

// SetProgressBroadcaster sets the progress broadcaster for real-time updates
func (pt *ProgressTracker) SetProgressBroadcaster(broadcaster realtime.BroadcasterInterface) {
	pt.progressBroadcaster = broadcaster
}

// StartPeriodicFlush starts periodic flushing of pending updates
func (pt *ProgressTracker) StartPeriodicFlush(ctx context.Context) {
	pt.throttler.StartPeriodicFlush(ctx)
}

// QueueProgressUpdate queues a throttled progress update
func (pt *ProgressTracker) QueueProgressUpdate(scanID string, progress *IndexingProgress) {
	itemsProcessed := progress.FilesScanned + progress.FoldersScanned
	itemsTotal := progress.TotalFiles + progress.TotalFolders

	// Calculate progress percentage using safe utility
	var progressPercent, previousProgress int

	if itemsTotal > 0 {
		// Calculate previous progress for milestone detection
		previousProcessed := itemsProcessed - 1
		if previousProcessed > 0 {
			previousProgress = utils.SafePercentage(previousProcessed, itemsTotal)
		}

		progressPercent = utils.SafePercentage(itemsProcessed, itemsTotal)
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

		// Trigger real-time WebSocket broadcast for force updates (milestones)
		// FIX: Throttle broadcasts to max 1 per second with mutex protection to prevent race condition spam
		pt.broadcastMutex.Lock()
		now := time.Now()
		shouldBroadcast := now.Sub(pt.lastBroadcast) > 1*time.Second
		if shouldBroadcast {
			pt.lastBroadcast = now // Update BEFORE broadcast to prevent race
		}
		pt.broadcastMutex.Unlock()

		if err == nil && pt.progressBroadcaster != nil && shouldBroadcast {
			if scansRepo := pt.store.Scans(); scansRepo != nil {
				if scanJob, err := scansRepo.GetScanJobByScanID(context.Background(), scanID); err == nil && scanJob != nil {
					go pt.progressBroadcaster.BroadcastComprehensiveScanProgress(context.Background(), scanID, scanJob.VolumeID)
				}
			}
		}
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
		// Calculate actual progress from items before completing
		// This ensures progress_percent accurately reflects items processed, not just status
		phases, err := scanProgressRepo.GetScanPhasesByID(ctx, scanID)
		if err == nil {
			for _, phase := range phases {
				if phase.PhaseName == phaseName {
					// Calculate progress from actual items if available
					var calculatedProgress int
					if phase.ItemsTotal > 0 {
						calculatedProgress = int((phase.ItemsProcessed * 100) / phase.ItemsTotal)
						if calculatedProgress > 100 {
							calculatedProgress = 100
						}
					} else {
						// No items tracked - assume 100% since phase is completing
						calculatedProgress = 100
					}

					// Update progress to match actual item-based calculation
					err := scanProgressRepo.UpdateScanPhaseProgress(ctx, models.UpdateScanPhaseParams{
						ScanID:    scanID,
						PhaseName: phaseName,
						Progress:  &calculatedProgress,
					})
					if err != nil {
						fmt.Printf("Failed to update progress for %s phase: %v\n", phaseName, err)
					} else {
						fmt.Printf("Updated %s phase progress to %d%% (based on %d/%d items)\n",
							phaseName, calculatedProgress, phase.ItemsProcessed, phase.ItemsTotal)
					}
					break
				}
			}
		}

		// Use CompleteScanPhase for proper completion handling
		err = scanProgressRepo.CompleteScanPhase(ctx, scanID, phaseName)
		if err != nil {
			fmt.Printf("Failed to complete %s phase for scan %s: %v\n", phaseName, scanID, err)
		} else {
			fmt.Printf("Completed %s phase for scan %s (progress: 100%%)\n", phaseName, scanID)

			// IMPORTANT: Mark scan as completed when filesystem_indexing finishes
			// This decouples scan completion from enrichment - enrichment continues in background
			if phaseName == "filesystem_indexing" {
				if scansRepo := pt.store.Scans(); scansRepo != nil {
					if err := scansRepo.CompletesScanJob(ctx, scanID); err != nil {
						fmt.Printf("Failed to mark scan %s as completed after filesystem indexing: %v\n", scanID, err)
					} else {
						fmt.Printf("✅ Scan %s marked as COMPLETED after filesystem indexing (enrichment will continue in background)\n", scanID)
					}
				}
			}

			// Trigger WebSocket broadcast when phase completes (with mutex protection)
			pt.broadcastMutex.Lock()
			now := time.Now()
			shouldBroadcast := now.Sub(pt.lastBroadcast) > 1*time.Second
			if shouldBroadcast {
				pt.lastBroadcast = now
			}
			pt.broadcastMutex.Unlock()

			if pt.progressBroadcaster != nil && shouldBroadcast {
				// Get volume ID from scan job
				if scansRepo := pt.store.Scans(); scansRepo != nil {
					if scanJob, err := scansRepo.GetScanJobByScanID(ctx, scanID); err == nil && scanJob != nil {
						go pt.progressBroadcaster.BroadcastComprehensiveScanProgress(context.Background(), scanID, scanJob.VolumeID)
					}
				}
			}
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

	// Additional WebSocket broadcast for real-time updates
	// FIX: Throttle to prevent spam with mutex protection (phase status changes are infrequent anyway)
	pt.broadcastMutex.Lock()
	now := time.Now()
	shouldBroadcast := now.Sub(pt.lastBroadcast) > 1*time.Second
	if shouldBroadcast {
		pt.lastBroadcast = now // Update BEFORE broadcast to prevent race
	}
	pt.broadcastMutex.Unlock()

	if pt.progressBroadcaster != nil && (status == "failed" || status == "running") && shouldBroadcast {
		// Get volume ID from scan job for broadcasts
		if scansRepo := pt.store.Scans(); scansRepo != nil {
			if scanJob, err := scansRepo.GetScanJobByScanID(ctx, scanID); err == nil && scanJob != nil {
				go pt.progressBroadcaster.BroadcastComprehensiveScanProgress(context.Background(), scanID, scanJob.VolumeID)
			}
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

// UpdateSubPhaseProgress updates sub-phase progress with operation details
func (pt *ProgressTracker) UpdateSubPhaseProgress(ctx context.Context, scanID, phaseName, subPhase string, progress int, operation string) {
	// Update the database with sub-phase information
	updateParams := models.UpdateScanPhaseParams{
		ScanID:    scanID,
		PhaseName: phaseName,
		Progress:  &progress,
	}

	// Use the new dedicated sub-phase fields
	updateParams.SubPhase = &subPhase
	updateParams.SubPhaseProgress = &progress
	updateParams.CurrentOperation = &operation
	
	// Also update current_item for backward compatibility
	currentItem := fmt.Sprintf("[%s] %s", subPhase, operation)
	updateParams.CurrentItem = &currentItem

	var err error
	// Force update for sub-phase changes to ensure real-time feedback
	if pt.throttler != nil {
		err = pt.throttler.ForceUpdate(ctx, scanID, updateParams)
	} else {
		scanProgressRepo := pt.store.ScanProgress()
		err = scanProgressRepo.UpdateScanPhaseProgress(ctx, updateParams)
	}

	if err != nil {
		fmt.Printf("[ProgressTracker] Failed to update sub-phase progress: %v\n", err)
		return
	}

	// Trigger real-time WebSocket broadcast
	if pt.progressBroadcaster != nil {
		if scansRepo := pt.store.Scans(); scansRepo != nil {
			if scanJob, err := scansRepo.GetScanJobByScanID(ctx, scanID); err == nil && scanJob != nil {
				go pt.progressBroadcaster.BroadcastComprehensiveScanProgress(context.Background(), scanID, scanJob.VolumeID)
			}
		}
	}
}

// Cleanup cleans up tracking data for a scan
func (pt *ProgressTracker) Cleanup(scanID string) {
	if pt.throttler != nil {
		pt.throttler.Cleanup(scanID)
	}
}
