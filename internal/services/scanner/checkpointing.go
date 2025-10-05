package scanner

import (
	"context"
	"fmt"
	"log"
	"sync"
	"time"

	"github.com/mantonx/volumeviz/internal/interfaces"
	"github.com/mantonx/volumeviz/internal/repo"
	"github.com/mantonx/volumeviz/internal/store"
)

// Checkpoint intervals - save progress periodically
const (
	CheckpointInterval      = 5 * time.Minute  // Save every 5 minutes
	CheckpointItemThreshold = 100000           // Or every 100k items processed
	CheckpointRetention     = 7 * 24 * time.Hour // Keep checkpoints for 7 days
)

// CheckpointManager handles periodic checkpointing for long-running scans
type CheckpointManager struct {
	store            store.Store
	logger           *log.Logger
	progressManager  *ProgressManager

	activeScans      map[string]*checkpointContext
	mu               sync.RWMutex
}

type checkpointContext struct {
	scanID           string
	volumeID         string
	cancelFunc       context.CancelFunc
	lastItemCount    int64
	lastCheckpoint   time.Time
}

// NewCheckpointManager creates a new checkpoint manager
func NewCheckpointManager(store store.Store, progressManager *ProgressManager, logger *log.Logger) *CheckpointManager {
	return &CheckpointManager{
		store:           store,
		logger:          logger,
		progressManager: progressManager,
		activeScans:     make(map[string]*checkpointContext),
	}
}

// StartCheckpointing begins periodic checkpointing for a scan
func (cm *CheckpointManager) StartCheckpointing(ctx context.Context, scanID, volumeID string) {
	cm.mu.Lock()

	// Check if already checkpointing
	if _, exists := cm.activeScans[scanID]; exists {
		cm.mu.Unlock()
		return
	}

	// Create cancellable context for this scan's checkpointing
	checkpointCtx, cancel := context.WithCancel(context.Background())

	checkpointInfo := &checkpointContext{
		scanID:         scanID,
		volumeID:       volumeID,
		cancelFunc:     cancel,
		lastItemCount:  0,
		lastCheckpoint: time.Now(),
	}

	cm.activeScans[scanID] = checkpointInfo
	cm.mu.Unlock()

	if cm.logger != nil {
		cm.logger.Printf("[CHECKPOINT] Started checkpointing for scan: scan_id=%s volume=%s interval=%v",
			scanID, volumeID, CheckpointInterval)
	}

	// Run checkpointing loop
	go cm.checkpointLoop(checkpointCtx, checkpointInfo)
}

// StopCheckpointing stops checkpointing for a scan and saves final checkpoint
func (cm *CheckpointManager) StopCheckpointing(scanID string) {
	cm.mu.Lock()
	checkpointInfo, exists := cm.activeScans[scanID]
	if !exists {
		cm.mu.Unlock()
		return
	}

	// Cancel the checkpointing loop
	checkpointInfo.cancelFunc()
	delete(cm.activeScans, scanID)
	cm.mu.Unlock()

	// Save final checkpoint
	if err := cm.saveCheckpoint(context.Background(), scanID, checkpointInfo.volumeID); err != nil {
		if cm.logger != nil {
			cm.logger.Printf("[CHECKPOINT] Failed to save final checkpoint: scan_id=%s error=%v",
				scanID, err)
		}
	} else if cm.logger != nil {
		cm.logger.Printf("[CHECKPOINT] Saved final checkpoint: scan_id=%s", scanID)
	}
}

// checkpointLoop runs the periodic checkpointing
func (cm *CheckpointManager) checkpointLoop(ctx context.Context, info *checkpointContext) {
	ticker := time.NewTicker(CheckpointInterval)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			// Time-based checkpoint
			if err := cm.saveCheckpoint(ctx, info.scanID, info.volumeID); err != nil {
				if cm.logger != nil {
					cm.logger.Printf("[CHECKPOINT] Failed to save periodic checkpoint: scan_id=%s error=%v",
						info.scanID, err)
				}
			}

		case <-ctx.Done():
			// Context cancelled - stop checkpointing
			return
		}

		// Also check item-based threshold between timer ticks
		if cm.shouldCheckpointByItems(info) {
			if err := cm.saveCheckpoint(ctx, info.scanID, info.volumeID); err != nil {
				if cm.logger != nil {
					cm.logger.Printf("[CHECKPOINT] Failed to save item-threshold checkpoint: scan_id=%s error=%v",
						info.scanID, err)
				}
			}
		}
	}
}

// shouldCheckpointByItems checks if we should checkpoint based on items processed
func (cm *CheckpointManager) shouldCheckpointByItems(info *checkpointContext) bool {
	if cm.progressManager == nil {
		return false
	}

	progress, err := cm.progressManager.GetProgress(info.scanID)
	if err != nil || progress == nil {
		return false
	}

	currentItems := progress.FilesScanned + progress.FoldersScanned
	itemsDelta := currentItems - info.lastItemCount

	if itemsDelta >= CheckpointItemThreshold {
		info.lastItemCount = currentItems
		return true
	}

	return false
}

// saveCheckpoint saves the current scan state to database
func (cm *CheckpointManager) saveCheckpoint(ctx context.Context, scanID, volumeID string) error {
	if cm.store == nil {
		return fmt.Errorf("store not available")
	}

	if cm.progressManager == nil {
		return fmt.Errorf("progress manager not available")
	}

	// Get current progress
	progress, err := cm.progressManager.GetProgress(scanID)
	if err != nil || progress == nil {
		return fmt.Errorf("no progress found for scan %s: %w", scanID, err)
	}

	checkpointRepo := cm.store.Checkpoints()

	// Save volume scan checkpoint
	if err := cm.saveVolumeCheckpoint(ctx, checkpointRepo, scanID, volumeID, progress); err != nil {
		return fmt.Errorf("failed to save volume checkpoint: %w", err)
	}

	// Save filesystem indexing checkpoint if active
	if progress.Phase == "filesystem_indexing" {
		if err := cm.saveIndexingCheckpoint(ctx, checkpointRepo, scanID, volumeID, progress); err != nil {
			return fmt.Errorf("failed to save indexing checkpoint: %w", err)
		}
	}

	// Save enrichment checkpoint if active
	if progress.Phase == "media_enrichment" {
		if err := cm.saveEnrichmentCheckpoint(ctx, checkpointRepo, scanID, volumeID, progress); err != nil {
			return fmt.Errorf("failed to save enrichment checkpoint: %w", err)
		}
	}

	if cm.logger != nil {
		cm.logger.Printf("[CHECKPOINT] Saved checkpoint: scan_id=%s phase=%s progress=%.1f%% items=%d",
			scanID, progress.Phase, progress.Progress*100, progress.FilesScanned+progress.FoldersScanned)
	}

	return nil
}

// saveVolumeCheckpoint saves volume scan phase checkpoint
func (cm *CheckpointManager) saveVolumeCheckpoint(ctx context.Context, checkpointRepo repo.CheckpointRepo, scanID, volumeID string, progress *interfaces.ScanProgress) error {
	resumeData := map[string]interface{}{
		"method":        progress.Method,
		"started_at":    progress.StartedAt,
		"files_scanned": progress.FilesScanned,
	}

	checkpoint := repo.ScanCheckpoint{
		ScanID:         scanID,
		VolumeID:       volumeID,
		CheckpointType: "volume_scan",
		Phase:          progress.Phase,
		Progress:       progress.Progress,
		ItemsProcessed: progress.FilesScanned,
		BytesProcessed: progress.BytesProcessed,
		ErrorsCount:    progress.ErrorsCount,
		ResumeData:     resumeData,
	}

	return checkpointRepo.SaveCheckpoint(ctx, checkpoint)
}

// saveIndexingCheckpoint saves filesystem indexing phase checkpoint
func (cm *CheckpointManager) saveIndexingCheckpoint(ctx context.Context, checkpointRepo repo.CheckpointRepo, scanID, volumeID string, progress *interfaces.ScanProgress) error {
	resumeData := map[string]interface{}{
		"folders_scanned": progress.FoldersScanned,
		"files_scanned":   progress.FilesScanned,
		"current_depth":   progress.CurrentDepth,
	}

	checkpoint := repo.ScanCheckpoint{
		ScanID:         scanID,
		VolumeID:       volumeID,
		CheckpointType: "filesystem_indexing",
		Phase:          progress.Phase,
		Progress:       progress.PhaseProgress,
		ItemsProcessed: progress.FilesScanned,
		BytesProcessed: progress.BytesProcessed,
		ErrorsCount:    progress.ErrorsCount,
		LastPath:       progress.CurrentPath,
		LastDepth:      progress.CurrentDepth,
		ResumeData:     resumeData,
	}

	return checkpointRepo.SaveCheckpoint(ctx, checkpoint)
}

// saveEnrichmentCheckpoint saves media enrichment phase checkpoint
func (cm *CheckpointManager) saveEnrichmentCheckpoint(ctx context.Context, checkpointRepo repo.CheckpointRepo, scanID, volumeID string, progress *interfaces.ScanProgress) error {
	resumeData := map[string]interface{}{
		"files_enriched": progress.FilesScanned, // Reusing FilesScanned for enriched count
		"started_at":     progress.StartedAt,
	}

	checkpoint := repo.ScanCheckpoint{
		ScanID:         scanID,
		VolumeID:       volumeID,
		CheckpointType: "enrichment",
		Phase:          progress.Phase,
		Progress:       progress.PhaseProgress,
		ItemsProcessed: progress.FilesScanned,
		BytesProcessed: 0, // Enrichment doesn't track bytes
		ErrorsCount:    progress.ErrorsCount,
		ResumeData:     resumeData,
	}

	return checkpointRepo.SaveCheckpoint(ctx, checkpoint)
}

// CleanupOldCheckpoints removes checkpoints older than retention period
func (cm *CheckpointManager) CleanupOldCheckpoints(ctx context.Context) error {
	if cm.store == nil {
		return fmt.Errorf("store not available")
	}

	cutoff := time.Now().Add(-CheckpointRetention)
	count, err := cm.store.Checkpoints().CleanupOldCheckpoints(ctx, cutoff)
	if err != nil {
		return fmt.Errorf("failed to cleanup old checkpoints: %w", err)
	}

	if cm.logger != nil && count > 0 {
		cm.logger.Printf("[CHECKPOINT] Cleaned up %d old checkpoints (older than %v)",
			count, CheckpointRetention)
	}

	return nil
}

// GetCheckpointStats returns statistics about checkpoints
func (cm *CheckpointManager) GetCheckpointStats(ctx context.Context) (*repo.CheckpointStats, error) {
	if cm.store == nil {
		return nil, fmt.Errorf("store not available")
	}

	return cm.store.Checkpoints().GetStats(ctx)
}
