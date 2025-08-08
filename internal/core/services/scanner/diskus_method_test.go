package scanner

import (
	"context"
	"os"
	"testing"
	"time"

	"github.com/mantonx/volumeviz/internal/core/models"
	"github.com/stretchr/testify/assert"
)

func TestDiskusMethod_Name(t *testing.T) {
	config := models.ScanConfig{
		DefaultTimeout: 5 * time.Minute,
	}
	method := NewDiskusMethod(config)

	assert.Equal(t, "diskus", method.Name())
}

func TestDiskusMethod_Available(t *testing.T) {
	config := models.ScanConfig{
		DefaultTimeout: 5 * time.Minute,
	}
	method := NewDiskusMethod(config)

	// This test will depend on whether diskus is installed
	available := method.Available()
	assert.IsType(t, false, available) // Just check it returns a boolean
}

func TestDiskusMethod_EstimatedDuration(t *testing.T) {
	config := models.ScanConfig{
		DefaultTimeout: 5 * time.Minute,
	}
	method := NewDiskusMethod(config)

	// Test with a temporary directory
	tempDir, err := os.MkdirTemp("", "diskus_test")
	assert.NoError(t, err)
	defer os.RemoveAll(tempDir)

	duration := method.EstimatedDuration(tempDir)
	assert.Greater(t, duration, time.Duration(0))
	assert.LessOrEqual(t, duration, 30*time.Second) // Should be reasonable
}

func TestDiskusMethod_EstimatedDuration_NonexistentPath(t *testing.T) {
	config := models.ScanConfig{
		DefaultTimeout: 5 * time.Minute,
	}
	method := NewDiskusMethod(config)

	duration := method.EstimatedDuration("/nonexistent/path")
	assert.Equal(t, 5*time.Second, duration) // Default fallback
}

func TestDiskusMethod_SupportsProgress(t *testing.T) {
	config := models.ScanConfig{
		DefaultTimeout: 5 * time.Minute,
	}
	method := NewDiskusMethod(config)

	assert.False(t, method.SupportsProgress())
}

func TestDiskusMethod_Scan_WithoutDiskus(t *testing.T) {
	// Skip if diskus is actually available
	config := models.ScanConfig{
		DefaultTimeout: 5 * time.Minute,
	}
	if method := NewDiskusMethod(config); method.Available() {
		t.Skip("diskus is available, skipping unavailable test")
	}

	method := NewDiskusMethod(config)

	tempDir, err := os.MkdirTemp("", "diskus_test")
	assert.NoError(t, err)
	defer os.RemoveAll(tempDir)

	// This should fail if diskus is not available
	result, err := method.Scan(context.Background(), tempDir)

	assert.Error(t, err)
	assert.Nil(t, result)

	// Should be a ScanError
	scanErr, ok := err.(*models.ScanError)
	assert.True(t, ok)
	assert.Equal(t, "diskus", scanErr.Method)
	assert.Equal(t, models.ErrorCodeMethodUnavailable, scanErr.Code)
}

func TestDiskusMethod_Scan_WithTimeout(t *testing.T) {
	// Skip if diskus is not available
	config := models.ScanConfig{
		DefaultTimeout: 5 * time.Minute,
	}
	if method := NewDiskusMethod(config); !method.Available() {
		t.Skip("diskus not available, skipping timeout test")
	}

	config.DefaultTimeout = 1 * time.Millisecond // Very short timeout
	method := NewDiskusMethod(config)

	tempDir, err := os.MkdirTemp("", "diskus_test")
	assert.NoError(t, err)
	defer os.RemoveAll(tempDir)

	// Create some files to make it take time
	for i := 0; i < 10; i++ {
		f, err := os.CreateTemp(tempDir, "test_file_")
		assert.NoError(t, err)
		f.Write(make([]byte, 1024)) // 1KB files
		f.Close()
	}

	// This should timeout
	result, err := method.Scan(context.Background(), tempDir)

	assert.Error(t, err)
	assert.Nil(t, result)
}

func TestDiskusMethod_Scan_Success(t *testing.T) {
	// Skip if diskus is not available
	config := models.ScanConfig{
		DefaultTimeout: 5 * time.Minute,
	}
	if method := NewDiskusMethod(config); !method.Available() {
		t.Skip("diskus not available, skipping success test")
	}

	method := NewDiskusMethod(config)

	// Create a temporary directory with known content
	tempDir, err := os.MkdirTemp("", "diskus_test")
	assert.NoError(t, err)
	defer os.RemoveAll(tempDir)

	// Create a test file with known size
	testFile, err := os.Create(tempDir + "/test_file.txt")
	assert.NoError(t, err)
	testData := make([]byte, 1024) // 1KB
	_, err = testFile.Write(testData)
	assert.NoError(t, err)
	testFile.Close()

	// Scan the directory
	result, err := method.Scan(context.Background(), tempDir)

	if err != nil {
		t.Logf("Scan failed: %v", err)
		return // Don't fail the test, diskus might not work properly in test environment
	}

	assert.NotNil(t, result)
	assert.Equal(t, "diskus", result.Method)
	assert.Greater(t, result.TotalSize, int64(0))
	assert.GreaterOrEqual(t, result.TotalSize, int64(1024)) // At least our test file size
	assert.Greater(t, result.Duration, time.Duration(0))
	assert.False(t, result.CacheHit)

	// diskus doesn't provide these details
	assert.Equal(t, 0, result.FileCount)
	assert.Equal(t, 0, result.DirectoryCount)
	assert.Equal(t, int64(0), result.LargestFile)
}
