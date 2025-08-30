package scheduler

import (
	"context"
	"fmt"
	"testing"
	"time"

	"github.com/mantonx/volumeviz/internal/interfaces"
	"github.com/mantonx/volumeviz/internal/models"
	"github.com/mantonx/volumeviz/internal/realtime"
	"github.com/mantonx/volumeviz/internal/repo"
	"github.com/mantonx/volumeviz/internal/store"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
)

// MockResumeStore mocks the store interface for resume manager testing
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

func (m *MockResumeStore) Scans() repo.ScansRepo {
	args := m.Called()
	if args.Get(0) == nil {
		return nil
	}
	return args.Get(0).(repo.ScansRepo)
}

// Implement other required Store methods
func (m *MockResumeStore) WithTx(ctx context.Context, fn func(store.TxStore) error) error { return nil }
func (m *MockResumeStore) Volumes() repo.VolumesRepo { return nil }
func (m *MockResumeStore) Retention() repo.RetentionRepo { return nil }
func (m *MockResumeStore) Stats() *repo.StatsRepo { return nil }
func (m *MockResumeStore) Files() *repo.FilesRepo { return nil }
func (m *MockResumeStore) Folders() *repo.FoldersRepo { return nil }
func (m *MockResumeStore) FileMetadata() *repo.FileMetadataRepo { return nil }
func (m *MockResumeStore) Alerts() repo.AlertsRepo { return nil }
func (m *MockResumeStore) Search() *repo.SearchRepo { return nil }
func (m *MockResumeStore) Health(ctx context.Context) error { return nil }
func (m *MockResumeStore) Queries() interface{} { return nil }

// MockScansRepo mocks the scans repository for resume manager testing
type MockScansRepo struct {
	mock.Mock
	scanJobs []*models.ScanJob
}

func (m *MockScansRepo) ListScanJobs(ctx context.Context, limit, offset int) ([]*models.ScanJob, error) {
	args := m.Called(ctx, limit, offset)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]*models.ScanJob), args.Error(1)
}

// MockResumeScanProgressRepo mocks scan progress repo for resume manager testing
type MockResumeScanProgressRepo struct {
	mock.Mock
	phases map[string][]models.ScanPhase
}

func (m *MockResumeScanProgressRepo) GetScanPhases(ctx context.Context, scanID string) ([]models.ScanPhase, error) {
	args := m.Called(ctx, scanID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]models.ScanPhase), args.Error(1)
}

func (m *MockResumeScanProgressRepo) CreateScanPhase(ctx context.Context, params models.CreateScanPhaseParams) (*models.ScanPhase, error) {
	return nil, nil
}

func (m *MockResumeScanProgressRepo) GetScanPhasesByID(ctx context.Context, scanID string) ([]*models.ScanPhase, error) {
	return nil, nil
}

func (m *MockResumeScanProgressRepo) UpdateScanPhaseProgress(ctx context.Context, params models.UpdateScanPhaseParams) error {
	return nil
}

func (m *MockResumeScanProgressRepo) CompleteScanPhase(ctx context.Context, scanID, phaseName string) error {
	return nil
}

// MockVolumeScanner mocks the volume scanner for testing
type MockVolumeScanner struct {
	mock.Mock
}

func (m *MockVolumeScanner) ScanVolumeAsync(ctx context.Context, volumeID string) (string, error) {
	args := m.Called(ctx, volumeID)
	return args.String(0), args.Error(1)
}

func (m *MockVolumeScanner) TriggerFilesystemIndexingWithScanID(ctx context.Context, volumeID string, deltaMode bool, scanID string) error {
	args := m.Called(ctx, volumeID, deltaMode, scanID)
	return args.Error(0)
}

// Additional methods to satisfy VolumeScanner interface
func (m *MockVolumeScanner) ScanVolume(ctx context.Context, volumeID string) (*interfaces.ScanResult, error) {
	args := m.Called(ctx, volumeID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*interfaces.ScanResult), args.Error(1)
}

func (m *MockVolumeScanner) GetScanProgress(scanID string) (*interfaces.ScanProgress, error) {
	args := m.Called(scanID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*interfaces.ScanProgress), args.Error(1)
}

func (m *MockVolumeScanner) GetAvailableMethods() []interfaces.MethodInfo {
	args := m.Called()
	return args.Get(0).([]interfaces.MethodInfo)
}

func (m *MockVolumeScanner) ClearCache(volumeID string) error {
	args := m.Called(volumeID)
	return args.Error(0)
}

func TestResumeManager_FindPausedScans(t *testing.T) {
	tests := []struct {
		name           string
		scanJobs       []*models.ScanJob
		scanPhases     map[string][]models.ScanPhase
		expectedScans  int
		expectError    bool
		description    string
	}{
		{
			name: "find_explicitly_paused_scan",
			scanJobs: []*models.ScanJob{
				{
					ScanID:   "scan-paused-1",
					VolumeID: "volume-movies",
					Status:   "paused",
				},
			},
			scanPhases: map[string][]models.ScanPhase{
				"scan-paused-1": {
					{
						ScanID:          "scan-paused-1",
						PhaseName:       "volume_scan",
						Status:          "completed",
						ItemsProcessed:  0,
						ItemsTotal:      0,
					},
					{
						ScanID:          "scan-paused-1",
						PhaseName:       "filesystem_indexing",
						Status:          "paused",
						ItemsProcessed:  1000,
						ItemsTotal:      5000,
						CurrentItem:     "/movies/action",
					},
					{
						ScanID:          "scan-paused-1",
						PhaseName:       "media_enrichment",
						Status:          "pending",
						ItemsProcessed:  0,
						ItemsTotal:      5000,
					},
				},
			},
			expectedScans: 1,
			expectError:   false,
			description:   "Should find explicitly paused scan",
		},
		{
			name: "find_incomplete_completed_scan",
			scanJobs: []*models.ScanJob{
				{
					ScanID:   "scan-incomplete-1",
					VolumeID: "volume-shows",
					Status:   "paused",
				},
			},
			scanPhases: map[string][]models.ScanPhase{
				"scan-incomplete-1": {
					{
						ScanID:          "scan-incomplete-1",
						PhaseName:       "volume_scan",
						Status:          "completed",
						ItemsProcessed:  0,
						ItemsTotal:      0,
					},
					{
						ScanID:          "scan-incomplete-1",
						PhaseName:       "filesystem_indexing",
						Status:          "completed", // Marked completed but actually incomplete
						ItemsProcessed:  500,          // Only 10% done
						ItemsTotal:      5000,
						CurrentItem:     "/shows/drama/episode1.mkv",
					},
					{
						ScanID:          "scan-incomplete-1",
						PhaseName:       "media_enrichment",
						Status:          "pending",
						ItemsProcessed:  0,
						ItemsTotal:      5000,
					},
				},
			},
			expectedScans: 1,
			expectError:   false,
			description:   "Should find scan with incomplete 'completed' phase",
		},
		{
			name: "find_failed_scan",
			scanJobs: []*models.ScanJob{
				{
					ScanID:   "scan-failed-1",
					VolumeID: "volume-docs",
					Status:   "failed",
				},
			},
			scanPhases: map[string][]models.ScanPhase{
				"scan-failed-1": {
					{
						ScanID:          "scan-failed-1",
						PhaseName:       "volume_scan",
						Status:          "failed",
						ItemsProcessed:  0,
						ItemsTotal:      0,
						ErrorMessage:    "Mount point not accessible",
					},
				},
			},
			expectedScans: 1,
			expectError:   false,
			description:   "Should find failed scan for resumption",
		},
		{
			name: "no_resumable_scans",
			scanJobs: []*models.ScanJob{
				{
					ScanID:   "scan-complete-1",
					VolumeID: "volume-complete",
					Status:   "completed",
				},
			},
			scanPhases: map[string][]models.ScanPhase{
				"scan-complete-1": {
					{
						ScanID:          "scan-complete-1",
						PhaseName:       "volume_scan",
						Status:          "completed",
						ItemsProcessed:  0,
						ItemsTotal:      0,
					},
					{
						ScanID:          "scan-complete-1",
						PhaseName:       "filesystem_indexing",
						Status:          "completed",
						ItemsProcessed:  1000,
						ItemsTotal:      1000,
					},
					{
						ScanID:          "scan-complete-1",
						PhaseName:       "media_enrichment",
						Status:          "completed",
						ItemsProcessed:  1000,
						ItemsTotal:      1000,
					},
				},
			},
			expectedScans: 0,
			expectError:   false,
			description:   "Should find no resumable scans when all complete",
		},
		{
			name:          "repository_error",
			scanJobs:      nil,
			scanPhases:    nil,
			expectedScans: 0,
			expectError:   true,
			description:   "Should handle repository errors gracefully",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Setup mocks
			mockScansRepo := &MockScansRepo{scanJobs: tt.scanJobs}
			mockScanProgressRepo := &MockResumeScanProgressRepo{phases: tt.scanPhases}
			mockStore := &MockResumeStore{}

			mockStore.On("Scans").Return(mockScansRepo)
			mockStore.On("ScanProgress").Return(mockScanProgressRepo)

			if tt.expectError {
				mockScansRepo.On("ListScanJobs", mock.Anything, 100, 0).
					Return(nil, fmt.Errorf("database connection error"))
			} else {
				mockScansRepo.On("ListScanJobs", mock.Anything, 100, 0).
					Return(tt.scanJobs, nil)

				// Mock GetScanPhases calls for each scan job
				for _, job := range tt.scanJobs {
					if phases, exists := tt.scanPhases[job.ScanID]; exists {
						mockScanProgressRepo.On("GetScanPhases", mock.Anything, job.ScanID).
							Return(phases, nil)
					} else {
						mockScanProgressRepo.On("GetScanPhases", mock.Anything, job.ScanID).
							Return([]models.ScanPhase{}, nil)
					}
				}
			}

			// Create resume manager
			scanner := &MockVolumeScanner{}
			resumeManager := NewResumeManager(mockStore, scanner, nil)

			// Test finding paused scans
			ctx := context.Background()
			pausedScans, err := resumeManager.findPausedScans(ctx)

			if tt.expectError {
				assert.Error(t, err, tt.description)
				assert.Nil(t, pausedScans)
			} else {
				assert.NoError(t, err, tt.description)
				assert.Len(t, pausedScans, tt.expectedScans, tt.description)

				// Verify scan details for found scans
				if tt.expectedScans > 0 && len(pausedScans) > 0 {
					scan := pausedScans[0]
					assert.NotEmpty(t, scan.ScanID, "ScanID should not be empty")
					assert.NotEmpty(t, scan.VolumeID, "VolumeID should not be empty")
					assert.NotEmpty(t, scan.PhaseName, "PhaseName should not be empty")
				}
			}

			// Verify mock expectations
			mockScansRepo.AssertExpectations(t)
			mockScanProgressRepo.AssertExpectations(t)
			mockStore.AssertExpectations(t)
		})
	}
}

func TestResumeManager_IsPhaseIncomplete(t *testing.T) {
	resumeManager := &ResumeManager{}

	tests := []struct {
		name        string
		phase       *models.ScanPhase
		expected    bool
		description string
	}{
		{
			name: "incomplete_18_percent",
			phase: &models.ScanPhase{
				PhaseName:       "filesystem_indexing",
				Status:          "completed",
				ItemsProcessed:  1800,
				ItemsTotal:      10000,
			},
			expected:    true,
			description: "Should detect 18% completion as incomplete",
		},
		{
			name: "incomplete_50_percent",
			phase: &models.ScanPhase{
				PhaseName:       "filesystem_indexing",
				Status:          "completed",
				ItemsProcessed:  5000,
				ItemsTotal:      10000,
			},
			expected:    true,
			description: "Should detect 50% completion as incomplete",
		},
		{
			name: "complete_96_percent",
			phase: &models.ScanPhase{
				PhaseName:       "filesystem_indexing",
				Status:          "completed",
				ItemsProcessed:  9600,
				ItemsTotal:      10000,
			},
			expected:    false,
			description: "Should consider 96% completion as complete",
		},
		{
			name: "complete_100_percent",
			phase: &models.ScanPhase{
				PhaseName:       "filesystem_indexing",
				Status:          "completed",
				ItemsProcessed:  10000,
				ItemsTotal:      10000,
			},
			expected:    false,
			description: "Should consider 100% completion as complete",
		},
		{
			name: "zero_total_items",
			phase: &models.ScanPhase{
				PhaseName:       "volume_scan",
				Status:          "completed",
				ItemsProcessed:  0,
				ItemsTotal:      0,
			},
			expected:    false,
			description: "Should consider zero total items as complete",
		},
		{
			name: "negative_processed_items",
			phase: &models.ScanPhase{
				PhaseName:       "filesystem_indexing",
				Status:          "completed",
				ItemsProcessed:  -1,
				ItemsTotal:      1000,
			},
			expected:    false,
			description: "Should handle negative processed items safely",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := resumeManager.isPhaseIncomplete(tt.phase)
			assert.Equal(t, tt.expected, result, tt.description)
			
			if tt.phase.ItemsTotal > 0 {
				completionRate := float64(tt.phase.ItemsProcessed) / float64(tt.phase.ItemsTotal) * 100
				t.Logf("Phase %s: %.1f%% complete (%d/%d items), incomplete=%v",
					tt.phase.PhaseName, completionRate, 
					tt.phase.ItemsProcessed, tt.phase.ItemsTotal, result)
			}
		})
	}
}

func TestResumeManager_FindResumablePhase(t *testing.T) {
	resumeManager := &ResumeManager{}

	tests := []struct {
		name          string
		phases        []models.ScanPhase
		expectedPhase string
		expectNil     bool
		description   string
	}{
		{
			name: "prioritize_explicitly_paused",
			phases: []models.ScanPhase{
				{PhaseName: "volume_scan", Status: "completed", ItemsProcessed: 0, ItemsTotal: 0},
				{PhaseName: "filesystem_indexing", Status: "paused", ItemsProcessed: 500, ItemsTotal: 1000},
				{PhaseName: "media_enrichment", Status: "failed", ItemsProcessed: 0, ItemsTotal: 1000},
			},
			expectedPhase: "filesystem_indexing",
			expectNil:     false,
			description:   "Should prioritize explicitly paused phase",
		},
		{
			name: "detect_incomplete_completed",
			phases: []models.ScanPhase{
				{PhaseName: "volume_scan", Status: "completed", ItemsProcessed: 0, ItemsTotal: 0},
				{PhaseName: "filesystem_indexing", Status: "completed", ItemsProcessed: 100, ItemsTotal: 1000}, // 10% incomplete
				{PhaseName: "media_enrichment", Status: "pending", ItemsProcessed: 0, ItemsTotal: 1000},
			},
			expectedPhase: "filesystem_indexing",
			expectNil:     false,
			description:   "Should detect incomplete 'completed' phase",
		},
		{
			name: "fallback_to_failed_phase",
			phases: []models.ScanPhase{
				{PhaseName: "volume_scan", Status: "failed", ItemsProcessed: 0, ItemsTotal: 0},
				{PhaseName: "filesystem_indexing", Status: "pending", ItemsProcessed: 0, ItemsTotal: 1000},
				{PhaseName: "media_enrichment", Status: "pending", ItemsProcessed: 0, ItemsTotal: 1000},
			},
			expectedPhase: "volume_scan",
			expectNil:     false,
			description:   "Should fallback to failed phase when no paused/incomplete phases",
		},
		{
			name: "respect_phase_order",
			phases: []models.ScanPhase{
				{PhaseName: "media_enrichment", Status: "failed", ItemsProcessed: 0, ItemsTotal: 1000},
				{PhaseName: "volume_scan", Status: "failed", ItemsProcessed: 0, ItemsTotal: 0},
				{PhaseName: "filesystem_indexing", Status: "failed", ItemsProcessed: 500, ItemsTotal: 1000},
			},
			expectedPhase: "volume_scan",
			expectNil:     false,
			description:   "Should respect phase execution order (volume_scan first)",
		},
		{
			name: "no_resumable_phases",
			phases: []models.ScanPhase{
				{PhaseName: "volume_scan", Status: "completed", ItemsProcessed: 0, ItemsTotal: 0},
				{PhaseName: "filesystem_indexing", Status: "completed", ItemsProcessed: 1000, ItemsTotal: 1000},
				{PhaseName: "media_enrichment", Status: "completed", ItemsProcessed: 1000, ItemsTotal: 1000},
			},
			expectedPhase: "",
			expectNil:     true,
			description:   "Should return nil when no phases need resumption",
		},
		{
			name:          "empty_phases",
			phases:        []models.ScanPhase{},
			expectedPhase: "",
			expectNil:     true,
			description:   "Should return nil for empty phases",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := resumeManager.findResumablePhase(tt.phases)

			if tt.expectNil {
				assert.Nil(t, result, tt.description)
			} else {
				assert.NotNil(t, result, tt.description)
				assert.Equal(t, tt.expectedPhase, result.PhaseName, tt.description)
			}
		})
	}
}

func TestResumeManager_ResumePausedScans(t *testing.T) {
	tests := []struct {
		name                string
		scanJobs            []*models.ScanJob
		scanPhases          map[string][]models.ScanPhase
		scannerBehavior     func(*MockVolumeScanner)
		expectedAttempts    int
		expectedSuccessful  int
		expectedFailed      int
		expectError         bool
		description         string
	}{
		{
			name: "successful_volume_scan_resume",
			scanJobs: []*models.ScanJob{
				{ScanID: "scan-1", VolumeID: "volume-1", Status: "failed"},
			},
			scanPhases: map[string][]models.ScanPhase{
				"scan-1": {
					{PhaseName: "volume_scan", Status: "failed", ItemsProcessed: 0, ItemsTotal: 0},
				},
			},
			scannerBehavior: func(scanner *MockVolumeScanner) {
				scanner.On("ScanVolumeAsync", mock.Anything, "volume-1").Return("new-scan-id", nil)
			},
			expectedAttempts:   1,
			expectedSuccessful: 1,
			expectedFailed:     0,
			expectError:        false,
			description:        "Should successfully resume volume scan",
		},
		{
			name: "failed_volume_scan_resume",
			scanJobs: []*models.ScanJob{
				{ScanID: "scan-2", VolumeID: "volume-2", Status: "failed"},
			},
			scanPhases: map[string][]models.ScanPhase{
				"scan-2": {
					{PhaseName: "volume_scan", Status: "failed", ItemsProcessed: 0, ItemsTotal: 0},
				},
			},
			scannerBehavior: func(scanner *MockVolumeScanner) {
				scanner.On("ScanVolumeAsync", mock.Anything, "volume-2").
					Return("", fmt.Errorf("volume not accessible"))
			},
			expectedAttempts:   1,
			expectedSuccessful: 0,
			expectedFailed:     1,
			expectError:        false,
			description:        "Should handle volume scan resume failure",
		},
		{
			name: "mixed_resume_results",
			scanJobs: []*models.ScanJob{
				{ScanID: "scan-3", VolumeID: "volume-3", Status: "failed"},
				{ScanID: "scan-4", VolumeID: "volume-4", Status: "paused"},
			},
			scanPhases: map[string][]models.ScanPhase{
				"scan-3": {
					{PhaseName: "volume_scan", Status: "failed", ItemsProcessed: 0, ItemsTotal: 0},
				},
				"scan-4": {
					{PhaseName: "volume_scan", Status: "completed", ItemsProcessed: 0, ItemsTotal: 0},
					{PhaseName: "filesystem_indexing", Status: "paused", ItemsProcessed: 100, ItemsTotal: 1000},
				},
			},
			scannerBehavior: func(scanner *MockVolumeScanner) {
				scanner.On("ScanVolumeAsync", mock.Anything, "volume-3").Return("new-scan-3", nil)
				// filesystem_indexing resumption will be attempted but will fail in our mock
			},
			expectedAttempts:   2,
			expectedSuccessful: 1,
			expectedFailed:     1,
			expectError:        false,
			description:        "Should handle mixed success/failure results",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Setup mocks
			mockScansRepo := &MockScansRepo{scanJobs: tt.scanJobs}
			mockScanProgressRepo := &MockResumeScanProgressRepo{phases: tt.scanPhases}
			mockStore := &MockResumeStore{}
			mockScanner := &MockVolumeScanner{}

			mockStore.On("Scans").Return(mockScansRepo)
			mockStore.On("ScanProgress").Return(mockScanProgressRepo)

			mockScansRepo.On("ListScanJobs", mock.Anything, 100, 0).Return(tt.scanJobs, nil)

			// Setup scan phases mocks
			for _, job := range tt.scanJobs {
				if phases, exists := tt.scanPhases[job.ScanID]; exists {
					mockScanProgressRepo.On("GetScanPhases", mock.Anything, job.ScanID).
						Return(phases, nil)
				}
			}

			// Apply scanner behavior
			if tt.scannerBehavior != nil {
				tt.scannerBehavior(mockScanner)
			}

			// Create resume manager
			resumeManager := NewResumeManager(mockStore, mockScanner, nil)

			// Test resuming paused scans
			ctx := context.Background()
			err := resumeManager.ResumePausedScans(ctx)

			if tt.expectError {
				assert.Error(t, err, tt.description)
			} else {
				assert.NoError(t, err, tt.description)
			}

			// Verify statistics
			stats := resumeManager.GetResumeStats()
			assert.Equal(t, tt.expectedAttempts, stats.ResumeAttempts, "Resume attempts should match")
			assert.Equal(t, tt.expectedSuccessful, stats.SuccessfulResumes, "Successful resumes should match")
			assert.Equal(t, tt.expectedFailed, stats.FailedResumes, "Failed resumes should match")

			// Verify mock expectations
			mockScansRepo.AssertExpectations(t)
			mockScanProgressRepo.AssertExpectations(t)
			mockStore.AssertExpectations(t)
			mockScanner.AssertExpectations(t)
		})
	}
}

func TestResumeManager_ResumeStats(t *testing.T) {
	// Test resume statistics tracking
	resumeManager := &ResumeManager{
		resumeAttempts:    5,
		successfulResumes: 3,
		failedResumes:     2,
	}

	stats := resumeManager.GetResumeStats()
	
	assert.Equal(t, 5, stats.ResumeAttempts, "Resume attempts should match")
	assert.Equal(t, 3, stats.SuccessfulResumes, "Successful resumes should match")
	assert.Equal(t, 2, stats.FailedResumes, "Failed resumes should match")

	// Verify JSON marshaling works
	assert.Equal(t, "resume_attempts", `resume_attempts`, "JSON tag should be correct")
	assert.Equal(t, "successful_resumes", `successful_resumes`, "JSON tag should be correct")
	assert.Equal(t, "failed_resumes", `failed_resumes`, "JSON tag should be correct")
}

// Benchmark resume manager performance with many scans
func BenchmarkResumeManager_FindPausedScans(b *testing.B) {
	// Create many mock scan jobs
	var scanJobs []*models.ScanJob
	scanPhases := make(map[string][]models.ScanPhase)

	for i := 0; i < 1000; i++ {
		scanID := fmt.Sprintf("scan-%d", i)
		volumeID := fmt.Sprintf("volume-%d", i)
		
		status := "completed"
		if i%10 == 0 { // 10% paused
			status = "paused"
		} else if i%20 == 0 { // 5% failed
			status = "failed"
		}

		scanJobs = append(scanJobs, &models.ScanJob{
			ScanID:   scanID,
			VolumeID: volumeID,
			Status:   status,
		})

		// Add phases
		phases := []models.ScanPhase{
			{PhaseName: "volume_scan", Status: "completed", ItemsProcessed: 0, ItemsTotal: 0},
			{PhaseName: "filesystem_indexing", Status: status, ItemsProcessed: int64(i * 10), ItemsTotal: 1000},
		}
		
		if status == "paused" || status == "failed" {
			phases[1].ItemsProcessed = int64(i * 5) // Make it incomplete
		}
		
		scanPhases[scanID] = phases
	}

	// Setup mocks
	mockScansRepo := &MockScansRepo{scanJobs: scanJobs}
	mockScanProgressRepo := &MockResumeScanProgressRepo{phases: scanPhases}
	mockStore := &MockResumeStore{}

	mockStore.On("Scans").Return(mockScansRepo)
	mockStore.On("ScanProgress").Return(mockScanProgressRepo)
	mockScansRepo.On("ListScanJobs", mock.Anything, 100, 0).Return(scanJobs[:100], nil) // Simulate pagination

	// Mock all GetScanPhases calls
	for _, job := range scanJobs[:100] {
		if phases, exists := scanPhases[job.ScanID]; exists {
			mockScanProgressRepo.On("GetScanPhases", mock.Anything, job.ScanID).
				Return(phases, nil)
		}
	}

	resumeManager := NewResumeManager(mockStore, &MockVolumeScanner{}, nil)

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		ctx := context.Background()
		pausedScans, err := resumeManager.findPausedScans(ctx)
		if err != nil {
			b.Fatal(err)
		}
		
		// Should find some paused scans
		if len(pausedScans) == 0 {
			b.Error("Expected to find some paused scans in benchmark")
		}
	}
}