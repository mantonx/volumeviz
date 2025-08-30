package realtime

import (
	"github.com/gin-gonic/gin"
)

// APIHandler handles WebSocket API endpoints for the enhanced realtime system
type APIHandler struct {
	service *RealtimeService
}

// NewAPIHandler creates a new WebSocket API handler
func NewAPIHandler(service *RealtimeService) *APIHandler {
	return &APIHandler{
		service: service,
	}
}

// HandleWebSocket handles WebSocket upgrade requests
func (h *APIHandler) HandleWebSocket(c *gin.Context) {
	h.service.HandleWebSocket(c.Writer, c.Request)
}

// RegisterRoutes registers enhanced WebSocket routes
func (h *APIHandler) RegisterRoutes(router gin.IRouter) {
	// Main WebSocket endpoint
	router.GET("/ws", h.HandleWebSocket)
	router.GET("/ws/stats", h.GetRealtimeStats)
}

// GetRealtimeStats returns real-time service statistics
func (h *APIHandler) GetRealtimeStats(c *gin.Context) {
	stats := h.service.GetStats()
	c.JSON(200, stats)
}