package realtime

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"sync"
	"time"

	"github.com/mantonx/volumeviz/internal/store"
	"nhooyr.io/websocket"
	"nhooyr.io/websocket/wsjson"
)

// Hub represents a WebSocket hub with room-based subscriptions
type Hub struct {
	// Connection management
	connections map[string]*Connection
	rooms       map[string]map[string]*Connection // room -> connection_id -> connection
	mutex       sync.RWMutex

	// Channels for hub operations
	register   chan *Connection
	unregister chan *Connection
	broadcast  chan BroadcastMessage

	// Configuration
	pingInterval time.Duration
	pongWait     time.Duration
	
	// Store for querying volume data
	store store.Store
}

// Connection represents a WebSocket connection with metadata
type Connection struct {
	ID       string
	WS       *websocket.Conn
	Send     chan RealtimeMessage
	Rooms    map[string]bool // rooms this connection is subscribed to
	Context  context.Context
	Cancel   context.CancelFunc
	LastSeen time.Time
}

// RealtimeMessage represents the standard message format for all WebSocket communication
type RealtimeMessage struct {
	Type      string                 `json:"type"`
	Data      interface{}            `json:"data"`
	Timestamp time.Time              `json:"timestamp"`
	Room      string                 `json:"room,omitempty"`
	Metadata  map[string]interface{} `json:"metadata,omitempty"`
}

// BroadcastMessage represents a message to be broadcast to a room
type BroadcastMessage struct {
	Room    string
	Message RealtimeMessage
}

// SubscriptionMessage represents a client subscription request
type SubscriptionMessage struct {
	Action   string                 `json:"action"` // "subscribe" or "unsubscribe"
	Event    string                 `json:"event"`  // "scan.progress", "volume.updates", etc.
	Filters  map[string]interface{} `json:"filters,omitempty"`
	Metadata map[string]interface{} `json:"metadata,omitempty"`
}

// NewHub creates a new WebSocket hub with clean architecture
func NewHub(store store.Store) *Hub {
	return &Hub{
		connections:  make(map[string]*Connection),
		rooms:        make(map[string]map[string]*Connection),
		register:     make(chan *Connection, 256),
		unregister:   make(chan *Connection, 256),
		broadcast:    make(chan BroadcastMessage, 1024),
		pingInterval: time.Second * 30,
		pongWait:     time.Second * 60,
		store:        store,
	}
}

// Run starts the hub's main loop
func (h *Hub) Run(ctx context.Context) {
	defer func() {
		log.Println("[WEBSOCKET-HUB] Hub stopped")
	}()

	// Start periodic cleanup
	cleanupTicker := time.NewTicker(time.Minute * 5)
	defer cleanupTicker.Stop()

	// Start periodic volume state broadcasting
	volumeStateTicker := time.NewTicker(time.Second * 10) // Every 10 seconds
	defer volumeStateTicker.Stop()

	log.Println("[WEBSOCKET-HUB] Hub started with periodic volume state broadcasting")

	for {
		select {
		case conn := <-h.register:
			h.handleRegister(conn)

		case conn := <-h.unregister:
			h.handleUnregister(conn)

		case message := <-h.broadcast:
			h.handleBroadcast(message)

		case <-cleanupTicker.C:
			h.cleanupStaleConnections()

		case <-volumeStateTicker.C:
			h.broadcastCurrentVolumeStates()

		case <-ctx.Done():
			h.shutdown()
			return
		}
	}
}

// handleRegister registers a new connection
func (h *Hub) handleRegister(conn *Connection) {
	h.mutex.Lock()
	defer h.mutex.Unlock()

	h.connections[conn.ID] = conn
	conn.LastSeen = time.Now()
	
	log.Printf("[WEBSOCKET-HUB] Client registered: %s (total: %d)", conn.ID, len(h.connections))

	// Send welcome message
	welcomeMsg := RealtimeMessage{
		Type:      "system.connected",
		Timestamp: time.Now(),
		Data: map[string]interface{}{
			"connection_id": conn.ID,
			"server_time":   time.Now().Unix(),
			"capabilities":  []string{"scan.progress", "volume.updates", "system.events"},
		},
	}

	select {
	case conn.Send <- welcomeMsg:
	default:
		// Connection send buffer is full, close it
		close(conn.Send)
		delete(h.connections, conn.ID)
	}
}

// handleUnregister removes a connection and cleans up its room subscriptions
func (h *Hub) handleUnregister(conn *Connection) {
	h.mutex.Lock()
	defer h.mutex.Unlock()

	if _, exists := h.connections[conn.ID]; !exists {
		return
	}

	// Remove from all rooms
	for room := range conn.Rooms {
		if roomConnections, roomExists := h.rooms[room]; roomExists {
			delete(roomConnections, conn.ID)
			if len(roomConnections) == 0 {
				delete(h.rooms, room)
			}
		}
	}

	delete(h.connections, conn.ID)
	close(conn.Send)
	conn.Cancel()
	
	log.Printf("[WEBSOCKET-HUB] Client unregistered: %s (total: %d)", conn.ID, len(h.connections))
}

// handleBroadcast sends a message to all connections in a room
func (h *Hub) handleBroadcast(broadcastMsg BroadcastMessage) {
	h.mutex.RLock()
	roomConnections, exists := h.rooms[broadcastMsg.Room]
	if !exists {
		h.mutex.RUnlock()
		return // No subscribers in this room
	}

	// Copy connections to avoid holding lock during send
	connections := make([]*Connection, 0, len(roomConnections))
	for _, conn := range roomConnections {
		connections = append(connections, conn)
	}
	h.mutex.RUnlock()

	// Send to all connections in the room
	sentCount := 0
	for _, conn := range connections {
		select {
		case conn.Send <- broadcastMsg.Message:
			sentCount++
		default:
			// Connection send buffer is full, unregister it
			h.unregister <- conn
		}
	}

	if sentCount > 0 {
		log.Printf("[WEBSOCKET-HUB] Broadcasted '%s' to room '%s' (%d clients)", 
			broadcastMsg.Message.Type, broadcastMsg.Room, sentCount)
	}
}

// cleanupStaleConnections removes connections that haven't been active
func (h *Hub) cleanupStaleConnections() {
	h.mutex.RLock()
	staleConnections := make([]*Connection, 0)
	cutoff := time.Now().Add(-time.Minute * 10)
	
	for _, conn := range h.connections {
		if conn.LastSeen.Before(cutoff) {
			staleConnections = append(staleConnections, conn)
		}
	}
	h.mutex.RUnlock()

	for _, conn := range staleConnections {
		log.Printf("[WEBSOCKET-HUB] Cleaning up stale connection: %s", conn.ID)
		h.unregister <- conn
	}
}

// shutdown gracefully closes all connections
func (h *Hub) shutdown() {
	h.mutex.RLock()
	defer h.mutex.RUnlock()

	for _, conn := range h.connections {
		conn.Cancel()
		close(conn.Send)
	}
}

// SubscribeToRoom adds a connection to a room
func (h *Hub) SubscribeToRoom(connectionID, room string) error {
	h.mutex.Lock()
	defer h.mutex.Unlock()

	conn, exists := h.connections[connectionID]
	if !exists {
		return fmt.Errorf("connection %s not found", connectionID)
	}

	// Initialize room if it doesn't exist
	if _, exists := h.rooms[room]; !exists {
		h.rooms[room] = make(map[string]*Connection)
	}

	// Add connection to room
	h.rooms[room][connectionID] = conn
	conn.Rooms[room] = true
	conn.LastSeen = time.Now()

	log.Printf("[WEBSOCKET-HUB] Client %s subscribed to room: %s", connectionID, room)
	return nil
}

// UnsubscribeFromRoom removes a connection from a room
func (h *Hub) UnsubscribeFromRoom(connectionID, room string) error {
	h.mutex.Lock()
	defer h.mutex.Unlock()

	conn, exists := h.connections[connectionID]
	if !exists {
		return fmt.Errorf("connection %s not found", connectionID)
	}

	// Remove from room
	if roomConnections, roomExists := h.rooms[room]; roomExists {
		delete(roomConnections, connectionID)
		if len(roomConnections) == 0 {
			delete(h.rooms, room)
		}
	}

	delete(conn.Rooms, room)
	conn.LastSeen = time.Now()

	log.Printf("[WEBSOCKET-HUB] Client %s unsubscribed from room: %s", connectionID, room)
	return nil
}

// BroadcastToRoom sends a message to all connections in a specific room
func (h *Hub) BroadcastToRoom(room, messageType string, data interface{}) {
	message := RealtimeMessage{
		Type:      messageType,
		Data:      data,
		Timestamp: time.Now(),
		Room:      room,
	}

	select {
	case h.broadcast <- BroadcastMessage{Room: room, Message: message}:
	default:
		log.Printf("[WEBSOCKET-HUB] Broadcast channel full, dropping message for room: %s", room)
	}
}

// BroadcastScanProgress broadcasts scan progress to relevant rooms
func (h *Hub) BroadcastScanProgress(volumeID, scanID string, data interface{}) {
	rooms := []string{
		"volume_" + volumeID,
		"scan_" + scanID,
		"scan_progress_all",
	}

	for _, room := range rooms {
		h.BroadcastToRoom(room, "scan.progress", data)
	}
}

// BroadcastScanEvent broadcasts scan lifecycle events
func (h *Hub) BroadcastScanEvent(eventType, volumeID, scanID string, data interface{}) {
	rooms := []string{
		"volume_" + volumeID,
		"scan_" + scanID,
		"scan_progress_all",
	}

	messageType := "scan." + eventType // scan.started, scan.completed, scan.failed
	for _, room := range rooms {
		h.BroadcastToRoom(room, messageType, data)
	}
}

// BroadcastVolumeUpdate broadcasts volume-related updates
func (h *Hub) BroadcastVolumeUpdate(data interface{}) {
	h.BroadcastToRoom("volume_updates", "volume.updated", data)
}

// broadcastCurrentVolumeStates periodically broadcasts current volume states to all subscribed clients
func (h *Hub) broadcastCurrentVolumeStates() {
	if h.store == nil {
		return
	}

	// Check if there are any subscribers to broadcast to
	h.mutex.RLock()
	hasVolumeUpdateSubs := len(h.rooms["volume_updates"]) > 0
	hasScanProgressSubs := len(h.rooms["scan_progress_all"]) > 0
	totalConnections := len(h.connections)
	h.mutex.RUnlock()

	if !hasVolumeUpdateSubs && !hasScanProgressSubs {
		return // No subscribers for volume updates
	}

	log.Printf("[WEBSOCKET-HUB] Broadcasting volume states to %d connected clients", totalConnections)

	ctx := context.Background()
	// TODO: CRITICAL SECURITY ISSUE - WebSocket realtime service leaks data between organizations
	// This system needs complete redesign for multi-tenancy with proper authentication:
	// 1. WebSocket connections must authenticate and maintain organization context
	// 2. Room subscriptions must be organization-scoped
	// 3. Volume broadcasts must filter by organization access
	// 4. Currently all volumes are broadcast to all clients regardless of organization
	// TEMPORARY FIX: Using system-level query to prevent compilation errors
	volumes, err := h.store.Volumes().ListAllVolumes(ctx, 100, 0)
	if err != nil {
		log.Printf("[WEBSOCKET-HUB] Failed to query volumes for periodic broadcast: %v", err)
		return
	}

	// Broadcast to volume.updates subscribers
	if hasVolumeUpdateSubs {
		for _, volume := range volumes {
			var totalSize int64
			if volume.UsageData != nil {
				totalSize = volume.UsageData.Size
			}

			volumeData := map[string]interface{}{
				"volume_id":    volume.VolumeID,
				"volume_name":  volume.Name,
				"status":       volume.Status,
				"last_scanned": volume.LastScanned,
				"total_size":   totalSize,
				"driver":       volume.Driver,
				"mountpoint":   volume.Mountpoint,
				"is_active":    volume.IsActive,
				"created_at":   volume.CreatedAt,
				"updated_at":   volume.UpdatedAt,
				"message":      "Periodic volume state update",
				"timestamp":    time.Now().Unix(),
			}

			h.BroadcastToRoom("volume_updates", "volume.state", volumeData)
		}
	}

	// Broadcast to scan.progress subscribers (for continuous progress monitoring)
	if hasScanProgressSubs {
		for _, volume := range volumes {
			var totalSize int64
			if volume.UsageData != nil {
				totalSize = volume.UsageData.Size
			}

			progressData := map[string]interface{}{
				"volume_id":    volume.VolumeID,
				"volume_name":  volume.Name,
				"status":       volume.Status,
				"last_scanned": volume.LastScanned,
				"total_size":   totalSize,
				"driver":       volume.Driver,
				"mountpoint":   volume.Mountpoint,
				"is_active":    volume.IsActive,
				"message":      "Current volume status",
				"timestamp":    time.Now().Unix(),
				"progress":     100.0, // Not actively scanning, so 100%
			}

			h.BroadcastToRoom("scan_progress_all", "scan.status", progressData)
		}
	}
}

// GetStats returns hub statistics
func (h *Hub) GetStats() map[string]interface{} {
	h.mutex.RLock()
	defer h.mutex.RUnlock()

	roomStats := make(map[string]int)
	for room, connections := range h.rooms {
		roomStats[room] = len(connections)
	}

	return map[string]interface{}{
		"total_connections": len(h.connections),
		"total_rooms":       len(h.rooms),
		"room_stats":        roomStats,
		"timestamp":         time.Now().Unix(),
	}
}

// HandleWebSocket handles HTTP upgrade to WebSocket
func (h *Hub) HandleWebSocket(w http.ResponseWriter, r *http.Request) {
	// Accept WebSocket connection with proper options
	conn, err := websocket.Accept(w, r, &websocket.AcceptOptions{
		OriginPatterns: []string{"*"}, // TODO: Configure proper origins for production
		Subprotocols:   []string{},
	})
	if err != nil {
		log.Printf("[WEBSOCKET-HUB] WebSocket accept error: %v", err)
		return
	}

	// Create connection wrapper with background context (not request context)
	// Request context gets canceled after HTTP upgrade, but WebSocket needs long-lived context
	ctx, cancel := context.WithCancel(context.Background())
	connectionID := fmt.Sprintf("conn_%d", time.Now().UnixNano())
	
	connection := &Connection{
		ID:       connectionID,
		WS:       conn,
		Send:     make(chan RealtimeMessage, 256),
		Rooms:    make(map[string]bool),
		Context:  ctx,
		Cancel:   cancel,
		LastSeen: time.Now(),
	}

	// Register connection
	h.register <- connection

	// Start goroutines for handling this connection
	go h.handleConnectionWrites(connection)
	go h.handleConnectionReads(connection)
}

// handleConnectionReads handles incoming messages from a WebSocket connection
func (h *Hub) handleConnectionReads(conn *Connection) {
	defer func() {
		h.unregister <- conn
	}()

	for {
		var sub SubscriptionMessage
		err := wsjson.Read(conn.Context, conn.WS, &sub)
		if err != nil {
			if websocket.CloseStatus(err) != websocket.StatusNormalClosure {
				log.Printf("[WEBSOCKET-HUB] Read error for %s: %v", conn.ID, err)
			}
			break
		}

		conn.LastSeen = time.Now()
		h.handleSubscription(conn, sub)
	}
}

// handleConnectionWrites handles outgoing messages to a WebSocket connection
func (h *Hub) handleConnectionWrites(conn *Connection) {
	pingTicker := time.NewTicker(h.pingInterval)
	defer pingTicker.Stop()

	for {
		select {
		case message, ok := <-conn.Send:
			if !ok {
				// Channel closed, connection is being terminated
				conn.WS.Close(websocket.StatusNormalClosure, "Connection closed")
				return
			}

			if err := wsjson.Write(conn.Context, conn.WS, message); err != nil {
				log.Printf("[WEBSOCKET-HUB] Write error for %s: %v", conn.ID, err)
				return
			}

		case <-pingTicker.C:
			if err := conn.WS.Ping(conn.Context); err != nil {
				log.Printf("[WEBSOCKET-HUB] Ping error for %s: %v", conn.ID, err)
				return
			}

		case <-conn.Context.Done():
			return
		}
	}
}

// handleSubscription processes subscription/unsubscription requests
func (h *Hub) handleSubscription(conn *Connection, sub SubscriptionMessage) {
	room := h.determineRoom(sub.Event, sub.Filters)
	if room == "" {
		// Send error back to client
		errorMsg := RealtimeMessage{
			Type:      "system.error",
			Timestamp: time.Now(),
			Data: map[string]interface{}{
				"error":   "Invalid subscription",
				"message": "Could not determine room for event: " + sub.Event,
			},
		}
		select {
		case conn.Send <- errorMsg:
		default:
		}
		return
	}

	var err error
	if sub.Action == "subscribe" {
		err = h.SubscribeToRoom(conn.ID, room)
	} else if sub.Action == "unsubscribe" {
		err = h.UnsubscribeFromRoom(conn.ID, room)
	}

	// Send confirmation back to client
	var responseType string
	var responseData interface{}

	if err != nil {
		responseType = "system.error"
		responseData = map[string]interface{}{
			"error":   "Subscription failed",
			"message": err.Error(),
		}
	} else {
		responseType = "system.subscription_" + sub.Action + "d"
		responseData = map[string]interface{}{
			"event": sub.Event,
			"room":  room,
		}
	}

	confirmMsg := RealtimeMessage{
		Type:      responseType,
		Timestamp: time.Now(),
		Data:      responseData,
	}

	select {
	case conn.Send <- confirmMsg:
	default:
	}

	// Send initial state data after successful subscription
	if err == nil && sub.Action == "subscribe" {
		h.sendInitialStateData(conn, sub.Event, room)
	}
}

// determineRoom determines which room a client should be subscribed to based on event and filters
func (h *Hub) determineRoom(event string, filters map[string]interface{}) string {
	switch event {
	case "scan.progress":
		if volumeID, ok := filters["volume_id"].(string); ok && volumeID != "" {
			return "volume_" + volumeID
		}
		if scanID, ok := filters["scan_id"].(string); ok && scanID != "" {
			return "scan_" + scanID
		}
		return "scan_progress_all"
		
	case "volume.updates":
		return "volume_updates"
		
	case "system.events":
		return "system_events"
		
	default:
		return ""
	}
}

// sendInitialStateData sends current state data to newly subscribed clients
func (h *Hub) sendInitialStateData(conn *Connection, event, room string) {
	log.Printf("[WEBSOCKET-HUB] Sending initial state data for event '%s' to client %s", event, conn.ID)
	
	ctx := context.Background()
	
	switch event {
	case "scan.progress":
		// Query current volume states and scan progress
		if h.store != nil {
			// TODO: CRITICAL SECURITY ISSUE - WebSocket lacks organization-specific queries
			// This sends volumes from ALL organizations to any connected client
			// TEMPORARY FIX: Using system-level query to prevent compilation errors
			volumes, err := h.store.Volumes().ListAllVolumes(ctx, 100, 0) // Get first 100 volumes
			if err != nil {
				log.Printf("[WEBSOCKET-HUB] Failed to query volumes for initial state: %v", err)
			} else {
				// Send current volume scan states
				for _, volume := range volumes {
					var totalSize int64
					if volume.UsageData != nil {
						totalSize = volume.UsageData.Size
					}
					
					volumeData := map[string]interface{}{
						"volume_id":    volume.VolumeID,
						"volume_name":  volume.Name,
						"status":       volume.Status,
						"last_scanned": volume.LastScanned,
						"total_size":   totalSize,
						"driver":       volume.Driver,
						"mountpoint":   volume.Mountpoint,
						"is_active":    volume.IsActive,
						"created_at":   volume.CreatedAt,
						"updated_at":   volume.UpdatedAt,
						"message":      "Current volume state",
					}
					
					initialMsg := RealtimeMessage{
						Type:      "scan.progress.initial",
						Timestamp: time.Now(),
						Data:      volumeData,
					}
					select {
					case conn.Send <- initialMsg:
					default:
					}
				}
			}
		}
		
	case "volume.updates":
		// Query and send current volume states
		if h.store != nil {
			// TODO: CRITICAL SECURITY ISSUE - WebSocket lacks organization-specific queries
			// This sends volumes from ALL organizations to any connected client
			// TEMPORARY FIX: Using system-level query to prevent compilation errors
			volumes, err := h.store.Volumes().ListAllVolumes(ctx, 100, 0) // Get first 100 volumes
			if err != nil {
				log.Printf("[WEBSOCKET-HUB] Failed to query volumes for initial state: %v", err)
			} else {
				// Send current volume states
				for _, volume := range volumes {
					var totalSize int64
					if volume.UsageData != nil {
						totalSize = volume.UsageData.Size
					}
					
					volumeData := map[string]interface{}{
						"volume_id":    volume.VolumeID,
						"volume_name":  volume.Name,
						"status":       volume.Status,
						"last_scanned": volume.LastScanned,
						"total_size":   totalSize,
						"driver":       volume.Driver,
						"mountpoint":   volume.Mountpoint,
						"is_active":    volume.IsActive,
						"created_at":   volume.CreatedAt,
						"updated_at":   volume.UpdatedAt,
						"message":      "Current volume state",
					}
					
					initialMsg := RealtimeMessage{
						Type:      "volume.updates.initial",
						Timestamp: time.Now(),
						Data:      volumeData,
					}
					select {
					case conn.Send <- initialMsg:
					default:
					}
				}
			}
		}
		
	case "system.events":
		// Send current system state with basic stats
		systemData := map[string]interface{}{
			"message":         "Connected to system events",
			"room":            room,
			"server_time":     time.Now().Unix(),
			"uptime_seconds":  time.Since(time.Now().Add(-time.Hour)).Seconds(), // Placeholder
			"note":            "System events will appear here",
		}
		
		initialMsg := RealtimeMessage{
			Type:      "system.events.initial",
			Timestamp: time.Now(),
			Data:      systemData,
		}
		select {
		case conn.Send <- initialMsg:
		default:
		}
	}
}