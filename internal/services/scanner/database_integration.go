package scanner

import (
	"context"
	"time"

	"github.com/mantonx/volumeviz/internal/models"
)

// initializeDatabaseProgress creates scan phases in the database for detailed tracking
func (vs *VolumeScanner) initializeDatabaseProgress(ctx context.Context, scanID, volumeID string) {
	if vs.store == nil {
		if vs.logger != nil {
			vs.logger.Printf("Store is nil, skipping database progress initialization for scan %s", scanID)
		}
		return
	}

	if vs.logger != nil {
		vs.logger.Printf("Initializing database progress for scan %s (volume: %s)", scanID, volumeID)
	}

	scanProgressRepo := vs.store.ScanProgress()
	if scanProgressRepo == nil {
		if vs.logger != nil {
			vs.logger.Printf("ScanProgress repo is nil for scan %s", scanID)
		}
		return
	}

	now := time.Now()

	// Create volume scan phase
	if vs.logger != nil {
		vs.logger.Printf("Creating volume_scan phase for scan %s", scanID)
	}
	_, err := scanProgressRepo.CreateScanPhase(ctx, models.CreateScanPhaseParams{
		ScanID:     scanID,
		PhaseName:  "volume_scan",
		PhaseOrder: 1,
		Status:     "running",
		StartedAt:  &now,
		Metadata:   "{}",
	})
	if err != nil && vs.logger != nil {
		vs.logger.Printf("Failed to create volume_scan phase for scan %s: %v", scanID, err)
	} else if vs.logger != nil {
		vs.logger.Printf("Successfully created volume_scan phase for scan %s", scanID)
	}

	// Create filesystem indexing phase
	if vs.logger != nil {
		vs.logger.Printf("Creating filesystem_indexing phase for scan %s", scanID)
	}
	_, err = scanProgressRepo.CreateScanPhase(ctx, models.CreateScanPhaseParams{
		ScanID:     scanID,
		PhaseName:  "filesystem_indexing",
		PhaseOrder: 2,
		Status:     "pending",
		Metadata:   "{}",
	})
	if err != nil && vs.logger != nil {
		vs.logger.Printf("Failed to create filesystem_indexing phase for scan %s: %v", scanID, err)
	} else if vs.logger != nil {
		vs.logger.Printf("Successfully created filesystem_indexing phase for scan %s", scanID)
	}

	// Create media enrichment phase
	if vs.logger != nil {
		vs.logger.Printf("Creating media_enrichment phase for scan %s", scanID)
	}
	_, err = scanProgressRepo.CreateScanPhase(ctx, models.CreateScanPhaseParams{
		ScanID:     scanID,
		PhaseName:  "media_enrichment",
		PhaseOrder: 3,
		Status:     "pending",
		Metadata:   "{}",
	})
	if err != nil && vs.logger != nil {
		vs.logger.Printf("Failed to create media_enrichment phase for scan %s: %v", scanID, err)
	} else if vs.logger != nil {
		vs.logger.Printf("Successfully created media_enrichment phase for scan %s", scanID)
	}

	if vs.logger != nil {
		vs.logger.Printf("Database progress initialization completed for scan %s", scanID)
	}
}

// updateVolumePhaseStatus updates the volume scan phase status in the database
func (vs *VolumeScanner) updateVolumePhaseStatus(ctx context.Context, scanID, status, errorMessage string) {
	if vs.store == nil {
		return
	}

	// Flush any pending throttled updates before status change
	if vs.progressThrottler != nil {
		if err := vs.progressThrottler.FlushPending(ctx, scanID); err != nil && vs.logger != nil {
			vs.logger.Printf("Failed to flush pending progress updates for scan %s: %v", scanID, err)
		}
	}

	scanProgressRepo := vs.store.ScanProgress()

	if status == "completed" {
		err := scanProgressRepo.CompleteScanPhase(ctx, scanID, "volume_scan")
		if err != nil && vs.logger != nil {
			vs.logger.Printf("Failed to complete volume_scan phase for scan %s: %v", scanID, err)
		}

		// Cleanup throttler tracking for completed scan
		if vs.progressThrottler != nil {
			updates, throttled := vs.progressThrottler.GetStats(scanID)
			if throttled > 0 && vs.logger != nil {
				reductionRate := float64(throttled) / float64(updates) * 100
				vs.logger.Printf("Scan %s throttling stats - Updates: %d, Throttled: %d (%.1f%% DB write reduction)",
					scanID, updates, throttled, reductionRate)
			}
			vs.progressThrottler.Cleanup(scanID)
		}
	} else if status == "failed" {
		err := scanProgressRepo.FailScanPhase(ctx, scanID, "volume_scan", errorMessage)
		if err != nil && vs.logger != nil {
			vs.logger.Printf("Failed to mark volume_scan phase as failed for scan %s: %v", scanID, err)
		}

		// Cleanup throttler tracking for failed scan
		if vs.progressThrottler != nil {
			vs.progressThrottler.Cleanup(scanID)
		}
	}
}
