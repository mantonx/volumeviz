package scanner

import (
	"context"
	"errors"
	"log"
	"os"
	"testing"
	"time"

	"github.com/mantonx/volumeviz/internal/interfaces"
	"github.com/mantonx/volumeviz/internal/mocks"
	"github.com/mantonx/volumeviz/internal/models"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
)

// Mock implementations for testing
type mockCache struct {
	mock.Mock
}

func (m *mockCache) Get(key string) *interfaces.ScanResult {
	args := m.Called(key)
	if args.Get(0) == nil {
		return nil
	}
	return args.Get(0).(*interfaces.ScanResult)
}

func (m *mockCache) Set(key string, result *interfaces.ScanResult, ttl time.Duration) error {
	args := m.Called(key, result, ttl)
	return args.Error(0)
}

func (m *mockCache) Delete(key string) error {
	args := m.Called(key)
	return args.Error(0)
}

func (m *mockCache) Clear() error {
	args := m.Called()
	return args.Error(0)
}

type mockMetrics struct {
	mock.Mock
}

func (m *mockMetrics) CacheHit(volumeID string) {
	m.Called(volumeID)
}

func (m *mockMetrics) CacheMiss(volumeID string) {
	m.Called(volumeID)
}

func (m *mockMetrics) ScanCompleted(volumeID, method string, duration time.Duration, size int64) {
	m.Called(volumeID, method, duration, size)
}

func (m *mockMetrics) RecordScanAttempt(method string, duration time.Duration, success bool) {
	m.Called(method, duration, success)
}

func (m *mockMetrics) ScanQueueDepth(depth int) {
	m.Called(depth)
}

func (m *mockMetrics) RecordScanFailure(method, errorCode string) {
	m.Called(method, errorCode)
}

func (m *mockMetrics) UpdateVolumeMetrics(volumeID, volumeName, driver, filesystemType string, size int64, fileCount int, scanMethod string) {
	m.Called(volumeID, volumeName, driver, filesystemType, size, fileCount, scanMethod)
}

func (m *mockMetrics) SetDockerConnectionStatus(connected bool) {
	m.Called(connected)
}

func (m *mockMetrics) SetCacheSize(size int) {
	m.Called(size)
}

func (m *mockMetrics) SetActiveScanners(count int) {
	m.Called(count)
}

func (m *mockMetrics) ScanStarted(method string) {
	m.Called(method)
}

func (m *mockMetrics) ScanFinished(method string) {
	m.Called(method)
}

func (m *mockMetrics) SetSchedulerRunningStatus(running bool) {
	m.Called(running)
}

func (m *mockMetrics) UpdateSchedulerQueueDepth(depth int) {
	m.Called(depth)
}

func (m *mockMetrics) UpdateSchedulerWorkerUtilization(utilization float64) {
	m.Called(utilization)
}

func (m *mockMetrics) SetStatsServiceStatus(enabled bool) {
	m.Called(enabled)
}

func (m *mockMetrics) StatsJobStarted(jobType string, volumeID string) {
	m.Called(jobType, volumeID)
}

func (m *mockMetrics) StatsJobCompleted(jobType string, volumeID string, duration time.Duration, recordsProcessed int) {
	m.Called(jobType, volumeID, duration, recordsProcessed)
}

func (m *mockMetrics) StatsJobFailed(jobType string, volumeID string, duration time.Duration, errorType string) {
	m.Called(jobType, volumeID, duration, errorType)
}

func (m *mockMetrics) UpdateStatsJobQueueDepth(depth int) {
	m.Called(depth)
}

func setupTestScanner() (*VolumeScanner, *mockCache, *mockMetrics, *mocks.DockerService) {
	cache := new(mockCache)
	metrics := new(mockMetrics)
	dockerService := new(mocks.DockerService)
	logger := log.New(os.Stdout, "[TEST] ", log.LstdFlags)

	config := models.Config{
		Scanning: models.ScanConfig{
			MaxConcurrent:    2,
			DefaultTimeout:   30 * time.Second,
			PreferredMethods: []string{"native", "du", "diskus"},
		},
		Cache: models.CacheConfig{
			TTL: 5 * time.Minute,
		},
	}

	scanner := NewVolumeScanner(dockerService, cache, metrics, logger, config).(*VolumeScanner)
	return scanner, cache, metrics, dockerService
}

func TestNewVolumeScanner(t *testing.T) {
	scanner, _, _, _ := setupTestScanner()

	assert.NotNil(t, scanner)
	assert.Len(t, scanner.methods, 3) // diskus, du, native
	assert.NotNil(t, scanner.cache)
	assert.NotNil(t, scanner.metrics)
	assert.NotNil(t, scanner.logger)
	assert.NotNil(t, scanner.dockerService)
	assert.NotNil(t, scanner.semaphore)
	assert.Equal(t, 2, cap(scanner.semaphore)) // MaxConcurrent
	assert.NotNil(t, scanner.activeScans)
	assert.NotNil(t, scanner.volumeToScan)
}

func TestScanVolumeCacheHit(t *testing.T) {
	scanner, cache, metrics, _ := setupTestScanner()

	volumeID := "test-volume"
	cachedResult := &interfaces.ScanResult{
		VolumeID:  volumeID,
		TotalSize: 1024,
		FileCount: 10,
		Method:    "cached",
		Duration:  100 * time.Millisecond,
		ScannedAt: time.Now(),
	}

	cache.On("Get", volumeID).Return(cachedResult)
	metrics.On("CacheHit", volumeID).Return()

	result, err := scanner.ScanVolume(context.Background(), volumeID)

	assert.NoError(t, err)
	assert.Equal(t, cachedResult, result)
	cache.AssertExpectations(t)
	metrics.AssertExpectations(t)
}

func TestScanVolumeCacheMiss(t *testing.T) {
	scanner, cache, metrics, dockerService := setupTestScanner()

	volumeID := "test-volume"
	
	// Set up mock volume with mountpoint
	mockVolume := &models.Volume{
		ID:         1,
		VolumeID:   volumeID,
		Name:       volumeID,
		Driver:     "local",
		Mountpoint: "/tmp/test-volume",
		Options:    make(map[string]string),
	}

	// Create a temporary directory for scanning
	tempDir, err := os.MkdirTemp("", "volumeviz-test")
	require.NoError(t, err)
	defer os.RemoveAll(tempDir)
	mockVolume.Mountpoint = tempDir

	// Mock expectations
	cache.On("Get", volumeID).Return(nil) // Cache miss
	metrics.On("CacheMiss", volumeID).Return()
	metrics.On("ScanQueueDepth", mock.AnythingOfType("int")).Return()
	dockerService.On("GetVolume", mock.Anything, volumeID).Return(mockVolume, nil)
	
	// Expect scan method calls
	metrics.On("ScanStarted", mock.AnythingOfType("string")).Return()
	metrics.On("ScanFinished", mock.AnythingOfType("string")).Return()
	metrics.On("RecordScanAttempt", mock.AnythingOfType("string"), mock.AnythingOfType("time.Duration"), true).Return()
	metrics.On("ScanCompleted", volumeID, mock.AnythingOfType("string"), mock.AnythingOfType("time.Duration"), mock.AnythingOfType("int64")).Return()
	metrics.On("UpdateVolumeMetrics", 
		mock.AnythingOfType("string"),
		mock.AnythingOfType("string"),
		mock.AnythingOfType("string"),
		mock.AnythingOfType("string"),
		mock.AnythingOfType("int64"),
		mock.AnythingOfType("int"),
		mock.AnythingOfType("string")).Return()
	
	// Expect cache set
	cache.On("Set", volumeID, mock.AnythingOfType("*interfaces.ScanResult"), mock.AnythingOfType("time.Duration")).Return(nil)

	result, err := scanner.ScanVolume(context.Background(), volumeID)

	assert.NoError(t, err)
	assert.NotNil(t, result)
	assert.Equal(t, volumeID, result.VolumeID)
	assert.GreaterOrEqual(t, result.TotalSize, int64(0)) // Empty directory can be 0 bytes
	assert.NotEmpty(t, result.Method)
	cache.AssertExpectations(t)
	metrics.AssertExpectations(t)
	dockerService.AssertExpectations(t)
}

func TestGetAvailableMethods(t *testing.T) {
	scanner, _, _, _ := setupTestScanner()

	methods := scanner.GetAvailableMethods()
	assert.Len(t, methods, 3)

	// Check that each method has the expected properties
	for _, method := range methods {
		assert.NotEmpty(t, method.Name)
		assert.NotEmpty(t, method.Description)
		assert.NotEmpty(t, method.Performance)
		assert.NotEmpty(t, method.Accuracy)
		assert.NotEmpty(t, method.Features)
	}
}

func TestClearCache(t *testing.T) {
	scanner, cache, _, _ := setupTestScanner()

	volumeID := "test-volume"
	cache.On("Delete", volumeID).Return(nil)

	err := scanner.ClearCache(volumeID)
	assert.NoError(t, err)
	cache.AssertExpectations(t)
}

func TestValidatePath(t *testing.T) {
	scanner, _, _, _ := setupTestScanner()

	// Test valid directory
	tempDir, err := os.MkdirTemp("", "volumeviz-test")
	require.NoError(t, err)
	defer os.RemoveAll(tempDir)

	err = scanner.validatePath(tempDir)
	assert.NoError(t, err)

	// Test non-existent path
	err = scanner.validatePath("/nonexistent/path")
	assert.Error(t, err)
}

func TestValidateResult(t *testing.T) {
	scanner, _, _, _ := setupTestScanner()

	// Valid result
	validResult := &interfaces.ScanResult{
		TotalSize: 1024,
		FileCount: 10,
		Method:    "test-method",
	}
	err := scanner.validateResult(validResult)
	assert.NoError(t, err)

	// Invalid total size
	invalidSizeResult := &interfaces.ScanResult{
		TotalSize: -1,
		FileCount: 10,
		Method:    "test-method",
	}
	err = scanner.validateResult(invalidSizeResult)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "invalid total size")

	// Invalid file count
	invalidFileCountResult := &interfaces.ScanResult{
		TotalSize: 1024,
		FileCount: -1,
		Method:    "test-method",
	}
	err = scanner.validateResult(invalidFileCountResult)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "invalid file count")

	// Missing method
	noMethodResult := &interfaces.ScanResult{
		TotalSize: 1024,
		FileCount: 10,
		Method:    "",
	}
	err = scanner.validateResult(noMethodResult)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "method not specified")
}

func TestCalculateCacheTTL(t *testing.T) {
	scanner, _, _, _ := setupTestScanner()

	baseTTL := scanner.config.Cache.TTL

	// Large volume (>100GB) should get longer TTL
	largeResult := &interfaces.ScanResult{
		TotalSize: 200 * 1024 * 1024 * 1024, // 200GB
	}
	ttl := scanner.calculateCacheTTL(largeResult)
	assert.Equal(t, baseTTL*2, ttl)

	// Small volume (<1GB) should get shorter TTL
	smallResult := &interfaces.ScanResult{
		TotalSize: 500 * 1024 * 1024, // 500MB
	}
	ttl = scanner.calculateCacheTTL(smallResult)
	assert.Equal(t, baseTTL/2, ttl)

	// Medium volume should get base TTL
	mediumResult := &interfaces.ScanResult{
		TotalSize: 50 * 1024 * 1024 * 1024, // 50GB
	}
	ttl = scanner.calculateCacheTTL(mediumResult)
	assert.Equal(t, baseTTL, ttl)
}

func TestDetectFilesystemType(t *testing.T) {
	scanner, _, _, _ := setupTestScanner()

	tempDir, err := os.MkdirTemp("", "volumeviz-test")
	require.NoError(t, err)
	defer os.RemoveAll(tempDir)

	fsType := scanner.detectFilesystemType(tempDir)
	assert.NotEmpty(t, fsType)
}

func TestClassifyError(t *testing.T) {
	scanner, _, _, _ := setupTestScanner()

	// Test nil error
	assert.Equal(t, "success", scanner.classifyError(nil))

	// Test ScanError
	scanErr := &models.ScanError{Code: models.ErrorCodePermissionDenied}
	assert.Equal(t, models.ErrorCodePermissionDenied, scanner.classifyError(scanErr))

	// Test permission error
	permErr := os.ErrPermission
	assert.Equal(t, models.ErrorCodePermissionDenied, scanner.classifyError(permErr))

	// Test not exist error
	notExistErr := os.ErrNotExist
	assert.Equal(t, models.ErrorCodePathNotFound, scanner.classifyError(notExistErr))

	// Test generic error
	genericErr := errors.New("generic error")
	assert.Equal(t, models.ErrorCodeUnknown, scanner.classifyError(genericErr))
}

func TestGetMethodNames(t *testing.T) {
	scanner, _, _, _ := setupTestScanner()

	names := scanner.getMethodNames()
	assert.Len(t, names, 3)
	assert.Contains(t, names, "progressive_diskus")
	assert.Contains(t, names, "progressive_du")
	assert.Contains(t, names, "native")
}

func TestWrapScanError(t *testing.T) {
	scanner, _, _, _ := setupTestScanner()

	// Test wrapping a regular error
	originalErr := errors.New("original error")
	wrappedErr := scanner.wrapScanError(originalErr, "vol1", "test-method", "/test/path", 100*time.Millisecond)

	scanErr, ok := wrappedErr.(*models.ScanError)
	assert.True(t, ok)
	assert.Equal(t, "vol1", scanErr.VolumeID)
	assert.Equal(t, "test-method", scanErr.Method)
	assert.Equal(t, "/test/path", scanErr.Path)
	assert.Equal(t, originalErr, scanErr.Err)

	// Test that ScanError is returned as-is
	existingScanErr := &models.ScanError{
		VolumeID: "existing-vol",
		Code:     models.ErrorCodePermissionDenied,
	}
	result := scanner.wrapScanError(existingScanErr, "vol1", "test-method", "/test/path", 100*time.Millisecond)
	assert.Equal(t, existingScanErr, result)
}

func TestSetProgressBroadcaster(t *testing.T) {
	scanner, _, _, _ := setupTestScanner()
	
	// Test setting progress broadcaster (just ensure it doesn't panic)
	scanner.SetProgressBroadcaster(nil)
	assert.NotNil(t, scanner) // Basic check that scanner still exists
}

func TestSetEnrichmentManager(t *testing.T) {
	scanner, _, _, _ := setupTestScanner()
	
	// Test setting enrichment manager (just ensure it doesn't panic)
	scanner.SetEnrichmentManager(nil)
	assert.NotNil(t, scanner) // Basic check that scanner still exists
}

func TestSetStatsService(t *testing.T) {
	scanner, _, _, _ := setupTestScanner()
	
	// Test setting stats service (just ensure it doesn't panic)
	scanner.SetStatsService(nil)
	assert.NotNil(t, scanner) // Basic check that scanner still exists
}

func TestSupportsProgress(t *testing.T) {
	vs, _, _, _ := setupTestScanner()
	
	for _, method := range vs.methods {
		// Test that all methods support progress
		assert.True(t, method.SupportsProgress(), "Expected %s to support progress", method.Name())
	}
}

func TestMethodsBasicProperties(t *testing.T) {
	vs, _, _, _ := setupTestScanner()
	
	// Test that methods have expected basic properties
	assert.Len(t, vs.methods, 3) // diskus, du, native
	
	for _, method := range vs.methods {
		assert.NotEmpty(t, method.Name())
		// All methods should be available (even if they don't actually work in test env)
		assert.NotNil(t, method) // Basic existence check
	}
}

func TestEstimatedDuration(t *testing.T) {
	vs, _, _, _ := setupTestScanner()
	
	for _, method := range vs.methods {
		// Test estimated duration calculation
		duration := method.EstimatedDuration("/tmp")
		assert.Greater(t, duration.Nanoseconds(), int64(0))
	}
}

func TestFilesystemIndexing(t *testing.T) {
	scanner, _, _, _ := setupTestScanner()
	
	// Test IsFilesystemIndexingEnabled
	assert.False(t, scanner.IsFilesystemIndexingEnabled()) // No indexer set up by default
}

func TestGetScanIDForVolume(t *testing.T) {
	scanner, _, _, _ := setupTestScanner()
	
	// Test getting scan ID for volume that doesn't exist
	scanID := scanner.getScanIDForVolume("nonexistent-volume")
	assert.Empty(t, scanID)
}

func TestGetVolumePathEdgeCases(t *testing.T) {
	scanner, _, _, dockerService := setupTestScanner()
	
	volumeID := "test-volume"
	
	// Test case: Docker service returns error
	dockerService.On("GetVolume", mock.Anything, volumeID).Return(nil, errors.New("docker error"))
	
	_, err := scanner.getVolumePath(volumeID)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "failed to get volume info")
	
	dockerService.AssertExpectations(t)
}
