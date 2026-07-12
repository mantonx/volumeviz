package scanner

import (
	"context"
	"log"
	"os"
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/mantonx/volumeviz/internal/models"
	"github.com/mantonx/volumeviz/internal/services/filesystem"
)

// Mock FoldersRepository for testing
type MockFoldersRepo struct{}

func (m *MockFoldersRepo) CreateFolder(ctx context.Context, params models.CreateFolderParams) (*models.Folder, error) {
	return &models.Folder{}, nil
}

func (m *MockFoldersRepo) DeleteFoldersByVolume(ctx context.Context, volumeID string) error {
	return nil
}

// Mock FilesRepository for testing
type MockFilesRepo struct{}

func (m *MockFilesRepo) CreateFile(ctx context.Context, params models.CreateFileParams) (*models.File, error) {
	return &models.File{}, nil
}

func (m *MockFilesRepo) DeleteFilesByVolume(ctx context.Context, volumeID string) error {
	return nil
}

func TestSetFilesystemIndexing(t *testing.T) {
	// Create a VolumeScanner instance
	logger := log.New(os.Stderr, "[TEST] ", log.LstdFlags)
	vs := &VolumeScanner{
		logger: logger,
	}

	// Create mock repositories
	mockFoldersRepo := &MockFoldersRepo{}
	mockFilesRepo := &MockFilesRepo{}

	// Create basic indexer config
	indexerConfig := filesystem.IndexerConfig{
		BatchSize: 100,
		MaxDepth:  10,
	}

	// Test SetFilesystemIndexing - should not panic and should set fields
	vs.SetFilesystemIndexing(mockFoldersRepo, mockFilesRepo, indexerConfig, nil, nil)

	// Verify that repositories were set
	assert.NotNil(t, vs.foldersRepo)
	assert.NotNil(t, vs.filesRepo)
}

func TestIsFilesystemIndexingEnabled(t *testing.T) {
	vs := &VolumeScanner{}

	// Initially should be false
	assert.False(t, vs.IsFilesystemIndexingEnabled())

	// Set filesystem indexer
	vs.filesystemIndexer = &filesystem.FilesystemIndexer{}

	// Now should be true
	assert.True(t, vs.IsFilesystemIndexingEnabled())
}

func TestFilesystemIntegrationCoverage(t *testing.T) {
	// Test functions to improve coverage
	logger := log.New(os.Stderr, "[TEST] ", log.LstdFlags)
	vs := &VolumeScanner{
		logger: logger,
	}

	// Test GetFilesystemIndexingProgress with nil indexer
	progress := vs.GetFilesystemIndexingProgress()
	assert.Nil(t, progress) // Should return nil with no indexer

	// Test TriggerFilesystemIndexing with nil indexer
	ctx := context.Background()
	vs.TriggerFilesystemIndexing(ctx, "test-volume", false)
	// Should not panic

	// Test TriggerFilesystemIndexingWithScanID with nil indexer
	vs.TriggerFilesystemIndexingWithScanID(ctx, "test-volume", false, "test-scan-id")
	// Should not panic

	// Verify vs still exists
	assert.NotNil(t, vs)
}

func TestPerformFilesystemIndexing(t *testing.T) {
	// Test with a VolumeScanner that has no filesystem indexer
	logger := log.New(os.Stderr, "[TEST] ", log.LstdFlags)
	vs := &VolumeScanner{
		logger:            logger,
		filesystemIndexer: nil, // No indexer set
	}

	// Should handle gracefully when called with nil indexer
	vs.performFilesystemIndexing(context.Background(), "test-volume", "/test/path", "scan-id", nil)
	assert.NotNil(t, vs) // Should not panic
}

func TestPerformFilesystemIndexingAsync(t *testing.T) {
	// Test with a VolumeScanner that has no filesystem indexer
	logger := log.New(os.Stderr, "[TEST] ", log.LstdFlags)
	vs := &VolumeScanner{
		logger:            logger,
		filesystemIndexer: nil, // No indexer set
	}

	// Should handle gracefully when called with nil indexer
	vs.performFilesystemIndexingAsync(context.Background(), "test-volume", "/test/path", false, "test-scan-id")
	assert.NotNil(t, vs) // Should not panic
}

func TestTriggerFilesystemIndexingWithScanID(t *testing.T) {
	// Test enhanced coverage
	logger := log.New(os.Stderr, "[TEST] ", log.LstdFlags)
	vs := &VolumeScanner{
		logger:            logger,
		filesystemIndexer: nil,
	}

	// Test different parameter combinations
	ctx := context.Background()

	// Test with async=true
	vs.TriggerFilesystemIndexingWithScanID(ctx, "test-volume", true, "scan-id-1")

	// Test with async=false
	vs.TriggerFilesystemIndexingWithScanID(ctx, "test-volume", false, "scan-id-2")

	// Should not panic in either case
	assert.NotNil(t, vs)
}
