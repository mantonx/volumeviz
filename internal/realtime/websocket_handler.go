package realtime

import (
	"context"
	"net/http"
	"time"

	"github.com/mantonx/volumeviz/internal/store"
	"github.com/mantonx/volumeviz/internal/utils/auth"
)

// RealtimeService provides WebSocket real-time communication
type RealtimeService struct {
	hub   *Hub
	store store.Store
}

// NewRealtimeService creates a new real-time service with default allowed origins
func NewRealtimeService(store store.Store, jwtManager *auth.JWTManager) *RealtimeService {
	return NewRealtimeServiceWithOrigins(store, jwtManager, []string{"http://localhost:3000"})
}

// NewRealtimeServiceWithOrigins creates a new real-time service with custom allowed origins
func NewRealtimeServiceWithOrigins(store store.Store, jwtManager *auth.JWTManager, allowedOrigins []string) *RealtimeService {
	// Create hub with proper configuration
	hub := NewHubWithConfig(store, jwtManager, allowedOrigins)

	// Start hub in background
	go hub.Run(context.Background())

	return &RealtimeService{
		hub:   hub,
		store: store,
	}
}

// HandleWebSocket upgrades HTTP connections to WebSocket
func (rs *RealtimeService) HandleWebSocket(w http.ResponseWriter, r *http.Request) {
	rs.hub.HandleWebSocket(w, r)
}

// BroadcastScanProgress broadcasts scan progress updates
func (rs *RealtimeService) BroadcastScanProgress(volumeID, scanID string, data interface{}) {
	rs.hub.BroadcastScanProgress(volumeID, scanID, data)
}

// BroadcastScanEvent broadcasts scan lifecycle events
func (rs *RealtimeService) BroadcastScanEvent(eventType, volumeID, scanID string, data interface{}) {
	rs.hub.BroadcastScanEvent(eventType, volumeID, scanID, data)
}

// BroadcastVolumeUpdate broadcasts volume-related updates
func (rs *RealtimeService) BroadcastVolumeUpdate(data interface{}) {
	rs.hub.BroadcastVolumeUpdate(data)
}

// BroadcastToRoom broadcasts a message to a specific room
func (rs *RealtimeService) BroadcastToRoom(room, messageType string, data interface{}) {
	rs.hub.BroadcastToRoom(room, messageType, data)
}

// GetStats returns real-time service statistics
func (rs *RealtimeService) GetStats() map[string]interface{} {
	hubStats := rs.hub.GetStats()
	hubStats["service_uptime"] = time.Now().Unix()
	return hubStats
}

// Shutdown gracefully shuts down the real-time service
func (rs *RealtimeService) Shutdown(ctx context.Context) error {
	// The hub will shut down when its context is cancelled
	return nil
}