package filesystem

import (
	"context"
	"fmt"
	"log"
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
	log.Printf("[WALKER] Starting Walk for volume %s (scanID: %s, mountpoint: %s)", w.volumeID, scanID, mountpoint)

	// Phase 1: Preparation (0-10%)
	log.Printf("[WALKER] Phase 1: Starting preparation phase")
	if err := w.preparationPhase(ctx, mountpoint, scanID); err != nil {
		log.Printf("[WALKER] Phase 1 FAILED: %v", err)
		return fmt.Errorf("preparation phase failed: %w", err)
	}
	log.Printf("[WALKER] Phase 1: Preparation complete")

	// Phase 2: Database Reconciliation (10-60%)
	log.Printf("[WALKER] Phase 2: Starting database reconciliation")
	if err := w.databaseReconciliationPhase(ctx, mountpoint, scanID); err != nil {
		log.Printf("[WALKER] Phase 2 FAILED: %v", err)
		return fmt.Errorf("database reconciliation phase failed: %w", err)
	}
	log.Printf("[WALKER] Phase 2: Database reconciliation complete")

	// Phase 3: Filesystem Walking (60-100%)
	log.Printf("[WALKER] Phase 3: Starting filesystem walking")
	if err := w.filesystemWalkingPhase(ctx, mountpoint, scanID); err != nil {
		log.Printf("[WALKER] Phase 3 FAILED: %v", err)
		return fmt.Errorf("filesystem walking phase failed: %w", err)
	}
	log.Printf("[WALKER] Phase 3: Filesystem walking complete")

	// Cleanup: Flush pending updates and mark scan as completed
	w.cleanup(scanID)

	log.Printf("[WALKER] Walk completed successfully for volume %s", w.volumeID)
	return nil
}

// cleanup performs final cleanup tasks after walking completes
func (w *IncrementalWalker) cleanup(scanID string) {
	// Flush any pending throttled updates before completion
	if scanID != "" && w.indexer.progressTracker != nil {
		w.indexer.progressTracker.FlushPending(context.Background(), scanID)

		// Log throttling statistics
		updates, throttled := w.indexer.progressTracker.GetStats(scanID)
		if throttled > 0 {
			reductionRate := float64(throttled) / float64(updates) * 100
			log.Printf("[WALKER] Scan %s throttling stats - Updates: %d, Throttled: %d (%.1f%% reduction in DB writes)",
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

// preparationPhase handles initial setup and file counting
func (w *IncrementalWalker) preparationPhase(ctx context.Context, mountpoint string, scanID string) error {
	log.Printf("[WALKER] Preparation: Counting files in %s", mountpoint)
	w.updateSubPhase(scanID, "preparation", 0, "Counting files and directories...")

	// Count files for progress baseline
	totalFiles, totalFolders, err := w.countFilesAndFolders(ctx, mountpoint)
	if err != nil {
		if err == context.DeadlineExceeded {
			log.Printf("[WALKER] Preparation: File counting timed out - using dynamic progress tracking")
			fmt.Printf("File counting timed out - will use dynamic progress tracking\n")
			totalFiles, totalFolders = 0, 0
		} else {
			log.Printf("[WALKER] Preparation: Failed to count files: %v", err)
			return fmt.Errorf("failed to count files: %w", err)
		}
	}
	log.Printf("[WALKER] Preparation: Counted %d files and %d folders", totalFiles, totalFolders)

	// Initialize progress tracking
	w.initializeProgress(scanID, totalFiles, totalFolders)

	w.updateSubPhase(scanID, "preparation", 50, "Preparing database connections...")

	// Create skip pattern matcher
	log.Printf("[WALKER] Preparation: Creating skip pattern matcher (SkipHidden=%v, %d patterns)",
		w.indexer.config.SkipHidden, len(w.indexer.config.SkipPatterns))
	skipMatcher, err := NewSkipPatternMatcher(w.indexer.config.SkipPatterns, w.indexer.config.SkipHidden)
	if err != nil {
		log.Printf("[WALKER] Preparation: Failed to create skip matcher: %v", err)
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
	log.Printf("[WALKER] Filesystem Walking: Starting walk of %s", mountpoint)
	w.updateSubPhase(scanID, "filesystem_walking", 0, "Starting filesystem scan...")

	itemCount := 0
	skippedCount := 0
	folderCount := 0
	fileCount := 0

	err := filepath.Walk(mountpoint, func(path string, info os.FileInfo, err error) error {
		itemCount++

		// Log first few items for debugging
		if itemCount <= 5 {
			log.Printf("[WALKER] Walk callback #%d: path=%s, isDir=%v", itemCount, path, info != nil && info.IsDir())
		}

		// Check for cancellation
		select {
		case <-ctx.Done():
			log.Printf("[WALKER] Walk cancelled by context after processing %d items", itemCount)
			return ctx.Err()
		default:
		}

		// Handle walk errors
		if err != nil {
			log.Printf("[WALKER] Walk error for %s: %v", path, err)
			w.indexer.recordError(w.volumeID, fmt.Sprintf("walk error for %s: %v", path, err))
			return nil
		}

		// Check skip rules
		if w.skipMatcher != nil && w.skipMatcher.ShouldSkip(path, info) {
			skippedCount++
			if skippedCount <= 5 {
				log.Printf("[WALKER] Skipping %s (rule matched)", path)
			}
			if info.IsDir() {
				return filepath.SkipDir
			}
			return nil
		}

		// Check depth limits
		depth := strings.Count(strings.TrimPrefix(path, mountpoint), string(os.PathSeparator))
		if depth > w.indexer.config.MaxDepth {
			if skippedCount <= 5 {
				log.Printf("[WALKER] Skipping %s (max depth %d exceeded)", path, w.indexer.config.MaxDepth)
			}
			skippedCount++
			if info.IsDir() {
				return filepath.SkipDir
			}
			return nil
		}

		// Update progress with current file/folder
		w.updateProgress(scanID, path, depth)

		// Process based on type
		if info.IsDir() {
			folderCount++
			if folderCount <= 5 {
				log.Printf("[WALKER] Processing folder: %s", path)
			}
			return w.processFolder(ctx, path, info, depth)
		} else {
			fileCount++
			if fileCount <= 5 {
				log.Printf("[WALKER] Processing file: %s", path)
			}
			return w.processFile(ctx, path, info, depth, scanID)
		}
	})

	log.Printf("[WALKER] Filesystem Walking: Walk completed - %d items visited, %d skipped, %d folders, %d files",
		itemCount, skippedCount, folderCount, fileCount)

	return err
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
				log.Printf("[WALKER] Failed to update folder %s: %v", path, err)
				w.indexer.recordError(w.volumeID, fmt.Sprintf("failed to update folder %s: %v", path, err))
			}
		}
		w.folderCache[path] = existing
		w.indexer.incrementFolderCount(w.volumeID)
		return nil
	}

	// Create or update folder (use upsert to handle concurrent scans)
	folder, err := w.indexer.store.Folders().UpsertFolder(ctx, folderParams)
	if err != nil {
		log.Printf("[WALKER] Failed to upsert folder %s: %v", path, err)
		log.Printf("[WALKER] Folder params - Name: %q, Path: %q", folderParams.Name, folderParams.Path)
		w.indexer.recordError(w.volumeID, fmt.Sprintf("failed to upsert folder %s: %v", path, err))
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
		log.Printf("[WALKER] Parent folder not found for file %s (folderPath: %s)", path, folderPath)
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
				log.Printf("[WALKER] Failed to update file %s: %v", path, err)
				w.indexer.recordError(w.volumeID, fmt.Sprintf("failed to update file %s: %v", path, err))
			}
		}
		w.indexer.incrementFileCount(w.volumeID)
		w.indexer.addBytesProcessed(w.volumeID, info.Size())
		return nil
	}

	// Create or update file (use upsert to handle concurrent scans)
	file, err := w.indexer.store.Files().UpsertFile(ctx, fileParams)
	if err != nil {
		log.Printf("[WALKER] Failed to upsert file %s: %v", path, err)
		w.indexer.recordError(w.volumeID, fmt.Sprintf("failed to upsert file %s: %v", path, err))
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