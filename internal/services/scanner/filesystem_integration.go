package scanner

import (
	"context"
	"fmt"
	"time"

	volumeConfig "github.com/mantonx/volumeviz/internal/config"
	"github.com/mantonx/volumeviz/internal/services/filesystem"
	"github.com/mantonx/volumeviz/internal/services/previews"
	"github.com/mantonx/volumeviz/internal/store"
)

// SetFilesystemIndexing enables filesystem indexing for an existing VolumeScanner
func (vs *VolumeScanner) SetFilesystemIndexing(
	foldersRepo FoldersRepository,
	filesRepo FilesRepository,
	indexerConfig filesystem.IndexerConfig,
	store store.Store,
	previewService *previews.Service,
) {
	vs.foldersRepo = foldersRepo
	vs.filesRepo = filesRepo
	vs.previewService = previewService
	vs.store = store // Set store for scan progress tracking

	// Initialize progress throttler with 2-second interval
	if store != nil {
		vs.progressThrottler = filesystem.NewProgressThrottler(store, 2*time.Second)
		// Start periodic flush to ensure pending updates are sent
		ctx := context.Background()
		vs.progressThrottler.StartPeriodicFlush(ctx)
	}

	// Initialize volume mapping if not already set
	if vs.volumeMapping == nil {
		vs.volumeMapping = volumeConfig.NewVolumeMappingConfig()
	}
	vs.filesystemIndexer = filesystem.NewFilesystemIndexer(
		store,
		indexerConfig,
		previewService,
		vs.enrichmentManager, // Use the volume scanner's enrichment manager
	)
	// Set progress broadcaster if we already have one
	if vs.progressBroadcaster != nil && vs.filesystemIndexer != nil {
		vs.filesystemIndexer.SetProgressBroadcaster(vs.progressBroadcaster)
	}
}

// GetFilesystemIndexingProgress returns the current filesystem indexing progress
func (vs *VolumeScanner) GetFilesystemIndexingProgress() *filesystem.IndexingProgress {
	if vs.filesystemIndexer == nil {
		return nil
	}
	return vs.filesystemIndexer.GetProgress()
}

// IsFilesystemIndexingEnabled returns true if filesystem indexing is enabled
func (vs *VolumeScanner) IsFilesystemIndexingEnabled() bool {
	return vs.filesystemIndexer != nil
}

// TriggerFilesystemIndexing manually triggers filesystem indexing for a volume
func (vs *VolumeScanner) TriggerFilesystemIndexing(ctx context.Context, volumeID string, deltaMode bool) error {
	return vs.TriggerFilesystemIndexingWithScanID(ctx, volumeID, deltaMode, "")
}

// TriggerFilesystemIndexingWithScanID manually triggers filesystem indexing for a volume with scan ID
func (vs *VolumeScanner) TriggerFilesystemIndexingWithScanID(ctx context.Context, volumeID string, deltaMode bool, scanID string) error {
	if vs.filesystemIndexer == nil {
		return fmt.Errorf("filesystem indexing not enabled")
	}

	// Get the correct volume path using volume mapping configuration
	volumePath, err := vs.getVolumePath(volumeID)
	if err != nil {
		return fmt.Errorf("failed to get volume path: %w", err)
	}

	// Start indexing in a goroutine to avoid blocking
	go vs.performFilesystemIndexingAsync(ctx, volumeID, volumePath, deltaMode, scanID)

	return nil
}

// performFilesystemIndexing performs filesystem indexing for a volume after successful scan
func (vs *VolumeScanner) performFilesystemIndexing(ctx context.Context, volumeID, volumePath, scanID string) {
	if vs.filesystemIndexer == nil {
		return
	}

	if vs.logger != nil {
		vs.logger.Printf("Starting filesystem indexing for volume: %s at path: %s", volumeID, volumePath)
	}

	// Use a derived context with timeout for indexing
	indexCtx, cancel := context.WithTimeout(context.Background(), 30*time.Minute)
	defer cancel()

	start := time.Now()

	// Use the scan ID passed in from the caller
	// Perform filesystem indexing (delta mode for efficiency)
	var err error
	if scanID != "" {
		err = vs.filesystemIndexer.IndexVolumeWithScanID(indexCtx, volumeID, volumePath, true, scanID)
	} else {
		err = vs.filesystemIndexer.IndexVolume(indexCtx, volumeID, volumePath, true)
	}
	duration := time.Since(start)

	if err != nil {
		if vs.logger != nil {
			vs.logger.Printf("Filesystem indexing failed for volume %s: %v (duration: %v)",
				volumeID, err, duration)
		}
		// Update metrics for failed indexing
		if vs.metrics != nil {
			vs.metrics.RecordScanFailure("filesystem_indexer", "indexing_failed")
		}
		return
	}

	// Get indexing progress/stats
	progress := vs.filesystemIndexer.GetProgress()
	if progress != nil && vs.logger != nil {
		vs.logger.Printf("Filesystem indexing completed for volume %s: %d folders, %d files, %d bytes processed (duration: %v)",
			volumeID, progress.FoldersScanned, progress.FilesScanned, progress.BytesProcessed, duration)
	}

	// Update metrics for successful indexing
	if vs.metrics != nil && progress != nil {
		vs.metrics.ScanCompleted(volumeID, "filesystem_indexer", duration, progress.BytesProcessed)
	}

	// Update last_scanned timestamp for the volume
	if vs.volumesRepo != nil {
		// Use a fresh context to avoid cancellation issues from the indexing timeout
		updateCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		if err := vs.volumesRepo.UpdateLastScanned(updateCtx, volumeID, time.Now()); err != nil {
			if vs.logger != nil {
				vs.logger.Printf("Failed to update last_scanned for volume %s: %v", volumeID, err)
			}
		}
	}

	// Trigger media enrichment if enabled
	if vs.enrichmentManager != nil && vs.enrichmentManager.IsEnabled() {
		// Use background context so enrichment can continue after scan completes
		go vs.performMediaEnrichment(context.Background(), volumeID)
	}
}

// performFilesystemIndexingAsync performs filesystem indexing asynchronously
func (vs *VolumeScanner) performFilesystemIndexingAsync(ctx context.Context, volumeID, volumePath string, deltaMode bool, scanID string) {
	if vs.filesystemIndexer == nil {
		return
	}

	if vs.logger != nil {
		vs.logger.Printf("Starting filesystem indexing for volume: %s at path: %s (delta_mode: %v)", volumeID, volumePath, deltaMode)
	}

	// Use a derived context with timeout for indexing
	indexCtx, cancel := context.WithTimeout(context.Background(), 30*time.Minute)
	defer cancel()

	start := time.Now()

	// Use the scan ID passed in from the caller
	// Perform filesystem indexing
	var err error
	if scanID != "" {
		err = vs.filesystemIndexer.IndexVolumeWithScanID(indexCtx, volumeID, volumePath, deltaMode, scanID)
	} else {
		err = vs.filesystemIndexer.IndexVolume(indexCtx, volumeID, volumePath, deltaMode)
	}
	duration := time.Since(start)

	if err != nil {
		if vs.logger != nil {
			vs.logger.Printf("Filesystem indexing failed for volume %s: %v (duration: %v)",
				volumeID, err, duration)
		}
	} else {
		if vs.logger != nil {
			vs.logger.Printf("Filesystem indexing completed for volume %s (duration: %v)",
				volumeID, duration)
		}
	}
}
