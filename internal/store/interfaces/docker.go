package interfaces

import (
	"context"
	"time"
)

// Volume represents a Docker volume
type Volume struct {
	ID         int64             `json:"id"`
	VolumeID   string            `json:"volume_id"`
	Name       string            `json:"name"`
	Driver     string            `json:"driver"`
	Mountpoint string            `json:"mountpoint"`
	Labels     map[string]string `json:"labels,omitempty"`
	Options    map[string]string `json:"options,omitempty"`
	Scope      string            `json:"scope,omitempty"`
	Status     string            `json:"status,omitempty"`
	IsActive   bool              `json:"is_active"`
	CreatedAt  time.Time         `json:"created_at"`
	UpdatedAt  time.Time         `json:"updated_at"`
}

// Container represents a Docker container
type Container struct {
	ID          int64             `json:"id"`
	ContainerID string            `json:"container_id"`
	Name        string            `json:"name"`
	Image       string            `json:"image"`
	State       string            `json:"state"`
	Status      string            `json:"status,omitempty"`
	Labels      map[string]string `json:"labels,omitempty"`
	StartedAt   *time.Time        `json:"started_at,omitempty"`
	FinishedAt  *time.Time        `json:"finished_at,omitempty"`
	IsActive    bool              `json:"is_active"`
	CreatedAt   time.Time         `json:"created_at"`
	UpdatedAt   time.Time         `json:"updated_at"`
}

// VolumeMount represents a volume mounted to a container
type VolumeMount struct {
	ID          int64     `json:"id"`
	VolumeID    string    `json:"volume_id"`
	ContainerID string    `json:"container_id"`
	MountPath   string    `json:"mount_path"`
	AccessMode  string    `json:"access_mode"`
	IsActive    bool      `json:"is_active"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

// DockerStore handles Docker-related metadata operations
type DockerStore interface {
	// Volume operations
	UpsertVolume(ctx context.Context, volume *Volume) error
	DeleteVolume(ctx context.Context, volumeID string) error
	GetVolumeByName(ctx context.Context, name string) (*Volume, error)
	ListAllVolumes(ctx context.Context) ([]*Volume, error)
	
	// Container operations
	UpsertContainer(ctx context.Context, container *Container) error
	DeleteContainer(ctx context.Context, containerID string) error
	GetContainerByID(ctx context.Context, containerID string) (*Container, error)
	ListAllContainers(ctx context.Context) ([]*Container, error)
	
	// Volume mount operations
	UpsertVolumeMount(ctx context.Context, mount *VolumeMount) error
	DeleteVolumeMount(ctx context.Context, volumeID, containerID string) error
	GetVolumeMountsByContainer(ctx context.Context, containerID string) ([]*VolumeMount, error)
	GetVolumeMountsByVolume(ctx context.Context, volumeID string) ([]*VolumeMount, error)
	DeactivateVolumeMounts(ctx context.Context, containerID string) error
	ListAllVolumeMounts(ctx context.Context) ([]*VolumeMount, error)
}