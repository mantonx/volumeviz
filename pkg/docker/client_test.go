package docker

import (
	"context"
	"errors"
	"testing"
	"time"
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
	volumes, err := client.ListVolumes(ctx)
	if err != nil {
		t.Skip("Docker daemon not responding")
	}

	// Should return a slice (even if empty)
	if volumes == nil {
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
	containers, err := client.ListContainers(ctx, true)
	if err != nil {
		t.Skip("Docker daemon not responding")
	}

	// Should return a slice (even if empty)
	if containers == nil {
		t.Error("Expected non-nil containers slice")
	}

	// Test listing only running containers
	runningContainers, err := client.ListContainers(ctx, false)
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

func TestClient_Events(t *testing.T) {
	client, err := NewClient("", 30*time.Second)
	if err != nil {
		t.Skip("Docker not available")
	}
	defer client.Close()

	ctx, cancel := context.WithTimeout(context.Background(), 1*time.Second)
	defer cancel()

	eventsChan, errChan := client.Events(ctx, "")
	
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
			t.Errorf("Unexpected error: %v", err)
		}
	}
}
