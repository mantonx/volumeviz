package scanner

import (
	"context"
	"fmt"
	"log"
	"os"
	"syscall"
	"time"

	"github.com/username/volumeviz/internal/core/interfaces"
	"github.com/username/volumeviz/internal/core/models"
	"github.com/username/volumeviz/internal/services"
)

// VolumeScanner implements the main volume scanning service
type VolumeScanner struct {
	methods         []interfaces.ScanMethod
	cache           interfaces.Cache
	metrics         interfaces.MetricsCollector
	logger          *log.Logger
	dockerService   *services.DockerService
	semaphore       chan struct{} // Limit concurrent scans
	config          models.Config
}

// NewVolumeScanner creates a new volume scanner instance
func NewVolumeScanner(
	dockerService *services.DockerService,
	cache interfaces.Cache,
	metrics interfaces.MetricsCollector,
	logger *log.Logger,
	config models.Config,
) interfaces.VolumeScanner {
	// Initialize scan methods in order of preference
	methods := []interfaces.ScanMethod{
		NewDiskusMethod(config.Scanning),
		NewDuMethod(config.Scanning),
		NewNativeMethod(config.Scanning),
	}

	return &VolumeScanner{
		methods:       methods,
		cache:         cache,
		metrics:       metrics,
		logger:        logger,
		dockerService: dockerService,
		semaphore:     make(chan struct{}, config.Scanning.MaxConcurrent),
		config:        config,
	}
}

// ScanVolume scans a volume and returns size information
func (vs *VolumeScanner) ScanVolume(ctx context.Context, volumeID string) (*interfaces.ScanResult, error) {
	// Check cache first
	if result := vs.cache.Get(volumeID); result != nil {
		vs.metrics.CacheHit(volumeID)
		if vs.logger != nil {
			vs.logger.Printf("Cache hit for volume scan: %s", volumeID)
		}
		return result, nil
	}

	vs.metrics.CacheMiss(volumeID)

	// Acquire semaphore for concurrent scan limiting
	select {
	case vs.semaphore <- struct{}{}:
		defer func() { <-vs.semaphore }()
	case <-ctx.Done():
		return nil, &models.ScanError{
			VolumeID: volumeID,
			Code:     models.ErrorCodeScanQueueTimeout,
			Message:  "scan queue timeout",
			Err:      ctx.Err(),
		}
	}

	// Update queue depth metrics
	vs.metrics.ScanQueueDepth(len(vs.semaphore))

	// Get volume path from Docker
	volumePath, err := vs.getVolumePath(volumeID)
	if err != nil {
		return nil, &models.ScanError{
			VolumeID: volumeID,
			Code:     models.ErrorCodeVolumePathError,
			Message:  "failed to resolve volume path",
			Err:      err,
			Context: map[string]any{
				"volume_id": volumeID,
			},
		}
	}

	// Try scan methods in order of preference
	var lastErr error
	for _, method := range vs.methods {
		if !method.Available() {
			if vs.logger != nil {
				vs.logger.Printf("Scan method %s not available for volume %s", 
					method.Name(), volumeID)
			}
			continue
		}

		if vs.logger != nil {
			vs.logger.Printf("Starting volume scan: volume=%s method=%s path=%s estimated_duration=%v",
				volumeID, method.Name(), volumePath, method.EstimatedDuration(volumePath))
		}

		result, err := vs.scanWithMethod(ctx, method, volumeID, volumePath)
		if err != nil {
			if vs.logger != nil {
				vs.logger.Printf("Scan method %s failed for volume %s: %v", 
					method.Name(), volumeID, err)
			}
			lastErr = err
			continue
		}

		// Cache successful result
		cacheTTL := vs.calculateCacheTTL(result)
		if err := vs.cache.Set(volumeID, result, cacheTTL); err != nil && vs.logger != nil {
			vs.logger.Printf("Failed to cache scan result for volume %s: %v", volumeID, err)
		}

		vs.metrics.ScanCompleted(volumeID, method.Name(), result.Duration, result.TotalSize)
		
		// Get volume metadata for enhanced metrics
		if volume, err := vs.dockerService.GetVolume(context.Background(), volumeID); err == nil {
			vs.metrics.UpdateVolumeMetrics(
				volumeID,
				volume.Name,
				volume.Driver,
				result.FilesystemType,
				result.TotalSize,
				result.FileCount,
				method.Name(),
			)
		}
		
		if vs.logger != nil {
			vs.logger.Printf("Volume scan completed: volume=%s method=%s size=%d duration=%v",
				volumeID, method.Name(), result.TotalSize, result.Duration)
		}

		return result, nil
	}

	// All methods failed
	return nil, &models.ScanError{
		VolumeID: volumeID,
		Code:     models.ErrorCodeAllMethodsFailed,
		Message:  "all scan methods failed",
		Err:      lastErr,
		Context: map[string]any{
			"attempted_methods": vs.getMethodNames(),
			"volume_path":       volumePath,
		},
	}
}

// ScanVolumeAsync starts an async scan and returns a scan ID
func (vs *VolumeScanner) ScanVolumeAsync(ctx context.Context, volumeID string) (string, error) {
	// For now, return a simple implementation
	// In a full implementation, this would start a goroutine and track progress
	scanID := fmt.Sprintf("scan_%s_%d", volumeID, time.Now().Unix())
	
	// Start the scan in background
	go func() {
		_, err := vs.ScanVolume(context.Background(), volumeID)
		if err != nil && vs.logger != nil {
			vs.logger.Printf("Async scan failed for volume %s: %v", volumeID, err)
		}
	}()
	
	return scanID, nil
}

// GetScanProgress returns the progress of an async scan
func (vs *VolumeScanner) GetScanProgress(scanID string) (*interfaces.ScanProgress, error) {
	// Simplified implementation - in reality, this would track actual progress
	return &interfaces.ScanProgress{
		ScanID:   scanID,
		Status:   models.ScanStatusCompleted,
		Progress: 1.0,
	}, nil
}

// GetAvailableMethods returns information about available scan methods
func (vs *VolumeScanner) GetAvailableMethods() []interfaces.MethodInfo {
	methods := make([]interfaces.MethodInfo, len(vs.methods))
	
	for i, method := range vs.methods {
		var performance, accuracy string
		var features []string
		
		switch method.Name() {
		case "diskus":
			performance = "fast"
			accuracy = "high"
			features = []string{"very_fast", "external_tool"}
		case "du":
			performance = "medium"
			accuracy = "high"
			features = []string{"reliable", "standard_tool"}
		case "native":
			performance = "slow"
			accuracy = "high"
			features = []string{"detailed_stats", "progress_reporting", "always_available"}
		}
		
		methods[i] = interfaces.MethodInfo{
			Name:        method.Name(),
			Available:   method.Available(),
			Description: fmt.Sprintf("%s-based volume scanning", method.Name()),
			Performance: performance,
			Accuracy:    accuracy,
			Features:    features,
		}
	}
	
	return methods
}

// ClearCache removes a volume from cache
func (vs *VolumeScanner) ClearCache(volumeID string) error {
	return vs.cache.Delete(volumeID)
}

// scanWithMethod executes a scan using a specific method
func (vs *VolumeScanner) scanWithMethod(
	ctx context.Context, 
	method interfaces.ScanMethod, 
	volumeID, path string,
) (*interfaces.ScanResult, error) {
	start := time.Now()

	// Create scan context with timeout
	scanCtx, cancel := context.WithTimeout(ctx, vs.config.Scanning.DefaultTimeout)
	defer cancel()

	// Pre-scan validation
	if err := vs.validatePath(path); err != nil {
		return nil, &models.ScanError{
			VolumeID: volumeID,
			Method:   method.Name(),
			Code:     models.ErrorCodePathValidationFailed,
			Message:  "path validation failed",
			Path:     path,
			Err:      err,
			Context: map[string]any{
				"stage": "pre_scan_validation",
			},
		}
	}

	// Execute scan
	result, err := method.Scan(scanCtx, path)
	duration := time.Since(start)

	// Record scan start
	vs.metrics.ScanStarted(method.Name())
	defer vs.metrics.ScanFinished(method.Name())

	// Record metrics regardless of success/failure
	vs.metrics.RecordScanAttempt(method.Name(), duration, err == nil)

	if err != nil {
		// Record scan failure with specific error classification
		errorCode := vs.classifyError(err)
		vs.metrics.RecordScanFailure(method.Name(), errorCode)
		return nil, vs.wrapScanError(err, volumeID, method.Name(), path, duration)
	}

	// Post-scan enrichment and validation
	result.VolumeID = volumeID
	result.Duration = duration
	result.FilesystemType = vs.detectFilesystemType(path)

	if err := vs.validateResult(result); err != nil {
		return nil, &models.ScanError{
			VolumeID: volumeID,
			Method:   method.Name(),
			Code:     models.ErrorCodeResultValidationFailed,
			Message:  "scan result validation failed",
			Path:     path,
			Err:      err,
			Context: map[string]any{
				"result": result,
				"stage":  "post_scan_validation",
			},
		}
	}

	return result, nil
}

// getVolumePath resolves a volume ID to its filesystem path
func (vs *VolumeScanner) getVolumePath(volumeID string) (string, error) {
	ctx := context.Background()
	volume, err := vs.dockerService.GetVolume(ctx, volumeID)
	if err != nil {
		return "", fmt.Errorf("failed to get volume info: %w", err)
	}
	
	return volume.Mountpoint, nil
}

// validatePath validates that a path exists and is accessible
func (vs *VolumeScanner) validatePath(path string) error {
	info, err := os.Stat(path)
	if err != nil {
		return fmt.Errorf("path not accessible: %w", err)
	}
	
	if !info.IsDir() {
		return fmt.Errorf("path is not a directory")
	}
	
	return nil
}

// validateResult validates scan results
func (vs *VolumeScanner) validateResult(result *interfaces.ScanResult) error {
	if result.TotalSize < 0 {
		return fmt.Errorf("invalid total size: %d", result.TotalSize)
	}
	
	if result.FileCount < 0 {
		return fmt.Errorf("invalid file count: %d", result.FileCount)
	}
	
	if result.Method == "" {
		return fmt.Errorf("method not specified")
	}
	
	return nil
}

// wrapScanError wraps an error with additional context
func (vs *VolumeScanner) wrapScanError(
	err error, 
	volumeID, method, path string, 
	duration time.Duration,
) error {
	// If it's already a ScanError, return it as-is
	if scanErr, ok := err.(*models.ScanError); ok {
		return scanErr
	}

	return &models.ScanError{
		VolumeID: volumeID,
		Method:   method,
		Path:     path,
		Code:     models.ErrorCodeMethodUnavailable,
		Message:  fmt.Sprintf("%s scan failed", method),
		Err:      err,
		Context: map[string]any{
			"duration": duration,
		},
	}
}

// calculateCacheTTL determines appropriate cache TTL based on scan result
func (vs *VolumeScanner) calculateCacheTTL(result *interfaces.ScanResult) time.Duration {
	// Base TTL from config
	baseTTL := vs.config.Cache.TTL
	
	// Adjust based on size (larger volumes cached longer)
	if result.TotalSize > 100*1024*1024*1024 { // >100GB
		return baseTTL * 2
	} else if result.TotalSize < 1024*1024*1024 { // <1GB
		return baseTTL / 2
	}
	
	return baseTTL
}

// detectFilesystemType detects the filesystem type of a path
func (vs *VolumeScanner) detectFilesystemType(path string) string {
	var stat syscall.Statfs_t
	err := syscall.Statfs(path, &stat)
	if err != nil {
		return "unknown"
	}

	// Common filesystem type detection based on magic numbers
	switch stat.Type {
	case 0x58465342: // XFS
		return "xfs"
	case 0xEF53: // EXT2/EXT3/EXT4
		return "ext4"
	case 0x9123683E: // BTRFS
		return "btrfs"
	case 0x6969: // NFS
		return "nfs"
	case 0xFF534D42: // CIFS
		return "cifs"
	case 0x01021994: // TMPFS
		return "tmpfs"
	case 0x858458F6: // RAMFS
		return "ramfs"
	default:
		return fmt.Sprintf("unknown(0x%x)", stat.Type)
	}
}

// getMethodNames returns a list of method names for error context
func (vs *VolumeScanner) getMethodNames() []string {
	names := make([]string, len(vs.methods))
	for i, method := range vs.methods {
		names[i] = method.Name()
	}
	return names
}

// classifyError classifies errors for metrics reporting
func (vs *VolumeScanner) classifyError(err error) string {
	if err == nil {
		return "success"
	}
	
	// Check for specific error types
	if scanErr, ok := err.(*models.ScanError); ok {
		return scanErr.Code
	}
	
	// Classify based on error message patterns
	errMsg := err.Error()
	switch {
	case syscall.EACCES.Error() == errMsg || os.IsPermission(err):
		return models.ErrorCodePermissionDenied
	case syscall.ENOENT.Error() == errMsg || os.IsNotExist(err):
		return models.ErrorCodePathNotFound
	case syscall.ENOSPC.Error() == errMsg:
		return models.ErrorCodeInsufficientSpace
	case syscall.ETIMEDOUT.Error() == errMsg:
		return models.ErrorCodeScanTimeout
	default:
		return models.ErrorCodeUnknown
	}
}