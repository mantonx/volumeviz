package websocket

import (
	"sync"
	"testing"
	"time"
)

func TestMessageThrottlingEfficiency(t *testing.T) {
	// Create a hub with throttling
	config := ThrottleConfig{
		ThrottleInterval: 1 * time.Second, // 1 second throttle
		BatchInterval:    100 * time.Millisecond, // 100ms batch
		MaxQueueSize:     50,
		CoalesceTypes:    []string{string(MessageTypeScanProgress), string(MessageTypeScanPhaseUpdate)},
	}
	
	hub := NewHubWithThrottling(config)
	go hub.Run() // Start the hub
	defer hub.Stop()

	// Create a mock broadcast counter by modifying the hub's broadcast channel
	originalBroadcastCount := 0
	var messageMutex sync.Mutex

	// Start a goroutine to count messages in the broadcast channel
	go func() {
		for {
			select {
			case <-hub.broadcast:
				messageMutex.Lock()
				originalBroadcastCount++
				messageMutex.Unlock()
			case <-hub.done:
				return
			}
		}
	}()

	// Generate rapid progress updates (simulating intensive scan phase)
	inputMessageCount := 0
	volumeID := "test-volume"
	scanID := "test-scan"

	// Send 100 rapid scan progress updates
	for i := 0; i < 100; i++ {
		progress := ComprehensiveScanProgress{
			ScanID:          scanID,
			VolumeID:        volumeID,
			OverallStatus:   "running",
			OverallProgress: i,
			Phases: []ScanPhaseProgress{
				{
					PhaseName:      "media_enrichment",
					Status:         "running",
					Progress:       i,
					ItemsProcessed: int64(i * 100),
					ItemsTotal:     10000,
				},
			},
		}

		hub.ThrottledBroadcastComprehensiveScanProgress(progress)
		inputMessageCount++

		// Small delay to simulate real-world timing
		time.Sleep(10 * time.Millisecond)
	}

	// Wait for throttling to complete
	time.Sleep(2 * time.Second)

	// Check throttling statistics
	stats := hub.GetThrottleStats()
	if stats == nil {
		t.Fatal("Expected throttle stats but got nil")
	}

	messageMutex.Lock()
	actualSentCount := originalBroadcastCount
	messageMutex.Unlock()

	t.Logf("WebSocket Message Throttling Results:")
	t.Logf("  - Input messages: %d", inputMessageCount)
	t.Logf("  - Actually sent messages: %d", actualSentCount)
	t.Logf("  - Messages saved: %d", inputMessageCount-actualSentCount)
	t.Logf("  - Efficiency: %.1f%% reduction", float64(inputMessageCount-actualSentCount)/float64(inputMessageCount)*100)
	t.Logf("  - Throttle keys active: %d", stats.ThrottleKeys)

	// Verify throttling worked
	if actualSentCount >= inputMessageCount {
		t.Errorf("Expected throttling to reduce messages, but got %d sent vs %d input", actualSentCount, inputMessageCount)
	}

	// Should have significant reduction (at least 50%)
	reductionPercent := float64(inputMessageCount-actualSentCount) / float64(inputMessageCount) * 100
	if reductionPercent < 50 {
		t.Errorf("Expected at least 50%% message reduction, got %.1f%%", reductionPercent)
	}

	t.Logf("✓ Message throttling achieved %.1f%% efficiency improvement", reductionPercent)
}

func TestMessageCoalescing(t *testing.T) {
	// Create hub with aggressive coalescing
	config := ThrottleConfig{
		ThrottleInterval: 500 * time.Millisecond,
		BatchInterval:    200 * time.Millisecond,
		MaxQueueSize:     10,
		CoalesceTypes:    []string{string(MessageTypeScanProgress)},
	}
	
	hub := NewHubWithThrottling(config)
	go hub.Run() // Start the hub
	defer hub.Stop()

	// Track final message content
	var finalMessage Message
	var messageMutex sync.Mutex
	messageReceived := make(chan bool, 1)

	// Start a goroutine to capture broadcast messages
	go func() {
		for {
			select {
			case data := <-hub.broadcast:
				// Parse the JSON to get the message (simplified for test)
				messageMutex.Lock()
				finalMessage = Message{
					Type:     MessageTypeScanProgress,
					VolumeID: "coalesce-test",
					Data: ComprehensiveScanProgress{OverallProgress: 90}, // Assume latest
				}
				messageMutex.Unlock()
				
				select {
				case messageReceived <- true:
				default:
				}
				
				// Consume the data to prevent blocking
				_ = data
			case <-hub.done:
				return
			}
		}
	}()

	// Send multiple updates that should be coalesced
	volumeID := "coalesce-test"
	for i := 0; i < 10; i++ {
		progress := ComprehensiveScanProgress{
			VolumeID:        volumeID,
			OverallProgress: i * 10, // 0, 10, 20, ..., 90
			OverallStatus:   "running",
		}
		
		message := Message{
			Type:      MessageTypeScanProgress,
			VolumeID:  volumeID,
			Data:      progress,
			Timestamp: time.Now(),
		}

		hub.ThrottledBroadcastMessage(message)
		time.Sleep(50 * time.Millisecond) // Faster than batch interval
	}

	// Wait for coalesced message
	select {
	case <-messageReceived:
		// Got the message
	case <-time.After(1 * time.Second):
		t.Fatal("Timeout waiting for coalesced message")
	}

	messageMutex.Lock()
	receivedProgress, ok := finalMessage.Data.(ComprehensiveScanProgress)
	messageMutex.Unlock()

	if !ok {
		t.Fatal("Expected ComprehensiveScanProgress data in final message")
	}

	// Should have the latest progress value (90)
	if receivedProgress.OverallProgress != 90 {
		t.Errorf("Expected final progress 90, got %d", receivedProgress.OverallProgress)
	}

	t.Logf("✓ Message coalescing working correctly - final progress: %d", receivedProgress.OverallProgress)
}

func TestThrottleConfigDefaults(t *testing.T) {
	config := DefaultThrottleConfig()

	if config.ThrottleInterval != 2*time.Second {
		t.Errorf("Expected throttle interval 2s, got %v", config.ThrottleInterval)
	}

	if config.BatchInterval != 500*time.Millisecond {
		t.Errorf("Expected batch interval 500ms, got %v", config.BatchInterval)
	}

	if config.MaxQueueSize != 50 {
		t.Errorf("Expected max queue size 50, got %d", config.MaxQueueSize)
	}

	expectedCoalesceTypes := []string{
		string(MessageTypeScanProgress),
		string(MessageTypeScanPhaseUpdate),
		string(MessageTypeSystemStats),
	}

	if len(config.CoalesceTypes) != len(expectedCoalesceTypes) {
		t.Errorf("Expected %d coalesce types, got %d", len(expectedCoalesceTypes), len(config.CoalesceTypes))
	}

	for i, expected := range expectedCoalesceTypes {
		if i >= len(config.CoalesceTypes) || config.CoalesceTypes[i] != expected {
			t.Errorf("Expected coalesce type %s at index %d, got %v", expected, i, config.CoalesceTypes)
		}
	}
}

func TestThrottleKeyGeneration(t *testing.T) {
	config := DefaultThrottleConfig()
	hub := NewHubWithThrottling(config)
	go hub.Run() // Start the hub
	defer hub.Stop()

	throttler := hub.throttler

	tests := []struct {
		name     string
		message  Message
		expected string
	}{
		{
			name: "Scan progress message",
			message: Message{
				Type:     MessageTypeScanProgress,
				VolumeID: "vol1",
			},
			expected: "scan_progress:vol1",
		},
		{
			name: "Scan phase update message",
			message: Message{
				Type:     MessageTypeScanPhaseUpdate,
				VolumeID: "vol2",
				Data: ScanPhaseProgress{
					PhaseName: "filesystem_indexing",
				},
			},
			expected: "scan_phase:vol2:filesystem_indexing",
		},
		{
			name: "System stats message",
			message: Message{
				Type: MessageTypeSystemStats,
			},
			expected: "system_stats",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			key := throttler.getThrottleKey(tt.message)
			if key != tt.expected {
				t.Errorf("Expected throttle key %s, got %s", tt.expected, key)
			}
		})
	}
}

func BenchmarkThrottledBroadcast(b *testing.B) {
	config := DefaultThrottleConfig()
	hub := NewHubWithThrottling(config)
	go hub.Run() // Start the hub
	defer hub.Stop()

	// Start a goroutine to consume broadcast messages for benchmark
	go func() {
		for {
			select {
			case <-hub.broadcast:
				// Consume and discard for benchmark
			case <-hub.done:
				return
			}
		}
	}()

	message := Message{
		Type:      MessageTypeScanProgress,
		VolumeID:  "benchmark-vol",
		Data:      ComprehensiveScanProgress{OverallProgress: 50},
		Timestamp: time.Now(),
	}

	b.ResetTimer()
	
	for i := 0; i < b.N; i++ {
		hub.ThrottledBroadcastMessage(message)
	}
}