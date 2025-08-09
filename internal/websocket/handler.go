package websocket

import (
	"github.com/gin-gonic/gin"
)

// Handler handles WebSocket connections
type Handler struct {
	hub *Hub
}

// NewHandler creates a new WebSocket handler
func NewHandler(hub *Hub) *Handler {
	return &Handler{
		hub: hub,
	}
}

// HandleWebSocket handles WebSocket upgrade requests
func (h *Handler) HandleWebSocket(c *gin.Context) {
	ServeWS(h.hub, c.Writer, c.Request)
}

// RegisterRoutes registers WebSocket routes
func (h *Handler) RegisterRoutes(router gin.IRouter) {
	router.GET("/ws", h.HandleWebSocket)
	router.GET("/ws/metrics", h.GetWebSocketMetrics)
}

// GetWebSocketMetrics returns WebSocket connection metrics
func (h *Handler) GetWebSocketMetrics(c *gin.Context) {
	metrics := map[string]interface{}{
		"total_clients": h.hub.GetClientCount(),
		"clients":       h.hub.GetClientsMetrics(),
	}

	c.JSON(200, metrics)
}
