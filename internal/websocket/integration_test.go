package websocket_test

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"runtime"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	ws "github.com/mantonx/volumeviz/internal/websocket"
)

// TestMultiClientBroadcast tests that multiple clients receive broadcast messages
func TestMultiClientBroadcast(t *testing.T) {
	gin.SetMode(gin.TestMode)

	// Create hub and handler
	hub := ws.NewHub()
	go hub.Run()
	defer hub.Stop()

	handler := ws.NewHandler(hub)

	// Setup test server
	router := gin.New()
	v1 := router.Group("/api/v1")
	handler.RegisterRoutes(v1)

	server := httptest.NewServer(router)
	defer server.Close()

	// Replace http with ws in URL
	wsURL := "ws" + strings.TrimPrefix(server.URL, "http") + "/api/v1/ws"

	// Number of clients to test
	numClients := 3
	clients := make([]*websocket.Conn, numClients)
	messages := make([]chan ws.Message, numClients)
	var wg sync.WaitGroup

	// Connect multiple clients
	for i := 0; i < numClients; i++ {
		dialer := websocket.Dialer{}
		conn, _, err := dialer.Dial(wsURL, nil)
		require.NoError(t, err)
		clients[i] = conn
		messages[i] = make(chan ws.Message, 10)

		// Start reader for each client
		wg.Add(1)
		go func(idx int, conn *websocket.Conn, msgChan chan ws.Message) {
			defer wg.Done()
			for {
				_, data, err := conn.ReadMessage()
				if err != nil {
					return
				}
				var msg ws.Message
				if err := json.Unmarshal(data, &msg); err == nil {
					msgChan <- msg
				}
			}
		}(i, conn, messages[i])
	}

	// Give clients time to connect
	time.Sleep(100 * time.Millisecond)

	// Verify all clients are connected
	assert.Equal(t, numClients, hub.GetClientCount())

	// Broadcast a test message
	testMessage := ws.Message{
		Type:      ws.MessageTypeVolumeUpdate,
		VolumeID:  "test-volume-123",
		Data:      map[string]interface{}{"status": "updated"},
		Timestamp: time.Now(),
	}
	hub.BroadcastMessage(testMessage)

	// Verify all clients receive the message
	timeout := time.After(2 * time.Second)
	for i := 0; i < numClients; i++ {
		select {
		case msg := <-messages[i]:
			assert.Equal(t, testMessage.Type, msg.Type)
			assert.Equal(t, testMessage.VolumeID, msg.VolumeID)
			t.Logf("Client %d received broadcast message", i)
		case <-timeout:
			t.Errorf("Client %d did not receive broadcast message", i)
		}
	}

	// Close all connections
	for _, conn := range clients {
		conn.Close()
	}

	// Wait for readers to finish
	wg.Wait()
}

// TestWebSocketHeartbeat tests that clients can stay connected for >5 minutes with heartbeat
func TestWebSocketHeartbeat(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping long-running heartbeat test")
	}

	gin.SetMode(gin.TestMode)

	// Create hub and handler
	hub := ws.NewHub()
	go hub.Run()
	defer hub.Stop()

	handler := ws.NewHandler(hub)

	// Setup test server
	router := gin.New()
	v1 := router.Group("/api/v1")
	handler.RegisterRoutes(v1)

	server := httptest.NewServer(router)
	defer server.Close()

	// Replace http with ws in URL
	wsURL := "ws" + strings.TrimPrefix(server.URL, "http") + "/api/v1/ws"

	// Connect client
	dialer := websocket.Dialer{}
	conn, _, err := dialer.Dial(wsURL, nil)
	require.NoError(t, err)
	defer conn.Close()

	// Set up pong handler to respond to pings
	conn.SetPongHandler(func(appData string) error {
		t.Log("Received ping, sending pong")
		return nil
	})

	// Monitor connection for 5+ minutes
	startTime := time.Now()
	testDuration := 5*time.Minute + 30*time.Second
	checkInterval := 30 * time.Second

	// Channel to signal if connection drops
	disconnected := make(chan struct{})

	// Start reader to detect disconnection
	go func() {
		for {
			_, _, err := conn.ReadMessage()
			if err != nil {
				close(disconnected)
				return
			}
		}
	}()

	// Monitor connection
	ticker := time.NewTicker(checkInterval)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			elapsed := time.Since(startTime)
			t.Logf("Connection alive for %v", elapsed)

			// Send a test message to verify connection
			testMsg := map[string]interface{}{
				"type":      "ping",
				"timestamp": time.Now().Unix(),
			}
			if err := conn.WriteJSON(testMsg); err != nil {
				t.Fatalf("Failed to send test message after %v: %v", elapsed, err)
			}

			if elapsed > testDuration {
				t.Logf("Successfully maintained connection for %v", elapsed)
				return
			}

		case <-disconnected:
			elapsed := time.Since(startTime)
			t.Fatalf("Connection dropped after %v", elapsed)

		case <-time.After(10 * time.Minute):
			t.Fatal("Test timeout")
		}
	}
}

// TestWebSocketAuth tests optional bearer token authentication
func TestWebSocketAuth(t *testing.T) {
	gin.SetMode(gin.TestMode)

	// Create hub and handler
	hub := ws.NewHub()
	go hub.Run()
	defer hub.Stop()

	handler := ws.NewHandler(hub)

	// Setup test server
	router := gin.New()
	v1 := router.Group("/api/v1")
	handler.RegisterRoutes(v1)

	server := httptest.NewServer(router)
	defer server.Close()

	wsURL := "ws" + strings.TrimPrefix(server.URL, "http") + "/api/v1/ws"

	tests := []struct {
		name       string
		authHeader string
		shouldWork bool
	}{
		{
			name:       "no auth header",
			authHeader: "",
			shouldWork: true, // Allow unauth in dev
		},
		{
			name:       "with bearer token",
			authHeader: "Bearer test-token-123",
			shouldWork: true,
		},
		{
			name:       "malformed auth header",
			authHeader: "InvalidAuth",
			shouldWork: true, // Still allows connection
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			dialer := websocket.Dialer{}
			header := http.Header{}
			if tt.authHeader != "" {
				header.Set("Authorization", tt.authHeader)
			}

			conn, _, err := dialer.Dial(wsURL, header)
			if tt.shouldWork {
				require.NoError(t, err)
				require.NotNil(t, conn)

				// Verify client is registered
				time.Sleep(50 * time.Millisecond)
				assert.Greater(t, hub.GetClientCount(), 0)

				// Check metrics to see if token was detected
				metrics := hub.GetClientsMetrics()
				if len(metrics) > 0 {
					// Token is marked as true if any auth header is present
					hasToken := tt.authHeader != ""
					assert.Equal(t, hasToken, metrics[0].Token)
				}

				conn.Close()
			} else {
				assert.Error(t, err)
			}
		})
	}
}

// TestCleanShutdown tests graceful shutdown without goroutine leaks
func TestCleanShutdown(t *testing.T) {
	gin.SetMode(gin.TestMode)

	// Get initial goroutine count
	initialGoroutines := countGoroutines()

	// Create hub and handler
	hub := ws.NewHub()
	go hub.Run()

	handler := ws.NewHandler(hub)

	// Setup test server
	router := gin.New()
	v1 := router.Group("/api/v1")
	handler.RegisterRoutes(v1)

	server := httptest.NewServer(router)
	wsURL := "ws" + strings.TrimPrefix(server.URL, "http") + "/api/v1/ws"

	// Connect multiple clients
	numClients := 5
	clients := make([]*websocket.Conn, numClients)

	for i := 0; i < numClients; i++ {
		dialer := websocket.Dialer{}
		conn, _, err := dialer.Dial(wsURL, nil)
		require.NoError(t, err)
		clients[i] = conn
	}

	// Give clients time to connect
	time.Sleep(100 * time.Millisecond)
	assert.Equal(t, numClients, hub.GetClientCount())

	// Close server and hub
	server.Close()
	hub.Stop()

	// Close all client connections
	for _, conn := range clients {
		conn.Close()
	}

	// Give goroutines time to clean up
	time.Sleep(500 * time.Millisecond)

	// Check goroutine count
	finalGoroutines := countGoroutines()
	leaked := finalGoroutines - initialGoroutines

	// Allow a small tolerance for test framework goroutines
	assert.LessOrEqual(t, leaked, 2, "Possible goroutine leak detected: %d goroutines leaked", leaked)
}

// Helper function to count goroutines
func countGoroutines() int {
	return runtime.NumGoroutine()
}
