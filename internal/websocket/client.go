package websocket

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

const (
	// Time allowed to write a message to the peer.
	writeWait = 10 * time.Second

	// Time allowed to read the next pong message from the peer.
	pongWait = 60 * time.Second

	// Send pings to peer with this period. Must be less than pongWait.
	pingPeriod = 30 * time.Second

	// Maximum message size allowed from peer.
	maxMessageSize = 512

	// Maximum missed pongs before dropping client
	maxMissedPongs = 2
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		// Allow connections from any origin
		return true
	},
}

// Client is a middleman between the websocket connection and the hub.
type Client struct {
	hub  *Hub
	conn *websocket.Conn
	send chan []byte

	// Connection metadata
	id           string
	connectedAt  time.Time
	lastPongTime time.Time
	missedPongs  int
	token        string

	// Subscription management
	subscriptions map[string]SubscriptionData // event -> subscription data
	subscMutex    sync.RWMutex
}

// readPump pumps messages from the websocket connection to the hub.
//
// The application runs readPump in a per-connection goroutine. The application
// ensures that there is at most one reader on a connection by executing all
// reads from this goroutine.
func (c *Client) readPump() {
	defer func() {
		c.hub.unregister <- c
		c.conn.Close()
	}()
	c.conn.SetReadLimit(maxMessageSize)
	if err := c.conn.SetReadDeadline(time.Now().Add(pongWait)); err != nil {
		log.Printf("error setting read deadline: %v", err)
		return
	}
	c.conn.SetPongHandler(func(string) error {
		if err := c.conn.SetReadDeadline(time.Now().Add(pongWait)); err != nil {
			log.Printf("ws %s: error setting read deadline in pong handler: %v", c.id, err)
		}
		c.lastPongTime = time.Now()
		c.missedPongs = 0
		return nil
	})
	for {
		_, message, err := c.conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("ws %s: unexpected close error: %v", c.id, err)
			} else {
				duration := time.Since(c.connectedAt)
				log.Printf("ws %s: disconnected after %s (missed pongs: %d)", c.id, duration, c.missedPongs)
			}
			break
		}

		// Handle incoming messages
		var msg Message
		if err := json.Unmarshal(message, &msg); err != nil {
			log.Printf("ws %s: error unmarshaling message: %v", c.id, err)
			continue
		}

		// Handle incoming messages
		switch msg.Type {
		case MessageTypePing:
			pongMsg := Message{
				Type:      MessageTypePong,
				Timestamp: time.Now(),
			}
			c.sendMessage(pongMsg)
		case MessageTypePong:
			c.lastPongTime = time.Now()
			c.missedPongs = 0
		case MessageTypeSubscribe:
			c.handleSubscribe(msg)
		case MessageTypeUnsubscribe:
			c.handleUnsubscribe(msg)
		}
	}
}

// writePump pumps messages from the hub to the websocket connection.
//
// A goroutine running writePump is started for each connection. The
// application ensures that there is at most one writer to a connection by
// executing all writes from this goroutine.
func (c *Client) writePump() {
	ticker := time.NewTicker(pingPeriod)
	defer func() {
		ticker.Stop()
		c.conn.Close()
	}()
	for {
		select {
		case message, ok := <-c.send:
			if err := c.conn.SetWriteDeadline(time.Now().Add(writeWait)); err != nil {
				return
			}
			if !ok {
				// The hub closed the channel.
				if err := c.conn.WriteMessage(websocket.CloseMessage, []byte{}); err != nil {
					log.Printf("error writing close message: %v", err)
				}
				return
			}

			// Send the current message as a separate WebSocket frame
			if err := c.conn.WriteMessage(websocket.TextMessage, message); err != nil {
				log.Printf("error writing message: %v", err)
				return
			}

			// Send any additional queued messages as separate WebSocket frames
			// This ensures each JSON message is sent individually rather than concatenated
			n := len(c.send)
			for i := 0; i < n; i++ {
				queuedMessage := <-c.send
				if err := c.conn.WriteMessage(websocket.TextMessage, queuedMessage); err != nil {
					log.Printf("error writing queued message: %v", err)
					return
				}
			}
		case <-ticker.C:
			// Check missed pongs
			if c.missedPongs >= maxMissedPongs {
				log.Printf("ws %s: dropping client due to %d missed pongs", c.id, c.missedPongs)
				return
			}

			if err := c.conn.SetWriteDeadline(time.Now().Add(writeWait)); err != nil {
				return
			}
			if err := c.conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				log.Printf("ws %s: error sending ping: %v", c.id, err)
				return
			}
			c.missedPongs++
		}
	}
}

// sendMessage sends a message to the client
func (c *Client) sendMessage(message Message) {
	data, err := json.Marshal(message)
	if err != nil {
		log.Printf("ws %s: error marshaling message: %v", c.id, err)
		return
	}

	select {
	case c.send <- data:
	default:
		log.Printf("ws %s: send buffer full, dropping message", c.id)
		close(c.send)
		delete(c.hub.clients, c)
	}
}

// handleSubscribe processes subscription requests from client
func (c *Client) handleSubscribe(msg Message) {
	if msg.Data == nil {
		return
	}

	// Extract subscription data
	subData, ok := msg.Data.(map[string]interface{})
	if !ok {
		return
	}

	event, ok := subData["event"].(string)
	if !ok {
		return
	}

	filters := make(map[string]string)
	if filtersData, ok := subData["filters"].(map[string]interface{}); ok {
		for key, value := range filtersData {
			if strValue, ok := value.(string); ok {
				filters[key] = strValue
			}
		}
	}

	// Store subscription
	c.subscMutex.Lock()
	c.subscriptions[event] = SubscriptionData{
		Event:   event,
		Filters: filters,
	}
	c.subscMutex.Unlock()
}

// handleUnsubscribe processes unsubscription requests from client
func (c *Client) handleUnsubscribe(msg Message) {
	if msg.Data == nil {
		return
	}

	// Extract event name
	if eventData, ok := msg.Data.(map[string]interface{}); ok {
		if event, ok := eventData["event"].(string); ok {
			c.subscMutex.Lock()
			delete(c.subscriptions, event)
			c.subscMutex.Unlock()
		}
	}
}

// GetMetrics returns client connection metrics
func (c *Client) GetMetrics() ClientMetrics {
	return ClientMetrics{
		ID:           c.id,
		ConnectedAt:  c.connectedAt,
		LastPongTime: c.lastPongTime,
		MissedPongs:  c.missedPongs,
		Token:        c.token != "",
	}
}

// ClientMetrics contains client connection metrics
type ClientMetrics struct {
	ID           string    `json:"id"`
	ConnectedAt  time.Time `json:"connected_at"`
	LastPongTime time.Time `json:"last_pong_time"`
	MissedPongs  int       `json:"missed_pongs"`
	Token        bool      `json:"has_token"`
}

// ServeWS handles websocket requests from the peer.
func ServeWS(hub *Hub, w http.ResponseWriter, r *http.Request) {
	// Extract token from headers (optional)
	token := r.Header.Get("Authorization")
	if token != "" && len(token) > 7 && token[:7] == "Bearer " {
		token = token[7:]
	}

	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("websocket upgrade error: %v", err)
		return
	}

	// Generate unique client ID
	clientID := generateClientID()

	client := &Client{
		hub:           hub,
		conn:          conn,
		send:          make(chan []byte, 256),
		id:            clientID,
		connectedAt:   time.Now(),
		lastPongTime:  time.Now(),
		token:         token,
		subscriptions: make(map[string]SubscriptionData),
	}

	client.hub.register <- client

	log.Printf("ws %s: new connection established (has_token: %v)", clientID, token != "")

	// Allow collection of memory referenced by the caller by doing all work in
	// new goroutines.
	go client.writePump()
	go client.readPump()
}

// generateClientID generates a unique client identifier
func generateClientID() string {
	return fmt.Sprintf("client_%d", time.Now().UnixNano())
}

// isSubscribedTo checks if client is subscribed to a specific event with optional filters
func (c *Client) isSubscribedTo(event string, filters map[string]string) bool {
	c.subscMutex.RLock()
	defer c.subscMutex.RUnlock()

	subscription, exists := c.subscriptions[event]
	if !exists {
		return false
	}

	// Check filters if provided
	for key, value := range filters {
		if subValue, ok := subscription.Filters[key]; ok {
			if subValue != value {
				return false
			}
		}
	}

	return true
}

// getSubscriptions returns all active subscriptions for this client
func (c *Client) getSubscriptions() map[string]SubscriptionData {
	c.subscMutex.RLock()
	defer c.subscMutex.RUnlock()

	// Create a copy to avoid race conditions
	subs := make(map[string]SubscriptionData)
	for k, v := range c.subscriptions {
		subs[k] = v
	}
	return subs
}
