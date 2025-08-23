package realtime

import (
	"context"
	"log"
	"time"

	"github.com/mantonx/volumeviz/internal/store"
	"github.com/mantonx/volumeviz/internal/websocket"
)

// ProgressBroadcaster handles real-time broadcasting of scan progress via WebSocket
type ProgressBroadcaster struct {
	hub   *websocket.Hub
	store store.Store
}

// NewProgressBroadcaster creates a new progress broadcaster
func NewProgressBroadcaster(hub *websocket.Hub, store store.Store) *ProgressBroadcaster {
	return &ProgressBroadcaster{
		hub:   hub,
		store: store,
	}
}

// BroadcastScanStarted broadcasts when a scan starts
func (pb *ProgressBroadcaster) BroadcastScanStarted(scanID, volumeID string) {
	if pb.hub == nil {
		return
	}

	message := websocket.Message{
		Type:     websocket.MessageTypeScanStarted,
		VolumeID: volumeID,
		Data: map[string]interface{}{
			"scan_id":   scanID,
			"volume_id": volumeID,
			"status":    "started",
		},
		Timestamp: time.Now(),
	}

	filters := map[string]string{
		"volume_id": volumeID,
		"scan_id":   scanID,
	}
	pb.hub.BroadcastToSubscribed("scan_progress", filters, message)
	log.Printf("broadcast scan started: %s (volume: %s)", scanID, volumeID)
}

// BroadcastComprehensiveScanProgress broadcasts comprehensive progress from database
func (pb *ProgressBroadcaster) BroadcastComprehensiveScanProgress(ctx context.Context, scanID, volumeID string) error {
	if pb.hub == nil || pb.store == nil {
		return nil
	}

	scanProgressRepo := pb.store.ScanProgress()

	// Get scan phases
	phases, err := scanProgressRepo.GetScanPhases(ctx, scanID)
	if err != nil {
		log.Printf("failed to get scan phases for broadcast: %v", err)
		return err
	}

	// Convert to WebSocket types
	wsPhases := make([]websocket.ScanPhaseProgress, len(phases))
	overallProgress := 0
	completedPhases := 0
	overallStatus := "pending"

	for i, phase := range phases {
		wsPhases[i] = websocket.ScanPhaseProgress{
			PhaseName:        phase.PhaseName,
			PhaseOrder:       phase.PhaseOrder,
			Status:           phase.Status,
			Progress:         phase.Progress,
			ItemsProcessed:   phase.ItemsProcessed,
			ItemsTotal:       phase.ItemsTotal,
			ItemsSuccessful:  phase.ItemsSuccessful,
			ItemsFailed:      phase.ItemsFailed,
			BytesProcessed:   phase.BytesProcessed,
			BytesTotal:       phase.BytesTotal,
			ItemsPerSecond:   phase.ItemsPerSecond,
			BytesPerSecond:   phase.BytesPerSecond,
			CurrentItem:      phase.CurrentItem,
			CurrentDepth:     phase.CurrentDepth,
			StartedAt:        phase.StartedAt,
			CompletedAt:      phase.CompletedAt,
			EstimatedEndTime: phase.EstimatedCompletionAt,
			ErrorMessage:     phase.ErrorMessage,
			ErrorCount:       phase.ErrorCount,
		}

		// Calculate overall progress
		overallProgress += phase.Progress
		if phase.Status == "completed" {
			completedPhases++
		}
		if phase.Status == "running" {
			overallStatus = "running"
		} else if phase.Status == "failed" && overallStatus != "running" {
			overallStatus = "failed"
		}
	}

	// Calculate weighted overall progress
	if len(phases) > 0 {
		overallProgress = overallProgress / len(phases)
	}

	if completedPhases == len(phases) && len(phases) > 0 {
		overallStatus = "completed"
		overallProgress = 100
	}

	// Get recent errors
	recentErrors, err := scanProgressRepo.GetScanErrors(ctx, scanID, "", 10, 0)
	if err != nil {
		log.Printf("failed to get scan errors for broadcast: %v", err)
		// Continue without errors - not critical
	}

	wsErrors := make([]websocket.ScanProgressError, len(recentErrors))
	for i, err := range recentErrors {
		wsErrors[i] = websocket.ScanProgressError{
			ErrorType:        err.ErrorType,
			ErrorCategory:    err.ErrorCategory,
			Severity:         err.Severity,
			Component:        err.Component,
			Operation:        err.Operation,
			ItemPath:         err.ItemPath,
			ItemName:         err.ItemName,
			ErrorMessage:     err.ErrorMessage,
			TechnicalDetails: err.TechnicalDetails,
			OccurredAt:       err.OccurredAt,
			RetryCount:       err.RetryCount,
		}
	}

	// Create comprehensive progress data
	progress := websocket.ComprehensiveScanProgress{
		ScanID:          scanID,
		VolumeID:        volumeID,
		OverallStatus:   overallStatus,
		OverallProgress: overallProgress,
		Phases:          wsPhases,
		RecentErrors:    wsErrors,
		// TODO: Add performance stats if needed
	}

	// Add timing information if available
	if len(phases) > 0 {
		if phases[0].StartedAt != nil {
			progress.StartedAt = phases[0].StartedAt
		}
		// Find the latest completion time
		for _, phase := range phases {
			if phase.CompletedAt != nil && (progress.CompletedAt == nil || phase.CompletedAt.After(*progress.CompletedAt)) {
				progress.CompletedAt = phase.CompletedAt
			}
		}
	}

	// Broadcast the comprehensive progress
	pb.hub.BroadcastComprehensiveScanProgress(progress)
	return nil
}

// BroadcastScanPhaseUpdate broadcasts individual phase updates
func (pb *ProgressBroadcaster) BroadcastScanPhaseUpdate(ctx context.Context, scanID, volumeID, phaseName string) error {
	if pb.hub == nil || pb.store == nil {
		return nil
	}

	scanProgressRepo := pb.store.ScanProgress()

	// Get specific phase data
	phases, err := scanProgressRepo.GetScanPhases(ctx, scanID)
	if err != nil {
		log.Printf("failed to get scan phase for broadcast: %v", err)
		return err
	}

	// Find the specific phase
	for _, phase := range phases {
		if phase.PhaseName == phaseName {
			wsPhase := websocket.ScanPhaseProgress{
				PhaseName:        phase.PhaseName,
				PhaseOrder:       phase.PhaseOrder,
				Status:           phase.Status,
				Progress:         phase.Progress,
				ItemsProcessed:   phase.ItemsProcessed,
				ItemsTotal:       phase.ItemsTotal,
				ItemsSuccessful:  phase.ItemsSuccessful,
				ItemsFailed:      phase.ItemsFailed,
				BytesProcessed:   phase.BytesProcessed,
				BytesTotal:       phase.BytesTotal,
				ItemsPerSecond:   phase.ItemsPerSecond,
				BytesPerSecond:   phase.BytesPerSecond,
				CurrentItem:      phase.CurrentItem,
				CurrentDepth:     phase.CurrentDepth,
				StartedAt:        phase.StartedAt,
				CompletedAt:      phase.CompletedAt,
				EstimatedEndTime: phase.EstimatedCompletionAt,
				ErrorMessage:     phase.ErrorMessage,
				ErrorCount:       phase.ErrorCount,
			}

			pb.hub.BroadcastScanPhaseUpdate(scanID, volumeID, wsPhase)
			return nil
		}
	}

	return nil
}

// BroadcastScanComplete broadcasts scan completion
func (pb *ProgressBroadcaster) BroadcastScanComplete(scanID, volumeID string) {
	if pb.hub == nil {
		return
	}

	message := websocket.Message{
		Type:     websocket.MessageTypeScanComplete,
		VolumeID: volumeID,
		Data: map[string]interface{}{
			"scan_id":   scanID,
			"volume_id": volumeID,
			"status":    "completed",
		},
		Timestamp: time.Now(),
	}

	filters := map[string]string{
		"volume_id": volumeID,
		"scan_id":   scanID,
	}
	pb.hub.BroadcastToSubscribed("scan_progress", filters, message)
	log.Printf("broadcast scan completed: %s (volume: %s)", scanID, volumeID)
}

// BroadcastScanError broadcasts scan errors
func (pb *ProgressBroadcaster) BroadcastScanError(scanID, volumeID string, errorMsg string, errorCode string) {
	if pb.hub == nil {
		return
	}

	message := websocket.Message{
		Type:     websocket.MessageTypeScanError,
		VolumeID: volumeID,
		Data: websocket.ScanErrorData{
			Error: errorMsg,
			Code:  errorCode,
		},
		Timestamp: time.Now(),
	}

	filters := map[string]string{
		"volume_id": volumeID,
		"scan_id":   scanID,
	}
	pb.hub.BroadcastToSubscribed("scan_progress", filters, message)
	log.Printf("broadcast scan error: %s (volume: %s, error: %s)", scanID, volumeID, errorMsg)
}
