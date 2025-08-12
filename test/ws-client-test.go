// Simple WebSocket client test to demonstrate functionality
package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"time"

	"github.com/gorilla/websocket"
)

func main() {
	var (
		addr  = flag.String("addr", "localhost:8080", "http service address")
		token = flag.String("token", "", "bearer token for authentication")
	)
	flag.Parse()

	interrupt := make(chan os.Signal, 1)
	signal.Notify(interrupt, os.Interrupt)

	wsURL := fmt.Sprintf("ws://%s/api/v1/ws", *addr)
	log.Printf("Connecting to %s", wsURL)

	// Set up headers
	header := http.Header{}
	if *token != "" {
		header.Set("Authorization", fmt.Sprintf("Bearer %s", *token))
		log.Printf("Using authentication token")
	}

	c, _, err := websocket.DefaultDialer.Dial(wsURL, header)
	if err != nil {
		log.Fatal("dial:", err)
	}
	defer c.Close()

	done := make(chan struct{})

	// Read messages
	go func() {
		defer close(done)
		for {
			_, message, err := c.ReadMessage()
			if err != nil {
				log.Println("read:", err)
				return
			}

			// Try to parse as JSON for pretty printing
			var data interface{}
			if err := json.Unmarshal(message, &data); err == nil {
				pretty, _ := json.MarshalIndent(data, "", "  ")
				log.Printf("Received message:\n%s", pretty)
			} else {
				log.Printf("Received raw: %s", message)
			}
		}
	}()

	// Send test ping periodically
	ticker := time.NewTicker(10 * time.Second)
	defer ticker.Stop()

	log.Printf("WebSocket client connected. Press Ctrl+C to exit.")
	log.Printf("Waiting for broadcast messages...")

	for {
		select {
		case <-done:
			return
		case <-ticker.C:
			// Send a ping message
			msg := map[string]interface{}{
				"type":      "ping",
				"timestamp": time.Now().Unix(),
			}
			if err := c.WriteJSON(msg); err != nil {
				log.Println("write:", err)
				return
			}
			log.Printf("Sent ping")
		case <-interrupt:
			log.Println("interrupt")

			// Cleanly close the connection
			err := c.WriteMessage(websocket.CloseMessage, websocket.FormatCloseMessage(websocket.CloseNormalClosure, ""))
			if err != nil {
				log.Println("write close:", err)
				return
			}
			select {
			case <-done:
			case <-time.After(time.Second):
			}
			return
		}
	}
}
