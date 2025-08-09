package events

import (
	"context"
	"fmt"
	"io"
	"log"
	"math"
	"math/rand"
	"sync"
	"time"

	"github.com/docker/docker/api/types/events"
	"github.com/docker/docker/api/types/filters"
	"github.com/mantonx/volumeviz/internal/config"
	"github.com/mantonx/volumeviz/internal/interfaces"
)

// EventsClient handles Docker events streaming and processing
type EventsClient struct {
	dockerClient interfaces.DockerClient
	config       *config.EventsConfig
	processor    EventProcessor
	reconciler   Reconciler
	metrics      *EventMetrics
	promMetrics  *EventMetricsCollector
	
	// Channel for events processing
	eventQueue   chan *DockerEvent
	ctx          context.Context
	cancel       context.CancelFunc
	wg           sync.WaitGroup
	
	// Connection state
	connected    bool
	connMutex    sync.RWMutex
	lastEventTime *time.Time
	streamStartTime *time.Time
	
	// Backoff state
	backoffCount int
	maxBackoff   int
}

// NewEventsClient creates a new Docker events client
func NewEventsClient(dockerClient interfaces.DockerClient, config *config.EventsConfig, processor EventProcessor, reconciler Reconciler, promMetrics *EventMetricsCollector) *EventsClient {
	return &EventsClient{
		dockerClient: dockerClient,
		config:       config,
		processor:    processor,
		reconciler:   reconciler,
		promMetrics:  promMetrics,
		eventQueue:   make(chan *DockerEvent, config.QueueSize),
		metrics: &EventMetrics{
			ProcessedTotal:  make(map[EventType]int64),
			ErrorsTotal:     make(map[string]int64),
			ReconcileRuns:   make(map[string]int64),
			Connected:       false,
		},
		maxBackoff: int(config.BackoffMaxDuration.Seconds()),
	}
}

// Start begins Docker events streaming and processing
func (c *EventsClient) Start(ctx context.Context) error {
	if !c.config.Enabled {
		log.Printf("[INFO] Docker events integration disabled")
		return nil
	}

	c.ctx, c.cancel = context.WithCancel(ctx)

	log.Printf("[INFO] Starting Docker events client (queue size: %d, reconcile interval: %v)", 
		c.config.QueueSize, c.config.ReconcileInterval)

	// Start event processor worker
	c.wg.Add(1)
	go c.processEvents()

	// Start events streaming with retry logic
	c.wg.Add(1)
	go c.streamEventsWithRetry()

	// Start periodic reconciliation if configured
	if c.config.ReconcileInterval > 0 && c.reconciler != nil {
		c.wg.Add(1)
		go c.runPeriodicReconciliation()
	}

	return nil
}

// Stop gracefully shuts down the events client
func (c *EventsClient) Stop(ctx context.Context) error {
	if c.cancel != nil {
		c.cancel()
	}

	// Wait for goroutines to finish
	done := make(chan struct{})
	go func() {
		c.wg.Wait()
		close(done)
	}()

	select {
	case <-done:
		log.Printf("[INFO] Docker events client stopped gracefully")
	case <-ctx.Done():
		log.Printf("[WARN] Docker events client shutdown timeout")
	}

	close(c.eventQueue)
	return nil
}

// IsConnected returns the current connection status
func (c *EventsClient) IsConnected() bool {
	c.connMutex.RLock()
	defer c.connMutex.RUnlock()
	return c.connected
}

// GetLastEventTime returns the timestamp of the last processed event
func (c *EventsClient) GetLastEventTime() *time.Time {
	return c.lastEventTime
}

// GetMetrics returns current event processing metrics
func (c *EventsClient) GetMetrics() *EventMetrics {
	c.connMutex.RLock()
	defer c.connMutex.RUnlock()
	
	queueSize := len(c.eventQueue)
	
	// Update Prometheus queue size metric
	if c.promMetrics != nil {
		c.promMetrics.SetEventQueueSize(queueSize)
	}
	
	// Make a copy to avoid race conditions
	metrics := &EventMetrics{
		ProcessedTotal:    make(map[EventType]int64),
		ErrorsTotal:      make(map[string]int64),
		ReconcileRuns:    make(map[string]int64),
		DroppedTotal:     c.metrics.DroppedTotal,
		ReconnectsTotal:  c.metrics.ReconnectsTotal,
		LastEventTime:    c.lastEventTime,
		LastReconnectTime: c.metrics.LastReconnectTime,
		Connected:        c.connected,
		QueueSize:        queueSize,
	}

	// Copy maps
	for k, v := range c.metrics.ProcessedTotal {
		metrics.ProcessedTotal[k] = v
	}
	for k, v := range c.metrics.ErrorsTotal {
		metrics.ErrorsTotal[k] = v
	}
	for k, v := range c.metrics.ReconcileRuns {
		metrics.ReconcileRuns[k] = v
	}

	return metrics
}

// streamEventsWithRetry handles events streaming with automatic reconnection
func (c *EventsClient) streamEventsWithRetry() {
	defer c.wg.Done()

	for {
		select {
		case <-c.ctx.Done():
			return
		default:
		}

		if err := c.streamEvents(); err != nil {
			c.setConnected(false)
			c.metrics.ErrorsTotal["stream"]++
			if c.promMetrics != nil {
				c.promMetrics.RecordEventFailed("stream", "")
				// Record stream duration if we had a connection
				if c.streamStartTime != nil {
					duration := time.Since(*c.streamStartTime)
					c.promMetrics.RecordStreamDuration(duration.Seconds())
				}
			}
			log.Printf("[ERROR] Docker events stream error: %v", err)

			// Exponential backoff with jitter
			backoffDuration := c.calculateBackoff()
			log.Printf("[INFO] Reconnecting to Docker events in %v (attempt %d)", backoffDuration, c.backoffCount+1)

			select {
			case <-time.After(backoffDuration):
				c.backoffCount++
				c.metrics.ReconnectsTotal++
				now := time.Now()
				c.metrics.LastReconnectTime = &now
				if c.promMetrics != nil {
					c.promMetrics.RecordReconnect()
				}
			case <-c.ctx.Done():
				return
			}
		} else {
			// Reset backoff on successful connection
			c.backoffCount = 0
		}
	}
}

// streamEvents connects to Docker events API and streams events
func (c *EventsClient) streamEvents() error {
	// Create filters for volume and container events
	eventFilters := filters.NewArgs()
	eventFilters.Add("type", "volume")
	eventFilters.Add("type", "container")

	log.Printf("[INFO] Connecting to Docker events API...")

	// Use our interface's Events method
	eventCh, errCh := c.dockerClient.Events(c.ctx, events.ListOptions{
		Filters: eventFilters,
	})

	c.setConnected(true)
	now := time.Now()
	c.streamStartTime = &now
	log.Printf("[INFO] Connected to Docker events API")

	for {
		select {
		case event := <-eventCh:
			if err := c.handleRawEvent(event); err != nil {
				log.Printf("[ERROR] Failed to handle event: %v", err)
				c.metrics.ErrorsTotal["handler"]++
			}
		case err := <-errCh:
			if err != nil && err != io.EOF {
				return fmt.Errorf("events stream error: %w", err)
			}
			return nil
		case <-c.ctx.Done():
			return nil
		}
	}
}

// handleRawEvent processes a raw Docker event and converts it to our internal format
func (c *EventsClient) handleRawEvent(rawEvent events.Message) error {
	// Convert raw event to our internal format
	dockerEvent, err := c.convertEvent(rawEvent)
	if err != nil {
		return fmt.Errorf("failed to convert event: %w", err)
	}

	// Skip events we don't care about
	if dockerEvent == nil {
		return nil
	}

	// Try to enqueue event (non-blocking)
	select {
	case c.eventQueue <- dockerEvent:
		// Successfully enqueued
	default:
		// Queue is full, drop the event and increment counter
		c.metrics.DroppedTotal++
		if c.promMetrics != nil {
			c.promMetrics.RecordEventDropped()
		}
		log.Printf("[WARN] Event queue full, dropping event: %s %s", dockerEvent.Action, dockerEvent.ID)
	}

	return nil
}

// convertEvent converts a raw Docker event to our internal DockerEvent
func (c *EventsClient) convertEvent(rawEvent events.Message) (*DockerEvent, error) {
	eventType := c.getEventType(rawEvent)
	if eventType == "" {
		// Not an event we care about
		return nil, nil
	}

	dockerEvent := &DockerEvent{
		Type:       eventType,
		ID:         rawEvent.ID,
		Action:     string(rawEvent.Action),
		Time:       time.Unix(rawEvent.Time, rawEvent.TimeNano),
		Attributes: rawEvent.Actor.Attributes,
		RawEvent:   rawEvent,
	}

	// Extract name from attributes or use ID as fallback
	if name, ok := rawEvent.Actor.Attributes["name"]; ok {
		dockerEvent.Name = name
	} else {
		dockerEvent.Name = rawEvent.ID
	}

	return dockerEvent, nil
}

// getEventType maps Docker event type/action to our internal EventType
func (c *EventsClient) getEventType(event events.Message) EventType {
	switch event.Type {
	case "volume":
		switch event.Action {
		case "create":
			return VolumeCreated
		case "remove":
			return VolumeRemoved
		}
	case "container":
		switch event.Action {
		case "start":
			return ContainerStarted
		case "stop":
			return ContainerStopped
		case "die":
			return ContainerDied
		case "destroy":
			return ContainerDestroyed
		}
	}
	return ""
}

// processEvents runs the event processing loop
func (c *EventsClient) processEvents() {
	defer c.wg.Done()

	for {
		select {
		case event, ok := <-c.eventQueue:
			if !ok {
				// Channel closed, exit
				return
			}
			
			if err := c.processEvent(event); err != nil {
				log.Printf("[ERROR] Failed to process event %s %s: %v", event.Action, event.ID, err)
				c.metrics.ErrorsTotal["processing"]++
				if c.promMetrics != nil {
					c.promMetrics.RecordEventFailed("processing", event.Type)
				}
			} else {
				c.metrics.ProcessedTotal[event.Type]++
				c.lastEventTime = &event.Time
				if c.promMetrics != nil {
					c.promMetrics.RecordEventProcessed(event.Type, event.Action)
					c.promMetrics.SetLastEventTime(float64(event.Time.Unix()))
				}
			}
		case <-c.ctx.Done():
			return
		}
	}
}

// processEvent processes a single event using the configured processor
func (c *EventsClient) processEvent(event *DockerEvent) error {
	ctx, cancel := context.WithTimeout(c.ctx, 30*time.Second)
	defer cancel()

	return c.processor.ProcessEvent(ctx, event)
}

// calculateBackoff calculates exponential backoff with jitter
func (c *EventsClient) calculateBackoff() time.Duration {
	if c.backoffCount == 0 {
		return c.config.BackoffMinDuration
	}

	// Exponential backoff: min * 2^count
	exponential := float64(c.config.BackoffMinDuration.Nanoseconds()) * math.Pow(2, float64(c.backoffCount))
	
	// Cap at max backoff
	maxNanos := float64(c.config.BackoffMaxDuration.Nanoseconds())
	if exponential > maxNanos {
		exponential = maxNanos
	}

	// Add jitter (±25%)
	jitter := exponential * 0.25 * (rand.Float64()*2 - 1)
	backoffNanos := int64(exponential + jitter)
	
	return time.Duration(backoffNanos)
}

// runPeriodicReconciliation runs reconciliation at configured intervals
func (c *EventsClient) runPeriodicReconciliation() {
	defer c.wg.Done()
	
	ticker := time.NewTicker(c.config.ReconcileInterval)
	defer ticker.Stop()
	
	log.Printf("[INFO] Starting periodic reconciliation every %v", c.config.ReconcileInterval)
	
	// Run initial reconciliation on startup
	if err := c.runReconciliation(); err != nil {
		log.Printf("[ERROR] Initial reconciliation failed: %v", err)
	}
	
	for {
		select {
		case <-ticker.C:
			if err := c.runReconciliation(); err != nil {
				log.Printf("[ERROR] Periodic reconciliation failed: %v", err)
			}
		case <-c.ctx.Done():
			return
		}
	}
}

// runReconciliation executes a full reconciliation cycle
func (c *EventsClient) runReconciliation() error {
	ctx, cancel := context.WithTimeout(c.ctx, 5*time.Minute)
	defer cancel()
	
	return c.reconciler.FullReconcile(ctx)
}

// setConnected safely sets the connection status
func (c *EventsClient) setConnected(connected bool) {
	c.connMutex.Lock()
	defer c.connMutex.Unlock()
	c.connected = connected
	c.metrics.Connected = connected
	if c.promMetrics != nil {
		c.promMetrics.SetConnectionStatus(connected)
	}
}