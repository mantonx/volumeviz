package scheduler

import (
	"context"
	"fmt"
	"log"

	"github.com/mantonx/volumeviz/internal/interfaces"
	"github.com/mantonx/volumeviz/internal/models"
	"github.com/mantonx/volumeviz/internal/realtime"
	"github.com/mantonx/volumeviz/internal/services/filesystem"
	"github.com/mantonx/volumeviz/internal/store"
)

// ResumeManager handles detection and resumption of paused scans
type ResumeManager struct {
	store               store.Store
	scanner             interfaces.VolumeScanner
	progressBroadcaster realtime.BroadcasterInterface
	
	// Resume statistics
	resumeAttempts    int
	successfulResumes int
	failedResumes     int
}

// NewResumeManager creates a new resume manager
func NewResumeManager(store store.Store, scanner interfaces.VolumeScanner, progressBroadcaster realtime.BroadcasterInterface) *ResumeManager {
	return &ResumeManager{
		store:               store,
		scanner:             scanner,
		progressBroadcaster: progressBroadcaster,
	}
}

// ResumePausedScans detects and attempts to resume all paused scans
func (rm *ResumeManager) ResumePausedScans(ctx context.Context) error {
	log.Printf("[INFO] ResumeManager: Checking for paused scans to resume")
	
	// Get all paused scan phases
	pausedScans, err := rm.findPausedScans(ctx)
	if err != nil {
		return fmt.Errorf("failed to find paused scans: %w", err)
	}
	
	if len(pausedScans) == 0 {
		log.Printf("[INFO] ResumeManager: No paused scans found")
		return nil
	}
	
	log.Printf("[INFO] ResumeManager: Found %d paused scans to resume", len(pausedScans))
	
	// Deduplicate by volume ID to prevent multiple scans for the same volume
	volumeScans := make(map[string]*PausedScanInfo)
	for _, scan := range pausedScans {
		// Only keep the most recent scan for each volume
		if existing, exists := volumeScans[scan.VolumeID]; !exists || scan.ScanID > existing.ScanID {
			volumeScans[scan.VolumeID] = scan
		}
	}
	
	log.Printf("[INFO] ResumeManager: Deduplicated to %d unique volumes", len(volumeScans))
	
	// Attempt to resume each unique volume scan
	for volumeID, scan := range volumeScans {
		rm.resumeAttempts++
		
		// Check if volume already has an active scan before resuming
		if rm.hasActiveScan(ctx, volumeID) {
			log.Printf("[INFO] ResumeManager: Volume %s already has an active scan, skipping resume", volumeID)
			continue
		}
		
		if err := rm.resumeScan(ctx, scan); err != nil {
			rm.failedResumes++
			log.Printf("[ERROR] ResumeManager: Failed to resume scan %s (volume: %s): %v", 
				scan.ScanID, scan.VolumeID, err)
		} else {
			rm.successfulResumes++
			log.Printf("[INFO] ResumeManager: Successfully resumed scan %s (volume: %s)", 
				scan.ScanID, scan.VolumeID)
		}
	}
	
	log.Printf("[INFO] ResumeManager: Resume operation complete - %d successful, %d failed", 
		rm.successfulResumes, rm.failedResumes)
	
	return nil
}

// PausedScanInfo holds information about a paused scan
type PausedScanInfo struct {
	ScanID     string
	VolumeID   string
	PhaseName  string
	CurrentItem string
	ItemsProcessed int64
	ItemsTotal     int64
	PauseReason    string
}

// findPausedScans queries the database for scans that need resumption
func (rm *ResumeManager) findPausedScans(ctx context.Context) ([]*PausedScanInfo, error) {
	scanProgressRepo := rm.store.ScanProgress()
	if scanProgressRepo == nil {
		return nil, fmt.Errorf("scan progress repository not available")
	}
	
	scansRepo := rm.store.Scans()
	if scansRepo == nil {
		return nil, fmt.Errorf("scans repository not available") 
	}
	
	// Get all recent scan jobs to check for resumable scans
	activeScanJobs, err := scansRepo.ListScanJobs(ctx, 100, 0)
	if err != nil {
		return nil, fmt.Errorf("failed to list scan jobs: %w", err)
	}

	var pausedScans []*PausedScanInfo

	// Check each scan job for resumable phases
	for _, scanJob := range activeScanJobs {
		if scanJob.Status == "paused" || scanJob.Status == "failed" {
			phases, err := scanProgressRepo.GetScanPhases(ctx, scanJob.ScanID)
			if err != nil {
				log.Printf("[WARN] ResumeManager: Failed to get phases for scan %s: %v", scanJob.ScanID, err)
				continue
			}
			
			// Find the earliest phase that needs resumption
			resumablePhase := rm.findResumablePhase(phases)
			if resumablePhase != nil {
				pausedScans = append(pausedScans, &PausedScanInfo{
					ScanID:         scanJob.ScanID,
					VolumeID:       scanJob.VolumeID,
					PhaseName:      resumablePhase.PhaseName,
					CurrentItem:    resumablePhase.CurrentItem,
					ItemsProcessed: resumablePhase.ItemsProcessed,
					ItemsTotal:     resumablePhase.ItemsTotal,
					PauseReason:    resumablePhase.ErrorMessage,
				})
			}
		}
	}
	
	return pausedScans, nil
}

// findResumablePhase identifies which phase should be resumed, prioritizing by execution order
func (rm *ResumeManager) findResumablePhase(phases []models.ScanPhase) *models.ScanPhase {
	// Phase execution order: volume_scan -> filesystem_indexing -> media_enrichment
	phaseOrder := []string{"volume_scan", "filesystem_indexing", "media_enrichment"}
	
	// First, look for explicitly paused phases
	for _, phaseName := range phaseOrder {
		for _, phase := range phases {
			if phase.PhaseName == phaseName && phase.Status == "paused" {
				return &phase
			}
		}
	}

	// Second, look for running phases (these were interrupted mid-execution)
	for _, phaseName := range phaseOrder {
		for _, phase := range phases {
			if phase.PhaseName == phaseName && phase.Status == "running" {
				return &phase
			}
		}
	}

	// Third, look for incomplete phases that are marked as "completed" but shouldn't be
	for _, phaseName := range phaseOrder {
		for _, phase := range phases {
			if phase.PhaseName == phaseName && phase.Status == "completed" {
				// Check if this phase is actually incomplete
				if rm.isPhaseIncomplete(&phase) {
					return &phase
				}
			}
		}
	}

	// Finally, look for failed phases
	for _, phaseName := range phaseOrder {
		for _, phase := range phases {
			if phase.PhaseName == phaseName && phase.Status == "failed" {
				return &phase
			}
		}
	}
	
	return nil
}

// isPhaseIncomplete checks if a phase marked as "completed" is actually incomplete
func (rm *ResumeManager) isPhaseIncomplete(phase *models.ScanPhase) bool {
	// If items_total is set and items_processed is significantly less, it's incomplete
	if phase.ItemsTotal > 0 && phase.ItemsProcessed < phase.ItemsTotal {
		// Consider it incomplete if less than 95% processed
		completionRate := float64(phase.ItemsProcessed) / float64(phase.ItemsTotal)
		if completionRate < 0.95 {
			return true
		}
	}

	return false
}

// resumeScan attempts to resume a specific paused scan
func (rm *ResumeManager) resumeScan(ctx context.Context, pausedScan *PausedScanInfo) error {
	log.Printf("[INFO] ResumeManager: Attempting to resume %s phase for scan %s (volume: %s)",
		pausedScan.PhaseName, pausedScan.ScanID, pausedScan.VolumeID)
	
	switch pausedScan.PhaseName {
	case "volume_scan":
		return rm.resumeVolumeScan(ctx, pausedScan)
	case "filesystem_indexing":
		return rm.resumeFilesystemIndexing(ctx, pausedScan)
	case "media_enrichment":
		return rm.resumeMediaEnrichment(ctx, pausedScan)
	default:
		return fmt.Errorf("unsupported phase for resumption: %s", pausedScan.PhaseName)
	}
}

// resumeVolumeScan resumes a paused volume scan
func (rm *ResumeManager) resumeVolumeScan(ctx context.Context, pausedScan *PausedScanInfo) error {
	// Volume scan is typically quick, so we can just restart it
	log.Printf("[INFO] ResumeManager: Restarting volume scan for volume %s", pausedScan.VolumeID)
	
	// Use the scanner interface to restart the volume scan
	// Note: This assumes we have a method to continue/restart scans
	if scanner, ok := rm.scanner.(interface {
		ScanVolumeAsync(ctx context.Context, volumeID string) (string, error)
	}); ok {
		newScanID, err := scanner.ScanVolumeAsync(ctx, pausedScan.VolumeID)
		if err != nil {
			return err
		}
		
		// Log the successful scan creation - the volume scanner should handle updating volume state
		log.Printf("[INFO] ResumeManager: New scan %s started for volume %s", newScanID, pausedScan.VolumeID)
		
		log.Printf("[INFO] ResumeManager: Started new scan %s for volume %s (replacing failed scan %s)", 
			newScanID, pausedScan.VolumeID, pausedScan.ScanID)
		return nil
	}
	
	return fmt.Errorf("scanner does not support async volume scanning")
}

// resumeFilesystemIndexing resumes paused filesystem indexing
func (rm *ResumeManager) resumeFilesystemIndexing(ctx context.Context, pausedScan *PausedScanInfo) error {
	log.Printf("[INFO] ResumeManager: Resuming filesystem indexing for volume %s from checkpoint: %s",
		pausedScan.VolumeID, pausedScan.CurrentItem)
	
	// Get volume information to find the mountpoint
	volume, err := rm.getVolumeInfo(ctx, pausedScan.VolumeID)
	if err != nil {
		return fmt.Errorf("failed to get volume info: %w", err)
	}
	
	// Create a filesystem indexer and resume from checkpoint
	indexer := filesystem.NewFilesystemIndexer(
		rm.store,
		filesystem.IndexerConfig{
			// Use default config for now - in production this should come from scheduler config
			DetectMimeTypes: true,
			SkipHidden:     true,
			MaxDepth:       20,
		},
		nil, // preview service
		nil, // enrichment manager  
	)
	
	// Resume the paused scan
	return indexer.ResumePausedScan(ctx, pausedScan.VolumeID, volume.Mountpoint, pausedScan.ScanID)
}

// resumeMediaEnrichment resumes paused media enrichment
func (rm *ResumeManager) resumeMediaEnrichment(ctx context.Context, pausedScan *PausedScanInfo) error {
	log.Printf("[INFO] ResumeManager: Skipping media enrichment resumption for volume %s (will be handled by enrichment manager)", pausedScan.VolumeID)
	
	// Media enrichment resumption is handled automatically by the enrichment manager
	// Don't create new scans here to avoid conflicts
	// The enrichment manager will continue processing files as needed
	
	// Mark this as successfully handled to prevent retry loops
	return nil
}

// getVolumeInfo retrieves volume information including mountpoint
func (rm *ResumeManager) getVolumeInfo(ctx context.Context, volumeID string) (*VolumeInfo, error) {
	// This would need to be implemented based on how volumes are stored
	// For now, return a placeholder
	return &VolumeInfo{
		ID:         volumeID,
		Name:       volumeID, // Assuming ID and name are the same for now
		Mountpoint: "/volumes/" + volumeID, // Placeholder mountpoint
	}, nil
}

// hasActiveScan checks if a volume already has an active (running) scan
func (rm *ResumeManager) hasActiveScan(ctx context.Context, volumeID string) bool {
	scansRepo := rm.store.Scans()
	if scansRepo == nil {
		return false
	}
	
	// Get recent scan jobs for this volume
	activeScanJobs, err := scansRepo.ListScanJobs(ctx, 10, 0)
	if err != nil {
		log.Printf("[WARN] ResumeManager: Failed to check for active scans for volume %s: %v", volumeID, err)
		return false
	}
	
	// Check if any scan for this volume is currently running
	for _, scanJob := range activeScanJobs {
		if scanJob.VolumeID == volumeID && scanJob.Status == "running" {
			return true
		}
	}

	return false
}

// VolumeInfo holds volume information for resumption
type VolumeInfo struct {
	ID         string
	Name       string
	Mountpoint string
}


// GetResumeStats returns resume manager statistics
func (rm *ResumeManager) GetResumeStats() ResumeStats {
	return ResumeStats{
		ResumeAttempts:    rm.resumeAttempts,
		SuccessfulResumes: rm.successfulResumes,
		FailedResumes:     rm.failedResumes,
	}
}

// ResumeStats holds resume manager statistics
type ResumeStats struct {
	ResumeAttempts    int `json:"resume_attempts"`
	SuccessfulResumes int `json:"successful_resumes"`
	FailedResumes     int `json:"failed_resumes"`
}