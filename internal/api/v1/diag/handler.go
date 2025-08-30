package diag

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/mantonx/volumeviz/internal/config"
)

// Handler handles diagnostic endpoints
type Handler struct {
	config *config.Config
}

// NewHandler creates a new diagnostics handler
func NewHandler(cfg *config.Config) *Handler {
	return &Handler{
		config: cfg,
	}
}

// RealtimeMode represents the real-time communication mode
type RealtimeMode string

const (
	ModeWebSocket RealtimeMode = "ws"
	ModePolling   RealtimeMode = "polling"
	ModeSSE       RealtimeMode = "sse"
)

// RealtimeDiagnostics represents real-time capabilities
type RealtimeDiagnostics struct {
	Mode              RealtimeMode `json:"mode"`
	WebSocketEnabled  bool         `json:"websocket_enabled"`
	SSEEnabled        bool         `json:"sse_enabled"`
	PollingEnabled    bool         `json:"polling_enabled"`
	WebSocketURL      string       `json:"websocket_url,omitempty"`
	PollingInterval   int          `json:"polling_interval_ms"`
	ActiveConnections int          `json:"active_connections"`
	Features          []string     `json:"features"`
}

// GetRealtimeDiagnostics returns real-time communication diagnostics
// @Summary Get real-time diagnostics
// @Description Get information about available real-time communication methods
// @Tags Diagnostics
// @Accept json
// @Produce json
// @Success 200 {object} RealtimeDiagnostics
// @Router /api/v1/diag/realtime [get]
func (h *Handler) GetRealtimeDiagnostics(c *gin.Context) {
	diag := RealtimeDiagnostics{
		WebSocketEnabled:  h.config.Events.Enabled,
		SSEEnabled:        false, // SSE not yet implemented
		PollingEnabled:    true,  // Polling is always available as fallback
		PollingInterval:   5000,  // Default 5 seconds
		ActiveConnections: 0,
		Features:          []string{},
	}

	// Determine primary mode based on configuration
	if h.config.Events.Enabled {
		diag.Mode = ModeWebSocket
		diag.ActiveConnections = 0 // TODO: Add connection tracking to new realtime system
		diag.Features = append(diag.Features,
			"volume_updates",
			"scan_progress",
			"filesystem_indexing",
			"media_enrichment",
			"heartbeat",
			"auto_reconnect",
		)

		// Set WebSocket URL based on request
		scheme := "ws"
		if c.Request.TLS != nil {
			scheme = "wss"
		}
		host := c.Request.Host
		diag.WebSocketURL = scheme + "://" + host + "/api/v1/realtime/ws"
	} else {
		diag.Mode = ModePolling
		diag.Features = append(diag.Features, "polling_fallback")
	}

	c.JSON(http.StatusOK, diag)
}

// RegisterRoutes registers diagnostic routes
func (h *Handler) RegisterRoutes(router gin.IRouter) {
	router.GET("/diag/realtime", h.GetRealtimeDiagnostics)
}
