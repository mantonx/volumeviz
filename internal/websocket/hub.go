package websocket

import (
	"encoding/json"
	"log"
	"sync"
	"time"
)

// Hub maintains the set of active clients and broadcasts messages to the clients.
type Hub struct {
	// Registered clients.
	clients map[*Client]bool

	// Inbound messages from the clients.
	broadcast chan []byte

	// Register requests from the clients.
	register chan *Client

	// Unregister requests from clients.
	unregister chan *Client

	// Mutex for thread-safe operations
	mu sync.RWMutex

	// Message queue for offline clients (optional)
	messageQueue []Message
	maxQueueSize int

	// Message throttling for optimization
	throttler *MessageThrottler

	// Done channel for graceful shutdown
	done chan struct{}
}

// NewHub creates a new WebSocket hub
func NewHub() *Hub {
	return NewHubWithThrottling(DefaultThrottleConfig())
}

// NewHubWithThrottling creates a new WebSocket hub with custom throttling configuration
func NewHubWithThrottling(throttleConfig ThrottleConfig) *Hub {
	hub := &Hub{
		broadcast:    make(chan []byte, 1024), // Increased buffer for O(1) broadcast
		register:     make(chan *Client, 256),
		unregister:   make(chan *Client, 256),
		clients:      make(map[*Client]bool),
		messageQueue: make([]Message, 0),
		maxQueueSize: 100,
		done:         make(chan struct{}),
	}
	
	// Initialize message throttler
	hub.throttler = NewMessageThrottler(hub, throttleConfig)
	
	return hub
}

// Run starts the hub and handles client connections and messages
func (h *Hub) Run() {
	for {
		select {
		case client := <-h.register:
			h.mu.Lock()
			h.clients[client] = true
			log.Printf("ws %s: client registered. Total clients: %d", client.id, len(h.clients))

			// Send queued messages to newly connected client
			for _, msg := range h.messageQueue {
				client.sendMessage(msg)
			}
			h.mu.Unlock()

		case client := <-h.unregister:
			h.mu.Lock()
			if _, ok := h.clients[client]; ok {
				delete(h.clients, client)
				close(client.send)
				log.Printf("ws %s: client unregistered. Total clients: %d", client.id, len(h.clients))
			}
			h.mu.Unlock()

		case message := <-h.broadcast:
			h.mu.RLock()
			for client := range h.clients {
				select {
				case client.send <- message:
				default:
					close(client.send)
					delete(h.clients, client)
				}
			}
			h.mu.RUnlock()
		}
	}
}

// BroadcastMessage broadcasts a message to all connected clients
func (h *Hub) BroadcastMessage(message Message) {
	data, err := json.Marshal(message)
	if err != nil {
		log.Printf("error marshaling broadcast message: %v", err)
		return
	}

	// Add to message queue for offline clients
	h.mu.Lock()
	h.messageQueue = append(h.messageQueue, message)
	if len(h.messageQueue) > h.maxQueueSize {
		h.messageQueue = h.messageQueue[1:] // Remove oldest message
	}
	h.mu.Unlock()

	select {
	case h.broadcast <- data:
	default:
		log.Println("broadcast channel full, dropping message")
	}
}

// BroadcastVolumeUpdate broadcasts volume list updates
func (h *Hub) BroadcastVolumeUpdate(volumes []VolumeData) {
	message := Message{
		Type:      MessageTypeVolumeUpdate,
		Data:      volumes,
		Timestamp: time.Now(),
	}
	h.BroadcastMessage(message)
}

// BroadcastScanProgress broadcasts scan progress updates (legacy)
func (h *Hub) BroadcastScanProgress(volumeID string, progress ScanProgressData) {
	message := Message{
		Type:      MessageTypeScanProgress,
		VolumeID:  volumeID,
		Data:      progress,
		Timestamp: time.Now(),
	}
	h.BroadcastMessage(message)
}

// BroadcastComprehensiveScanProgress broadcasts comprehensive scan progress updates
func (h *Hub) BroadcastComprehensiveScanProgress(progress ComprehensiveScanProgress) {
	message := Message{
		Type:      MessageTypeScanProgress,
		VolumeID:  progress.VolumeID,
		Data:      progress,
		Timestamp: time.Now(),
	}

	// Send to clients subscribed to scan_progress with volume_id filter
	filters := map[string]string{
		"volume_id": progress.VolumeID,
		"scan_id":   progress.ScanID,
	}
	h.BroadcastToSubscribed("scan_progress", filters, message)
}

// BroadcastScanPhaseUpdate broadcasts scan phase updates
func (h *Hub) BroadcastScanPhaseUpdate(scanID, volumeID string, phase ScanPhaseProgress) {
	message := Message{
		Type:      MessageTypeScanPhaseUpdate,
		VolumeID:  volumeID,
		Data:      phase,
		Timestamp: time.Now(),
	}

	filters := map[string]string{
		"volume_id": volumeID,
		"scan_id":   scanID,
	}
	h.BroadcastToSubscribed("scan_progress", filters, message)
}

// BroadcastVolumeListUpdate broadcasts volume list updates
func (h *Hub) BroadcastVolumeListUpdate(update VolumeListUpdate) {
	message := Message{
		Type:      MessageTypeVolumeListUpdate,
		Data:      update,
		Timestamp: time.Now(),
	}
	h.BroadcastToSubscribed("volume_updates", nil, message)
}

// BroadcastSystemStats broadcasts system statistics
func (h *Hub) BroadcastSystemStats(stats SystemStats) {
	message := Message{
		Type:      MessageTypeSystemStats,
		Data:      stats,
		Timestamp: time.Now(),
	}
	h.BroadcastToSubscribed("system_stats", nil, message)
}

// BroadcastScanComplete broadcasts scan completion
func (h *Hub) BroadcastScanComplete(volumeID string, result ScanResult) {
	message := Message{
		Type:     MessageTypeScanComplete,
		VolumeID: volumeID,
		Data: ScanCompleteData{
			VolumeID: volumeID,
			Result:   result,
		},
		Timestamp: time.Now(),
	}
	h.BroadcastMessage(message)
}

// BroadcastScanError broadcasts scan errors
func (h *Hub) BroadcastScanError(volumeID string, errorMsg string, errorCode string) {
	message := Message{
		Type:     MessageTypeScanError,
		VolumeID: volumeID,
		Data: ScanErrorData{
			Error: errorMsg,
			Code:  errorCode,
		},
		Timestamp: time.Now(),
	}
	h.BroadcastMessage(message)
}

// GetClientCount returns the number of connected clients
func (h *Hub) GetClientCount() int {
	h.mu.RLock()
	defer h.mu.RUnlock()
	return len(h.clients)
}

// GetClientsMetrics returns metrics for all connected clients
func (h *Hub) GetClientsMetrics() []ClientMetrics {
	h.mu.RLock()
	defer h.mu.RUnlock()

	metrics := make([]ClientMetrics, 0, len(h.clients))
	for client := range h.clients {
		metrics = append(metrics, client.GetMetrics())
	}
	return metrics
}

// Stop gracefully shuts down the hub
func (h *Hub) Stop() {
	close(h.done)

	// Stop message throttler
	if h.throttler != nil {
		h.throttler.Stop()
	}

	// Close all client connections
	h.mu.Lock()
	for client := range h.clients {
		close(client.send)
		delete(h.clients, client)
	}
	h.mu.Unlock()

	log.Printf("WebSocket hub stopped")
}

// BroadcastToSubscribed sends messages only to clients subscribed to specific events
func (h *Hub) BroadcastToSubscribed(event string, filters map[string]string, message Message) {
	data, err := json.Marshal(message)
	if err != nil {
		log.Printf("error marshaling targeted broadcast message: %v", err)
		return
	}

	h.mu.RLock()
	defer h.mu.RUnlock()

	sentCount := 0
	for client := range h.clients {
		if client.isSubscribedTo(event, filters) {
			select {
			case client.send <- data:
				sentCount++
			default:
				// Client's send buffer is full, remove client
				close(client.send)
				delete(h.clients, client)
			}
		}
	}

	log.Printf("broadcast %s to %d subscribers (event: %s, filters: %v)",
		message.Type, sentCount, event, filters)
}

// GetSubscribedClients returns clients subscribed to a specific event
func (h *Hub) GetSubscribedClients(event string) []string {
	h.mu.RLock()
	defer h.mu.RUnlock()

	var clientIDs []string
	for client := range h.clients {
		if client.isSubscribedTo(event, nil) {
			clientIDs = append(clientIDs, client.id)
		}
	}
	return clientIDs
}

// =======================================
// Throttled Broadcast Methods
// =======================================

// ThrottledBroadcastMessage broadcasts a message with throttling optimization
func (h *Hub) ThrottledBroadcastMessage(message Message) {
	if h.throttler != nil {
		h.throttler.ThrottledBroadcastMessage(message)
	} else {
		// Fallback to direct broadcast if no throttler
		h.BroadcastMessage(message)
	}
}

// ThrottledBroadcastToSubscribed sends throttled messages only to subscribed clients
func (h *Hub) ThrottledBroadcastToSubscribed(event string, filters map[string]string, message Message) {
	if h.throttler != nil {
		h.throttler.ThrottledBroadcastToSubscribed(event, filters, message)
	} else {
		// Fallback to direct broadcast if no throttler
		h.BroadcastToSubscribed(event, filters, message)
	}
}

// ThrottledBroadcastComprehensiveScanProgress broadcasts comprehensive scan progress with throttling
func (h *Hub) ThrottledBroadcastComprehensiveScanProgress(progress ComprehensiveScanProgress) {
	message := Message{
		Type:      MessageTypeScanProgress,
		VolumeID:  progress.VolumeID,
		Data:      progress,
		Timestamp: time.Now(),
	}

	filters := map[string]string{
		"volume_id": progress.VolumeID,
		"scan_id":   progress.ScanID,
	}
	h.ThrottledBroadcastToSubscribed("scan_progress", filters, message)
}

// ThrottledBroadcastScanPhaseUpdate broadcasts scan phase updates with throttling
func (h *Hub) ThrottledBroadcastScanPhaseUpdate(scanID, volumeID string, phase ScanPhaseProgress) {
	message := Message{
		Type:      MessageTypeScanPhaseUpdate,
		VolumeID:  volumeID,
		Data:      phase,
		Timestamp: time.Now(),
	}

	filters := map[string]string{
		"volume_id": volumeID,
		"scan_id":   scanID,
	}
	h.ThrottledBroadcastToSubscribed("scan_progress", filters, message)
}

// GetThrottleStats returns statistics about message throttling
func (h *Hub) GetThrottleStats() *ThrottleStats {
	if h.throttler != nil {
		stats := h.throttler.GetThrottleStats()
		return &stats
	}
	return nil
}
