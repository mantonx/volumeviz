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
}

// NewHub creates a new WebSocket hub
func NewHub() *Hub {
	return &Hub{
		broadcast:    make(chan []byte, 256),
		register:     make(chan *Client),
		unregister:   make(chan *Client),
		clients:      make(map[*Client]bool),
		messageQueue: make([]Message, 0),
		maxQueueSize: 100,
	}
}

// Run starts the hub and handles client connections and messages
func (h *Hub) Run() {
	for {
		select {
		case client := <-h.register:
			h.mu.Lock()
			h.clients[client] = true
			log.Printf("Client connected. Total clients: %d", len(h.clients))

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
				log.Printf("Client disconnected. Total clients: %d", len(h.clients))
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

// BroadcastScanProgress broadcasts scan progress updates
func (h *Hub) BroadcastScanProgress(volumeID string, progress ScanProgressData) {
	message := Message{
		Type:      MessageTypeScanProgress,
		VolumeID:  volumeID,
		Data:      progress,
		Timestamp: time.Now(),
	}
	h.BroadcastMessage(message)
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
