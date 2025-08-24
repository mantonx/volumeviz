package websocket

import (
	"context"
	"log"
	"time"

	"github.com/mantonx/volumeviz/internal/models"
)

// ProgressBroadcaster handles WebSocket broadcasting of scan progress updates
type ProgressBroadcaster struct {
	hub *Hub
}

// NewProgressBroadcaster creates a new progress broadcaster
func NewProgressBroadcaster(hub *Hub) *ProgressBroadcaster {
	return &ProgressBroadcaster{
		hub: hub,
	}
}

// BroadcastProgress broadcasts scan progress update via WebSocket
func (pb *ProgressBroadcaster) BroadcastProgress(ctx context.Context, scanID string, phase *models.ScanPhase) {
	if pb.hub == nil {
		return
	}

	// Convert database model to WebSocket progress format
	progress := ConvertToComprehensiveScanProgress(scanID, []*models.ScanPhase{phase})

	// Broadcast to all clients subscribed to scan progress for this volume/scan
	pb.hub.BroadcastComprehensiveScanProgress(progress)

	log.Printf("Broadcasted scan progress update for scan %s, phase %s, progress: %d%%",
		scanID, phase.PhaseName, phase.Progress)
}

// BroadcastPhaseUpdate broadcasts scan phase update via WebSocket
func (pb *ProgressBroadcaster) BroadcastPhaseUpdate(ctx context.Context, scanID, volumeID string, phases []*models.ScanPhase) {
	if pb.hub == nil {
		return
	}

	// Convert database models to WebSocket progress format
	progress := ConvertToComprehensiveScanProgress(scanID, phases)
	progress.VolumeID = volumeID // Ensure volume ID is set

	// Broadcast comprehensive progress
	pb.hub.BroadcastComprehensiveScanProgress(progress)

	log.Printf("Broadcasted comprehensive scan progress for scan %s, volume %s with %d phases",
		scanID, volumeID, len(phases))
}

// ConvertToComprehensiveScanProgress converts database scan phases to WebSocket format
func ConvertToComprehensiveScanProgress(scanID string, phases []*models.ScanPhase) ComprehensiveScanProgress {
	progress := ComprehensiveScanProgress{
		ScanID: scanID,
		Phases: make([]ScanPhaseProgress, 0, len(phases)),
	}

	var totalProgress int
	var activePhases int
	var earliestStart *time.Time
	overallStatus := "not_started"

	for _, phase := range phases {
		if phase == nil {
			continue
		}

		phaseProgress := ScanPhaseProgress{
			PhaseName:       phase.PhaseName,
			PhaseOrder:      phase.PhaseOrder,
			Status:          phase.Status,
			Progress:        phase.Progress,
			ItemsProcessed:  phase.ItemsProcessed,
			ItemsTotal:      phase.ItemsTotal,
			ItemsSuccessful: phase.ItemsSuccessful,
			ItemsFailed:     phase.ItemsFailed,
			BytesProcessed:  phase.BytesProcessed,
			BytesTotal:      phase.BytesTotal,
			ItemsPerSecond:  phase.ItemsPerSecond,
			BytesPerSecond:  phase.BytesPerSecond,
			CurrentItem:     phase.CurrentItem,
			CurrentDepth:    phase.CurrentDepth,
			StartedAt:       phase.StartedAt,
			CompletedAt:     phase.CompletedAt,
			ErrorMessage:    phase.ErrorMessage,
			ErrorCount:      phase.ErrorCount,
		}

		// Calculate estimated completion time
		if phase.Status == "running" && phase.Progress > 0 && phase.StartedAt != nil {
			elapsed := time.Since(*phase.StartedAt)
			if phase.Progress > 0 { // Avoid division by zero
				progressRatio := float64(phase.Progress) / 100.0
				estimatedTotal := time.Duration(float64(elapsed) / progressRatio)
				estimatedEnd := phase.StartedAt.Add(estimatedTotal)
				phaseProgress.EstimatedEndTime = &estimatedEnd
			}
		}

		progress.Phases = append(progress.Phases, phaseProgress)

		// Track earliest start time
		if phase.StartedAt != nil && (earliestStart == nil || phase.StartedAt.Before(*earliestStart)) {
			earliestStart = phase.StartedAt
		}

		// Calculate overall progress and status
		totalProgress += phase.Progress

		switch phase.Status {
		case "running":
			activePhases++
			overallStatus = "running"
		case "completed":
			if overallStatus != "running" {
				overallStatus = "completed"
			}
		case "failed":
			overallStatus = "failed"
		}
	}

	// Set overall start time
	progress.StartedAt = earliestStart

	// Calculate overall progress (average of all phases)
	if len(phases) > 0 {
		progress.OverallProgress = totalProgress / len(phases)
	}

	// Set overall status
	progress.OverallStatus = overallStatus
	if activePhases > 0 {
		progress.OverallStatus = "running"
	} else if overallStatus == "completed" {
		// Check if all phases are completed
		allCompleted := true
		for _, phase := range phases {
			if phase != nil && phase.Status != "completed" {
				allCompleted = false
				break
			}
		}
		if allCompleted {
			progress.OverallStatus = "completed"
			// Find latest completion time
			var latestCompletion *time.Time
			for _, phase := range phases {
				if phase != nil && phase.CompletedAt != nil {
					if latestCompletion == nil || phase.CompletedAt.After(*latestCompletion) {
						latestCompletion = phase.CompletedAt
					}
				}
			}
			progress.CompletedAt = latestCompletion
		}
	}

	return progress
}
