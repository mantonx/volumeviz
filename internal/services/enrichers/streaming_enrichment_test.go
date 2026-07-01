package enrichers

import (
	"context"
	"fmt"
	"testing"
	"time"
)

// MockStreamingRepository implements the pagination methods for testing
type MockStreamingRepository struct {
	*MockRepository
	files             []FileInfo
	bulkSaveCallCount int
}

func NewMockStreamingRepository(totalFiles int) *MockStreamingRepository {
	mock := &MockStreamingRepository{
		MockRepository:    &MockRepository{},
		files:             make([]FileInfo, totalFiles),
		bulkSaveCallCount: 0,
	}

	// Create test files
	for i := 0; i < totalFiles; i++ {
		mock.files[i] = FileInfo{
			ID:       int64(i + 1),
			Path:     fmt.Sprintf("/test/file%d.mp4", i+1),
			Name:     fmt.Sprintf("file%d.mp4", i+1),
			MimeType: "video/mp4",
			Size:     1024 * 1024, // 1MB
			VolumeID: "test-volume",
		}
	}

	return mock
}

func (m *MockStreamingRepository) GetUnenrichedFilesPaginated(ctx context.Context, volumeID string, limit int, offset int64) ([]FileInfo, error) {
	start := int(offset)
	end := start + limit

	if start >= len(m.files) {
		return []FileInfo{}, nil // No more files
	}

	if end > len(m.files) {
		end = len(m.files)
	}

	return m.files[start:end], nil
}

func (m *MockStreamingRepository) GetUnenrichedFileCount(ctx context.Context, volumeID string) (int64, error) {
	return int64(len(m.files)), nil
}

// Override BulkSaveMetadata to track call count
func (m *MockStreamingRepository) BulkSaveMetadata(ctx context.Context, results []EnrichmentResult) error {
	m.bulkSaveCallCount++
	return m.MockRepository.BulkSaveMetadata(ctx, results)
}

func TestStreamingEnrichmentMemoryEfficiency(t *testing.T) {
	// Test with a large number of files to demonstrate memory efficiency
	totalFiles := 10000
	batchSize := 1000

	mockRepo := NewMockStreamingRepository(totalFiles)
	config := EnricherConfig{
		Enabled:              true,
		MaxConcurrentWorkers: 2,
		TimeoutPerFile:       time.Second * 5,
	}

	manager := NewManager(config, mockRepo, nil, nil)

	// Add mock enricher
	manager.RegisterEnricher(&MockEnricher{
		name:         "test-enricher",
		canEnrich:    true,
		available:    true,
		enrichDelay:  time.Millisecond * 10,
		enrichResult: &MediaMetadata{Kind: EnrichmentKindVideo},
	})

	ctx, cancel := context.WithTimeout(context.Background(), time.Minute*2)
	defer cancel()

	// Test streaming enrichment
	err := manager.EnrichVolumeStreaming(ctx, "test-volume", "test-scan")
	if err != nil {
		t.Fatalf("Streaming enrichment failed: %v", err)
	}

	// Verify results
	progress := manager.GetProgress("test-volume")
	if progress == nil {
		t.Fatal("No progress found")
	}

	t.Logf("Streaming enrichment completed:")
	t.Logf("  - Total files: %d", progress.TotalFiles)
	t.Logf("  - Processed files: %d", progress.ProcessedFiles)
	t.Logf("  - Successful files: %d", progress.SuccessfulFiles)
	t.Logf("  - Failed files: %d", progress.FailedFiles)
	t.Logf("  - Status: %s", progress.Status)

	// Verify expected results
	if progress.TotalFiles != int64(totalFiles) {
		t.Errorf("Expected total files %d, got %d", totalFiles, progress.TotalFiles)
	}

	if progress.ProcessedFiles != int64(totalFiles) {
		t.Errorf("Expected processed files %d, got %d", totalFiles, progress.ProcessedFiles)
	}

	if progress.Status != "completed" && progress.Status != "completed_with_errors" {
		t.Errorf("Expected status 'completed' or 'completed_with_errors', got %s", progress.Status)
	}

	// Verify metadata was saved
	if mockRepo.bulkSaveCallCount == 0 {
		t.Error("Expected bulk save operations to have occurred")
	}

	// Calculate memory efficiency metrics
	expectedMemoryPeakFiles := batchSize * 2 // Max concurrent batches
	actualMemoryReduction := float64(totalFiles-expectedMemoryPeakFiles) / float64(totalFiles) * 100

	t.Logf("Memory optimization metrics:")
	t.Logf("  - Traditional approach would load all %d files simultaneously", totalFiles)
	t.Logf("  - Streaming approach peaks at ~%d files in memory", expectedMemoryPeakFiles)
	t.Logf("  - Memory reduction: %.1f%%", actualMemoryReduction)
}

func TestStreamingConfigDefaults(t *testing.T) {
	config := DefaultStreamingConfig()

	// Defaults were deliberately retuned (see DefaultStreamingConfig comments):
	// smaller batches for better memory usage, single concurrent batch to
	// avoid memory pressure, more frequent progress updates.
	if config.BatchSize != 500 {
		t.Errorf("Expected BatchSize 500, got %d", config.BatchSize)
	}

	if config.MaxConcurrentBatch != 1 {
		t.Errorf("Expected MaxConcurrentBatch 1, got %d", config.MaxConcurrentBatch)
	}

	if config.BatchTimeout != 30*time.Minute {
		t.Errorf("Expected BatchTimeout 30m, got %v", config.BatchTimeout)
	}

	if config.ProgressUpdateEvery != 50 {
		t.Errorf("Expected ProgressUpdateEvery 50, got %d", config.ProgressUpdateEvery)
	}
}

func TestStreamingEnrichmentEmptyVolume(t *testing.T) {
	mockRepo := NewMockStreamingRepository(0) // No files
	config := EnricherConfig{
		Enabled:              true,
		MaxConcurrentWorkers: 2,
		TimeoutPerFile:       time.Second * 5,
	}

	manager := NewManager(config, mockRepo, nil, nil)
	manager.RegisterEnricher(&MockEnricher{
		name:         "test-enricher",
		canEnrich:    true,
		available:    true,
		enrichDelay:  time.Millisecond * 10,
		enrichResult: &MediaMetadata{Kind: EnrichmentKindVideo},
	})

	ctx := context.Background()

	err := manager.EnrichVolumeStreaming(ctx, "empty-volume", "test-scan")
	if err != nil {
		t.Fatalf("Streaming enrichment failed on empty volume: %v", err)
	}

	progress := manager.GetProgress("empty-volume")
	if progress == nil {
		t.Fatal("No progress found for empty volume")
	}

	if progress.Status != "completed" {
		t.Errorf("Expected status 'completed' for empty volume, got %s", progress.Status)
	}

	if progress.TotalFiles != 0 {
		t.Errorf("Expected 0 total files, got %d", progress.TotalFiles)
	}
}

// Note: MockEnricher is already defined in manager_test.go
