// Package scanner provides volume scanning implementations
// Supports multiple scanning methods with fallback strategies
package scanner

import (
	"context"
	"fmt"
	"log"
	"os"
	"strings"
	"sync"
	"syscall"
	"time"

	volumeConfig "github.com/mantonx/volumeviz/internal/config"
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

type VolumesRepository interface {
	UpdateLastScanned(ctx context.Context, volumeID string, lastScanned time.Time) error
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

	// Volume mount path mapping configuration
	volumeMapping *volumeConfig.VolumeMappingConfig

	// Filesystem indexing integration
	filesystemIndexer *filesystem.FilesystemIndexer
	foldersRepo       FoldersRepository
	filesRepo         FilesRepository
	volumesRepo       VolumesRepository

	// Preview generation integration
	previewService *previews.Service

	// Media enrichment integration
	enrichmentManager interfaces.EnrichmentManager

	// Daily stats integration
	statsService interfaces.StatsService

	// Database store for progress tracking
	store store.Store

	// Progress throttling to prevent database flooding during scans
	progressThrottler *filesystem.ProgressThrottler
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
		volumeMapping: volumeConfig.NewVolumeMappingConfig(),
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
		nil, // EnrichmentManager will be set later via SetEnrichmentManager
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
		volumeMapping:     volumeConfig.NewVolumeMappingConfig(),
		filesystemIndexer: filesystemIndexer,
		foldersRepo:       foldersRepo,
		filesRepo:         filesRepo,
		volumesRepo:       store.Volumes(), // Get volumes repository from store
		previewService:    previewService,
		store:             store, // Store for scan progress tracking
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
	vs.store = store // Set store for scan progress tracking
	
	// Initialize progress throttler with 2-second interval
	if store != nil {
		vs.progressThrottler = filesystem.NewProgressThrottler(store, 2*time.Second)
		// Start periodic flush to ensure pending updates are sent
		ctx := context.Background()
		vs.progressThrottler.StartPeriodicFlush(ctx)
	}
	
	// Initialize volume mapping if not already set
	if vs.volumeMapping == nil {
		vs.volumeMapping = volumeConfig.NewVolumeMappingConfig()
	}
	vs.filesystemIndexer = filesystem.NewFilesystemIndexer(
		store,
		indexerConfig,
		previewService,
		vs.enrichmentManager, // Use the volume scanner's enrichment manager
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
			// Get scan ID for this volume if available
			scanID := vs.getScanIDForVolume(volumeID)
			go vs.performFilesystemIndexing(ctx, volumeID, volumePath, scanID)
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

	// Initialize database progress tracking if store is available
	if vs.store != nil {
		// Use background context to avoid cancellation when HTTP request completes
		go vs.initializeDatabaseProgress(context.Background(), scanID, volumeID)
		
		// Create scan job record so it appears in volume API status
		go func() {
			ctx := context.Background()
			scansRepo := vs.store.Scans()
			if scansRepo != nil {
				scanJob := coreModels.CreateScanJobParams{
					ScanID:   scanID,
					VolumeID: volumeID,
					Status:   "running",
					Method:   "async",
				}
				_, err := scansRepo.CreateScanJob(ctx, scanJob)
				if err != nil && vs.logger != nil {
					vs.logger.Printf("Failed to create scan job record for scan %s: %v", scanID, err)
				} else if vs.logger != nil {
					vs.logger.Printf("Created scan job record for scan %s", scanID)
				}
			}
		}()
	}

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
			// Update database - mark volume scan phase as failed
			if vs.store != nil {
				go vs.updateVolumePhaseStatus(context.Background(), scanID, "failed", err.Error())
				
				// Also update scan job status
				go func() {
					ctx := context.Background()
					scansRepo := vs.store.Scans()
					if scansRepo != nil {
						if updateErr := scansRepo.FailScanJob(ctx, scanID, err.Error()); updateErr != nil && vs.logger != nil {
							vs.logger.Printf("Failed to update scan job status for scan %s: %v", scanID, updateErr)
						}
					}
				}()
			}
		} else {
			progress.Status = coreModels.ScanStatusCompleted
			progress.Progress = 1.0
			progress.Method = result.Method

			// Update database - mark volume scan phase as completed
			if vs.store != nil {
				go vs.updateVolumePhaseStatus(context.Background(), scanID, "completed", "")
				
				// Also update scan job status
				go func() {
					ctx := context.Background()
					scansRepo := vs.store.Scans()
					if scansRepo != nil {
						if updateErr := scansRepo.CompletesScanJob(ctx, scanID); updateErr != nil && vs.logger != nil {
							vs.logger.Printf("Failed to update scan job status for scan %s: %v", scanID, updateErr)
						}
					}
				}()
			}

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
			Status:    "completed",
			StartedAt: &progress.StartedAt,
			Progress:  1.0,
		}

		progress.Phases["filesystem_indexing"] = &interfaces.PhaseInfo{
			Status:   "pending",
			Progress: 0.0,
		}

		progress.Phases["media_enrichment"] = &interfaces.PhaseInfo{
			Status:   "pending",
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
					remaining := float64(progress.TotalEstimated-progress.FilesScanned) / progress.FilesPerSecond
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
// initializeDatabaseProgress creates scan phases in the database for detailed tracking
func (vs *VolumeScanner) initializeDatabaseProgress(ctx context.Context, scanID, volumeID string) {
	if vs.store == nil {
		if vs.logger != nil {
			vs.logger.Printf("Store is nil, skipping database progress initialization for scan %s", scanID)
		}
		return
	}

	if vs.logger != nil {
		vs.logger.Printf("Initializing database progress for scan %s (volume: %s)", scanID, volumeID)
	}

	scanProgressRepo := vs.store.ScanProgress()
	if scanProgressRepo == nil {
		if vs.logger != nil {
			vs.logger.Printf("ScanProgress repo is nil for scan %s", scanID)
		}
		return
	}

	now := time.Now()

	// Create volume scan phase
	if vs.logger != nil {
		vs.logger.Printf("Creating volume_scan phase for scan %s", scanID)
	}
	_, err := scanProgressRepo.CreateScanPhase(ctx, models.CreateScanPhaseParams{
		ScanID:     scanID,
		PhaseName:  "volume_scan",
		PhaseOrder: 1,
		Status:     "running",
		StartedAt:  &now,
		Metadata:   "{}",
	})
	if err != nil && vs.logger != nil {
		vs.logger.Printf("Failed to create volume_scan phase for scan %s: %v", scanID, err)
	} else if vs.logger != nil {
		vs.logger.Printf("Successfully created volume_scan phase for scan %s", scanID)
	}

	// Create filesystem indexing phase
	if vs.logger != nil {
		vs.logger.Printf("Creating filesystem_indexing phase for scan %s", scanID)
	}
	_, err = scanProgressRepo.CreateScanPhase(ctx, models.CreateScanPhaseParams{
		ScanID:     scanID,
		PhaseName:  "filesystem_indexing",
		PhaseOrder: 2,
		Status:     "pending",
		Metadata:   "{}",
	})
	if err != nil && vs.logger != nil {
		vs.logger.Printf("Failed to create filesystem_indexing phase for scan %s: %v", scanID, err)
	} else if vs.logger != nil {
		vs.logger.Printf("Successfully created filesystem_indexing phase for scan %s", scanID)
	}

	// Create media enrichment phase
	if vs.logger != nil {
		vs.logger.Printf("Creating media_enrichment phase for scan %s", scanID)
	}
	_, err = scanProgressRepo.CreateScanPhase(ctx, models.CreateScanPhaseParams{
		ScanID:     scanID,
		PhaseName:  "media_enrichment",
		PhaseOrder: 3,
		Status:     "pending",
		Metadata:   "{}",
	})
	if err != nil && vs.logger != nil {
		vs.logger.Printf("Failed to create media_enrichment phase for scan %s: %v", scanID, err)
	} else if vs.logger != nil {
		vs.logger.Printf("Successfully created media_enrichment phase for scan %s", scanID)
	}

	if vs.logger != nil {
		vs.logger.Printf("Database progress initialization completed for scan %s", scanID)
	}
}

// updateVolumePhaseStatus updates the volume scan phase status in the database
func (vs *VolumeScanner) updateVolumePhaseStatus(ctx context.Context, scanID, status, errorMessage string) {
	if vs.store == nil {
		return
	}

	// Flush any pending throttled updates before status change
	if vs.progressThrottler != nil {
		vs.progressThrottler.FlushPending(ctx, scanID)
	}

	scanProgressRepo := vs.store.ScanProgress()

	if status == "completed" {
		err := scanProgressRepo.CompleteScanPhase(ctx, scanID, "volume_scan")
		if err != nil && vs.logger != nil {
			vs.logger.Printf("Failed to complete volume_scan phase for scan %s: %v", scanID, err)
		}
		
		// Cleanup throttler tracking for completed scan
		if vs.progressThrottler != nil {
			updates, throttled := vs.progressThrottler.GetStats(scanID)
			if throttled > 0 && vs.logger != nil {
				reductionRate := float64(throttled) / float64(updates) * 100
				vs.logger.Printf("Scan %s throttling stats - Updates: %d, Throttled: %d (%.1f%% DB write reduction)",
					scanID, updates, throttled, reductionRate)
			}
			vs.progressThrottler.Cleanup(scanID)
		}
	} else if status == "failed" {
		err := scanProgressRepo.FailScanPhase(ctx, scanID, "volume_scan", errorMessage)
		if err != nil && vs.logger != nil {
			vs.logger.Printf("Failed to mark volume_scan phase as failed for scan %s: %v", scanID, err)
		}
		
		// Cleanup throttler tracking for failed scan
		if vs.progressThrottler != nil {
			vs.progressThrottler.Cleanup(scanID)
		}
	}
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

func calculateOverallProgress(phases map[string]*interfaces.PhaseInfo) float64 {
	if phases == nil {
		return 0.0
	}

	// Weight each phase (volume_scan: 10%, filesystem_indexing: 80%, media_enrichment: 10%)
	weights := map[string]float64{
		"volume_scan":         0.1,
		"filesystem_indexing": 0.8,
		"media_enrichment":    0.1,
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
	result.FilesystemCapacity = vs.getFilesystemCapacity(path)

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
// Uses volume mapping configuration for custom mount paths, with fallbacks
func (vs *VolumeScanner) getVolumePath(volumeID string) (string, error) {
	ctx := context.Background()

	// First priority: Check volume mapping configuration for custom container paths
	if vs.volumeMapping != nil {
		if containerPath, exists := vs.volumeMapping.GetContainerPath(volumeID); exists {
			// Validate the container path exists and is accessible
			if _, err := os.Stat(containerPath); err == nil {
				if vs.logger != nil {
					vs.logger.Printf("Using configured container path for volume %s: %s", volumeID, containerPath)
				}
				return containerPath, nil
			} else {
				if vs.logger != nil {
					vs.logger.Printf("Configured container path %s not accessible for volume %s, falling back", containerPath, volumeID)
				}
			}
		}
	}

	// Second priority: Check database for custom mountpoint (for backwards compatibility)
	if vs.store != nil {
		if dbVolume, err := vs.store.Volumes().GetVolumeByVolumeID(ctx, volumeID); err == nil && dbVolume != nil {
			if dbVolume.Mountpoint != "" {
				// Skip Docker default paths - these are handled by Docker volume info
				if !strings.HasPrefix(dbVolume.Mountpoint, "/var/lib/docker/volumes/") {
					// Validate the database mountpoint exists and is accessible
					if _, err := os.Stat(dbVolume.Mountpoint); err == nil {
						if vs.logger != nil {
							vs.logger.Printf("Using database mountpoint for volume %s: %s", volumeID, dbVolume.Mountpoint)
						}
						return dbVolume.Mountpoint, nil
					} else {
						if vs.logger != nil {
							vs.logger.Printf("Database mountpoint %s not accessible for volume %s, falling back", dbVolume.Mountpoint, volumeID)
						}
					}
				}
			}
		}
	}

	// Third priority: Get Docker volume information and check for device mounts
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

	// Final fallback: Use Docker internal mountpoint
	if vs.logger != nil {
		vs.logger.Printf("Using Docker mountpoint for volume %s: %s", volumeID, volume.Mountpoint)
	}
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

// getFilesystemCapacity gets filesystem capacity and usage information
func (vs *VolumeScanner) getFilesystemCapacity(path string) *interfaces.FilesystemInfo {
	var stat syscall.Statfs_t
	err := syscall.Statfs(path, &stat)
	if err != nil {
		// Return nil if we can't get filesystem stats
		return nil
	}

	// Calculate sizes in bytes
	blockSize := int64(stat.Bsize)
	totalBytes := int64(stat.Blocks) * blockSize
	availableBytes := int64(stat.Bavail) * blockSize // Available to non-superuser
	usedBytes := totalBytes - availableBytes

	// Calculate usage percentage
	var usagePercent float64
	if totalBytes > 0 {
		usagePercent = float64(usedBytes) / float64(totalBytes) * 100
	}

	return &interfaces.FilesystemInfo{
		TotalBytes:     totalBytes,
		AvailableBytes: availableBytes,
		UsedBytes:      usedBytes,
		UsagePercent:   usagePercent,
		BlockSize:      blockSize,
		TotalBlocks:    stat.Blocks,
		FreeBlocks:     stat.Bavail,
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
func (vs *VolumeScanner) performFilesystemIndexing(ctx context.Context, volumeID, volumePath, scanID string) {
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

	// Use the scan ID passed in from the caller
	// Perform filesystem indexing (delta mode for efficiency)
	var err error
	if scanID != "" {
		err = vs.filesystemIndexer.IndexVolumeWithScanID(indexCtx, volumeID, volumePath, true, scanID)
	} else {
		err = vs.filesystemIndexer.IndexVolume(indexCtx, volumeID, volumePath, true)
	}
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

	// Update last_scanned timestamp for the volume
	if vs.volumesRepo != nil {
		// Use a fresh context to avoid cancellation issues from the indexing timeout
		updateCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		if err := vs.volumesRepo.UpdateLastScanned(updateCtx, volumeID, time.Now()); err != nil {
			if vs.logger != nil {
				vs.logger.Printf("Failed to update last_scanned for volume %s: %v", volumeID, err)
			}
		}
	}

	// Trigger media enrichment if enabled
	if vs.enrichmentManager != nil && vs.enrichmentManager.IsEnabled() {
		// Use background context so enrichment can continue after scan completes
		go vs.performMediaEnrichment(context.Background(), volumeID)
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

	// Initialize enrichment phase tracking
	vs.scanMutex.Lock()
	scanID := vs.volumeToScan[volumeID]
	if scanID != "" && vs.activeScans[scanID] != nil {
		if vs.activeScans[scanID].Phases == nil {
			vs.activeScans[scanID].Phases = make(map[string]*interfaces.PhaseInfo)
		}
		startedAt := time.Now()
		vs.activeScans[scanID].Phases["media_enrichment"] = &interfaces.PhaseInfo{
			Status:    coreModels.ScanStatusRunning,
			Progress:  0.0,
			StartedAt: &startedAt,
		}
		// Update overall progress
		vs.activeScans[scanID].Progress = calculateOverallProgress(vs.activeScans[scanID].Phases)
	}
	vs.scanMutex.Unlock()

	// Create context with cancellation using background context to avoid cancellation when scan completes
	enrichCtx, cancel := context.WithTimeout(context.Background(), 30*time.Minute) // 30 min max for enrichment
	defer cancel()

	start := time.Now()

	// Monitor enrichment progress in background
	go vs.monitorEnrichmentProgress(volumeID, scanID)

	// Perform media enrichment
	var err error
	if scanID != "" {
		err = vs.enrichmentManager.EnrichVolumeWithScanID(enrichCtx, volumeID, scanID)
	} else {
		err = vs.enrichmentManager.EnrichVolume(enrichCtx, volumeID)
	}
	duration := time.Since(start)

	// Update final enrichment phase status
	vs.scanMutex.Lock()
	if scanID != "" && vs.activeScans[scanID] != nil && vs.activeScans[scanID].Phases != nil {
		if err != nil {
			vs.activeScans[scanID].Phases["media_enrichment"].Status = coreModels.ScanStatusFailed
			vs.activeScans[scanID].Phases["media_enrichment"].Error = err.Error()
		} else {
			vs.activeScans[scanID].Phases["media_enrichment"].Status = coreModels.ScanStatusCompleted
			vs.activeScans[scanID].Phases["media_enrichment"].Progress = 1.0
		}
		completedAt := time.Now()
		vs.activeScans[scanID].Phases["media_enrichment"].CompletedAt = &completedAt
		vs.activeScans[scanID].Phases["media_enrichment"].Duration = duration

		// Update overall progress
		vs.activeScans[scanID].Progress = calculateOverallProgress(vs.activeScans[scanID].Phases)
	}
	vs.scanMutex.Unlock()

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

// monitorEnrichmentProgress monitors enrichment progress and updates phase tracking
func (vs *VolumeScanner) monitorEnrichmentProgress(volumeID, scanID string) {
	if vs.enrichmentManager == nil || scanID == "" {
		return
	}

	ticker := time.NewTicker(2 * time.Second) // Check every 2 seconds
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			// Get enrichment progress from manager
			progress := vs.enrichmentManager.GetProgress(volumeID)
			if progress == nil {
				continue
			}

			vs.scanMutex.Lock()
			if vs.activeScans[scanID] != nil && vs.activeScans[scanID].Phases != nil {
				if phase, exists := vs.activeScans[scanID].Phases["media_enrichment"]; exists {
					// Update phase progress based on enrichment status
					if progress.TotalFiles > 0 {
						phase.Progress = float64(progress.ProcessedFiles) / float64(progress.TotalFiles)
					}

					// Update items processed count
					phase.ItemsProcessed = progress.ProcessedFiles

					// Update phase status
					switch progress.Status {
					case "running":
						phase.Status = coreModels.ScanStatusRunning
					case "completed":
						phase.Status = coreModels.ScanStatusCompleted
						phase.Progress = 1.0
					case "failed":
						phase.Status = coreModels.ScanStatusFailed
						if progress.LastError != "" {
							phase.Error = progress.LastError
						}
					}

					// Store detailed error information in phase for frontend access
					if len(progress.RecentErrors) > 0 {
						// Store recent errors as additional data in the phase
						// This will be accessible via the phases API field
						if vs.activeScans[scanID].Phases["media_enrichment"] != nil {
							// Add error details to the overall scan progress errors
							vs.activeScans[scanID].ErrorsCount = progress.ErrorsCount
							vs.activeScans[scanID].LastError = progress.LastError

							// Format recent errors for the API response
							errorMessages := make([]string, 0, len(progress.RecentErrors))
							for _, err := range progress.RecentErrors {
								errorMsg := fmt.Sprintf("%s: %s (%s) - %s", err.EnricherName, err.ErrorType, err.FileName, err.ErrorMessage)
								if err.TechnicalDetails != "" {
									errorMsg += fmt.Sprintf(" [%s]", err.TechnicalDetails)
								}
								errorMessages = append(errorMessages, errorMsg)
							}
							vs.activeScans[scanID].Errors = errorMessages
						}
					}

					// Update overall scan progress
					vs.activeScans[scanID].Progress = calculateOverallProgress(vs.activeScans[scanID].Phases)
				}
			}
			vs.scanMutex.Unlock()

			// Exit if enrichment is completed or failed
			if progress.Status == "completed" || progress.Status == "failed" {
				return
			}

		case <-time.After(5 * time.Minute): // Timeout after 5 minutes of no updates
			return
		}
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
	return vs.TriggerFilesystemIndexingWithScanID(ctx, volumeID, deltaMode, "")
}

// TriggerFilesystemIndexingWithScanID manually triggers filesystem indexing for a volume with scan ID
func (vs *VolumeScanner) TriggerFilesystemIndexingWithScanID(ctx context.Context, volumeID string, deltaMode bool, scanID string) error {
	if vs.filesystemIndexer == nil {
		return fmt.Errorf("filesystem indexing not enabled")
	}

	// Get the correct volume path using volume mapping configuration
	volumePath, err := vs.getVolumePath(volumeID)
	if err != nil {
		return fmt.Errorf("failed to get volume path: %w", err)
	}

	// Start indexing in a goroutine to avoid blocking
	go vs.performFilesystemIndexingAsync(ctx, volumeID, volumePath, deltaMode, scanID)

	return nil
}

// performFilesystemIndexingAsync performs filesystem indexing asynchronously
func (vs *VolumeScanner) performFilesystemIndexingAsync(ctx context.Context, volumeID, volumePath string, deltaMode bool, scanID string) {
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

	// Use the scan ID passed in from the caller
	// Perform filesystem indexing
	var err error
	if scanID != "" {
		err = vs.filesystemIndexer.IndexVolumeWithScanID(indexCtx, volumeID, volumePath, deltaMode, scanID)
	} else {
		err = vs.filesystemIndexer.IndexVolume(indexCtx, volumeID, volumePath, deltaMode)
	}
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
	// Also update the filesystem indexer if it exists
	if vs.filesystemIndexer != nil {
		vs.filesystemIndexer.SetEnrichmentManager(manager)
	}
}

// SetStatsService sets the daily stats service for scan completion hooks
func (vs *VolumeScanner) SetStatsService(service interfaces.StatsService) {
	vs.statsService = service
}
