package scanner

import (
	"context"
	"fmt"
	"time"

	"github.com/mantonx/volumeviz/internal/interfaces"
	coreModels "github.com/mantonx/volumeviz/internal/models"
)

// performMediaEnrichment performs media metadata enrichment for a volume after filesystem indexing
func (vs *VolumeScanner) performMediaEnrichment(ctx context.Context, volumeID string) {
	if vs.enrichmentManager == nil || !vs.enrichmentManager.IsEnabled() {
		return
	}

	if vs.logger != nil {
		vs.logger.Printf("Starting media enrichment for volume %s", volumeID)
	}

	// Initialize enrichment phase tracking
	vs.scanMutex.Lock()
	scanID := vs.volumeToScan[volumeID]
	if scanID != "" && vs.activeScans[scanID] != nil {
		if vs.activeScans[scanID].Phases == nil {
			vs.activeScans[scanID].Phases = make(map[string]*interfaces.PhaseInfo)
		}
		startedAt := time.Now()
		vs.activeScans[scanID].Phases["media_enrichment"] = &interfaces.PhaseInfo{
			Status:    coreModels.ScanStatusRunning,
			Progress:  0.0,
			StartedAt: &startedAt,
		}
		// Update overall progress using ProgressManager if available
		if vs.progressManager != nil {
			vs.progressManager.UpdateProgress(scanID, ProgressUpdate{
				Type:     "media_enrichment",
				Progress: 0.0,
			})
		} else {
			// Fallback to old progress calculation
			vs.activeScans[scanID].Progress = vs.calculateOverallProgress(vs.activeScans[scanID].Phases)
		}
	}
	vs.scanMutex.Unlock()

	// Create context with cancellation using background context to avoid cancellation when scan completes
	enrichCtx, cancel := context.WithTimeout(context.Background(), 30*time.Minute) // 30 min max for enrichment
	defer cancel()

	start := time.Now()

	// Monitor enrichment progress in background
	SafeGo(vs.logger, "monitor-enrichment-progress", func() {
		vs.monitorEnrichmentProgress(volumeID, scanID)
	})

	// Perform media enrichment
	var err error
	if scanID != "" {
		err = vs.enrichmentManager.EnrichVolumeWithScanID(enrichCtx, volumeID, scanID)
	} else {
		err = vs.enrichmentManager.EnrichVolume(enrichCtx, volumeID)
	}
	duration := time.Since(start)

	// Update final enrichment phase status
	vs.scanMutex.Lock()
	if scanID != "" && vs.activeScans[scanID] != nil && vs.activeScans[scanID].Phases != nil {
		if err != nil {
			vs.activeScans[scanID].Phases["media_enrichment"].Status = coreModels.ScanStatusFailed
			vs.activeScans[scanID].Phases["media_enrichment"].Error = err.Error()
		} else {
			vs.activeScans[scanID].Phases["media_enrichment"].Status = coreModels.ScanStatusCompleted
			vs.activeScans[scanID].Phases["media_enrichment"].Progress = 1.0
		}
		completedAt := time.Now()
		vs.activeScans[scanID].Phases["media_enrichment"].CompletedAt = &completedAt
		vs.activeScans[scanID].Phases["media_enrichment"].Duration = duration

		// Update overall progress using ProgressManager if available
		if vs.progressManager != nil {
			vs.progressManager.FinishPhase(scanID, "media_enrichment", err == nil, "")
		} else {
			// Fallback to old progress calculation
			vs.activeScans[scanID].Progress = vs.calculateOverallProgress(vs.activeScans[scanID].Phases)
		}
	}
	vs.scanMutex.Unlock()

	if err != nil {
		if vs.logger != nil {
			vs.logger.Printf("Media enrichment failed for volume %s: %v (duration: %v)", volumeID, err, duration)
		}
		// Update metrics for failed enrichment
		if vs.metrics != nil {
			vs.metrics.RecordScanFailure("media_enricher", "enrichment_failed")
		}
		return
	}

	if vs.logger != nil {
		vs.logger.Printf("Media enrichment completed for volume %s (duration: %v)", volumeID, duration)
	}

	// Update metrics for successful enrichment
	if vs.metrics != nil {
		vs.metrics.ScanCompleted(volumeID, "media_enricher", duration, 0) // No bytes metric for enrichment
	}
}

// monitorEnrichmentProgress monitors enrichment progress and updates phase tracking
func (vs *VolumeScanner) monitorEnrichmentProgress(volumeID, scanID string) {
	if vs.enrichmentManager == nil || scanID == "" {
		return
	}

	ticker := time.NewTicker(2 * time.Second) // Check every 2 seconds
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			// Get enrichment progress from manager
			progress := vs.enrichmentManager.GetProgress(volumeID)
			if progress == nil {
				continue
			}

			vs.scanMutex.Lock()
			if vs.activeScans[scanID] != nil && vs.activeScans[scanID].Phases != nil {
				if phase, exists := vs.activeScans[scanID].Phases["media_enrichment"]; exists {
					// Update phase progress based on enrichment status
					if progress.TotalFiles > 0 {
						phase.Progress = float64(progress.ProcessedFiles) / float64(progress.TotalFiles)
					}

					// Update items processed count
					phase.ItemsProcessed = progress.ProcessedFiles

					// Update phase status
					switch progress.Status {
					case "running":
						phase.Status = coreModels.ScanStatusRunning
					case "completed":
						phase.Status = coreModels.ScanStatusCompleted
						phase.Progress = 1.0
					case "failed":
						phase.Status = coreModels.ScanStatusFailed
						if progress.LastError != "" {
							phase.Error = progress.LastError
						}
					}

					// Store detailed error information in phase for frontend access
					if len(progress.RecentErrors) > 0 {
						// Store recent errors as additional data in the phase
						// This will be accessible via the phases API field
						if vs.activeScans[scanID].Phases["media_enrichment"] != nil {
							// Add error details to the overall scan progress errors
							vs.activeScans[scanID].ErrorsCount = progress.ErrorsCount
							vs.activeScans[scanID].LastError = progress.LastError

							// Format recent errors for the API response
							errorMessages := make([]string, 0, len(progress.RecentErrors))
							for _, err := range progress.RecentErrors {
								errorMsg := fmt.Sprintf("%s: %s (%s) - %s", err.EnricherName, err.ErrorType, err.FileName, err.ErrorMessage)
								if err.TechnicalDetails != "" {
									errorMsg += fmt.Sprintf(" [%s]", err.TechnicalDetails)
								}
								errorMessages = append(errorMessages, errorMsg)
							}
							vs.activeScans[scanID].Errors = errorMessages
						}
					}

					// Update overall scan progress using ProgressManager if available
					if vs.progressManager != nil {
						vs.progressManager.UpdateProgress(scanID, ProgressUpdate{
							Type:           "media_enrichment",
							Progress:       phase.Progress,
							ItemsProcessed: progress.ProcessedFiles,
						})
					} else {
						// Fallback to old progress calculation
						vs.activeScans[scanID].Progress = vs.calculateOverallProgress(vs.activeScans[scanID].Phases)
					}
				}
			}
			vs.scanMutex.Unlock()

			// Exit if enrichment is completed or failed
			if progress.Status == "completed" || progress.Status == "failed" {
				return
			}

		case <-time.After(5 * time.Minute): // Timeout after 5 minutes of no updates
			return
		}
	}
}
