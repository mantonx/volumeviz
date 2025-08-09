package realtime

import (
	"errors"
	"testing"
	"time"

	"github.com/mantonx/volumeviz/internal/websocket"
)

func TestNewPublisher(t *testing.T) {
	hub := websocket.NewHub()
	publisher := NewPublisher(hub)

	if publisher == nil {
		t.Fatal("Expected publisher to be created, got nil")
	}

	if publisher.hub != hub {
		t.Error("Expected publisher to have correct hub reference")
	}

	if publisher.progressLimiter == nil {
		t.Error("Expected progress limiter to be initialized")
	}

	if publisher.maxProgressRate != 250*time.Millisecond {
		t.Errorf("Expected max progress rate to be 250ms, got %v", publisher.maxProgressRate)
	}
}

func TestPublishScanComplete(t *testing.T) {
	hub := websocket.NewHub()
	go hub.Run()
	defer hub.Stop()

	publisher := NewPublisher(hub)
	defer publisher.Stop()

	data := ScanCompleteData{
		VolumeID:       "test-volume-1",
		TotalSize:      1024000,
		FileCount:      150,
		DirectoryCount: 10,
		Method:         "diskus",
		Duration:       5 * time.Second,
		ScannedAt:      time.Now(),
	}

	// Should not panic
	publisher.PublishScanComplete(data)

	// Verify no active scans after completion
	activeScans := publisher.GetActiveScans()
	if len(activeScans) != 0 {
		t.Errorf("Expected no active scans after completion, got %d", len(activeScans))
	}
}

func TestPublishVolumeUpdate(t *testing.T) {
	hub := websocket.NewHub()
	go hub.Run()
	defer hub.Stop()

	publisher := NewPublisher(hub)
	defer publisher.Stop()

	data := VolumeUpdateData{
		VolumeID:    "vol-123",
		VolumeName:  "test-volume",
		Action:      "attached",
		ContainerID: "container-456",
		Details: map[string]interface{}{
			"mount_point": "/data",
		},
	}

	// Should not panic
	publisher.PublishVolumeUpdate(data)
}

func TestPublishScanError(t *testing.T) {
	hub := websocket.NewHub()
	go hub.Run()
	defer hub.Stop()

	publisher := NewPublisher(hub)
	defer publisher.Stop()

	volumeID := "test-volume-error"
	err := errors.New("permission denied")
	method := "diskus"

	// Should not panic
	publisher.PublishScanError(volumeID, err, method)
}

func TestProgressRateLimiting(t *testing.T) {
	hub := websocket.NewHub()
	go hub.Run()
	defer hub.Stop()

	publisher := NewPublisher(hub)
	defer publisher.Stop()

	volumeID := "test-volume-rate-limit"

	// Send multiple rapid progress updates
	for i := 0; i < 10; i++ {
		data := ScanProgressData{
			VolumeID:       volumeID,
			Progress:       i * 10,
			CurrentSize:    int64(i * 1000),
			FilesProcessed: i * 5,
			Method:         "diskus",
			StartedAt:      time.Now(),
		}

		publisher.PublishScanProgress(data)
	}

	// Verify scan is being tracked
	activeScans := publisher.GetActiveScans()
	if len(activeScans) != 1 {
		t.Errorf("Expected 1 active scan, got %d", len(activeScans))
	}

	if activeScans[0] != volumeID {
		t.Errorf("Expected active scan for %s, got %s", volumeID, activeScans[0])
	}

	// Wait for rate limiter to process some events
	time.Sleep(600 * time.Millisecond)

	// Complete the scan to clean up
	completeData := ScanCompleteData{
		VolumeID:  volumeID,
		TotalSize: 10000,
		FileCount: 50,
		Method:    "diskus",
		Duration:  1 * time.Second,
		ScannedAt: time.Now(),
	}

	publisher.PublishScanComplete(completeData)

	// Verify tracking stopped
	activeScans = publisher.GetActiveScans()
	if len(activeScans) != 0 {
		t.Errorf("Expected no active scans after completion, got %d", len(activeScans))
	}
}

func TestConcurrentScans(t *testing.T) {
	hub := websocket.NewHub()
	go hub.Run()
	defer hub.Stop()

	publisher := NewPublisher(hub)
	defer publisher.Stop()

	// Start multiple concurrent scans
	volumeIDs := []string{"vol-1", "vol-2", "vol-3"}

	for _, volumeID := range volumeIDs {
		data := ScanProgressData{
			VolumeID:       volumeID,
			Progress:       25,
			CurrentSize:    2500,
			FilesProcessed: 10,
			Method:         "diskus",
			StartedAt:      time.Now(),
		}

		publisher.PublishScanProgress(data)
	}

	// Verify all scans are being tracked
	activeScans := publisher.GetActiveScans()
	if len(activeScans) != len(volumeIDs) {
		t.Errorf("Expected %d active scans, got %d", len(volumeIDs), len(activeScans))
	}

	// Complete all scans
	for _, volumeID := range volumeIDs {
		completeData := ScanCompleteData{
			VolumeID:  volumeID,
			TotalSize: 10000,
			FileCount: 50,
			Method:    "diskus",
			Duration:  1 * time.Second,
			ScannedAt: time.Now(),
		}

		publisher.PublishScanComplete(completeData)
	}

	// Verify all tracking stopped
	activeScans = publisher.GetActiveScans()
	if len(activeScans) != 0 {
		t.Errorf("Expected no active scans after all completions, got %d", len(activeScans))
	}
}

func TestPublisherStop(t *testing.T) {
	hub := websocket.NewHub()
	go hub.Run()
	defer hub.Stop()

	publisher := NewPublisher(hub)

	// Start some scans
	volumeIDs := []string{"vol-1", "vol-2"}
	for _, volumeID := range volumeIDs {
		data := ScanProgressData{
			VolumeID:       volumeID,
			Progress:       50,
			CurrentSize:    5000,
			FilesProcessed: 25,
			Method:         "diskus",
			StartedAt:      time.Now(),
		}

		publisher.PublishScanProgress(data)
	}

	// Verify scans are active
	activeScans := publisher.GetActiveScans()
	if len(activeScans) != 2 {
		t.Errorf("Expected 2 active scans before stop, got %d", len(activeScans))
	}

	// Stop publisher
	publisher.Stop()

	// Verify all tracking stopped
	activeScans = publisher.GetActiveScans()
	if len(activeScans) != 0 {
		t.Errorf("Expected no active scans after stop, got %d", len(activeScans))
	}
}

func TestEventEnvelope(t *testing.T) {
	envelope := EventEnvelope{
		Type:      EventTypeScanProgress,
		Timestamp: time.Now().Format(time.RFC3339),
		Data: ScanProgressData{
			VolumeID:       "test-vol",
			Progress:       75,
			CurrentSize:    7500,
			FilesProcessed: 37,
			Method:         "diskus",
			StartedAt:      time.Now(),
		},
		VolumeID: "test-vol",
	}

	if envelope.Type != EventTypeScanProgress {
		t.Errorf("Expected event type %s, got %s", EventTypeScanProgress, envelope.Type)
	}

	if envelope.VolumeID != "test-vol" {
		t.Errorf("Expected volume ID 'test-vol', got %s", envelope.VolumeID)
	}

	if envelope.Timestamp == "" {
		t.Error("Expected timestamp to be set")
	}

	if envelope.Data == nil {
		t.Error("Expected data to be set")
	}
}
