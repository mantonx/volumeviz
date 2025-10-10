package scanner

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/mantonx/volumeviz/internal/interfaces"
	coreModels "github.com/mantonx/volumeviz/internal/models"
	"github.com/mantonx/volumeviz/internal/services/filesystem"
)

// contextKey is used for type-safe context values
type contextKey string

const (
	scanIDKey contextKey = "scan_id"
)

// ScanVolumeAsync starts an async scan and returns a scan ID
func (vs *VolumeScanner) ScanVolumeAsync(ctx context.Context, volumeID string) (string, error) {
	scanID := fmt.Sprintf("scan_%s_%d", volumeID, time.Now().Unix())

	// Initialize scan progress using the new ProgressManager
	if vs.progressManager != nil {
		vs.progressManager.StartScan(scanID, volumeID)
	} else {
		// Fallback to old progress tracking if ProgressManager not available
		progress := &interfaces.ScanProgress{
			ScanID:             scanID,
			VolumeID:           volumeID,
			Status:             coreModels.ScanStatusPending,
			Progress:           0.0,
			FilesScanned:       0,
			CurrentPath:        "",
			EstimatedRemaining: 0,
			Method:             "",
			StartedAt:          time.Now(),
			Error:              "",
		}

		vs.scanMutex.Lock()
		vs.activeScans[scanID] = progress
		vs.volumeToScan[volumeID] = scanID
		vs.scanMutex.Unlock()
	}

	// Initialize database progress tracking if store is available
	if vs.store != nil {
		go func() {
			ctx := context.Background()
			scansRepo := vs.store.Scans()
			if scansRepo != nil {
				scanJob := coreModels.CreateScanJobParams{
					ScanID:   scanID,
					VolumeID: volumeID,
					Status:   "pending", // Set to pending so workers can claim it
					Method:   "async",
				}
				_, err := scansRepo.CreateScanJob(ctx, scanJob)
				if err != nil && vs.logger != nil {
					vs.logger.Printf("Failed to create scan job record for scan %s: %v", scanID, err)
					return
				} else if vs.logger != nil {
					vs.logger.Printf("Created scan job record for scan %s", scanID)
				}

				vs.initializeDatabaseProgress(ctx, scanID, volumeID)
			}
		}()
	}

	// Start the scan in background with panic recovery
	go func() {
		// Add panic recovery
		defer func() {
			if r := recover(); r != nil {
				panicErr := NewPanicError(r)
				if vs.logger != nil {
					vs.logger.Printf("PANIC in scan goroutine: scan_id=%s volume=%s error=%v",
						scanID, volumeID, panicErr)
				}

				// Mark scan as failed
				if vs.progressManager != nil {
					vs.progressManager.FinishPhase(scanID, "volume_scan", false,
						fmt.Sprintf("panic: %v", r))
				}

				// Update database
				if vs.store != nil {
					scansRepo := vs.store.Scans()
					if scansRepo != nil {
						_ = scansRepo.FailScanJob(context.Background(), scanID,
							fmt.Sprintf("panic: %v", r))
					}
				}
			}
		}()

		// Update status to running
		if vs.progressManager != nil {
			vs.progressManager.UpdateProgress(scanID, ProgressUpdate{
				Type:     "volume_scan",
				Progress: 0.0,
			})
		} else {
			vs.scanMutex.Lock()
			if progress, exists := vs.activeScans[scanID]; exists {
				progress.Status = coreModels.ScanStatusRunning
			}
			vs.scanMutex.Unlock()
		}

		// Estimate timeout based on volume size
		timeout := vs.estimateTimeout(volumeID)

		if vs.logger != nil {
			vs.logger.Printf("Starting async scan: scan_id=%s volume=%s timeout=%v",
				scanID, volumeID, timeout)
		}

		// Start checkpointing if available
		if vs.checkpointManager != nil {
			vs.checkpointManager.StartCheckpointing(context.Background(), scanID, volumeID)
			defer vs.checkpointManager.StopCheckpointing(scanID)
		}

		// Create context with timeout
		scanCtx, cancel := withTimeout(context.Background(), timeout)
		defer cancel()

		// Add scan ID to context for progressive methods
		scanCtx = context.WithValue(scanCtx, scanIDKey, scanID)

		result, err := vs.ScanVolume(scanCtx, volumeID)

		// Check for timeout specifically
		if errors.Is(err, context.DeadlineExceeded) {
			if vs.logger != nil {
				vs.logger.Printf("Scan timeout: scan_id=%s volume=%s timeout=%v",
					scanID, volumeID, timeout)
			}

			if vs.progressManager != nil {
				vs.progressManager.FinishPhase(scanID, "volume_scan", false,
					fmt.Sprintf("timeout after %v", timeout))
			}

			if vs.store != nil {
				scansRepo := vs.store.Scans()
				if scansRepo != nil {
					_ = scansRepo.FailScanJob(context.Background(), scanID,
						fmt.Sprintf("timeout after %v", timeout))
				}
			}
			return
		}

		if err != nil {
			if vs.progressManager != nil {
				vs.progressManager.FinishPhase(scanID, "volume_scan", false, err.Error())
			} else {
				vs.scanMutex.Lock()
				if progress, exists := vs.activeScans[scanID]; exists {
					progress.Status = coreModels.ScanStatusFailed
					progress.Error = err.Error()
				}
				vs.scanMutex.Unlock()
			}

			if vs.logger != nil {
				vs.logger.Printf("Async scan failed for volume %s: %v", volumeID, err)
			}

			// Update database - mark volume scan phase as failed
			if vs.store != nil {
				go vs.updateVolumePhaseStatus(context.Background(), scanID, "failed", err.Error())

				// Also update scan job status
				go func() {
					ctx := context.Background()
					scansRepo := vs.store.Scans()
					if scansRepo != nil {
						if updateErr := scansRepo.FailScanJob(ctx, scanID, err.Error()); updateErr != nil && vs.logger != nil {
							vs.logger.Printf("Failed to update scan job status for scan %s: %v", scanID, updateErr)
						}
					}
				}()
			}
		} else {
			if vs.progressManager != nil {
				vs.progressManager.FinishPhase(scanID, "volume_scan", true, "")
			} else {
				vs.scanMutex.Lock()
				if progress, exists := vs.activeScans[scanID]; exists {
					progress.Status = coreModels.ScanStatusCompleted
					progress.Progress = 1.0
					progress.Method = result.Method
				}
				vs.scanMutex.Unlock()
			}

			// Update database - mark volume scan phase as completed
			if vs.store != nil {
				go vs.updateVolumePhaseStatus(context.Background(), scanID, "completed", "")
			}

			// Trigger daily stats computation if stats service is available (async)
			if vs.statsService != nil {
				go func() {
					if err := vs.statsService.OnScanCompleted(context.Background(), volumeID, &scanID); err != nil && vs.logger != nil {
						vs.logger.Printf("Failed to compute daily stats for async scan %s (volume %s): %v", scanID, volumeID, err)
					}
				}()
			}
		}

		// Clean up after some time (keep completed scans for a while)
		go func() {
			time.Sleep(5 * time.Minute)
			if vs.progressManager != nil {
				vs.progressManager.CleanupScan(scanID)
			} else {
				vs.scanMutex.Lock()
				delete(vs.activeScans, scanID)
				delete(vs.volumeToScan, volumeID)
				vs.scanMutex.Unlock()
			}
		}()
	}()

	return scanID, nil
}

// GetScanProgress returns the progress of an async scan
func (vs *VolumeScanner) GetScanProgress(scanID string) (*interfaces.ScanProgress, error) {
	// Use ProgressManager if available
	if vs.progressManager != nil {
		return vs.progressManager.GetProgress(scanID)
	}

	// Fallback to old progress tracking
	vs.scanMutex.RLock()
	baseProgress, exists := vs.activeScans[scanID]
	if !exists {
		vs.scanMutex.RUnlock()
		return nil, fmt.Errorf("scan not found: %s", scanID)
	}

	// Create enhanced progress with base data
	progress := *baseProgress
	vs.scanMutex.RUnlock()

	// Enhance with timing information
	now := time.Now()
	progress.LastUpdate = now
	progress.ElapsedSeconds = int64(now.Sub(progress.StartedAt).Seconds())

	// Initialize phase tracking if not present
	if progress.Phases == nil {
		progress.Phases = make(map[string]*interfaces.PhaseInfo)

		// Set up initial phases
		progress.Phases["volume_scan"] = &interfaces.PhaseInfo{
			Status:    "completed",
			StartedAt: &progress.StartedAt,
			Progress:  1.0,
		}

		progress.Phases["filesystem_indexing"] = &interfaces.PhaseInfo{
			Status:   "pending",
			Progress: 0.0,
		}

		progress.Phases["media_enrichment"] = &interfaces.PhaseInfo{
			Status:   "pending",
			Progress: 0.0,
		}
	}

	// Get filesystem indexing progress if available
	if vs.filesystemIndexer != nil {
		if indexingProgress := vs.filesystemIndexer.GetIndexingProgress(progress.VolumeID); indexingProgress != nil {
			// Determine current phase
			if indexingProgress.Status == "running" {
				progress.Phase = "filesystem_indexing"
				progress.PhaseProgress = vs.calculatePhaseProgress(indexingProgress)

				// Update filesystem indexing phase
				progress.Phases["filesystem_indexing"].Status = "running"
				progress.Phases["filesystem_indexing"].Progress = progress.PhaseProgress
				progress.Phases["filesystem_indexing"].StartedAt = &indexingProgress.StartedAt
				progress.Phases["filesystem_indexing"].ItemsProcessed = indexingProgress.FilesScanned
				progress.Phases["filesystem_indexing"].ItemsTotal = indexingProgress.TotalFiles

				if indexingProgress.LastError != "" {
					progress.Phases["filesystem_indexing"].Error = indexingProgress.LastError
				}

				// Update file/folder counts
				progress.FilesScanned = indexingProgress.FilesScanned
				progress.FoldersScanned = indexingProgress.FoldersScanned
				progress.CurrentPath = indexingProgress.CurrentPath
				progress.CurrentDepth = indexingProgress.CurrentDepth
				progress.BytesProcessed = indexingProgress.BytesProcessed

				// Performance metrics
				progress.FilesPerSecond = indexingProgress.FilesPerSec
				progress.FoldersPerSecond = indexingProgress.FoldersPerSec
				if progress.ElapsedSeconds > 0 {
					progress.BytesPerSecond = progress.BytesProcessed / progress.ElapsedSeconds
				}

				// Error tracking
				progress.ErrorsCount = indexingProgress.ErrorsCount
				progress.LastError = indexingProgress.LastError

				// Estimate remaining time based on current rate
				if progress.FilesPerSecond > 0 && progress.TotalEstimated > 0 {
					remaining := float64(progress.TotalEstimated-progress.FilesScanned) / progress.FilesPerSecond
					progress.EstimatedRemaining = time.Duration(remaining) * time.Second
				}
			} else if indexingProgress.Status == "completed" {
				progress.Phases["filesystem_indexing"].Status = "completed"
				progress.Phases["filesystem_indexing"].Progress = 1.0
				completedAt := indexingProgress.LastUpdate
				progress.Phases["filesystem_indexing"].CompletedAt = &completedAt
				if progress.Phases["filesystem_indexing"].StartedAt != nil {
					progress.Phases["filesystem_indexing"].Duration = completedAt.Sub(*progress.Phases["filesystem_indexing"].StartedAt)
				}
			}
		}
	}

	// Calculate overall progress (weighted average of phases)
	progress.Progress = vs.calculateOverallProgress(progress.Phases)

	return &progress, nil
}

// GetScanProgressByVolume returns the progress of the active scan for a volume
func (vs *VolumeScanner) GetScanProgressByVolume(volumeID string) (*interfaces.ScanProgress, error) {
	// Use ProgressManager if available
	if vs.progressManager != nil {
		return vs.progressManager.GetProgressByVolume(volumeID)
	}

	// Fallback to old progress tracking
	vs.scanMutex.RLock()
	defer vs.scanMutex.RUnlock()

	scanID, exists := vs.volumeToScan[volumeID]
	if !exists {
		return nil, fmt.Errorf("no active scan found for volume: %s", volumeID)
	}

	progress, exists := vs.activeScans[scanID]
	if !exists {
		return nil, fmt.Errorf("scan progress not found for volume: %s", volumeID)
	}

	// Return a copy to avoid race conditions
	progressCopy := *progress
	return &progressCopy, nil
}

// calculatePhaseProgress calculates phase progress based on indexing data
func (vs *VolumeScanner) calculatePhaseProgress(indexing *filesystem.IndexingProgress) float64 {
	// PRIORITY 1: Use actual item counts if we know the total (most accurate)
	if indexing.TotalFiles > 0 {
		progress := float64(indexing.FilesScanned) / float64(indexing.TotalFiles)
		// Ensure progress is bounded [0.0, 1.0]
		if progress > 1.0 {
			return 1.0
		}
		if progress < 0.0 {
			return 0.0
		}
		return progress
	}

	// PRIORITY 2: If we're scanning but don't know total yet, use time-based heuristic
	elapsed := time.Since(indexing.StartedAt).Seconds()

	// Estimate progress based on processing rate and elapsed time
	if elapsed > 0 && indexing.FilesScanned > 0 {
		rate := float64(indexing.FilesScanned) / elapsed
		if rate > 0 {
			// Heuristic: progress = elapsed / (elapsed + estimated_remaining)
			// Assume 60 seconds of remaining work as a baseline
			progress := elapsed / (elapsed + 60)
			if progress > 0.95 {
				return 0.95 // Cap at 95% until we know the actual total
			}
			return progress
		}
	}

	// PRIORITY 3: Fallback to pure time-based estimation (least accurate)
	// Assume scan will complete within 5 minutes
	progress := elapsed / 300.0
	if progress > 0.95 {
		return 0.95 // Cap at 95%
	}
	return progress
}

// calculateOverallProgress calculates overall progress from phases using a hybrid approach
// that combines actual item counts with phase-specific complexity weights
func (vs *VolumeScanner) calculateOverallProgress(phases map[string]*interfaces.PhaseInfo) float64 {
	if phases == nil {
		return 0.0
	}

	// Complexity weights reflect the relative work per item in each phase
	// volume_scan: 1.0 (quick metadata query)
	// filesystem_indexing: 1.0 (file stat + DB insert)
	// media_enrichment: 2.0 (ffprobe/exif extraction + thumbnail generation - 2x heavier)
	complexityWeights := map[string]float64{
		"volume_scan":         1.0,
		"filesystem_indexing": 1.0,
		"media_enrichment":    2.0,
	}

	var totalWeightedItems float64
	var processedWeightedItems float64

	for phaseName, phase := range phases {
		// Get complexity weight for this phase (default to 1.0 if not specified)
		weight := complexityWeights[phaseName]
		if weight == 0 {
			weight = 1.0
		}

		// Weight the items by complexity
		totalWeightedItems += float64(phase.ItemsTotal) * weight
		processedWeightedItems += float64(phase.ItemsProcessed) * weight
	}

	// Avoid division by zero
	if totalWeightedItems == 0 {
		return 0.0
	}

	progress := processedWeightedItems / totalWeightedItems

	// Ensure progress is bounded [0.0, 1.0]
	if progress > 1.0 {
		return 1.0
	}
	if progress < 0.0 {
		return 0.0
	}

	return progress
}
