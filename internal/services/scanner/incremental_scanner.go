package scanner

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io/fs"
	"log"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"github.com/mantonx/volumeviz/internal/repo"
	"github.com/mantonx/volumeviz/internal/store"
)

// IncrementalScanner handles incremental volume scanning using snapshots
type IncrementalScanner struct {
	store store.Store
}

// NewIncrementalScanner creates a new incremental scanner
func NewIncrementalScanner(store store.Store) *IncrementalScanner {
	return &IncrementalScanner{
		store: store,
	}
}

// ShouldUseIncrementalScan determines if incremental scanning can be used
func (s *IncrementalScanner) ShouldUseIncrementalScan(ctx context.Context, volumeID string) (bool, *repo.VolumeSnapshot, error) {
	// Get the latest snapshot for this volume
	snapshot, err := s.store.Snapshots().GetLatestSnapshot(ctx, volumeID)
	if err != nil {
		// If no snapshot exists, we can't do incremental scan
		return false, nil, nil
	}

	// Check if the snapshot is recent enough (within last 7 days)
	if time.Since(snapshot.SnapshotTime) > 7*24*time.Hour {
		log.Printf("Snapshot too old for incremental scan, performing full scan (volume_id=%s, snapshot_time=%s)",
			volumeID, snapshot.SnapshotTime.Format(time.RFC3339))
		return false, snapshot, nil
	}

	return true, snapshot, nil
}

// IncrementalScanResult is the outcome of ScanAndSnapshot: the fresh size totals (usable
// directly as a scan result) plus everything needed to persist a new
// snapshot and report what changed, computed from a single filesystem walk.
type IncrementalScanResult struct {
	TotalSize    int64
	FileCount    int64
	FolderCount  int64
	RootMtime    time.Time
	Changes      *ChangeSet
	DirSnapshots []*repo.DirectorySnapshot
}

// ScanAndSnapshot walks a volume exactly once, computing its current total
// size while simultaneously detecting per-directory changes against
// prevSnapshot (if any) and building the directory snapshots CreateSnapshot
// needs to persist. This replaces what used to be two separate walks
// (DetectChanges, then CreateSnapshot's own walk) — each of which also read
// every directory's entries twice (once for size/file counts, again inside
// computeDirectoryHash) — with one walk that reads each directory's entries
// once.
//
// prevSnapshot may be nil, in which case every directory is reported as
// added (this is the first-ever scan for the volume) and sizes are simply
// the freshly-measured totals — equivalent to a full scan.
func (s *IncrementalScanner) ScanAndSnapshot(ctx context.Context, volumeID, volumePath string, prevSnapshot *repo.VolumeSnapshot) (*IncrementalScanResult, error) {
	prevDirMap := make(map[string]*repo.DirectorySnapshot)
	if prevSnapshot != nil {
		prevDirSnapshots, err := s.store.Snapshots().GetDirectorySnapshots(ctx, prevSnapshot.ID)
		if err != nil {
			return nil, fmt.Errorf("failed to get previous directory snapshots: %w", err)
		}
		for _, ds := range prevDirSnapshots {
			prevDirMap[ds.DirPath] = ds
		}
	}

	rootInfo, err := os.Stat(volumePath)
	if err != nil {
		return nil, fmt.Errorf("failed to stat volume root: %w", err)
	}

	changeSet := &ChangeSet{
		VolumeID:       volumeID,
		ChangedPaths:   make([]string, 0),
		AddedPaths:     make([]string, 0),
		DeletedPaths:   make([]string, 0),
		UnchangedPaths: make([]string, 0),
	}
	if prevSnapshot != nil {
		changeSet.PrevSnapshotID = prevSnapshot.ID
	}

	var totalSize, fileCount, folderCount int64
	dirSnapshots := make([]*repo.DirectorySnapshot, 0)

	err = filepath.WalkDir(volumePath, func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			log.Printf("Error walking directory (path=%s): %v", path, err)
			return nil // Continue walking
		}

		if !d.IsDir() {
			info, infoErr := d.Info()
			if infoErr == nil {
				fileCount++
				totalSize += info.Size()
			}
			return nil
		}

		folderCount++

		relPath, err := filepath.Rel(volumePath, path)
		if err != nil {
			return nil
		}
		if relPath == "." {
			relPath = "/"
		} else {
			relPath = "/" + filepath.ToSlash(relPath)
		}

		info, err := d.Info()
		if err != nil {
			log.Printf("Error getting directory info (path=%s): %v", path, err)
			return nil
		}

		// Read this directory's entries exactly once, using them for both
		// the size/file-count tally and the content hash below — the
		// previous implementation called os.ReadDir a second time inside
		// computeDirectoryHash for the same path.
		entries, err := os.ReadDir(path)
		if err != nil {
			log.Printf("Error reading directory (path=%s): %v", path, err)
			return nil
		}

		var dirFileCount, dirSubdirCount int32
		var dirSize int64
		for _, entry := range entries {
			if entry.IsDir() {
				dirSubdirCount++
			} else {
				dirFileCount++
				if entryInfo, err := entry.Info(); err == nil {
					dirSize += entryInfo.Size()
				}
			}
		}
		contentHash := hashDirectoryEntries(entries)

		dirSnapshots = append(dirSnapshots, &repo.DirectorySnapshot{
			VolumeID:    volumeID,
			DirPath:     relPath,
			DirMtime:    info.ModTime(),
			DirSize:     dirSize,
			FileCount:   dirFileCount,
			SubdirCount: dirSubdirCount,
			ContentHash: contentHash,
		})

		// Classify this directory against the previous snapshot using the
		// data just gathered — this is what DetectChanges used to do in its
		// own separate walk.
		if prevDir, existed := prevDirMap[relPath]; !existed {
			changeSet.AddedPaths = append(changeSet.AddedPaths, relPath)
			changeSet.ChangedPaths = append(changeSet.ChangedPaths, relPath)
		} else {
			if info.ModTime().After(prevDir.DirMtime) || contentHash != prevDir.ContentHash {
				changeSet.ChangedPaths = append(changeSet.ChangedPaths, relPath)
			} else {
				changeSet.UnchangedPaths = append(changeSet.UnchangedPaths, relPath)
			}
			delete(prevDirMap, relPath)
		}

		return nil
	})
	if err != nil {
		return nil, fmt.Errorf("failed to walk volume: %w", err)
	}

	// Anything left in prevDirMap no longer exists.
	for path := range prevDirMap {
		changeSet.DeletedPaths = append(changeSet.DeletedPaths, path)
		changeSet.ChangedPaths = append(changeSet.ChangedPaths, path)
	}

	log.Printf("Incremental scan complete (volume_id=%s, size=%d, files=%d, folders=%d, changed=%d, added=%d, deleted=%d, unchanged=%d)",
		volumeID, totalSize, fileCount, folderCount,
		len(changeSet.ChangedPaths), len(changeSet.AddedPaths), len(changeSet.DeletedPaths), len(changeSet.UnchangedPaths))

	return &IncrementalScanResult{
		TotalSize:    totalSize,
		FileCount:    fileCount,
		FolderCount:  folderCount,
		RootMtime:    rootInfo.ModTime(),
		Changes:      changeSet,
		DirSnapshots: dirSnapshots,
	}, nil
}

// CreateSnapshot persists the result of a prior ScanAndSnapshot call as a new
// snapshot, so future scans have something to compare against. Takes
// already-computed directory snapshots rather than walking the filesystem
// again.
func (s *IncrementalScanner) CreateSnapshot(ctx context.Context, volumeID, scanID string, scanMethod string, scanDuration time.Duration, result *IncrementalScanResult) (*repo.VolumeSnapshot, error) {
	scanDurationMS := scanDuration.Milliseconds()
	rootMtime := result.RootMtime
	snapshot := repo.VolumeSnapshot{
		VolumeID:       volumeID,
		ScanID:         scanID,
		SnapshotTime:   time.Now(),
		ScanMethod:     scanMethod,
		TotalSize:      result.TotalSize,
		FileCount:      result.FileCount,
		FolderCount:    result.FolderCount,
		RootMtime:      &rootMtime,
		ScanDurationMS: &scanDurationMS,
	}

	var createdSnapshot *repo.VolumeSnapshot
	err := s.store.WithTx(ctx, func(tx store.TxStore) error {
		created, err := tx.Snapshots().CreateSnapshot(ctx, snapshot)
		if err != nil {
			return fmt.Errorf("failed to create snapshot: %w", err)
		}
		createdSnapshot = created

		for _, ds := range result.DirSnapshots {
			ds.SnapshotID = created.ID
			if _, err := tx.Snapshots().CreateDirectorySnapshot(ctx, *ds); err != nil {
				return fmt.Errorf("failed to create directory snapshot: %w", err)
			}
		}

		return nil
	})
	if err != nil {
		return nil, err
	}

	log.Printf("Snapshot created successfully (volume_id=%s, scan_id=%s, snapshot_id=%d, dir_snapshots=%d, scan_duration_ms=%d)",
		volumeID, scanID, createdSnapshot.ID, len(result.DirSnapshots), scanDurationMS)

	return createdSnapshot, nil
}

// hashDirectoryEntries computes a hash of a directory's already-read entries
// (filenames, sizes, mtimes), letting callers reuse a single os.ReadDir
// rather than reading the same directory twice.
func hashDirectoryEntries(entries []os.DirEntry) string {
	sorted := make([]os.DirEntry, len(entries))
	copy(sorted, entries)
	sort.Slice(sorted, func(i, j int) bool {
		return sorted[i].Name() < sorted[j].Name()
	})

	var hashInput strings.Builder
	for _, entry := range sorted {
		info, err := entry.Info()
		if err != nil {
			continue
		}
		hashInput.WriteString(entry.Name())
		hashInput.WriteString("|")
		hashInput.WriteString(fmt.Sprintf("%d", info.Size()))
		hashInput.WriteString("|")
		hashInput.WriteString(info.ModTime().Format(time.RFC3339Nano))
		hashInput.WriteString("\n")
	}

	hash := sha256.Sum256([]byte(hashInput.String()))
	return hex.EncodeToString(hash[:])
}

// ChangeSet represents detected changes in a volume
type ChangeSet struct {
	VolumeID       string
	PrevSnapshotID int64
	ChangedPaths   []string // All paths that changed (added + deleted + modified)
	AddedPaths     []string // Newly added directories
	DeletedPaths   []string // Deleted directories
	UnchangedPaths []string // Directories with no changes
}

// GetAffectedPaths returns paths that need to be rescanned
// This includes changed paths and their parent directories
func (cs *ChangeSet) GetAffectedPaths() []string {
	affectedMap := make(map[string]bool)

	for _, path := range cs.ChangedPaths {
		// Add the changed path
		affectedMap[path] = true

		// Add all parent directories up to root
		parts := strings.Split(strings.Trim(path, "/"), "/")
		for i := range parts {
			parentPath := "/" + strings.Join(parts[:i+1], "/")
			if parentPath != "/" {
				affectedMap[parentPath] = true
			}
		}
	}

	// Convert map to slice
	affected := make([]string, 0, len(affectedMap))
	for path := range affectedMap {
		affected = append(affected, path)
	}

	return affected
}
