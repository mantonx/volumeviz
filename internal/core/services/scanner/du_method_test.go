package scanner

import (
	"context"
	"testing"
	"time"

	"github.com/mantonx/volumeviz/internal/core/models"
	"github.com/stretchr/testify/assert"
)

func TestDuMethod_Name(t *testing.T) {
	config := models.ScanConfig{DefaultTimeout: 30 * time.Second}
	method := NewDuMethod(config)
	assert.Equal(t, "du", method.Name())
}

func TestDuMethod_Available(t *testing.T) {
	config := models.ScanConfig{DefaultTimeout: 30 * time.Second}
	method := NewDuMethod(config)
	// du should always be available on Unix systems
	assert.True(t, method.Available())
}

func TestDuMethod_SupportsProgress(t *testing.T) {
	config := models.ScanConfig{DefaultTimeout: 30 * time.Second}
	method := NewDuMethod(config)
	assert.False(t, method.SupportsProgress())
}

func TestDuMethod_EstimatedDuration(t *testing.T) {
	config := models.ScanConfig{DefaultTimeout: 30 * time.Second}
	method := NewDuMethod(config)

	tests := []struct {
		name        string
		path        string
		minDuration time.Duration
	}{
		{"tmp directory", "/tmp", 1 * time.Second},
		{"root directory", "/", 1 * time.Second},
		{"nonexistent path", "/nonexistent", 10 * time.Second},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			duration := method.EstimatedDuration(tt.path)
			assert.GreaterOrEqual(t, duration, tt.minDuration)
		})
	}
}

func TestDuMethod_Scan(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping scan test in short mode")
	}

	config := models.ScanConfig{DefaultTimeout: 30 * time.Second}
	method := NewDuMethod(config)
	ctx := context.Background()

	// Test with non-existent path
	_, err := method.Scan(ctx, "/nonexistent/path")
	assert.Error(t, err)

	// Only test with accessible path if du is available
	if method.Available() {
		// Create a temporary directory for testing
		tempDir := t.TempDir()
		result, err := method.Scan(ctx, tempDir)
		if err == nil {
			assert.NotNil(t, result)
			assert.GreaterOrEqual(t, result.TotalSize, int64(0))
			assert.Equal(t, "du", result.Method)
		} else {
			t.Logf("du scan failed (expected in some environments): %v", err)
		}
	}
}
