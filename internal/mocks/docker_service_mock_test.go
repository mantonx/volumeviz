package mocks

import (
	"context"
	"testing"

	"github.com/docker/docker/api/types"
	"github.com/mantonx/volumeviz/internal/models"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
)

func TestDockerService_Ping(t *testing.T) {
	mockService := &DockerService{}
	ctx := context.Background()

	// Setup expectation
	mockService.On("Ping", ctx).Return(nil)

	// Call method
	err := mockService.Ping(ctx)

	// Assert
	assert.NoError(t, err)
	mockService.AssertExpectations(t)
}

func TestDockerService_Close(t *testing.T) {
	mockService := &DockerService{}

	// Setup expectation
	mockService.On("Close").Return(nil)

	// Call method
	err := mockService.Close()

	// Assert
	assert.NoError(t, err)
	mockService.AssertExpectations(t)
}

func TestDockerService_IsDockerAvailable(t *testing.T) {
	mockService := &DockerService{}
	ctx := context.Background()

	// Setup expectation
	mockService.On("IsDockerAvailable", ctx).Return(true)

	// Call method
	available := mockService.IsDockerAvailable(ctx)

	// Assert
	assert.True(t, available)
	mockService.AssertExpectations(t)
}

func TestDockerService_GetVersion(t *testing.T) {
	mockService := &DockerService{}
	ctx := context.Background()
	expectedVersion := types.Version{
		Version:    "24.0.6",
		APIVersion: "1.43",
	}

	// Setup expectation
	mockService.On("GetVersion", ctx).Return(expectedVersion, nil)

	// Call method
	version, err := mockService.GetVersion(ctx)

	// Assert
	assert.NoError(t, err)
	assert.Equal(t, expectedVersion, version)
	mockService.AssertExpectations(t)
}

func TestDockerService_ListVolumes(t *testing.T) {
	mockService := &DockerService{}
	ctx := context.Background()
	expectedVolumes := []models.Volume{
		{
			ID:       1,
			VolumeID: "vol1",
			Name:     "test-volume-1",
		},
		{
			ID:       2,
			VolumeID: "vol2",
			Name:     "test-volume-2",
		},
	}

	// Setup expectation
	mockService.On("ListVolumes", ctx).Return(expectedVolumes, nil)

	// Call method
	volumes, err := mockService.ListVolumes(ctx)

	// Assert
	assert.NoError(t, err)
	assert.Equal(t, expectedVolumes, volumes)
	assert.Len(t, volumes, 2)
	mockService.AssertExpectations(t)
}

func TestDockerService_GetVolume(t *testing.T) {
	mockService := &DockerService{}
	ctx := context.Background()
	volumeID := "test-vol"
	expectedVolume := &models.Volume{
		ID:         1,
		VolumeID:   "test-vol",
		Name:       "test-volume",
		Driver:     "local",
		Mountpoint: "/var/lib/docker/volumes/test-volume/_data",
	}

	// Setup expectation
	mockService.On("GetVolume", ctx, volumeID).Return(expectedVolume, nil)

	// Call method
	volume, err := mockService.GetVolume(ctx, volumeID)

	// Assert
	assert.NoError(t, err)
	assert.Equal(t, expectedVolume, volume)
	mockService.AssertExpectations(t)
}

func TestDockerService_GetVolume_NotFound(t *testing.T) {
	mockService := &DockerService{}
	ctx := context.Background()
	volumeID := "nonexistent"

	// Setup expectation for nil return
	mockService.On("GetVolume", ctx, volumeID).Return(nil, assert.AnError)

	// Call method
	volume, err := mockService.GetVolume(ctx, volumeID)

	// Assert
	assert.Error(t, err)
	assert.Nil(t, volume)
	mockService.AssertExpectations(t)
}

func TestDockerService_MockImplementation(t *testing.T) {
	// Test that the mock properly implements the interface methods
	mockService := &DockerService{}

	// Test that all methods can be called without panicking
	ctx := context.Background()

	// Set up minimal expectations
	mockService.On("Ping", ctx).Return(nil).Maybe()
	mockService.On("Close").Return(nil).Maybe()
	mockService.On("IsDockerAvailable", ctx).Return(true).Maybe()
	mockService.On("GetVersion", ctx).Return(types.Version{}, nil).Maybe()
	mockService.On("ListVolumes", ctx).Return([]models.Volume{}, nil).Maybe()
	mockService.On("GetVolume", ctx, mock.Anything).Return(nil, assert.AnError).Maybe()

	// Test that we can call the methods
	assert.NotPanics(t, func() {
		mockService.Ping(ctx)
		mockService.Close()
		mockService.IsDockerAvailable(ctx)
		mockService.GetVersion(ctx)
		mockService.ListVolumes(ctx)
		mockService.GetVolume(ctx, "test")
	})
}

func TestDockerService_MultipleExpectations(t *testing.T) {
	mockService := &DockerService{}
	ctx := context.Background()

	// Setup multiple expectations
	mockService.On("IsDockerAvailable", ctx).Return(true).Times(3)
	mockService.On("Ping", ctx).Return(nil).Once()

	// Call methods multiple times
	assert.True(t, mockService.IsDockerAvailable(ctx))
	assert.True(t, mockService.IsDockerAvailable(ctx))
	assert.True(t, mockService.IsDockerAvailable(ctx))

	assert.NoError(t, mockService.Ping(ctx))

	// Verify all expectations were met
	mockService.AssertExpectations(t)
}
