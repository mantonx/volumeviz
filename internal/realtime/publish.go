// Package realtime provides centralized event publishing for WebSocket clients
// Decouples domain logic from WebSocket internals and provides consistent event envelopes
package realtime

import (
	"log"
	"sync"
	"time"

	"github.com/mantonx/volumeviz/internal/websocket"
)

// EventType represents the type of real-time event
type EventType string

const (
	// EventTypeScanProgress indicates scan progress updates
	EventTypeScanProgress EventType = "scan_progress"
	// EventTypeScanComplete indicates scan completion
	EventTypeScanComplete EventType = "scan_complete"
	// EventTypeVolumeUpdate indicates volume state changes
	EventTypeVolumeUpdate EventType = "volume_update"
)

// EventEnvelope provides a consistent structure for all real-time events
// Following the specification: { type: string, ts: RFC3339, data: any }
type EventEnvelope struct {
	Type      EventType   `json:"type"`
	Timestamp string      `json:"ts"`
	Data      interface{} `json:"data"`
	VolumeID  string      `json:"volume_id,omitempty"`
}

// ScanProgressData represents scan progress information
type ScanProgressData struct {
	VolumeID       string    `json:"volume_id"`
	Progress       int       `json:"progress"`                  // 0-100 percentage
	CurrentSize    int64     `json:"current_size"`              // bytes processed so far
	FilesProcessed int       `json:"files_processed"`           // number of files processed
	EstimatedTotal int64     `json:"estimated_total,omitempty"` // estimated total bytes
	Method         string    `json:"method"`                    // scan method being used
	StartedAt      time.Time `json:"started_at"`                // when scan started
}

// ScanCompleteData represents scan completion information
type ScanCompleteData struct {
	VolumeID       string        `json:"volume_id"`
	TotalSize      int64         `json:"total_size"`
	FileCount      int           `json:"file_count"`
	DirectoryCount int           `json:"directory_count"`
	Method         string        `json:"method"`
	Duration       time.Duration `json:"duration"`
	ScannedAt      time.Time     `json:"scanned_at"`
}

// VolumeUpdateData represents volume state changes
type VolumeUpdateData struct {
	VolumeID    string                 `json:"volume_id"`
	VolumeName  string                 `json:"volume_name"`
	Action      string                 `json:"action"` // "created", "removed", "attached", "detached", "updated"
	ContainerID string                 `json:"container_id,omitempty"`
	Details     map[string]interface{} `json:"details,omitempty"`
}

// Publisher handles real-time event publishing with rate limiting and coalescing
type Publisher struct {
	hub             *websocket.Hub
	mu              sync.RWMutex
	progressLimiter map[string]*progressTracker
	maxProgressRate time.Duration
}

// progressTracker manages rate limiting for scan progress events
type progressTracker struct {
	lastSent      time.Time
	lastProgress  ScanProgressData
	ticker        *time.Ticker
	stopCh        chan struct{}
	pendingUpdate bool
}

// NewPublisher creates a new real-time event publisher
func NewPublisher(hub *websocket.Hub) *Publisher {
	return &Publisher{
		hub:             hub,
		progressLimiter: make(map[string]*progressTracker),
		maxProgressRate: 250 * time.Millisecond, // ~4 events per second
	}
}

// PublishScanProgress publishes scan progress events with rate limiting
// Prevents UI flooding by limiting to ~4 events per second per scan
func (p *Publisher) PublishScanProgress(data ScanProgressData) {
	p.mu.Lock()
	defer p.mu.Unlock()

	tracker, exists := p.progressLimiter[data.VolumeID]
	if !exists {
		// Create new tracker for this volume scan
		tracker = &progressTracker{
			ticker: time.NewTicker(p.maxProgressRate),
			stopCh: make(chan struct{}),
		}
		p.progressLimiter[data.VolumeID] = tracker

		// Start rate-limited publisher goroutine
		go p.progressPublisher(data.VolumeID, tracker)
	}

	// Update the latest progress data
	tracker.lastProgress = data
	tracker.pendingUpdate = true

	log.Printf("realtime: queued scan progress for volume %s: %d%% (%d files, %s)",
		data.VolumeID, data.Progress, data.FilesProcessed, data.Method)
}

// progressPublisher handles rate-limited emission of progress events
func (p *Publisher) progressPublisher(volumeID string, tracker *progressTracker) {
	defer func() {
		tracker.ticker.Stop()
		p.mu.Lock()
		delete(p.progressLimiter, volumeID)
		p.mu.Unlock()
	}()

	for {
		select {
		case <-tracker.stopCh:
			return
		case <-tracker.ticker.C:
			p.mu.RLock()
			if tracker.pendingUpdate {
				data := tracker.lastProgress
				tracker.pendingUpdate = false
				tracker.lastSent = time.Now()
				p.mu.RUnlock()

				// Emit the progress event
				p.emitEvent(EventTypeScanProgress, data, data.VolumeID)
			} else {
				p.mu.RUnlock()
			}
		}
	}
}

// PublishScanComplete publishes scan completion events and stops progress tracking
func (p *Publisher) PublishScanComplete(data ScanCompleteData) {
	// Stop progress tracking for this volume
	p.mu.Lock()
	if tracker, exists := p.progressLimiter[data.VolumeID]; exists {
		close(tracker.stopCh)
		delete(p.progressLimiter, data.VolumeID)
	}
	p.mu.Unlock()

	// Emit completion event
	p.emitEvent(EventTypeScanComplete, data, data.VolumeID)

	log.Printf("realtime: scan completed for volume %s: %d bytes, %d files, took %v",
		data.VolumeID, data.TotalSize, data.FileCount, data.Duration)
}

// PublishVolumeUpdate publishes volume state change events
func (p *Publisher) PublishVolumeUpdate(data VolumeUpdateData) {
	p.emitEvent(EventTypeVolumeUpdate, data, data.VolumeID)

	log.Printf("realtime: volume update for %s (%s): %s",
		data.VolumeName, data.VolumeID, data.Action)
}

// PublishScanError publishes scan error events and stops progress tracking
func (p *Publisher) PublishScanError(volumeID string, err error, method string) {
	// Stop progress tracking for this volume
	p.mu.Lock()
	if tracker, exists := p.progressLimiter[volumeID]; exists {
		close(tracker.stopCh)
		delete(p.progressLimiter, volumeID)
	}
	p.mu.Unlock()

	errorData := map[string]interface{}{
		"volume_id": volumeID,
		"error":     err.Error(),
		"method":    method,
		"timestamp": time.Now(),
	}

	// Convert to WebSocket message format
	wsMessage := websocket.Message{
		Type:      websocket.MessageTypeScanError,
		Data:      errorData,
		VolumeID:  volumeID,
		Timestamp: time.Now(),
	}

	p.hub.BroadcastMessage(wsMessage)

	log.Printf("realtime: scan error for volume %s (%s): %v", volumeID, method, err)
}

// emitEvent creates and broadcasts a WebSocket message with the event envelope
func (p *Publisher) emitEvent(eventType EventType, data interface{}, volumeID string) {
	envelope := EventEnvelope{
		Type:      eventType,
		Timestamp: time.Now().Format(time.RFC3339),
		Data:      data,
		VolumeID:  volumeID,
	}

	// Convert to WebSocket message format
	var wsType websocket.MessageType
	switch eventType {
	case EventTypeScanProgress:
		wsType = websocket.MessageTypeScanProgress
	case EventTypeScanComplete:
		wsType = websocket.MessageTypeScanComplete
	case EventTypeVolumeUpdate:
		wsType = websocket.MessageTypeVolumeUpdate
	default:
		log.Printf("realtime: unknown event type: %s", eventType)
		return
	}

	wsMessage := websocket.Message{
		Type:      wsType,
		Data:      envelope.Data,
		VolumeID:  envelope.VolumeID,
		Timestamp: time.Now(),
	}

	p.hub.BroadcastMessage(wsMessage)
}

// Stop cleanly shuts down the publisher and all progress trackers
func (p *Publisher) Stop() {
	p.mu.Lock()
	defer p.mu.Unlock()

	for volumeID, tracker := range p.progressLimiter {
		close(tracker.stopCh)
		log.Printf("realtime: stopped progress tracking for volume %s", volumeID)
	}
	p.progressLimiter = make(map[string]*progressTracker)

	log.Printf("realtime: publisher stopped")
}

// GetActiveScans returns the list of volume IDs currently being tracked for progress
func (p *Publisher) GetActiveScans() []string {
	p.mu.RLock()
	defer p.mu.RUnlock()

	scans := make([]string, 0, len(p.progressLimiter))
	for volumeID := range p.progressLimiter {
		scans = append(scans, volumeID)
	}
	return scans
}
