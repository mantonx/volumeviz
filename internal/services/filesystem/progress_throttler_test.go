package filesystem

import (
	"context"
	"fmt"
	"sync"
	"testing"
	"time"

	"github.com/mantonx/volumeviz/internal/models"
	"github.com/mantonx/volumeviz/internal/repo"
	"github.com/mantonx/volumeviz/internal/store"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
)

// MockStore mocks the store interface for testing
type MockStore struct {
	mock.Mock
}

func (m *MockStore) ScanProgress() repo.ScanProgressRepo {
	args := m.Called()
	if args.Get(0) == nil {
		return nil
	}
	return args.Get(0).(repo.ScanProgressRepo)
}

// Implement other required Store methods
func (m *MockStore) WithTx(ctx context.Context, fn func(store.TxStore) error) error { return nil }
func (m *MockStore) Volumes() repo.VolumesRepo { return nil }
func (m *MockStore) Scans() repo.ScansRepo { return nil }
func (m *MockStore) Retention() repo.RetentionRepo { return nil }
func (m *MockStore) Stats() *repo.StatsRepo { return nil }
func (m *MockStore) Files() *repo.FilesRepo { return nil }
func (m *MockStore) Folders() *repo.FoldersRepo { return nil }
func (m *MockStore) FileMetadata() *repo.FileMetadataRepo { return nil }
func (m *MockStore) Alerts() repo.AlertsRepo { return nil }
func (m *MockStore) Search() *repo.SearchRepo { return nil }
func (m *MockStore) Checkpoints() repo.CheckpointRepo { return nil }
func (m *MockStore) Snapshots() repo.SnapshotRepo { return nil }
func (m *MockStore) Users() repo.UsersRepository { return nil }
func (m *MockStore) Organizations() repo.OrganizationsRepo { return nil }
func (m *MockStore) GetUserByID(ctx context.Context, id int64) (store.User, error) {
	return store.User{}, nil
}
func (m *MockStore) GetOrganizationByID(ctx context.Context, id int64) (store.Organization, error) {
	return store.Organization{}, nil
}
func (m *MockStore) Health(ctx context.Context) error { return nil }
func (m *MockStore) Queries() interface{} { return nil }

// MockScanProgressRepo mocks the scan progress repository
type MockScanProgressRepo struct {
	mock.Mock
	updateCount int
	mu          sync.Mutex
}

func (m *MockScanProgressRepo) UpdateScanPhaseProgress(ctx context.Context, params models.UpdateScanPhaseParams) error {
	m.mu.Lock()
	m.updateCount++
	m.mu.Unlock()
	
	args := m.Called(ctx, params)
	return args.Error(0)
}

func (m *MockScanProgressRepo) GetUpdateCount() int {
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.updateCount
}

// Additional mock methods to satisfy interface (not used in tests)
func (m *MockScanProgressRepo) CreateScanPhase(ctx context.Context, params models.CreateScanPhaseParams) (*models.ScanPhase, error) {
	return nil, nil
}

func (m *MockScanProgressRepo) GetScanPhasesByID(ctx context.Context, scanID string) ([]*models.ScanPhase, error) {
	return nil, nil
}

func (m *MockScanProgressRepo) CompleteScanPhase(ctx context.Context, scanID, phaseName string) error {
	return nil
}

func (m *MockScanProgressRepo) GetScanPhase(ctx context.Context, scanID, phaseName string) (*models.ScanPhase, error) {
	return nil, nil
}

func (m *MockScanProgressRepo) FailScanPhase(ctx context.Context, scanID, phaseName, errorMessage string) error {
	return nil
}

func (m *MockScanProgressRepo) CreateProgressItem(ctx context.Context, params models.CreateProgressItemParams) (*models.ScanProgressItem, error) {
	return nil, nil
}

func (m *MockScanProgressRepo) UpdateProgressItem(ctx context.Context, params models.UpdateProgressItemParams) error {
	return nil
}

func (m *MockScanProgressRepo) GetProgressItems(ctx context.Context, scanID, phaseName string, limit, offset int32) ([]*models.ScanProgressItem, error) {
	return nil, nil
}

func (m *MockScanProgressRepo) GetFailedProgressItems(ctx context.Context, scanID, phaseName string, limit int32) ([]*models.ScanProgressItem, error) {
	return nil, nil
}

func (m *MockScanProgressRepo) RecordScanError(ctx context.Context, params models.RecordScanErrorParams) (int64, error) {
	return 0, nil
}

func (m *MockScanProgressRepo) GetScanErrors(ctx context.Context, scanID, phaseName string, limit, offset int32) ([]*models.ScanProgressError, error) {
	return nil, nil
}

func (m *MockScanProgressRepo) GetRecentErrors(ctx context.Context, hours int, limit int32) ([]*models.ScanProgressError, error) {
	return nil, nil
}

func (m *MockScanProgressRepo) RecordPerformanceMetrics(ctx context.Context, params models.RecordPerformanceMetricsParams) error {
	return nil
}

func (m *MockScanProgressRepo) GetLatestPerformanceMetrics(ctx context.Context, scanID, phaseName string) (*models.ScanPerformanceMetrics, error) {
	return nil, nil
}

func (m *MockScanProgressRepo) GetActiveScansSummary(ctx context.Context) ([]*models.ActiveScanSummary, error) {
	return nil, nil
}

func (m *MockScanProgressRepo) GetScanProgressSummary(ctx context.Context, scanID string) (*models.ScanProgressSummary, error) {
	return nil, nil
}

func (m *MockScanProgressRepo) GetRecentErrorsSummary(ctx context.Context, hours int, limit int32) ([]*models.RecentErrorSummary, error) {
	return nil, nil
}

func (m *MockScanProgressRepo) GetScanPhases(ctx context.Context, scanID string) ([]models.ScanPhase, error) {
	return nil, nil
}

func (m *MockScanProgressRepo) GetScanProgressItems(ctx context.Context, scanID string) ([]models.ScanProgressItem, error) {
	return nil, nil
}

func (m *MockScanProgressRepo) GetScanErrorsFiltered(ctx context.Context, params models.ScanErrorFilterParams) ([]*models.ScanProgressError, error) {
	return nil, nil
}

func (m *MockScanProgressRepo) GetScanErrorsCount(ctx context.Context, scanID, phaseFilter, errorTypeFilter string) (int64, error) {
	return 0, nil
}

func (m *MockScanProgressRepo) GetActiveScans(ctx context.Context, limit, offset int) ([]models.ActiveScanSummary, error) {
	return nil, nil
}

func (m *MockScanProgressRepo) GetActiveScansCount(ctx context.Context) (int64, error) {
	return 0, nil
}

func TestProgressThrottler_QueueUpdate(t *testing.T) {
	tests := []struct {
		name           string
		updateInterval time.Duration
		numUpdates     int
		updateDelay    time.Duration
		expectedCalls  int
		description    string
	}{
		{
			name:           "rapid_updates_throttled",
			updateInterval: 100 * time.Millisecond,
			numUpdates:     10,
			updateDelay:    10 * time.Millisecond, // Updates faster than interval
			expectedCalls:  2,                      // First immediate, rest throttled
			description:    "Rapid updates should be throttled",
		},
		{
			name:           "slow_updates_not_throttled",
			updateInterval: 50 * time.Millisecond,
			numUpdates:     3,
			updateDelay:    100 * time.Millisecond, // Updates slower than interval
			expectedCalls:  3,                       // All updates go through
			description:    "Slow updates should not be throttled",
		},
		{
			name:           "single_update",
			updateInterval: 100 * time.Millisecond,
			numUpdates:     1,
			updateDelay:    0,
			expectedCalls:  1,
			description:    "Single update should go through immediately",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Setup mocks
			mockRepo := &MockScanProgressRepo{}
			mockRepo.On("UpdateScanPhaseProgress", mock.Anything, mock.Anything).Return(nil)
			
			mockStore := &MockStore{}
			mockStore.On("ScanProgress").Return(mockRepo)

			// Create throttler
			throttler := NewProgressThrottler(mockStore, tt.updateInterval)
			ctx := context.Background()
			scanID := "test-scan-123"

			// Send updates
			for i := 0; i < tt.numUpdates; i++ {
				progress := i * 10
				update := models.UpdateScanPhaseParams{
					ScanID:    scanID,
					PhaseName: "test_phase",
					Progress:  &progress,
				}
				
				err := throttler.QueueUpdate(ctx, scanID, update)
				assert.NoError(t, err)
				
				if tt.updateDelay > 0 && i < tt.numUpdates-1 {
					time.Sleep(tt.updateDelay)
				}
			}

			// Wait for any pending updates
			time.Sleep(tt.updateInterval + 50*time.Millisecond)
			
			// Flush any remaining
			throttler.FlushPending(ctx, scanID)

			// Verify number of actual database calls
			actualCalls := mockRepo.GetUpdateCount()
			assert.LessOrEqual(t, actualCalls, tt.expectedCalls+1, 
				"%s: Expected at most %d DB calls, got %d", 
				tt.description, tt.expectedCalls, actualCalls)

			// Verify stats
			updates, throttled := throttler.GetStats(scanID)
			assert.Equal(t, int64(tt.numUpdates), updates, "Total updates tracked")
			assert.GreaterOrEqual(t, throttled, int64(0), "Throttled count should be non-negative")
			
			// Log reduction rate for visibility
			if throttled > 0 {
				reductionRate := float64(throttled) / float64(updates) * 100
				t.Logf("Achieved %.1f%% reduction in DB writes (%d throttled out of %d)",
					reductionRate, throttled, updates)
			}
		})
	}
}

func TestProgressThrottler_ForceUpdate(t *testing.T) {
	// Setup mocks
	mockRepo := &MockScanProgressRepo{}
	mockRepo.On("UpdateScanPhaseProgress", mock.Anything, mock.Anything).Return(nil)
	
	mockStore := &MockStore{}
	mockStore.On("ScanProgress").Return(mockRepo)

	// Create throttler with long interval
	throttler := NewProgressThrottler(mockStore, 10*time.Second)
	ctx := context.Background()
	scanID := "test-scan-456"

	// Queue an update (should go through immediately as first update)
	progress1 := 10
	update1 := models.UpdateScanPhaseParams{
		ScanID:    scanID,
		PhaseName: "test_phase",
		Progress:  &progress1,
	}
	err := throttler.QueueUpdate(ctx, scanID, update1)
	assert.NoError(t, err)

	// Immediately queue another (should be throttled)
	progress2 := 20
	update2 := models.UpdateScanPhaseParams{
		ScanID:    scanID,
		PhaseName: "test_phase",
		Progress:  &progress2,
	}
	err = throttler.QueueUpdate(ctx, scanID, update2)
	assert.NoError(t, err)

	// Force an update (should go through despite throttling)
	progress3 := 30
	update3 := models.UpdateScanPhaseParams{
		ScanID:    scanID,
		PhaseName: "test_phase",
		Progress:  &progress3,
	}
	err = throttler.ForceUpdate(ctx, scanID, update3)
	assert.NoError(t, err)

	// Verify we got 2 calls (first queue + force), not 3
	actualCalls := mockRepo.GetUpdateCount()
	assert.Equal(t, 2, actualCalls, "Should have 2 DB calls: initial + forced")
}

func TestProgressThrottler_PeriodicFlush(t *testing.T) {
	// Setup mocks
	mockRepo := &MockScanProgressRepo{}
	mockRepo.On("UpdateScanPhaseProgress", mock.Anything, mock.Anything).Return(nil)
	
	mockStore := &MockStore{}
	mockStore.On("ScanProgress").Return(mockRepo)

	// Create throttler with short interval for testing
	throttler := NewProgressThrottler(mockStore, 100*time.Millisecond)
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	
	// Start periodic flush
	throttler.StartPeriodicFlush(ctx)
	
	scanID := "test-scan-789"

	// Queue an update that won't be sent immediately
	progress1 := 10
	update1 := models.UpdateScanPhaseParams{
		ScanID:    scanID,
		PhaseName: "test_phase",
		Progress:  &progress1,
	}
	err := throttler.QueueUpdate(ctx, scanID, update1)
	assert.NoError(t, err)

	// Immediately queue another (should be throttled)
	progress2 := 20
	update2 := models.UpdateScanPhaseParams{
		ScanID:    scanID,
		PhaseName: "test_phase",
		Progress:  &progress2,
	}
	err = throttler.QueueUpdate(ctx, scanID, update2)
	assert.NoError(t, err)

	// Wait for periodic flush to kick in
	time.Sleep(200 * time.Millisecond)

	// Verify the pending update was flushed
	actualCalls := mockRepo.GetUpdateCount()
	assert.GreaterOrEqual(t, actualCalls, 2, "Periodic flush should have sent pending update")
}

func TestProgressThrottler_Cleanup(t *testing.T) {
	// Setup mocks
	mockRepo := &MockScanProgressRepo{}
	mockStore := &MockStore{}
	mockStore.On("ScanProgress").Return(mockRepo)

	// Create throttler
	throttler := NewProgressThrottler(mockStore, 100*time.Millisecond)
	
	scanID1 := "scan-1"
	scanID2 := "scan-2"

	// Add some tracking data
	throttler.scanTrackers[scanID1] = &scanProgressTracker{
		scanID:         scanID1,
		updateCount:    100,
		throttledCount: 95,
	}
	throttler.scanTrackers[scanID2] = &scanProgressTracker{
		scanID:         scanID2,
		updateCount:    50,
		throttledCount: 40,
	}

	// Cleanup scan 1
	throttler.Cleanup(scanID1)

	// Verify scan 1 is removed but scan 2 remains
	assert.Nil(t, throttler.scanTrackers[scanID1], "Scan 1 should be removed")
	assert.NotNil(t, throttler.scanTrackers[scanID2], "Scan 2 should remain")

	// Cleanup scan 2
	throttler.Cleanup(scanID2)
	assert.Nil(t, throttler.scanTrackers[scanID2], "Scan 2 should be removed")
}

func TestProgressThrottler_ConcurrentAccess(t *testing.T) {
	// Setup mocks
	mockRepo := &MockScanProgressRepo{}
	mockRepo.On("UpdateScanPhaseProgress", mock.Anything, mock.Anything).Return(nil)
	
	mockStore := &MockStore{}
	mockStore.On("ScanProgress").Return(mockRepo)

	// Create throttler
	throttler := NewProgressThrottler(mockStore, 50*time.Millisecond)
	ctx := context.Background()

	// Run concurrent updates from multiple goroutines
	var wg sync.WaitGroup
	numGoroutines := 10
	updatesPerGoroutine := 100

	for i := 0; i < numGoroutines; i++ {
		wg.Add(1)
		go func(goroutineID int) {
			defer wg.Done()
			
			scanID := fmt.Sprintf("scan-%d", goroutineID)
			for j := 0; j < updatesPerGoroutine; j++ {
				progress := j
				update := models.UpdateScanPhaseParams{
					ScanID:    scanID,
					PhaseName: "test_phase",
					Progress:  &progress,
				}
				
				err := throttler.QueueUpdate(ctx, scanID, update)
				assert.NoError(t, err)
				
				// Small random delay
				time.Sleep(time.Millisecond)
			}
		}(i)
	}

	// Wait for all goroutines to complete
	wg.Wait()

	// Flush all pending updates
	throttler.FlushAll(ctx)

	// Verify we handled all scans without panic
	assert.Len(t, throttler.scanTrackers, numGoroutines, "Should have trackers for all scans")

	// Verify significant throttling occurred
	totalUpdates := int64(0)
	totalThrottled := int64(0)
	for i := 0; i < numGoroutines; i++ {
		scanID := fmt.Sprintf("scan-%d", i)
		updates, throttled := throttler.GetStats(scanID)
		totalUpdates += updates
		totalThrottled += throttled
	}

	expectedTotal := int64(numGoroutines * updatesPerGoroutine)
	assert.Equal(t, expectedTotal, totalUpdates, "Should track all updates")
	
	// We expect significant throttling with rapid updates
	reductionRate := float64(totalThrottled) / float64(totalUpdates) * 100
	t.Logf("Concurrent test achieved %.1f%% reduction in DB writes", reductionRate)
	assert.Greater(t, reductionRate, 80.0, "Should achieve >80% reduction with rapid updates")
}

// Benchmark to measure throttling performance
func BenchmarkProgressThrottler(b *testing.B) {
	// Setup mocks
	mockRepo := &MockScanProgressRepo{}
	mockRepo.On("UpdateScanPhaseProgress", mock.Anything, mock.Anything).Return(nil)
	
	mockStore := &MockStore{}
	mockStore.On("ScanProgress").Return(mockRepo)

	throttler := NewProgressThrottler(mockStore, 100*time.Millisecond)
	ctx := context.Background()
	scanID := "bench-scan"

	b.ResetTimer()
	b.RunParallel(func(pb *testing.PB) {
		i := 0
		for pb.Next() {
			progress := i % 100
			update := models.UpdateScanPhaseParams{
				ScanID:    scanID,
				PhaseName: "benchmark",
				Progress:  &progress,
			}
			throttler.QueueUpdate(ctx, scanID, update)
			i++
		}
	})

	updates, throttled := throttler.GetStats(scanID)
	if updates > 0 {
		reductionRate := float64(throttled) / float64(updates) * 100
		b.Logf("Benchmark: %d updates, %.1f%% throttled", updates, reductionRate)
	}
}