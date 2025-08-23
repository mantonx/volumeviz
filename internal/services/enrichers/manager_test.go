package enrichers

import (
	"context"
	"fmt"
	"log"
	"sync"
	"sync/atomic"
	"testing"
	"time"
)

// MockEnricher is a mock implementation of the Enricher interface
type MockEnricher struct {
	name         string
	canEnrich    bool
	enrichResult *MediaMetadata
	enrichError  error
	enrichDelay  time.Duration
	available    bool
}

func (m *MockEnricher) Name() string {
	return m.name
}

func (m *MockEnricher) CanEnrich(fileInfo FileInfo) bool {
	return m.canEnrich
}

func (m *MockEnricher) Enrich(ctx context.Context, fileInfo FileInfo) (*MediaMetadata, error) {
	if m.enrichDelay > 0 {
		select {
		case <-time.After(m.enrichDelay):
		case <-ctx.Done():
			return nil, ctx.Err()
		}
	}
	return m.enrichResult, m.enrichError
}

func (m *MockEnricher) IsAvailable() bool {
	return m.available
}

func (m *MockEnricher) GetCapabilities() EnricherCapabilities {
	return EnricherCapabilities{
		Name:            m.name,
		SupportedMimes:  []string{"test/*"},
		ExtractedFields: []string{"test_field"},
		Performance:     "fast",
		Accuracy:        "high",
	}
}

// FileIDBasedEnricher is a mock enricher that returns different results based on file ID
type FileIDBasedEnricher struct {
	name            string
	canEnrich       bool
	available       bool
	enricherResults map[int64]*MediaMetadata
}

func (f *FileIDBasedEnricher) Name() string {
	return f.name
}

func (f *FileIDBasedEnricher) CanEnrich(fileInfo FileInfo) bool {
	return f.canEnrich
}

func (f *FileIDBasedEnricher) Enrich(ctx context.Context, fileInfo FileInfo) (*MediaMetadata, error) {
	if metadata, ok := f.enricherResults[fileInfo.ID]; ok {
		return metadata, nil
	}
	return nil, fmt.Errorf("no metadata found for file ID %d", fileInfo.ID)
}

func (f *FileIDBasedEnricher) IsAvailable() bool {
	return f.available
}

func (f *FileIDBasedEnricher) GetCapabilities() EnricherCapabilities {
	return EnricherCapabilities{
		Name:            f.name,
		SupportedMimes:  []string{"*/*"},
		ExtractedFields: []string{"file_id_based"},
		Performance:     "fast",
		Accuracy:        "high",
	}
}

// MockRepository is a mock implementation of MediaMetadataRepository
type MockRepository struct {
	savedMetadata   []EnrichmentResult
	unenrichedFiles []FileInfo
	saveError       error
	bulkSaveError   error
	getError        error
}

func (m *MockRepository) SaveMetadata(ctx context.Context, fileID int64, kind EnrichmentKind, metadata *MediaMetadata) error {
	if m.saveError != nil {
		return m.saveError
	}
	m.savedMetadata = append(m.savedMetadata, EnrichmentResult{
		FileID:   fileID,
		Success:  true,
		Metadata: metadata,
	})
	return nil
}

func (m *MockRepository) GetMetadata(ctx context.Context, fileID int64, kind EnrichmentKind) (*MediaMetadata, error) {
	return nil, m.getError
}

func (m *MockRepository) BulkSaveMetadata(ctx context.Context, results []EnrichmentResult) error {
	if m.bulkSaveError != nil {
		return m.bulkSaveError
	}
	m.savedMetadata = append(m.savedMetadata, results...)
	return nil
}

func (m *MockRepository) GetUnenrichedFiles(ctx context.Context, volumeID string, limit int) ([]FileInfo, error) {
	if m.getError != nil {
		return nil, m.getError
	}
	if len(m.unenrichedFiles) > limit {
		return m.unenrichedFiles[:limit], nil
	}
	return m.unenrichedFiles, nil
}

func (m *MockRepository) GetEnrichmentProgress(ctx context.Context, volumeID string) (*EnrichmentProgress, error) {
	return &EnrichmentProgress{
		VolumeID:        volumeID,
		Status:          "completed",
		TotalFiles:      int64(len(m.savedMetadata)),
		ProcessedFiles:  int64(len(m.savedMetadata)),
		SuccessfulFiles: int64(len(m.savedMetadata)),
	}, nil
}

func (m *MockRepository) DeleteMetadata(ctx context.Context, fileID *int64, volumeID *string) error {
	return nil
}

func TestManager_EnrichFile(t *testing.T) {
	tests := []struct {
		name          string
		enrichers     []Enricher
		fileInfo      FileInfo
		expectSuccess bool
		expectError   bool
	}{
		{
			name: "Successful enrichment",
			enrichers: []Enricher{
				&MockEnricher{
					name:      "test-enricher",
					canEnrich: true,
					available: true,
					enrichResult: &MediaMetadata{
						Kind:        EnrichmentKindVideo,
						DurationMs:  int64Ptr(120000),
						BitrateKbps: int32Ptr(5000),
					},
				},
			},
			fileInfo: FileInfo{
				ID:       1,
				Path:     "/test/video.mp4",
				MimeType: "video/mp4",
			},
			expectSuccess: true,
			expectError:   false,
		},
		{
			name: "No applicable enricher",
			enrichers: []Enricher{
				&MockEnricher{
					name:      "test-enricher",
					canEnrich: false,
					available: true,
				},
			},
			fileInfo: FileInfo{
				ID:       2,
				Path:     "/test/document.pdf",
				MimeType: "application/pdf",
			},
			expectSuccess: false,
			expectError:   true,
		},
		{
			name: "Enricher returns error",
			enrichers: []Enricher{
				&MockEnricher{
					name:        "test-enricher",
					canEnrich:   true,
					available:   true,
					enrichError: fmt.Errorf("enrichment failed"),
				},
			},
			fileInfo: FileInfo{
				ID:       3,
				Path:     "/test/corrupt.mp4",
				MimeType: "video/mp4",
			},
			expectSuccess: false,
			expectError:   true,
		},
		{
			name: "Multiple enrichers - first fails, second succeeds",
			enrichers: []Enricher{
				&MockEnricher{
					name:        "failing-enricher",
					canEnrich:   true,
					available:   true,
					enrichError: fmt.Errorf("first enricher failed"),
				},
				&MockEnricher{
					name:      "success-enricher",
					canEnrich: true,
					available: true,
					enrichResult: &MediaMetadata{
						Kind: EnrichmentKindVideo,
					},
				},
			},
			fileInfo: FileInfo{
				ID:       4,
				Path:     "/test/video.mp4",
				MimeType: "video/mp4",
			},
			expectSuccess: true,
			expectError:   false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			config := EnricherConfig{
				Enabled:              true,
				MaxConcurrentWorkers: 2,
				TimeoutPerFile:       5 * time.Second,
			}

			repo := &MockRepository{}
			logger := log.New(&testLogWriter{t: t}, "test: ", 0)

			manager := NewManager(config, repo, logger, nil)

			// Register enrichers
			for _, enricher := range tt.enrichers {
				manager.RegisterEnricher(enricher)
			}

			ctx := context.Background()
			result, err := manager.EnrichFile(ctx, tt.fileInfo)

			if tt.expectError && err == nil {
				t.Errorf("Expected error but got none")
			}

			if !tt.expectError && err != nil {
				t.Errorf("Unexpected error: %v", err)
			}

			if tt.expectSuccess && (result == nil || !result.Success) {
				t.Errorf("Expected successful result but got: %+v", result)
			}

			if !tt.expectSuccess && result != nil && result.Success {
				t.Errorf("Expected failure but got success")
			}
		})
	}
}

func TestManager_EnrichVolume(t *testing.T) {
	tests := []struct {
		name            string
		volumeID        string
		unenrichedFiles []FileInfo
		enricherResults map[int64]*MediaMetadata
		expectError     bool
		expectedSuccess int
	}{
		{
			name:     "Enrich multiple files successfully",
			volumeID: "test-volume",
			unenrichedFiles: []FileInfo{
				{ID: 1, Path: "/video1.mp4", MimeType: "video/mp4"},
				{ID: 2, Path: "/video2.mp4", MimeType: "video/mp4"},
				{ID: 3, Path: "/audio.mp3", MimeType: "audio/mp3"},
			},
			enricherResults: map[int64]*MediaMetadata{
				1: {Kind: EnrichmentKindVideo, DurationMs: int64Ptr(60000)},
				2: {Kind: EnrichmentKindVideo, DurationMs: int64Ptr(90000)},
				3: {Kind: EnrichmentKindAudio, DurationMs: int64Ptr(180000)},
			},
			expectError:     false,
			expectedSuccess: 3,
		},
		{
			name:            "No files to enrich",
			volumeID:        "empty-volume",
			unenrichedFiles: []FileInfo{},
			enricherResults: map[int64]*MediaMetadata{},
			expectError:     false,
			expectedSuccess: 0,
		},
		{
			name:     "Some enrichments fail",
			volumeID: "mixed-volume",
			unenrichedFiles: []FileInfo{
				{ID: 1, Path: "/video1.mp4", MimeType: "video/mp4"},
				{ID: 2, Path: "/corrupt.mp4", MimeType: "video/mp4"},
				{ID: 3, Path: "/audio.mp3", MimeType: "audio/mp3"},
			},
			enricherResults: map[int64]*MediaMetadata{
				1: {Kind: EnrichmentKindVideo, DurationMs: int64Ptr(60000)},
				// File 2 will fail (no result)
				3: {Kind: EnrichmentKindAudio, DurationMs: int64Ptr(180000)},
			},
			expectError:     false,
			expectedSuccess: 2,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			config := EnricherConfig{
				Enabled:              true,
				MaxConcurrentWorkers: 3,
				TimeoutPerFile:       2 * time.Second,
			}

			repo := &MockRepository{
				unenrichedFiles: tt.unenrichedFiles,
			}
			logger := log.New(&testLogWriter{t: t}, "test: ", 0)

			manager := NewManager(config, repo, logger, nil)

			// Register a custom enricher that returns predefined results based on file ID
			customEnricher := &FileIDBasedEnricher{
				name:            "file-id-enricher",
				canEnrich:       true,
				available:       true,
				enricherResults: tt.enricherResults,
			}
			manager.RegisterEnricher(customEnricher)

			ctx := context.Background()
			err := manager.EnrichVolume(ctx, tt.volumeID)

			if tt.expectError && err == nil {
				t.Errorf("Expected error but got none")
			}

			if !tt.expectError && err != nil {
				t.Errorf("Unexpected error: %v", err)
			}

			// Check progress
			progress := manager.GetProgress(tt.volumeID)
			if progress == nil {
				t.Fatal("Expected progress but got nil")
			}

			if progress.SuccessfulFiles != int64(tt.expectedSuccess) {
				t.Errorf("Expected %d successful files, got %d", tt.expectedSuccess, progress.SuccessfulFiles)
			}
		})
	}
}

func TestManager_Concurrency(t *testing.T) {
	// Test that concurrent workers are limited
	config := EnricherConfig{
		Enabled:              true,
		MaxConcurrentWorkers: 2, // Only 2 workers
		TimeoutPerFile:       5 * time.Second,
	}

	// Track concurrent executions
	var concurrentCount int32
	var maxConcurrent int32
	var mu sync.Mutex

	// Create enricher that tracks concurrency
	enricher := &MockEnricher{
		name:        "slow-enricher",
		canEnrich:   true,
		available:   true,
		enrichDelay: 100 * time.Millisecond, // Slow enrichment
		enrichResult: &MediaMetadata{
			Kind: EnrichmentKindVideo,
		},
	}

	// Wrap enricher to track concurrency
	wrappedEnricher := &concurrencyTrackingEnricher{
		MockEnricher:    enricher,
		concurrentCount: &concurrentCount,
		maxConcurrent:   &maxConcurrent,
		mu:              &mu,
	}

	repo := &MockRepository{
		unenrichedFiles: []FileInfo{
			{ID: 1, Path: "/1.mp4", MimeType: "video/mp4"},
			{ID: 2, Path: "/2.mp4", MimeType: "video/mp4"},
			{ID: 3, Path: "/3.mp4", MimeType: "video/mp4"},
			{ID: 4, Path: "/4.mp4", MimeType: "video/mp4"},
			{ID: 5, Path: "/5.mp4", MimeType: "video/mp4"},
		},
	}

	logger := log.New(&testLogWriter{t: t}, "test: ", 0)
	manager := NewManager(config, repo, logger, nil)
	manager.RegisterEnricher(wrappedEnricher)

	ctx := context.Background()
	err := manager.EnrichVolume(ctx, "test-volume")
	if err != nil {
		t.Fatalf("EnrichVolume failed: %v", err)
	}

	// Check that we never exceeded max workers
	mu.Lock()
	defer mu.Unlock()
	if maxConcurrent > 2 {
		t.Errorf("Expected max concurrent workers to be 2, got %d", maxConcurrent)
	}
}

// Helper types

type testLogWriter struct {
	t *testing.T
}

func (w *testLogWriter) Write(p []byte) (n int, err error) {
	w.t.Log(string(p))
	return len(p), nil
}

type concurrencyTrackingEnricher struct {
	*MockEnricher
	concurrentCount *int32
	maxConcurrent   *int32
	mu              *sync.Mutex
}

func (c *concurrencyTrackingEnricher) Enrich(ctx context.Context, fileInfo FileInfo) (*MediaMetadata, error) {
	c.mu.Lock()
	atomic.AddInt32(c.concurrentCount, 1)
	current := atomic.LoadInt32(c.concurrentCount)
	if current > atomic.LoadInt32(c.maxConcurrent) {
		atomic.StoreInt32(c.maxConcurrent, current)
	}
	c.mu.Unlock()

	defer func() {
		atomic.AddInt32(c.concurrentCount, -1)
	}()

	return c.MockEnricher.Enrich(ctx, fileInfo)
}

// Helper functions
func int64Ptr(v int64) *int64 {
	return &v
}

func int32Ptr(v int32) *int32 {
	return &v
}
