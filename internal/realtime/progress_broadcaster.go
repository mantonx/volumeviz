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

	// Calculate performance statistics
	var performanceStats *websocket.ScanPerformanceStats
	if len(phases) > 0 {
		var startedAt *time.Time
		var completedAt *time.Time
		
		// Find earliest start time and latest completion time
		for _, phase := range phases {
			if phase.StartedAt != nil && (startedAt == nil || phase.StartedAt.Before(*startedAt)) {
				startedAt = phase.StartedAt
			}
			if phase.CompletedAt != nil && (completedAt == nil || phase.CompletedAt.After(*completedAt)) {
				completedAt = phase.CompletedAt
			}
		}
		
		if startedAt != nil {
			var elapsedSeconds int
			var estimatedRemainingSeconds int
			
			if overallStatus == "completed" && completedAt != nil {
				elapsedSeconds = int(completedAt.Sub(*startedAt).Seconds())
			} else {
				elapsedSeconds = int(time.Since(*startedAt).Seconds())
			}
			
			// Calculate estimated remaining time based on progress
			if overallProgress > 0 && overallStatus == "running" {
				totalEstimatedSeconds := float64(elapsedSeconds) * 100.0 / float64(overallProgress)
				estimatedRemainingSeconds = int(totalEstimatedSeconds) - elapsedSeconds
				if estimatedRemainingSeconds < 0 {
					estimatedRemainingSeconds = 0
				}
			}
			
			// Calculate aggregate performance metrics
			var totalItemsProcessed int64
			var totalBytesProcessed int64
			var totalItemsPerSecond float64
			var totalBytesPerSecond int64
			var errorCount int64
			
			for _, phase := range phases {
				totalItemsProcessed += phase.ItemsProcessed
				totalBytesProcessed += phase.BytesProcessed
				totalItemsPerSecond += phase.ItemsPerSecond
				totalBytesPerSecond += phase.BytesPerSecond
				errorCount += int64(phase.ErrorCount)
			}
			
			// Calculate error rate (errors per minute)
			errorRate := 0.0
			if elapsedSeconds > 0 {
				errorRate = float64(errorCount) * 60.0 / float64(elapsedSeconds)
			}
			
			performanceStats = &websocket.ScanPerformanceStats{
				ElapsedSeconds:            elapsedSeconds,
				EstimatedRemainingSeconds: estimatedRemainingSeconds,
				OverallItemsPerSecond:     totalItemsPerSecond,
				OverallBytesPerSecond:     totalBytesPerSecond,
				ErrorRate:                 errorRate,
				// TODO: Add memory/CPU stats if available
			}
		}
	}

	// Create comprehensive progress data
	progress := websocket.ComprehensiveScanProgress{
		ScanID:           scanID,
		VolumeID:         volumeID,
		OverallStatus:    overallStatus,
		OverallProgress:  overallProgress,
		Phases:           wsPhases,
		RecentErrors:     wsErrors,
		PerformanceStats: performanceStats,
	}
	
	// Add timing information from phases
	if len(phases) > 0 {
		// Use earliest start time
		for _, phase := range phases {
			if phase.StartedAt != nil && (progress.StartedAt == nil || phase.StartedAt.Before(*progress.StartedAt)) {
				progress.StartedAt = phase.StartedAt
			}
		}
		// Use latest completion time
		for _, phase := range phases {
			if phase.CompletedAt != nil && (progress.CompletedAt == nil || phase.CompletedAt.After(*progress.CompletedAt)) {
				progress.CompletedAt = phase.CompletedAt
			}
		}
	}


	// Broadcast the comprehensive progress with throttling
	message := websocket.Message{
		Type:      websocket.MessageTypeScanProgress,
		VolumeID:  volumeID,
		Data:      progress,
		Timestamp: time.Now(),
	}
	
	filters := map[string]string{
		"volume_id": volumeID,
		"scan_id":   scanID,
	}
	
	pb.hub.ThrottledBroadcastToSubscribed("scan_progress", filters, message)
	log.Printf("Broadcasted comprehensive scan progress for scan %s, volume %s (phases: %d, overall: %d%%)", 
		scanID, volumeID, len(progress.Phases), progress.OverallProgress)
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

			pb.hub.ThrottledBroadcastScanPhaseUpdate(scanID, volumeID, wsPhase)
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
