package filesystem

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/mantonx/volumeviz/internal/models"
)

// IncrementalWalker handles filesystem walking with incremental database reconciliation
// instead of bulk deletion operations that cause UI hangs
type IncrementalWalker struct {
	indexer         *FilesystemIndexer
	volumeID        string
	skipMatcher     *SkipPatternMatcher
	folderCache     map[string]*models.Folder
	previewGen      *PreviewGenerator
}

// NewIncrementalWalker creates a new incremental filesystem walker
func NewIncrementalWalker(indexer *FilesystemIndexer, volumeID string) *IncrementalWalker {
	return &IncrementalWalker{
		indexer:     indexer,
		volumeID:    volumeID,
		folderCache: make(map[string]*models.Folder),
		previewGen:  NewPreviewGenerator(indexer.previewService, indexer.mimeDetector),
	}
}

// Walk performs incremental filesystem walk with sub-phase progress reporting
func (w *IncrementalWalker) Walk(ctx context.Context, mountpoint string, scanID string) error {
	// Phase 1: Preparation (0-10%)
	if err := w.preparationPhase(ctx, mountpoint, scanID); err != nil {
		return fmt.Errorf("preparation phase failed: %w", err)
	}

	// Phase 2: Database Reconciliation (10-60%)
	if err := w.databaseReconciliationPhase(ctx, mountpoint, scanID); err != nil {
		return fmt.Errorf("database reconciliation phase failed: %w", err)
	}

	// Phase 3: Filesystem Walking (60-100%)
	if err := w.filesystemWalkingPhase(ctx, mountpoint, scanID); err != nil {
		return fmt.Errorf("filesystem walking phase failed: %w", err)
	}

	return nil
}

// preparationPhase handles initial setup and file counting
func (w *IncrementalWalker) preparationPhase(ctx context.Context, mountpoint string, scanID string) error {
	w.updateSubPhase(scanID, "preparation", 0, "Counting files and directories...")

	// Count files for progress baseline
	totalFiles, totalFolders, err := w.countFilesAndFolders(ctx, mountpoint)
	if err != nil {
		if err == context.DeadlineExceeded {
			fmt.Printf("File counting timed out - will use dynamic progress tracking\n")
			totalFiles, totalFolders = 0, 0
		} else {
			return fmt.Errorf("failed to count files: %w", err)
		}
	}

	// Initialize progress tracking
	w.initializeProgress(scanID, totalFiles, totalFolders)

	w.updateSubPhase(scanID, "preparation", 50, "Preparing database connections...")

	// Create skip pattern matcher
	skipMatcher, err := NewSkipPatternMatcher(w.indexer.config.SkipPatterns, w.indexer.config.SkipHidden)
	if err != nil {
		return fmt.Errorf("failed to create skip pattern matcher: %w", err)
	}
	w.skipMatcher = skipMatcher

	w.updateSubPhase(scanID, "preparation", 100, "Preparation complete")

	return nil
}

// databaseReconciliationPhase handles incremental file checking instead of bulk deletion
func (w *IncrementalWalker) databaseReconciliationPhase(ctx context.Context, mountpoint string, scanID string) error {
	w.updateSubPhase(scanID, "database_reconciliation", 0, "Loading existing files from database...")

	// Get all existing files for this volume
	existingFiles, err := w.indexer.store.Files().GetFilesByVolume(ctx, w.volumeID)
	if err != nil {
		return fmt.Errorf("failed to get existing files: %w", err)
	}

	if len(existingFiles) == 0 {
		w.updateSubPhase(scanID, "database_reconciliation", 100, "No existing files to reconcile")
		return nil
	}

	w.updateSubPhase(scanID, "database_reconciliation", 10, fmt.Sprintf("Checking %d existing files...", len(existingFiles)))

	// Check each existing file against filesystem
	filesToDelete := make([]int64, 0)
	processed := 0

	for _, file := range existingFiles {
		// Check for cancellation
		select {
		case <-ctx.Done():
			return ctx.Err()
		default:
		}

		processed++
		progress := 10 + int(float64(processed)/float64(len(existingFiles))*40) // 10-50%

		w.updateSubPhase(scanID, "database_reconciliation", progress, 
			fmt.Sprintf("Checking existing files (%d/%d)", processed, len(existingFiles)))

		// Check if file still exists on filesystem
		if _, err := os.Stat(file.Path); os.IsNotExist(err) {
			filesToDelete = append(filesToDelete, file.ID)
		}
	}

	// Batch delete removed files with progress updates
	if len(filesToDelete) > 0 {
		w.updateSubPhase(scanID, "database_reconciliation", 50, 
			fmt.Sprintf("Removing %d deleted files...", len(filesToDelete)))

		batchSize := 100
		deleted := 0

		for i := 0; i < len(filesToDelete); i += batchSize {
			end := i + batchSize
			if end > len(filesToDelete) {
				end = len(filesToDelete)
			}

			batch := filesToDelete[i:end]
			if err := w.indexer.store.Files().DeleteFilesByIDs(ctx, batch); err != nil {
				return fmt.Errorf("failed to delete file batch: %w", err)
			}

			deleted += len(batch)
			progress := 50 + int(float64(deleted)/float64(len(filesToDelete))*40) // 50-90%

			w.updateSubPhase(scanID, "database_reconciliation", progress, 
				fmt.Sprintf("Removed deleted files (%d/%d)", deleted, len(filesToDelete)))
		}
	}

	// Handle folders similarly
	existingFolders, err := w.indexer.store.Folders().GetFoldersByVolume(ctx, w.volumeID)
	if err != nil {
		return fmt.Errorf("failed to get existing folders: %w", err)
	}

	foldersToDelete := make([]int64, 0)
	for _, folder := range existingFolders {
		if _, err := os.Stat(folder.Path); os.IsNotExist(err) {
			foldersToDelete = append(foldersToDelete, folder.ID)
		}
	}

	if len(foldersToDelete) > 0 {
		if err := w.indexer.store.Folders().DeleteFoldersByIDs(ctx, foldersToDelete); err != nil {
			return fmt.Errorf("failed to delete folders: %w", err)
		}
	}

	w.updateSubPhase(scanID, "database_reconciliation", 100, "Database reconciliation complete")

	return nil
}

// filesystemWalkingPhase handles the actual filesystem traversal and indexing
func (w *IncrementalWalker) filesystemWalkingPhase(ctx context.Context, mountpoint string, scanID string) error {
	w.updateSubPhase(scanID, "filesystem_walking", 0, "Starting filesystem scan...")

	return filepath.Walk(mountpoint, func(path string, info os.FileInfo, err error) error {
		// Check for cancellation
		select {
		case <-ctx.Done():
			return ctx.Err()
		default:
		}

		// Handle walk errors
		if err != nil {
			w.indexer.recordError(w.volumeID, fmt.Sprintf("walk error for %s: %v", path, err))
			return nil
		}

		// Check skip rules
		if w.skipMatcher != nil && w.skipMatcher.ShouldSkip(path, info) {
			if info.IsDir() {
				return filepath.SkipDir
			}
			return nil
		}

		// Check depth limits
		depth := strings.Count(strings.TrimPrefix(path, mountpoint), string(os.PathSeparator))
		if depth > w.indexer.config.MaxDepth {
			if info.IsDir() {
				return filepath.SkipDir
			}
			return nil
		}

		// Update progress with current file/folder
		w.updateProgress(scanID, path, depth)

		// Process based on type
		if info.IsDir() {
			return w.processFolder(ctx, path, info, depth)
		} else {
			return w.processFile(ctx, path, info, depth, scanID)
		}
	})
}

// updateSubPhase updates sub-phase progress and operation description
func (w *IncrementalWalker) updateSubPhase(scanID, subPhase string, progress int, operation string) {
	if scanID == "" || w.indexer.progressTracker == nil {
		return
	}

	// Update database progress with sub-phase information
	w.indexer.progressTracker.UpdateSubPhaseProgress(context.Background(), scanID, "filesystem_indexing", 
		subPhase, progress, operation)
}

// updateProgress updates the current path and overall progress
func (w *IncrementalWalker) updateProgress(scanID, currentPath string, depth int) {
	w.indexer.updateProgress(w.volumeID, currentPath, depth)
	
	if scanID != "" {
		// Calculate overall progress within filesystem walking phase (60-100%)
		// This is a simplified calculation - could be made more accurate with file counts
		baseProgress := 60
		walkingProgress := 40 // Walking gets 40% of total progress
		
		// For now, use depth as a rough progress indicator
		// In a full implementation, this would use actual file counts
		depthProgress := min(depth*5, walkingProgress) // Rough approximation
		
		w.updateSubPhase(scanID, "filesystem_walking", baseProgress+depthProgress, 
			fmt.Sprintf("Processing: %s", filepath.Base(currentPath)))
	}
}

// initializeProgress sets up progress tracking for the scan
func (w *IncrementalWalker) initializeProgress(scanID string, totalFiles, totalFolders int64) {
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

	// Update database progress
	if scanID != "" && w.indexer.progressTracker != nil {
		w.indexer.progressTracker.UpdatePhaseStatus(context.Background(), scanID, "filesystem_indexing", "running", "")
	}
}

// processFolder handles folder indexing (same as original walker)
func (w *IncrementalWalker) processFolder(ctx context.Context, path string, info os.FileInfo, depth int) error {
	// Get parent folder ID
	var parentID *int64
	if depth > 0 {
		parentPath := filepath.Dir(path)
		if parent, exists := w.folderCache[parentPath]; exists {
			parentID = &parent.ID
		}
	}

	// Extract metadata
	folderParams := w.indexer.metadataExtractor.ExtractFolderMetadata(w.volumeID, path, info, parentID, int32(depth))

	// Check if folder exists (always check since we're doing incremental)
	existing, err := w.indexer.store.Folders().GetFolderByPath(ctx, w.volumeID, path)
	if err == nil {
		// Folder exists, check if it needs updating
		if w.indexer.metadataExtractor.ShouldUpdateFolder(existing, &folderParams) {
			err = w.indexer.store.Folders().UpdateFolderMetadata(ctx, existing.ID,
				folderParams.Mtime, folderParams.Ctime, folderParams.Uid, folderParams.Gid, folderParams.Mode)
			if err != nil {
				w.indexer.recordError(w.volumeID, fmt.Sprintf("failed to update folder %s: %v", path, err))
			}
		}
		w.folderCache[path] = existing
		w.indexer.incrementFolderCount(w.volumeID)
		return nil
	}

	// Create new folder
	folder, err := w.indexer.store.Folders().CreateFolder(ctx, folderParams)
	if err != nil {
		w.indexer.recordError(w.volumeID, fmt.Sprintf("failed to create folder %s: %v", path, err))
		return nil
	}

	w.folderCache[path] = folder
	w.indexer.incrementFolderCount(w.volumeID)
	return nil
}

// processFile handles file indexing (same as original walker)
func (w *IncrementalWalker) processFile(ctx context.Context, path string, info os.FileInfo, depth int, scanID string) error {
	folderPath := filepath.Dir(path)
	folder, exists := w.folderCache[folderPath]
	if !exists {
		w.indexer.recordError(w.volumeID, fmt.Sprintf("parent folder not found for file %s", path))
		return nil
	}

	fileParams := w.indexer.metadataExtractor.ExtractFileMetadata(w.volumeID, path, info, folder.ID)

	// Check if file exists (always check since we're doing incremental)
	existing, err := w.indexer.store.Files().GetFileByPath(ctx, w.volumeID, path)
	if err == nil {
		if w.indexer.metadataExtractor.ShouldUpdateFile(existing, &fileParams) {
			err = w.indexer.store.Files().UpdateFileMetadata(ctx, existing.ID,
				fileParams.SizeBytes, fileParams.DiskUsageBytes,
				fileParams.Mtime, fileParams.Ctime, fileParams.Birthtime,
				fileParams.Uid, fileParams.Gid, fileParams.Mode)
			if err != nil {
				w.indexer.recordError(w.volumeID, fmt.Sprintf("failed to update file %s: %v", path, err))
			}
		}
		w.indexer.incrementFileCount(w.volumeID)
		w.indexer.addBytesProcessed(w.volumeID, info.Size())
		return nil
	}

	// Create new file
	file, err := w.indexer.store.Files().CreateFile(ctx, fileParams)
	if err != nil {
		w.indexer.recordError(w.volumeID, fmt.Sprintf("failed to create file %s: %v", path, err))
		return nil
	}

	// Generate preview asynchronously
	if file != nil {
		w.previewGen.GenerateAsync(w.volumeID, file, path, info, w.indexer.recordError)
	}

	// Trigger streaming enrichment immediately for media files
	if file != nil && w.indexer.enrichmentManager != nil {
		go w.triggerStreamingEnrichment(context.Background(), file, scanID)
	}

	w.indexer.incrementFileCount(w.volumeID)
	w.indexer.addBytesProcessed(w.volumeID, info.Size())
	return nil
}

// Helper methods

func (w *IncrementalWalker) countFilesAndFolders(ctx context.Context, mountpoint string) (int64, int64, error) {
	countCtx, cancel := context.WithTimeout(ctx, 5*time.Minute)
	defer cancel()

	var totalFiles, totalFolders int64
	skipMatcher, err := NewSkipPatternMatcher(w.indexer.config.SkipPatterns, w.indexer.config.SkipHidden)
	if err != nil {
		return 0, 0, fmt.Errorf("failed to create skip pattern matcher: %w", err)
	}

	err = filepath.Walk(mountpoint, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return nil
		}

		select {
		case <-countCtx.Done():
			return countCtx.Err()
		default:
		}

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


// triggerStreamingEnrichment immediately processes a single file for media enrichment
func (w *IncrementalWalker) triggerStreamingEnrichment(ctx context.Context, file *models.File, scanID string) {
	// Only enrich media files to avoid processing system files
	if !w.isMediaFile(file) {
		return
	}

	// Create file info for enrichment
	fileInfo := &models.FileInfo{
		ID:       file.ID,
		Path:     file.Path,
		Name:     file.Name,
		MimeType: getStringValue(file.Mime),
		Size:     file.SizeBytes,
		VolumeID: file.VolumeID,
	}

	// Trigger enrichment for single file
	err := w.indexer.enrichmentManager.EnrichSingleFile(ctx, fileInfo, scanID)
	if err != nil {
		w.indexer.recordError(w.volumeID, fmt.Sprintf("Failed to enrich file %s: %v", file.Path, err))
	}
}

// isMediaFile determines if a file is worth enriching
func (w *IncrementalWalker) isMediaFile(file *models.File) bool {
	if file.Mime == nil {
		return false
	}

	mimeType := *file.Mime
	return isVideoFile(mimeType) || isAudioFile(mimeType) || isImageFile(mimeType)
}

// Helper functions to check media types
func isVideoFile(mimeType string) bool {
	return len(mimeType) > 6 && mimeType[:6] == "video/"
}

func isAudioFile(mimeType string) bool {
	return len(mimeType) > 6 && mimeType[:6] == "audio/"
}

func isImageFile(mimeType string) bool {
	return len(mimeType) > 6 && mimeType[:6] == "image/"
}

// getStringValue safely gets string value from pointer
func getStringValue(ptr *string) string {
	if ptr == nil {
		return ""
	}
	return *ptr
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}