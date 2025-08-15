package events

import (
	"context"
	"fmt"
	"log"
	"time"

	containertypes "github.com/docker/docker/api/types/container"
	"github.com/mantonx/volumeviz/internal/interfaces"
	"github.com/mantonx/volumeviz/internal/models"
	"github.com/mantonx/volumeviz/internal/realtime"
)

// EventHandlerService implements EventHandler and EventProcessor interfaces
type EventHandlerService struct {
	dockerClient      interfaces.DockerClient
	repository        Repository
	promMetrics       *EventMetricsCollector
	realtimePublisher *realtime.Publisher
}

// NewEventHandlerService creates a new event handler service
func NewEventHandlerService(dockerClient interfaces.DockerClient, repository Repository, promMetrics *EventMetricsCollector, realtimePublisher *realtime.Publisher) *EventHandlerService {
	return &EventHandlerService{
		dockerClient:      dockerClient,
		repository:        repository,
		promMetrics:       promMetrics,
		realtimePublisher: realtimePublisher,
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

	// Convert to store model
	volume := &models.Volume{
		VolumeID:   volumeResp.Name,
		Name:       volumeResp.Name,
		Driver:     volumeResp.Driver,
		Mountpoint: volumeResp.Mountpoint,
		Labels:     volumeResp.Labels,
		Options:    volumeResp.Options,
		Scope:      volumeResp.Scope,
		Status:     "active",
		IsActive:   true,
		CreatedAt:  event.Time,
		UpdatedAt:  event.Time,
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

	// Publish volume_update event
	if h.realtimePublisher != nil {
		updateData := realtime.VolumeUpdateData{
			VolumeID:   volume.VolumeID,
			VolumeName: volume.Name,
			Action:     "created",
			Details: map[string]interface{}{
				"driver":     volume.Driver,
				"mountpoint": volume.Mountpoint,
				"scope":      volume.Scope,
				"labels":     volume.Labels,
			},
		}
		h.realtimePublisher.PublishVolumeUpdate(updateData)
	}

	log.Printf("[INFO] Volume created: %s (driver: %s)", event.Name, volume.Driver)
	return nil
}

// HandleVolumeRemove handles volume removal events
func (h *EventHandlerService) HandleVolumeRemove(ctx context.Context, event *DockerEvent) error {
	// Publish volume_update event before removal
	if h.realtimePublisher != nil {
		updateData := realtime.VolumeUpdateData{
			VolumeID:   event.Name,
			VolumeName: event.Name,
			Action:     "removed",
			Details: map[string]interface{}{
				"timestamp": event.Time,
			},
		}
		h.realtimePublisher.PublishVolumeUpdate(updateData)
	}

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
	containerJSON, err := h.dockerClient.InspectContainer(ctx, event.ID)
	if err != nil {
		return fmt.Errorf("failed to inspect container %s: %w", event.ID, err)
	}

	// Update container record
	container := h.convertContainerToModel(containerJSON, state, event.Time)
	if err := h.repository.UpsertContainer(ctx, container); err != nil {
		return fmt.Errorf("failed to upsert container %s: %w", event.ID, err)
	}

	// Update volume mounts
	if err := h.updateVolumeMounts(ctx, event.ID, containerJSON.Mounts, event.Time, state); err != nil {
		return fmt.Errorf("failed to update volume mounts for container %s: %w", event.ID, err)
	}

	log.Printf("[INFO] Container %s: %s (mounts: %d)", state, event.ID, len(containerJSON.Mounts))
	return nil
}

// convertContainerToModel converts Docker container JSON to store model
func (h *EventHandlerService) convertContainerToModel(containerJSON containertypes.InspectResponse, state string, eventTime time.Time) *models.Container {
	container := &models.Container{
		ContainerID: containerJSON.ID,
		Name:        containerJSON.Name,
		Image:       containerJSON.Config.Image,
		State:       state,
		Status:      containerJSON.State.Status,
		Labels:      containerJSON.Config.Labels,
		IsActive:    state == "running",
		CreatedAt:   eventTime,
		UpdatedAt:   eventTime,
	}

	// Set started/finished times if available
	if containerJSON.State.StartedAt != "" {
		if startTime, err := time.Parse(time.RFC3339Nano, containerJSON.State.StartedAt); err == nil {
			container.StartedAt = &startTime
			container.CreatedAt = startTime
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
func (h *EventHandlerService) updateVolumeMounts(ctx context.Context, containerID string, mounts []containertypes.MountPoint, eventTime time.Time, containerState string) error {
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
		volumeMount := &models.VolumeMount{
			VolumeID:    mount.Name,
			ContainerID: containerID,
			MountPath:   mount.Destination,
			AccessMode:  accessMode,
			IsActive:    true,
			CreatedAt:   eventTime,
			UpdatedAt:   eventTime,
		}

		// Upsert the mount
		if err := h.repository.UpsertVolumeMount(ctx, volumeMount); err != nil {
			log.Printf("[WARN] Failed to upsert volume mount %s->%s: %v", mount.Name, containerID, err)
			continue
		}

		// Publish volume_update event for attach/detach
		if h.realtimePublisher != nil {
			var action string
			if containerState == "running" {
				action = "attached"
			} else {
				action = "detached"
			}

			updateData := realtime.VolumeUpdateData{
				VolumeID:    mount.Name,
				VolumeName:  mount.Name,
				Action:      action,
				ContainerID: containerID,
				Details: map[string]interface{}{
					"mount_path":      mount.Destination,
					"access_mode":     accessMode,
					"container_id":    containerID,
					"container_state": containerState,
					"timestamp":       eventTime,
				},
			}
			h.realtimePublisher.PublishVolumeUpdate(updateData)
		}

		log.Printf("[DEBUG] Volume mount updated: %s -> %s (%s, %s)", mount.Name, containerID, mount.Destination, accessMode)
	}

	return nil
}
