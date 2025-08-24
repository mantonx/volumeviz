package websocket

import (
	"context"
	"log"
	"sync"
	"time"
)

// MessageThrottler provides intelligent message throttling and coalescing for WebSocket broadcasts
type MessageThrottler struct {
	hub *Hub

	// Throttling configuration
	throttleInterval   time.Duration // Minimum time between messages for same key
	batchInterval      time.Duration // Time to wait for batching messages
	maxQueueSize       int           // Maximum queued messages per throttle key
	coalesceTypes      map[string]bool // Message types that should be coalesced

	// Internal state
	throttleCache      map[string]time.Time        // throttle key -> last sent time
	pendingMessages    map[string][]Message        // throttle key -> pending messages
	coalescingMessages map[string]Message          // throttle key -> latest message for coalescing
	batchTimers        map[string]*time.Timer      // throttle key -> batch timer
	mu                 sync.RWMutex
	ctx                context.Context
	cancel             context.CancelFunc
}

// ThrottleConfig contains configuration for message throttling
type ThrottleConfig struct {
	ThrottleInterval   time.Duration `json:"throttle_interval"`   // Default: 2 seconds
	BatchInterval      time.Duration `json:"batch_interval"`      // Default: 500ms
	MaxQueueSize       int           `json:"max_queue_size"`      // Default: 50
	CoalesceTypes      []string      `json:"coalesce_types"`      // Message types to coalesce
}

// DefaultThrottleConfig returns sensible defaults for WebSocket message throttling
func DefaultThrottleConfig() ThrottleConfig {
	return ThrottleConfig{
		ThrottleInterval: 2 * time.Second,
		BatchInterval:    500 * time.Millisecond,
		MaxQueueSize:     50,
		CoalesceTypes: []string{
			string(MessageTypeScanProgress),
			string(MessageTypeScanPhaseUpdate),
			string(MessageTypeSystemStats),
		},
	}
}

// NewMessageThrottler creates a new message throttler for WebSocket optimization
func NewMessageThrottler(hub *Hub, config ThrottleConfig) *MessageThrottler {
	ctx, cancel := context.WithCancel(context.Background())
	
	coalesceMap := make(map[string]bool)
	for _, msgType := range config.CoalesceTypes {
		coalesceMap[msgType] = true
	}

	throttler := &MessageThrottler{
		hub:                hub,
		throttleInterval:   config.ThrottleInterval,
		batchInterval:      config.BatchInterval,
		maxQueueSize:       config.MaxQueueSize,
		coalesceTypes:      coalesceMap,
		throttleCache:      make(map[string]time.Time),
		pendingMessages:    make(map[string][]Message),
		coalescingMessages: make(map[string]Message),
		batchTimers:        make(map[string]*time.Timer),
		ctx:                ctx,
		cancel:             cancel,
	}

	return throttler
}

// ThrottledBroadcastMessage intelligently throttles and coalesces messages before broadcasting
func (t *MessageThrottler) ThrottledBroadcastMessage(message Message) {
	t.mu.Lock()
	defer t.mu.Unlock()

	throttleKey := t.getThrottleKey(message)
	now := time.Now()

	// Check if this message type should be coalesced
	if t.coalesceTypes[string(message.Type)] {
		t.coalescingMessages[throttleKey] = message
		t.scheduleBatchSend(throttleKey)
		return
	}

	// Check throttling
	if lastSent, exists := t.throttleCache[throttleKey]; exists {
		if now.Sub(lastSent) < t.throttleInterval {
			// Add to pending queue
			t.addToPendingQueue(throttleKey, message)
			t.scheduleBatchSend(throttleKey)
			return
		}
	}

	// Send immediately if not throttled
	t.sendMessageNow(throttleKey, message)
}

// ThrottledBroadcastToSubscribed throttles targeted broadcasts
func (t *MessageThrottler) ThrottledBroadcastToSubscribed(event string, filters map[string]string, message Message) {
	t.mu.Lock()
	defer t.mu.Unlock()

	throttleKey := t.getTargetedThrottleKey(event, filters, message)
	now := time.Now()

	// Check if this message type should be coalesced
	if t.coalesceTypes[string(message.Type)] {
		t.coalescingMessages[throttleKey] = message
		t.scheduleTargetedBatchSend(throttleKey, event, filters)
		return
	}

	// Check throttling
	if lastSent, exists := t.throttleCache[throttleKey]; exists {
		if now.Sub(lastSent) < t.throttleInterval {
			// Store the targeted broadcast info with the message
			message.targetedBroadcast = &targetedBroadcastInfo{
				event:   event,
				filters: filters,
			}
			t.addToPendingQueue(throttleKey, message)
			t.scheduleTargetedBatchSend(throttleKey, event, filters)
			return
		}
	}

	// Send immediately if not throttled
	t.sendTargetedMessageNow(throttleKey, event, filters, message)
}

// getThrottleKey generates a unique key for throttling based on message content
func (t *MessageThrottler) getThrottleKey(message Message) string {
	switch message.Type {
	case MessageTypeScanProgress:
		return "scan_progress:" + message.VolumeID
	case MessageTypeScanPhaseUpdate:
		if data, ok := message.Data.(ScanPhaseProgress); ok {
			return "scan_phase:" + message.VolumeID + ":" + data.PhaseName
		}
		return "scan_phase:" + message.VolumeID
	case MessageTypeSystemStats:
		return "system_stats"
	case MessageTypeVolumeUpdate:
		return "volume_update:" + message.VolumeID
	case MessageTypeVolumeListUpdate:
		return "volume_list_update"
	default:
		return string(message.Type) + ":" + message.VolumeID
	}
}

// getTargetedThrottleKey generates throttle key for targeted broadcasts
func (t *MessageThrottler) getTargetedThrottleKey(event string, filters map[string]string, message Message) string {
	key := event + ":" + string(message.Type)
	if volumeID, ok := filters["volume_id"]; ok {
		key += ":" + volumeID
	}
	if scanID, ok := filters["scan_id"]; ok {
		key += ":" + scanID
	}
	return key
}

// addToPendingQueue adds a message to the pending queue with size limits
func (t *MessageThrottler) addToPendingQueue(throttleKey string, message Message) {
	if _, exists := t.pendingMessages[throttleKey]; !exists {
		t.pendingMessages[throttleKey] = make([]Message, 0)
	}

	queue := t.pendingMessages[throttleKey]
	if len(queue) >= t.maxQueueSize {
		// Remove oldest message to make room
		queue = queue[1:]
		log.Printf("WebSocket throttler: dropping oldest message for key %s (queue full)", throttleKey)
	}

	queue = append(queue, message)
	t.pendingMessages[throttleKey] = queue
}

// scheduleBatchSend schedules a batch send for the throttle key
func (t *MessageThrottler) scheduleBatchSend(throttleKey string) {
	// Cancel existing timer if present
	if timer, exists := t.batchTimers[throttleKey]; exists {
		timer.Stop()
	}

	// Schedule new batch send
	t.batchTimers[throttleKey] = time.AfterFunc(t.batchInterval, func() {
		t.executeBatchSend(throttleKey)
	})
}

// scheduleTargetedBatchSend schedules a batch send for targeted broadcasts
func (t *MessageThrottler) scheduleTargetedBatchSend(throttleKey, event string, filters map[string]string) {
	// Cancel existing timer if present
	if timer, exists := t.batchTimers[throttleKey]; exists {
		timer.Stop()
	}

	// Schedule new batch send
	t.batchTimers[throttleKey] = time.AfterFunc(t.batchInterval, func() {
		t.executeTargetedBatchSend(throttleKey, event, filters)
	})
}

// executeBatchSend processes queued messages for a throttle key
func (t *MessageThrottler) executeBatchSend(throttleKey string) {
	t.mu.Lock()
	defer t.mu.Unlock()

	// Send coalesced message if available
	if coalescedMsg, exists := t.coalescingMessages[throttleKey]; exists {
		t.sendMessageNow(throttleKey, coalescedMsg)
		delete(t.coalescingMessages, throttleKey)
	}

	// Send pending messages
	if pendingMsgs, exists := t.pendingMessages[throttleKey]; exists && len(pendingMsgs) > 0 {
		// For efficiency, send the most recent message if coalescing is enabled for this type
		if t.coalesceTypes[string(pendingMsgs[0].Type)] && len(pendingMsgs) > 1 {
			t.sendMessageNow(throttleKey, pendingMsgs[len(pendingMsgs)-1])
		} else {
			// Send all pending messages
			for _, msg := range pendingMsgs {
				t.hub.BroadcastMessage(msg)
			}
			t.throttleCache[throttleKey] = time.Now()
		}
		delete(t.pendingMessages, throttleKey)
	}

	// Clean up timer
	delete(t.batchTimers, throttleKey)
}

// executeTargetedBatchSend processes queued targeted messages for a throttle key
func (t *MessageThrottler) executeTargetedBatchSend(throttleKey, event string, filters map[string]string) {
	t.mu.Lock()
	defer t.mu.Unlock()

	// Send coalesced message if available
	if coalescedMsg, exists := t.coalescingMessages[throttleKey]; exists {
		t.sendTargetedMessageNow(throttleKey, event, filters, coalescedMsg)
		delete(t.coalescingMessages, throttleKey)
	}

	// Send pending messages
	if pendingMsgs, exists := t.pendingMessages[throttleKey]; exists && len(pendingMsgs) > 0 {
		// For efficiency, send the most recent message if coalescing is enabled for this type
		if t.coalesceTypes[string(pendingMsgs[0].Type)] && len(pendingMsgs) > 1 {
			msg := pendingMsgs[len(pendingMsgs)-1]
			if msg.targetedBroadcast != nil {
				t.hub.BroadcastToSubscribed(msg.targetedBroadcast.event, msg.targetedBroadcast.filters, msg)
			}
		} else {
			// Send all pending messages
			for _, msg := range pendingMsgs {
				if msg.targetedBroadcast != nil {
					t.hub.BroadcastToSubscribed(msg.targetedBroadcast.event, msg.targetedBroadcast.filters, msg)
				}
			}
		}
		t.throttleCache[throttleKey] = time.Now()
		delete(t.pendingMessages, throttleKey)
	}

	// Clean up timer
	delete(t.batchTimers, throttleKey)
}

// sendMessageNow sends a message immediately and updates throttle cache
func (t *MessageThrottler) sendMessageNow(throttleKey string, message Message) {
	t.hub.BroadcastMessage(message)
	t.throttleCache[throttleKey] = time.Now()
}

// sendTargetedMessageNow sends a targeted message immediately and updates throttle cache
func (t *MessageThrottler) sendTargetedMessageNow(throttleKey, event string, filters map[string]string, message Message) {
	t.hub.BroadcastToSubscribed(event, filters, message)
	t.throttleCache[throttleKey] = time.Now()
}

// GetThrottleStats returns statistics about throttling performance
func (t *MessageThrottler) GetThrottleStats() ThrottleStats {
	t.mu.RLock()
	defer t.mu.RUnlock()

	pendingCount := 0
	for _, queue := range t.pendingMessages {
		pendingCount += len(queue)
	}

	return ThrottleStats{
		ThrottleKeys:       len(t.throttleCache),
		PendingMessages:    pendingCount,
		CoalescingMessages: len(t.coalescingMessages),
		ActiveTimers:       len(t.batchTimers),
	}
}

// Stop gracefully shuts down the message throttler
func (t *MessageThrottler) Stop() {
	t.cancel()
	
	t.mu.Lock()
	defer t.mu.Unlock()

	// Stop all timers
	for _, timer := range t.batchTimers {
		timer.Stop()
	}

	// Send any remaining messages immediately
	for throttleKey := range t.coalescingMessages {
		t.executeBatchSend(throttleKey)
	}

	log.Printf("WebSocket message throttler stopped")
}

// ThrottleStats contains statistics about throttling performance
type ThrottleStats struct {
	ThrottleKeys       int `json:"throttle_keys"`
	PendingMessages    int `json:"pending_messages"`
	CoalescingMessages int `json:"coalescing_messages"`
	ActiveTimers       int `json:"active_timers"`
}