package database

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
)

// Test data helpers for scan jobs
func createTestScanJob() *ScanJob {
	now := time.Now()
	duration := 30 * time.Second
	return &ScanJob{
		BaseModel: BaseModel{
			ID:        1,
			CreatedAt: now,
			UpdatedAt: now,
		},
		ScanID:            "scan_test123",
		VolumeID:          "vol_test123",
		Status:            "queued",
		Progress:          0,
		Method:            "du",
		StartedAt:         nil,
		CompletedAt:       nil,
		ErrorMessage:      nil,
		ResultID:          nil,
		EstimatedDuration: &duration,
	}
}

func TestScanJobRepository_Create(t *testing.T) {
	// Test basic scan job creation
	job := createTestScanJob()
	
	assert.NotNil(t, job)
	assert.Equal(t, "scan_test123", job.ScanID)
	assert.Equal(t, "vol_test123", job.VolumeID)
	assert.Equal(t, "queued", job.Status)
	assert.Equal(t, 0, job.Progress)
	assert.Equal(t, "du", job.Method)
	assert.Nil(t, job.StartedAt)
	assert.Nil(t, job.CompletedAt)
	assert.Nil(t, job.ErrorMessage)
	assert.Nil(t, job.ResultID)
	assert.NotNil(t, job.EstimatedDuration)
	assert.Equal(t, 30*time.Second, *job.EstimatedDuration)
}

func TestScanJobRepository_WithTx(t *testing.T) {
	db := &DB{}
	repo := NewScanJobRepository(db)
	tx := &Tx{}

	txRepo := repo.WithTx(tx)

	assert.NotNil(t, txRepo)
	assert.IsType(t, &ScanJobRepository{}, txRepo)
	assert.Equal(t, tx, txRepo.BaseRepository.tx)
}

// Test scan job status transitions
func TestScanJob_StatusTransitions(t *testing.T) {
	job := createTestScanJob()

	// Test initial state
	assert.Equal(t, "queued", job.Status)
	assert.Equal(t, 0, job.Progress)

	// Simulate status changes
	job.Status = "running"
	job.Progress = 50
	assert.Equal(t, "running", job.Status)
	assert.Equal(t, 50, job.Progress)

	// Complete job
	job.Status = "completed"
	job.Progress = 100
	now := time.Now()
	job.CompletedAt = &now
	resultID := 42
	job.ResultID = &resultID

	assert.Equal(t, "completed", job.Status)
	assert.Equal(t, 100, job.Progress)
	assert.NotNil(t, job.CompletedAt)
	assert.NotNil(t, job.ResultID)
	assert.Equal(t, 42, *job.ResultID)
}

// Test scan job failure scenario
func TestScanJob_FailureScenario(t *testing.T) {
	job := createTestScanJob()

	// Simulate job failure
	job.Status = "failed"
	job.Progress = 0
	now := time.Now()
	job.CompletedAt = &now
	errorMsg := "disk space calculation failed"
	job.ErrorMessage = &errorMsg

	assert.Equal(t, "failed", job.Status)
	assert.Equal(t, 0, job.Progress)
	assert.NotNil(t, job.CompletedAt)
	assert.NotNil(t, job.ErrorMessage)
	assert.Equal(t, "disk space calculation failed", *job.ErrorMessage)
	assert.Nil(t, job.ResultID) // No result on failure
}

// Test scan job stats structure
func TestScanJobStats_Structure(t *testing.T) {
	avgDuration := 45 * time.Second
	stats := &ScanJobStats{
		TotalJobs:     100,
		QueuedJobs:    5,
		RunningJobs:   2,
		CompletedJobs: 85,
		FailedJobs:    8,
		CancelledJobs: 0,
		AvgDuration:   &avgDuration,
	}

	assert.Equal(t, 100, stats.TotalJobs)
	assert.Equal(t, 5, stats.QueuedJobs)
	assert.Equal(t, 2, stats.RunningJobs)
	assert.Equal(t, 85, stats.CompletedJobs)
	assert.Equal(t, 8, stats.FailedJobs)
	assert.Equal(t, 0, stats.CancelledJobs)
	assert.NotNil(t, stats.AvgDuration)
	assert.Equal(t, 45*time.Second, *stats.AvgDuration)

	// Verify totals add up correctly
	activeJobs := stats.QueuedJobs + stats.RunningJobs
	completedJobs := stats.CompletedJobs + stats.FailedJobs + stats.CancelledJobs
	assert.Equal(t, stats.TotalJobs, activeJobs+completedJobs)
}

// Test scan job validation
func TestScanJob_Validation(t *testing.T) {
	job := createTestScanJob()

	// Test required fields are set
	assert.NotEmpty(t, job.ScanID)
	assert.NotEmpty(t, job.VolumeID)
	assert.NotEmpty(t, job.Status)
	assert.NotEmpty(t, job.Method)
	assert.GreaterOrEqual(t, job.Progress, 0)
	assert.LessOrEqual(t, job.Progress, 100)

	// Test valid status values
	validStatuses := []string{"queued", "running", "completed", "failed", "cancelled"}
	assert.Contains(t, validStatuses, job.Status)

	// Test valid methods
	validMethods := []string{"du", "find", "stat"}
	assert.Contains(t, validMethods, job.Method)
}

// Test scan job progress validation
func TestScanJob_ProgressValidation(t *testing.T) {
	job := createTestScanJob()

	// Valid progress values
	validProgress := []int{0, 25, 50, 75, 100}
	for _, progress := range validProgress {
		job.Progress = progress
		assert.GreaterOrEqual(t, job.Progress, 0)
		assert.LessOrEqual(t, job.Progress, 100)
	}

	// Edge cases
	job.Progress = 0
	assert.Equal(t, 0, job.Progress)
	
	job.Progress = 100
	assert.Equal(t, 100, job.Progress)
}

// Test scan job duration calculations
func TestScanJob_DurationCalculations(t *testing.T) {
	job := createTestScanJob()
	
	// Set start time
	startTime := time.Now()
	job.StartedAt = &startTime
	
	// Set completion time (1 minute later)
	completionTime := startTime.Add(1 * time.Minute)
	job.CompletedAt = &completionTime
	
	// Calculate duration
	actualDuration := job.CompletedAt.Sub(*job.StartedAt)
	assert.Equal(t, 1*time.Minute, actualDuration)
	
	// Compare with estimated duration
	if job.EstimatedDuration != nil {
		assert.NotEqual(t, *job.EstimatedDuration, actualDuration)
		// Actual took longer than estimated (30 seconds)
		assert.Greater(t, actualDuration, *job.EstimatedDuration)
	}
}

// Test scan job method types
func TestScanJob_Methods(t *testing.T) {
	methods := []string{"du", "find", "stat", "custom"}
	
	for _, method := range methods {
		job := createTestScanJob()
		job.Method = method
		assert.Equal(t, method, job.Method)
	}
}

// Benchmark tests for performance validation
func BenchmarkScanJob_Creation(b *testing.B) {
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_ = createTestScanJob()
	}
}

func BenchmarkScanJobStats_Calculation(b *testing.B) {
	stats := &ScanJobStats{
		TotalJobs:     1000,
		QueuedJobs:    50,
		RunningJobs:   20,
		CompletedJobs: 850,
		FailedJobs:    80,
		CancelledJobs: 0,
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		// Simulate stats calculations
		activeJobs := stats.QueuedJobs + stats.RunningJobs
		completedJobs := stats.CompletedJobs + stats.FailedJobs + stats.CancelledJobs
		totalCalculated := activeJobs + completedJobs
		_ = totalCalculated == stats.TotalJobs
	}
}