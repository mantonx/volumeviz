package events

import (
	"context"
	"testing"
	"time"

	"github.com/docker/docker/api/types/events"
	"github.com/mantonx/volumeviz/internal/config"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestEventTypeMapping(t *testing.T) {
	client := &EventsClient{}

	tests := []struct {
		name           string
		eventType      string
		action         string
		expectedResult EventType
	}{
		{
			name:           "volume create",
			eventType:      "volume",
			action:         "create",
			expectedResult: VolumeCreated,
		},
		{
			name:           "volume remove",
			eventType:      "volume", 
			action:         "remove",
			expectedResult: VolumeRemoved,
		},
		{
			name:           "container start",
			eventType:      "container",
			action:         "start",
			expectedResult: ContainerStarted,
		},
		{
			name:           "container stop",
			eventType:      "container",
			action:         "stop",
			expectedResult: ContainerStopped,
		},
		{
			name:           "container die",
			eventType:      "container",
			action:         "die",
			expectedResult: ContainerDied,
		},
		{
			name:           "container destroy",
			eventType:      "container",
			action:         "destroy",
			expectedResult: ContainerDestroyed,
		},
		{
			name:           "unknown event",
			eventType:      "network",
			action:         "create",
			expectedResult: "",
		},
		{
			name:           "unknown action",
			eventType:      "volume",
			action:         "mount",
			expectedResult: "",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			rawEvent := events.Message{
				Type:   events.Type(tt.eventType),
				Action: events.Action(tt.action),
			}
			
			result := client.getEventType(rawEvent)
			assert.Equal(t, tt.expectedResult, result)
		})
	}
}

func TestConvertEvent(t *testing.T) {
	client := &EventsClient{}
	
	now := time.Now()
	timeUnix := now.Unix()
	timeNano := now.UnixNano()

	tests := []struct {
		name          string
		rawEvent      events.Message
		expectedEvent *DockerEvent
		expectNil     bool
	}{
		{
			name: "valid volume create event",
			rawEvent: events.Message{
				Type:     "volume",
				Action:   "create",
				ID:       "vol_123456",
				Time:     timeUnix,
				TimeNano: timeNano,
				Actor: events.Actor{
					Attributes: map[string]string{
						"name": "test-volume",
					},
				},
			},
			expectedEvent: &DockerEvent{
				Type:   VolumeCreated,
				ID:     "vol_123456",
				Name:   "test-volume",
				Action: "create",
				Time:   time.Unix(timeUnix, timeNano),
				Attributes: map[string]string{
					"name": "test-volume",
				},
			},
		},
		{
			name: "valid container start event",
			rawEvent: events.Message{
				Type:     "container",
				Action:   "start",
				ID:       "container_abcdef",
				Time:     timeUnix,
				TimeNano: timeNano,
				Actor: events.Actor{
					Attributes: map[string]string{
						"name": "test-container",
					},
				},
			},
			expectedEvent: &DockerEvent{
				Type:   ContainerStarted,
				ID:     "container_abcdef",
				Name:   "test-container",
				Action: "start",
				Time:   time.Unix(timeUnix, timeNano),
				Attributes: map[string]string{
					"name": "test-container",
				},
			},
		},
		{
			name: "event without name uses ID",
			rawEvent: events.Message{
				Type:     "volume",
				Action:   "remove",
				ID:       "vol_no_name",
				Time:     timeUnix,
				TimeNano: timeNano,
				Actor: events.Actor{
					Attributes: map[string]string{},
				},
			},
			expectedEvent: &DockerEvent{
				Type:       VolumeRemoved,
				ID:         "vol_no_name",
				Name:       "vol_no_name",
				Action:     "remove",
				Time:       time.Unix(timeUnix, timeNano),
				Attributes: map[string]string{},
			},
		},
		{
			name: "unsupported event type returns nil",
			rawEvent: events.Message{
				Type:   "network",
				Action: "create",
				ID:     "net_123",
			},
			expectNil: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result, err := client.convertEvent(tt.rawEvent)
			
			require.NoError(t, err)
			
			if tt.expectNil {
				assert.Nil(t, result)
				return
			}
			
			require.NotNil(t, result)
			assert.Equal(t, tt.expectedEvent.Type, result.Type)
			assert.Equal(t, tt.expectedEvent.ID, result.ID)
			assert.Equal(t, tt.expectedEvent.Name, result.Name)
			assert.Equal(t, tt.expectedEvent.Action, result.Action)
			assert.Equal(t, tt.expectedEvent.Time.Unix(), result.Time.Unix())
			assert.Equal(t, tt.expectedEvent.Attributes, result.Attributes)
		})
	}
}

func TestCalculateBackoff(t *testing.T) {
	cfg := &config.EventsConfig{
		BackoffMinDuration: 1 * time.Second,
		BackoffMaxDuration: 60 * time.Second,
	}
	
	client := &EventsClient{
		config: cfg,
	}

	tests := []struct {
		name             string
		backoffCount     int
		expectedMin      time.Duration
		expectedMax      time.Duration
	}{
		{
			name:         "first attempt",
			backoffCount: 0,
			expectedMin:  1 * time.Second,
			expectedMax:  1 * time.Second,
		},
		{
			name:         "second attempt",
			backoffCount: 1,
			expectedMin:  1 * time.Second,  // min * 2^1 = 2s, with 25% jitter = 1.5-2.5s
			expectedMax:  3 * time.Second,
		},
		{
			name:         "high backoff count should cap at max",
			backoffCount: 10,
			expectedMin:  45 * time.Second, // Should be capped at 60s, with jitter = 45-75s
			expectedMax:  75 * time.Second,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			client.backoffCount = tt.backoffCount
			result := client.calculateBackoff()
			
			assert.GreaterOrEqual(t, result, tt.expectedMin)
			assert.LessOrEqual(t, result, tt.expectedMax)
		})
	}
}

func TestIsConnected(t *testing.T) {
	client := &EventsClient{
		metrics: &EventMetrics{
			Connected: false,
		},
	}
	
	// Initially not connected
	assert.False(t, client.IsConnected())
	
	// Set connected
	client.setConnected(true)
	assert.True(t, client.IsConnected())
	
	// Set disconnected
	client.setConnected(false)
	assert.False(t, client.IsConnected())
}

func TestGetMetrics(t *testing.T) {
	client := &EventsClient{
		eventQueue: make(chan *DockerEvent, 10),
		metrics: &EventMetrics{
			ProcessedTotal:  make(map[EventType]int64),
			ErrorsTotal:     make(map[string]int64),
			ReconcileRuns:   make(map[string]int64),
			DroppedTotal:    5,
			ReconnectsTotal: 3,
			Connected:       true,
		},
	}
	
	// Add some test data
	client.metrics.ProcessedTotal[VolumeCreated] = 10
	client.metrics.ProcessedTotal[ContainerStarted] = 5
	client.metrics.ErrorsTotal["processing"] = 2
	client.metrics.ReconcileRuns["volumes"] = 1
	
	// Add some items to queue to test queue size
	client.eventQueue <- &DockerEvent{Type: VolumeCreated}
	client.eventQueue <- &DockerEvent{Type: ContainerStarted}
	
	metrics := client.GetMetrics()
	
	assert.Equal(t, int64(5), metrics.DroppedTotal)
	assert.Equal(t, int64(3), metrics.ReconnectsTotal)
	assert.Equal(t, client.connected, metrics.Connected)
	assert.Equal(t, 2, metrics.QueueSize)
	assert.Equal(t, int64(10), metrics.ProcessedTotal[VolumeCreated])
	assert.Equal(t, int64(5), metrics.ProcessedTotal[ContainerStarted])
	assert.Equal(t, int64(2), metrics.ErrorsTotal["processing"])
	assert.Equal(t, int64(1), metrics.ReconcileRuns["volumes"])
}

func TestClientProcessEvent(t *testing.T) {
	mockProcessor := &MockEventProcessor{}
	
	client := &EventsClient{
		processor: mockProcessor,
		metrics: &EventMetrics{
			ProcessedTotal: make(map[EventType]int64),
			ErrorsTotal:   make(map[string]int64),
		},
	}
	
	// Create a context for testing
	ctx := context.Background()
	client.ctx = ctx
	
	event := &DockerEvent{
		Type:   VolumeCreated,
		ID:     "vol_123",
		Action: "create",
	}
	
	// Test successful processing
	err := client.processEvent(event)
	assert.NoError(t, err)
	assert.Equal(t, 1, mockProcessor.ProcessEventCallCount)
	assert.Equal(t, event, mockProcessor.LastEvent)
	
	// Test error processing
	mockProcessor.ShouldError = true
	err = client.processEvent(event)
	assert.Error(t, err)
	assert.Equal(t, 2, mockProcessor.ProcessEventCallCount)
}

// MockEventProcessor for testing
type MockEventProcessor struct {
	ProcessEventCallCount int
	LastEvent            *DockerEvent
	ShouldError          bool
}

func (m *MockEventProcessor) ProcessEvent(ctx context.Context, event *DockerEvent) error {
	m.ProcessEventCallCount++
	m.LastEvent = event
	
	if m.ShouldError {
		return assert.AnError
	}
	return nil
}