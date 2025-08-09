package websocket

import (
	"testing"
	"time"
)

func TestNewHub(t *testing.T) {
	hub := NewHub()

	if hub == nil {
		t.Fatal("Expected hub to be created, got nil")
	}

	if hub.clients == nil {
		t.Error("Expected clients map to be initialized")
	}

	if hub.broadcast == nil {
		t.Error("Expected broadcast channel to be initialized")
	}

	if hub.register == nil {
		t.Error("Expected register channel to be initialized")
	}

	if hub.unregister == nil {
		t.Error("Expected unregister channel to be initialized")
	}

	if hub.done == nil {
		t.Error("Expected done channel to be initialized")
	}
}

func TestHubClientCount(t *testing.T) {
	hub := NewHub()

	// Initially no clients
	if count := hub.GetClientCount(); count != 0 {
		t.Errorf("Expected 0 clients initially, got %d", count)
	}
}

func TestHubBroadcastVolumeUpdate(t *testing.T) {
	hub := NewHub()
	go hub.Run()
	defer hub.Stop()

	volumes := []VolumeData{
		{
			ID:         "vol-1",
			Name:       "test-volume",
			Driver:     "local",
			Mountpoint: "/var/lib/docker/volumes/test-volume/_data",
			CreatedAt:  time.Now(),
		},
	}

	// This should not panic even with no clients
	hub.BroadcastVolumeUpdate(volumes)
}

func TestHubBroadcastScanProgress(t *testing.T) {
	hub := NewHub()
	go hub.Run()
	defer hub.Stop()

	progress := ScanProgressData{
		Progress:       50,
		CurrentSize:    1024,
		FilesProcessed: 100,
	}

	// This should not panic even with no clients
	hub.BroadcastScanProgress("vol-1", progress)
}

func TestHubBroadcastScanComplete(t *testing.T) {
	hub := NewHub()
	go hub.Run()
	defer hub.Stop()

	result := ScanResult{
		TotalSize:      2048,
		FileCount:      200,
		DirectoryCount: 10,
		ScannedAt:      time.Now(),
		Method:         "fast",
		Duration:       5 * time.Second,
	}

	// This should not panic even with no clients
	hub.BroadcastScanComplete("vol-1", result)
}

func TestHubBroadcastScanError(t *testing.T) {
	hub := NewHub()
	go hub.Run()
	defer hub.Stop()

	// This should not panic even with no clients
	hub.BroadcastScanError("vol-1", "scan failed", "SCAN_ERROR")
}

func TestHubStop(t *testing.T) {
	hub := NewHub()
	go hub.Run()

	// Stop should not panic
	hub.Stop()

	// GetClientCount should still work after stop
	count := hub.GetClientCount()
	if count != 0 {
		t.Errorf("Expected 0 clients after stop, got %d", count)
	}
}

func TestHubMessageQueue(t *testing.T) {
	hub := NewHub()

	// Test message queue initialization
	if hub.messageQueue == nil {
		t.Error("Expected message queue to be initialized")
	}

	if hub.maxQueueSize <= 0 {
		t.Error("Expected positive max queue size")
	}

	if len(hub.messageQueue) != 0 {
		t.Error("Expected empty message queue initially")
	}
}

func TestHubBroadcastMessage(t *testing.T) {
	hub := NewHub()
	go hub.Run()
	defer hub.Stop()

	message := Message{
		Type:      MessageTypeVolumeUpdate,
		Data:      "test data",
		Timestamp: time.Now(),
	}

	// Should not panic with no clients
	hub.BroadcastMessage(message)

	// Check that message was added to queue
	if len(hub.messageQueue) != 1 {
		t.Errorf("Expected 1 message in queue, got %d", len(hub.messageQueue))
	}

	if hub.messageQueue[0].Type != MessageTypeVolumeUpdate {
		t.Error("Message not correctly added to queue")
	}
}
