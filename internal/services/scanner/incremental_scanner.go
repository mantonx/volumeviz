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

// DetectChanges identifies directories that have changed since the last snapshot
func (s *IncrementalScanner) DetectChanges(ctx context.Context, volumeID, volumePath string, prevSnapshot *repo.VolumeSnapshot) (*ChangeSet, error) {
	changeSet := &ChangeSet{
		VolumeID:       volumeID,
		PrevSnapshotID: prevSnapshot.ID,
		ChangedPaths:   make([]string, 0),
		AddedPaths:     make([]string, 0),
		DeletedPaths:   make([]string, 0),
		UnchangedPaths: make([]string, 0),
	}

	// Get directory snapshots from previous scan
	prevDirSnapshots, err := s.store.Snapshots().GetDirectorySnapshots(ctx, prevSnapshot.ID)
	if err != nil {
		return nil, fmt.Errorf("failed to get previous directory snapshots: %w", err)
	}

	// Create a map of previous directory states
	prevDirMap := make(map[string]*repo.DirectorySnapshot)
	for _, ds := range prevDirSnapshots {
		prevDirMap[ds.DirPath] = ds
	}

	// Walk the current filesystem
	err = filepath.WalkDir(volumePath, func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			log.Printf("Error walking directory (path=%s): %v", path, err)
			return nil // Continue walking
		}

		if !d.IsDir() {
			return nil // We only track directories for change detection
		}

		// Get relative path from volume root
		relPath, err := filepath.Rel(volumePath, path)
		if err != nil {
			return nil
		}
		if relPath == "." {
			relPath = "/"
		} else {
			relPath = "/" + filepath.ToSlash(relPath)
		}

		// Get current directory info
		info, err := d.Info()
		if err != nil {
			log.Printf("Error getting directory info (path=%s): %v", path, err)
			return nil
		}

		currentMtime := info.ModTime()

		// Check if directory existed in previous snapshot
		prevDir, existed := prevDirMap[relPath]
		if !existed {
			// New directory
			changeSet.AddedPaths = append(changeSet.AddedPaths, relPath)
			changeSet.ChangedPaths = append(changeSet.ChangedPaths, relPath)
			return nil
		}

		// Directory existed - check if it changed
		if currentMtime.After(prevDir.DirMtime) {
			// mtime changed - directory was modified
			changeSet.ChangedPaths = append(changeSet.ChangedPaths, relPath)
		} else {
			// mtime unchanged - verify with content hash
			currentHash, err := s.computeDirectoryHash(path)
			if err != nil {
				log.Printf("Error computing directory hash (path=%s): %v", path, err)
				// If we can't compute hash, assume changed to be safe
				changeSet.ChangedPaths = append(changeSet.ChangedPaths, relPath)
				return nil
			}

			if currentHash != prevDir.ContentHash {
				// Content changed even though mtime didn't
				changeSet.ChangedPaths = append(changeSet.ChangedPaths, relPath)
			} else {
				// Truly unchanged
				changeSet.UnchangedPaths = append(changeSet.UnchangedPaths, relPath)
			}
		}

		// Remove from map to track deletions
		delete(prevDirMap, relPath)

		return nil
	})

	if err != nil {
		return nil, fmt.Errorf("failed to walk volume: %w", err)
	}

	// Any directories remaining in prevDirMap were deleted
	for path := range prevDirMap {
		changeSet.DeletedPaths = append(changeSet.DeletedPaths, path)
		changeSet.ChangedPaths = append(changeSet.ChangedPaths, path)
	}

	log.Printf("Change detection complete (volume_id=%s, changed=%d, added=%d, deleted=%d, unchanged=%d)",
		volumeID, len(changeSet.ChangedPaths), len(changeSet.AddedPaths),
		len(changeSet.DeletedPaths), len(changeSet.UnchangedPaths))

	return changeSet, nil
}

// CreateSnapshot creates a new snapshot of the current volume state
func (s *IncrementalScanner) CreateSnapshot(ctx context.Context, volumeID, scanID, volumePath string, scanMethod string) (*repo.VolumeSnapshot, error) {
	startTime := time.Now()

	// Gather volume statistics
	var totalSize int64
	var fileCount int64
	var folderCount int64
	var rootMtime time.Time

	// Get root directory mtime
	rootInfo, err := os.Stat(volumePath)
	if err != nil {
		return nil, fmt.Errorf("failed to stat volume root: %w", err)
	}
	rootMtime = rootInfo.ModTime()

	// Walk volume to gather stats
	dirSnapshots := make([]*repo.DirectorySnapshot, 0)

	err = filepath.WalkDir(volumePath, func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			log.Printf("Error walking directory (path=%s): %v", path, err)
			return nil
		}

		info, err := d.Info()
		if err != nil {
			return nil
		}

		if d.IsDir() {
			folderCount++

			// Create directory snapshot
			relPath, err := filepath.Rel(volumePath, path)
			if err != nil {
				return nil
			}
			if relPath == "." {
				relPath = "/"
			} else {
				relPath = "/" + filepath.ToSlash(relPath)
			}

			// Count files and subdirs in this directory
			entries, err := os.ReadDir(path)
			if err != nil {
				log.Printf("Error reading directory (path=%s): %v", path, err)
				return nil
			}

			var dirFileCount int32
			var dirSubdirCount int32
			var dirSize int64

			for _, entry := range entries {
				if entry.IsDir() {
					dirSubdirCount++
				} else {
					dirFileCount++
					entryInfo, err := entry.Info()
					if err == nil {
						dirSize += entryInfo.Size()
					}
				}
			}

			// Compute content hash
			contentHash, err := s.computeDirectoryHash(path)
			if err != nil {
				contentHash = ""
			}

			dirSnapshots = append(dirSnapshots, &repo.DirectorySnapshot{
				VolumeID:    volumeID,
				DirPath:     relPath,
				DirMtime:    info.ModTime(),
				DirSize:     dirSize,
				FileCount:   dirFileCount,
				SubdirCount: dirSubdirCount,
				ContentHash: contentHash,
			})

		} else {
			fileCount++
			totalSize += info.Size()
		}

		return nil
	})

	if err != nil {
		return nil, fmt.Errorf("failed to walk volume: %w", err)
	}

	// Create volume snapshot
	scanDuration := time.Since(startTime).Milliseconds()
	snapshot := repo.VolumeSnapshot{
		VolumeID:       volumeID,
		ScanID:         scanID,
		SnapshotTime:   time.Now(),
		ScanMethod:     scanMethod,
		TotalSize:      totalSize,
		FileCount:      fileCount,
		FolderCount:    folderCount,
		RootMtime:      &rootMtime,
		ScanDurationMS: &scanDuration,
	}

	// Save snapshot and directory snapshots in a transaction
	var createdSnapshot *repo.VolumeSnapshot
	err = s.store.WithTx(ctx, func(tx store.TxStore) error {
		// Create volume snapshot
		created, err := tx.Snapshots().CreateSnapshot(ctx, snapshot)
		if err != nil {
			return fmt.Errorf("failed to create snapshot: %w", err)
		}
		createdSnapshot = created

		// Create directory snapshots
		for _, ds := range dirSnapshots {
			ds.SnapshotID = created.ID
			_, err := tx.Snapshots().CreateDirectorySnapshot(ctx, *ds)
			if err != nil {
				return fmt.Errorf("failed to create directory snapshot: %w", err)
			}
		}

		return nil
	})

	if err != nil {
		return nil, err
	}

	log.Printf("Snapshot created successfully (volume_id=%s, scan_id=%s, snapshot_id=%d, dir_snapshots=%d, scan_duration_ms=%d)",
		volumeID, scanID, createdSnapshot.ID, len(dirSnapshots), scanDuration)

	return createdSnapshot, nil
}

// computeDirectoryHash computes a hash of directory contents (filenames and sizes)
// This allows detection of changes even when mtime doesn't change
func (s *IncrementalScanner) computeDirectoryHash(dirPath string) (string, error) {
	entries, err := os.ReadDir(dirPath)
	if err != nil {
		return "", err
	}

	// Sort entries for consistent hashing
	sort.Slice(entries, func(i, j int) bool {
		return entries[i].Name() < entries[j].Name()
	})

	// Build hash input
	var hashInput strings.Builder
	for _, entry := range entries {
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

	// Compute SHA256 hash
	hash := sha256.Sum256([]byte(hashInput.String()))
	return hex.EncodeToString(hash[:]), nil
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
