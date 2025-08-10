package scanner

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/mantonx/volumeviz/internal/core/interfaces"
	"github.com/mantonx/volumeviz/internal/core/models"
)

func TestNativeMethod_Name(t *testing.T) {
	config := models.ScanConfig{DefaultTimeout: 30 * time.Second}
	method := NewNativeMethod(config)
	assert.Equal(t, "native", method.Name())
}

func TestNativeMethod_Available(t *testing.T) {
	config := models.ScanConfig{DefaultTimeout: 30 * time.Second}
	method := NewNativeMethod(config)
	// Native method should always be available
	assert.True(t, method.Available())
}

func TestNativeMethod_SupportsProgress(t *testing.T) {
	config := models.ScanConfig{DefaultTimeout: 30 * time.Second}
	method := NewNativeMethod(config)
	assert.True(t, method.SupportsProgress())
}

func TestNativeMethod_EstimatedDuration(t *testing.T) {
	config := models.ScanConfig{DefaultTimeout: 30 * time.Second}
	method := NewNativeMethod(config)
	
	tests := []struct {
		name     string
		path     string
		minDuration time.Duration
	}{
		{"tmp directory", "/tmp", 1 * time.Second},
		{"root directory", "/", 1 * time.Second},
		{"nonexistent path", "/nonexistent", 1 * time.Second},
	}
	
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			duration := method.EstimatedDuration(tt.path)
			assert.GreaterOrEqual(t, duration, tt.minDuration)
		})
	}
}

func TestNativeMethod_SetProgressCallback(t *testing.T) {
	config := models.ScanConfig{DefaultTimeout: 30 * time.Second}
	method := NewNativeMethod(config)
	
	// Test that we can call SetProgressCallback without error
	// Cast to concrete type to access the method
	nativeMethod := method.(*NativeMethod)
	nativeMethod.SetProgressCallback(func(progress interfaces.ProgressUpdate) {
		// Mock callback
	})
	
	// Verify callback was set (we can't really test the callback execution without complex setup)
	assert.NotNil(t, nativeMethod.progressCallback)
}

func TestNativeMethod_Scan(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping scan test in short mode")
	}
	
	config := models.ScanConfig{DefaultTimeout: 30 * time.Second}
	method := NewNativeMethod(config)
	ctx := context.Background()
	
	// Test with non-existent path - create one that definitely doesn't exist
	nonExistentPath := "/this/path/definitely/does/not/exist/on/any/system"
	_, err := method.Scan(ctx, nonExistentPath)
	assert.Error(t, err)
	
	// Test with a temporary directory
	tempDir := t.TempDir()
	result, err := method.Scan(ctx, tempDir)
	assert.NoError(t, err)
	assert.NotNil(t, result)
	assert.GreaterOrEqual(t, result.TotalSize, int64(0))
	assert.GreaterOrEqual(t, result.DirectoryCount, 1) // At least the temp dir itself
	assert.Equal(t, "native", result.Method)
}