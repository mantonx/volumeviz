package interfaces

import (
	"context"

	"github.com/docker/docker/api/types"
	"github.com/mantonx/volumeviz/internal/models"
)

// DockerService defines the interface for Docker service operations
type DockerService interface {
	// Connection management
	Ping(ctx context.Context) error
	Close() error
	IsDockerAvailable(ctx context.Context) bool

	// Version information
	GetVersion(ctx context.Context) (types.Version, error)

	// Volume operations
	ListVolumes(ctx context.Context) ([]models.Volume, error)
	GetVolume(ctx context.Context, volumeID string) (*models.Volume, error)
	GetVolumeContainers(ctx context.Context, volumeName string) ([]models.VolumeContainer, error)
	GetVolumesByDriver(ctx context.Context, driver string) ([]models.Volume, error)
	GetVolumesByLabel(ctx context.Context, labelKey, labelValue string) ([]models.Volume, error)
}