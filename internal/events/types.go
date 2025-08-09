package events

import (
	"context"
	"time"

	"github.com/docker/docker/api/types/events"
	"github.com/mantonx/volumeviz/internal/database"
)

// EventType represents the type of Docker event we're interested in
type EventType string

const (
	// Volume events
	VolumeCreated EventType = "volume.create"
	VolumeRemoved EventType = "volume.remove"

	// Container events
	ContainerStarted   EventType = "container.start"
	ContainerStopped   EventType = "container.stop"
	ContainerDied      EventType = "container.die"
	ContainerDestroyed EventType = "container.destroy"
)

// DockerEvent represents a processed Docker event
type DockerEvent struct {
	Type        EventType         `json:"type"`
	ID          string            `json:"id"`           // Volume ID or Container ID
	Name        string            `json:"name"`         // Volume name or Container name
	Action      string            `json:"action"`       // create, remove, start, stop, die, destroy
	Time        time.Time         `json:"time"`
	Attributes  map[string]string `json:"attributes"`
	RawEvent    events.Message    `json:"raw_event"`
}

// EventProcessor defines the interface for processing Docker events
type EventProcessor interface {
	ProcessEvent(ctx context.Context, event *DockerEvent) error
}

// EventHandler defines event-specific handlers
type EventHandler interface {
	HandleVolumeCreate(ctx context.Context, event *DockerEvent) error
	HandleVolumeRemove(ctx context.Context, event *DockerEvent) error
	HandleContainerStart(ctx context.Context, event *DockerEvent) error
	HandleContainerStop(ctx context.Context, event *DockerEvent) error
	HandleContainerDie(ctx context.Context, event *DockerEvent) error
	HandleContainerDestroy(ctx context.Context, event *DockerEvent) error
}

// Reconciler defines the interface for periodic reconciliation
type Reconciler interface {
	ReconcileVolumes(ctx context.Context) error
	ReconcileContainers(ctx context.Context) error
	FullReconcile(ctx context.Context) error
}

// EventService defines the main events service interface
type EventService interface {
	Start(ctx context.Context) error
	Stop(ctx context.Context) error
	IsConnected() bool
	GetLastEventTime() *time.Time
	GetMetrics() *EventMetrics
}

// EventMetrics holds metrics for event processing
type EventMetrics struct {
	ProcessedTotal   map[EventType]int64 `json:"processed_total"`
	ErrorsTotal      map[string]int64    `json:"errors_total"`
	DroppedTotal     int64               `json:"dropped_total"`
	ReconnectsTotal  int64               `json:"reconnects_total"`
	ReconcileRuns    map[string]int64    `json:"reconcile_runs"`
	LastEventTime    *time.Time          `json:"last_event_time"`
	LastReconnectTime *time.Time         `json:"last_reconnect_time"`
	Connected        bool                `json:"connected"`
	QueueSize        int                 `json:"queue_size"`
}

// Repository defines database operations for events
type Repository interface {
	// Volume operations
	UpsertVolume(ctx context.Context, volume *database.Volume) error
	DeleteVolume(ctx context.Context, volumeID string) error
	GetVolumeByName(ctx context.Context, name string) (*database.Volume, error)

	// Container operations  
	UpsertContainer(ctx context.Context, container *database.Container) error
	DeleteContainer(ctx context.Context, containerID string) error
	GetContainerByID(ctx context.Context, containerID string) (*database.Container, error)

	// Volume mount operations
	UpsertVolumeMount(ctx context.Context, mount *database.VolumeMount) error
	DeleteVolumeMount(ctx context.Context, volumeID, containerID string) error
	GetVolumeMountsByContainer(ctx context.Context, containerID string) ([]*database.VolumeMount, error)
	GetVolumeMountsByVolume(ctx context.Context, volumeID string) ([]*database.VolumeMount, error)
	DeactivateVolumeMounts(ctx context.Context, containerID string) error

	// Bulk operations for reconciliation
	ListAllVolumes(ctx context.Context) ([]*database.Volume, error)
	ListAllContainers(ctx context.Context) ([]*database.Container, error)
	ListAllVolumeMounts(ctx context.Context) ([]*database.VolumeMount, error)
}