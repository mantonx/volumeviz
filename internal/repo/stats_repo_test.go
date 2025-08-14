package repo

import (
	"context"
	"database/sql"
	"testing"
	"time"

	"github.com/mantonx/volumeviz/internal/db/sqlc"
	"github.com/mantonx/volumeviz/internal/models"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
)

// MockQueries implements the sqlc.Querier interface for testing
type MockQueries struct {
	mock.Mock
}

func (m *MockQueries) CreateDailyStat(ctx context.Context, arg sqlc.CreateDailyStatParams) (sqlc.CreateDailyStatRow, error) {
	args := m.Called(ctx, arg)
	return args.Get(0).(sqlc.CreateDailyStatRow), args.Error(1)
}

func (m *MockQueries) GetDailyStatsForDate(ctx context.Context, arg sqlc.GetDailyStatsForDateParams) ([]sqlc.StatsDailyRow, error) {
	args := m.Called(ctx, arg)
	return args.Get(0).([]sqlc.StatsDailyRow), args.Error(1)
}

func (m *MockQueries) GetVolumeStatsHistory(ctx context.Context, arg sqlc.GetVolumeStatsHistoryParams) ([]sqlc.StatsDailyRow, error) {
	args := m.Called(ctx, arg)
	return args.Get(0).([]sqlc.StatsDailyRow), args.Error(1)
}

func (m *MockQueries) GetFolderGrowthTrends(ctx context.Context, arg sqlc.GetFolderGrowthTrendsParams) ([]sqlc.GetFolderGrowthTrendsRow, error) {
	args := m.Called(ctx, arg)
	return args.Get(0).([]sqlc.GetFolderGrowthTrendsRow), args.Error(1)
}

func (m *MockQueries) GetTopGrowingFolders(ctx context.Context, arg sqlc.GetTopGrowingFoldersParams) ([]sqlc.GetTopGrowingFoldersRow, error) {
	args := m.Called(ctx, arg)
	return args.Get(0).([]sqlc.GetTopGrowingFoldersRow), args.Error(1)
}

func (m *MockQueries) GetMediaKindComposition(ctx context.Context, arg sqlc.GetMediaKindCompositionParams) ([]sqlc.GetMediaKindCompositionRow, error) {
	args := m.Called(ctx, arg)
	return args.Get(0).([]sqlc.GetMediaKindCompositionRow), args.Error(1)
}

func (m *MockQueries) GetTrendAnalysis(ctx context.Context, arg sqlc.GetTrendAnalysisParams) ([]sqlc.StatsDailyTrendsRow, error) {
	args := m.Called(ctx, arg)
	return args.Get(0).([]sqlc.StatsDailyTrendsRow), args.Error(1)
}

func (m *MockQueries) GetLatestVolumeStats(ctx context.Context, volumeID string) (sqlc.StatsDailyRow, error) {
	args := m.Called(ctx, volumeID)
	return args.Get(0).(sqlc.StatsDailyRow), args.Error(1)
}

func (m *MockQueries) ComputeVolumeDailyStats(ctx context.Context, arg sqlc.ComputeVolumeDailyStatsParams) error {
	args := m.Called(ctx, arg)
	return args.Error(0)
}

func (m *MockQueries) GetMissingStatsDates(ctx context.Context, arg sqlc.GetMissingStatsDatesParams) ([]time.Time, error) {
	args := m.Called(ctx, arg)
	return args.Get(0).([]time.Time), args.Error(1)
}

func (m *MockQueries) RefreshDailySummaryView(ctx context.Context) error {
	args := m.Called(ctx)
	return args.Error(0)
}

func (m *MockQueries) CreateStatsJob(ctx context.Context, arg sqlc.CreateStatsJobParams) (int64, error) {
	args := m.Called(ctx, arg)
	return args.Get(0).(int64), args.Error(1)
}

func (m *MockQueries) UpdateStatsJob(ctx context.Context, arg sqlc.UpdateStatsJobParams) error {
	args := m.Called(ctx, arg)
	return args.Error(0)
}

func (m *MockQueries) GetJobStatus(ctx context.Context, id int64) (sqlc.StatsJobsRow, error) {
	args := m.Called(ctx, id)
	return args.Get(0).(sqlc.StatsJobsRow), args.Error(1)
}

func (m *MockQueries) GetRecentJobs(ctx context.Context, arg sqlc.GetRecentJobsParams) ([]sqlc.StatsJobsRow, error) {
	args := m.Called(ctx, arg)
	return args.Get(0).([]sqlc.StatsJobsRow), args.Error(1)
}

func (m *MockQueries) GetJobMetrics(ctx context.Context, arg sqlc.GetJobMetricsParams) (sqlc.GetJobMetricsRow, error) {
	args := m.Called(ctx, arg)
	return args.Get(0).(sqlc.GetJobMetricsRow), args.Error(1)
}

// Test fixtures for sqlc types
func createTestSqlcStatsDailyRow() sqlc.StatsDailyRow {
	baseDate := time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC)
	return sqlc.StatsDailyRow{
		ID:           1,
		Date:         timeToPgDate(baseDate),
		VolumeID:     "test-volume",
		FolderID:     pgtype.Int8{Valid: false},
		MediaKind:    pgtype.Text{Valid: false},
		FilesCount:   1000,
		TotalBytes:   1024 * 1024 * 100,
		AddedBytes:   1024 * 1024 * 100,
		RemovedBytes: 0,
		AddedFiles:   1000,
		RemovedFiles: 0,
		ComputedAt:   baseDate,
		ScanID:       pgtype.Text{String: "scan-1", Valid: true},
	}
}

func createTestSqlcTrendAnalysisRow() sqlc.StatsDailyTrendsRow {
	baseDate := time.Date(2024, 1, 3, 0, 0, 0, 0, time.UTC)
	return sqlc.StatsDailyTrendsRow{
		Date:               timeToPgDate(baseDate),
		VolumeID:           "test-volume",
		FolderID:           pgtype.Int8{Valid: false},
		MediaKind:          pgtype.Text{Valid: false},
		FilesCount:         1200,
		TotalBytes:         1024 * 1024 * 125,
		AddedBytes:         1024 * 1024 * 20,
		RemovedBytes:       1024 * 1024 * 5,
		BytesChange7d:      1024 * 1024 * 25,
		FilesChange7d:      200,
		BytesChange30d:     pgtype.Int8{Valid: false},
		FilesChange30d:     pgtype.Int8{Valid: false},
		BytesGrowthRate7d:  pgtype.Numeric{Valid: true},
		BytesGrowthRate30d: pgtype.Numeric{Valid: false},
		ComputedAt:         baseDate,
	}
}

func TestNewStatsRepo(t *testing.T) {
	mockQueries := &MockQueries{}
	
	repo := NewStatsRepo(mockQueries)
	
	assert.NotNil(t, repo)
	assert.Equal(t, mockQueries, repo.queries)
}

func TestStatsRepo_CreateDailyStat(t *testing.T) {
	mockQueries := &MockQueries{}
	repo := NewStatsRepo(mockQueries)
	
	ctx := context.Background()
	params := models.CreateDailyStatParams{
		Date:           time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC),
		VolumeID:       "test-volume",
		FolderID:       nil,
		MediaKind:      nil,
		FilesCount:     1000,
		TotalBytes:     1024 * 1024 * 100,
		AddedBytes:     1024 * 1024 * 100,
		RemovedBytes:   0,
		AddedFiles:     1000,
		RemovedFiles:   0,
		ComputedAt:     time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC),
		ScanID:         stringPtr("scan-1"),
		JobDurationMs:  int64Ptr(30000),
	}

	expectedRow := sqlc.CreateDailyStatRow{
		ID:         1,
		ComputedAt: params.ComputedAt,
	}

	// Mock expectations
	mockQueries.On("CreateDailyStat", ctx, mock.MatchedBy(func(arg sqlc.CreateDailyStatParams) bool {
		return arg.VolumeID == "test-volume" && arg.FilesCount == 1000
	})).Return(expectedRow, nil)

	// Execute
	result, err := repo.CreateDailyStat(ctx, params)

	// Assert
	assert.NoError(t, err)
	require.NotNil(t, result)
	assert.Equal(t, int64(1), result.ID)
	assert.Equal(t, params.ComputedAt, result.ComputedAt)
	mockQueries.AssertExpectations(t)
}

func TestStatsRepo_GetVolumeStatsHistory(t *testing.T) {
	mockQueries := &MockQueries{}
	repo := NewStatsRepo(mockQueries)
	
	ctx := context.Background()
	volumeID := "test-volume"
	startDate := time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC)
	endDate := time.Date(2024, 1, 3, 0, 0, 0, 0, time.UTC)

	expectedRows := []sqlc.StatsDailyRow{
		createTestSqlcStatsDailyRow(),
	}

	// Mock expectations
	mockQueries.On("GetVolumeStatsHistory", ctx, mock.MatchedBy(func(arg sqlc.GetVolumeStatsHistoryParams) bool {
		return arg.VolumeID == volumeID
	})).Return(expectedRows, nil)

	// Execute
	result, err := repo.GetVolumeStatsHistory(ctx, volumeID, startDate, endDate)

	// Assert
	assert.NoError(t, err)
	require.Len(t, result, 1)
	assert.Equal(t, volumeID, result[0].VolumeID)
	assert.Equal(t, int64(1000), result[0].FilesCount)
	assert.Equal(t, int64(1024*1024*100), result[0].TotalBytes)
	mockQueries.AssertExpectations(t)
}

func TestStatsRepo_GetTrendAnalysis(t *testing.T) {
	mockQueries := &MockQueries{}
	repo := NewStatsRepo(mockQueries)
	
	ctx := context.Background()
	volumeID := "test-volume"
	startDate := time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC)
	endDate := time.Date(2024, 1, 7, 0, 0, 0, 0, time.UTC)

	expectedRows := []sqlc.StatsDailyTrendsRow{
		createTestSqlcTrendAnalysisRow(),
	}

	// Mock expectations
	mockQueries.On("GetTrendAnalysis", ctx, mock.MatchedBy(func(arg sqlc.GetTrendAnalysisParams) bool {
		return arg.VolumeID == volumeID
	})).Return(expectedRows, nil)

	// Execute
	result, err := repo.GetTrendAnalysis(ctx, volumeID, startDate, endDate)

	// Assert
	assert.NoError(t, err)
	require.Len(t, result, 1)
	assert.Equal(t, volumeID, result[0].VolumeID)
	assert.Equal(t, int64(1200), result[0].FilesCount)
	assert.Equal(t, int64(1024*1024*125), result[0].TotalBytes)
	assert.Equal(t, int64(1024*1024*25), result[0].BytesChange7d)
	assert.Equal(t, int64(200), result[0].FilesChange7d)
	mockQueries.AssertExpectations(t)
}

func TestStatsRepo_GetTopGrowingFolders(t *testing.T) {
	mockQueries := &MockQueries{}
	repo := NewStatsRepo(mockQueries)
	
	ctx := context.Background()
	volumeID := "test-volume"
	since := time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC)
	limit := int32(10)

	expectedRows := []sqlc.GetTopGrowingFoldersRow{
		{
			FolderID:            pgtype.Int8{Int64: 1, Valid: true},
			FolderName:          "Documents",
			FolderPath:          "/data/Documents",
			TotalAddedBytes:     1024 * 1024 * 15,
			TotalAddedFiles:     100,
			AvgDailyAddedBytes:  pgtype.Numeric{Valid: true},
			DaysTracked:         3,
		},
	}

	// Mock expectations
	mockQueries.On("GetTopGrowingFolders", ctx, mock.MatchedBy(func(arg sqlc.GetTopGrowingFoldersParams) bool {
		return arg.VolumeID == volumeID && arg.Limit == limit
	})).Return(expectedRows, nil)

	// Execute
	result, err := repo.GetTopGrowingFolders(ctx, volumeID, since, limit)

	// Assert
	assert.NoError(t, err)
	require.Len(t, result, 1)
	assert.Equal(t, "Documents", result[0].FolderName)
	assert.Equal(t, "/data/Documents", result[0].FolderPath)
	assert.Equal(t, int64(1024*1024*15), result[0].TotalAddedBytes)
	assert.Equal(t, int64(100), result[0].TotalAddedFiles)
	assert.Equal(t, int64(3), result[0].DaysTracked)
	mockQueries.AssertExpectations(t)
}

func TestStatsRepo_GetMediaKindComposition(t *testing.T) {
	mockQueries := &MockQueries{}
	repo := NewStatsRepo(mockQueries)
	
	ctx := context.Background()
	volumeID := "test-volume"
	startDate := time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC)
	endDate := time.Date(2024, 1, 7, 0, 0, 0, 0, time.UTC)

	expectedRows := []sqlc.GetMediaKindCompositionRow{
		{
			MediaKind:       pgtype.Text{String: "documents", Valid: true},
			Date:            timeToPgDate(time.Date(2024, 1, 7, 0, 0, 0, 0, time.UTC)),
			FilesCount:      600,
			TotalBytes:      1024 * 1024 * 50,
			PercentOfVolume: pgtype.Numeric{Valid: true},
		},
	}

	// Mock expectations
	mockQueries.On("GetMediaKindComposition", ctx, mock.MatchedBy(func(arg sqlc.GetMediaKindCompositionParams) bool {
		return arg.VolumeID == volumeID
	})).Return(expectedRows, nil)

	// Execute
	result, err := repo.GetMediaKindComposition(ctx, volumeID, startDate, endDate)

	// Assert
	assert.NoError(t, err)
	require.Len(t, result, 1)
	assert.Equal(t, "documents", result[0].MediaKind)
	assert.Equal(t, int64(600), result[0].FilesCount)
	assert.Equal(t, int64(1024*1024*50), result[0].TotalBytes)
	mockQueries.AssertExpectations(t)
}

func TestStatsRepo_ComputeVolumeDailyStats(t *testing.T) {
	mockQueries := &MockQueries{}
	repo := NewStatsRepo(mockQueries)
	
	ctx := context.Background()
	volumeID := "test-volume"
	date := time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC)
	scanID := "scan-123"

	// Mock expectations
	mockQueries.On("ComputeVolumeDailyStats", ctx, mock.MatchedBy(func(arg sqlc.ComputeVolumeDailyStatsParams) bool {
		return arg.VolumeID == volumeID && 
			   arg.Date_2.Time.Equal(date) &&
			   arg.ScanID.String == scanID
	})).Return(nil)

	// Execute
	err := repo.ComputeVolumeDailyStats(ctx, volumeID, date, &scanID)

	// Assert
	assert.NoError(t, err)
	mockQueries.AssertExpectations(t)
}

func TestStatsRepo_GetMissingStatsDates(t *testing.T) {
	mockQueries := &MockQueries{}
	repo := NewStatsRepo(mockQueries)
	
	ctx := context.Background()
	volumeID := "test-volume"
	startDate := time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC)
	endDate := time.Date(2024, 1, 7, 0, 0, 0, 0, time.UTC)

	expectedDates := []time.Time{
		time.Date(2024, 1, 2, 0, 0, 0, 0, time.UTC),
		time.Date(2024, 1, 4, 0, 0, 0, 0, time.UTC),
	}

	// Mock expectations
	mockQueries.On("GetMissingStatsDates", ctx, mock.MatchedBy(func(arg sqlc.GetMissingStatsDatesParams) bool {
		return arg.VolumeID == volumeID
	})).Return(expectedDates, nil)

	// Execute
	result, err := repo.GetMissingStatsDates(ctx, volumeID, startDate, endDate)

	// Assert
	assert.NoError(t, err)
	assert.Equal(t, expectedDates, result)
	assert.Len(t, result, 2)
	mockQueries.AssertExpectations(t)
}

func TestStatsRepo_CreateStatsJob(t *testing.T) {
	mockQueries := &MockQueries{}
	repo := NewStatsRepo(mockQueries)
	
	ctx := context.Background()
	jobType := "scan_completion"
	volumeID := "test-volume"
	startedAt := time.Now()
	status := "running"

	expectedJobID := int64(1)

	// Mock expectations
	mockQueries.On("CreateStatsJob", ctx, mock.MatchedBy(func(arg sqlc.CreateStatsJobParams) bool {
		return arg.JobType == jobType && 
			   arg.VolumeID == volumeID && 
			   arg.Status == status
	})).Return(expectedJobID, nil)

	// Execute
	result, err := repo.CreateStatsJob(ctx, jobType, volumeID, startedAt, status)

	// Assert
	assert.NoError(t, err)
	assert.Equal(t, expectedJobID, result)
	mockQueries.AssertExpectations(t)
}

func TestStatsRepo_UpdateStatsJob(t *testing.T) {
	mockQueries := &MockQueries{}
	repo := NewStatsRepo(mockQueries)
	
	ctx := context.Background()
	now := time.Now()
	durationMs := int64(30000)
	processedDates := int32(1)
	recordsCreated := int32(5)
	recordsUpdated := int32(0)
	
	params := models.UpdateStatsJobParams{
		ID:             1,
		CompletedAt:    &now,
		DurationMs:     &durationMs,
		Status:         "completed",
		ErrorMessage:   nil,
		ProcessedDates: &processedDates,
		RecordsCreated: &recordsCreated,
		RecordsUpdated: &recordsUpdated,
	}

	// Mock expectations
	mockQueries.On("UpdateStatsJob", ctx, mock.MatchedBy(func(arg sqlc.UpdateStatsJobParams) bool {
		return arg.ID == 1 && arg.Status == "completed"
	})).Return(nil)

	// Execute
	err := repo.UpdateStatsJob(ctx, params)

	// Assert
	assert.NoError(t, err)
	mockQueries.AssertExpectations(t)
}

func TestStatsRepo_RefreshDailySummaryView(t *testing.T) {
	mockQueries := &MockQueries{}
	repo := NewStatsRepo(mockQueries)
	
	ctx := context.Background()

	// Mock expectations
	mockQueries.On("RefreshDailySummaryView", ctx).Return(nil)

	// Execute
	err := repo.RefreshDailySummaryView(ctx)

	// Assert
	assert.NoError(t, err)
	mockQueries.AssertExpectations(t)
}

// Helper functions for tests
func stringPtr(s string) *string {
	return &s
}

func int64Ptr(i int64) *int64 {
	return &i
}

func int32Ptr(i int32) *int32 {
	return &i
}