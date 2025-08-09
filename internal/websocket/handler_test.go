package websocket

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
)

func TestHandleWebSocket(t *testing.T) {
	hub := NewHub()
	go hub.Run()
	defer hub.Stop()

	handler := NewHandler(hub)

	// Create gin router
	gin.SetMode(gin.TestMode)
	router := gin.New()
	handler.RegisterRoutes(router)

	// Create test server
	server := httptest.NewServer(router)
	defer server.Close()

	// Convert http to ws URL
	wsURL := "ws" + strings.TrimPrefix(server.URL, "http") + "/ws"

	// Connect to WebSocket
	conn, _, err := websocket.DefaultDialer.Dial(wsURL, nil)
	if err != nil {
		t.Fatalf("Failed to connect to WebSocket: %v", err)
	}
	defer conn.Close()

	// Wait for connection to register
	time.Sleep(100 * time.Millisecond)

	// Check that client is registered
	if hub.GetClientCount() != 1 {
		t.Errorf("Expected 1 client, got %d", hub.GetClientCount())
	}
}

func TestGetWebSocketMetrics(t *testing.T) {
	hub := NewHub()
	go hub.Run()
	defer hub.Stop()

	handler := NewHandler(hub)

	// Create gin router
	gin.SetMode(gin.TestMode)
	router := gin.New()
	handler.RegisterRoutes(router)

	// Test metrics endpoint with no clients
	req, _ := http.NewRequest("GET", "/ws/metrics", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("Expected status 200, got %d", w.Code)
	}

	var metrics map[string]interface{}
	if err := json.Unmarshal(w.Body.Bytes(), &metrics); err != nil {
		t.Fatalf("Failed to unmarshal metrics: %v", err)
	}

	if totalClients, ok := metrics["total_clients"]; !ok || totalClients != float64(0) {
		t.Errorf("Expected 0 total clients, got %v", totalClients)
	}

	if clients, ok := metrics["clients"]; !ok {
		t.Error("Expected clients field in metrics")
	} else if clientsList, ok := clients.([]interface{}); !ok || len(clientsList) != 0 {
		t.Errorf("Expected empty clients list, got %v", clients)
	}
}

func TestGetWebSocketMetricsWithClients(t *testing.T) {
	hub := NewHub()
	go hub.Run()
	defer hub.Stop()

	handler := NewHandler(hub)

	// Create gin router
	gin.SetMode(gin.TestMode)
	router := gin.New()
	handler.RegisterRoutes(router)

	// Create test server
	server := httptest.NewServer(router)
	defer server.Close()

	// Convert http to ws URL and connect a client
	wsURL := "ws" + strings.TrimPrefix(server.URL, "http") + "/ws"
	conn, _, err := websocket.DefaultDialer.Dial(wsURL, nil)
	if err != nil {
		t.Fatalf("Failed to connect to WebSocket: %v", err)
	}
	defer conn.Close()

	// Wait for connection to register
	time.Sleep(100 * time.Millisecond)

	// Test metrics endpoint with 1 client
	req, _ := http.NewRequest("GET", "/ws/metrics", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("Expected status 200, got %d", w.Code)
	}

	var metrics map[string]interface{}
	if err := json.Unmarshal(w.Body.Bytes(), &metrics); err != nil {
		t.Fatalf("Failed to unmarshal metrics: %v", err)
	}

	if totalClients, ok := metrics["total_clients"]; !ok || totalClients != float64(1) {
		t.Errorf("Expected 1 total client, got %v", totalClients)
	}

	if clients, ok := metrics["clients"]; !ok {
		t.Error("Expected clients field in metrics")
	} else if clientsList, ok := clients.([]interface{}); !ok || len(clientsList) != 1 {
		t.Errorf("Expected 1 client in list, got %v", clients)
	}
}

func TestNewHandler(t *testing.T) {
	hub := NewHub()
	handler := NewHandler(hub)

	if handler == nil {
		t.Fatal("Expected handler to be created, got nil")
	}

	if handler.hub != hub {
		t.Error("Expected handler to have correct hub reference")
	}
}

func TestRegisterRoutes(t *testing.T) {
	hub := NewHub()
	handler := NewHandler(hub)

	// Create gin router
	gin.SetMode(gin.TestMode)
	router := gin.New()

	// Register routes should not panic
	handler.RegisterRoutes(router)

	// Test that routes are registered by making requests
	// Test WebSocket upgrade endpoint
	req, _ := http.NewRequest("GET", "/ws", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	// Should get bad request (not upgrade) but route should exist
	if w.Code == http.StatusNotFound {
		t.Error("WebSocket route not registered")
	}

	// Test metrics endpoint
	req, _ = http.NewRequest("GET", "/ws/metrics", nil)
	w = httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("Metrics route not working, got status %d", w.Code)
	}
}
