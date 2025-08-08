//go:build integration
// +build integration

package integration

import (
	"context"
	"os"
	"testing"
	"time"

	"github.com/mantonx/volumeviz/internal/services"
	"github.com/mantonx/volumeviz/pkg/docker"
)

// TestDockerClientConnection tests real Docker daemon connection
func TestDockerClientConnection(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping integration test in short mode")
	}

	// Check if Docker is available
	dockerHost := os.Getenv("DOCKER_HOST")
	client, err := docker.NewClient(dockerHost, 30*time.Second)
	if err != nil {
		t.Skipf("Docker client creation failed: %v", err)
	}
	defer client.Close()

	ctx := context.Background()

	// Test ping
	err = client.Ping(ctx)
	if err != nil {
		t.Skipf("Docker daemon not available: %v", err)
	}

	// Test version
	version, err := client.Version(ctx)
	if err != nil {
		t.Errorf("Failed to get Docker version: %v", err)
	} else {
		t.Logf("Docker version: %s, API version: %s", version.Version, version.APIVersion)
	}
}

// TestDockerServiceVolumeOperations tests volume operations with real Docker
func TestDockerServiceVolumeOperations(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping integration test in short mode")
	}

	dockerHost := os.Getenv("DOCKER_HOST")
	service, err := services.NewDockerService(dockerHost, 30*time.Second)
	if err != nil {
		t.Skipf("Docker service creation failed: %v", err)
	}
	defer service.Close()

	ctx := context.Background()

	// Check if Docker is available
	if !service.IsDockerAvailable(ctx) {
		t.Skip("Docker daemon not available")
	}

	// Test listing volumes
	volumes, err := service.ListVolumes(ctx)
	if err != nil {
		t.Errorf("Failed to list volumes: %v", err)
	} else {
		t.Logf("Found %d volumes", len(volumes))
		for _, vol := range volumes {
			t.Logf("  Volume: %s (driver: %s)", vol.Name, vol.Driver)
		}
	}

	// Test getting a specific volume if any exist
	if len(volumes) > 0 {
		vol, err := service.GetVolume(ctx, volumes[0].ID)
		if err != nil {
			t.Errorf("Failed to get volume %s: %v", volumes[0].ID, err)
		} else {
			t.Logf("Got volume: %s at %s", vol.Name, vol.Mountpoint)
		}

		// Test getting containers for this volume
		containers, err := service.GetVolumeContainers(ctx, volumes[0].Name)
		if err != nil {
			t.Errorf("Failed to get containers for volume %s: %v", volumes[0].Name, err)
		} else {
			t.Logf("Found %d containers using volume %s", len(containers), volumes[0].Name)
		}
	}

	// Test filtering by driver
	localVolumes, err := service.GetVolumesByDriver(ctx, "local")
	if err != nil {
		t.Errorf("Failed to filter volumes by driver: %v", err)
	} else {
		t.Logf("Found %d local driver volumes", len(localVolumes))
	}
}

// TestDockerErrorScenarios tests error handling with real Docker
func TestDockerErrorScenarios(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping integration test in short mode")
	}

	dockerHost := os.Getenv("DOCKER_HOST")
	service, err := services.NewDockerService(dockerHost, 30*time.Second)
	if err != nil {
		t.Skipf("Docker service creation failed: %v", err)
	}
	defer service.Close()

	ctx := context.Background()

	// Check if Docker is available
	if !service.IsDockerAvailable(ctx) {
		t.Skip("Docker daemon not available")
	}

	// Test getting non-existent volume
	_, err = service.GetVolume(ctx, "non-existent-volume-xyz123")
	if err == nil {
		t.Error("Expected error for non-existent volume, got nil")
	} else {
		t.Logf("Got expected error for non-existent volume: %v", err)
	}

	// Test with invalid volume name
	_, err = service.GetVolume(ctx, "")
	if err == nil {
		t.Error("Expected error for empty volume ID, got nil")
	}
}

// TestDockerPermissions tests permission-related scenarios
func TestDockerPermissions(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping integration test in short mode")
	}

	// Skip if running as root
	if os.Geteuid() == 0 {
		t.Skip("Test requires non-root user")
	}

	// Try to connect to Docker socket without proper permissions
	// This test assumes the user is not in the docker group
	client, err := docker.NewClient("unix:///var/run/docker.sock", 5*time.Second)
	if err != nil {
		t.Logf("Got expected error creating client without permissions: %v", err)
		return
	}
	defer client.Close()

	ctx := context.Background()
	err = client.Ping(ctx)
	if err != nil && contains(err.Error(), "permission denied") {
		t.Logf("Got expected permission denied error: %v", err)
	} else if err == nil {
		t.Skip("User has Docker permissions, skipping permission test")
	}
}

// Helper function
func contains(s, substr string) bool {
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return true
		}
	}
	return false
}
