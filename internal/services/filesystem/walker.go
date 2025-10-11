package filesystem

import (
	"context"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/mantonx/volumeviz/internal/models"
)

// Walker handles regular filesystem walking and indexing
type Walker struct {
	indexer         *FilesystemIndexer
	volumeID        string
	deltaMode       bool
	skipMatcher     *SkipPatternMatcher
	folderCache     map[string]*models.Folder
	previewGen      *PreviewGenerator
}

// NewWalker creates a new filesystem walker
func NewWalker(indexer *FilesystemIndexer, volumeID string, deltaMode bool) *Walker {
	return &Walker{
		indexer:     indexer,
		volumeID:    volumeID,
		deltaMode:   deltaMode,
		folderCache: make(map[string]*models.Folder),
		previewGen:  NewPreviewGenerator(indexer.previewService, indexer.mimeDetector),
	}
}

// Walk performs the complete filesystem walk and indexing
func (w *Walker) Walk(ctx context.Context, mountpoint string, scanID string) error {
	// Pre-count files for progress tracking
	fmt.Printf("Counting total files in volume %s (with timeout)...\n", w.volumeID)
	totalFiles, totalFolders, err := w.countFilesAndFolders(ctx, mountpoint)
	if err != nil {
		if errors.Is(err, context.DeadlineExceeded) {
			fmt.Printf("File counting timed out after 5 minutes for volume %s - will use dynamic progress tracking\n", w.volumeID)
		} else {
			fmt.Printf("Warning: Failed to count files for progress tracking: %v\n", err)
		}
		totalFiles, totalFolders = 0, 0 // Continue without pre-counting
	} else {
		fmt.Printf("Found %d files and %d folders in volume %s\n", totalFiles, totalFolders, w.volumeID)
	}

	// Initialize progress tracking
	w.initializeProgress(scanID, totalFiles, totalFolders)

	// Update database progress tracking if scanID provided
	if scanID != "" {
		go w.indexer.progressTracker.UpdatePhaseStatus(context.Background(), scanID, "filesystem_indexing", "running", "")
	}

	// Setup cleanup
	defer w.cleanup(scanID)

	// Clear existing data if not in delta mode
	if !w.deltaMode {
		if err := w.indexer.store.Folders().DeleteFoldersByVolume(ctx, w.volumeID); err != nil {
			return fmt.Errorf("failed to clear existing folders: %w", err)
		}
		if err := w.indexer.store.Files().DeleteFilesByVolume(ctx, w.volumeID); err != nil {
			return fmt.Errorf("failed to clear existing files: %w", err)
		}
	}

	// Create skip pattern matcher
	w.skipMatcher, err = NewSkipPatternMatcher(w.indexer.config.SkipPatterns, w.indexer.config.SkipHidden)
	if err != nil {
		return fmt.Errorf("failed to create skip pattern matcher: %w", err)
	}

	// Start the indexing walk
	return w.walkPath(ctx, mountpoint)
}

// initializeProgress sets up progress tracking for the scan
func (w *Walker) initializeProgress(scanID string, totalFiles, totalFolders int64) {
	w.indexer.progressMutex.Lock()
	w.indexer.activeScans[w.volumeID] = &IndexingProgress{
		VolumeID:     w.volumeID,
		ScanID:       scanID,
		Status:       "running",
		StartedAt:    time.Now(),
		LastUpdate:   time.Now(),
		TotalFiles:   totalFiles,
		TotalFolders: totalFolders,
	}
	w.indexer.progressMutex.Unlock()
}

// cleanup handles scan completion cleanup
func (w *Walker) cleanup(scanID string) {
	// Flush any pending throttled updates before completion
	if scanID != "" && w.indexer.progressTracker != nil {
		w.indexer.progressTracker.FlushPending(context.Background(), scanID)
		
		// Log throttling statistics
		updates, throttled := w.indexer.progressTracker.GetStats(scanID)
		if throttled > 0 {
			reductionRate := float64(throttled) / float64(updates) * 100
			fmt.Printf("[Walker] Scan %s throttling stats - Updates: %d, Throttled: %d (%.1f%% reduction in DB writes)\n",
				scanID, updates, throttled, reductionRate)
		}
		
		// Clean up throttler tracking
		w.indexer.progressTracker.Cleanup(scanID)
	}
	
	w.indexer.progressMutex.Lock()
	var finalStatus string
	var errorMessage string
	if scan, exists := w.indexer.activeScans[w.volumeID]; exists {
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
			w.indexer.progressMutex.Lock()
			delete(w.indexer.activeScans, w.volumeID)
			w.indexer.progressMutex.Unlock()
		}()
	}
	w.indexer.progressMutex.Unlock()

	// Update database progress tracking (synchronously to ensure completion)
	if scanID != "" {
		w.indexer.progressTracker.UpdatePhaseStatus(context.Background(), scanID, "filesystem_indexing", finalStatus, errorMessage)
	}
}

// walkPath performs the actual filesystem walk
func (w *Walker) walkPath(ctx context.Context, rootPath string) error {
	return filepath.Walk(rootPath, func(path string, info os.FileInfo, err error) error {
		// Check for cancellation
		select {
		case <-ctx.Done():
			return ctx.Err()
		default:
		}

		// Handle walk errors
		if err != nil {
			w.indexer.recordError(w.volumeID, fmt.Sprintf("walk error for %s: %v", path, err))
			return nil // Continue walking
		}

		// Check skip rules
		if w.skipMatcher != nil && w.skipMatcher.ShouldSkip(path, info) {
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
			return w.processFolder(ctx, path, info, depth)
		} else {
			return w.processFile(ctx, path, info, depth)
		}
	})
}

// processFolder handles folder indexing
func (w *Walker) processFolder(ctx context.Context, path string, info os.FileInfo, depth int) error {
	// Get parent folder ID
	var parentID *int64
	if depth > 0 {
		parentPath := filepath.Dir(path)
		if parent, exists := w.folderCache[parentPath]; exists {
			parentID = &parent.ID
		} else {
			// Parent not in cache - look it up in database to prevent orphaned folders
			parent, err := w.indexer.store.Folders().GetFolderByPath(ctx, w.volumeID, parentPath)
			if err == nil {
				parentID = &parent.ID
				// Add to cache for future lookups
				w.folderCache[parentPath] = parent
			}
		}
	}

	// Extract metadata
	folderParams := w.indexer.metadataExtractor.ExtractFolderMetadata(w.volumeID, path, info, parentID, int32(depth))

	// Check if folder exists in delta mode
	if w.deltaMode {
		existing, err := w.indexer.store.Folders().GetFolderByPath(ctx, w.volumeID, path)
		if err == nil {
			// Folder exists, check if it needs updating
			if w.indexer.metadataExtractor.ShouldUpdateFolder(existing, &folderParams) {
				// Update existing folder metadata
				err = w.indexer.store.Folders().UpdateFolderMetadata(ctx, existing.ID,
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
	folder, err := w.indexer.store.Folders().CreateFolder(ctx, folderParams)
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
func (w *Walker) processFile(ctx context.Context, path string, info os.FileInfo, depth int) error {
	// Get folder ID
	folderPath := filepath.Dir(path)
	folder, exists := w.folderCache[folderPath]
	if !exists {
		w.indexer.recordError(w.volumeID, fmt.Sprintf("parent folder not found for file %s", path))
		return nil
	}

	// Extract metadata
	fileParams := w.indexer.metadataExtractor.ExtractFileMetadata(w.volumeID, path, info, folder.ID)

	// Check if file exists in delta mode
	if w.deltaMode {
		existing, err := w.indexer.store.Files().GetFileByPath(ctx, w.volumeID, path)
		if err == nil {
			// File exists, check if it needs updating
			if w.indexer.metadataExtractor.ShouldUpdateFile(existing, &fileParams) {
				// Update existing file metadata
				err = w.indexer.store.Files().UpdateFileMetadata(ctx, existing.ID,
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
	file, err := w.indexer.store.Files().CreateFile(ctx, fileParams)
	if err != nil {
		w.indexer.recordError(w.volumeID, fmt.Sprintf("failed to create file %s: %v", path, err))
		return nil
	}

	// Generate preview asynchronously if preview service is available
	if file != nil {
		w.previewGen.GenerateAsync(w.volumeID, file, path, info, w.indexer.recordError)
	}

	w.indexer.incrementFileCount(w.volumeID)
	w.indexer.addBytesProcessed(w.volumeID, info.Size())
	return nil
}


// countFilesAndFolders does a quick count of total files and folders for progress tracking
func (w *Walker) countFilesAndFolders(ctx context.Context, mountpoint string) (int64, int64, error) {
	// Use a timeout context for counting - don't wait forever on large volumes
	countCtx, cancel := context.WithTimeout(ctx, 5*time.Minute)
	defer cancel()

	var totalFiles, totalFolders int64

	// Create skip pattern matcher for consistency with actual indexing
	skipMatcher, err := NewSkipPatternMatcher(w.indexer.config.SkipPatterns, w.indexer.config.SkipHidden)
	if err != nil {
		return 0, 0, fmt.Errorf("failed to create skip pattern matcher: %w", err)
	}

	err = filepath.Walk(mountpoint, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			// Skip inaccessible files/folders rather than failing the whole count
			return nil
		}

		// Check context cancellation
		select {
		case <-countCtx.Done():
			return countCtx.Err()
		default:
		}

		// Skip files based on patterns (same logic as actual indexing)
		if skipMatcher.ShouldSkip(path, info) {
			if info.IsDir() {
				return filepath.SkipDir
			}
			return nil
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

