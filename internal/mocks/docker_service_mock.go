package mocks

import (
	"context"

	"github.com/docker/docker/api/types"
	"github.com/mantonx/volumeviz/internal/models"
	"github.com/stretchr/testify/mock"
)

// DockerService is a mock of interfaces.DockerService
type DockerService struct {
	mock.Mock
}

// Connection management
func (m *DockerService) Ping(ctx context.Context) error {
	args := m.Called(ctx)
	return args.Error(0)
}

func (m *DockerService) Close() error {
	args := m.Called()
	return args.Error(0)
}

func (m *DockerService) IsDockerAvailable(ctx context.Context) bool {
	args := m.Called(ctx)
	return args.Bool(0)
}

// Version information
func (m *DockerService) GetVersion(ctx context.Context) (types.Version, error) {
	args := m.Called(ctx)
	return args.Get(0).(types.Version), args.Error(1)
}

// Volume operations
func (m *DockerService) ListVolumes(ctx context.Context) ([]models.Volume, error) {
	args := m.Called(ctx)
	return args.Get(0).([]models.Volume), args.Error(1)
}

func (m *DockerService) GetVolume(ctx context.Context, volumeID string) (*models.Volume, error) {
	args := m.Called(ctx, volumeID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.Volume), args.Error(1)
}

func (m *DockerService) GetVolumesByDriver(ctx context.Context, driver string) ([]models.Volume, error) {
	args := m.Called(ctx, driver)
	return args.Get(0).([]models.Volume), args.Error(1)
}

func (m *DockerService) GetVolumesByLabel(ctx context.Context, key, value string) ([]models.Volume, error) {
	args := m.Called(ctx, key, value)
	return args.Get(0).([]models.Volume), args.Error(1)
}

func (m *DockerService) GetVolumeContainers(ctx context.Context, volumeID string) ([]models.VolumeContainer, error) {
	args := m.Called(ctx, volumeID)
	return args.Get(0).([]models.VolumeContainer), args.Error(1)
}

// Other methods can be added as needed based on the interface