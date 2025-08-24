package filesystem

import (
	"context"
	"crypto/md5"
	"crypto/sha256"
	"errors"
	"fmt"
	"io"
	"mime"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"sync"
	"syscall"
	"time"

	"github.com/mantonx/volumeviz/internal/interfaces"
	"github.com/mantonx/volumeviz/internal/models"
	"github.com/mantonx/volumeviz/internal/services/previews"
	"github.com/mantonx/volumeviz/internal/store"
)

// FilesystemIndexer provides streaming filesystem indexing with rich metadata
type FilesystemIndexer struct {
	store             store.Store
	config            IndexerConfig
	mimeDetector      *MimeDetector
	previewService    *previews.Service
	enrichmentManager interfaces.EnrichmentManager

	// Progress tracking - map by volume ID to support multiple concurrent scans
	progressMutex sync.RWMutex
	activeScans   map[string]*IndexingProgress
	
	// Progress throttling to prevent database flooding
	progressThrottler *ProgressThrottler
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
	// Create progress throttler with 2-second update interval
	progressThrottler := NewProgressThrottler(store, 2*time.Second)
	
	// Start periodic flush to ensure pending updates are sent
	ctx := context.Background()
	progressThrottler.StartPeriodicFlush(ctx)
	
	return &FilesystemIndexer{
		store:             store,
		config:            config,
		mimeDetector:      NewMimeDetector(),
		previewService:    previewService,
		enrichmentManager: enrichmentManager,
		activeScans:       make(map[string]*IndexingProgress),
		progressThrottler: progressThrottler,
	}
}

// IndexVolume performs complete filesystem indexing for a volume
func (fi *FilesystemIndexer) IndexVolume(ctx context.Context, volumeID, mountpoint string, deltaMode bool) error {
	return fi.IndexVolumeWithScanID(ctx, volumeID, mountpoint, deltaMode, "")
}

// IndexVolumeWithScanID performs complete filesystem indexing for a volume with scan ID for database progress tracking
func (fi *FilesystemIndexer) IndexVolumeWithScanID(ctx context.Context, volumeID, mountpoint string, deltaMode bool, scanID string) error {
	// Try to do a quick count of total files and folders for progress tracking with timeout
	fmt.Printf("Counting total files in volume %s (with timeout)...\n", volumeID)

	var totalFiles, totalFolders int64

	// Use a timeout context for counting - don't wait forever on large volumes
	countCtx, cancel := context.WithTimeout(ctx, 5*time.Minute)
	defer cancel()

	countFiles, countFolders, err := fi.countFilesAndFolders(countCtx, mountpoint)
	if err != nil {
		if errors.Is(err, context.DeadlineExceeded) {
			fmt.Printf("File counting timed out after 5 minutes for volume %s - will use dynamic progress tracking\n", volumeID)
		} else {
			fmt.Printf("Warning: Failed to count files for progress tracking: %v\n", err)
		}
		totalFiles, totalFolders = 0, 0 // Continue without pre-counting, use dynamic progress
	} else {
		totalFiles, totalFolders = countFiles, countFolders
		totalItems := totalFiles + totalFolders
		fmt.Printf("Found %d files and %d folders (total: %d items) in volume %s\n", totalFiles, totalFolders, totalItems, volumeID)
	}

	// Initialize progress tracking
	fi.progressMutex.Lock()
	fi.activeScans[volumeID] = &IndexingProgress{
		VolumeID:     volumeID,
		ScanID:       scanID,
		Status:       "running",
		StartedAt:    time.Now(),
		LastUpdate:   time.Now(),
		TotalFiles:   totalFiles,
		TotalFolders: totalFolders,
	}
	fi.progressMutex.Unlock()

	// Update database progress tracking if scanID provided
	if scanID != "" {
		go fi.updateDatabasePhaseStatus(context.Background(), scanID, "filesystem_indexing", "running", "")
	}

	defer func() {
		// Flush any pending throttled updates before completion
		if scanID != "" && fi.progressThrottler != nil {
			fi.progressThrottler.FlushPending(context.Background(), scanID)
			
			// Log throttling statistics
			updates, throttled := fi.progressThrottler.GetStats(scanID)
			if throttled > 0 {
				reductionRate := float64(throttled) / float64(updates) * 100
				fmt.Printf("[FilesystemIndexer] Scan %s throttling stats - Updates: %d, Throttled: %d (%.1f%% reduction in DB writes)\n",
					scanID, updates, throttled, reductionRate)
			}
			
			// Clean up throttler tracking
			fi.progressThrottler.Cleanup(scanID)
		}
		
		fi.progressMutex.Lock()
		var finalStatus string
		var errorMessage string
		if scan, exists := fi.activeScans[volumeID]; exists {
			if scan.Status == "running" {
				scan.Status = "completed"
				finalStatus = "completed"
			} else {
				finalStatus = scan.Status
				errorMessage = scan.LastError
			}
			scan.LastUpdate = time.Now()
			// Keep completed scans for a short time then remove
			go func() {
				time.Sleep(30 * time.Second)
				fi.progressMutex.Lock()
				delete(fi.activeScans, volumeID)
				fi.progressMutex.Unlock()
			}()
		}
		fi.progressMutex.Unlock()

		// Update database progress tracking
		if scanID != "" {
			go fi.updateDatabasePhaseStatus(context.Background(), scanID, "filesystem_indexing", finalStatus, errorMessage)
		}
	}()

	// Clear existing data if not in delta mode
	if !deltaMode {
		if err := fi.store.Folders().DeleteFoldersByVolume(ctx, volumeID); err != nil {
			return fmt.Errorf("failed to clear existing folders: %w", err)
		}
		if err := fi.store.Files().DeleteFilesByVolume(ctx, volumeID); err != nil {
			return fmt.Errorf("failed to clear existing files: %w", err)
		}
	}

	// Compile skip patterns
	skipRegexes, err := fi.compileSkipPatterns()
	if err != nil {
		return fmt.Errorf("failed to compile skip patterns: %w", err)
	}

	// Start the indexing walk
	walker := &indexingWalker{
		indexer:     fi,
		ctx:         ctx,
		volumeID:    volumeID,
		skipRegexes: skipRegexes,
		folderCache: make(map[string]*models.Folder),
		deltaMode:   deltaMode,
	}

	return walker.walk(mountpoint)
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

// compileSkipPatterns compiles skip patterns into regex
func (fi *FilesystemIndexer) compileSkipPatterns() ([]*regexp.Regexp, error) {
	var regexes []*regexp.Regexp

	for _, pattern := range fi.config.SkipPatterns {
		regex, err := regexp.Compile(pattern)
		if err != nil {
			return nil, fmt.Errorf("invalid skip pattern '%s': %w", pattern, err)
		}
		regexes = append(regexes, regex)
	}

	return regexes, nil
}

// shouldSkip determines if a path should be skipped based on rules
func (fi *FilesystemIndexer) shouldSkip(path string, info os.FileInfo, skipRegexes []*regexp.Regexp) bool {
	name := info.Name()

	// Skip hidden files/directories if configured
	if fi.config.SkipHidden && strings.HasPrefix(name, ".") {
		return true
	}

	// Check skip patterns
	for _, regex := range skipRegexes {
		if regex.MatchString(path) || regex.MatchString(name) {
			return true
		}
	}

	return false
}

// indexingWalker handles the filesystem walking and indexing logic
type indexingWalker struct {
	indexer     *FilesystemIndexer
	ctx         context.Context
	volumeID    string
	skipRegexes []*regexp.Regexp
	folderCache map[string]*models.Folder
	deltaMode   bool

	// Batching
	folderBatch []models.CreateFolderParams
	fileBatch   []models.CreateFileParams
}

// walk performs the filesystem walk and indexing
func (w *indexingWalker) walk(rootPath string) error {
	return filepath.Walk(rootPath, func(path string, info os.FileInfo, err error) error {
		// Check for cancellation
		select {
		case <-w.ctx.Done():
			return w.ctx.Err()
		default:
		}

		// Handle walk errors
		if err != nil {
			w.indexer.recordError(w.volumeID, fmt.Sprintf("walk error for %s: %v", path, err))
			return nil // Continue walking
		}

		// Check skip rules
		if w.indexer.shouldSkip(path, info, w.skipRegexes) {
			if info.IsDir() {
				return filepath.SkipDir
			}
			return nil
		}

		// Check depth limits
		depth := strings.Count(strings.TrimPrefix(path, rootPath), string(os.PathSeparator))
		if depth > w.indexer.config.MaxDepth {
			if info.IsDir() {
				return filepath.SkipDir
			}
			return nil
		}

		// Update progress
		w.indexer.updateProgress(w.volumeID, path, depth)

		// Process based on type
		if info.IsDir() {
			return w.processFolder(path, info, depth)
		} else {
			return w.processFile(path, info, depth)
		}
	})
}

// processFolder handles folder indexing
func (w *indexingWalker) processFolder(path string, info os.FileInfo, depth int) error {
	// Get parent folder ID
	var parentID *int64
	if depth > 0 {
		parentPath := filepath.Dir(path)
		if parent, exists := w.folderCache[parentPath]; exists {
			parentID = &parent.ID
		}
	}

	// Extract metadata
	folderParams := w.extractFolderMetadata(path, info, parentID, int32(depth))

	// Check if folder exists in delta mode
	if w.deltaMode {
		existing, err := w.indexer.store.Folders().GetFolderByPath(w.ctx, w.volumeID, path)
		if err == nil {
			// Folder exists, check if it needs updating
			if w.shouldUpdateFolder(existing, &folderParams) {
				// Update existing folder metadata
				err = w.indexer.store.Folders().UpdateFolderMetadata(w.ctx, existing.ID,
					folderParams.Mtime, folderParams.Ctime, folderParams.Uid, folderParams.Gid, folderParams.Mode)
				if err != nil {
					w.indexer.recordError(w.volumeID, fmt.Sprintf("failed to update folder %s: %v", path, err))
				}
			}
			// Cache the existing folder
			w.folderCache[path] = existing

			// Increment counter for progress tracking even if folder exists
			w.indexer.incrementFolderCount(w.volumeID)
			return nil
		}
	}

	// Create new folder
	folder, err := w.indexer.store.Folders().CreateFolder(w.ctx, folderParams)
	if err != nil {
		w.indexer.recordError(w.volumeID, fmt.Sprintf("failed to create folder %s: %v", path, err))
		return nil
	}

	// Cache the folder for child references
	w.folderCache[path] = folder

	w.indexer.incrementFolderCount(w.volumeID)
	return nil
}

// processFile handles file indexing
func (w *indexingWalker) processFile(path string, info os.FileInfo, depth int) error {
	// Update current path for progress tracking
	w.indexer.updateCurrentPath(w.volumeID, path, depth)

	// Get folder ID
	folderPath := filepath.Dir(path)
	folder, exists := w.folderCache[folderPath]
	if !exists {
		w.indexer.recordError(w.volumeID, fmt.Sprintf("parent folder not found for file %s", path))
		return nil
	}

	// Extract metadata
	fileParams := w.extractFileMetadata(path, info, folder.ID)

	// Check if file exists in delta mode
	if w.deltaMode {
		existing, err := w.indexer.store.Files().GetFileByPath(w.ctx, w.volumeID, path)
		if err == nil {
			// File exists, check if it needs updating
			if w.shouldUpdateFile(existing, &fileParams) {
				// Update existing file metadata
				err = w.indexer.store.Files().UpdateFileMetadata(w.ctx, existing.ID,
					fileParams.SizeBytes, fileParams.DiskUsageBytes,
					fileParams.Mtime, fileParams.Ctime, fileParams.Birthtime,
					fileParams.Uid, fileParams.Gid, fileParams.Mode)
				if err != nil {
					w.indexer.recordError(w.volumeID, fmt.Sprintf("failed to update file %s: %v", path, err))
				}
			}

			// Increment counter for progress tracking even if file exists
			w.indexer.incrementFileCount(w.volumeID)
			w.indexer.addBytesProcessed(w.volumeID, info.Size())
			return nil
		}
	}

	// Create new file
	file, err := w.indexer.store.Files().CreateFile(w.ctx, fileParams)
	if err != nil {
		w.indexer.recordError(w.volumeID, fmt.Sprintf("failed to create file %s: %v", path, err))
		return nil
	}

	// Generate preview asynchronously if preview service is available
	if w.indexer.previewService != nil && file != nil {
		go w.generatePreviewAsync(file, path, info)
	}

	w.indexer.incrementFileCount(w.volumeID)
	w.indexer.addBytesProcessed(w.volumeID, info.Size())
	return nil
}

// extractFolderMetadata extracts metadata from a folder
func (w *indexingWalker) extractFolderMetadata(path string, info os.FileInfo, parentID *int64, depth int32) models.CreateFolderParams {
	pathHash := generatePathHash(path)
	name := info.Name()
	if path == "/" {
		name = "/"
	}

	params := models.CreateFolderParams{
		ParentID: parentID,
		VolumeID: w.volumeID,
		Name:     name,
		Path:     path,
		PathHash: pathHash,
		Depth:    depth,
	}

	// Extract timestamps
	if modTime := info.ModTime(); !modTime.IsZero() {
		params.Mtime = &modTime
	}

	// Extract system-specific metadata
	if sysStat := getSystemStat(info); sysStat != nil {
		params.Ctime = sysStat.Ctime
		params.Uid = sysStat.Uid
		params.Gid = sysStat.Gid
		params.Mode = sysStat.Mode
	}

	// Handle symlinks
	if info.Mode()&os.ModeSymlink != 0 {
		params.IsSymlink = true
		if target, err := os.Readlink(path); err == nil {
			params.SymlinkTarget = &target
		}
	}

	return params
}

// extractFileMetadata extracts metadata from a file
func (w *indexingWalker) extractFileMetadata(path string, info os.FileInfo, folderID int64) models.CreateFileParams {
	pathHash := generatePathHash(path)
	name := info.Name()
	extension := extractFileExtension(name)

	params := models.CreateFileParams{
		FolderID:       folderID,
		VolumeID:       w.volumeID,
		Name:           name,
		Path:           path,
		Extension:      extension,
		SizeBytes:      info.Size(),
		DiskUsageBytes: info.Size(), // TODO: Get actual disk usage
		PathHash:       pathHash,
	}

	// Extract timestamps
	if modTime := info.ModTime(); !modTime.IsZero() {
		params.Mtime = &modTime
	}

	// Extract system-specific metadata
	if sysStat := getSystemStat(info); sysStat != nil {
		params.Ctime = sysStat.Ctime
		params.Birthtime = sysStat.Birthtime
		params.Uid = sysStat.Uid
		params.Gid = sysStat.Gid
		params.Mode = sysStat.Mode
		params.Inode = sysStat.Inode
		params.Device = sysStat.Device
	}

	// Handle symlinks
	if info.Mode()&os.ModeSymlink != 0 {
		params.IsSymlink = true
		if target, err := os.Readlink(path); err == nil {
			params.SymlinkTarget = &target
		}
	}

	// MIME detection
	if w.indexer.config.DetectMimeTypes {
		if mimeType, mediaKind, encoding := w.indexer.mimeDetector.DetectFile(path); mimeType != "" {
			params.Mime = &mimeType
			params.MediaKind = &mediaKind
			params.Encoding = &encoding
		}
	}

	// File hashing
	if w.indexer.config.EnableHashing && info.Size() <= w.indexer.config.MaxFileBytesForHash {
		if hash := w.computeFileHash(path, w.indexer.config.HashAlgorithm); hash != nil {
			params.HashAlgo = &w.indexer.config.HashAlgorithm
			params.Hash = hash
		}
	}

	return params
}

// Helper methods for progress tracking
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

func (fi *FilesystemIndexer) incrementFolderCount(volumeID string) {
	fi.progressMutex.Lock()
	defer fi.progressMutex.Unlock()
	if scan, exists := fi.activeScans[volumeID]; exists && scan != nil {
		scan.FoldersScanned++

		// Use throttled update instead of direct database update
		if scan.ScanID != "" && fi.progressThrottler != nil {
			fi.queueThrottledUpdate(scan.ScanID, scan)
		}
	}
}

func (fi *FilesystemIndexer) incrementFileCount(volumeID string) {
	fi.progressMutex.Lock()
	defer fi.progressMutex.Unlock()
	if scan, exists := fi.activeScans[volumeID]; exists && scan != nil {
		scan.FilesScanned++

		// Use throttled update instead of direct database update
		if scan.ScanID != "" && fi.progressThrottler != nil {
			fi.queueThrottledUpdate(scan.ScanID, scan)
		}

		// Trigger media enrichment every batch of files (every 500 files)
		if fi.enrichmentManager != nil && scan.FilesScanned%500 == 0 {
			// Get the scan ID from the active scan progress if available
			// This assumes we store the scan ID in the progress tracking
			go fi.triggerBatchEnrichment(context.Background(), volumeID, scan)
		}
	}
}

// triggerBatchEnrichment processes a batch of files for media enrichment
func (fi *FilesystemIndexer) triggerBatchEnrichment(ctx context.Context, volumeID string, scan *IndexingProgress) {
	if fi.enrichmentManager == nil {
		fmt.Printf("EnrichmentManager not available for batch enrichment (volumeID: %s)\n", volumeID)
		return
	}

	// Get batch of unprocessed files from the current scan
	batchSize := 500

	fmt.Printf("Triggering batch enrichment (volumeID: %s, scanID: %s, batchSize: %d)\n",
		volumeID, scan.ScanID, batchSize)

	// Use the enrichment manager to process files for this scan
	err := fi.enrichmentManager.EnrichVolumeWithScanID(ctx, volumeID, scan.ScanID)
	if err != nil {
		fmt.Printf("Failed to trigger batch enrichment (volumeID: %s, scanID: %s): %v\n",
			volumeID, scan.ScanID, err)
	} else {
		fmt.Printf("Batch enrichment triggered successfully (volumeID: %s, scanID: %s)\n",
			volumeID, scan.ScanID)
	}
}

// queueThrottledUpdate queues a throttled progress update to prevent database flooding
func (fi *FilesystemIndexer) queueThrottledUpdate(scanID string, scan *IndexingProgress) {
	if fi.progressThrottler == nil {
		return
	}

	itemsProcessed := scan.FilesScanned + scan.FoldersScanned
	itemsTotal := scan.TotalFiles + scan.TotalFolders

	// Calculate progress percentage
	progressPercent := 0
	previousProgress := 0
	
	if itemsTotal > 0 {
		// Calculate previous progress for milestone detection
		previousProcessed := itemsProcessed - 1
		if previousProcessed > 0 {
			previousProgress = int((previousProcessed * 100) / itemsTotal)
		}
		
		progressPercent = int((itemsProcessed * 100) / itemsTotal)
		if progressPercent > 100 {
			progressPercent = 100
		}
	} else if itemsProcessed > 0 {
		// No total counts yet but processing files - show minimal progress
		if itemsProcessed >= 100 {
			progressPercent = int(1 + (itemsProcessed-100)/1000)
			if progressPercent > 10 {
				progressPercent = 10
			}
		}
	}

	// Queue throttled update
	update := models.UpdateScanPhaseParams{
		ScanID:         scanID,
		PhaseName:      "filesystem_indexing",
		Progress:       &progressPercent,
		ItemsProcessed: &itemsProcessed,
		ItemsTotal:     &itemsTotal,
		CurrentItem:    &scan.CurrentPath,
	}

	// Force update at important milestones (every 10% or at specific file counts)
	forceUpdate := false
	if progressPercent > 0 && previousProgress > 0 {
		// Force update at every 10% milestone
		if progressPercent/10 > previousProgress/10 {
			forceUpdate = true
			fmt.Printf("[FilesystemIndexer] Milestone reached: %d%% complete (Files: %d, Folders: %d)\n",
				progressPercent, scan.FilesScanned, scan.FoldersScanned)
		}
	}
	
	// Also force update at specific file count milestones for user feedback
	if scan.FilesScanned == 100 || scan.FilesScanned == 1000 || scan.FilesScanned == 10000 || 
	   scan.FilesScanned == 100000 || (scan.FilesScanned > 0 && scan.FilesScanned%500000 == 0) {
		forceUpdate = true
	}

	// Send the update (forced or throttled)
	var err error
	if forceUpdate {
		err = fi.progressThrottler.ForceUpdate(context.Background(), scanID, update)
	} else {
		err = fi.progressThrottler.QueueUpdate(context.Background(), scanID, update)
	}
	
	if err != nil {
		fmt.Printf("[FilesystemIndexer] Failed to queue progress update: %v\n", err)
	}
}

// updateDatabaseProgress updates the database with current filesystem indexing progress
// DEPRECATED: Use queueThrottledUpdate instead to prevent database flooding
func (fi *FilesystemIndexer) updateDatabaseProgress(ctx context.Context, scanID, phaseName string, scan *IndexingProgress) {
	scanProgressRepo := fi.store.ScanProgress()

	itemsProcessed := scan.FilesScanned + scan.FoldersScanned
	itemsTotal := scan.TotalFiles + scan.TotalFolders

	// Calculate progress percentage based on actual totals
	status := "running"
	progressPercent := 0

	if itemsTotal > 0 {
		// We have total counts - calculate real percentage
		progressPercent = int((itemsProcessed * 100) / itemsTotal)
		if progressPercent > 100 {
			progressPercent = 100
		}
	} else if itemsProcessed > 0 {
		// No total counts yet but processing files - show minimal progress to indicate activity
		// Use a logarithmic scale that grows slowly: 1% at 100 items, 2% at 1000, etc.
		if itemsProcessed >= 100 {
			progressPercent = int(1 + (itemsProcessed-100)/1000)
			if progressPercent > 10 { // Cap at 10% when we don't know the total
				progressPercent = 10
			}
		}
	}

	updateParams := models.UpdateScanPhaseParams{
		ScanID:         scanID,
		PhaseName:      phaseName,
		Status:         &status,
		Progress:       &progressPercent,
		ItemsProcessed: &itemsProcessed,
		ItemsTotal:     &itemsTotal,
		CurrentItem:    &scan.CurrentPath,
	}

	err := scanProgressRepo.UpdateScanPhaseProgress(ctx, updateParams)
	if err != nil {
		fmt.Printf("Failed to update %s phase progress for scan %s: %v\n", phaseName, scanID, err)
	}
}

// updateCurrentPath updates the current path being processed for progress tracking
func (fi *FilesystemIndexer) updateCurrentPath(volumeID, path string, depth int) {
	fi.progressMutex.Lock()
	defer fi.progressMutex.Unlock()

	if scan, exists := fi.activeScans[volumeID]; exists {
		scan.CurrentPath = path
		scan.CurrentDepth = depth
		scan.LastUpdate = time.Now()
	}
}

// countFilesAndFolders does a quick count of total files and folders for progress tracking
func (fi *FilesystemIndexer) countFilesAndFolders(ctx context.Context, mountpoint string) (int64, int64, error) {
	var totalFiles, totalFolders int64

	// Compile skip patterns for consistency with actual indexing
	skipRegexes, err := fi.compileSkipPatterns()
	if err != nil {
		return 0, 0, fmt.Errorf("failed to compile skip patterns: %w", err)
	}

	err = filepath.Walk(mountpoint, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			// Skip inaccessible files/folders rather than failing the whole count
			return nil
		}

		// Check context cancellation
		select {
		case <-ctx.Done():
			return ctx.Err()
		default:
		}

		// Skip files based on patterns (same logic as actual indexing)
		relativePath := strings.TrimPrefix(path, mountpoint)
		relativePath = strings.TrimPrefix(relativePath, "/")

		for _, regex := range skipRegexes {
			if regex.MatchString(relativePath) || regex.MatchString(info.Name()) {
				if info.IsDir() {
					return filepath.SkipDir
				}
				return nil
			}
		}

		if info.IsDir() {
			totalFolders++
		} else {
			totalFiles++
		}

		return nil
	})

	return totalFiles, totalFolders, err
}

// SetEnrichmentManager updates the enrichment manager for the filesystem indexer
func (fi *FilesystemIndexer) SetEnrichmentManager(manager interfaces.EnrichmentManager) {
	fi.enrichmentManager = manager
}

func (fi *FilesystemIndexer) addBytesProcessed(volumeID string, bytes int64) {
	fi.progressMutex.Lock()
	defer fi.progressMutex.Unlock()
	if scan, exists := fi.activeScans[volumeID]; exists && scan != nil {
		scan.BytesProcessed += bytes
	}
}

func (fi *FilesystemIndexer) recordError(volumeID, msg string) {
	fi.progressMutex.Lock()
	defer fi.progressMutex.Unlock()
	if scan, exists := fi.activeScans[volumeID]; exists && scan != nil {
		scan.ErrorsCount++
		scan.LastError = msg
	}
}

// Utility functions
func generatePathHash(path string) []byte {
	hash := sha256.Sum256([]byte(path))
	return hash[:]
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

func (w *indexingWalker) shouldUpdateFolder(existing *models.Folder, new *models.CreateFolderParams) bool {
	// Check if mtime is newer
	if new.Mtime != nil && existing.Mtime != nil {
		return new.Mtime.After(*existing.Mtime)
	}
	return false
}

func (w *indexingWalker) shouldUpdateFile(existing *models.File, new *models.CreateFileParams) bool {
	// Check if mtime is newer or size changed
	if new.Mtime != nil && existing.Mtime != nil {
		if new.Mtime.After(*existing.Mtime) {
			return true
		}
	}
	return existing.SizeBytes != new.SizeBytes
}

func (w *indexingWalker) computeFileHash(path, algorithm string) []byte {
	file, err := os.Open(path)
	if err != nil {
		return nil
	}
	defer file.Close()

	switch algorithm {
	case "md5":
		hasher := md5.New()
		if _, err := io.Copy(hasher, file); err != nil {
			return nil
		}
		return hasher.Sum(nil)
	case "sha256":
		hasher := sha256.New()
		if _, err := io.Copy(hasher, file); err != nil {
			return nil
		}
		return hasher.Sum(nil)
	default:
		return nil
	}
}

// MimeDetector handles MIME type detection and media classification
type MimeDetector struct {
	// Cache for file extensions to improve performance
	extensionCache map[string]string
	mutex          sync.RWMutex
}

// NewMimeDetector creates a new MIME detector
func NewMimeDetector() *MimeDetector {
	return &MimeDetector{
		extensionCache: make(map[string]string),
	}
}

// DetectFile detects MIME type, media kind, and encoding for a file
func (md *MimeDetector) DetectFile(path string) (mimeType, mediaKind, encoding string) {
	// First try detection by file extension (fast path)
	ext := strings.ToLower(filepath.Ext(path))
	if ext != "" {
		md.mutex.RLock()
		cachedMime, exists := md.extensionCache[ext]
		md.mutex.RUnlock()

		if exists {
			return cachedMime, md.classifyMediaKind(cachedMime), ""
		}

		// Get MIME type by extension
		if extMime := mime.TypeByExtension(ext); extMime != "" {
			md.mutex.Lock()
			md.extensionCache[ext] = extMime
			md.mutex.Unlock()
			return extMime, md.classifyMediaKind(extMime), ""
		}
	}

	// Fallback to content detection (slower but more accurate)
	file, err := os.Open(path)
	if err != nil {
		return "application/octet-stream", "binary", ""
	}
	defer file.Close()

	// Read first 512 bytes for content detection
	buffer := make([]byte, 512)
	n, err := file.Read(buffer)
	if err != nil && err != io.EOF {
		return "application/octet-stream", "binary", ""
	}

	// Detect MIME type from content
	detectedMime := http.DetectContentType(buffer[:n])
	if detectedMime == "" {
		detectedMime = "application/octet-stream"
	}

	// Cache result if we have an extension
	if ext != "" {
		md.mutex.Lock()
		md.extensionCache[ext] = detectedMime
		md.mutex.Unlock()
	}

	return detectedMime, md.classifyMediaKind(detectedMime), md.detectEncoding(buffer[:n])
}

// classifyMediaKind classifies MIME types into broader media categories
func (md *MimeDetector) classifyMediaKind(mimeType string) string {
	if mimeType == "" {
		return "unknown"
	}

	// Split MIME type into main type and subtype
	parts := strings.Split(mimeType, "/")
	if len(parts) != 2 {
		return "unknown"
	}

	mainType := parts[0]
	subType := parts[1]

	switch mainType {
	case "image":
		return "image"
	case "video":
		return "video"
	case "audio":
		return "audio"
	case "text":
		return "text"
	case "application":
		// Further classify application types
		switch {
		case strings.Contains(subType, "pdf"):
			return "document"
		case strings.Contains(subType, "zip"), strings.Contains(subType, "tar"), strings.Contains(subType, "gzip"):
			return "archive"
		case strings.Contains(subType, "json"), strings.Contains(subType, "xml"):
			return "data"
		case strings.Contains(subType, "javascript"), strings.Contains(subType, "sql"):
			return "code"
		case strings.Contains(subType, "msword"), strings.Contains(subType, "officedocument"):
			return "document"
		default:
			return "binary"
		}
	default:
		return "unknown"
	}
}

// detectEncoding detects text encoding from file content
func (md *MimeDetector) detectEncoding(content []byte) string {
	// Simple encoding detection - can be enhanced with more sophisticated algorithms
	if len(content) == 0 {
		return ""
	}

	// Check for UTF-8 BOM
	if len(content) >= 3 && content[0] == 0xEF && content[1] == 0xBB && content[2] == 0xBF {
		return "utf-8-bom"
	}

	// Check for UTF-16 BOM
	if len(content) >= 2 {
		if content[0] == 0xFF && content[1] == 0xFE {
			return "utf-16le"
		}
		if content[0] == 0xFE && content[1] == 0xFF {
			return "utf-16be"
		}
	}

	// Check if content is valid UTF-8
	if isValidUTF8(content) {
		return "utf-8"
	}

	// Check for ASCII
	if isASCII(content) {
		return "ascii"
	}

	return "binary"
}

// isValidUTF8 checks if content is valid UTF-8
func isValidUTF8(content []byte) bool {
	for i := 0; i < len(content); {
		r, size := decodeRuneInBytes(content[i:])
		if r == 0xFFFD && size == 1 {
			return false // Invalid UTF-8
		}
		i += size
	}
	return true
}

// isASCII checks if content contains only ASCII characters
func isASCII(content []byte) bool {
	for _, b := range content {
		if b > 127 {
			return false
		}
	}
	return true
}

// decodeRuneInBytes is a simplified version of utf8.DecodeRune
func decodeRuneInBytes(b []byte) (rune, int) {
	if len(b) == 0 {
		return 0xFFFD, 0
	}
	b0 := b[0]
	if b0 < 0x80 {
		return rune(b0), 1
	}
	if len(b) < 2 {
		return 0xFFFD, 1
	}
	// Simplified - full implementation would handle all UTF-8 cases
	return 0xFFFD, 1
}

// SystemStat holds system-specific file metadata
type SystemStat struct {
	Ctime     *time.Time
	Birthtime *time.Time
	Uid       *int32
	Gid       *int32
	Mode      *int32
	Inode     *int64
	Device    *string
}

// getSystemStat extracts system-specific metadata from os.FileInfo
func getSystemStat(info os.FileInfo) *SystemStat {
	// Get underlying syscall.Stat_t
	sys := info.Sys()
	if sys == nil {
		return nil
	}

	stat, ok := sys.(*syscall.Stat_t)
	if !ok {
		return nil
	}

	sysStat := &SystemStat{}

	// Extract timestamps
	if stat.Ctim.Sec != 0 {
		ctime := time.Unix(stat.Ctim.Sec, stat.Ctim.Nsec)
		sysStat.Ctime = &ctime
	}

	// Birthtime is not available on Linux, but we can try
	// On Linux, we'll use ctime as a fallback for birthtime
	if stat.Ctim.Sec != 0 {
		birthtime := time.Unix(stat.Ctim.Sec, stat.Ctim.Nsec)
		sysStat.Birthtime = &birthtime
	}

	// Extract ownership and permissions
	uid := int32(stat.Uid)
	sysStat.Uid = &uid

	gid := int32(stat.Gid)
	sysStat.Gid = &gid

	mode := int32(stat.Mode)
	sysStat.Mode = &mode

	// Extract inode and device
	inode := int64(stat.Ino)
	sysStat.Inode = &inode

	device := fmt.Sprintf("%d", stat.Dev)
	sysStat.Device = &device

	return sysStat
}

// extractFileExtension extracts extension from filename
func extractFileExtension(filename string) *string {
	ext := strings.ToLower(filepath.Ext(filename))
	if ext == "" {
		return nil
	}

	// Remove the leading dot
	if len(ext) > 1 {
		ext = ext[1:]
	}

	return &ext
}

// generatePreviewAsync generates a preview for a file asynchronously
func (w *indexingWalker) generatePreviewAsync(file *models.File, path string, info os.FileInfo) {
	// Create context with timeout for preview generation
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	// Detect MIME type if not already detected
	mimeType := ""
	if file.Mime != nil {
		mimeType = *file.Mime
	} else {
		// Try to detect MIME type
		detected, _, _ := w.indexer.mimeDetector.DetectFile(path)
		if detected != "" {
			mimeType = detected
		}
	}

	// Skip if no MIME type or unsupported file type
	if mimeType == "" || !w.indexer.previewService.CanGeneratePreview(mimeType) {
		return
	}

	// Use file ID and modification time as cache key for performance
	// This avoids reading the entire file for hash calculation
	fileHash := fmt.Sprintf("file_%d_mtime_%d", file.ID, info.ModTime().Unix())

	// Determine preview type based on MIME type
	var previewType previews.PreviewType
	switch {
	case strings.HasPrefix(mimeType, "image/"):
		previewType = previews.PreviewTypeThumbnail
	case strings.HasPrefix(mimeType, "video/"):
		previewType = previews.PreviewTypePoster
	case strings.HasPrefix(mimeType, "audio/"):
		previewType = previews.PreviewTypeCover
	default:
		return // Unsupported type
	}

	// Create preview request
	req := &previews.PreviewRequest{
		FileID:     file.ID,
		FilePath:   path,
		FileHash:   fileHash,
		Type:       previewType,
		Size:       previews.PreviewSizeMedium, // Default to medium size during indexing
		TimeOffset: 5.0,                        // Default time offset for videos
	}

	// Generate preview (this will handle deduplication automatically)
	_, err := w.indexer.previewService.GeneratePreview(ctx, req, mimeType)
	if err != nil {
		// Log error but don't block indexing
		w.indexer.recordError(w.volumeID, fmt.Sprintf("failed to generate preview for %s: %v", path, err))
	}
}

// calculateFileHash calculates SHA256 hash of a file for preview deduplication
func (w *indexingWalker) calculateFileHash(filePath string) (string, error) {
	file, err := os.Open(filePath)
	if err != nil {
		return "", err
	}
	defer file.Close()

	hasher := sha256.New()
	if _, err := io.Copy(hasher, file); err != nil {
		return "", err
	}

	return fmt.Sprintf("%x", hasher.Sum(nil)), nil
}

// updateDatabasePhaseStatus updates the filesystem indexing phase status in the database
func (fi *FilesystemIndexer) updateDatabasePhaseStatus(ctx context.Context, scanID, phaseName, status, errorMessage string) {
	scanProgressRepo := fi.store.ScanProgress()

	if status == "completed" {
		// Get current progress for file count data
		fi.progressMutex.RLock()
		var itemsProcessed, itemsTotal, itemsSuccessful int64

		// Find progress data by scanning through activeScans
		// Since we don't have volumeID directly, we'll check all active scans
		for _, progress := range fi.activeScans {
			if progress.Status == "completed" || progress.Status == "running" {
				itemsProcessed = progress.FilesScanned + progress.FoldersScanned
				itemsTotal = itemsProcessed // We don't know total upfront for filesystem indexing
				itemsSuccessful = itemsProcessed - progress.ErrorsCount
				break
			}
		}
		fi.progressMutex.RUnlock()

		// Use UpdateScanPhaseProgress instead of CompleteScanPhase to include file counts
		progressPercent := 100
		completedStatus := "completed"

		updateParams := models.UpdateScanPhaseParams{
			ScanID:          scanID,
			PhaseName:       phaseName,
			Status:          &completedStatus,
			Progress:        &progressPercent,
			ItemsProcessed:  &itemsProcessed,
			ItemsTotal:      &itemsTotal,
			ItemsSuccessful: &itemsSuccessful,
		}

		err := scanProgressRepo.UpdateScanPhaseProgress(ctx, updateParams)
		if err != nil {
			// Log error but don't fail the indexing
			fmt.Printf("Failed to complete %s phase for scan %s: %v\n", phaseName, scanID, err)
		} else {
			fmt.Printf("Completed %s phase for scan %s (processed %d items)\n", phaseName, scanID, itemsProcessed)
		}
	} else if status == "failed" {
		err := scanProgressRepo.FailScanPhase(ctx, scanID, phaseName, errorMessage)
		if err != nil {
			fmt.Printf("Failed to mark %s phase as failed for scan %s: %v\n", phaseName, scanID, err)
		}
	} else if status == "running" {
		// Get current progress for total counts to set in database
		fi.progressMutex.RLock()
		var itemsTotal int64

		// Find progress data by scanning through activeScans
		for _, progress := range fi.activeScans {
			if progress.ScanID == scanID {
				itemsTotal = progress.TotalFiles + progress.TotalFolders
				break
			}
		}
		fi.progressMutex.RUnlock()

		// Update phase progress to running with total counts
		updateParams := models.UpdateScanPhaseParams{
			ScanID:    scanID,
			PhaseName: phaseName,
			Status:    &status,
		}

		// Only set items_total if we have a count (avoid setting 0 when we have a valid count)
		if itemsTotal > 0 {
			updateParams.ItemsTotal = &itemsTotal
		}

		err := scanProgressRepo.UpdateScanPhaseProgress(ctx, updateParams)
		if err != nil {
			fmt.Printf("Failed to update %s phase status for scan %s: %v\n", phaseName, scanID, err)
		} else if itemsTotal > 0 {
			fmt.Printf("Started %s phase for scan %s with %d total items\n", phaseName, scanID, itemsTotal)
		}
	}
}
