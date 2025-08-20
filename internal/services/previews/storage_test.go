package previews

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestNewStorageManager(t *testing.T) {
	tests := []struct {
		name    string
		rootDir string
		wantErr bool
	}{
		{
			name:    "valid directory",
			rootDir: t.TempDir(),
			wantErr: false,
		},
		{
			name:    "new directory creation",
			rootDir: filepath.Join(t.TempDir(), "new", "path"),
			wantErr: false,
		},
		{
			name:    "invalid path",
			rootDir: "/root/invalid/path",
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			sm, err := NewStorageManager(tt.rootDir)
			if tt.wantErr {
				assert.Error(t, err)
				assert.Nil(t, sm)
			} else {
				assert.NoError(t, err)
				assert.NotNil(t, sm)
				assert.Equal(t, tt.rootDir, sm.rootDir)
				
				// Verify directory was created
				_, err := os.Stat(tt.rootDir)
				assert.NoError(t, err)
			}
		})
	}
}

func TestStorageManager_GenerateStorageKey(t *testing.T) {
	sm, err := NewStorageManager(t.TempDir())
	require.NoError(t, err)

	tests := []struct {
		name         string
		sourceHash   string
		previewType  PreviewType
		size         PreviewSize
		contentHash  string
		expectedPath string
	}{
		{
			name:         "thumbnail medium",
			sourceHash:   "abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
			previewType:  PreviewTypeThumbnail,
			size:         PreviewSizeMedium,
			contentHash:  "1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef12",
			expectedPath: "ab/cd/ef1234567890abcdef1234567890abcdef1234567890abcdef1234567890/thumbnail/medium/12/34/567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef12.webp",
		},
		{
			name:         "poster large",
			sourceHash:   "fedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321",
			previewType:  PreviewTypePoster,
			size:         PreviewSizeLarge,
			contentHash:  "abcd1234efgh5678ijkl9012mnop3456qrst7890uvwx1234yz56789012abcdef",
			expectedPath: "fe/dc/ba0987654321fedcba0987654321fedcba0987654321fedcba0987654321/poster/large/ab/cd/1234efgh5678ijkl9012mnop3456qrst7890uvwx1234yz56789012abcdef.webp",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			key := sm.GenerateStorageKey(tt.sourceHash, tt.previewType, tt.size, tt.contentHash)
			assert.Equal(t, tt.expectedPath, key)
		})
	}
}

func TestStorageManager_GetFullPath(t *testing.T) {
	rootDir := t.TempDir()
	sm, err := NewStorageManager(rootDir)
	require.NoError(t, err)

	storageKey := "ab/cd/test.webp"
	expectedPath := filepath.Join(rootDir, storageKey)
	
	fullPath := sm.GetFullPath(storageKey)
	assert.Equal(t, expectedPath, fullPath)
}

func TestStorageManager_Store(t *testing.T) {
	sm, err := NewStorageManager(t.TempDir())
	require.NoError(t, err)

	testData := []byte("test preview data")
	sourceHash := "abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890"
	previewType := PreviewTypeThumbnail
	size := PreviewSizeMedium

	// First store should create new file
	storageKey, contentHash, err := sm.Store(testData, sourceHash, previewType, size)
	assert.NoError(t, err)
	assert.NotEmpty(t, storageKey)
	assert.NotEmpty(t, contentHash)
	assert.Len(t, contentHash, 64) // SHA256 hex string

	// Verify file was created
	fullPath := sm.GetFullPath(storageKey)
	_, err = os.Stat(fullPath)
	assert.NoError(t, err)

	// Verify file content
	storedData, err := os.ReadFile(fullPath)
	assert.NoError(t, err)
	assert.Equal(t, testData, storedData)

	// Second store with same data should detect duplicate
	storageKey2, contentHash2, err := sm.Store(testData, sourceHash, previewType, size)
	assert.NoError(t, err)
	assert.Equal(t, storageKey, storageKey2)
	assert.Equal(t, contentHash, contentHash2)
}

func TestStorageManager_Retrieve(t *testing.T) {
	sm, err := NewStorageManager(t.TempDir())
	require.NoError(t, err)

	testData := []byte("test preview data for retrieval")
	sourceHash := "abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890"

	// Store data first
	storageKey, _, err := sm.Store(testData, sourceHash, PreviewTypeThumbnail, PreviewSizeMedium)
	require.NoError(t, err)

	// Retrieve data
	retrievedData, err := sm.Retrieve(storageKey)
	assert.NoError(t, err)
	assert.Equal(t, testData, retrievedData)

	// Test with non-existent key
	_, err = sm.Retrieve("nonexistent/key.webp")
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "preview not found")
}

func TestStorageManager_StreamTo(t *testing.T) {
	sm, err := NewStorageManager(t.TempDir())
	require.NoError(t, err)

	testData := []byte("test preview data for streaming")
	sourceHash := "abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890"

	// Store data first
	storageKey, _, err := sm.Store(testData, sourceHash, PreviewTypeThumbnail, PreviewSizeMedium)
	require.NoError(t, err)

	// Stream to buffer
	var buf strings.Builder
	err = sm.StreamTo(storageKey, &buf)
	assert.NoError(t, err)
	assert.Equal(t, string(testData), buf.String())

	// Test with non-existent key
	var buf2 strings.Builder
	err = sm.StreamTo("nonexistent/key.webp", &buf2)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "preview not found")
}

func TestStorageManager_Exists(t *testing.T) {
	sm, err := NewStorageManager(t.TempDir())
	require.NoError(t, err)

	testData := []byte("test preview data for existence check")
	sourceHash := "abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890"

	// Should not exist initially
	storageKey := sm.GenerateStorageKey(sourceHash, PreviewTypeThumbnail, PreviewSizeMedium, "somehash")
	assert.False(t, sm.Exists(storageKey))

	// Store data
	actualKey, _, err := sm.Store(testData, sourceHash, PreviewTypeThumbnail, PreviewSizeMedium)
	require.NoError(t, err)

	// Should exist now
	assert.True(t, sm.Exists(actualKey))
}

func TestStorageManager_GetETag(t *testing.T) {
	sm, err := NewStorageManager(t.TempDir())
	require.NoError(t, err)

	tests := []struct {
		name       string
		storageKey string
		wantPrefix string
	}{
		{
			name:       "valid storage key",
			storageKey: "ab/cd/ef1234567890/thumbnail/medium/12/34/567890abcdef.webp",
			wantPrefix: `W/"`,
		},
		{
			name:       "fallback for invalid key",
			storageKey: "invalid.webp",
			wantPrefix: `W/"`,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			etag := sm.GetETag(tt.storageKey)
			assert.NotEmpty(t, etag)
			assert.True(t, strings.HasPrefix(etag, tt.wantPrefix))
			assert.True(t, strings.HasSuffix(etag, `"`))
		})
	}
}

func TestStorageManager_Delete(t *testing.T) {
	sm, err := NewStorageManager(t.TempDir())
	require.NoError(t, err)

	testData := []byte("test preview data for deletion")
	sourceHash := "abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890"

	// Store data first
	storageKey, _, err := sm.Store(testData, sourceHash, PreviewTypeThumbnail, PreviewSizeMedium)
	require.NoError(t, err)

	// Verify it exists
	assert.True(t, sm.Exists(storageKey))

	// Delete it
	err = sm.Delete(storageKey)
	assert.NoError(t, err)

	// Verify it's gone
	assert.False(t, sm.Exists(storageKey))

	// Deleting non-existent file should not error
	err = sm.Delete("nonexistent/key.webp")
	assert.NoError(t, err)
}

func TestStorageManager_CleanupOldPreviews(t *testing.T) {
	sm, err := NewStorageManager(t.TempDir())
	require.NoError(t, err)

	testData := []byte("test preview data for cleanup")
	sourceHash := "abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890"

	// Store some data
	storageKey1, _, err := sm.Store(testData, sourceHash+"1", PreviewTypeThumbnail, PreviewSizeMedium)
	require.NoError(t, err)
	
	storageKey2, _, err := sm.Store(testData, sourceHash+"2", PreviewTypeThumbnail, PreviewSizeMedium)
	require.NoError(t, err)

	// Make one file old by changing its modification time
	fullPath1 := sm.GetFullPath(storageKey1)
	oldTime := time.Now().Add(-2 * time.Hour)
	err = os.Chtimes(fullPath1, oldTime, oldTime)
	require.NoError(t, err)

	// Cleanup files older than 1 hour
	count, err := sm.CleanupOldPreviews(1 * time.Hour)
	assert.NoError(t, err)
	assert.Equal(t, 1, count) // Should have cleaned up 1 file

	// Verify the old file is gone and new file remains
	assert.False(t, sm.Exists(storageKey1))
	assert.True(t, sm.Exists(storageKey2))
}

func TestStorageManager_GetStorageSize(t *testing.T) {
	sm, err := NewStorageManager(t.TempDir())
	require.NoError(t, err)

	// Initially should be 0
	size, err := sm.GetStorageSize()
	assert.NoError(t, err)
	assert.Equal(t, int64(0), size)

	testData := []byte("test preview data for size calculation")
	sourceHash := "abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890"

	// Store some data
	_, _, err = sm.Store(testData, sourceHash, PreviewTypeThumbnail, PreviewSizeMedium)
	require.NoError(t, err)

	// Size should now be > 0
	size, err = sm.GetStorageSize()
	assert.NoError(t, err)
	assert.Greater(t, size, int64(0))
	assert.Equal(t, int64(len(testData)), size)
}

func TestStorageManager_PruneEmptyDirectories(t *testing.T) {
	sm, err := NewStorageManager(t.TempDir())
	require.NoError(t, err)

	// Create some nested directories manually
	testDir := filepath.Join(sm.rootDir, "test", "empty", "dirs")
	err = os.MkdirAll(testDir, 0755)
	require.NoError(t, err)

	// Prune empty directories
	err = sm.PruneEmptyDirectories()
	assert.NoError(t, err)

	// Empty directories should be removed (except root)
	_, err = os.Stat(testDir)
	assert.True(t, os.IsNotExist(err))

	// Root directory should still exist
	_, err = os.Stat(sm.rootDir)
	assert.NoError(t, err)
}

func TestStorageManager_GetStats(t *testing.T) {
	sm, err := NewStorageManager(t.TempDir())
	require.NoError(t, err)

	// Initially should have zero stats
	stats := sm.GetStats()
	assert.Equal(t, int64(0), stats.TotalGenerated)
	assert.Equal(t, int64(0), stats.TotalSizeBytes)
	assert.Equal(t, int64(0), stats.CacheHits)
	assert.Equal(t, int64(0), stats.CacheMisses)

	testData := []byte("test data")
	sourceHash := "abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890"

	// Store new data (should increment cache misses and generated)
	_, _, err = sm.Store(testData, sourceHash, PreviewTypeThumbnail, PreviewSizeMedium)
	require.NoError(t, err)

	stats = sm.GetStats()
	assert.Equal(t, int64(1), stats.TotalGenerated)
	assert.Equal(t, int64(len(testData)), stats.TotalSizeBytes)
	assert.Equal(t, int64(0), stats.CacheHits)
	assert.Equal(t, int64(1), stats.CacheMisses)

	// Store same data again (should increment cache hits)
	_, _, err = sm.Store(testData, sourceHash, PreviewTypeThumbnail, PreviewSizeMedium)
	require.NoError(t, err)

	stats = sm.GetStats()
	assert.Equal(t, int64(1), stats.TotalGenerated) // Still 1
	assert.Equal(t, int64(len(testData)), stats.TotalSizeBytes) // Same size
	assert.Equal(t, int64(1), stats.CacheHits) // Incremented
	assert.Equal(t, int64(1), stats.CacheMisses) // Same
}