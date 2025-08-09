package events

import (
	"context"
	"fmt"
	"log"
	"time"

	"github.com/docker/docker/api/types"
	"github.com/docker/docker/api/types/volume"
	"github.com/mantonx/volumeviz/internal/config"
	"github.com/mantonx/volumeviz/internal/database"
	"github.com/mantonx/volumeviz/internal/interfaces"
)

// ReconcilerService implements the Reconciler interface
type ReconcilerService struct {
	dockerClient interfaces.DockerClient
	repository   Repository
	config       *config.EventsConfig
	metrics      *EventMetrics
	promMetrics  *EventMetricsCollector
}

// NewReconcilerService creates a new reconciliation service
func NewReconcilerService(dockerClient interfaces.DockerClient, repository Repository, config *config.EventsConfig, metrics *EventMetrics, promMetrics *EventMetricsCollector) *ReconcilerService {
	return &ReconcilerService{
		dockerClient: dockerClient,
		repository:   repository,
		config:       config,
		metrics:      metrics,
		promMetrics:  promMetrics,
	}
}

// ReconcileVolumes syncs database volumes with Docker daemon state
func (r *ReconcilerService) ReconcileVolumes(ctx context.Context) error {
	log.Printf("[INFO] Starting volume reconciliation...")
	start := time.Now()
	defer func() {
		duration := time.Since(start)
		r.metrics.ReconcileRuns["volumes"]++
		if r.promMetrics != nil {
			r.promMetrics.RecordReconciliationRun("volumes", duration.Seconds())
		}
		log.Printf("[INFO] Volume reconciliation completed in %v", duration)
	}()

	// Get current volumes from Docker
	dockerVolumes, err := r.dockerClient.ListVolumes(ctx, nil)
	if err != nil {
		return fmt.Errorf("failed to list Docker volumes: %w", err)
	}

	// Get current volumes from database
	dbVolumes, err := r.repository.ListAllVolumes(ctx)
	if err != nil {
		return fmt.Errorf("failed to list database volumes: %w", err)
	}

	// Create maps for efficient lookup
	dockerVolumeMap := make(map[string]bool)
	for _, vol := range dockerVolumes.Volumes {
		dockerVolumeMap[vol.Name] = true
	}

	dbVolumeMap := make(map[string]*database.Volume)
	for _, vol := range dbVolumes {
		dbVolumeMap[vol.VolumeID] = vol
	}

	// Sync volumes from Docker to database
	for _, dockerVol := range dockerVolumes.Volumes {
		if dbVol, exists := dbVolumeMap[dockerVol.Name]; exists {
			// Volume exists in both - check if update needed
			if r.shouldUpdateVolume(dbVol, dockerVol) {
				updatedVol := r.convertDockerVolumeToModel(dockerVol, time.Now())
				updatedVol.ID = dbVol.ID // Preserve database ID
				updatedVol.CreatedAt = dbVol.CreatedAt // Preserve original created time
				
				if err := r.repository.UpsertVolume(ctx, updatedVol); err != nil {
					log.Printf("[WARN] Failed to update volume %s during reconciliation: %v", dockerVol.Name, err)
				}
			}
		} else {
			// Volume exists in Docker but not in database - add it
			newVol := r.convertDockerVolumeToModel(dockerVol, time.Now())
			if err := r.repository.UpsertVolume(ctx, newVol); err != nil {
				log.Printf("[WARN] Failed to add volume %s during reconciliation: %v", dockerVol.Name, err)
			} else if r.promMetrics != nil {
				r.promMetrics.RecordVolumeSync("create", "reconciliation")
			}
		}
	}

	// Remove volumes that exist in database but not in Docker
	removedCount := 0
	for volumeID, dbVol := range dbVolumeMap {
		if !dockerVolumeMap[volumeID] && dbVol.IsActive {
			if err := r.repository.DeleteVolume(ctx, volumeID); err != nil {
				log.Printf("[WARN] Failed to remove volume %s during reconciliation: %v", volumeID, err)
			} else {
				removedCount++
				if r.promMetrics != nil {
					r.promMetrics.RecordResourceRemoved("volume", "reconciliation")
				}
			}
		}
	}

	log.Printf("[INFO] Volume reconciliation: %d Docker volumes, %d DB volumes, %d removed", 
		len(dockerVolumes.Volumes), len(dbVolumes), removedCount)
	return nil
}

// ReconcileContainers syncs database containers with Docker daemon state
func (r *ReconcilerService) ReconcileContainers(ctx context.Context) error {
	log.Printf("[INFO] Starting container reconciliation...")
	start := time.Now()
	defer func() {
		duration := time.Since(start)
		r.metrics.ReconcileRuns["containers"]++
		if r.promMetrics != nil {
			r.promMetrics.RecordReconciliationRun("containers", duration.Seconds())
		}
		log.Printf("[INFO] Container reconciliation completed in %v", duration)
	}()

	// Get current containers from Docker (including stopped ones)
	dockerContainers, err := r.dockerClient.ListContainers(ctx, nil)
	if err != nil {
		return fmt.Errorf("failed to list Docker containers: %w", err)
	}

	// Get current containers from database
	dbContainers, err := r.repository.ListAllContainers(ctx)
	if err != nil {
		return fmt.Errorf("failed to list database containers: %w", err)
	}

	// Create maps for efficient lookup
	dockerContainerMap := make(map[string]types.Container)
	for _, container := range dockerContainers {
		dockerContainerMap[container.ID] = container
	}

	dbContainerMap := make(map[string]*database.Container)
	for _, container := range dbContainers {
		dbContainerMap[container.ContainerID] = container
	}

	// Sync containers and their mounts
	for _, dockerContainer := range dockerContainers {
		// Get detailed container information for mounts
		containerJSON, err := r.dockerClient.ContainerInspect(ctx, dockerContainer.ID)
		if err != nil {
			log.Printf("[WARN] Failed to inspect container %s during reconciliation: %v", dockerContainer.ID, err)
			continue
		}

		state := r.mapContainerState(dockerContainer.State)
		
		if dbContainer, exists := dbContainerMap[dockerContainer.ID]; exists {
			// Container exists in both - check if update needed
			if r.shouldUpdateContainer(dbContainer, dockerContainer, state) {
				updatedContainer := r.convertDockerContainerToModel(containerJSON, state, time.Now())
				updatedContainer.ID = dbContainer.ID // Preserve database ID
				updatedContainer.CreatedAt = dbContainer.CreatedAt // Preserve original created time
				
				if err := r.repository.UpsertContainer(ctx, updatedContainer); err != nil {
					log.Printf("[WARN] Failed to update container %s during reconciliation: %v", dockerContainer.ID, err)
				}
			}
		} else {
			// Container exists in Docker but not in database - add it
			newContainer := r.convertDockerContainerToModel(containerJSON, state, time.Now())
			if err := r.repository.UpsertContainer(ctx, newContainer); err != nil {
				log.Printf("[WARN] Failed to add container %s during reconciliation: %v", dockerContainer.ID, err)
			}
		}

		// Reconcile volume mounts for this container
		if err := r.reconcileContainerMounts(ctx, dockerContainer.ID, containerJSON.Mounts); err != nil {
			log.Printf("[WARN] Failed to reconcile mounts for container %s: %v", dockerContainer.ID, err)
		}
	}

	// Deactivate containers that exist in database but not in Docker
	deactivatedCount := 0
	for containerID, dbContainer := range dbContainerMap {
		if _, exists := dockerContainerMap[containerID]; !exists && dbContainer.IsActive {
			if err := r.repository.DeactivateVolumeMounts(ctx, containerID); err != nil {
				log.Printf("[WARN] Failed to deactivate mounts for container %s: %v", containerID, err)
			}
			
			if err := r.repository.DeleteContainer(ctx, containerID); err != nil {
				log.Printf("[WARN] Failed to remove container %s during reconciliation: %v", containerID, err)
			} else {
				deactivatedCount++
			}
		}
	}

	log.Printf("[INFO] Container reconciliation: %d Docker containers, %d DB containers, %d removed", 
		len(dockerContainers), len(dbContainers), deactivatedCount)
	return nil
}

// FullReconcile performs complete reconciliation of all resources
func (r *ReconcilerService) FullReconcile(ctx context.Context) error {
	log.Printf("[INFO] Starting full reconciliation...")
	start := time.Now()
	defer func() {
		duration := time.Since(start)
		r.metrics.ReconcileRuns["full"]++
		if r.promMetrics != nil {
			r.promMetrics.RecordReconciliationRun("full", duration.Seconds())
		}
		log.Printf("[INFO] Full reconciliation completed in %v", duration)
	}()

	if err := r.ReconcileVolumes(ctx); err != nil {
		return fmt.Errorf("volume reconciliation failed: %w", err)
	}

	if err := r.ReconcileContainers(ctx); err != nil {
		return fmt.Errorf("container reconciliation failed: %w", err)
	}

	return nil
}

// reconcileContainerMounts syncs volume mounts for a specific container
func (r *ReconcilerService) reconcileContainerMounts(ctx context.Context, containerID string, dockerMounts []types.MountPoint) error {
	// Get current mounts from database
	dbMounts, err := r.repository.GetVolumeMountsByContainer(ctx, containerID)
	if err != nil {
		return fmt.Errorf("failed to get database mounts: %w", err)
	}

	// Create maps for efficient lookup
	dockerMountMap := make(map[string]types.MountPoint)
	for _, mount := range dockerMounts {
		if mount.Type == "volume" { // Only process volume mounts
			dockerMountMap[mount.Name] = mount
		}
	}

	dbMountMap := make(map[string]*database.VolumeMount)
	for _, mount := range dbMounts {
		dbMountMap[mount.VolumeID] = mount
	}

	// Add/update mounts that exist in Docker
	for volumeName, dockerMount := range dockerMountMap {
		accessMode := "rw"
		if !dockerMount.RW {
			accessMode = "ro"
		}

		if dbMount, exists := dbMountMap[volumeName]; exists {
			// Mount exists in both - check if update needed
			if dbMount.MountPath != dockerMount.Destination || dbMount.AccessMode != accessMode || !dbMount.IsActive {
				dbMount.MountPath = dockerMount.Destination
				dbMount.AccessMode = accessMode
				dbMount.IsActive = true
				dbMount.UpdatedAt = time.Now()
				
				if err := r.repository.UpsertVolumeMount(ctx, dbMount); err != nil {
					log.Printf("[WARN] Failed to update mount %s->%s: %v", volumeName, containerID, err)
				}
			}
		} else {
			// Mount exists in Docker but not in database - add it
			newMount := &database.VolumeMount{
				VolumeID:    volumeName,
				ContainerID: containerID,
				MountPath:   dockerMount.Destination,
				AccessMode:  accessMode,
				IsActive:    true,
				BaseModel: database.BaseModel{
					CreatedAt: time.Now(),
					UpdatedAt: time.Now(),
				},
			}
			if err := r.repository.UpsertVolumeMount(ctx, newMount); err != nil {
				log.Printf("[WARN] Failed to add mount %s->%s: %v", volumeName, containerID, err)
			}
		}
	}

	// Deactivate mounts that exist in database but not in Docker
	for volumeID, dbMount := range dbMountMap {
		if _, exists := dockerMountMap[volumeID]; !exists && dbMount.IsActive {
			if err := r.repository.DeleteVolumeMount(ctx, volumeID, containerID); err != nil {
				log.Printf("[WARN] Failed to deactivate mount %s->%s: %v", volumeID, containerID, err)
			}
		}
	}

	return nil
}

// Helper functions for conversion and comparison

func (r *ReconcilerService) convertDockerVolumeToModel(dockerVol *volume.Volume, eventTime time.Time) *database.Volume {
	return &database.Volume{
		VolumeID:   dockerVol.Name,
		Name:       dockerVol.Name,
		Driver:     dockerVol.Driver,
		Mountpoint: dockerVol.Mountpoint,
		Labels:     database.Labels(dockerVol.Labels),
		Options:    database.Labels(dockerVol.Options),
		Scope:      dockerVol.Scope,
		Status:     "active",
		IsActive:   true,
		BaseModel: database.BaseModel{
			CreatedAt: eventTime,
			UpdatedAt: eventTime,
		},
	}
}

func (r *ReconcilerService) convertDockerContainerToModel(containerJSON types.ContainerJSON, state string, eventTime time.Time) *database.Container {
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

	// Parse timestamps
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

func (r *ReconcilerService) shouldUpdateVolume(dbVol *database.Volume, dockerVol *volume.Volume) bool {
	return dbVol.Driver != dockerVol.Driver ||
		dbVol.Mountpoint != dockerVol.Mountpoint ||
		dbVol.Scope != dockerVol.Scope ||
		!dbVol.IsActive
}

func (r *ReconcilerService) shouldUpdateContainer(dbContainer *database.Container, dockerContainer types.Container, newState string) bool {
	return dbContainer.State != newState ||
		dbContainer.Status != dockerContainer.Status ||
		(newState == "running") != dbContainer.IsActive
}

func (r *ReconcilerService) mapContainerState(dockerState string) string {
	switch dockerState {
	case "running":
		return "running"
	case "exited":
		return "exited" 
	case "created":
		return "created"
	case "restarting":
		return "restarting"
	case "removing":
		return "removing"
	case "paused":
		return "paused"
	case "dead":
		return "dead"
	default:
		return dockerState
	}
}