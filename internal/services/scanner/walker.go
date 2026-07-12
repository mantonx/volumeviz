package scanner

import (
	"context"
	"os"
	"path/filepath"
	"runtime"
	"sync"
	"sync/atomic"
	"syscall"
	"time"

	"github.com/mantonx/volumeviz/internal/interfaces"
	"github.com/mantonx/volumeviz/internal/models"
)

// inodeKey uniquely identifies a file across a scan even if it appears under
// multiple names — inode numbers are only unique per-device, so both fields
// are required to avoid treating unrelated files on different devices (e.g.
// a bind-mounted volume) as the same hard link.
type inodeKey struct {
	dev uint64
	ino uint64
}

// diskUsage returns a file's actual on-disk footprint (in bytes, matching
// `du`'s disk-usage semantics) and its identity for hard-link deduplication.
// Falls back to the file's logical size when platform stat info isn't
// available (info.Sys() not a *syscall.Stat_t), which only happens off Linux
// — this app only ever runs in Linux containers, so that fallback is a
// safety net, not an expected path.
func diskUsage(info os.FileInfo) (sizeBytes int64, key inodeKey, hasInode bool) {
	stat, ok := info.Sys().(*syscall.Stat_t)
	if !ok {
		return info.Size(), inodeKey{}, false
	}
	// st_blocks is always in 512-byte units regardless of the filesystem's
	// actual block size — this matches `du`'s default accounting.
	return stat.Blocks * 512, inodeKey{dev: uint64(stat.Dev), ino: stat.Ino}, true
}

// Walker is VolumeViz's volume size scanner: a pure-Go work-stealing tree
// walk, with no external binary dependency. Every worker pulls directories
// off a shared queue, lists them, and pushes any subdirectories it finds
// back onto the queue for any worker — including itself — to pick up next.
// This recurses all the way down the tree rather than splitting once at the
// root, which matters in practice: on one measured volume, 3 of 9 top-level
// directories held 92% of the files, so a one-level split would have capped
// real parallelism at ~3 regardless of worker count.
//
// This design was benchmarked directly against `du` and `diskus` (a
// multithreaded `du` replacement previously used as a fallback) across local
// Docker volumes and real CIFS-mounted network shares, and matched or beat
// both on every workload tested — the bottleneck throughout was syscall/
// network round-trip latency and how well work was spread across cores, not
// implementation language. `du`/`diskus` were removed once that held up.
type Walker struct {
	timeout          time.Duration
	maxWorkers       int
	progressCallback func(interfaces.ProgressUpdate)
}

// NewWalker creates a new volume size scanner.
func NewWalker(config models.ScanConfig) interfaces.ScanMethod {
	workers := runtime.NumCPU()
	if workers < 1 {
		workers = 1
	}
	return &Walker{
		timeout:    config.PerMethodTimeout,
		maxWorkers: workers,
	}
}

func (w *Walker) Name() string {
	return "walker"
}

func (w *Walker) Available() bool {
	return true
}

func (w *Walker) EstimatedDuration(path string) time.Duration {
	// Rough estimate accounting for parallel walking across maxWorkers.
	if entries, err := os.ReadDir(path); err == nil {
		entryCount := len(entries)
		workers := w.maxWorkers
		if workers < 1 {
			workers = 1
		}
		// ~300 files/sec/worker once walking is parallelized across subtrees.
		seconds := entryCount / (300 * workers)
		if seconds < 2 {
			return 2 * time.Second
		}
		return time.Duration(seconds) * time.Second
	}
	return 15 * time.Second // Conservative estimate
}

func (w *Walker) SupportsProgress() bool {
	return true
}

func (w *Walker) SetProgressCallback(callback func(interfaces.ProgressUpdate)) {
	w.progressCallback = callback
}

// walkStats accumulates one worker's contribution to the overall scan.
// Hard-link dedup only needs to be correct within one worker's own view, so
// each worker keeps its own inode set (avoiding a shared, lock-contended map
// on every single file) — see the merge comment in Scan for the resulting
// tradeoff.
type walkStats struct {
	totalSize   int64
	fileCount   int64
	dirCount    int64
	largestFile int64
	inodes      map[inodeKey]struct{}
}

func newWalkStats() *walkStats {
	return &walkStats{inodes: make(map[inodeKey]struct{})}
}

func (s *walkStats) addFile(info os.FileInfo) {
	s.fileCount++
	if logicalSize := info.Size(); logicalSize > s.largestFile {
		s.largestFile = logicalSize
	}
	diskBytes, key, hasInode := diskUsage(info)
	if hasInode {
		if _, seen := s.inodes[key]; seen {
			return
		}
		s.inodes[key] = struct{}{}
	}
	s.totalSize += diskBytes
}

// dirQueue is a simple unbounded FIFO of pending directory paths, protected
// by a mutex, with an outstanding-work counter so workers can tell "queue is
// empty because we're done" apart from "queue is momentarily empty but a
// sibling worker is about to push more onto it".
type dirQueue struct {
	mu       sync.Mutex
	cond     *sync.Cond
	items    []string
	inFlight int64 // directories pushed but not yet fully processed
	closed   bool
}

func newDirQueue(root string) *dirQueue {
	q := &dirQueue{items: []string{root}, inFlight: 1}
	q.cond = sync.NewCond(&q.mu)
	return q
}

// pushAll enqueues every path in one lock acquisition — a directory with N
// subdirectories only takes the lock once here instead of N times, which
// measurably reduces contention: a mutex profile on a ~6,600-directory
// volume showed the queue's lock as the dominant contended resource before
// this batching.
func (q *dirQueue) pushAll(paths []string) {
	if len(paths) == 0 {
		return
	}
	q.mu.Lock()
	atomic.AddInt64(&q.inFlight, int64(len(paths)))
	q.items = append(q.items, paths...)
	q.mu.Unlock()
	if len(paths) == 1 {
		q.cond.Signal()
	} else {
		q.cond.Broadcast()
	}
}

// pop blocks until a directory is available or the queue is drained (all
// pushed directories have been processed and none remain), in which case ok
// is false and every worker should exit.
func (q *dirQueue) pop() (path string, ok bool) {
	q.mu.Lock()
	defer q.mu.Unlock()
	for len(q.items) == 0 {
		if atomic.LoadInt64(&q.inFlight) == 0 || q.closed {
			return "", false
		}
		q.cond.Wait()
	}
	path = q.items[len(q.items)-1]
	q.items = q.items[:len(q.items)-1]
	return path, true
}

// done marks one directory as fully processed; must be called exactly once
// per pop, after any of its subdirectories have been pushed.
func (q *dirQueue) done() {
	if atomic.AddInt64(&q.inFlight, -1) == 0 {
		q.mu.Lock()
		q.cond.Broadcast() // wake every waiter so they can observe inFlight==0
		q.mu.Unlock()
	}
}

// closeOnErr wakes every blocked worker immediately, used to unwind the pool
// as soon as any worker hits a fatal error (context cancellation/timeout)
// instead of waiting for the queue to drain naturally.
func (q *dirQueue) closeOnErr() {
	q.mu.Lock()
	q.closed = true
	q.cond.Broadcast()
	q.mu.Unlock()
}

func (w *Walker) Scan(ctx context.Context, path string) (*interfaces.ScanResult, error) {
	scanCtx, cancel := context.WithTimeout(ctx, w.timeout)
	defer cancel()

	start := time.Now()

	queue := newDirQueue(path)
	workerStats := make([]*walkStats, w.maxWorkers)

	var progressMu sync.Mutex
	var filesScanned int64
	lastProgressUpdate := start
	reportProgress := func(currentPath string) {
		if w.progressCallback == nil {
			return
		}
		progressMu.Lock()
		defer progressMu.Unlock()
		if time.Since(lastProgressUpdate) >= time.Second {
			w.progressCallback(interfaces.ProgressUpdate{
				FilesScanned: int(atomic.LoadInt64(&filesScanned)),
				CurrentPath:  currentPath,
				ElapsedTime:  time.Since(start),
			})
			lastProgressUpdate = time.Now()
		}
	}

	var walkErr error
	var walkErrOnce sync.Once
	setErr := func(err error) {
		walkErrOnce.Do(func() {
			walkErr = err
			queue.closeOnErr()
		})
	}

	var wg sync.WaitGroup
	for i := 0; i < w.maxWorkers; i++ {
		wg.Add(1)
		stats := newWalkStats()
		workerStats[i] = stats
		go func(stats *walkStats) {
			defer wg.Done()
			for {
				select {
				case <-scanCtx.Done():
					setErr(scanCtx.Err())
					return
				default:
				}

				dir, ok := queue.pop()
				if !ok {
					return
				}

				entries, err := os.ReadDir(dir)
				if err != nil {
					// Permission errors, races with concurrent deletion,
					// etc: skip this directory, don't fail the whole scan.
					queue.done()
					continue
				}

				stats.dirCount++
				var subdirs []string
				for _, entry := range entries {
					entryPath := filepath.Join(dir, entry.Name())
					if entry.IsDir() {
						subdirs = append(subdirs, entryPath)
						continue
					}
					info, infoErr := entry.Info()
					if infoErr != nil {
						continue
					}
					stats.addFile(info)
					atomic.AddInt64(&filesScanned, 1)
					reportProgress(entryPath)
				}
				// Push every subdirectory found in this listing in one lock
				// acquisition, then mark this directory done — done() must
				// come after pushAll() so inFlight never touches zero while
				// this directory's children are still about to be added.
				queue.pushAll(subdirs)
				queue.done()
			}
		}(stats)
	}
	wg.Wait()

	duration := time.Since(start)

	if walkErr != nil {
		return nil, &models.ScanError{
			Method:  "walker",
			Path:    path,
			Code:    models.ErrorCodeScanCanceled,
			Message: "scan canceled due to timeout or context cancellation",
			Err:     walkErr,
			Context: map[string]any{
				"elapsed_time": duration,
			},
		}
	}

	// Merge every worker's stats into the final result. Hard-link
	// deduplication is only guaranteed correct within a single worker's own
	// inode set — a file hard-linked between two directories that happen to
	// be processed by different workers is counted once per worker that
	// sees it, not globally once. This is an accepted tradeoff for
	// lock-free per-file accounting: cross-subtree hard links are rare in
	// practice for the volumes this app scans (Docker volumes don't
	// typically link across top-level directories), and the common
	// same-directory/same-worker case stays correctly deduplicated.
	result := &interfaces.ScanResult{
		Method:         "walker",
		ScannedAt:      time.Now(),
		Duration:       duration,
		FilesystemType: "", // Will be filled by the scanner
	}
	for _, stats := range workerStats {
		result.TotalSize += stats.totalSize
		result.FileCount += int(stats.fileCount)
		result.DirectoryCount += int(stats.dirCount)
		if stats.largestFile > result.LargestFile {
			result.LargestFile = stats.largestFile
		}
	}

	return result, nil
}
