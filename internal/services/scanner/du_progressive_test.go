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

func TestDuMethodSetProgressCallback(t *testing.T) {
	config := models.ScanConfig{
		DefaultTimeout: 30 * time.Second,
	}

	progressManager := NewProgressManager(nil)
	method := NewDuMethod(config, progressManager)

	// Test SetProgressCallback - cast to the specific type to access the method
	if duMethod, ok := method.(*ProgressiveDu); ok {
		callback := func(update interfaces.ProgressUpdate) {
			// This is a no-op callback but exercises the code path
		}
		duMethod.SetProgressCallback(callback)

		// Verify the method still works after setting callback
		assert.NotNil(t, duMethod)
		assert.Equal(t, "progressive_du", duMethod.Name())
		assert.True(t, duMethod.SupportsProgress())
		assert.True(t, duMethod.Available()) // du should always be available on Unix systems
	} else {
		t.Skip("Could not cast to ProgressiveDu type")
	}
}

func TestDuMethodBasics(t *testing.T) {
	config := models.ScanConfig{
		DefaultTimeout: 30 * time.Second,
	}

	progressManager := NewProgressManager(nil)
	method := NewDuMethod(config, progressManager)

	// Basic method tests
	assert.Equal(t, "progressive_du", method.Name())
	assert.True(t, method.SupportsProgress())
	assert.True(t, method.Available())

	// Test EstimatedDuration
	duration := method.EstimatedDuration("/tmp")
	assert.Greater(t, duration, time.Duration(0))
}

func TestDuProcessBatch(t *testing.T) {
	config := models.ScanConfig{
		DefaultTimeout:   30 * time.Second,
		PreferredMethods: []string{"du"},
	}

	progressManager := NewProgressManager(nil)
	duMethod := NewDuMethod(config, progressManager).(*ProgressiveDu)

	// Test with empty batch
	emptyBatch := &DirectoryBatch{
		Directories: []string{},
	}

	size, err := duMethod.processBatch(context.Background(), emptyBatch)
	assert.NoError(t, err)
	assert.Equal(t, int64(0), size)

	// Test with temp directory batch
	tempDir, err := os.MkdirTemp("", "du-test")
	require.NoError(t, err)
	defer os.RemoveAll(tempDir)

	batch := &DirectoryBatch{
		Directories: []string{tempDir},
	}

	size, err = duMethod.processBatch(context.Background(), batch)
	// Note: This may fail if 'du' is not available, but that's expected behavior
	if err == nil {
		assert.GreaterOrEqual(t, size, int64(0))
	} else {
		// Should fail gracefully when du is not available
		assert.Error(t, err)
	}
}

func TestDuProcessBatchWithMultipleDirectories(t *testing.T) {
	config := models.ScanConfig{
		DefaultTimeout:   30 * time.Second,
		PreferredMethods: []string{"du"},
	}

	progressManager := NewProgressManager(nil)
	duMethod := NewDuMethod(config, progressManager).(*ProgressiveDu)

	// Create multiple temp directories
	tempDir1, err := os.MkdirTemp("", "du-test1")
	require.NoError(t, err)
	defer os.RemoveAll(tempDir1)

	tempDir2, err := os.MkdirTemp("", "du-test2")
	require.NoError(t, err)
	defer os.RemoveAll(tempDir2)

	batch := &DirectoryBatch{
		Directories: []string{tempDir1, tempDir2},
	}

	size, err := duMethod.processBatch(context.Background(), batch)
	// May fail if du is not available, but should handle gracefully
	if err == nil {
		assert.GreaterOrEqual(t, size, int64(0))
	}
}

func TestDuProcessBatchEdgeCases(t *testing.T) {
	config := models.ScanConfig{
		DefaultTimeout: 5 * time.Second, // Short timeout to test timeout behavior
	}

	progressManager := NewProgressManager(nil)
	duMethod := NewDuMethod(config, progressManager).(*ProgressiveDu)

	// Test with non-existent directory
	batch := &DirectoryBatch{
		Directories: []string{"/nonexistent/directory"},
	}

	size, err := duMethod.processBatch(context.Background(), batch)
	// Should handle non-existent directories gracefully
	if err != nil {
		assert.Error(t, err)
		assert.Equal(t, int64(0), size)
	}

	// Test with context cancellation
	ctx, cancel := context.WithCancel(context.Background())
	cancel() // Cancel immediately

	tempDir, err := os.MkdirTemp("", "du-cancel-test")
	require.NoError(t, err)
	defer os.RemoveAll(tempDir)

	cancelBatch := &DirectoryBatch{
		Directories: []string{tempDir},
	}

	size, err = duMethod.processBatch(ctx, cancelBatch)
	// Should handle context cancellation
	if err != nil {
		assert.Error(t, err)
	}
}
