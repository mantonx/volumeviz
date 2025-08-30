package scanner

import (
	"fmt"
	"sync"
	"time"

	"github.com/mantonx/volumeviz/internal/interfaces"
	"github.com/mantonx/volumeviz/internal/models"
	"github.com/mantonx/volumeviz/internal/realtime"
	"github.com/mantonx/volumeviz/internal/utils"
)

// ProgressManager handles centralized progress tracking and broadcasting for volume scans
type ProgressManager struct {
	// Progress tracking
	activeScans  map[string]*interfaces.ScanProgress
	volumeToScan map[string]string
	mutex        sync.RWMutex

	// Broadcasting
	broadcaster realtime.BroadcasterInterface

	// Configuration
	updateInterval time.Duration
}

// NewProgressManager creates a new progress manager
func NewProgressManager(broadcaster realtime.BroadcasterInterface) *ProgressManager {
	return &ProgressManager{
		activeScans:    make(map[string]*interfaces.ScanProgress),
		volumeToScan:   make(map[string]string),
		broadcaster:    broadcaster,
		updateInterval: 1 * time.Second, // Update every second
	}
}

// StartScan initializes progress tracking for a new scan
func (pm *ProgressManager) StartScan(scanID, volumeID string) {
	now := time.Now()
	progress := &interfaces.ScanProgress{
		ScanID:         scanID,
		VolumeID:       volumeID,
		Status:         models.ScanStatusRunning,
		Progress:       0.0,
		Phase:          "volume_scan",
		StartedAt:      now,
		LastUpdate:     now,
		ElapsedSeconds: 0,
		Phases: map[string]*interfaces.PhaseInfo{
			"volume_scan": {
				Status:    "running",
				StartedAt: utils.Ptr(now),
				Progress:  0.0,
			},
			"filesystem_indexing": {
				Status:   "pending",
				Progress: 0.0,
			},
			"media_enrichment": {
				Status:   "pending",
				Progress: 0.0,
			},
		},
	}

	pm.mutex.Lock()
	pm.activeScans[scanID] = progress
	pm.volumeToScan[volumeID] = scanID
	pm.mutex.Unlock()

	// Broadcast initial progress
	pm.broadcastProgress(scanID)
}

// UpdateProgress updates scan progress and broadcasts changes
func (pm *ProgressManager) UpdateProgress(scanID string, update ProgressUpdate) {
	pm.mutex.Lock()
	defer pm.mutex.Unlock()

	progress, exists := pm.activeScans[scanID]
	if !exists {
		return
	}

	now := time.Now()
	progress.LastUpdate = now
	progress.ElapsedSeconds = int64(now.Sub(progress.StartedAt).Seconds())

	// Apply the update based on type
	switch update.Type {
	case "volume_scan":
		pm.updateVolumeScanProgress(progress, update)
	case "filesystem_indexing":
		pm.updateFilesystemIndexingProgress(progress, update)
	case "media_enrichment":
		pm.updateMediaEnrichmentProgress(progress, update)
	}

	// Calculate overall progress
	progress.Progress = pm.calculateOverallProgress(progress.Phases)

	// Broadcast the update
	pm.broadcastProgress(scanID)
}

// FinishPhase marks a phase as completed
func (pm *ProgressManager) FinishPhase(scanID, phase string, success bool, errorMsg string) {
	pm.mutex.Lock()
	defer pm.mutex.Unlock()

	progress, exists := pm.activeScans[scanID]
	if !exists {
		return
	}

	phaseInfo, exists := progress.Phases[phase]
	if !exists {
		return
	}

	now := time.Now()
	phaseInfo.CompletedAt = utils.Ptr(now)
	if phaseInfo.StartedAt != nil {
		phaseInfo.Duration = now.Sub(*phaseInfo.StartedAt)
	}

	if success {
		phaseInfo.Status = "completed"
		phaseInfo.Progress = 1.0
	} else {
		phaseInfo.Status = "failed"
		phaseInfo.Error = errorMsg
	}

	// Update overall progress
	progress.Progress = pm.calculateOverallProgress(progress.Phases)

	pm.broadcastProgress(scanID)
}

// GetProgress returns current progress for a scan
func (pm *ProgressManager) GetProgress(scanID string) (*interfaces.ScanProgress, error) {
	pm.mutex.RLock()
	defer pm.mutex.RUnlock()

	progress, exists := pm.activeScans[scanID]
	if !exists {
		return nil, fmt.Errorf("scan not found: %s", scanID)
	}

	// Return a copy to avoid race conditions
	progressCopy := *progress
	if progress.Phases != nil {
		progressCopy.Phases = make(map[string]*interfaces.PhaseInfo)
		for k, v := range progress.Phases {
			phaseCopy := *v
			progressCopy.Phases[k] = &phaseCopy
		}
	}

	return &progressCopy, nil
}

// GetProgressByVolume returns progress for an active scan on a volume
func (pm *ProgressManager) GetProgressByVolume(volumeID string) (*interfaces.ScanProgress, error) {
	pm.mutex.RLock()
	defer pm.mutex.RUnlock()

	scanID, exists := pm.volumeToScan[volumeID]
	if !exists {
		return nil, fmt.Errorf("no active scan for volume: %s", volumeID)
	}

	return pm.GetProgress(scanID)
}

// CleanupScan removes completed or failed scans after a delay
func (pm *ProgressManager) CleanupScan(scanID string) {
	pm.mutex.Lock()
	defer pm.mutex.Unlock()

	if progress, exists := pm.activeScans[scanID]; exists {
		delete(pm.volumeToScan, progress.VolumeID)
		delete(pm.activeScans, scanID)
	}
}

// broadcastProgress sends progress updates via WebSocket
func (pm *ProgressManager) broadcastProgress(scanID string) {
	if pm.broadcaster == nil {
		return
	}

	progress, exists := pm.activeScans[scanID]
	if !exists {
		return
	}

	// Convert in-memory progress to broadcast format
	// Calculate overall progress and prepare phase data
	phases := []map[string]interface{}{}
	overallProgress := 0.0
	totalPhases := len(progress.Phases)
	
	for phaseName, phaseInfo := range progress.Phases {
		phaseData := map[string]interface{}{
			"phase_name":      phaseName,
			"status":         phaseInfo.Status,
			"progress":       int(phaseInfo.Progress * 100), // Convert to percentage
			"items_processed": phaseInfo.ItemsProcessed,
			"items_total":    0, // ItemsTotal not available in PhaseInfo
		}
		
		if phaseInfo.StartedAt != nil {
			phaseData["started_at"] = phaseInfo.StartedAt.Format(time.RFC3339)
		}
		if phaseInfo.CompletedAt != nil {
			phaseData["completed_at"] = phaseInfo.CompletedAt.Format(time.RFC3339)
		}
		
		phases = append(phases, phaseData)
		overallProgress += phaseInfo.Progress
	}
	
	if totalPhases > 0 {
		overallProgress = (overallProgress / float64(totalPhases)) * 100
	}

	// Prepare broadcast data with actual in-memory progress
	broadcastData := map[string]interface{}{
		"scan_id":          scanID,
		"volume_id":        progress.VolumeID,
		"overall_status":   string(progress.Status),
		"overall_progress": int(overallProgress),
		"phases":          phases,
		"started_at":      progress.StartedAt.Format(time.RFC3339),
		"current_path":    progress.CurrentPath,
		"files_scanned":   progress.FilesScanned,
		"folders_scanned": progress.FoldersScanned,
		"bytes_processed": progress.BytesProcessed,
		"total_bytes":     progress.TotalBytes,
	}
	
	// Add performance stats if available
	if progress.ElapsedSeconds > 0 {
		broadcastData["performance_stats"] = map[string]interface{}{
			"elapsed_seconds": progress.ElapsedSeconds,
		}
	}

	// Use the direct broadcast method with in-memory data
	pm.broadcaster.BroadcastScanProgress(progress.VolumeID, scanID, broadcastData)
}

// Helper methods for updating different types of progress

func (pm *ProgressManager) updateVolumeScanProgress(progress *interfaces.ScanProgress, update ProgressUpdate) {
	if phase, exists := progress.Phases["volume_scan"]; exists {
		phase.Progress = update.Progress
		phase.ItemsProcessed = update.ItemsProcessed
	}

	progress.CurrentPath = update.CurrentPath
	progress.Phase = "volume_scan"
	progress.PhaseProgress = update.Progress
}

func (pm *ProgressManager) updateFilesystemIndexingProgress(progress *interfaces.ScanProgress, update ProgressUpdate) {
	if phase, exists := progress.Phases["filesystem_indexing"]; exists {
		if phase.Status == "pending" {
			now := time.Now()
			phase.Status = "running"
			phase.StartedAt = utils.Ptr(now)
		}
		phase.Progress = update.Progress
		phase.ItemsProcessed = update.ItemsProcessed
	}

	progress.CurrentPath = update.CurrentPath
	progress.Phase = "filesystem_indexing"
	progress.PhaseProgress = update.Progress
	progress.FilesScanned = update.ItemsProcessed
}

func (pm *ProgressManager) updateMediaEnrichmentProgress(progress *interfaces.ScanProgress, update ProgressUpdate) {
	if phase, exists := progress.Phases["media_enrichment"]; exists {
		if phase.Status == "pending" {
			now := time.Now()
			phase.Status = "running"
			phase.StartedAt = utils.Ptr(now)
		}
		phase.Progress = update.Progress
		phase.ItemsProcessed = update.ItemsProcessed
	}

	progress.CurrentPath = update.CurrentPath
	progress.Phase = "media_enrichment"
	progress.PhaseProgress = update.Progress
}

func (pm *ProgressManager) calculateOverallProgress(phases map[string]*interfaces.PhaseInfo) float64 {
	if phases == nil {
		return 0.0
	}

	// Weight each phase (volume_scan: 10%, filesystem_indexing: 80%, media_enrichment: 10%)
	weights := map[string]float64{
		"volume_scan":         0.1,
		"filesystem_indexing": 0.8,
		"media_enrichment":    0.1,
	}

	var totalProgress float64
	for phaseName, weight := range weights {
		if phase, exists := phases[phaseName]; exists {
			totalProgress += phase.Progress * weight
		}
	}

	return totalProgress
}

// ProgressUpdate represents a progress update from a scan method
type ProgressUpdate struct {
	Type                 string  // "volume_scan", "filesystem_indexing", "media_enrichment"
	Progress             float64 // 0.0 to 1.0
	ItemsProcessed       int64
	CurrentPath          string
	CurrentOperation     string
	SubPhase             string // "preparation", "directory_analysis", "batch_processing"
	SubPhaseProgress     int    // 0-100 progress within sub-phase
	EstimationConfidence string // "low", "medium", "high"
}
