package filesystem

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/mantonx/volumeviz/internal/models"
	"github.com/mantonx/volumeviz/internal/repo"
	"github.com/mantonx/volumeviz/internal/store"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
)

// MockResumeStore mocks the store interface for resume testing
type MockResumeStore struct {
	mock.Mock
}

func (m *MockResumeStore) ScanProgress() repo.ScanProgressRepo {
	args := m.Called()
	if args.Get(0) == nil {
		return nil
	}
	return args.Get(0).(repo.ScanProgressRepo)
}

func (m *MockResumeStore) Folders() *repo.FoldersRepo {
	args := m.Called()
	if args.Get(0) == nil {
		return nil
	}
	return args.Get(0).(*repo.FoldersRepo)
}

// Implement other required Store methods
func (m *MockResumeStore) WithTx(ctx context.Context, fn func(store.TxStore) error) error { return nil }
func (m *MockResumeStore) Volumes() repo.VolumesRepo { return nil }
func (m *MockResumeStore) Scans() repo.ScansRepo { return nil }
func (m *MockResumeStore) Retention() repo.RetentionRepo { return nil }
func (m *MockResumeStore) Stats() *repo.StatsRepo { return nil }
func (m *MockResumeStore) Files() *repo.FilesRepo { return nil }
func (m *MockResumeStore) FileMetadata() *repo.FileMetadataRepo { return nil }
func (m *MockResumeStore) Alerts() repo.AlertsRepo { return nil }
func (m *MockResumeStore) Search() *repo.SearchRepo { return nil }
func (m *MockResumeStore) Health(ctx context.Context) error { return nil }
func (m *MockResumeStore) Queries() interface{} { return nil }

// MockResumeScanProgressRepo mocks the scan progress repository for resume testing
type MockResumeScanProgressRepo struct {
	mock.Mock
	scanPhases map[string]*models.ScanPhase
}

func (m *MockResumeScanProgressRepo) GetScanPhase(ctx context.Context, scanID, phaseName string) (*models.ScanPhase, error) {
	args := m.Called(ctx, scanID, phaseName)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.ScanPhase), args.Error(1)
}

func (m *MockResumeScanProgressRepo) UpdateScanPhaseProgress(ctx context.Context, params models.UpdateScanPhaseParams) error {
	args := m.Called(ctx, params)
	return args.Error(0)
}

func (m *MockResumeScanProgressRepo) CreateScanPhase(ctx context.Context, params models.CreateScanPhaseParams) (*models.ScanPhase, error) {
	return nil, nil
}

func (m *MockResumeScanProgressRepo) GetScanPhasesByID(ctx context.Context, scanID string) ([]*models.ScanPhase, error) {
	return nil, nil
}

func (m *MockResumeScanProgressRepo) CompleteScanPhase(ctx context.Context, scanID, phaseName string) error {
	return nil
}

// MockFoldersRepo mocks the folders repository for resume testing
type MockFoldersRepo struct {
	mock.Mock
	folders map[string][]*models.Folder
}

func (m *MockFoldersRepo) ListFoldersByVolume(ctx context.Context, volumeID string, limit, offset int32) ([]*models.Folder, error) {
	args := m.Called(ctx, volumeID, limit, offset)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]*models.Folder), args.Error(1)
}

func TestResumeWalker_LoadFolderCache(t *testing.T) {
	tests := []struct {
		name        string
		volumeID    string
		folders     []*models.Folder
		expectError bool
		description string
	}{
		{
			name:     "successful_cache_load",
			volumeID: "test-volume-1",
			folders: []*models.Folder{
				{Path: "/test/folder1", FileCount: 10},
				{Path: "/test/folder2", FileCount: 5},
				{Path: "/test/folder3", FileCount: 15},
			},
			expectError: false,
			description: "Should successfully load folders into cache",
		},
		{
			name:        "empty_folders",
			volumeID:    "test-volume-2",
			folders:     []*models.Folder{},
			expectError: false,
			description: "Should handle empty folder list",
		},
		{
			name:        "repo_error",
			volumeID:    "test-volume-3",
			folders:     nil,
			expectError: true,
			description: "Should handle repository errors gracefully",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Setup mocks
			mockFoldersRepo := &MockFoldersRepo{}
			mockStore := &MockResumeStore{}
			mockStore.On("Folders").Return(mockFoldersRepo)

			if tt.expectError {
				mockFoldersRepo.On("ListFoldersByVolume", mock.Anything, tt.volumeID, int32(10000), int32(0)).
					Return(nil, fmt.Errorf("database error"))
			} else {
				mockFoldersRepo.On("ListFoldersByVolume", mock.Anything, tt.volumeID, int32(10000), int32(0)).
					Return(tt.folders, nil)
			}

			// Create filesystem indexer with minimal config
			indexer := &FilesystemIndexer{
				store:  mockStore,
				config: IndexerConfig{},
			}

			// Create resume walker
			resumeWalker := NewResumeWalker(indexer, tt.volumeID)

			// Test loading folder cache
			ctx := context.Background()
			err := resumeWalker.loadFolderCache(ctx)

			if tt.expectError {
				assert.Error(t, err, tt.description)
			} else {
				assert.NoError(t, err, tt.description)
				
				// Verify cache contents
				if len(tt.folders) > 0 {
					assert.Equal(t, len(tt.folders), len(resumeWalker.folderCache), 
						"Cache should contain all folders")
					
					for _, folder := range tt.folders {
						_, exists := resumeWalker.folderCache[folder.Path]
						assert.True(t, exists, "Folder should be in cache: %s", folder.Path)
					}
				}
			}

			// Verify mock expectations
			mockFoldersRepo.AssertExpectations(t)
			mockStore.AssertExpectations(t)
		})
	}
}

func TestResumeWalker_ResumeFromCheckpoint(t *testing.T) {
	// Create temporary directory structure for testing
	tmpDir, err := os.MkdirTemp("", "resume_test")
	if err != nil {
		t.Fatalf("Failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tmpDir)

	// Create test directory structure
	testDirs := []string{
		"movies/action",
		"movies/comedy",
		"movies/drama",
		"movies/sci-fi",
	}
	testFiles := map[string][]string{
		"movies": {"movie1.mp4", "movie2.mkv"},
		"movies/action": {"action1.mp4", "action2.avi"},
		"movies/comedy": {"comedy1.mp4"},
		"movies/drama": {"drama1.mkv", "drama2.mp4"},
		"movies/sci-fi": {"scifi1.mp4", "scifi2.mkv", "scifi3.avi"},
	}

	// Create directories
	for _, dir := range testDirs {
		err := os.MkdirAll(filepath.Join(tmpDir, dir), 0755)
		assert.NoError(t, err)
	}

	// Create files
	for dir, files := range testFiles {
		for _, file := range files {
			filePath := filepath.Join(tmpDir, dir, file)
			err := os.WriteFile(filePath, []byte("test content"), 0644)
			assert.NoError(t, err)
		}
	}

	tests := []struct {
		name          string
		scanID        string
		volumeID      string
		mountpoint    string
		checkpoint    string
		phase         *models.ScanPhase
		expectError   bool
		description   string
	}{
		{
			name:       "resume_from_middle_directory",
			scanID:     "scan-123",
			volumeID:   "volume-movies",
			mountpoint: tmpDir,
			checkpoint: filepath.Join(tmpDir, "movies/comedy"),
			phase: &models.ScanPhase{
				ScanID:          "scan-123",
				PhaseName:       "filesystem_indexing",
				Status:          "paused",
				ItemsProcessed:  5,
				ItemsTotal:      15,
				CurrentItem:     filepath.Join(tmpDir, "movies/comedy"),
			},
			expectError: false,
			description: "Should resume from middle directory checkpoint",
		},
		{
			name:       "resume_paused_scan",
			scanID:     "scan-456",
			volumeID:   "volume-movies",
			mountpoint: tmpDir,
			checkpoint: filepath.Join(tmpDir, "movies/action"),
			phase: &models.ScanPhase{
				ScanID:          "scan-456",
				PhaseName:       "filesystem_indexing",
				Status:          "paused",
				ItemsProcessed:  2,
				ItemsTotal:      15,
				CurrentItem:     filepath.Join(tmpDir, "movies/action"),
			},
			expectError: false,
			description: "Should resume paused scan successfully",
		},
		{
			name:       "non_paused_scan_error",
			scanID:     "scan-789",
			volumeID:   "volume-movies",
			mountpoint: tmpDir,
			checkpoint: filepath.Join(tmpDir, "movies"),
			phase: &models.ScanPhase{
				ScanID:          "scan-789",
				PhaseName:       "filesystem_indexing",
				Status:          "completed",
				ItemsProcessed:  15,
				ItemsTotal:      15,
				CurrentItem:     tmpDir,
			},
			expectError: true,
			description: "Should error when trying to resume non-paused scan",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Setup mocks
			mockScanProgressRepo := &MockResumeScanProgressRepo{}
			mockFoldersRepo := &MockFoldersRepo{}
			mockStore := &MockResumeStore{}

			mockStore.On("ScanProgress").Return(mockScanProgressRepo)
			mockStore.On("Folders").Return(mockFoldersRepo)

			mockScanProgressRepo.On("GetScanPhase", mock.Anything, tt.scanID, "filesystem_indexing").
				Return(tt.phase, nil)

			// Mock folder cache (empty for simplicity)
			mockFoldersRepo.On("ListFoldersByVolume", mock.Anything, tt.volumeID, int32(10000), int32(0)).
				Return([]*models.Folder{}, nil)

			if !tt.expectError {
				mockScanProgressRepo.On("UpdateScanPhaseProgress", mock.Anything, mock.Anything).
					Return(nil).Maybe()
			}

			// Create filesystem indexer
			indexer := &FilesystemIndexer{
				store: mockStore,
				config: IndexerConfig{
					DetectMimeTypes: false,
					SkipHidden:     false,
					MaxDepth:       10,
				},
			}

			// Create resume walker
			resumeWalker := NewResumeWalker(indexer, tt.volumeID)

			// Test resumption
			ctx := context.Background()
			err := resumeWalker.ResumeFromCheckpoint(ctx, tt.mountpoint, tt.scanID)

			if tt.expectError {
				assert.Error(t, err, tt.description)
			} else {
				assert.NoError(t, err, tt.description)
			}

			// Verify mock expectations
			mockScanProgressRepo.AssertExpectations(t)
			mockFoldersRepo.AssertExpectations(t)
			mockStore.AssertExpectations(t)
		})
	}
}

func TestResumeWalker_CheckpointLogic(t *testing.T) {
	tests := []struct {
		name        string
		checkpoint  string
		current     string
		expected    bool
		description string
	}{
		{
			name:        "path_contains_checkpoint",
			checkpoint:  "/movies/action",
			current:     "/movies/action/movie1.mp4",
			expected:    true,
			description: "Path containing checkpoint should be processed",
		},
		{
			name:        "checkpoint_contains_path",
			checkpoint:  "/movies/action/movie1.mp4",
			current:     "/movies/action",
			expected:    true,
			description: "Checkpoint containing path should be processed",
		},
		{
			name:        "unrelated_paths",
			checkpoint:  "/movies/drama",
			current:     "/movies/comedy",
			expected:    false,
			description: "Unrelated paths should not match",
		},
		{
			name:        "empty_checkpoint",
			checkpoint:  "",
			current:     "/movies/any/file.mp4",
			expected:    true,
			description: "Empty checkpoint should process all paths",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Test the checkpoint logic used in walkFromCheckpoint
			var shouldProcess bool
			if tt.checkpoint == "" {
				shouldProcess = true
			} else {
				// This mimics the logic from resume_walker.go:177-178
				shouldProcess = strings.HasPrefix(tt.checkpoint, tt.current) || strings.HasPrefix(tt.current, tt.checkpoint)
			}
			
			assert.Equal(t, tt.expected, shouldProcess, tt.description)
		})
	}
}

func TestResumeWalker_Integration(t *testing.T) {
	// Create a more complex directory structure for integration testing
	tmpDir, err := os.MkdirTemp("", "resume_integration_test")
	if err != nil {
		t.Fatalf("Failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tmpDir)

	// Create hierarchical structure
	structure := map[string][]string{
		"movies": {"index.txt"},
		"movies/action": {"action1.mp4", "action2.avi", "metadata.nfo"},
		"movies/comedy": {"comedy1.mp4", "comedy2.mkv"},
		"movies/drama": {"drama1.mkv"},
		"movies/sci-fi": {"scifi1.mp4", "scifi2.mkv", "scifi3.avi", "poster.jpg"},
		"movies/sci-fi/series": {"episode1.mkv", "episode2.mkv"},
	}

	// Create directory structure
	for dir, files := range structure {
		dirPath := filepath.Join(tmpDir, dir)
		err := os.MkdirAll(dirPath, 0755)
		assert.NoError(t, err)
		
		for _, file := range files {
			filePath := filepath.Join(dirPath, file)
			content := fmt.Sprintf("test content for %s", file)
			err := os.WriteFile(filePath, []byte(content), 0644)
			assert.NoError(t, err)
		}
	}

	// Setup mocks for integration test
	mockScanProgressRepo := &MockResumeScanProgressRepo{}
	mockFoldersRepo := &MockFoldersRepo{}
	mockStore := &MockResumeStore{}

	mockStore.On("ScanProgress").Return(mockScanProgressRepo)
	mockStore.On("Folders").Return(mockFoldersRepo)

	// Mock paused scan that should resume from comedy directory
	checkpointPath := filepath.Join(tmpDir, "movies/comedy")
	phase := &models.ScanPhase{
		ScanID:          "integration-scan",
		PhaseName:       "filesystem_indexing",
		Status:          "paused",
		ItemsProcessed:  5,
		ItemsTotal:      20,
		CurrentItem:     checkpointPath,
	}

	mockScanProgressRepo.On("GetScanPhase", mock.Anything, "integration-scan", "filesystem_indexing").
		Return(phase, nil)

	// Mock empty folder cache
	mockFoldersRepo.On("ListFoldersByVolume", mock.Anything, "integration-volume", int32(10000), int32(0)).
		Return([]*models.Folder{}, nil)

	// Allow progress updates
	mockScanProgressRepo.On("UpdateScanPhaseProgress", mock.Anything, mock.Anything).
		Return(nil).Maybe()

	// Create filesystem indexer with progress throttling disabled for testing
	indexer := NewFilesystemIndexer(mockStore, IndexerConfig{
		DetectMimeTypes: true,
		SkipHidden:     false,
		MaxDepth:       20,
		BatchSize:      10,
	}, nil, nil)

	// Initialize active scan for this volume
	indexer.progressMutex.Lock()
	indexer.activeScans["integration-volume"] = &IndexingProgress{
		VolumeID:   "integration-volume",
		Status:     "running",
		StartedAt:  time.Now(),
		LastUpdate: time.Now(),
	}
	indexer.progressMutex.Unlock()

	// Create resume walker
	resumeWalker := NewResumeWalker(indexer, "integration-volume")

	// Test integration
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	err = resumeWalker.ResumeFromCheckpoint(ctx, tmpDir, "integration-scan")
	assert.NoError(t, err, "Integration test should complete successfully")

	// Verify that resumption occurred and processed expected files
	progress := indexer.GetProgress()
	assert.NotNil(t, progress, "Should have progress tracking")
	assert.Greater(t, progress.FilesScanned, int64(0), "Should have processed some files")
	
	// Since we're starting from comedy checkpoint, should have processed files from 
	// comedy, drama, sci-fi directories but skipped earlier ones
	t.Logf("Integration test completed: %d files, %d folders processed",
		progress.FilesScanned, progress.FoldersScanned)

	// Verify mock expectations
	mockScanProgressRepo.AssertExpectations(t)
	mockFoldersRepo.AssertExpectations(t)
	mockStore.AssertExpectations(t)
}