package filesystem

import (
	"context"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/mantonx/volumeviz/internal/repo"
	"github.com/mantonx/volumeviz/internal/store"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
)

// MockStoreForIndexer mocks the store interface for indexer testing
type MockStoreForIndexer struct {
	mock.Mock
}

func (m *MockStoreForIndexer) WithTx(ctx context.Context, fn func(store.TxStore) error) error { return nil }
func (m *MockStoreForIndexer) Volumes() repo.VolumesRepo { return nil }
func (m *MockStoreForIndexer) Scans() repo.ScansRepo { return nil }
func (m *MockStoreForIndexer) Retention() repo.RetentionRepo { return nil }
func (m *MockStoreForIndexer) Stats() *repo.StatsRepo { return nil }
func (m *MockStoreForIndexer) Files() *repo.FilesRepo { return nil }
func (m *MockStoreForIndexer) Folders() *repo.FoldersRepo { return nil }
func (m *MockStoreForIndexer) FileMetadata() *repo.FileMetadataRepo { return nil }
func (m *MockStoreForIndexer) Alerts() repo.AlertsRepo { return nil }
func (m *MockStoreForIndexer) Search() *repo.SearchRepo { return nil }
func (m *MockStoreForIndexer) ScanProgress() repo.ScanProgressRepo { return nil }
func (m *MockStoreForIndexer) Snapshots() repo.SnapshotRepo { return nil }
func (m *MockStoreForIndexer) Users() repo.UsersRepository { return nil }
func (m *MockStoreForIndexer) Organizations() repo.OrganizationsRepo { return nil }
func (m *MockStoreForIndexer) GetUserByID(ctx context.Context, id int64) (store.User, error) {
	return store.User{}, nil
}
func (m *MockStoreForIndexer) GetOrganizationByID(ctx context.Context, id int64) (store.Organization, error) {
	return store.Organization{}, nil
}
func (m *MockStoreForIndexer) Health(ctx context.Context) error { return nil }
func (m *MockStoreForIndexer) Queries() interface{} { return nil }

func TestMimeDetector(t *testing.T) {
	detector := NewMimeDetector()

	tests := []struct {
		filename     string
		content      []byte
		expectedMime string
		expectedKind string
	}{
		{
			filename:     "test.txt",
			content:      []byte("Hello, World!"),
			expectedMime: "text/plain; charset=utf-8",
			expectedKind: "text",
		},
		{
			filename:     "test.json",
			content:      []byte(`{"key": "value"}`),
			expectedMime: "application/json",
			expectedKind: "data",
		},
		{
			filename:     "test.pdf",
			content:      []byte("%PDF-1.4"),
			expectedMime: "application/pdf",
			expectedKind: "document",
		},
	}

	// Create temporary directory for test files
	tmpDir, err := os.MkdirTemp("", "mime_test")
	if err != nil {
		t.Fatalf("Failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tmpDir)

	for _, test := range tests {
		t.Run(test.filename, func(t *testing.T) {
			// Create test file
			filePath := filepath.Join(tmpDir, test.filename)
			err := os.WriteFile(filePath, test.content, 0644)
			if err != nil {
				t.Fatalf("Failed to write test file: %v", err)
			}

			// Test MIME detection
			mimeType, mediaKind, _ := detector.DetectFile(filePath)

			if mimeType != test.expectedMime {
				t.Errorf("Expected MIME type %s, got %s", test.expectedMime, mimeType)
			}

			if mediaKind != test.expectedKind {
				t.Errorf("Expected media kind %s, got %s", test.expectedKind, mediaKind)
			}
		})
	}
}

func TestIndexerConfig(t *testing.T) {
	config := IndexerConfig{
		EnableHashing:       true,
		MaxFileBytesForHash: 1024,
		HashAlgorithm:       "sha256",
		SkipPatterns:        []string{`\.git`, `\.tmp$`},
		SkipHidden:          true,
		MaxDepth:            10,
		ConcurrentReads:     3,
		BatchSize:           500,
		DetectMimeTypes:     true,
	}

	// Test that config values are set correctly
	if !config.EnableHashing {
		t.Error("EnableHashing should be true")
	}

	if config.HashAlgorithm != "sha256" {
		t.Errorf("Expected hash algorithm 'sha256', got '%s'", config.HashAlgorithm)
	}

	if len(config.SkipPatterns) != 2 {
		t.Errorf("Expected 2 skip patterns, got %d", len(config.SkipPatterns))
	}
}

func TestFilesystemIndexer_ProgressTracking(t *testing.T) {
	// Setup mock store
	mockStore := &MockStoreForIndexer{}
	
	// Create indexer config
	config := IndexerConfig{
		EnableHashing:   false,
		DetectMimeTypes: false,
		MaxDepth:        10,
	}

	// Create filesystem indexer
	indexer := NewFilesystemIndexer(mockStore, config, nil, nil)
	
	volumeID := "test-volume-123"
	
	// Initialize active scan
	indexer.progressMutex.Lock()
	indexer.activeScans[volumeID] = &IndexingProgress{
		VolumeID:   volumeID,
		Status:     "running",
		StartedAt:  time.Now(),
		LastUpdate: time.Now(),
	}
	indexer.progressMutex.Unlock()

	// Test progress retrieval
	progress := indexer.GetIndexingProgress(volumeID)
	assert.NotNil(t, progress, "Expected progress to be non-nil")
	assert.Equal(t, volumeID, progress.VolumeID, "Volume ID should match")
	assert.Equal(t, "running", progress.Status, "Status should be running")

	// Test progress updates
	indexer.incrementFileCount(volumeID)
	indexer.incrementFolderCount(volumeID)
	indexer.addBytesProcessed(volumeID, 1024)

	progress = indexer.GetIndexingProgress(volumeID)
	assert.Equal(t, int64(1), progress.FilesScanned, "Should have 1 file scanned")
	assert.Equal(t, int64(1), progress.FoldersScanned, "Should have 1 folder scanned")
	assert.Equal(t, int64(1024), progress.BytesProcessed, "Should have 1024 bytes processed")

	// Test error recording
	indexer.recordError(volumeID, "test error message")
	progress = indexer.GetIndexingProgress(volumeID)
	assert.Equal(t, int64(1), progress.ErrorsCount, "Should have 1 error")
	assert.Equal(t, "test error message", progress.LastError, "Should have the error message")
}

func TestMediaKindClassification(t *testing.T) {
	detector := NewMimeDetector()

	tests := []struct {
		mimeType     string
		expectedKind string
	}{
		{"image/jpeg", "image"},
		{"image/png", "image"},
		{"video/mp4", "video"},
		{"audio/mpeg", "audio"},
		{"text/plain", "text"},
		{"application/pdf", "document"},
		{"application/zip", "archive"},
		{"application/json", "data"},
		{"application/javascript", "code"},
		{"application/octet-stream", "binary"},
		{"invalid/type", "unknown"},
		{"", "unknown"},
	}

	for _, test := range tests {
		t.Run(test.mimeType, func(t *testing.T) {
			kind := detector.classifyMediaKind(test.mimeType)
			if kind != test.expectedKind {
				t.Errorf("Expected media kind %s for MIME type %s, got %s",
					test.expectedKind, test.mimeType, kind)
			}
		})
	}
}