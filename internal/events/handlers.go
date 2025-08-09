package events

import (
	"context"
	"fmt"
	"log"
	"time"

	"github.com/docker/docker/api/types"
	"github.com/mantonx/volumeviz/internal/database"
	"github.com/mantonx/volumeviz/internal/interfaces"
)

// EventHandlerService implements EventHandler and EventProcessor interfaces
type EventHandlerService struct {
	dockerClient interfaces.DockerClient
	repository   Repository
	promMetrics  *EventMetricsCollector
}

// NewEventHandlerService creates a new event handler service
func NewEventHandlerService(dockerClient interfaces.DockerClient, repository Repository, promMetrics *EventMetricsCollector) *EventHandlerService {
	return &EventHandlerService{
		dockerClient: dockerClient,
		repository:   repository,
		promMetrics:  promMetrics,
	}
}

// ProcessEvent routes events to appropriate handlers
func (h *EventHandlerService) ProcessEvent(ctx context.Context, event *DockerEvent) error {
	log.Printf("[DEBUG] Processing event: %s %s (%s)", event.Action, event.ID, event.Name)

	switch event.Type {
	case VolumeCreated:
		return h.HandleVolumeCreate(ctx, event)
	case VolumeRemoved:
		return h.HandleVolumeRemove(ctx, event)
	case ContainerStarted:
		return h.HandleContainerStart(ctx, event)
	case ContainerStopped:
		return h.HandleContainerStop(ctx, event)
	case ContainerDied:
		return h.HandleContainerDie(ctx, event)
	case ContainerDestroyed:
		return h.HandleContainerDestroy(ctx, event)
	default:
		return fmt.Errorf("unknown event type: %s", event.Type)
	}
}

// HandleVolumeCreate handles volume creation events
func (h *EventHandlerService) HandleVolumeCreate(ctx context.Context, event *DockerEvent) error {
	// Get volume details from Docker API
	volumeResp, err := h.dockerClient.InspectVolume(ctx, event.Name)
	if err != nil {
		return fmt.Errorf("failed to inspect volume %s: %w", event.Name, err)
	}

	// Convert to database model
	volume := &database.Volume{
		VolumeID:   volumeResp.Name,
		Name:       volumeResp.Name,
		Driver:     volumeResp.Driver,
		Mountpoint: volumeResp.Mountpoint,
		Labels:     database.Labels(volumeResp.Labels),
		Options:    database.Labels(volumeResp.Options),
		Scope:      volumeResp.Scope,
		Status:     "active",
		IsActive:   true,
		BaseModel: database.BaseModel{
			CreatedAt: event.Time,
			UpdatedAt: event.Time,
		},
	}

	// Parse created time from volume if available
	if createdAtStr, ok := volumeResp.Labels["created"]; ok {
		if parsedTime, err := time.Parse(time.RFC3339, createdAtStr); err == nil {
			volume.CreatedAt = parsedTime
		}
	}

	// Upsert volume (idempotent operation)
	if err := h.repository.UpsertVolume(ctx, volume); err != nil {
		return fmt.Errorf("failed to upsert volume %s: %w", event.Name, err)
	}

	if h.promMetrics != nil {
		h.promMetrics.RecordVolumeSync("create", "event")
	}
	
	log.Printf("[INFO] Volume created: %s (driver: %s)", event.Name, volume.Driver)
	return nil
}

// HandleVolumeRemove handles volume removal events
func (h *EventHandlerService) HandleVolumeRemove(ctx context.Context, event *DockerEvent) error {
	// Delete volume from database (cascade will remove attachments)
	if err := h.repository.DeleteVolume(ctx, event.Name); err != nil {
		return fmt.Errorf("failed to delete volume %s: %w", event.Name, err)
	}

	if h.promMetrics != nil {
		h.promMetrics.RecordResourceRemoved("volume", "event")
	}

	log.Printf("[INFO] Volume removed: %s", event.Name)
	return nil
}

// HandleContainerStart handles container start events
func (h *EventHandlerService) HandleContainerStart(ctx context.Context, event *DockerEvent) error {
	return h.updateContainerAndMounts(ctx, event, "running")
}

// HandleContainerStop handles container stop events  
func (h *EventHandlerService) HandleContainerStop(ctx context.Context, event *DockerEvent) error {
	return h.updateContainerAndMounts(ctx, event, "stopped")
}

// HandleContainerDie handles container die events
func (h *EventHandlerService) HandleContainerDie(ctx context.Context, event *DockerEvent) error {
	return h.updateContainerAndMounts(ctx, event, "exited")
}

// HandleContainerDestroy handles container destroy events
func (h *EventHandlerService) HandleContainerDestroy(ctx context.Context, event *DockerEvent) error {
	// Deactivate all volume mounts for this container
	if err := h.repository.DeactivateVolumeMounts(ctx, event.ID); err != nil {
		log.Printf("[WARN] Failed to deactivate volume mounts for container %s: %v", event.ID, err)
	}

	// Delete container from database
	if err := h.repository.DeleteContainer(ctx, event.ID); err != nil {
		return fmt.Errorf("failed to delete container %s: %w", event.ID, err)
	}

	log.Printf("[INFO] Container destroyed: %s", event.ID)
	return nil
}

// updateContainerAndMounts updates container state and its volume mounts
func (h *EventHandlerService) updateContainerAndMounts(ctx context.Context, event *DockerEvent, state string) error {
	// Get container details from Docker API
	containerJSON, err := h.dockerClient.ContainerInspect(ctx, event.ID)
	if err != nil {
		return fmt.Errorf("failed to inspect container %s: %w", event.ID, err)
	}

	// Update container record
	container := h.convertContainerToModel(containerJSON, state, event.Time)
	if err := h.repository.UpsertContainer(ctx, container); err != nil {
		return fmt.Errorf("failed to upsert container %s: %w", event.ID, err)
	}

	// Update volume mounts
	if err := h.updateVolumeMounts(ctx, event.ID, containerJSON.Mounts, event.Time); err != nil {
		return fmt.Errorf("failed to update volume mounts for container %s: %w", event.ID, err)
	}

	log.Printf("[INFO] Container %s: %s (mounts: %d)", state, event.ID, len(containerJSON.Mounts))
	return nil
}

// convertContainerToModel converts Docker container JSON to database model
func (h *EventHandlerService) convertContainerToModel(containerJSON types.ContainerJSON, state string, eventTime time.Time) *database.Container {
	container := &database.Container{
		ContainerID: containerJSON.ID,
		Name:        containerJSON.Name,
		Image:       containerJSON.Config.Image,
		State:       state,
		Status:      containerJSON.State.Status,
		Labels:      database.Labels(containerJSON.Config.Labels),
		IsActive:    state == "running",
		BaseModel: database.BaseModel{
			UpdatedAt: eventTime,
		},
	}

	// Set started/finished times if available
	if containerJSON.State.StartedAt != "" {
		if startTime, err := time.Parse(time.RFC3339Nano, containerJSON.State.StartedAt); err == nil {
			container.StartedAt = &startTime
			container.BaseModel.CreatedAt = startTime
		}
	}

	if containerJSON.State.FinishedAt != "" {
		if finishTime, err := time.Parse(time.RFC3339Nano, containerJSON.State.FinishedAt); err == nil {
			container.FinishedAt = &finishTime
		}
	}

	return container
}

// updateVolumeMounts processes container mounts and updates volume_mounts table
func (h *EventHandlerService) updateVolumeMounts(ctx context.Context, containerID string, mounts []types.MountPoint, eventTime time.Time) error {
	// First, deactivate all existing mounts for this container
	if err := h.repository.DeactivateVolumeMounts(ctx, containerID); err != nil {
		return fmt.Errorf("failed to deactivate existing mounts: %w", err)
	}

	// Process each mount
	for _, mount := range mounts {
		// Only process volume mounts (not bind mounts)
		if mount.Type != "volume" {
			continue
		}

		// Determine access mode
		accessMode := "rw"
		if !mount.RW {
			accessMode = "ro"
		}

		// Create volume mount record
		volumeMount := &database.VolumeMount{
			VolumeID:    mount.Name,
			ContainerID: containerID,
			MountPath:   mount.Destination,
			AccessMode:  accessMode,
			IsActive:    true,
			BaseModel: database.BaseModel{
				CreatedAt: eventTime,
				UpdatedAt: eventTime,
			},
		}

		// Upsert the mount
		if err := h.repository.UpsertVolumeMount(ctx, volumeMount); err != nil {
			log.Printf("[WARN] Failed to upsert volume mount %s->%s: %v", mount.Name, containerID, err)
			continue
		}

		log.Printf("[DEBUG] Volume mount updated: %s -> %s (%s, %s)", mount.Name, containerID, mount.Destination, accessMode)
	}

	return nil
}