package filesystem

import (
	"context"
	"sync"
	"time"

	"github.com/mantonx/volumeviz/internal/interfaces"
	"github.com/mantonx/volumeviz/internal/realtime"
	"github.com/mantonx/volumeviz/internal/services/previews"
	"github.com/mantonx/volumeviz/internal/store"
)

// FilesystemIndexer provides streaming filesystem indexing with rich metadata
type FilesystemIndexer struct {
	store             store.Store
	config            IndexerConfig
	mimeDetector      *MimeDetector
	metadataExtractor *MetadataExtractor
	progressTracker   *ProgressTracker
	previewService    *previews.Service
	enrichmentManager interfaces.EnrichmentManager

	// Progress tracking - map by volume ID to support multiple concurrent scans
	progressMutex sync.RWMutex
	activeScans   map[string]*IndexingProgress
}

// IndexerConfig holds configuration for filesystem indexing
type IndexerConfig struct {
	// Hashing configuration
	EnableHashing       bool   `yaml:"enable_hashing" env:"VV_ENABLE_HASHING" envDefault:"false"`
	MaxFileBytesForHash int64  `yaml:"max_file_bytes_for_hash" env:"VV_MAX_FILE_BYTES_FOR_HASH" envDefault:"10485760"` // 10MB
	HashAlgorithm       string `yaml:"hash_algorithm" env:"VV_HASH_ALGO" envDefault:"sha256"`

	// Skip rules
	SkipPatterns []string `yaml:"skip_patterns" env:"VV_SKIP_PATTERNS" envSeparator:","`
	SkipHidden   bool     `yaml:"skip_hidden" env:"VV_SKIP_HIDDEN" envDefault:"true"`

	// Performance settings
	MaxDepth        int `yaml:"max_depth" env:"VV_MAX_DEPTH" envDefault:"20"`
	ConcurrentReads int `yaml:"concurrent_reads" env:"VV_CONCURRENT_READS" envDefault:"5"`
	BatchSize       int `yaml:"batch_size" env:"VV_BATCH_SIZE" envDefault:"1000"`

	// Metadata collection
	CollectExtendedAttributes bool `yaml:"collect_extended_attributes" env:"VV_COLLECT_EXTENDED_ATTRS" envDefault:"false"`
	DetectMimeTypes           bool `yaml:"detect_mime_types" env:"VV_DETECT_MIME_TYPES" envDefault:"true"`
}

// IndexingProgress tracks the progress of filesystem indexing
type IndexingProgress struct {
	VolumeID   string    `json:"volume_id"`
	ScanID     string    `json:"scan_id,omitempty"` // Associated scan ID for database progress tracking
	Status     string    `json:"status"`            // "running", "completed", "failed", "canceled"
	StartedAt  time.Time `json:"started_at"`
	LastUpdate time.Time `json:"last_update"`

	// Totals (discovered during pre-scan)
	TotalFiles   int64 `json:"total_files"`
	TotalFolders int64 `json:"total_folders"`

	// Counters
	FoldersScanned int64 `json:"folders_scanned"`
	FilesScanned   int64 `json:"files_scanned"`
	BytesProcessed int64 `json:"bytes_processed"`
	ErrorsCount    int64 `json:"errors_count"`

	// Current state
	CurrentPath  string `json:"current_path"`
	CurrentDepth int    `json:"current_depth"`

	// Rates
	FoldersPerSec float64 `json:"folders_per_sec"`
	FilesPerSec   float64 `json:"files_per_sec"`

	// Errors
	LastError string `json:"last_error,omitempty"`
}

// NewFilesystemIndexer creates a new filesystem indexer
func NewFilesystemIndexer(store store.Store, config IndexerConfig, previewService *previews.Service, enrichmentManager interfaces.EnrichmentManager) *FilesystemIndexer {
	// Create progress tracker with 2-second update interval
	progressTracker := NewProgressTracker(store, 2*time.Second)

	// Start periodic flush to ensure pending updates are sent
	ctx := context.Background()
	progressTracker.StartPeriodicFlush(ctx)

	return &FilesystemIndexer{
		store:             store,
		config:            config,
		mimeDetector:      NewMimeDetector(),
		metadataExtractor: NewMetadataExtractor(config),
		progressTracker:   progressTracker,
		previewService:    previewService,
		enrichmentManager: enrichmentManager,
		activeScans:       make(map[string]*IndexingProgress),
	}
}

// Legacy method removed - progress broadcasting is now handled by comprehensive progress broadcaster

// IndexVolume performs complete filesystem indexing for a volume
func (fi *FilesystemIndexer) IndexVolume(ctx context.Context, volumeID, mountpoint string, deltaMode bool) error {
	return fi.IndexVolumeWithScanID(ctx, volumeID, mountpoint, deltaMode, "")
}

// IndexVolumeWithScanID performs complete filesystem indexing for a volume with scan ID for database progress tracking
func (fi *FilesystemIndexer) IndexVolumeWithScanID(ctx context.Context, volumeID, mountpoint string, deltaMode bool, scanID string) error {
	walker := NewWalker(fi, volumeID, deltaMode)
	return walker.Walk(ctx, mountpoint, scanID)
}

// ResumePausedScan attempts to resume a paused filesystem indexing scan
func (fi *FilesystemIndexer) ResumePausedScan(ctx context.Context, volumeID, mountpoint, scanID string) error {
	resumeWalker := NewResumeWalker(fi, volumeID)
	return resumeWalker.ResumeFromCheckpoint(ctx, mountpoint, scanID)
}

// GetProgress returns the current indexing progress
func (fi *FilesystemIndexer) GetProgress() *IndexingProgress {
	fi.progressMutex.RLock()
	defer fi.progressMutex.RUnlock()

	// Return the first active scan if any
	for _, scan := range fi.activeScans {
		if scan != nil && scan.Status == "running" {
			// Create a copy to avoid race conditions
			progress := *scan
			return &progress
		}
	}

	return nil
}

// GetIndexingProgress returns the current indexing progress for a volume
func (fi *FilesystemIndexer) GetIndexingProgress(volumeID string) *IndexingProgress {
	fi.progressMutex.RLock()
	defer fi.progressMutex.RUnlock()

	if scan, exists := fi.activeScans[volumeID]; exists && scan != nil {
		// Create a copy to avoid race conditions
		progress := *scan

		// Calculate rates if we have data
		if progress.LastUpdate.After(progress.StartedAt) {
			elapsed := progress.LastUpdate.Sub(progress.StartedAt).Seconds()
			if elapsed > 0 {
				progress.FilesPerSec = float64(progress.FilesScanned) / elapsed
				progress.FoldersPerSec = float64(progress.FoldersScanned) / elapsed
			}
		}

		return &progress
	}

	return nil
}

// SetEnrichmentManager updates the enrichment manager for the filesystem indexer
func (fi *FilesystemIndexer) SetEnrichmentManager(manager interfaces.EnrichmentManager) {
	fi.enrichmentManager = manager
}

// SetProgressBroadcaster sets the progress broadcaster on the progress tracker
func (fi *FilesystemIndexer) SetProgressBroadcaster(broadcaster *realtime.ProgressBroadcaster) {
	if fi.progressTracker != nil {
		fi.progressTracker.SetProgressBroadcaster(broadcaster)
	}
}

// Internal methods for progress tracking - these will be called by walkers

// updateProgress updates the current path and calculates rates
func (fi *FilesystemIndexer) updateProgress(volumeID, currentPath string, depth int) {
	fi.progressMutex.Lock()
	defer fi.progressMutex.Unlock()

	if scan, exists := fi.activeScans[volumeID]; exists && scan != nil {
		scan.CurrentPath = currentPath
		scan.CurrentDepth = depth
		scan.LastUpdate = time.Now()

		// Calculate rates
		elapsed := time.Since(scan.StartedAt).Seconds()
		if elapsed > 0 {
			scan.FoldersPerSec = float64(scan.FoldersScanned) / elapsed
			scan.FilesPerSec = float64(scan.FilesScanned) / elapsed
		}
	}
}

// incrementFolderCount increments folder count and queues progress update
func (fi *FilesystemIndexer) incrementFolderCount(volumeID string) {
	fi.progressMutex.Lock()
	defer fi.progressMutex.Unlock()
	if scan, exists := fi.activeScans[volumeID]; exists && scan != nil {
		scan.FoldersScanned++

		// Use throttled update instead of direct database update
		if scan.ScanID != "" && fi.progressTracker != nil {
			fi.progressTracker.QueueProgressUpdate(scan.ScanID, scan)
		}
	}
}

// incrementFileCount increments file count and queues progress update
func (fi *FilesystemIndexer) incrementFileCount(volumeID string) {
	fi.progressMutex.Lock()
	defer fi.progressMutex.Unlock()
	if scan, exists := fi.activeScans[volumeID]; exists && scan != nil {
		scan.FilesScanned++

		// Use throttled update instead of direct database update
		if scan.ScanID != "" && fi.progressTracker != nil {
			fi.progressTracker.QueueProgressUpdate(scan.ScanID, scan)
		}

		// Trigger media enrichment every batch of files (every 500 files)
		if fi.enrichmentManager != nil && scan.FilesScanned%500 == 0 {
			go fi.triggerBatchEnrichment(context.Background(), volumeID, scan)
		}
	}
}

// addBytesProcessed adds to the bytes processed counter
func (fi *FilesystemIndexer) addBytesProcessed(volumeID string, bytes int64) {
	fi.progressMutex.Lock()
	defer fi.progressMutex.Unlock()
	if scan, exists := fi.activeScans[volumeID]; exists && scan != nil {
		scan.BytesProcessed += bytes
	}
}

// recordError records an error and increments error count
func (fi *FilesystemIndexer) recordError(volumeID, msg string) {
	fi.progressMutex.Lock()
	defer fi.progressMutex.Unlock()
	if scan, exists := fi.activeScans[volumeID]; exists && scan != nil {
		scan.ErrorsCount++
		scan.LastError = msg
	}
}

// triggerBatchEnrichment processes a batch of files for media enrichment
func (fi *FilesystemIndexer) triggerBatchEnrichment(ctx context.Context, volumeID string, scan *IndexingProgress) {
	if fi.enrichmentManager == nil {
		return
	}

	err := fi.enrichmentManager.EnrichVolumeWithScanID(ctx, volumeID, scan.ScanID)
	if err != nil {
		fi.recordError(volumeID, "Failed to trigger batch enrichment: "+err.Error())
	}
}
