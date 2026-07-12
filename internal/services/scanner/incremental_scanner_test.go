package scanner

import (
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestHashDirectoryEntries_Deterministic verifies the hash doesn't depend on
// directory-read order — entries are sorted before hashing, so change
// detection can't false-positive just because os.ReadDir returned entries in
// a different order between two scans of the same, unchanged directory.
func TestHashDirectoryEntries_Deterministic(t *testing.T) {
	dir := t.TempDir()
	require.NoError(t, os.WriteFile(filepath.Join(dir, "b.txt"), []byte("hello"), 0644))
	require.NoError(t, os.WriteFile(filepath.Join(dir, "a.txt"), []byte("world"), 0644))

	entries1, err := os.ReadDir(dir)
	require.NoError(t, err)
	hash1 := hashDirectoryEntries(entries1)

	// Reverse the slice to simulate a different read order.
	entries2 := make([]os.DirEntry, len(entries1))
	for i, e := range entries1 {
		entries2[len(entries1)-1-i] = e
	}
	hash2 := hashDirectoryEntries(entries2)

	assert.Equal(t, hash1, hash2, "hash must not depend on entry order")
}

// TestHashDirectoryEntries_ChangesWithContent verifies the hash actually
// reflects file content differences (size/mtime), which is the whole point
// of the hash: catching changes a directory mtime alone might miss.
func TestHashDirectoryEntries_ChangesWithContent(t *testing.T) {
	dir := t.TempDir()
	require.NoError(t, os.WriteFile(filepath.Join(dir, "f.txt"), []byte("hello"), 0644))

	entriesBefore, err := os.ReadDir(dir)
	require.NoError(t, err)
	hashBefore := hashDirectoryEntries(entriesBefore)

	// Overwrite with different-sized content.
	require.NoError(t, os.WriteFile(filepath.Join(dir, "f.txt"), []byte("hello world, much longer now"), 0644))

	entriesAfter, err := os.ReadDir(dir)
	require.NoError(t, err)
	hashAfter := hashDirectoryEntries(entriesAfter)

	assert.NotEqual(t, hashBefore, hashAfter, "hash must change when file content size changes")
}

// TestHashDirectoryEntries_Empty confirms an empty directory hashes
// consistently rather than erroring or panicking.
func TestHashDirectoryEntries_Empty(t *testing.T) {
	dir := t.TempDir()
	entries, err := os.ReadDir(dir)
	require.NoError(t, err)

	hash1 := hashDirectoryEntries(entries)
	hash2 := hashDirectoryEntries(entries)
	assert.Equal(t, hash1, hash2)
	assert.NotEmpty(t, hash1)
}

// TestChangeSet_GetAffectedPaths_IncludesParents verifies a changed leaf
// directory pulls its ancestors into the affected set too — this is what
// lets a caller know "everything from here up to root needs attention",
// not just the exact path that changed.
func TestChangeSet_GetAffectedPaths_IncludesParents(t *testing.T) {
	cs := &ChangeSet{
		ChangedPaths: []string{"/a/b/c"},
	}

	affected := cs.GetAffectedPaths()

	assert.Contains(t, affected, "/a/b/c")
	assert.Contains(t, affected, "/a/b")
	assert.Contains(t, affected, "/a")
}

// TestChangeSet_GetAffectedPaths_Deduplicates verifies overlapping changed
// paths don't produce duplicate ancestors in the result.
func TestChangeSet_GetAffectedPaths_Deduplicates(t *testing.T) {
	cs := &ChangeSet{
		ChangedPaths: []string{"/a/b/c", "/a/b/d"},
	}

	affected := cs.GetAffectedPaths()

	seen := make(map[string]int)
	for _, p := range affected {
		seen[p]++
	}
	for path, count := range seen {
		assert.Equal(t, 1, count, "path %q should appear exactly once", path)
	}
	assert.Contains(t, affected, "/a/b") // shared ancestor, only once
}

// TestNewIncrementalScanner confirms basic construction.
func TestNewIncrementalScanner(t *testing.T) {
	s := NewIncrementalScanner(nil)
	require.NotNil(t, s)
}

// TestShouldUseIncrementalScan_NilStore_RequiresRealStore documents that a
// nil store.Store panics on s.store.Snapshots() rather than degrading
// gracefully — this is why ScanVolume only ever constructs an
// IncrementalScanner when a real store is available (see
// NewVolumeScannerWithIndexing) and always checks vs.incrementalScanner != nil
// before calling into it.
func TestShouldUseIncrementalScan_NilStore_RequiresRealStore(t *testing.T) {
	s := NewIncrementalScanner(nil)
	assert.Panics(t, func() {
		_, _, _ = s.ShouldUseIncrementalScan(nil, "volume-id") //nolint:staticcheck
	})
}

func TestIncrementalScanResult_Fields(t *testing.T) {
	result := &IncrementalScanResult{
		TotalSize:   100,
		FileCount:   5,
		FolderCount: 2,
		RootMtime:   time.Now(),
		Changes: &ChangeSet{
			ChangedPaths: []string{"/a"},
		},
	}

	assert.Equal(t, int64(100), result.TotalSize)
	assert.Equal(t, int64(5), result.FileCount)
	assert.Equal(t, int64(2), result.FolderCount)
	assert.Len(t, result.Changes.ChangedPaths, 1)
}
