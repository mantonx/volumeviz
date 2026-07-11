package docker

import (
	"context"
	"errors"
	"testing"
	"time"

	cerrdefs "github.com/containerd/errdefs"
	containertypes "github.com/docker/docker/api/types/container"
	"github.com/docker/docker/api/types/events"
	"github.com/docker/docker/api/types/volume"
)

func TestNewClient(t *testing.T) {
	tests := []struct {
		name    string
		host    string
		timeout time.Duration
		wantErr bool
	}{
		{
			name:    "default client",
			host:    "",
			timeout: 30 * time.Second,
			wantErr: false,
		},
		{
			name:    "custom host",
			host:    "tcp://localhost:2375",
			timeout: 10 * time.Second,
			wantErr: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			client, err := NewClient(tt.host, tt.timeout)
			if (err != nil) != tt.wantErr {
				t.Errorf("NewClient() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			if client != nil {
				defer client.Close()
				if client.timeout != tt.timeout {
					t.Errorf("NewClient() timeout = %v, want %v", client.timeout, tt.timeout)
				}
			}
		})
	}
}

func TestClient_contextWithTimeout(t *testing.T) {
	tests := []struct {
		name    string
		timeout time.Duration
	}{
		{
			name:    "with timeout",
			timeout: 5 * time.Second,
		},
		{
			name:    "without timeout",
			timeout: 0,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			c := &Client{
				timeout: tt.timeout,
			}

			ctx := context.Background()
			newCtx, cancel := c.contextWithTimeout(ctx)
			defer cancel()

			if newCtx == nil {
				t.Error("contextWithTimeout() returned nil context")
			}

			// Check if timeout is applied correctly
			if tt.timeout > 0 {
				deadline, ok := newCtx.Deadline()
				if !ok {
					t.Error("contextWithTimeout() should have deadline when timeout > 0")
				} else {
					// Check that deadline is approximately correct (within 1 second)
					expectedDeadline := time.Now().Add(tt.timeout)
					diff := deadline.Sub(expectedDeadline)
					if diff < -1*time.Second || diff > 1*time.Second {
						t.Errorf("contextWithTimeout() deadline off by %v", diff)
					}
				}
			} else {
				_, ok := newCtx.Deadline()
				if ok {
					t.Error("contextWithTimeout() should not have deadline when timeout == 0")
				}
			}
		})
	}
}

func TestClient_IsConnected(t *testing.T) {
	tests := []struct {
		name     string
		pingErr  error
		expected bool
	}{
		{
			name:     "connected",
			pingErr:  nil,
			expected: true,
		},
		{
			name:     "not connected",
			pingErr:  errors.New("connection refused"),
			expected: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// This test would require mocking the Docker client
			// For now, we'll skip the actual implementation
			t.Skip("Requires Docker client mocking")
		})
	}
}

// Additional test cases for error scenarios
func TestClient_ErrorScenarios(t *testing.T) {
	t.Run("invalid docker host", func(t *testing.T) {
		// Skip this test as Docker client may not always fail with invalid hosts
		t.Skip("Docker client validation varies by version")
	})
}

func TestClient_Ping(t *testing.T) {
	client, err := NewClient("", 30*time.Second)
	if err != nil {
		t.Skip("Docker not available")
	}
	defer client.Close()

	ctx := context.Background()
	err = client.Ping(ctx)
	// If Docker daemon is not running, skip the test
	if err != nil && errors.Is(err, context.DeadlineExceeded) {
		t.Skip("Docker daemon not responding")
	}
}

func TestClient_Version(t *testing.T) {
	client, err := NewClient("", 30*time.Second)
	if err != nil {
		t.Skip("Docker not available")
	}
	defer client.Close()

	ctx := context.Background()
	version, err := client.Version(ctx)
	if err != nil {
		t.Skip("Docker daemon not responding")
	}

	if version.Version == "" {
		t.Error("Expected non-empty version")
	}
	if version.APIVersion == "" {
		t.Error("Expected non-empty API version")
	}
}

func TestClient_ListVolumes(t *testing.T) {
	client, err := NewClient("", 30*time.Second)
	if err != nil {
		t.Skip("Docker not available")
	}
	defer client.Close()

	ctx := context.Background()
	volumes, err := client.ListVolumes(ctx, nil)
	if err != nil {
		t.Skip("Docker daemon not responding")
	}

	// Should return a response struct
	if volumes.Volumes == nil {
		t.Error("Expected non-nil volumes slice")
	}
}

func TestClient_InspectVolume(t *testing.T) {
	client, err := NewClient("", 30*time.Second)
	if err != nil {
		t.Skip("Docker not available")
	}
	defer client.Close()

	ctx := context.Background()
	// Test with non-existent volume
	_, err = client.InspectVolume(ctx, "non-existent-volume-test-123")
	if err == nil {
		t.Error("Expected error for non-existent volume")
	}
}

func TestClient_ListContainers(t *testing.T) {
	client, err := NewClient("", 30*time.Second)
	if err != nil {
		t.Skip("Docker not available")
	}
	defer client.Close()

	ctx := context.Background()

	// Test listing all containers
	containers, err := client.ListContainers(ctx, nil)
	if err != nil {
		t.Skip("Docker daemon not responding")
	}

	// Should return a slice (even if empty)
	if containers == nil {
		t.Error("Expected non-nil containers slice")
	}

	// Test listing only running containers
	runningContainers, err := client.ListContainers(ctx, map[string][]string{"status": {"running"}})
	if err != nil {
		t.Skip("Docker daemon not responding")
	}

	// Running containers should be <= all containers
	if len(runningContainers) > len(containers) {
		t.Error("Running containers count should be <= all containers")
	}
}

func TestClient_InspectContainer(t *testing.T) {
	client, err := NewClient("", 30*time.Second)
	if err != nil {
		t.Skip("Docker not available")
	}
	defer client.Close()

	ctx := context.Background()
	// Test with non-existent container
	_, err = client.InspectContainer(ctx, "non-existent-container-test-123")
	if err == nil {
		t.Error("Expected error for non-existent container")
	}
}

// TestClient_RemoveVolume exercises RemoveVolume against a real Docker
// daemon (skipped entirely if one isn't reachable, matching every other
// test in this file) — this is the one piece of behavior that's genuinely
// risky to only unit-test against a mock: whether force=false's
// version-gating and Docker's real in-use rejection actually behave the way
// deleteOneVolume's error classification (cerrdefs.IsConflict/IsNotFound)
// assumes.
func TestClient_RemoveVolume(t *testing.T) {
	client, err := NewClient("", 30*time.Second)
	if err != nil {
		t.Skip("Docker not available")
	}
	defer client.Close()

	ctx := context.Background()
	if err := client.Ping(ctx); err != nil {
		t.Skip("Docker daemon not responding")
	}

	t.Run("removes an unattached volume", func(t *testing.T) {
		volName := "volumeviz-test-remove-unattached"
		if _, err := client.cli.VolumeCreate(ctx, volume.CreateOptions{Name: volName}); err != nil {
			t.Skipf("could not create test volume: %v", err)
		}
		// Best-effort cleanup in case the assertion below fails before we
		// get to the real removal, so a failed test run doesn't leak state.
		defer client.cli.VolumeRemove(ctx, volName, true) //nolint:errcheck

		if err := client.RemoveVolume(ctx, volName, false); err != nil {
			t.Errorf("RemoveVolume() on unattached volume failed: %v", err)
		}

		if _, err := client.InspectVolume(ctx, volName); err == nil {
			t.Error("volume still exists after RemoveVolume() reported success")
		}
	})

	t.Run("rejects removal of a volume attached to a running container", func(t *testing.T) {
		volName := "volumeviz-test-remove-attached"
		if _, err := client.cli.VolumeCreate(ctx, volume.CreateOptions{Name: volName}); err != nil {
			t.Skipf("could not create test volume: %v", err)
		}
		defer client.cli.VolumeRemove(ctx, volName, true) //nolint:errcheck

		containerResp, err := client.cli.ContainerCreate(ctx,
			&containertypes.Config{Image: "busybox", Cmd: []string{"sleep", "60"}},
			&containertypes.HostConfig{Binds: []string{volName + ":/data"}},
			nil, nil, "volumeviz-test-remove-attached-container")
		if err != nil {
			t.Skipf("could not create test container (likely no 'busybox' image pulled locally): %v", err)
		}
		defer func() {
			_ = client.cli.ContainerRemove(ctx, containerResp.ID, containertypes.RemoveOptions{Force: true})
		}()

		if err := client.cli.ContainerStart(ctx, containerResp.ID, containertypes.StartOptions{}); err != nil {
			t.Skipf("could not start test container: %v", err)
		}

		err = client.RemoveVolume(ctx, volName, false)
		if err == nil {
			t.Fatal("expected RemoveVolume() to fail for a volume attached to a running container, got nil error")
		}
		if !cerrdefs.IsConflict(err) {
			t.Errorf("expected a conflict error classifiable via cerrdefs.IsConflict, got: %v", err)
		}
	})

	t.Run("not-found is classifiable via cerrdefs.IsNotFound", func(t *testing.T) {
		err := client.RemoveVolume(ctx, "volumeviz-test-remove-does-not-exist", false)
		if err == nil {
			t.Fatal("expected RemoveVolume() to fail for a non-existent volume, got nil error")
		}
		if !cerrdefs.IsNotFound(err) {
			t.Errorf("expected a not-found error classifiable via cerrdefs.IsNotFound, got: %v", err)
		}
	})
}

func TestClient_Events(t *testing.T) {
	client, err := NewClient("", 30*time.Second)
	if err != nil {
		t.Skip("Docker not available")
	}
	defer client.Close()

	ctx, cancel := context.WithTimeout(context.Background(), 1*time.Second)
	defer cancel()

	eventsChan, errChan := client.Events(ctx, events.ListOptions{})

	// Should receive channels
	if eventsChan == nil {
		t.Error("Expected non-nil events channel")
	}
	if errChan == nil {
		t.Error("Expected non-nil error channel")
	}

	// Wait for context to timeout
	select {
	case <-ctx.Done():
		// Expected
	case err := <-errChan:
		if err != nil && !errors.Is(err, context.Canceled) {
			t.Skipf("Docker daemon not responding: %v", err)
		}
	}
}
