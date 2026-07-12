package models

import (
	"errors"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
)

func TestScanError_Error(t *testing.T) {
	// Test error with wrapped error
	wrappedErr := errors.New("underlying error")
	scanErr := &ScanError{
		VolumeID: "vol-123",
		Method:   "du",
		Path:     "/test/path",
		Err:      wrappedErr,
		Message:  "scan failed",
		Code:     "SCAN_FAILED",
		Context: map[string]any{
			"retry_count": 3,
		},
	}

	expected := "scan error [SCAN_FAILED]: scan failed - underlying error"
	assert.Equal(t, expected, scanErr.Error())

	// Test error without wrapped error
	scanErr.Err = nil
	expected = "scan error [SCAN_FAILED]: scan failed"
	assert.Equal(t, expected, scanErr.Error())
}

func TestScanError_Unwrap(t *testing.T) {
	wrappedErr := errors.New("underlying error")
	scanErr := &ScanError{
		Err: wrappedErr,
	}

	unwrapped := scanErr.Unwrap()
	assert.Equal(t, wrappedErr, unwrapped)

	// Test with nil error
	scanErr.Err = nil
	unwrapped = scanErr.Unwrap()
	assert.Nil(t, unwrapped)
}

func TestBulkScanRequest_Structure(t *testing.T) {
	request := BulkScanRequest{
		VolumeIDs: []string{"vol-1", "vol-2", "vol-3"},
		Async:     true,
		Method:    "du",
	}

	assert.Equal(t, []string{"vol-1", "vol-2", "vol-3"}, request.VolumeIDs)
	assert.True(t, request.Async)
	assert.Equal(t, "du", request.Method)
}

func TestBulkScanResponse_Structure(t *testing.T) {
	response := BulkScanResponse{
		ScanID: "scan-123",
		Results: map[string]any{
			"vol-1": map[string]any{"size": 1024, "status": "completed"},
			"vol-2": map[string]any{"size": 2048, "status": "completed"},
		},
		Failed: map[string]string{
			"vol-3": "permission denied",
		},
		Total:    3,
		Success:  2,
		Failures: 1,
	}

	assert.Equal(t, "scan-123", response.ScanID)
	assert.Len(t, response.Results, 2)
	assert.Len(t, response.Failed, 1)
	assert.Equal(t, 3, response.Total)
	assert.Equal(t, 2, response.Success)
	assert.Equal(t, 1, response.Failures)
}

func TestRefreshRequest_Structure(t *testing.T) {
	request := RefreshRequest{
		Async:  false,
		Method: "native",
	}

	assert.False(t, request.Async)
	assert.Equal(t, "native", request.Method)
}

func TestScanConfig_Structure(t *testing.T) {
	config := ScanConfig{
		DefaultTimeout:    30 * time.Second,
		MaxConcurrent:     10,
		PreferredMethods:  []string{"diskus", "du"},
		ProgressReporting: true,
	}

	assert.Equal(t, 30*time.Second, config.DefaultTimeout)
	assert.Equal(t, 10, config.MaxConcurrent)
	assert.Equal(t, []string{"diskus", "du"}, config.PreferredMethods)
	assert.True(t, config.ProgressReporting)
}

func TestCacheConfig_Structure(t *testing.T) {
	config := CacheConfig{
		Type:     "redis",
		TTL:      10 * time.Minute,
		MaxSize:  500,
		RedisURL: "redis://localhost:6379",
	}

	assert.Equal(t, "redis", config.Type)
	assert.Equal(t, 10*time.Minute, config.TTL)
	assert.Equal(t, 500, config.MaxSize)
	assert.Equal(t, "redis://localhost:6379", config.RedisURL)
}

func TestConfig_Structure(t *testing.T) {
	scanConfig := ScanConfig{
		DefaultTimeout:    5 * time.Minute,
		MaxConcurrent:     3,
		PreferredMethods:  []string{"du", "native"},
		ProgressReporting: false,
	}

	cacheConfig := CacheConfig{
		Type:    "memory",
		TTL:     2 * time.Minute,
		MaxSize: 100,
	}

	config := Config{
		Scanning: scanConfig,
		Cache:    cacheConfig,
	}

	assert.Equal(t, scanConfig, config.Scanning)
	assert.Equal(t, cacheConfig, config.Cache)
}

func TestDefaultConfig(t *testing.T) {
	config := DefaultConfig()

	// Test scanning defaults
	assert.Equal(t, 5*time.Minute, config.Scanning.DefaultTimeout)
	assert.Equal(t, 5, config.Scanning.MaxConcurrent)
	assert.Equal(t, []string{"walker"}, config.Scanning.PreferredMethods)
	assert.True(t, config.Scanning.ProgressReporting)

	// Test cache defaults
	assert.Equal(t, "memory", config.Cache.Type)
	assert.Equal(t, 5*time.Minute, config.Cache.TTL)
	assert.Equal(t, 1000, config.Cache.MaxSize)
	assert.Equal(t, "", config.Cache.RedisURL) // Should be empty by default
}

func TestErrorCodes(t *testing.T) {
	// Test that all error codes are properly defined
	assert.Equal(t, "SCAN_QUEUE_TIMEOUT", ErrorCodeScanQueueTimeout)
	assert.Equal(t, "VOLUME_PATH_ERROR", ErrorCodeVolumePathError)
	assert.Equal(t, "ALL_METHODS_FAILED", ErrorCodeAllMethodsFailed)
	assert.Equal(t, "PATH_VALIDATION_FAILED", ErrorCodePathValidationFailed)
	assert.Equal(t, "RESULT_VALIDATION_FAILED", ErrorCodeResultValidationFailed)
	assert.Equal(t, "PERMISSION_DENIED", ErrorCodePermissionDenied)
	assert.Equal(t, "VOLUME_NOT_FOUND", ErrorCodeVolumeNotFound)
	assert.Equal(t, "SCAN_CANCELED", ErrorCodeScanCanceled)
	assert.Equal(t, "METHOD_UNAVAILABLE", ErrorCodeMethodUnavailable)
	assert.Equal(t, "PATH_NOT_FOUND", ErrorCodePathNotFound)
	assert.Equal(t, "INSUFFICIENT_SPACE", ErrorCodeInsufficientSpace)
	assert.Equal(t, "SCAN_TIMEOUT", ErrorCodeScanTimeout)
	assert.Equal(t, "UNKNOWN", ErrorCodeUnknown)
}

func TestScanStatus(t *testing.T) {
	// Test that all scan statuses are properly defined
	assert.Equal(t, "pending", ScanStatusPending)
	assert.Equal(t, "running", ScanStatusRunning)
	assert.Equal(t, "completed", ScanStatusCompleted)
	assert.Equal(t, "failed", ScanStatusFailed)
	assert.Equal(t, "canceled", ScanStatusCanceled)
}

func TestScanError_WithContext(t *testing.T) {
	scanErr := &ScanError{
		VolumeID: "vol-456",
		Method:   "native",
		Path:     "/data/volume",
		Message:  "timeout occurred",
		Code:     ErrorCodeScanTimeout,
		Context: map[string]any{
			"timeout_duration": "5m0s",
			"files_processed":  1500,
			"last_file":        "/data/volume/large_file.bin",
		},
	}

	assert.Equal(t, "vol-456", scanErr.VolumeID)
	assert.Equal(t, "native", scanErr.Method)
	assert.Equal(t, "/data/volume", scanErr.Path)
	assert.Equal(t, "timeout occurred", scanErr.Message)
	assert.Equal(t, ErrorCodeScanTimeout, scanErr.Code)
	assert.NotNil(t, scanErr.Context)
	assert.Equal(t, "5m0s", scanErr.Context["timeout_duration"])
	assert.Equal(t, 1500, scanErr.Context["files_processed"])
	assert.Equal(t, "/data/volume/large_file.bin", scanErr.Context["last_file"])
}

func TestBulkScanResponse_Empty(t *testing.T) {
	response := BulkScanResponse{
		Results:  make(map[string]any),
		Failed:   make(map[string]string),
		Total:    0,
		Success:  0,
		Failures: 0,
	}

	assert.Empty(t, response.ScanID)
	assert.Empty(t, response.Results)
	assert.Empty(t, response.Failed)
	assert.Equal(t, 0, response.Total)
	assert.Equal(t, 0, response.Success)
	assert.Equal(t, 0, response.Failures)
}

func TestScanError_NilContext(t *testing.T) {
	scanErr := &ScanError{
		VolumeID: "vol-789",
		Method:   "du",
		Path:     "/tmp",
		Message:  "execution failed",
		Code:     ErrorCodeMethodUnavailable,
		Context:  nil, // Test with nil context
	}

	assert.Equal(t, "vol-789", scanErr.VolumeID)
	assert.Equal(t, "du", scanErr.Method)
	assert.Equal(t, "/tmp", scanErr.Path)
	assert.Equal(t, "execution failed", scanErr.Message)
	assert.Equal(t, ErrorCodeMethodUnavailable, scanErr.Code)
	assert.Nil(t, scanErr.Context)

	// Error message should still work
	errorMsg := scanErr.Error()
	assert.Contains(t, errorMsg, "scan error [METHOD_UNAVAILABLE]: execution failed")
}
