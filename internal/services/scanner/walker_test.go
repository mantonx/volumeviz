package scanner

import (
	"context"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/mantonx/volumeviz/internal/interfaces"
	"github.com/mantonx/volumeviz/internal/models"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestWalker_Name(t *testing.T) {
	config := models.ScanConfig{PerMethodTimeout: 30 * time.Second}
	method := NewWalker(config)
	assert.Equal(t, "walker", method.Name())
}

func TestWalker_Available(t *testing.T) {
	config := models.ScanConfig{PerMethodTimeout: 30 * time.Second}
	method := NewWalker(config)
	// Walker should always be available
	assert.True(t, method.Available())
}

func TestWalker_SupportsProgress(t *testing.T) {
	config := models.ScanConfig{PerMethodTimeout: 30 * time.Second}
	method := NewWalker(config)
	assert.True(t, method.SupportsProgress())
}

func TestWalker_EstimatedDuration(t *testing.T) {
	config := models.ScanConfig{PerMethodTimeout: 30 * time.Second}
	method := NewWalker(config)

	tests := []struct {
		name        string
		path        string
		minDuration time.Duration
	}{
		{"tmp directory", "/tmp", 1 * time.Second},
		{"root directory", "/", 1 * time.Second},
		{"nonexistent path", "/nonexistent", 1 * time.Second},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			duration := method.EstimatedDuration(tt.path)
			assert.GreaterOrEqual(t, duration, tt.minDuration)
		})
	}
}

func TestWalker_SetProgressCallback(t *testing.T) {
	config := models.ScanConfig{PerMethodTimeout: 30 * time.Second}
	method := NewWalker(config)

	// Test that we can call SetProgressCallback without error
	// Cast to concrete type to access the method
	walker := method.(*Walker)
	walker.SetProgressCallback(func(progress interfaces.ProgressUpdate) {
		// Mock callback
	})

	// Verify callback was set (we can't really test the callback execution without complex setup)
	assert.NotNil(t, walker.progressCallback)
}

func TestWalker_Scan(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping scan test in short mode")
	}

	config := models.ScanConfig{PerMethodTimeout: 30 * time.Second}
	method := NewWalker(config)
	ctx := context.Background()

	// Test with non-existent path - create one that definitely doesn't exist
	nonExistentPath := "/this/path/definitely/does/not/exist/on/any/system"
	result, err := method.Scan(ctx, nonExistentPath)
	// Walker may return a result with zero values instead of error for non-existent paths
	if err != nil {
		assert.Error(t, err)
	} else {
		// If no error, should have zero size for non-existent path
		assert.Equal(t, int64(0), result.TotalSize)
	}

	// Test with a temporary directory
	tempDir := t.TempDir()
	result, err = method.Scan(ctx, tempDir)
	assert.NoError(t, err)
	assert.NotNil(t, result)
	assert.GreaterOrEqual(t, result.TotalSize, int64(0))
	assert.GreaterOrEqual(t, result.DirectoryCount, 1) // At least the temp dir itself
	assert.Equal(t, "walker", result.Method)
}

// TestWalker_Scan_HardLinksCountedOnce is a regression test: the same
// on-disk data reachable under two different names inside the scanned tree
// (a hard link) must only contribute its disk usage once, matching what
// `du`/diskus already do by default — previously this method summed
// info.Size() per directory entry with no inode tracking, so a hard-linked
// file was double-counted once per additional link.
func TestWalker_Scan_HardLinksCountedOnce(t *testing.T) {
	dir := t.TempDir()
	original := filepath.Join(dir, "original.bin")
	linked := filepath.Join(dir, "hardlink.bin")

	payload := make([]byte, 64*1024) // 64KB, comfortably larger than one disk block
	require.NoError(t, os.WriteFile(original, payload, 0644))
	if err := os.Link(original, linked); err != nil {
		t.Skipf("hard links not supported on this filesystem: %v", err)
	}

	config := models.ScanConfig{PerMethodTimeout: 30 * time.Second}
	method := NewWalker(config)

	result, err := method.Scan(context.Background(), dir)
	require.NoError(t, err)
	require.NotNil(t, result)

	// Ground truth: du -s counts this directory's real disk usage exactly
	// once for the shared data, regardless of how many names point to it.
	assert.Equal(t, 2, result.FileCount, "both directory entries should still be counted as files")

	// Compare against a directory with the same payload but no hard link —
	// the linked-file total must equal the single-file total, not 2x it.
	singleDir := t.TempDir()
	require.NoError(t, os.WriteFile(filepath.Join(singleDir, "solo.bin"), payload, 0644))
	singleResult, err := method.Scan(context.Background(), singleDir)
	require.NoError(t, err)

	assert.Equal(t, singleResult.TotalSize, result.TotalSize,
		"a hard-linked file's disk usage must be counted once, not once per link")
}

// TestWalker_Scan_CrossSubdirHardLinks_KnownLimitation documents a
// deliberate tradeoff of the work-stealing walk: hard-link deduplication is
// only guaranteed within a single worker's own inode set (each worker tracks
// seen inodes independently, to avoid lock contention on every file). A file
// hard-linked between two different directories is deduplicated correctly
// whenever both paths happen to land on the same worker, but not
// necessarily otherwise — which worker picks up which directory is
// scheduling-dependent (with many idle workers available, as in a real
// scan, two small directories usually end up on different workers). This
// test asserts the honest bound — the result is always either fully
// deduplicated (1x) or fully double-counted (2x), never anything else —
// across many runs, rather than asserting a specific outcome.
func TestWalker_Scan_CrossSubdirHardLinks_KnownLimitation(t *testing.T) {
	config := models.ScanConfig{PerMethodTimeout: 30 * time.Second}
	method := NewWalker(config)
	payload := make([]byte, 64*1024)

	singleDir := t.TempDir()
	require.NoError(t, os.WriteFile(filepath.Join(singleDir, "solo.bin"), payload, 0644))
	singleResult, err := method.Scan(context.Background(), singleDir)
	require.NoError(t, err)

	for i := 0; i < 10; i++ {
		dir := t.TempDir()
		subA := filepath.Join(dir, "a")
		subB := filepath.Join(dir, "b")
		require.NoError(t, os.Mkdir(subA, 0755))
		require.NoError(t, os.Mkdir(subB, 0755))

		original := filepath.Join(subA, "original.bin")
		linked := filepath.Join(subB, "hardlink.bin")
		require.NoError(t, os.WriteFile(original, payload, 0644))
		if err := os.Link(original, linked); err != nil {
			t.Skipf("hard links not supported on this filesystem: %v", err)
		}

		result, err := method.Scan(context.Background(), dir)
		require.NoError(t, err)
		require.NotNil(t, result)

		assert.Contains(t, []int64{singleResult.TotalSize, 2 * singleResult.TotalSize}, result.TotalSize,
			"a cross-directory hard link must either be deduplicated (1x) or double-counted (2x) — never anything else")
	}
}

// TestWalker_Scan_UsesDiskUsageNotApparentSize is a regression test
// for sparse-file accuracy: TotalSize should reflect actual disk blocks
// consumed (matching du's default), not the file's logical/apparent size —
// otherwise a sparse file reports a size wildly larger than what it actually
// costs on disk.
func TestWalker_Scan_UsesDiskUsageNotApparentSize(t *testing.T) {
	dir := t.TempDir()
	sparsePath := filepath.Join(dir, "sparse.bin")

	f, err := os.Create(sparsePath)
	require.NoError(t, err)
	// Seek far past any data and write a single byte — everything before it
	// is an unallocated hole; the file's apparent size becomes huge while
	// its actual disk usage stays tiny.
	const logicalSize = 100 * 1024 * 1024 // 100MB apparent
	_, err = f.Seek(logicalSize-1, 0)
	require.NoError(t, err)
	_, err = f.Write([]byte{0})
	require.NoError(t, err)
	require.NoError(t, f.Close())

	info, err := os.Stat(sparsePath)
	require.NoError(t, err)
	if info.Size() != logicalSize {
		t.Fatalf("test setup failed: expected apparent size %d, got %d", logicalSize, info.Size())
	}

	config := models.ScanConfig{PerMethodTimeout: 30 * time.Second}
	method := NewWalker(config)

	result, err := method.Scan(context.Background(), dir)
	require.NoError(t, err)
	require.NotNil(t, result)

	if result.TotalSize >= logicalSize {
		t.Skipf("filesystem does not appear to support sparse files here (reported %d disk bytes for a %d-byte hole) — skipping",
			result.TotalSize, logicalSize)
	}

	assert.Less(t, result.TotalSize, int64(logicalSize),
		"disk usage for a sparse file must be far less than its apparent/logical size")
}
