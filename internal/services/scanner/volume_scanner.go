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
	retryConfig   RetryConfig
	timeoutConfig TimeoutConfig
	// circuitBreakers is keyed by ScanMethod.Name() — a failing method (e.g.
	// diskus misbehaving) trips only its own breaker, so du/native remain
	// available rather than the whole scan short-circuiting on one method's
	// problems.
	circuitBreakers map[string]*CircuitBreaker

	// Incremental scanning
	incrementalScanner *IncrementalScanner

	// indexedScanTimes tracks, per volume, the ScannedAt timestamp of the
	// most recent scan result that has already had filesystem indexing
	// triggered for it. A cache hit in ScanVolume returns a result computed
	// by an earlier scan — without this, that earlier scan's own indexing
	// trigger (in the method loop / scanIncremental, both unreachable once
	// the cache hit returns early) would never fire again, so any volume
	// scanned repeatedly within its cache TTL would never get re-indexed.
	// Comparing against the cached result's own ScannedAt (not "now") means
	// indexing triggers at most once per distinct scan result, not once per
	// cache-hit request, even when the same still-valid cached result is
	// returned many times in a row.
	indexedScanTimes   map[string]time.Time
	indexedScanTimesMu sync.Mutex
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

	// Volume size scan method — a single, work-stealing parallel walker (see
	// walker.go). Previously tried diskus/du as faster external binaries
	// before falling back to a naive single-threaded Go walk; benchmarking
	// showed a properly-parallelized Go walker matches or beats both on
	// every workload tested (local and CIFS-mounted), so those external
	// dependencies were removed.
	methods := []interfaces.ScanMethod{
		NewWalker(config.Scanning),
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

	// Configure circuit breakers, one per method
	circuitBreakers := newCircuitBreakersForMethods(methods, config.Scanning.CircuitBreakerEnabled)

	scanner := &VolumeScanner{
		methods:          methods,
		cache:            cache,
		metrics:          metrics,
		logger:           logger,
		dockerService:    dockerService,
		semaphore:        make(chan struct{}, config.Scanning.MaxConcurrent),
		config:           config,
		activeScans:      make(map[string]*interfaces.ScanProgress),
		volumeToScan:     make(map[string]string),
		volumeMapping:    volumeConfig.NewVolumeMappingConfig(),
		progressManager:  progressManager,
		retryConfig:      retryConfig,
		timeoutConfig:    timeoutConfig,
		circuitBreakers:  circuitBreakers,
		indexedScanTimes: make(map[string]time.Time),
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

	// Volume size scan method — a single, work-stealing parallel walker (see
	// walker.go). Previously tried diskus/du as faster external binaries
	// before falling back to a naive single-threaded Go walk; benchmarking
	// showed a properly-parallelized Go walker matches or beats both on
	// every workload tested (local and CIFS-mounted), so those external
	// dependencies were removed.
	methods := []interfaces.ScanMethod{
		NewWalker(config.Scanning),
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

	// Configure circuit breakers, one per method
	circuitBreakers := newCircuitBreakersForMethods(methods, config.Scanning.CircuitBreakerEnabled)

	// Initialize incremental scanner
	var incrementalScanner *IncrementalScanner
	if config.Scanning.IncrementalEnabled {
		incrementalScanner = NewIncrementalScanner(store)
	}

	scanner := &VolumeScanner{
		methods:            methods,
		cache:              cache,
		metrics:            metrics,
		logger:             logger,
		dockerService:      dockerService,
		semaphore:          make(chan struct{}, config.Scanning.MaxConcurrent),
		config:             config,
		activeScans:        make(map[string]*interfaces.ScanProgress),
		volumeToScan:       make(map[string]string),
		volumeMapping:      volumeConfig.NewVolumeMappingConfig(),
		filesystemIndexer:  filesystemIndexer,
		foldersRepo:        foldersRepo,
		filesRepo:          filesRepo,
		volumesRepo:        store.Volumes(),
		previewService:     previewService,
		store:              store,
		progressManager:    progressManager,
		retryConfig:        retryConfig,
		timeoutConfig:      timeoutConfig,
		circuitBreakers:    circuitBreakers,
		incrementalScanner: incrementalScanner,
		indexedScanTimes:   make(map[string]time.Time),
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

	// Wrap with this method's own circuit breaker — a method tripping its
	// breaker only affects that method, not its siblings.
	cb := vs.circuitBreakerFor(method.Name())
	err := cb.Call(func() error {
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
		cbState := cb.GetState()
		if cbState != StateClosed {
			vs.logger.Printf("Circuit breaker state changed: method=%s state=%s stats=%v",
				method.Name(), cbState, cb.GetStats())
		}
	}

	return result, err
}

// circuitBreakerFor returns the circuit breaker for a given scan method,
// lazily creating a disabled (never-opens) one if the method wasn't known at
// construction time — this should not normally happen since vs.methods is
// fixed at construction, but avoids a nil-map panic if it ever does.
func (vs *VolumeScanner) circuitBreakerFor(methodName string) *CircuitBreaker {
	if cb, ok := vs.circuitBreakers[methodName]; ok {
		return cb
	}
	return &CircuitBreaker{state: StateClosed, failureThreshold: 999999}
}

// triggerIndexingOncePerScanResult starts filesystem indexing for volumeID,
// unless indexing has already been triggered for this exact scan result
// (identified by result.ScannedAt). This is the single place all three
// indexing-trigger call sites go through — the full-scan method loop,
// scanIncremental, and a ScanVolume cache hit — specifically so a cache hit
// returning a result that scanIncremental or the method loop already
// triggered indexing for doesn't trigger it a second, redundant time, while
// a cache hit returning a result that never got a trigger at all (the bug
// this exists to fix: a cache hit used to skip indexing entirely, silently,
// for as long as the cached result stayed valid) still gets one.
//
// Indexed once per distinct scan result (keyed by ScannedAt), not once per
// call — indexing a large volume is a genuinely expensive walk even
// incrementally, so it must not re-run on every repeated cache-hit status
// check against the same still-valid cached size.
func (vs *VolumeScanner) triggerIndexingOncePerScanResult(ctx context.Context, volumeID, volumePath string, result *interfaces.ScanResult) {
	if vs.filesystemIndexer == nil || !vs.markIndexingTriggered(volumeID, result.ScannedAt) {
		return
	}

	scanID := vs.getScanIDForVolume(volumeID)
	knownCounts := &filesystem.KnownCounts{
		Files:   int64(result.FileCount),
		Folders: int64(result.DirectoryCount),
	}
	SafeGo(vs.logger, "perform-filesystem-indexing", func() {
		vs.performFilesystemIndexing(ctx, volumeID, volumePath, scanID, knownCounts)
	})
}

// markIndexingTriggered records that indexing has been triggered for
// volumeID's given scan result (keyed by ScannedAt), returning true if this
// is the first time — i.e. the caller should actually trigger indexing —
// and false if a trigger for this exact result was already recorded.
func (vs *VolumeScanner) markIndexingTriggered(volumeID string, scannedAt time.Time) bool {
	vs.indexedScanTimesMu.Lock()
	defer vs.indexedScanTimesMu.Unlock()

	if vs.indexedScanTimes[volumeID].Equal(scannedAt) {
		return false
	}
	vs.indexedScanTimes[volumeID] = scannedAt
	return true
}

// triggerIndexingForCachedResult is triggerIndexingOncePerScanResult's entry
// point from a ScanVolume cache hit specifically, where volumePath hasn't
// been resolved yet (the cache hit returns before that point). Checks the
// once-per-result gate *before* resolving the path — a cache hit is the
// fast path by design, and resolving the volume path costs a Docker API
// call, so it must not run on every cache-hit request when the overwhelming
// majority already have indexing triggered and skip out here.
func (vs *VolumeScanner) triggerIndexingForCachedResult(ctx context.Context, volumeID string, result *interfaces.ScanResult) {
	if vs.filesystemIndexer == nil || !vs.markIndexingTriggered(volumeID, result.ScannedAt) {
		return
	}

	volumePath, err := vs.getVolumePath(volumeID)
	if err != nil {
		if vs.logger != nil {
			vs.logger.Printf("Cache hit for volume %s but could not resolve path to trigger indexing: %v", volumeID, err)
		}
		return
	}

	scanID := vs.getScanIDForVolume(volumeID)
	knownCounts := &filesystem.KnownCounts{
		Files:   int64(result.FileCount),
		Folders: int64(result.DirectoryCount),
	}
	SafeGo(vs.logger, "perform-filesystem-indexing", func() {
		vs.performFilesystemIndexing(ctx, volumeID, volumePath, scanID, knownCounts)
	})
}

// ScanVolume scans a volume and returns size information
func (vs *VolumeScanner) ScanVolume(ctx context.Context, volumeID string) (*interfaces.ScanResult, error) {
	// Check cache
	if result := vs.cache.Get(volumeID); result != nil {
		vs.metrics.CacheHit(volumeID)
		if vs.logger != nil {
			vs.logger.Printf("Cache hit for volume scan: %s", volumeID)
		}
		vs.triggerIndexingForCachedResult(ctx, volumeID, result)
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

	// If a usable previous snapshot exists, ScanAndSnapshot both computes the
	// current size AND detects per-directory changes in a single filesystem
	// walk — genuinely faster than running du/diskus/native and then walking
	// the tree again afterward just to build the next snapshot.
	if vs.incrementalScanner != nil && !vs.config.Scanning.IncrementalForceFullScan {
		canUseIncremental, prevSnapshot, err := vs.incrementalScanner.ShouldUseIncrementalScan(ctx, volumeID)
		if err != nil && vs.logger != nil {
			vs.logger.Printf("Error checking incremental scan availability for volume %s: %v", volumeID, err)
		}

		if canUseIncremental {
			if vs.logger != nil {
				vs.logger.Printf("Using incremental scan for volume %s (prev_snapshot_id=%d, snapshot_time=%s)",
					volumeID, prevSnapshot.ID, prevSnapshot.SnapshotTime.Format(time.RFC3339))
			}

			result, err := vs.scanIncremental(ctx, volumeID, volumePath, prevSnapshot)
			if err == nil {
				return result, nil
			}
			if vs.logger != nil {
				vs.logger.Printf("Incremental scan failed for volume %s, falling back to full scan: %v", volumeID, err)
			}
			// Fall through to the full-scan method loop below.
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

		if cb := vs.circuitBreakerFor(method.Name()); cb.GetState() == StateOpen {
			if vs.logger != nil {
				vs.logger.Printf("Skipping scan method %s for volume %s: circuit breaker open (stats=%v)",
					method.Name(), volumeID, cb.GetStats())
			}
			lastErr = &coreModels.ScanError{
				VolumeID: volumeID,
				Method:   method.Name(),
				Code:     "CIRCUIT_BREAKER_OPEN",
				Message:  "circuit breaker is open for this method, too many recent failures",
				Context: map[string]any{
					"circuit_breaker_stats": cb.GetStats(),
				},
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

		// Create a snapshot after a full scan so a future scan of this volume
		// can go through the faster incremental path instead. This does its
		// own single-pass walk to gather per-directory data that du/diskus/
		// native don't produce themselves.
		if vs.incrementalScanner != nil {
			scanID := vs.getScanIDForVolume(volumeID)
			methodName := method.Name()
			scanDuration := result.Duration
			SafeGo(vs.logger, "create-incremental-snapshot", func() {
				snapCtx := context.Background()
				scanResult, err := vs.incrementalScanner.ScanAndSnapshot(snapCtx, volumeID, volumePath, nil)
				if err != nil {
					if vs.logger != nil {
						vs.logger.Printf("Failed to gather snapshot data for volume %s: %v", volumeID, err)
					}
					return
				}
				if _, err := vs.incrementalScanner.CreateSnapshot(snapCtx, volumeID, scanID, methodName, scanDuration, scanResult); err != nil && vs.logger != nil {
					vs.logger.Printf("Failed to create snapshot for volume %s: %v", volumeID, err)
				}
			})
		}

		// Trigger filesystem indexing if enabled
		vs.triggerIndexingOncePerScanResult(ctx, volumeID, volumePath, result)

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

// scanIncremental computes a volume's current size via a single filesystem
// walk that also detects per-directory changes against prevSnapshot and
// gathers everything needed to persist the next snapshot — see
// IncrementalScanner.ScanAndSnapshot. This replaces running a full
// du/diskus/native scan and then walking the tree again afterward just to
// build the snapshot: one walk instead of two.
func (vs *VolumeScanner) scanIncremental(ctx context.Context, volumeID, volumePath string, prevSnapshot *repo.VolumeSnapshot) (*interfaces.ScanResult, error) {
	start := time.Now()

	scanResult, err := vs.incrementalScanner.ScanAndSnapshot(ctx, volumeID, volumePath, prevSnapshot)
	if err != nil {
		return nil, err
	}

	duration := time.Since(start)
	result := &interfaces.ScanResult{
		TotalSize:      scanResult.TotalSize,
		FileCount:      int(scanResult.FileCount),
		DirectoryCount: int(scanResult.FolderCount),
		Method:         "incremental",
		ScannedAt:      time.Now(),
		Duration:       duration,
		FilesystemType: vs.detectFilesystemType(volumePath),
	}

	cacheTTL := vs.calculateCacheTTL(result)
	if err := vs.cache.Set(volumeID, result, cacheTTL); err != nil && vs.logger != nil {
		vs.logger.Printf("Failed to cache scan result for volume %s: %v", volumeID, err)
	}

	vs.metrics.ScanCompleted(volumeID, "incremental", duration, result.TotalSize)
	if volume, err := vs.dockerService.GetVolume(context.Background(), volumeID); err == nil {
		vs.metrics.UpdateVolumeMetrics(volumeID, volume.Name, volume.Driver, result.FilesystemType, result.TotalSize, result.FileCount, "incremental")
	}

	if vs.logger != nil {
		vs.logger.Printf("Volume scan completed: volume=%s method=incremental size=%d duration=%v (changed=%d added=%d deleted=%d unchanged=%d)",
			volumeID, result.TotalSize, duration,
			len(scanResult.Changes.ChangedPaths), len(scanResult.Changes.AddedPaths),
			len(scanResult.Changes.DeletedPaths), len(scanResult.Changes.UnchangedPaths))
	}

	scanID := vs.getScanIDForVolume(volumeID)
	SafeGo(vs.logger, "create-incremental-snapshot", func() {
		if _, err := vs.incrementalScanner.CreateSnapshot(context.Background(), volumeID, scanID, "incremental", duration, scanResult); err != nil && vs.logger != nil {
			vs.logger.Printf("Failed to create snapshot for volume %s: %v", volumeID, err)
		}
	})

	vs.triggerIndexingOncePerScanResult(ctx, volumeID, volumePath, result)

	return result, nil
}

// GetAvailableMethods returns information about available scan methods
func (vs *VolumeScanner) GetAvailableMethods() []interfaces.MethodInfo {
	methods := make([]interfaces.MethodInfo, len(vs.methods))

	for i, method := range vs.methods {
		var performance, accuracy string
		var features []string

		switch method.Name() {
		case "walker":
			performance = "fast"
			accuracy = "high"
			features = []string{"parallel", "detailed_stats", "progress_reporting", "always_available"}
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
