package websocket

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/gorilla/websocket"
)

func TestClientConnection(t *testing.T) {
	hub := NewHub()
	go hub.Run()
	defer hub.Stop()

	// Create test server
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ServeWS(hub, w, r)
	}))
	defer server.Close()

	// Convert http to ws URL
	wsURL := "ws" + strings.TrimPrefix(server.URL, "http")

	// Connect to WebSocket
	conn, _, err := websocket.DefaultDialer.Dial(wsURL, nil)
	if err != nil {
		t.Fatalf("Failed to connect to WebSocket: %v", err)
	}
	defer conn.Close()

	// Wait a bit for connection to register
	time.Sleep(100 * time.Millisecond)

	// Check that client is registered
	if hub.GetClientCount() != 1 {
		t.Errorf("Expected 1 client, got %d", hub.GetClientCount())
	}
}

func TestClientPingPong(t *testing.T) {
	hub := NewHub()
	go hub.Run()
	defer hub.Stop()

	// Create test server
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ServeWS(hub, w, r)
	}))
	defer server.Close()

	// Convert http to ws URL
	wsURL := "ws" + strings.TrimPrefix(server.URL, "http")

	// Connect to WebSocket
	conn, _, err := websocket.DefaultDialer.Dial(wsURL, nil)
	if err != nil {
		t.Fatalf("Failed to connect to WebSocket: %v", err)
	}
	defer conn.Close()

	// Wait for connection to establish
	time.Sleep(100 * time.Millisecond)

	// Send ping message
	pingMsg := Message{
		Type:      MessageTypePing,
		Timestamp: time.Now(),
	}

	if err := conn.WriteJSON(pingMsg); err != nil {
		t.Fatalf("Failed to send ping: %v", err)
	}

	// Read pong response
	var pongMsg Message
	if err := conn.ReadJSON(&pongMsg); err != nil {
		t.Fatalf("Failed to read pong: %v", err)
	}

	if pongMsg.Type != MessageTypePong {
		t.Errorf("Expected pong message, got %s", pongMsg.Type)
	}
}

func TestClientWithToken(t *testing.T) {
	hub := NewHub()
	go hub.Run()
	defer hub.Stop()

	// Create test server
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ServeWS(hub, w, r)
	}))
	defer server.Close()

	// Convert http to ws URL
	wsURL := "ws" + strings.TrimPrefix(server.URL, "http")

	// Connect with Authorization header
	headers := http.Header{}
	headers.Set("Authorization", "Bearer test-token")

	conn, _, err := websocket.DefaultDialer.Dial(wsURL, headers)
	if err != nil {
		t.Fatalf("Failed to connect to WebSocket: %v", err)
	}
	defer conn.Close()

	// Wait for connection to register
	time.Sleep(100 * time.Millisecond)

	// Check client metrics
	metrics := hub.GetClientsMetrics()
	if len(metrics) != 1 {
		t.Fatalf("Expected 1 client metric, got %d", len(metrics))
	}

	if !metrics[0].Token {
		t.Error("Expected client to have token, but it doesn't")
	}
}

func TestBroadcastMessage(t *testing.T) {
	hub := NewHub()
	go hub.Run()
	defer hub.Stop()

	// Create test server
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ServeWS(hub, w, r)
	}))
	defer server.Close()

	// Convert http to ws URL
	wsURL := "ws" + strings.TrimPrefix(server.URL, "http")

	// Connect multiple clients
	conn1, _, err := websocket.DefaultDialer.Dial(wsURL, nil)
	if err != nil {
		t.Fatalf("Failed to connect first client: %v", err)
	}
	defer conn1.Close()

	conn2, _, err := websocket.DefaultDialer.Dial(wsURL, nil)
	if err != nil {
		t.Fatalf("Failed to connect second client: %v", err)
	}
	defer conn2.Close()

	// Wait for connections to register
	time.Sleep(100 * time.Millisecond)

	// Verify both clients are connected
	if hub.GetClientCount() != 2 {
		t.Errorf("Expected 2 clients, got %d", hub.GetClientCount())
	}

	// Broadcast a volume update
	volumes := []VolumeData{
		{
			ID:         "vol-1",
			Name:       "test-volume",
			Driver:     "local",
			Mountpoint: "/var/lib/docker/volumes/test-volume/_data",
			CreatedAt:  time.Now(),
		},
	}
	hub.BroadcastVolumeUpdate(volumes)

	// Read messages from both clients
	var msg1, msg2 Message

	if err := conn1.ReadJSON(&msg1); err != nil {
		t.Fatalf("Failed to read message from client 1: %v", err)
	}

	if err := conn2.ReadJSON(&msg2); err != nil {
		t.Fatalf("Failed to read message from client 2: %v", err)
	}

	// Verify both received the same message
	if msg1.Type != MessageTypeVolumeUpdate || msg2.Type != MessageTypeVolumeUpdate {
		t.Error("Expected volume update messages")
	}

	// Verify message data - convert interface{} to proper type
	dataBytes, err := json.Marshal(msg1.Data)
	if err != nil {
		t.Fatalf("Failed to marshal data back: %v", err)
	}

	var receivedVolumes []VolumeData
	if err := json.Unmarshal(dataBytes, &receivedVolumes); err != nil {
		t.Fatalf("Failed to unmarshal volume data: %v", err)
	}

	if len(receivedVolumes) != 1 || receivedVolumes[0].ID != "vol-1" {
		t.Error("Received volume data doesn't match sent data")
	}
}

func TestGenerateClientID(t *testing.T) {
	id1 := generateClientID()
	id2 := generateClientID()

	if id1 == id2 {
		t.Error("Expected unique client IDs, got duplicates")
	}

	if !strings.HasPrefix(id1, "client_") || !strings.HasPrefix(id2, "client_") {
		t.Error("Expected client IDs to start with 'client_'")
	}
}

func TestClientMetrics(t *testing.T) {
	hub := NewHub()
	go hub.Run()
	defer hub.Stop()

	// Create test server
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ServeWS(hub, w, r)
	}))
	defer server.Close()

	// Convert http to ws URL
	wsURL := "ws" + strings.TrimPrefix(server.URL, "http")

	// Connect to WebSocket
	conn, _, err := websocket.DefaultDialer.Dial(wsURL, nil)
	if err != nil {
		t.Fatalf("Failed to connect to WebSocket: %v", err)
	}
	defer conn.Close()

	// Wait for connection to register
	time.Sleep(100 * time.Millisecond)

	// Get metrics
	metrics := hub.GetClientsMetrics()
	if len(metrics) != 1 {
		t.Fatalf("Expected 1 client metric, got %d", len(metrics))
	}

	metric := metrics[0]
	if metric.ID == "" {
		t.Error("Expected client ID to be set")
	}

	if metric.ConnectedAt.IsZero() {
		t.Error("Expected connected time to be set")
	}

	if metric.LastPongTime.IsZero() {
		t.Error("Expected last pong time to be set")
	}

	if metric.MissedPongs != 0 {
		t.Errorf("Expected 0 missed pongs initially, got %d", metric.MissedPongs)
	}
}
