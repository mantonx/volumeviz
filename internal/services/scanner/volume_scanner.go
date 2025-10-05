package scanner

import (
	"context"
	"fmt"
	"log"
	"sync"
	"time"

	volumeConfig "github.com/mantonx/volumeviz/internal/config"
	"github.com/mantonx/volumeviz/internal/interfaces"
	"github.com/mantonx/volumeviz/internal/models"
	coreModels "github.com/mantonx/volumeviz/internal/models"
	"github.com/mantonx/volumeviz/internal/realtime"
	"github.com/mantonx/volumeviz/internal/repo"
	"github.com/mantonx/volumeviz/internal/services/filesystem"
	"github.com/mantonx/volumeviz/internal/services/previews"
	"github.com/mantonx/volumeviz/internal/store"
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

type VolumesRepository interface {
	UpdateLastScanned(ctx context.Context, organizationID int64, volumeID string, lastScanned time.Time) error
}

// VolumeScanner implements the main volume scanning service
type VolumeScanner struct {
	methods       []interfaces.ScanMethod
	cache         interfaces.Cache
	metrics       interfaces.MetricsCollector
	logger        *log.Logger
	dockerService interfaces.DockerService
	semaphore     chan struct{} // Limit concurrent scans
	config        coreModels.Config

	// Progress management
	activeScans     map[string]*interfaces.ScanProgress // Track active scans by scan ID
	volumeToScan    map[string]string                   // Map volume ID to active scan ID
	scanMutex       sync.RWMutex                        // Protect scan maps
	progressManager *ProgressManager

	// Volume mount path mapping configuration
	volumeMapping *volumeConfig.VolumeMappingConfig

	// Integration components
	filesystemIndexer   *filesystem.FilesystemIndexer
	foldersRepo         FoldersRepository
	filesRepo           FilesRepository
	volumesRepo         VolumesRepository
	previewService      *previews.Service
	enrichmentManager   interfaces.EnrichmentManager
	statsService        interfaces.StatsService
	store               store.Store
	progressThrottler   *filesystem.ProgressThrottler
	progressBroadcaster realtime.BroadcasterInterface

	// Resilience features
	retryConfig        RetryConfig
	timeoutConfig      TimeoutConfig
	circuitBreaker     *CircuitBreaker
	checkpointManager  *CheckpointManager
	resumeManager      *ResumeManager

	// Incremental scanning
	incrementalScanner *IncrementalScanner
}

// NewVolumeScanner creates a new volume scanner instance
func NewVolumeScanner(
	dockerService interfaces.DockerService,
	cache interfaces.Cache,
	metrics interfaces.MetricsCollector,
	logger *log.Logger,
	config coreModels.Config,
) interfaces.VolumeScanner {
	// Initialize progress manager
	progressManager := NewProgressManager(nil) // Will set broadcaster later if needed

	// Initialize scan methods in order of preference (progressive versions for transparency)
	methods := []interfaces.ScanMethod{
		NewDiskusMethod(config.Scanning, progressManager),
		NewDuMethod(config.Scanning, progressManager),
		NewNativeMethod(config.Scanning),
	}

	// Configure retry from config
	retryConfig := DefaultRetryConfig()
	if !config.Scanning.RetryEnabled {
		retryConfig.MaxAttempts = 1 // Disable retry
	} else {
		retryConfig.MaxAttempts = config.Scanning.RetryMaxAttempts
		retryConfig.InitialBackoff = config.Scanning.RetryInitialBackoff
		retryConfig.MaxBackoff = config.Scanning.RetryMaxBackoff
	}

	// Configure timeout from config
	timeoutConfig := TimeoutConfig{
		PerMethodTimeout: config.Scanning.PerMethodTimeout,
		OverallTimeout:   config.Scanning.OverallTimeout,
		IndexingTimeout:  config.Scanning.IndexingTimeout,
	}

	// Configure circuit breaker
	var circuitBreaker *CircuitBreaker
	if config.Scanning.CircuitBreakerEnabled {
		circuitBreaker = NewCircuitBreaker(
			5,             // Open after 5 consecutive failures
			2,             // Close after 2 consecutive successes
			1*time.Minute, // Try again after 1 minute
		)
	} else {
		// Create a no-op circuit breaker that never opens
		circuitBreaker = &CircuitBreaker{
			state:            StateClosed,
			failureThreshold: 999999, // Effectively disabled
		}
	}

	scanner := &VolumeScanner{
		methods:         methods,
		cache:           cache,
		metrics:         metrics,
		logger:          logger,
		dockerService:   dockerService,
		semaphore:       make(chan struct{}, config.Scanning.MaxConcurrent),
		config:          config,
		activeScans:     make(map[string]*interfaces.ScanProgress),
		volumeToScan:    make(map[string]string),
		volumeMapping:   volumeConfig.NewVolumeMappingConfig(),
		progressManager: progressManager,
		retryConfig:     retryConfig,
		timeoutConfig:   timeoutConfig,
		circuitBreaker:  circuitBreaker,
	}

	// Note: Checkpoint and resume managers will be set later when store is available
	// They require store.Store which isn't passed to NewVolumeScanner

	return scanner
}

// NewVolumeScannerWithIndexing creates a volume scanner with filesystem indexing support
func NewVolumeScannerWithIndexing(
	dockerService interfaces.DockerService,
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
		nil, // EnrichmentManager will be set later via SetEnrichmentManager
	)

	// Initialize progress manager
	progressManager := NewProgressManager(nil) // Will set broadcaster later if needed

	// Initialize scan methods in order of preference (progressive versions for transparency)
	methods := []interfaces.ScanMethod{
		NewDiskusMethod(config.Scanning, progressManager),
		NewDuMethod(config.Scanning, progressManager),
		NewNativeMethod(config.Scanning),
	}

	// Configure retry from config
	retryConfig := DefaultRetryConfig()
	if !config.Scanning.RetryEnabled {
		retryConfig.MaxAttempts = 1 // Disable retry
	} else {
		retryConfig.MaxAttempts = config.Scanning.RetryMaxAttempts
		retryConfig.InitialBackoff = config.Scanning.RetryInitialBackoff
		retryConfig.MaxBackoff = config.Scanning.RetryMaxBackoff
	}

	// Configure timeout from config
	timeoutConfig := TimeoutConfig{
		PerMethodTimeout: config.Scanning.PerMethodTimeout,
		OverallTimeout:   config.Scanning.OverallTimeout,
		IndexingTimeout:  config.Scanning.IndexingTimeout,
	}

	// Configure circuit breaker
	var circuitBreaker *CircuitBreaker
	if config.Scanning.CircuitBreakerEnabled {
		circuitBreaker = NewCircuitBreaker(
			5,             // Open after 5 consecutive failures
			2,             // Close after 2 consecutive successes
			1*time.Minute, // Try again after 1 minute
		)
	} else {
		// Create a no-op circuit breaker that never opens
		circuitBreaker = &CircuitBreaker{
			state:            StateClosed,
			failureThreshold: 999999, // Effectively disabled
		}
	}

	// Initialize checkpoint and resume managers
	checkpointManager := NewCheckpointManager(store, progressManager, logger)
	resumeManager := NewResumeManager(store, logger)

	// Initialize incremental scanner
	var incrementalScanner *IncrementalScanner
	if config.Scanning.IncrementalEnabled {
		incrementalScanner = NewIncrementalScanner(store)
	}

	scanner := &VolumeScanner{
		methods:           methods,
		cache:             cache,
		metrics:           metrics,
		logger:            logger,
		dockerService:     dockerService,
		semaphore:         make(chan struct{}, config.Scanning.MaxConcurrent),
		config:            config,
		activeScans:       make(map[string]*interfaces.ScanProgress),
		volumeToScan:      make(map[string]string),
		volumeMapping:     volumeConfig.NewVolumeMappingConfig(),
		filesystemIndexer: filesystemIndexer,
		foldersRepo:       foldersRepo,
		filesRepo:         filesRepo,
		volumesRepo:       store.Volumes(),
		previewService:    previewService,
		store:             store,
		progressManager:   progressManager,
		retryConfig:        retryConfig,
		timeoutConfig:      timeoutConfig,
		circuitBreaker:     circuitBreaker,
		checkpointManager:  checkpointManager,
		resumeManager:      resumeManager,
		incrementalScanner: incrementalScanner,
	}

	return scanner
}

// SetProgressBroadcaster sets the progress broadcaster for comprehensive real-time updates
func (vs *VolumeScanner) SetProgressBroadcaster(broadcaster realtime.BroadcasterInterface) {
	vs.progressBroadcaster = broadcaster

	// Set it on the progress manager for new progressive methods
	if vs.progressManager != nil {
		vs.progressManager.broadcaster = broadcaster
	}

	// Also set it on the filesystem indexer if available
	if vs.filesystemIndexer != nil {
		vs.filesystemIndexer.SetProgressBroadcaster(broadcaster)
	}
}

// SetEnrichmentManager sets the media enrichment manager
func (vs *VolumeScanner) SetEnrichmentManager(manager interfaces.EnrichmentManager) {
	vs.enrichmentManager = manager
	// Also update the filesystem indexer if it exists
	if vs.filesystemIndexer != nil {
		vs.filesystemIndexer.SetEnrichmentManager(manager)
	}
}

// SetStatsService sets the daily stats service for scan completion hooks
func (vs *VolumeScanner) SetStatsService(service interfaces.StatsService) {
	vs.statsService = service
}

// scanWithRetry wraps scanWithMethod with retry logic and circuit breaker tracking
func (vs *VolumeScanner) scanWithRetry(ctx context.Context, method interfaces.ScanMethod, volumeID, volumePath string) (*interfaces.ScanResult, error) {
	var result *interfaces.ScanResult
	attempt := 0

	// Wrap with circuit breaker
	err := vs.circuitBreaker.Call(func() error {
		// Retry logic within circuit breaker
		return RetryWithBackoff(ctx, vs.retryConfig, func() error {
			attempt++
			var attemptErr error
			result, attemptErr = vs.scanWithMethod(ctx, method, volumeID, volumePath)

			if attemptErr != nil && vs.logger != nil {
				vs.logger.Printf("Scan attempt %d failed: volume=%s method=%s retryable=%v error=%v",
					attempt, volumeID, method.Name(), IsRetryable(attemptErr), attemptErr)
			}

			return attemptErr
		})
	})

	// Log circuit breaker state changes
	if err != nil && vs.logger != nil {
		cbState := vs.circuitBreaker.GetState()
		if cbState != StateClosed {
			vs.logger.Printf("Circuit breaker state changed: state=%s stats=%v",
				cbState, vs.circuitBreaker.GetStats())
		}
	}

	return result, err
}

// ScanVolume scans a volume and returns size information
func (vs *VolumeScanner) ScanVolume(ctx context.Context, volumeID string) (*interfaces.ScanResult, error) {
	// Check circuit breaker first
	if vs.circuitBreaker.GetState() == StateOpen {
		return nil, &coreModels.ScanError{
			VolumeID: volumeID,
			Code:     "CIRCUIT_BREAKER_OPEN",
			Message:  "circuit breaker is open, too many recent failures",
			Context: map[string]any{
				"circuit_breaker_stats": vs.circuitBreaker.GetStats(),
			},
		}
	}

	// Check cache
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

	// Check if incremental scanning is enabled and available
	var prevSnapshot *repo.VolumeSnapshot
	var scanMethod string = "full" // Default to full scan

	if vs.incrementalScanner != nil && !vs.config.Scanning.IncrementalForceFullScan {
		canUseIncremental, snapshot, err := vs.incrementalScanner.ShouldUseIncrementalScan(ctx, volumeID)
		if err != nil {
			if vs.logger != nil {
				vs.logger.Printf("Error checking incremental scan availability for volume %s: %v", volumeID, err)
			}
			// Continue with full scan
		} else if canUseIncremental {
			prevSnapshot = snapshot
			scanMethod = "incremental"
			if vs.logger != nil {
				vs.logger.Printf("Using incremental scan for volume %s (prev_snapshot_id=%d, snapshot_time=%s)",
					volumeID, prevSnapshot.ID, prevSnapshot.SnapshotTime.Format(time.RFC3339))
			}
			// Note: Actual incremental scanning (detecting changes and only scanning changed paths)
			// is deferred to filesystem indexing phase. The scan method still performs a full
			// size calculation, but the snapshot will help with faster rescans in the future.
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
			vs.logger.Printf("Starting volume scan with retry: volume=%s method=%s path=%s estimated_duration=%v",
				volumeID, method.Name(), volumePath, method.EstimatedDuration(volumePath))
		}

		result, err := vs.scanWithRetry(ctx, method, volumeID, volumePath)
		if err != nil {
			if vs.logger != nil {
				vs.logger.Printf("Scan method %s failed after retries for volume %s: %v",
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

		// Create snapshot after successful scan for future incremental scans
		if vs.incrementalScanner != nil {
			scanID := vs.getScanIDForVolume(volumeID)
			go func() {
				_, err := vs.incrementalScanner.CreateSnapshot(context.Background(), volumeID, scanID, volumePath, scanMethod)
				if err != nil && vs.logger != nil {
					vs.logger.Printf("Failed to create snapshot for volume %s: %v", volumeID, err)
				}
			}()
		}

		// Trigger filesystem indexing if enabled
		if vs.filesystemIndexer != nil {
			scanID := vs.getScanIDForVolume(volumeID)
			go vs.performFilesystemIndexing(ctx, volumeID, volumePath, scanID)
		}

		return result, nil
	}

	// All methods failed after retries
	return nil, &coreModels.ScanError{
		VolumeID: volumeID,
		Code:     coreModels.ErrorCodeAllMethodsFailed,
		Message:  "all scan methods failed after retries",
		Err:      lastErr,
		Context: map[string]any{
			"attempted_methods": vs.getMethodNames(),
			"volume_path":       volumePath,
			"retry_config":      vs.retryConfig,
		},
	}
}

// GetAvailableMethods returns information about available scan methods
func (vs *VolumeScanner) GetAvailableMethods() []interfaces.MethodInfo {
	methods := make([]interfaces.MethodInfo, len(vs.methods))

	for i, method := range vs.methods {
		var performance, accuracy string
		var features []string

		switch method.Name() {
		case "progressive_diskus":
			performance = "fast"
			accuracy = "high"
			features = []string{"very_fast", "progressive", "external_tool"}
		case "progressive_du":
			performance = "medium"
			accuracy = "high"
			features = []string{"reliable", "progressive", "standard_tool"}
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

// getScanIDForVolume retrieves the scan ID for a given volume ID
func (vs *VolumeScanner) getScanIDForVolume(volumeID string) string {
	vs.scanMutex.RLock()
	defer vs.scanMutex.RUnlock()

	if scanID, exists := vs.volumeToScan[volumeID]; exists {
		return scanID
	}
	return ""
}
