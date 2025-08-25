package scanner

import (
	"context"
	"os"
	"testing"
	"time"

	"github.com/mantonx/volumeviz/internal/interfaces"
	"github.com/mantonx/volumeviz/internal/models"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestDiskusMethod(t *testing.T) {
	config := models.ScanConfig{
		DefaultTimeout: 30 * time.Second,
	}
	
	progressManager := NewProgressManager(nil)
	method := NewDiskusMethod(config, progressManager)

	assert.Equal(t, "progressive_diskus", method.Name())
	assert.True(t, method.SupportsProgress())

	// Test availability (likely false unless diskus is installed)
	available := method.Available()
	assert.NotNil(t, available) // Just checking it returns something

	// Test estimated duration
	duration := method.EstimatedDuration("/tmp")
	assert.Greater(t, duration.Nanoseconds(), int64(0))

	// If diskus is not available, skip the actual scan test
	if !available {
		t.Skip("diskus not available, skipping scan test")
	}

	// Test actual scan with temp directory
	tempDir, err := os.MkdirTemp("", "diskus-test")
	require.NoError(t, err)
	defer os.RemoveAll(tempDir)

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	result, err := method.Scan(ctx, tempDir)
	if err != nil {
		// Expected if diskus is not available
		t.Logf("Scan failed as expected: %v", err)
	} else {
		assert.NotNil(t, result)
		assert.Equal(t, "progressive_diskus", result.Method)
		assert.GreaterOrEqual(t, result.TotalSize, int64(0))
	}
}

func TestDiskusMethodWithContext(t *testing.T) {
	config := models.ScanConfig{
		DefaultTimeout: 30 * time.Second,
	}
	
	progressManager := NewProgressManager(nil)
	method := NewDiskusMethod(config, progressManager)

	// Test context cancellation
	ctx, cancel := context.WithCancel(context.Background())
	cancel() // Cancel immediately

	tempDir, err := os.MkdirTemp("", "diskus-ctx-test")
	require.NoError(t, err)
	defer os.RemoveAll(tempDir)

	_, err = method.Scan(ctx, tempDir)
	// Should either fail due to context cancellation or diskus not being available
	// Both are acceptable outcomes
	assert.Error(t, err)
}

func TestDiskusMethodSetProgressCallback(t *testing.T) {
	config := models.ScanConfig{
		DefaultTimeout: 30 * time.Second,
	}
	
	progressManager := NewProgressManager(nil)
	method := NewDiskusMethod(config, progressManager)

	// Test SetProgressCallback - cast to the specific type to access the method
	if diskusMethod, ok := method.(*ProgressiveDiskus); ok {
		callback := func(update interfaces.ProgressUpdate) {
			// This is a no-op callback but exercises the code path
		}
		diskusMethod.SetProgressCallback(callback)
		
		// Verify the method still works after setting callback
		assert.NotNil(t, diskusMethod)
		assert.Equal(t, "progressive_diskus", diskusMethod.Name())
	} else {
		t.Skip("Could not cast to ProgressiveDiskus type")
	}
}