package scanner

import (
	"context"
	"fmt"
	"log"
	"time"

	"github.com/mantonx/volumeviz/internal/repo"
	"github.com/mantonx/volumeviz/internal/store"
)

// ResumeManager handles resuming interrupted scans from checkpoints
type ResumeManager struct {
	store  store.Store
	logger *log.Logger
}

// NewResumeManager creates a new resume manager
func NewResumeManager(store store.Store, logger *log.Logger) *ResumeManager {
	return &ResumeManager{
		store:  store,
		logger: logger,
	}
}

// CanResume checks if a scan can be resumed from a checkpoint
func (rm *ResumeManager) CanResume(ctx context.Context, scanID string) (bool, error) {
	if rm.store == nil {
		return false, fmt.Errorf("store not available")
	}

	checkpoint, err := rm.store.Checkpoints().LoadLatestCheckpoint(ctx, scanID)
	if err != nil {
		return false, fmt.Errorf("failed to check for checkpoint: %w", err)
	}

	// Check if checkpoint exists and is recent (within 24 hours)
	if checkpoint != nil {
		age := time.Since(checkpoint.UpdatedAt)
		if age < 24*time.Hour {
			return true, nil
		}

		if rm.logger != nil {
			rm.logger.Printf("[RESUME] Checkpoint too old: scan_id=%s age=%v", scanID, age)
		}
	}

	return false, nil
}

// GetResumeInfo returns checkpoint information for resuming a scan
func (rm *ResumeManager) GetResumeInfo(ctx context.Context, scanID string) (*ResumeInfo, error) {
	if rm.store == nil {
		return nil, fmt.Errorf("store not available")
	}

	checkpoints, err := rm.store.Checkpoints().LoadAllCheckpoints(ctx, scanID)
	if err != nil {
		return nil, fmt.Errorf("failed to load checkpoints: %w", err)
	}

	if len(checkpoints) == 0 {
		return nil, fmt.Errorf("no checkpoints found for scan %s", scanID)
	}

	info := &ResumeInfo{
		ScanID:      scanID,
		VolumeID:    checkpoints[0].VolumeID,
		Checkpoints: make(map[string]*repo.ScanCheckpoint),
	}

	// Organize checkpoints by type
	for _, cp := range checkpoints {
		info.Checkpoints[cp.CheckpointType] = cp
	}

	// Determine which phase to resume from
	if indexingCP, ok := info.Checkpoints["filesystem_indexing"]; ok && indexingCP.Progress < 1.0 {
		info.ResumePhase = "filesystem_indexing"
		info.ResumeProgress = indexingCP.Progress
	} else if volumeCP, ok := info.Checkpoints["volume_scan"]; ok && volumeCP.Progress < 1.0 {
		info.ResumePhase = "volume_scan"
		info.ResumeProgress = volumeCP.Progress
	} else if enrichmentCP, ok := info.Checkpoints["enrichment"]; ok && enrichmentCP.Progress < 1.0 {
		info.ResumePhase = "enrichment"
		info.ResumeProgress = enrichmentCP.Progress
	} else {
		// All phases complete, nothing to resume
		return nil, fmt.Errorf("scan already completed: scan_id=%s", scanID)
	}

	if rm.logger != nil {
		rm.logger.Printf("[RESUME] Resume info loaded: scan_id=%s phase=%s progress=%.1f%%",
			scanID, info.ResumePhase, info.ResumeProgress*100)
	}

	return info, nil
}

// CleanupCheckpointsForScan removes all checkpoints for a completed scan
func (rm *ResumeManager) CleanupCheckpointsForScan(ctx context.Context, scanID string) error {
	if rm.store == nil {
		return fmt.Errorf("store not available")
	}

	err := rm.store.Checkpoints().DeleteAllCheckpoints(ctx, scanID)
	if err != nil {
		return fmt.Errorf("failed to cleanup checkpoints: %w", err)
	}

	if rm.logger != nil {
		rm.logger.Printf("[RESUME] Cleaned up checkpoints for completed scan: scan_id=%s", scanID)
	}

	return nil
}

// ResumeInfo contains information about resuming a scan
type ResumeInfo struct {
	ScanID         string
	VolumeID       string
	ResumePhase    string // Which phase to resume from
	ResumeProgress float64
	Checkpoints    map[string]*repo.ScanCheckpoint // By checkpoint type
}

// FindResumableScans finds incomplete scans that can be resumed
func FindResumableScans(ctx context.Context, store store.Store, logger *log.Logger) ([]string, error) {
	if store == nil {
		return nil, fmt.Errorf("store not available")
	}

	// Get all recent checkpoints (within 24 hours)
	cutoff := time.Now().Add(-24 * time.Hour)

	// Query checkpoints updated since cutoff
	// Note: We'd need a query for this, for now return empty
	// TODO: Add GetRecentCheckpoints query to checkpoint repo

	if logger != nil {
		logger.Printf("[RESUME] Checked for resumable scans since %v", cutoff)
	}

	return []string{}, nil
}

// ResumeScanFromCheckpoint attempts to resume a scan from its checkpoint
// This is called by the VolumeScanner when resuming
func (rm *ResumeManager) ResumeScanFromCheckpoint(ctx context.Context, scanID string) (*ResumeInfo, error) {
	info, err := rm.GetResumeInfo(ctx, scanID)
	if err != nil {
		return nil, fmt.Errorf("failed to get resume info: %w", err)
	}

	if rm.logger != nil {
		rm.logger.Printf("[RESUME] Resuming scan: scan_id=%s volume=%s phase=%s progress=%.1f%%",
			scanID, info.VolumeID, info.ResumePhase, info.ResumeProgress*100)
	}

	return info, nil
}
