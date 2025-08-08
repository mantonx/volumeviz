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
}
