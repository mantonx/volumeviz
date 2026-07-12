package filesystem

import (
	"context"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"runtime"
	"sync"
	"sync/atomic"
	"time"

	"github.com/mantonx/volumeviz/internal/models"
)

// IncrementalWalker handles filesystem walking with incremental database reconciliation
// instead of bulk deletion operations that cause UI hangs
type IncrementalWalker struct {
	indexer     *FilesystemIndexer
	volumeID    string
	skipMatcher *SkipPatternMatcher
	previewGen  *PreviewGenerator

	// folderCache maps a folder's path to its DB row, letting processFile
	// attach a file to its parent folder's ID without a DB round trip.
	// filesystemWalkingPhase runs concurrently (multiple workers, each
	// processing a different directory at once — see walkQueue), so this
	// needs its own lock: the sequential filepath.Walk this replaced never
	// needed one, since only one goroutine ever touched the map.
	folderCacheMu sync.RWMutex
	folderCache   map[string]*models.Folder

	// knownCounts, when set by IndexVolumeWithKnownCounts, seeds progress
	// reporting with an accurate total instead of running a dedicated
	// counting walk. See preparationPhase and KnownCounts for details.
	knownCounts *KnownCounts
}

// cachedFolder returns the cached folder row for path, if any.
func (w *IncrementalWalker) cachedFolder(path string) (*models.Folder, bool) {
	w.folderCacheMu.RLock()
	defer w.folderCacheMu.RUnlock()
	f, ok := w.folderCache[path]
	return f, ok
}

// cacheFolder records a folder's DB row for later parent-lookup by its
// children (subdirectories processed by this or another worker, and files
// processed within this same call).
func (w *IncrementalWalker) cacheFolder(path string, folder *models.Folder) {
	w.folderCacheMu.Lock()
	w.folderCache[path] = folder
	w.folderCacheMu.Unlock()
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

// preparationPhase handles initial setup: progress init and skip-pattern
// compilation. This used to also run a full sequential filepath.Walk purely
// to count files/folders for a progress-bar total. That walk was removed —
// it duplicated a full tree traversal that the size-scanner (Walker) already
// just performed on the same volume moments earlier, and on a network-mounted
// (CIFS) volume it cost as much wall-clock time as the real indexing walk
// itself for no functional benefit beyond an accurate percentage. Instead:
//   - if the caller already knows the file/folder count (the common case —
//     IndexVolumeWithKnownCounts is called right after a size-scan whose
//     result already has these numbers), that seeds an accurate total here;
//   - otherwise, initializeProgress is called with 0/0 as a placeholder, and
//     databaseReconciliationPhase (which already loads every existing
//     file/folder row from the DB, at no extra cost) refines the total to
//     the existing row count once it's known — a very close estimate for
//     incremental scans, where most files were already indexed previously.
//   - if neither is available (first-ever index of this volume, no scan
//     result), progress reporting falls back to the existing indeterminate
//     percentage behavior in ProgressTracker.QueueProgressUpdate, exactly as
//     Walker's own progress reporting already does with no total at all.
func (w *IncrementalWalker) preparationPhase(ctx context.Context, mountpoint string, scanID string) error {
	w.updateSubPhase(scanID, "preparation", 0, "Preparing indexing run...")

	var totalFiles, totalFolders int64
	if w.knownCounts != nil {
		totalFiles, totalFolders = w.knownCounts.Files, w.knownCounts.Folders
		log.Printf("[WALKER] Preparation: using known counts from prior scan (%d files, %d folders)", totalFiles, totalFolders)
	}

	// Initialize progress tracking. If knownCounts was nil, this starts with
	// 0/0 and databaseReconciliationPhase will refine it below.
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

// reconciliationConcurrency bounds how many os.Stat calls run in flight
// during database reconciliation. Each existing file/folder path is
// independent (no shared state, no ordering requirement between them), so
// this is embarrassingly parallel — the bound exists only to avoid opening
// an unbounded number of goroutines/network requests against the volume's
// filesystem at once, mirroring Walker's worker-count reasoning for the
// same underlying constraint (a single-connection network mount gains
// nothing past roughly this many in-flight requests; see walker.go).
const reconciliationConcurrency = 16

// statMissingIDs runs os.Stat against every path in paths using a bounded
// worker pool and returns the IDs of paths that no longer exist. Reconciling
// a large existing index against a network-mounted volume was previously a
// single sequential os.Stat per path — on a CIFS mount without local caching
// warm, each call costs a real network round trip (measured ~0.35-0.37ms on
// this codebase's reference CIFS share once the client's attribute cache
// expires), so reconciling tens of thousands of existing files sequentially
// was rediscovering the same one-request-at-a-time bottleneck Walker's
// work-stealing rewrite already solved for the initial scan.
func statMissingIDs(ctx context.Context, paths []pathID, onProgress func(processed int)) ([]int64, error) {
	if len(paths) == 0 {
		return nil, nil
	}

	type result struct {
		id      int64
		missing bool
	}

	sem := make(chan struct{}, reconciliationConcurrency)
	resultsCh := make(chan result, len(paths))
	var wg sync.WaitGroup
	var processed int64

	for _, p := range paths {
		select {
		case <-ctx.Done():
			wg.Wait()
			return nil, ctx.Err()
		case sem <- struct{}{}:
		}

		wg.Add(1)
		go func(p pathID) {
			defer wg.Done()
			defer func() { <-sem }()

			_, err := os.Stat(p.path)
			resultsCh <- result{id: p.id, missing: os.IsNotExist(err)}

			if onProgress != nil {
				n := atomic.AddInt64(&processed, 1)
				onProgress(int(n))
			}
		}(p)
	}

	wg.Wait()
	close(resultsCh)

	var missingIDs []int64
	for r := range resultsCh {
		if r.missing {
			missingIDs = append(missingIDs, r.id)
		}
	}
	return missingIDs, nil
}

// pathID pairs a database row's ID with the filesystem path to check —
// shared by the file and folder reconciliation passes.
type pathID struct {
	id   int64
	path string
}

// databaseReconciliationPhase handles incremental file checking instead of bulk deletion
func (w *IncrementalWalker) databaseReconciliationPhase(ctx context.Context, mountpoint string, scanID string) error {
	w.updateSubPhase(scanID, "database_reconciliation", 0, "Loading existing files from database...")

	// Get all existing files for this volume
	existingFiles, err := w.indexer.store.Files().GetFilesByVolume(ctx, w.volumeID)
	if err != nil {
		return fmt.Errorf("failed to get existing files: %w", err)
	}

	// Get all existing folders for this volume too — needed both for the
	// deletion check below and, when no KnownCounts were supplied, to give
	// the progress total a much better estimate than the 0/0 placeholder
	// preparationPhase started with.
	existingFolders, err := w.indexer.store.Folders().GetFoldersByVolume(ctx, w.volumeID)
	if err != nil {
		return fmt.Errorf("failed to get existing folders: %w", err)
	}
	w.refineKnownTotals(scanID, int64(len(existingFiles)), int64(len(existingFolders)))

	if len(existingFiles) == 0 {
		w.updateSubPhase(scanID, "database_reconciliation", 100, "No existing files to reconcile")
		return nil
	}

	w.updateSubPhase(scanID, "database_reconciliation", 10, fmt.Sprintf("Checking %d existing files...", len(existingFiles)))

	filePaths := make([]pathID, len(existingFiles))
	for i, file := range existingFiles {
		filePaths[i] = pathID{id: file.ID, path: file.Path}
	}

	filesToDelete, err := statMissingIDs(ctx, filePaths, func(processed int) {
		progress := 10 + int(float64(processed)/float64(len(filePaths))*40) // 10-50%
		w.updateSubPhase(scanID, "database_reconciliation", progress,
			fmt.Sprintf("Checking existing files (%d/%d)", processed, len(filePaths)))
	})
	if err != nil {
		return err
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

	// Handle folders similarly (existingFolders was already loaded above,
	// ahead of the deletion-check loop, so the progress total could be
	// refined as early as possible).
	folderPaths := make([]pathID, len(existingFolders))
	for i, folder := range existingFolders {
		folderPaths[i] = pathID{id: folder.ID, path: folder.Path}
	}

	foldersToDelete, err := statMissingIDs(ctx, folderPaths, nil)
	if err != nil {
		return err
	}

	if len(foldersToDelete) > 0 {
		if err := w.indexer.store.Folders().DeleteFoldersByIDs(ctx, foldersToDelete); err != nil {
			return fmt.Errorf("failed to delete folders: %w", err)
		}
	}

	w.updateSubPhase(scanID, "database_reconciliation", 100, "Database reconciliation complete")

	return nil
}

// walkTask is one unit of work for the concurrent filesystemWalkingPhase: one
// directory to list and index, at a known depth relative to the mountpoint.
type walkTask struct {
	path  string
	depth int
}

// walkQueue is a work-stealing FIFO of pending directories, identical in
// design to scanner.dirQueue (internal/services/scanner/walker.go) — see
// that type's comments for the reasoning behind the inFlight counter and
// batched pushAll. Duplicated rather than shared across packages because the
// two walkers' per-item work is different enough (this one does DB I/O per
// file/folder; the size-scanner only accumulates stats) that a shared
// generic queue would need type parameters or an interface indirection for
// no real benefit at this size.
type walkQueue struct {
	mu       sync.Mutex
	cond     *sync.Cond
	items    []walkTask
	inFlight int64
	closed   bool
}

func newWalkQueue(root string) *walkQueue {
	q := &walkQueue{items: []walkTask{{path: root, depth: 0}}, inFlight: 1}
	q.cond = sync.NewCond(&q.mu)
	return q
}

func (q *walkQueue) pushAll(tasks []walkTask) {
	if len(tasks) == 0 {
		return
	}
	q.mu.Lock()
	atomic.AddInt64(&q.inFlight, int64(len(tasks)))
	q.items = append(q.items, tasks...)
	q.mu.Unlock()
	if len(tasks) == 1 {
		q.cond.Signal()
	} else {
		q.cond.Broadcast()
	}
}

func (q *walkQueue) pop() (task walkTask, ok bool) {
	q.mu.Lock()
	defer q.mu.Unlock()
	for len(q.items) == 0 {
		if atomic.LoadInt64(&q.inFlight) == 0 || q.closed {
			return walkTask{}, false
		}
		q.cond.Wait()
	}
	task = q.items[len(q.items)-1]
	q.items = q.items[:len(q.items)-1]
	return task, true
}

func (q *walkQueue) done() {
	if atomic.AddInt64(&q.inFlight, -1) == 0 {
		q.mu.Lock()
		q.cond.Broadcast()
		q.mu.Unlock()
	}
}

func (q *walkQueue) closeOnErr() {
	q.mu.Lock()
	q.closed = true
	q.cond.Broadcast()
	q.mu.Unlock()
}

// filesystemWalkingPhase handles the actual filesystem traversal and
// indexing. This used to be a single sequential filepath.Walk — on a
// network-mounted (CIFS) volume, every directory listing and per-file stat
// is a real network round trip, and a single-threaded walk means only one
// such round trip is ever in flight at a time. Rewritten as a work-stealing
// walk (same design as scanner.Walker's size-scan — see walker.go in the
// scanner package for the full reasoning and the profiling that validated
// it) so multiple directories can be listed and indexed concurrently.
//
// Each worker fully processes one directory per task: list it, upsert/cache
// the folder itself, then upsert every file inside it, before pushing
// subdirectories as new tasks. Processing a folder and its direct file
// children together, in the same task, on the same goroutine, means
// processFile's folderCache lookup for "my parent folder" always hits — the
// folder was cached by this exact call moments earlier. The only
// cross-worker dependency is a subdirectory's *own* parent-folder-ID lookup
// (processFolder reading folderCache for its parent, which a different
// worker may have processed) — folderCache is mutex-protected for this, and
// a cache miss falls back to a database lookup (the same pattern
// ResumeWalker already uses for exactly this reason) rather than silently
// dropping the parent link.
func (w *IncrementalWalker) filesystemWalkingPhase(ctx context.Context, mountpoint string, scanID string) error {
	log.Printf("[WALKER] Filesystem Walking: Starting walk of %s", mountpoint)
	w.updateSubPhase(scanID, "filesystem_walking", 0, "Starting filesystem scan...")

	workers := runtime.NumCPU()
	if workers < 1 {
		workers = 1
	}

	queue := newWalkQueue(mountpoint)

	var itemCount, skippedCount, folderCount, fileCount int64

	var walkErr error
	var walkErrOnce sync.Once
	setErr := func(err error) {
		walkErrOnce.Do(func() {
			walkErr = err
			queue.closeOnErr()
		})
	}

	var wg sync.WaitGroup
	for i := 0; i < workers; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for {
				select {
				case <-ctx.Done():
					setErr(ctx.Err())
					return
				default:
				}

				task, ok := queue.pop()
				if !ok {
					return
				}

				subdirs, err := w.processDirectory(ctx, task, mountpoint, scanID,
					&itemCount, &skippedCount, &folderCount, &fileCount)
				if err != nil {
					w.indexer.recordError(w.volumeID, fmt.Sprintf("walk error for %s: %v", task.path, err))
				}

				queue.pushAll(subdirs)
				queue.done()
			}
		}()
	}
	wg.Wait()

	log.Printf("[WALKER] Filesystem Walking: Walk completed - %d items visited, %d skipped, %d folders, %d files",
		itemCount, skippedCount, folderCount, fileCount)

	return walkErr
}

// processDirectory lists one directory, indexes the directory itself and
// every file directly inside it, and returns the subdirectories found for
// the caller to enqueue as further tasks.
func (w *IncrementalWalker) processDirectory(
	ctx context.Context, task walkTask, mountpoint, scanID string,
	itemCount, skippedCount, folderCount, fileCount *int64,
) ([]walkTask, error) {
	path, depth := task.path, task.depth

	info, err := os.Lstat(path)
	if err != nil {
		return nil, fmt.Errorf("stat %s: %w", path, err)
	}

	n := atomic.AddInt64(itemCount, 1)
	if n <= 5 {
		log.Printf("[WALKER] Walk callback #%d: path=%s, isDir=true", n, path)
	}

	if w.skipMatcher != nil && w.skipMatcher.ShouldSkip(path, info) {
		atomic.AddInt64(skippedCount, 1)
		log.Printf("[WALKER] Skipping directory %s (rule matched)", path)
		return nil, nil
	}

	if depth > w.indexer.config.MaxDepth {
		atomic.AddInt64(skippedCount, 1)
		log.Printf("[WALKER] Skipping %s (max depth %d exceeded)", path, w.indexer.config.MaxDepth)
		return nil, nil
	}

	w.updateProgress(scanID, path, depth)

	fc := atomic.AddInt64(folderCount, 1)
	if fc <= 5 {
		log.Printf("[WALKER] Processing folder: %s", path)
	}
	if err := w.processFolder(ctx, path, info, depth); err != nil {
		return nil, err
	}
	// processFolder logs-and-swallows its own DB errors (upsert/update
	// failures) rather than returning them, so a failed upsert doesn't look
	// like an error here — but it also means the folder was never cached.
	// Processing this directory's files anyway would immediately fail every
	// one of them with "parent folder not found" (processFile's cache
	// lookup below always misses), producing a noisy, confusing error for
	// every file instead of the one real underlying folder error already
	// recorded by processFolder. Stop here instead.
	if _, cached := w.cachedFolder(path); !cached {
		return nil, fmt.Errorf("folder %s could not be indexed, skipping its contents", path)
	}

	entries, err := os.ReadDir(path)
	if err != nil {
		return nil, fmt.Errorf("readdir %s: %w", path, err)
	}

	var subdirs []walkTask
	for _, entry := range entries {
		select {
		case <-ctx.Done():
			return subdirs, ctx.Err()
		default:
		}

		entryPath := filepath.Join(path, entry.Name())
		entryInfo, err := entry.Info()
		if err != nil {
			w.indexer.recordError(w.volumeID, fmt.Sprintf("stat %s: %v", entryPath, err))
			continue
		}

		if w.skipMatcher != nil && w.skipMatcher.ShouldSkip(entryPath, entryInfo) {
			atomic.AddInt64(skippedCount, 1)
			continue
		}

		entryDepth := depth + 1
		if entryDepth > w.indexer.config.MaxDepth {
			atomic.AddInt64(skippedCount, 1)
			continue
		}

		if entry.IsDir() {
			subdirs = append(subdirs, walkTask{path: entryPath, depth: entryDepth})
			continue
		}

		atomic.AddInt64(itemCount, 1)
		w.updateProgress(scanID, entryPath, entryDepth)

		fc := atomic.AddInt64(fileCount, 1)
		if fc <= 5 {
			log.Printf("[WALKER] Processing file: %s", entryPath)
		}
		if err := w.processFile(ctx, entryPath, entryInfo, entryDepth, scanID); err != nil {
			w.indexer.recordError(w.volumeID, fmt.Sprintf("failed to process file %s: %v", entryPath, err))
		}
	}

	return subdirs, nil
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

	// Update database progress with total counts
	if scanID != "" && w.indexer.progressTracker != nil {
		// First set the phase to running
		w.indexer.progressTracker.UpdatePhaseStatus(context.Background(), scanID, "filesystem_indexing", "running", "")

		// Then update with total items (files + folders) so progress is accurate from the start
		w.indexer.progressTracker.QueueProgressUpdate(scanID, &IndexingProgress{
			VolumeID:      w.volumeID,
			ScanID:        scanID,
			TotalFiles:    totalFiles,
			TotalFolders:  totalFolders,
			FilesScanned:  0,
			FoldersScanned: 0,
		})

		log.Printf("[WALKER] Initialized database progress with %d total items (files: %d, folders: %d)",
			totalFiles+totalFolders, totalFiles, totalFolders)
	}
}

// refineKnownTotals updates the in-progress scan's total file/folder counts
// after the fact. Used when preparationPhase started with 0/0 (no
// KnownCounts available) and databaseReconciliationPhase has since loaded
// the existing row counts from the DB — an estimate that's very close for
// incremental scans, since most files were already indexed on a prior run.
// A no-op if knownCounts was already set (that total is authoritative, from
// a scan result computed moments earlier, not an estimate).
func (w *IncrementalWalker) refineKnownTotals(scanID string, totalFiles, totalFolders int64) {
	if w.knownCounts != nil {
		return
	}

	w.indexer.progressMutex.Lock()
	if scan, exists := w.indexer.activeScans[w.volumeID]; exists && scan != nil {
		scan.TotalFiles = totalFiles
		scan.TotalFolders = totalFolders
	}
	w.indexer.progressMutex.Unlock()

	if scanID != "" && w.indexer.progressTracker != nil {
		w.indexer.progressTracker.QueueProgressUpdate(scanID, &IndexingProgress{
			VolumeID:     w.volumeID,
			ScanID:       scanID,
			TotalFiles:   totalFiles,
			TotalFolders: totalFolders,
		})
		log.Printf("[WALKER] Refined progress total from database reconciliation: %d files, %d folders", totalFiles, totalFolders)
	}
}

// processFolder handles folder indexing (same as original walker)
func (w *IncrementalWalker) processFolder(ctx context.Context, path string, info os.FileInfo, depth int) error {
	// Get parent folder ID. Under concurrent walking, a subdirectory's
	// parent may have been processed and cached by a different worker (or,
	// rarely, may still be in flight) — fall back to a database lookup on a
	// cache miss instead of silently leaving parent_id unset, the same
	// pattern ResumeWalker.processFolder already uses for the same reason.
	var parentID *int64
	if depth > 0 {
		parentPath := filepath.Dir(path)
		if parent, exists := w.cachedFolder(parentPath); exists {
			parentID = &parent.ID
		} else if parent, err := w.indexer.store.Folders().GetFolderByPath(ctx, w.volumeID, parentPath); err == nil {
			parentID = &parent.ID
			w.cacheFolder(parentPath, parent)
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
		w.cacheFolder(path, existing)
		w.indexer.incrementFolderCount(w.volumeID)
		return nil
	}

	// Create or update folder (use upsert to handle concurrent scans — the
	// database's ON CONFLICT (path_hash) DO UPDATE handles two workers ever
	// racing to upsert the same path atomically; see folders.sql)
	folder, err := w.indexer.store.Folders().UpsertFolder(ctx, folderParams)
	if err != nil {
		log.Printf("[WALKER] Failed to upsert folder %s: %v", path, err)
		log.Printf("[WALKER] Folder params - Name: %q, Path: %q", folderParams.Name, folderParams.Path)
		w.indexer.recordError(w.volumeID, fmt.Sprintf("failed to upsert folder %s: %v", path, err))
		return nil
	}

	w.cacheFolder(path, folder)
	w.indexer.incrementFolderCount(w.volumeID)
	return nil
}

// processFile handles file indexing (same as original walker). Always
// called immediately after processDirectory has processed and cached path's
// containing folder, on the same goroutine — so this cache lookup is
// guaranteed to hit and never needs the database fallback processFolder's
// parent lookup does.
func (w *IncrementalWalker) processFile(ctx context.Context, path string, info os.FileInfo, depth int, scanID string) error {
	folderPath := filepath.Dir(path)
	folder, exists := w.cachedFolder(folderPath)
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