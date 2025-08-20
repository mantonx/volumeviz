// Package scanner provides volume scanning implementations
// Supports multiple scanning methods with fallback strategies
package scanner

import (
	"context"
	"fmt"
	"log"
	"os"
	"sync"
	"syscall"
	"time"

	"github.com/mantonx/volumeviz/internal/interfaces"
	"github.com/mantonx/volumeviz/internal/models"
	coreModels "github.com/mantonx/volumeviz/internal/models"
	dockerService "github.com/mantonx/volumeviz/internal/services/docker"
	"github.com/mantonx/volumeviz/internal/services/filesystem"
	"github.com/mantonx/volumeviz/internal/services/previews"
	"github.com/mantonx/volumeviz/internal/store"
	"github.com/mantonx/volumeviz/internal/utils"
)

// Repository interfaces for filesystem indexing
type FoldersRepository interface {
	CreateFolder(ctx context.Context, params models.CreateFolderParams) (*models.Folder, error)
	DeleteFoldersByVolume(ctx context.Context, volumeID string) error
}

type FilesRepository interface {
	CreateFile(ctx context.Context, params models.CreateFileParams) (*models.File, error)
	DeleteFilesByVolume(ctx context.Context, volumeID string) error
}

// VolumeScanner implements the main volume scanning service
// Uses multiple scanning methods with intelligent fallback
type VolumeScanner struct {
	methods       []interfaces.ScanMethod
	cache         interfaces.Cache
	metrics       interfaces.MetricsCollector
	logger        *log.Logger
	dockerService *dockerService.DockerService
	semaphore     chan struct{} // Limit concurrent scans
	config        coreModels.Config
	activeScans   map[string]*interfaces.ScanProgress // Track active scans by scan ID
	volumeToScan  map[string]string                   // Map volume ID to active scan ID
	scanMutex     sync.RWMutex                        // Protect scan maps

	// Filesystem indexing integration
	filesystemIndexer *filesystem.FilesystemIndexer
	foldersRepo       FoldersRepository
	filesRepo         FilesRepository

	// Preview generation integration
	previewService *previews.Service

	// Media enrichment integration
	enrichmentManager interfaces.EnrichmentManager

	// Daily stats integration
	statsService interfaces.StatsService
}

// NewVolumeScanner creates a new volume scanner instance
// Automatically configures scanning methods based on system capabilities
func NewVolumeScanner(
	dockerService *dockerService.DockerService,
	cache interfaces.Cache,
	metrics interfaces.MetricsCollector,
	logger *log.Logger,
	config coreModels.Config,
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
		activeScans:   make(map[string]*interfaces.ScanProgress),
		volumeToScan:  make(map[string]string),
		// Filesystem indexing will be set up via SetFilesystemIndexing
	}
}

// NewVolumeScannerWithIndexing creates a volume scanner with filesystem indexing support
func NewVolumeScannerWithIndexing(
	dockerService *dockerService.DockerService,
	cache interfaces.Cache,
	metrics interfaces.MetricsCollector,
	logger *log.Logger,
	config coreModels.Config,
	foldersRepo FoldersRepository,
	filesRepo FilesRepository,
	indexerConfig filesystem.IndexerConfig,
	store store.Store,
	previewService *previews.Service,
) interfaces.VolumeScanner {
	// Create filesystem indexer
	filesystemIndexer := filesystem.NewFilesystemIndexer(
		store,
		indexerConfig,
		previewService,
	)

	// Initialize scan methods in order of preference
	methods := []interfaces.ScanMethod{
		NewDiskusMethod(config.Scanning),
		NewDuMethod(config.Scanning),
		NewNativeMethod(config.Scanning),
	}

	return &VolumeScanner{
		methods:           methods,
		cache:             cache,
		metrics:           metrics,
		logger:            logger,
		dockerService:     dockerService,
		semaphore:         make(chan struct{}, config.Scanning.MaxConcurrent),
		config:            config,
		activeScans:       make(map[string]*interfaces.ScanProgress),
		volumeToScan:      make(map[string]string),
		filesystemIndexer: filesystemIndexer,
		foldersRepo:       foldersRepo,
		filesRepo:         filesRepo,
		previewService:    previewService,
	}
}

// SetFilesystemIndexing enables filesystem indexing for an existing VolumeScanner
func (vs *VolumeScanner) SetFilesystemIndexing(
	foldersRepo FoldersRepository,
	filesRepo FilesRepository,
	indexerConfig filesystem.IndexerConfig,
	store store.Store,
	previewService *previews.Service,
) {
	vs.foldersRepo = foldersRepo
	vs.filesRepo = filesRepo
	vs.previewService = previewService
	vs.filesystemIndexer = filesystem.NewFilesystemIndexer(
		store,
		indexerConfig,
		previewService,
	)
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
		return nil, &coreModels.ScanError{
			VolumeID: volumeID,
			Code:     coreModels.ErrorCodeScanQueueTimeout,
			Message:  "scan queue timeout",
			Err:      ctx.Err(),
		}
	}

	// Update queue depth metrics
	vs.metrics.ScanQueueDepth(len(vs.semaphore))

	// Get volume path from Docker
	volumePath, err := vs.getVolumePath(volumeID)
	if err != nil {
		return nil, &coreModels.ScanError{
			VolumeID: volumeID,
			Code:     coreModels.ErrorCodeVolumePathError,
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

		// Trigger daily stats computation if stats service is available
		if vs.statsService != nil {
			go func() {
				if err := vs.statsService.OnScanCompleted(context.Background(), volumeID, nil); err != nil && vs.logger != nil {
					vs.logger.Printf("Failed to compute daily stats for volume %s: %v", volumeID, err)
				}
			}()
		}

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

		// Trigger filesystem indexing if enabled
		if vs.filesystemIndexer != nil {
			go vs.performFilesystemIndexing(ctx, volumeID, volumePath)
		}

		return result, nil
	}

	// All methods failed
	return nil, &coreModels.ScanError{
		VolumeID: volumeID,
		Code:     coreModels.ErrorCodeAllMethodsFailed,
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
	scanID := fmt.Sprintf("scan_%s_%d", volumeID, time.Now().Unix())

	// Initialize scan progress
	progress := &interfaces.ScanProgress{
		ScanID:             scanID,
		VolumeID:           volumeID,
		Status:             coreModels.ScanStatusPending,
		Progress:           0.0,
		FilesScanned:       0,
		CurrentPath:        "",
		EstimatedRemaining: 0,
		Method:             "",
		StartedAt:          time.Now(),
		Error:              "",
	}

	vs.scanMutex.Lock()
	vs.activeScans[scanID] = progress
	vs.volumeToScan[volumeID] = scanID
	vs.scanMutex.Unlock()

	// Start the scan in background
	go func() {
		// Update status to running
		vs.scanMutex.Lock()
		progress.Status = coreModels.ScanStatusRunning
		vs.scanMutex.Unlock()

		result, err := vs.ScanVolume(context.Background(), volumeID)

		vs.scanMutex.Lock()
		defer vs.scanMutex.Unlock()

		if err != nil {
			progress.Status = coreModels.ScanStatusFailed
			progress.Error = err.Error()
			if vs.logger != nil {
				vs.logger.Printf("Async scan failed for volume %s: %v", volumeID, err)
			}
		} else {
			progress.Status = coreModels.ScanStatusCompleted
			progress.Progress = 1.0
			progress.Method = result.Method

			// Trigger daily stats computation if stats service is available (async)
			if vs.statsService != nil {
				go func() {
					if err := vs.statsService.OnScanCompleted(context.Background(), volumeID, &scanID); err != nil && vs.logger != nil {
						vs.logger.Printf("Failed to compute daily stats for async scan %s (volume %s): %v", scanID, volumeID, err)
					}
				}()
			}
		}

		// Clean up after some time (keep completed scans for a while)
		go func() {
			time.Sleep(5 * time.Minute)
			vs.scanMutex.Lock()
			delete(vs.activeScans, scanID)
			delete(vs.volumeToScan, volumeID)
			vs.scanMutex.Unlock()
		}()
	}()

	return scanID, nil
}

// GetScanProgress returns the progress of an async scan
func (vs *VolumeScanner) GetScanProgress(scanID string) (*interfaces.ScanProgress, error) {
	vs.scanMutex.RLock()
	baseProgress, exists := vs.activeScans[scanID]
	if !exists {
		vs.scanMutex.RUnlock()
		return nil, fmt.Errorf("scan not found: %s", scanID)
	}
	
	// Create enhanced progress with base data
	progress := *baseProgress
	vs.scanMutex.RUnlock()
	
	// Enhance with timing information
	now := time.Now()
	progress.LastUpdate = now
	progress.ElapsedSeconds = int64(now.Sub(progress.StartedAt).Seconds())
	
	// Initialize phase tracking if not present
	if progress.Phases == nil {
		progress.Phases = make(map[string]*interfaces.PhaseInfo)
		
		// Set up initial phases
		progress.Phases["volume_scan"] = &interfaces.PhaseInfo{
			Status: "completed",
			StartedAt: &progress.StartedAt,
			Progress: 1.0,
		}
		
		progress.Phases["filesystem_indexing"] = &interfaces.PhaseInfo{
			Status: "pending",
			Progress: 0.0,
		}
		
		progress.Phases["media_enrichment"] = &interfaces.PhaseInfo{
			Status: "pending", 
			Progress: 0.0,
		}
	}
	
	// Get filesystem indexing progress if available
	if vs.filesystemIndexer != nil {
		if indexingProgress := vs.filesystemIndexer.GetIndexingProgress(progress.VolumeID); indexingProgress != nil {
			// Determine current phase
			if indexingProgress.Status == "running" {
				progress.Phase = "filesystem_indexing"
				progress.PhaseProgress = calculatePhaseProgress(indexingProgress)
				
				// Update filesystem indexing phase
				progress.Phases["filesystem_indexing"].Status = "running"
				progress.Phases["filesystem_indexing"].Progress = progress.PhaseProgress
				progress.Phases["filesystem_indexing"].StartedAt = &indexingProgress.StartedAt
				progress.Phases["filesystem_indexing"].ItemsProcessed = indexingProgress.FilesScanned
				
				if indexingProgress.LastError != "" {
					progress.Phases["filesystem_indexing"].Error = indexingProgress.LastError
				}
				
				// Update file/folder counts
				progress.FilesScanned = indexingProgress.FilesScanned
				progress.FoldersScanned = indexingProgress.FoldersScanned
				progress.CurrentPath = indexingProgress.CurrentPath
				progress.CurrentDepth = indexingProgress.CurrentDepth
				progress.BytesProcessed = indexingProgress.BytesProcessed
				
				// Performance metrics
				progress.FilesPerSecond = indexingProgress.FilesPerSec
				progress.FoldersPerSecond = indexingProgress.FoldersPerSec
				if progress.ElapsedSeconds > 0 {
					progress.BytesPerSecond = progress.BytesProcessed / progress.ElapsedSeconds
				}
				
				// Error tracking
				progress.ErrorsCount = indexingProgress.ErrorsCount
				progress.LastError = indexingProgress.LastError
				
				// Estimate remaining time based on current rate
				if progress.FilesPerSecond > 0 && progress.TotalEstimated > 0 {
					remaining := float64(progress.TotalEstimated - progress.FilesScanned) / progress.FilesPerSecond
					progress.EstimatedRemaining = time.Duration(remaining) * time.Second
				}
			} else if indexingProgress.Status == "completed" {
				progress.Phases["filesystem_indexing"].Status = "completed"
				progress.Phases["filesystem_indexing"].Progress = 1.0
				completedAt := indexingProgress.LastUpdate
				progress.Phases["filesystem_indexing"].CompletedAt = &completedAt
				if progress.Phases["filesystem_indexing"].StartedAt != nil {
					progress.Phases["filesystem_indexing"].Duration = completedAt.Sub(*progress.Phases["filesystem_indexing"].StartedAt)
				}
			}
		}
	}
	
	// Calculate overall progress (weighted average of phases)
	progress.Progress = calculateOverallProgress(progress.Phases)
	
	return &progress, nil
}

// Helper function to calculate phase progress based on indexing data
func calculatePhaseProgress(indexing *filesystem.IndexingProgress) float64 {
	// For now, use a simple heuristic based on elapsed time and activity
	// This could be enhanced with better estimation algorithms
	elapsed := time.Since(indexing.StartedAt).Seconds()
	
	// Estimate progress based on processing rate
	if elapsed > 0 && indexing.FilesScanned > 0 {
		rate := float64(indexing.FilesScanned) / elapsed
		if rate > 0 {
			// Rough estimate: assume 10 files per second as baseline
			progress := elapsed / (elapsed + 60)
			if progress > 0.95 {
				return 0.95 // Cap at 95% until completion
			}
			return progress
		}
	}
	
	// Fallback to time-based estimation
	progress := elapsed / 300.0 // Assume 5 minutes max
	if progress > 0.95 {
		return 0.95 // Cap at 95%
	}
	return progress
}

// Helper function to calculate overall progress from phases
func calculateOverallProgress(phases map[string]*interfaces.PhaseInfo) float64 {
	if phases == nil {
		return 0.0
	}
	
	// Weight each phase (volume_scan: 10%, filesystem_indexing: 80%, media_enrichment: 10%)
	weights := map[string]float64{
		"volume_scan": 0.1,
		"filesystem_indexing": 0.8,
		"media_enrichment": 0.1,
	}
	
	var totalProgress float64
	for phaseName, weight := range weights {
		if phase, exists := phases[phaseName]; exists {
			totalProgress += phase.Progress * weight
		}
	}
	
	return totalProgress
}

// GetScanProgressByVolume returns the progress of the active scan for a volume
func (vs *VolumeScanner) GetScanProgressByVolume(volumeID string) (*interfaces.ScanProgress, error) {
	vs.scanMutex.RLock()
	defer vs.scanMutex.RUnlock()

	scanID, exists := vs.volumeToScan[volumeID]
	if !exists {
		return nil, fmt.Errorf("no active scan found for volume: %s", volumeID)
	}

	progress, exists := vs.activeScans[scanID]
	if !exists {
		return nil, fmt.Errorf("scan progress not found for volume: %s", volumeID)
	}

	// Return a copy to avoid race conditions
	progressCopy := *progress
	return &progressCopy, nil
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
		return nil, &coreModels.ScanError{
			VolumeID: volumeID,
			Method:   method.Name(),
			Code:     coreModels.ErrorCodePathValidationFailed,
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
		return nil, &coreModels.ScanError{
			VolumeID: volumeID,
			Method:   method.Name(),
			Code:     coreModels.ErrorCodeResultValidationFailed,
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
// For user-mounted volumes, returns the actual device path instead of Docker internal path
func (vs *VolumeScanner) getVolumePath(volumeID string) (string, error) {
	ctx := context.Background()
	volume, err := vs.dockerService.GetVolume(ctx, volumeID)
	if err != nil {
		return "", utils.WrapError(err, "failed to get volume info")
	}

	// For user-mounted volumes, use the device path if available
	if device, hasDevice := volume.Options["device"]; hasDevice {
		// Validate the device path exists and is accessible
		if _, err := os.Stat(device); err == nil {
			if vs.logger != nil {
				vs.logger.Printf("Using device path for volume %s: %s", volumeID, device)
			}
			return device, nil
		} else {
			if vs.logger != nil {
				vs.logger.Printf("Device path %s not accessible for volume %s, falling back to mountpoint", device, volumeID)
			}
		}
	}

	// Fall back to Docker internal mountpoint
	return volume.Mountpoint, nil
}

// validatePath validates that a path exists and is accessible
func (vs *VolumeScanner) validatePath(path string) error {
	info, err := os.Stat(path)
	if err != nil {
		return utils.WrapError(err, "path not accessible")
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
	if scanErr, ok := err.(*coreModels.ScanError); ok {
		return scanErr
	}

	return &coreModels.ScanError{
		VolumeID: volumeID,
		Method:   method,
		Path:     path,
		Code:     coreModels.ErrorCodeMethodUnavailable,
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
	if scanErr, ok := err.(*coreModels.ScanError); ok {
		return scanErr.Code
	}

	// Classify based on error message patterns
	errMsg := err.Error()
	switch {
	case syscall.EACCES.Error() == errMsg || os.IsPermission(err):
		return coreModels.ErrorCodePermissionDenied
	case syscall.ENOENT.Error() == errMsg || os.IsNotExist(err):
		return coreModels.ErrorCodePathNotFound
	case syscall.ENOSPC.Error() == errMsg:
		return coreModels.ErrorCodeInsufficientSpace
	case syscall.ETIMEDOUT.Error() == errMsg:
		return coreModels.ErrorCodeScanTimeout
	default:
		return coreModels.ErrorCodeUnknown
	}
}

// performFilesystemIndexing performs filesystem indexing for a volume after successful scan
func (vs *VolumeScanner) performFilesystemIndexing(ctx context.Context, volumeID, volumePath string) {
	if vs.filesystemIndexer == nil {
		return
	}

	if vs.logger != nil {
		vs.logger.Printf("Starting filesystem indexing for volume: %s at path: %s", volumeID, volumePath)
	}

	// Use a derived context with timeout for indexing
	indexCtx, cancel := context.WithTimeout(context.Background(), 30*time.Minute)
	defer cancel()

	start := time.Now()

	// Perform filesystem indexing (delta mode for efficiency)
	err := vs.filesystemIndexer.IndexVolume(indexCtx, volumeID, volumePath, true)
	duration := time.Since(start)

	if err != nil {
		if vs.logger != nil {
			vs.logger.Printf("Filesystem indexing failed for volume %s: %v (duration: %v)",
				volumeID, err, duration)
		}
		// Update metrics for failed indexing
		if vs.metrics != nil {
			vs.metrics.RecordScanFailure("filesystem_indexer", "indexing_failed")
		}
		return
	}

	// Get indexing progress/stats
	progress := vs.filesystemIndexer.GetProgress()
	if progress != nil && vs.logger != nil {
		vs.logger.Printf("Filesystem indexing completed for volume %s: %d folders, %d files, %d bytes processed (duration: %v)",
			volumeID, progress.FoldersScanned, progress.FilesScanned, progress.BytesProcessed, duration)
	}

	// Update metrics for successful indexing
	if vs.metrics != nil && progress != nil {
		vs.metrics.ScanCompleted(volumeID, "filesystem_indexer", duration, progress.BytesProcessed)
	}

	// Trigger media enrichment if enabled
	if vs.enrichmentManager != nil && vs.enrichmentManager.IsEnabled() {
		go vs.performMediaEnrichment(ctx, volumeID)
	}
}

// performMediaEnrichment performs media metadata enrichment for a volume after filesystem indexing
func (vs *VolumeScanner) performMediaEnrichment(ctx context.Context, volumeID string) {
	if vs.enrichmentManager == nil || !vs.enrichmentManager.IsEnabled() {
		return
	}

	if vs.logger != nil {
		vs.logger.Printf("Starting media enrichment for volume %s", volumeID)
	}

	// Create context with cancellation
	enrichCtx, cancel := context.WithTimeout(ctx, 30*time.Minute) // 30 min max for enrichment
	defer cancel()

	start := time.Now()

	// Perform media enrichment
	err := vs.enrichmentManager.EnrichVolume(enrichCtx, volumeID)
	duration := time.Since(start)

	if err != nil {
		if vs.logger != nil {
			vs.logger.Printf("Media enrichment failed for volume %s: %v (duration: %v)", volumeID, err, duration)
		}
		// Update metrics for failed enrichment
		if vs.metrics != nil {
			vs.metrics.RecordScanFailure("media_enricher", "enrichment_failed")
		}
		return
	}

	if vs.logger != nil {
		vs.logger.Printf("Media enrichment completed for volume %s (duration: %v)", volumeID, duration)
	}

	// Update metrics for successful enrichment
	if vs.metrics != nil {
		vs.metrics.ScanCompleted(volumeID, "media_enricher", duration, 0) // No bytes metric for enrichment
	}
}

// GetFilesystemIndexingProgress returns the current filesystem indexing progress
func (vs *VolumeScanner) GetFilesystemIndexingProgress() *filesystem.IndexingProgress {
	if vs.filesystemIndexer == nil {
		return nil
	}
	return vs.filesystemIndexer.GetProgress()
}

// IsFilesystemIndexingEnabled returns true if filesystem indexing is enabled
func (vs *VolumeScanner) IsFilesystemIndexingEnabled() bool {
	return vs.filesystemIndexer != nil
}

// TriggerFilesystemIndexing manually triggers filesystem indexing for a volume
func (vs *VolumeScanner) TriggerFilesystemIndexing(ctx context.Context, volumeID string, deltaMode bool) error {
	if vs.filesystemIndexer == nil {
		return fmt.Errorf("filesystem indexing not enabled")
	}

	// Get volume information from Docker
	volume, err := vs.dockerService.GetVolume(ctx, volumeID)
	if err != nil {
		return fmt.Errorf("failed to get volume information: %w", err)
	}

	// Extract mount path
	volumePath := volume.Mountpoint
	if volumePath == "" {
		return fmt.Errorf("volume mountpoint not available")
	}

	// Start indexing in a goroutine to avoid blocking
	go vs.performFilesystemIndexingAsync(ctx, volumeID, volumePath, deltaMode)

	return nil
}

// performFilesystemIndexingAsync performs filesystem indexing asynchronously
func (vs *VolumeScanner) performFilesystemIndexingAsync(ctx context.Context, volumeID, volumePath string, deltaMode bool) {
	if vs.filesystemIndexer == nil {
		return
	}

	if vs.logger != nil {
		vs.logger.Printf("Starting filesystem indexing for volume: %s at path: %s (delta_mode: %v)", volumeID, volumePath, deltaMode)
	}

	// Use a derived context with timeout for indexing
	indexCtx, cancel := context.WithTimeout(context.Background(), 30*time.Minute)
	defer cancel()

	start := time.Now()

	// Perform filesystem indexing
	err := vs.filesystemIndexer.IndexVolume(indexCtx, volumeID, volumePath, deltaMode)
	duration := time.Since(start)

	if err != nil {
		if vs.logger != nil {
			vs.logger.Printf("Filesystem indexing failed for volume %s: %v (duration: %v)",
				volumeID, err, duration)
		}
	} else {
		if vs.logger != nil {
			vs.logger.Printf("Filesystem indexing completed for volume %s (duration: %v)",
				volumeID, duration)
		}
	}
}

// SetEnrichmentManager sets the media enrichment manager
func (vs *VolumeScanner) SetEnrichmentManager(manager interfaces.EnrichmentManager) {
	vs.enrichmentManager = manager
}

// SetStatsService sets the daily stats service for scan completion hooks
func (vs *VolumeScanner) SetStatsService(service interfaces.StatsService) {
	vs.statsService = service
}
