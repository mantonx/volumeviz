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

