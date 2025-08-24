package filesystem

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"time"

	"github.com/mantonx/volumeviz/internal/models"
)

// ResumeWalker handles filesystem walking with checkpoint resumption capability
type ResumeWalker struct {
	indexer     *FilesystemIndexer
	volumeID    string
	skipRegexes []*regexp.Regexp
	folderCache map[string]*models.Folder
	previewGen  *PreviewGenerator
}

// NewResumeWalker creates a new resuming filesystem walker
func NewResumeWalker(indexer *FilesystemIndexer, volumeID string) *ResumeWalker {
	return &ResumeWalker{
		indexer:     indexer,
		volumeID:    volumeID,
		folderCache: make(map[string]*models.Folder),
		previewGen:  NewPreviewGenerator(indexer.previewService, indexer.mimeDetector),
	}
}

// ResumeFromCheckpoint resumes indexing from a specific checkpoint
func (rw *ResumeWalker) ResumeFromCheckpoint(ctx context.Context, mountpoint, scanID string) error {
	fmt.Printf("Attempting to resume paused scan %s for volume %s\n", scanID, rw.volumeID)
	
	// Get the paused scan phase to understand where we left off
	phase, err := rw.indexer.store.ScanProgress().GetScanPhase(ctx, scanID, "filesystem_indexing")
	if err != nil {
		return fmt.Errorf("failed to get paused scan phase: %w", err)
	}
	
	if phase.Status != "paused" {
		return fmt.Errorf("scan %s is not paused (status: %s)", scanID, phase.Status)
	}
	
	checkpointPath := phase.CurrentItem
	fmt.Printf("Resuming scan from: %s (processed %d/%d items)\n", 
		checkpointPath, phase.ItemsProcessed, phase.ItemsTotal)

	// Initialize progress tracking with resumed state
	rw.initializeResumedProgress(scanID, phase)

	// Update database to mark phase as running again
	go rw.indexer.progressTracker.UpdatePhaseStatus(context.Background(), scanID, "filesystem_indexing", "running", "")

	// Setup cleanup
	defer rw.cleanup(scanID)

	// Compile skip patterns
	rw.skipRegexes, err = rw.compileSkipPatterns()
	if err != nil {
		return fmt.Errorf("failed to compile skip patterns: %w", err)
	}

	// Load existing folder cache
	if err := rw.loadFolderCache(ctx); err != nil {
		fmt.Printf("Warning: Failed to load folder cache: %v\n", err)
	}

	// Resume from checkpoint
	return rw.walkFromCheckpoint(ctx, mountpoint, checkpointPath)
}

// initializeResumedProgress sets up progress tracking for resumed scan
func (rw *ResumeWalker) initializeResumedProgress(scanID string, phase *models.ScanPhase) {
	rw.indexer.progressMutex.Lock()
	
	// Restore progress state
	rw.indexer.activeScans[rw.volumeID] = &IndexingProgress{
		VolumeID:        rw.volumeID,
		ScanID:          scanID,
		Status:          "running",
		StartedAt:       time.Now(), // Reset start time for this resume session
		LastUpdate:      time.Now(),
		TotalFiles:      phase.ItemsTotal,
		TotalFolders:    0, // Will be recalculated if needed
		FoldersScanned:  phase.ItemsProcessed, // Approximate - will be corrected as we progress
		FilesScanned:    0,                    // Will be recalculated
		CurrentPath:     phase.CurrentItem,
	}
	rw.indexer.progressMutex.Unlock()
}

// cleanup handles resumed scan completion cleanup
func (rw *ResumeWalker) cleanup(scanID string) {
	// Same cleanup logic as regular walker
	if scanID != "" && rw.indexer.progressTracker != nil {
		rw.indexer.progressTracker.FlushPending(context.Background(), scanID)
		
		// Log throttling statistics
		updates, throttled := rw.indexer.progressTracker.GetStats(scanID)
		if throttled > 0 {
			reductionRate := float64(throttled) / float64(updates) * 100
			fmt.Printf("[ResumeWalker] Scan %s throttling stats - Updates: %d, Throttled: %d (%.1f%% reduction in DB writes)\n",
				scanID, updates, throttled, reductionRate)
		}
		
		// Clean up throttler tracking
		rw.indexer.progressTracker.Cleanup(scanID)
	}
	
	rw.indexer.progressMutex.Lock()
	var finalStatus string
	var errorMessage string
	if scan, exists := rw.indexer.activeScans[rw.volumeID]; exists {
		if scan.Status == "running" {
			scan.Status = "completed"
			finalStatus = "completed"
		} else {
			finalStatus = scan.Status
			errorMessage = scan.LastError
		}
		scan.LastUpdate = time.Now()
	}
	rw.indexer.progressMutex.Unlock()

	// Update database progress tracking (synchronously to ensure completion)
	if scanID != "" {
		rw.indexer.progressTracker.UpdatePhaseStatus(context.Background(), scanID, "filesystem_indexing", finalStatus, errorMessage)
	}
}

// loadFolderCache loads existing folders into cache for resumed scans
func (rw *ResumeWalker) loadFolderCache(ctx context.Context) error {
	// Load existing folders from database to populate cache
	folders, err := rw.indexer.store.Folders().ListFoldersByVolume(ctx, rw.volumeID, 10000, 0)
	if err != nil {
		return fmt.Errorf("failed to load existing folders: %w", err)
	}
	
	fmt.Printf("Loaded %d existing folders into cache for resume\n", len(folders))
	
	for _, folder := range folders {
		rw.folderCache[folder.Path] = folder
	}
	
	return nil
}

// walkFromCheckpoint performs filesystem walk starting from a checkpoint
func (rw *ResumeWalker) walkFromCheckpoint(ctx context.Context, rootPath, checkpointPath string) error {
	fmt.Printf("Resuming filesystem walk from checkpoint: %s\n", checkpointPath)
	
	skippedToCheckpoint := false
	if checkpointPath == "" || checkpointPath == rootPath {
		skippedToCheckpoint = true // Start from beginning if no specific checkpoint
	}
	
	return filepath.Walk(rootPath, func(path string, info os.FileInfo, err error) error {
		// Check for cancellation
		select {
		case <-ctx.Done():
			return ctx.Err()
		default:
		}

		// Handle walk errors
		if err != nil {
			rw.indexer.recordError(rw.volumeID, fmt.Sprintf("walk error for %s: %v", path, err))
			return nil // Continue walking
		}

		// Skip until we reach the checkpoint path
		if !skippedToCheckpoint {
			if strings.HasPrefix(checkpointPath, path) || strings.HasPrefix(path, checkpointPath) {
				skippedToCheckpoint = true
				fmt.Printf("Reached checkpoint, resuming from: %s\n", path)
			} else {
				// Skip this path - we've already processed it
				if info.IsDir() {
					return filepath.SkipDir
				}
				return nil
			}
		}

		// Check skip rules
		if rw.shouldSkip(path, info) {
			if info.IsDir() {
				return filepath.SkipDir
			}
			return nil
		}

		// Check depth limits
		depth := strings.Count(strings.TrimPrefix(path, rootPath), string(os.PathSeparator))
		if depth > rw.indexer.config.MaxDepth {
			if info.IsDir() {
				return filepath.SkipDir
			}
			return nil
		}

		// Update progress
		rw.indexer.updateProgress(rw.volumeID, path, depth)

		// Process based on type
		if info.IsDir() {
			return rw.processFolder(ctx, path, info, depth)
		} else {
			return rw.processFile(ctx, path, info, depth)
		}
	})
}

// processFolder handles folder processing for resumed scans
func (rw *ResumeWalker) processFolder(ctx context.Context, path string, info os.FileInfo, depth int) error {
	// Check if folder already exists in cache (from previous processing)
	if _, exists := rw.folderCache[path]; exists {
		// Folder already processed, just increment counter
		rw.indexer.incrementFolderCount(rw.volumeID)
		return nil
	}

	// Get parent folder ID
	var parentID *int64
	if depth > 0 {
		parentPath := filepath.Dir(path)
		if parent, exists := rw.folderCache[parentPath]; exists {
			parentID = &parent.ID
		}
	}

	// Extract metadata
	folderParams := rw.indexer.metadataExtractor.ExtractFolderMetadata(rw.volumeID, path, info, parentID, int32(depth))

	// Create new folder (we know it doesn't exist since it's not in cache)
	folder, err := rw.indexer.store.Folders().CreateFolder(ctx, folderParams)
	if err != nil {
		rw.indexer.recordError(rw.volumeID, fmt.Sprintf("failed to create folder %s: %v", path, err))
		return nil
	}

	// Cache the folder for child references
	rw.folderCache[path] = folder

	rw.indexer.incrementFolderCount(rw.volumeID)
	return nil
}

// processFile handles file processing for resumed scans
func (rw *ResumeWalker) processFile(ctx context.Context, path string, info os.FileInfo, depth int) error {
	// Get folder ID
	folderPath := filepath.Dir(path)
	folder, exists := rw.folderCache[folderPath]
	if !exists {
		rw.indexer.recordError(rw.volumeID, fmt.Sprintf("parent folder not found for file %s", path))
		return nil
	}

	// Check if file already exists (in delta mode for resumed scans)
	existing, err := rw.indexer.store.Files().GetFileByPath(ctx, rw.volumeID, path)
	if err == nil {
		// File exists, check if it needs updating
		fileParams := rw.indexer.metadataExtractor.ExtractFileMetadata(rw.volumeID, path, info, folder.ID)
		if rw.indexer.metadataExtractor.ShouldUpdateFile(existing, &fileParams) {
			// Update existing file metadata
			err = rw.indexer.store.Files().UpdateFileMetadata(ctx, existing.ID,
				fileParams.SizeBytes, fileParams.DiskUsageBytes,
				fileParams.Mtime, fileParams.Ctime, fileParams.Birthtime,
				fileParams.Uid, fileParams.Gid, fileParams.Mode)
			if err != nil {
				rw.indexer.recordError(rw.volumeID, fmt.Sprintf("failed to update file %s: %v", path, err))
			}
		}

		// Increment counter for progress tracking even if file exists
		rw.indexer.incrementFileCount(rw.volumeID)
		rw.indexer.addBytesProcessed(rw.volumeID, info.Size())
		return nil
	}

	// Extract metadata for new file
	fileParams := rw.indexer.metadataExtractor.ExtractFileMetadata(rw.volumeID, path, info, folder.ID)

	// Create new file
	file, err := rw.indexer.store.Files().CreateFile(ctx, fileParams)
	if err != nil {
		rw.indexer.recordError(rw.volumeID, fmt.Sprintf("failed to create file %s: %v", path, err))
		return nil
	}

	// Generate preview asynchronously if preview service is available
	if file != nil {
		rw.previewGen.GenerateAsync(rw.volumeID, file, path, info, rw.indexer.recordError)
	}

	rw.indexer.incrementFileCount(rw.volumeID)
	rw.indexer.addBytesProcessed(rw.volumeID, info.Size())
	return nil
}

// shouldSkip determines if a path should be skipped based on rules
func (rw *ResumeWalker) shouldSkip(path string, info os.FileInfo) bool {
	name := info.Name()

	// Skip hidden files/directories if configured
	if rw.indexer.config.SkipHidden && strings.HasPrefix(name, ".") {
		return true
	}

	// Check skip patterns
	for _, regex := range rw.skipRegexes {
		if regex.MatchString(path) || regex.MatchString(name) {
			return true
		}
	}

	return false
}

// compileSkipPatterns compiles skip patterns into regex
func (rw *ResumeWalker) compileSkipPatterns() ([]*regexp.Regexp, error) {
	var regexes []*regexp.Regexp

	for _, pattern := range rw.indexer.config.SkipPatterns {
		regex, err := regexp.Compile(pattern)
		if err != nil {
			return nil, fmt.Errorf("invalid skip pattern '%s': %w", pattern, err)
		}
		regexes = append(regexes, regex)
	}

	return regexes, nil
}