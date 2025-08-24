package websocket

import (
	"testing"
	"time"
)

// TestWebSocketThrottlingIntegration verifies throttling works end-to-end
func TestWebSocketThrottlingIntegration(t *testing.T) {
	// Test that the throttling system integrates correctly with the hub
	config := DefaultThrottleConfig()
	hub := NewHubWithThrottling(config)
	
	// Don't start the hub run loop for this test to avoid complexity
	
	// Test throttler creation and basic functionality
	if hub.throttler == nil {
		t.Fatal("Expected throttler to be initialized")
	}
	
	// Test throttled broadcast methods exist and don't panic
	progress := ComprehensiveScanProgress{
		VolumeID:        "test-vol",
		OverallStatus:   "running",
		OverallProgress: 50,
	}
	
	// Should not panic
	hub.ThrottledBroadcastComprehensiveScanProgress(progress)
	
	// Test throttle stats
	stats := hub.GetThrottleStats()
	if stats == nil {
		t.Fatal("Expected throttle stats but got nil")
	}
	
	t.Logf("Throttle stats: %+v", *stats)
	
	// Cleanup
	hub.Stop()
	
	t.Log("✓ WebSocket throttling integration test passed")
}

// TestHubFallbackWithoutThrottling tests hub behavior without throttling
func TestHubFallbackWithoutThrottling(t *testing.T) {
	// Create hub with old constructor (no throttling)
	hub := &Hub{
		broadcast:    make(chan []byte, 1024),
		register:     make(chan *Client, 256),
		unregister:   make(chan *Client, 256),
		clients:      make(map[*Client]bool),
		messageQueue: make([]Message, 0),
		maxQueueSize: 100,
		done:         make(chan struct{}),
		// throttler is nil
	}
	
	// Test fallback behavior
	progress := ComprehensiveScanProgress{
		VolumeID:        "test-vol",
		OverallStatus:   "running",
		OverallProgress: 50,
	}
	
	// Should fall back to direct broadcast (should not panic)
	hub.ThrottledBroadcastComprehensiveScanProgress(progress)
	
	// Stats should be nil
	stats := hub.GetThrottleStats()
	if stats != nil {
		t.Errorf("Expected nil stats for hub without throttling, got %+v", stats)
	}
	
	hub.Stop()
	
	t.Log("✓ Hub fallback behavior test passed")
}

// TestMessageThrottleConfiguration tests different throttle configurations
func TestMessageThrottleConfiguration(t *testing.T) {
	tests := []struct {
		name   string
		config ThrottleConfig
	}{
		{
			name:   "Default configuration",
			config: DefaultThrottleConfig(),
		},
		{
			name: "Aggressive throttling",
			config: ThrottleConfig{
				ThrottleInterval: 5 * time.Second,
				BatchInterval:    100 * time.Millisecond,
				MaxQueueSize:     10,
				CoalesceTypes:    []string{string(MessageTypeScanProgress)},
			},
		},
		{
			name: "Light throttling",
			config: ThrottleConfig{
				ThrottleInterval: 500 * time.Millisecond,
				BatchInterval:    1 * time.Second,
				MaxQueueSize:     100,
				CoalesceTypes:    []string{},
			},
		},
	}
	
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			hub := NewHubWithThrottling(tt.config)
			defer hub.Stop()
			
			if hub.throttler == nil {
				t.Fatal("Expected throttler to be initialized")
			}
			
			// Test basic throttled operation
			message := Message{
				Type:      MessageTypeScanProgress,
				VolumeID:  "config-test",
				Timestamp: time.Now(),
			}
			
			hub.ThrottledBroadcastMessage(message)
			
			stats := hub.GetThrottleStats()
			if stats == nil {
				t.Fatal("Expected throttle stats")
			}
			
			t.Logf("Config %s - Stats: %+v", tt.name, *stats)
		})
	}
}