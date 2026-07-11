package trends_test

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/mantonx/volumeviz/internal/api/v1/trends"
	"github.com/mantonx/volumeviz/internal/interfaces"
	"github.com/mantonx/volumeviz/internal/models"
	"github.com/mantonx/volumeviz/internal/repo"
	"github.com/mantonx/volumeviz/internal/store"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
)

// MockStatsService for testing trends handler
type MockStatsService struct {
	mock.Mock
}

func (m *MockStatsService) OnScanCompleted(ctx context.Context, volumeID string, scanID *string, fsInfo *interfaces.FilesystemInfo) error {
	args := m.Called(ctx, volumeID, scanID, fsInfo)
	return args.Error(0)
}

func (m *MockStatsService) ComputeHistoricalStats(ctx context.Context, volumeID string, startDate, endDate time.Time) error {
	args := m.Called(ctx, volumeID, startDate, endDate)
	return args.Error(0)
}

func (m *MockStatsService) GetMissingStatsDateRange(ctx context.Context, volumeID string, lookbackDays int) ([]time.Time, error) {
	args := m.Called(ctx, volumeID, lookbackDays)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]time.Time), args.Error(1)
}

func (m *MockStatsService) RefreshMaterializedViews(ctx context.Context) error {
	args := m.Called(ctx)
	return args.Error(0)
}

func (m *MockStatsService) GetStatsJobStatus(ctx context.Context, jobID int64) (*models.StatsJob, error) {
	args := m.Called(ctx, jobID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.StatsJob), args.Error(1)
}

func (m *MockStatsService) GetRecentJobs(ctx context.Context, jobType string, volumeID *string, limit int32) ([]*models.StatsJob, error) {
	args := m.Called(ctx, jobType, volumeID, limit)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]*models.StatsJob), args.Error(1)
}

func (m *MockStatsService) GetJobMetrics(ctx context.Context, jobType string, sinceDays int) (*models.JobMetrics, error) {
	args := m.Called(ctx, jobType, sinceDays)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.JobMetrics), args.Error(1)
}

func (m *MockStatsService) GetLatestVolumeStats(ctx context.Context, volumeID string) (*models.DailyStat, error) {
	args := m.Called(ctx, volumeID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.DailyStat), args.Error(1)
}

func (m *MockStatsService) GetVolumeStatsHistory(ctx context.Context, volumeID string, startDate, endDate time.Time) ([]*models.DailyStat, error) {
	args := m.Called(ctx, volumeID, startDate, endDate)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]*models.DailyStat), args.Error(1)
}

func (m *MockStatsService) GetFolderGrowthTrends(ctx context.Context, volumeID string, sinceDays int, limit int32) ([]*models.FolderGrowthTrend, error) {
	args := m.Called(ctx, volumeID, sinceDays, limit)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]*models.FolderGrowthTrend), args.Error(1)
}

func (m *MockStatsService) GetTopGrowingFolders(ctx context.Context, volumeID string, sinceDays int, limit int32) ([]*models.TopGrowingFolder, error) {
	args := m.Called(ctx, volumeID, sinceDays, limit)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]*models.TopGrowingFolder), args.Error(1)
}

func (m *MockStatsService) GetMediaKindComposition(ctx context.Context, volumeID string, startDate, endDate time.Time) ([]*models.MediaKindComposition, error) {
	args := m.Called(ctx, volumeID, startDate, endDate)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]*models.MediaKindComposition), args.Error(1)
}

func (m *MockStatsService) GetTrendAnalysis(ctx context.Context, volumeID string, startDate, endDate time.Time) ([]*models.TrendAnalysis, error) {
	args := m.Called(ctx, volumeID, startDate, endDate)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]*models.TrendAnalysis), args.Error(1)
}

// MockVolumesRepo for testing - only GetAllVolumesTrendsSummary exercises this
type MockVolumesRepo struct {
	mock.Mock
}

func (m *MockVolumesRepo) CreateVolume(ctx context.Context, organizationID int64, params models.CreateVolumeParams) (*models.Volume, error) {
	args := m.Called(ctx, organizationID, params)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.Volume), args.Error(1)
}

func (m *MockVolumesRepo) GetVolumeByID(ctx context.Context, organizationID int64, volumeID string) (*models.Volume, error) {
	args := m.Called(ctx, organizationID, volumeID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.Volume), args.Error(1)
}

func (m *MockVolumesRepo) GetVolumeByVolumeID(ctx context.Context, organizationID int64, volumeID string) (*models.Volume, error) {
	args := m.Called(ctx, organizationID, volumeID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.Volume), args.Error(1)
}

func (m *MockVolumesRepo) ListVolumes(ctx context.Context, organizationID int64, limit, offset int32) ([]*models.Volume, error) {
	args := m.Called(ctx, organizationID, limit, offset)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]*models.Volume), args.Error(1)
}

func (m *MockVolumesRepo) UpdateVolume(ctx context.Context, organizationID int64, params models.UpdateVolumeParams) (*models.Volume, error) {
	args := m.Called(ctx, organizationID, params)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.Volume), args.Error(1)
}

func (m *MockVolumesRepo) UpdateLastScanned(ctx context.Context, organizationID int64, volumeID string, lastScanned time.Time) error {
	args := m.Called(ctx, organizationID, volumeID, lastScanned)
	return args.Error(0)
}

func (m *MockVolumesRepo) SoftDeleteVolume(ctx context.Context, organizationID int64, volumeID string) error {
	args := m.Called(ctx, organizationID, volumeID)
	return args.Error(0)
}

func (m *MockVolumesRepo) HardDeleteVolume(ctx context.Context, organizationID int64, volumeID string) error {
	args := m.Called(ctx, organizationID, volumeID)
	return args.Error(0)
}

func (m *MockVolumesRepo) UpsertVolume(ctx context.Context, organizationID int64, params models.CreateVolumeParams) (*models.Volume, error) {
	args := m.Called(ctx, organizationID, params)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.Volume), args.Error(1)
}

func (m *MockVolumesRepo) GetVolumeStats(ctx context.Context, organizationID int64, volumeID string) (*models.VolumeStats, error) {
	args := m.Called(ctx, organizationID, volumeID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.VolumeStats), args.Error(1)
}

func (m *MockVolumesRepo) CountVolumes(ctx context.Context, organizationID int64) (int64, error) {
	args := m.Called(ctx, organizationID)
	return args.Get(0).(int64), args.Error(1)
}

func (m *MockVolumesRepo) CreateContainer(ctx context.Context, params models.CreateContainerParams) (*models.Container, error) {
	args := m.Called(ctx, params)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.Container), args.Error(1)
}

func (m *MockVolumesRepo) GetContainerByContainerID(ctx context.Context, containerID string) (*models.Container, error) {
	args := m.Called(ctx, containerID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.Container), args.Error(1)
}

func (m *MockVolumesRepo) UpsertContainer(ctx context.Context, params models.CreateContainerParams) (*models.Container, error) {
	args := m.Called(ctx, params)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.Container), args.Error(1)
}

func (m *MockVolumesRepo) CreateVolumeMount(ctx context.Context, params models.CreateVolumeMountParams) (*models.VolumeMount, error) {
	args := m.Called(ctx, params)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.VolumeMount), args.Error(1)
}

func (m *MockVolumesRepo) UpsertVolumeMount(ctx context.Context, params models.CreateVolumeMountParams) (*models.VolumeMount, error) {
	args := m.Called(ctx, params)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.VolumeMount), args.Error(1)
}

func (m *MockVolumesRepo) GetVolumeMountsByVolume(ctx context.Context, volumeID string) ([]*models.VolumeMount, error) {
	args := m.Called(ctx, volumeID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]*models.VolumeMount), args.Error(1)
}

func (m *MockVolumesRepo) GetVolumeByVolumeIDSystemLevel(ctx context.Context, volumeID string) (*models.Volume, error) {
	args := m.Called(ctx, volumeID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.Volume), args.Error(1)
}

func (m *MockVolumesRepo) ListAllVolumes(ctx context.Context, limit, offset int32) ([]*models.Volume, error) {
	args := m.Called(ctx, limit, offset)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]*models.Volume), args.Error(1)
}

func (m *MockVolumesRepo) SetVolumeTracked(ctx context.Context, organizationID int64, volumeID string) (*models.Volume, error) {
	args := m.Called(ctx, organizationID, volumeID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.Volume), args.Error(1)
}

func (m *MockVolumesRepo) SetVolumeUntracked(ctx context.Context, organizationID int64, volumeID string) (*models.Volume, error) {
	args := m.Called(ctx, organizationID, volumeID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.Volume), args.Error(1)
}

func (m *MockVolumesRepo) GetVolumeTrackingStatus(ctx context.Context, organizationID int64, volumeID string) (*models.VolumeTrackingStatus, error) {
	args := m.Called(ctx, organizationID, volumeID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.VolumeTrackingStatus), args.Error(1)
}

func (m *MockVolumesRepo) ListTrackedVolumes(ctx context.Context, organizationID int64, limit, offset int32) ([]*models.Volume, error) {
	args := m.Called(ctx, organizationID, limit, offset)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]*models.Volume), args.Error(1)
}

func (m *MockVolumesRepo) ListUntrackedVolumes(ctx context.Context, organizationID int64, limit, offset int32) ([]*models.Volume, error) {
	args := m.Called(ctx, organizationID, limit, offset)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]*models.Volume), args.Error(1)
}

func (m *MockVolumesRepo) CountTrackedVolumes(ctx context.Context, organizationID int64) (int64, error) {
	args := m.Called(ctx, organizationID)
	return args.Get(0).(int64), args.Error(1)
}

func (m *MockVolumesRepo) CountUntrackedVolumes(ctx context.Context, organizationID int64) (int64, error) {
	args := m.Called(ctx, organizationID)
	return args.Get(0).(int64), args.Error(1)
}

// MockStore for testing - simplified to only include methods actually used
type MockStore struct {
	mock.Mock
}

func (m *MockStore) Volumes() repo.VolumesRepo {
	args := m.Called()
	return args.Get(0).(repo.VolumesRepo)
}

func (m *MockStore) Scans() repo.ScansRepo {
	args := m.Called()
	return args.Get(0).(repo.ScansRepo)
}

func (m *MockStore) Retention() repo.RetentionRepo {
	args := m.Called()
	return args.Get(0).(repo.RetentionRepo)
}

func (m *MockStore) Stats() *repo.StatsRepo {
	args := m.Called()
	return args.Get(0).(*repo.StatsRepo)
}

func (m *MockStore) Files() *repo.FilesRepo {
	args := m.Called()
	return args.Get(0).(*repo.FilesRepo)
}

func (m *MockStore) Folders() *repo.FoldersRepo {
	args := m.Called()
	return args.Get(0).(*repo.FoldersRepo)
}

func (m *MockStore) FileMetadata() *repo.FileMetadataRepo {
	args := m.Called()
	return args.Get(0).(*repo.FileMetadataRepo)
}

func (m *MockStore) ScanProgress() repo.ScanProgressRepo {
	args := m.Called()
	return args.Get(0).(repo.ScanProgressRepo)
}

func (m *MockStore) Checkpoints() repo.CheckpointRepo {
	args := m.Called()
	return args.Get(0).(repo.CheckpointRepo)
}

func (m *MockStore) Snapshots() repo.SnapshotRepo {
	args := m.Called()
	return args.Get(0).(repo.SnapshotRepo)
}

func (m *MockStore) Alerts() repo.AlertsRepo {
	args := m.Called()
	return args.Get(0).(repo.AlertsRepo)
}

func (m *MockStore) Search() *repo.SearchRepo {
	args := m.Called()
	return args.Get(0).(*repo.SearchRepo)
}

func (m *MockStore) Users() repo.UsersRepository {
	args := m.Called()
	return args.Get(0).(repo.UsersRepository)
}

func (m *MockStore) Organizations() repo.OrganizationsRepo {
	args := m.Called()
	return args.Get(0).(repo.OrganizationsRepo)
}

func (m *MockStore) Queries() interface{} {
	args := m.Called()
	return args.Get(0)
}

func (m *MockStore) GetUserByID(ctx context.Context, id int64) (store.User, error) {
	args := m.Called(ctx, id)
	return args.Get(0).(store.User), args.Error(1)
}

func (m *MockStore) GetOrganizationByID(ctx context.Context, id int64) (store.Organization, error) {
	args := m.Called(ctx, id)
	return args.Get(0).(store.Organization), args.Error(1)
}

// Transaction methods
func (m *MockStore) WithTx(ctx context.Context, fn func(store.TxStore) error) error {
	args := m.Called(ctx, fn)
	return args.Error(0)
}

func (m *MockStore) BeginTx(ctx context.Context) (store.Store, error) {
	args := m.Called(ctx)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(store.Store), args.Error(1)
}

func (m *MockStore) CommitTx(ctx context.Context) error {
	args := m.Called(ctx)
	return args.Error(0)
}

func (m *MockStore) RollbackTx(ctx context.Context) error {
	args := m.Called(ctx)
	return args.Error(0)
}

func (m *MockStore) InTransaction() bool {
	args := m.Called()
	return args.Bool(0)
}

func (m *MockStore) Close() error {
	args := m.Called()
	return args.Error(0)
}

func (m *MockStore) Health(ctx context.Context) error {
	args := m.Called(ctx)
	return args.Error(0)
}

func setupTestRouter(handler *trends.Handler) *gin.Engine {
	gin.SetMode(gin.TestMode)
	router := gin.New()

	// Register routes
	router.GET("/trends/volumes/:volumeId", handler.GetVolumeTrends)
	router.GET("/trends/volumes/:volumeId/deltas", handler.GetVolumeGrowthDeltas)
	router.GET("/trends/volumes/:volumeId/series", handler.GetVolumeStepSeries)
	router.GET("/trends/volumes/:volumeId/slope", handler.GetVolumeTrendSlope)
	router.GET("/trends/volumes/:volumeId/7day", handler.Get7DayTrend)
	router.GET("/trends/volumes/:volumeId/30day", handler.Get30DayTrend)
	router.GET("/trends/summary", handler.GetAllVolumesTrendsSummary)

	return router
}

func TestHandler_GetVolumeTrends(t *testing.T) {
	// Setup
	mockStore := new(MockStore)
	mockStatsService := new(MockStatsService)
	handler := trends.NewHandler(mockStore, mockStatsService)
	router := setupTestRouter(handler)

	volumeID := "test-volume"
	now := time.Now()
	endDate := now.Truncate(24 * time.Hour)
	startDate := endDate.AddDate(0, 0, -30)

	// Mock data
	volumeStats := []*models.DailyStat{
		{
			ID:           1,
			Date:         endDate.AddDate(0, 0, -1),
			VolumeID:     volumeID,
			FilesCount:   1000,
			TotalBytes:   5000000,
			AddedBytes:   100000,
			RemovedBytes: 50000,
			AddedFiles:   10,
			RemovedFiles: 5,
			ComputedAt:   now,
		},
	}

	latestStats := &models.DailyStat{
		ID:         2,
		Date:       endDate,
		VolumeID:   volumeID,
		FilesCount: 1005,
		TotalBytes: 5050000,
		ComputedAt: now,
	}

	trendAnalysis := []*models.TrendAnalysis{
		{
			Date:               endDate,
			VolumeID:           volumeID,
			FilesCount:         1005,
			TotalBytes:         5050000,
			AddedBytes:         100000,
			RemovedBytes:       50000,
			BytesGrowthRate7d:  ptrString("1.5"),
			BytesGrowthRate30d: ptrString("2.5"),
			ComputedAt:         now,
		},
	}

	// Set up mocks
	mockStatsService.On("GetVolumeStatsHistory", mock.Anything, volumeID, startDate, endDate).Return(volumeStats, nil)
	mockStatsService.On("GetTrendAnalysis", mock.Anything, volumeID, startDate, endDate).Return(trendAnalysis, nil)
	mockStatsService.On("GetLatestVolumeStats", mock.Anything, volumeID).Return(latestStats, nil)
	mockStatsService.On("GetMediaKindComposition", mock.Anything, volumeID, startDate, endDate).Return([]*models.MediaKindComposition{}, nil)
	mockStatsService.On("GetTopGrowingFolders", mock.Anything, volumeID, 30, int32(10)).Return([]*models.TopGrowingFolder{}, nil)

	// Execute
	req := httptest.NewRequest("GET", "/trends/volumes/"+volumeID+"?days=30", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	// Assert
	assert.Equal(t, http.StatusOK, w.Code)

	var response map[string]interface{}
	err := json.Unmarshal(w.Body.Bytes(), &response)
	assert.NoError(t, err)

	// Check response structure - the response body itself is the trends
	// data, not wrapped in a data/meta envelope
	assert.Equal(t, volumeID, response["volume_id"])
	assert.Contains(t, response, "summary")
	assert.Contains(t, response, "daily_stats")
	assert.Contains(t, response, "trend_analysis")

	mockStatsService.AssertExpectations(t)
}

func TestHandler_GetVolumeGrowthDeltas(t *testing.T) {
	// Setup
	mockStore := new(MockStore)
	mockStatsService := new(MockStatsService)
	handler := trends.NewHandler(mockStore, mockStatsService)
	router := setupTestRouter(handler)

	volumeID := "test-volume"
	now := time.Now()
	endDate := now.Truncate(24 * time.Hour)
	startDate := endDate.AddDate(0, 0, -30)

	volumeStats := []*models.DailyStat{
		{
			Date:         endDate.AddDate(0, 0, -2),
			VolumeID:     volumeID,
			FilesCount:   1000,
			TotalBytes:   5000000,
			AddedBytes:   100000,
			RemovedBytes: 50000,
			AddedFiles:   10,
			RemovedFiles: 5,
		},
		{
			Date:         endDate.AddDate(0, 0, -1),
			VolumeID:     volumeID,
			FilesCount:   1005,
			TotalBytes:   5050000,
			AddedBytes:   75000,
			RemovedBytes: 25000,
			AddedFiles:   8,
			RemovedFiles: 3,
		},
	}

	mockStatsService.On("GetVolumeStatsHistory", mock.Anything, volumeID, startDate, endDate).Return(volumeStats, nil)

	// Execute
	req := httptest.NewRequest("GET", "/trends/volumes/"+volumeID+"/deltas", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	// Assert
	assert.Equal(t, http.StatusOK, w.Code)

	var response map[string]interface{}
	err := json.Unmarshal(w.Body.Bytes(), &response)
	assert.NoError(t, err)

	// Check response structure
	assert.Contains(t, response, "data")
	assert.Contains(t, response, "meta")

	data := response["data"].([]interface{})
	assert.Len(t, data, 2)

	// Verify first delta
	firstDelta := data[0].(map[string]interface{})
	assert.Equal(t, float64(100000), firstDelta["added_bytes"])
	assert.Equal(t, float64(50000), firstDelta["removed_bytes"])
	assert.Equal(t, float64(50000), firstDelta["net_change"])

	mockStatsService.AssertExpectations(t)
}

func TestHandler_GetVolumeStepSeries(t *testing.T) {
	// Setup
	mockStore := new(MockStore)
	mockStatsService := new(MockStatsService)
	handler := trends.NewHandler(mockStore, mockStatsService)
	router := setupTestRouter(handler)

	volumeID := "test-volume"
	now := time.Now()
	endDate := now.UTC().Truncate(24 * time.Hour)
	startDate := endDate.AddDate(0, 0, -30)

	volumeStats := []*models.DailyStat{
		{
			Date:       endDate.AddDate(0, 0, -2),
			VolumeID:   volumeID,
			FilesCount: 1000,
			TotalBytes: 5000000,
		},
		{
			Date:       endDate.AddDate(0, 0, -1),
			VolumeID:   volumeID,
			FilesCount: 1100,
			TotalBytes: 5500000,
		},
		{
			Date:       endDate,
			VolumeID:   volumeID,
			FilesCount: 1200,
			TotalBytes: 6000000,
		},
	}

	mockStatsService.On("GetVolumeStatsHistory", mock.Anything, volumeID, startDate, endDate).Return(volumeStats, nil)

	// Execute
	req := httptest.NewRequest("GET", "/trends/volumes/"+volumeID+"/series?days=30", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	// Assert
	assert.Equal(t, http.StatusOK, w.Code)

	var response map[string]interface{}
	err := json.Unmarshal(w.Body.Bytes(), &response)
	assert.NoError(t, err)

	// Check response structure
	assert.Contains(t, response, "data")
	assert.Contains(t, response, "meta")

	meta := response["meta"].(map[string]interface{})
	assert.Equal(t, volumeID, meta["volume_id"])
	assert.Equal(t, float64(30), meta["days"])
	assert.Equal(t, float64(3), meta["data_points"])

	data := response["data"].([]interface{})
	assert.Len(t, data, 3)

	mockStatsService.AssertExpectations(t)
}

func TestHandler_GetVolumeTrendSlope(t *testing.T) {
	// Setup
	mockStore := new(MockStore)
	mockStatsService := new(MockStatsService)
	handler := trends.NewHandler(mockStore, mockStatsService)
	router := setupTestRouter(handler)

	volumeID := "test-volume"
	now := time.Now()
	endDate := now.UTC().Truncate(24 * time.Hour)
	startDate := endDate.AddDate(0, 0, -30)

	trendAnalysis := []*models.TrendAnalysis{
		{
			Date:               endDate,
			VolumeID:           volumeID,
			FilesCount:         1200,
			TotalBytes:         6000000,
			BytesGrowthRate7d:  ptrString("1.5"),
			BytesGrowthRate30d: ptrString("2.5"),
			BytesChange7d:      ptrInt64(700000),
			BytesChange30d:     ptrInt64(3000000),
			FilesChange7d:      ptrInt64(70),
			FilesChange30d:     ptrInt64(300),
		},
	}

	mockStatsService.On("GetTrendAnalysis", mock.Anything, volumeID, startDate, endDate).Return(trendAnalysis, nil)

	// Execute
	req := httptest.NewRequest("GET", "/trends/volumes/"+volumeID+"/slope?days=30", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	// Assert
	assert.Equal(t, http.StatusOK, w.Code)

	var response map[string]interface{}
	err := json.Unmarshal(w.Body.Bytes(), &response)
	assert.NoError(t, err)

	// Verify data content
	data := response["data"].(map[string]interface{})
	assert.Equal(t, "2.5", data["bytes_slope"])
	assert.Equal(t, float64(30), data["period_days"])
	assert.Equal(t, "2.5", data["growth_rate_30d"])

	mockStatsService.AssertExpectations(t)
}

func TestHandler_Get7DayTrend(t *testing.T) {
	// Setup
	mockStore := new(MockStore)
	mockStatsService := new(MockStatsService)
	handler := trends.NewHandler(mockStore, mockStatsService)
	router := setupTestRouter(handler)

	volumeID := "test-volume"
	now := time.Now()
	endDate := now.Truncate(24 * time.Hour)
	startDate := endDate.AddDate(0, 0, -7)

	trendAnalysis := []*models.TrendAnalysis{
		{
			Date:              endDate,
			VolumeID:          volumeID,
			FilesCount:        1005,
			TotalBytes:        5050000,
			BytesChange7d:     ptrInt64(700000),
			FilesChange7d:     ptrInt64(70),
			BytesGrowthRate7d: ptrString("1.5"),
		},
	}

	mockStatsService.On("GetTrendAnalysis", mock.Anything, volumeID, startDate, endDate).Return(trendAnalysis, nil)

	// Execute
	req := httptest.NewRequest("GET", "/trends/volumes/"+volumeID+"/7day", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	// Assert
	assert.Equal(t, http.StatusOK, w.Code)

	var response map[string]interface{}
	err := json.Unmarshal(w.Body.Bytes(), &response)
	assert.NoError(t, err)

	// Verify data content
	data := response["data"].(map[string]interface{})
	summary := data["summary"].(map[string]interface{})
	assert.Equal(t, float64(5050000), summary["current_size"])
	assert.Equal(t, float64(1005), summary["current_files"])
	assert.Equal(t, float64(700000), summary["bytes_change_7d"])
	assert.Equal(t, "1.5", summary["bytes_growth_rate"])

	mockStatsService.AssertExpectations(t)
}

func TestHandler_Get30DayTrend(t *testing.T) {
	// Setup
	mockStore := new(MockStore)
	mockStatsService := new(MockStatsService)
	handler := trends.NewHandler(mockStore, mockStatsService)
	router := setupTestRouter(handler)

	volumeID := "test-volume"
	now := time.Now()
	endDate := now.Truncate(24 * time.Hour)
	startDate := endDate.AddDate(0, 0, -30)

	trendAnalysis := []*models.TrendAnalysis{
		{
			Date:               endDate,
			VolumeID:           volumeID,
			FilesCount:         2000,
			TotalBytes:         10000000,
			BytesChange30d:     ptrInt64(3000000),
			FilesChange30d:     ptrInt64(300),
			BytesGrowthRate30d: ptrString("2.5"),
		},
	}

	mockStatsService.On("GetTrendAnalysis", mock.Anything, volumeID, startDate, endDate).Return(trendAnalysis, nil)

	// Execute
	req := httptest.NewRequest("GET", "/trends/volumes/"+volumeID+"/30day", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	// Assert
	assert.Equal(t, http.StatusOK, w.Code)

	var response map[string]interface{}
	err := json.Unmarshal(w.Body.Bytes(), &response)
	assert.NoError(t, err)

	// Verify data content
	data := response["data"].(map[string]interface{})
	summary := data["summary"].(map[string]interface{})
	assert.Equal(t, float64(10000000), summary["current_size"])
	assert.Equal(t, float64(2000), summary["current_files"])
	assert.Equal(t, float64(3000000), summary["bytes_change_30d"])
	assert.Equal(t, "2.5", summary["bytes_growth_rate"])

	mockStatsService.AssertExpectations(t)
}

func TestHandler_ErrorCases(t *testing.T) {
	// Setup
	mockStore := new(MockStore)
	mockStatsService := new(MockStatsService)
	handler := trends.NewHandler(mockStore, mockStatsService)
	router := setupTestRouter(handler)

	// Test missing volume ID
	req := httptest.NewRequest("GET", "/trends/volumes/", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusNotFound, w.Code) // Gin will return 404 for unmatched routes

	// Test invalid type parameter
	req = httptest.NewRequest("GET", "/trends/volumes/test-volume/deltas?type=invalid", nil)
	w = httptest.NewRecorder()
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusBadRequest, w.Code)

	var response map[string]interface{}
	err := json.Unmarshal(w.Body.Bytes(), &response)
	assert.NoError(t, err)
	assert.Equal(t, "INVALID_TYPE", response["code"])
}

func TestHandler_EmptyData(t *testing.T) {
	// Setup
	mockStore := new(MockStore)
	mockStatsService := new(MockStatsService)
	handler := trends.NewHandler(mockStore, mockStatsService)
	router := setupTestRouter(handler)

	volumeID := "test-volume"
	now := time.Now()
	endDate := now.UTC().Truncate(24 * time.Hour)
	startDate := endDate.AddDate(0, 0, -30)

	// Mock returns empty data
	emptyStats := []*models.DailyStat{}
	mockStatsService.On("GetVolumeStatsHistory", mock.Anything, volumeID, startDate, endDate).Return(emptyStats, nil)

	// Execute
	req := httptest.NewRequest("GET", "/trends/volumes/"+volumeID+"/series", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	// Assert
	assert.Equal(t, http.StatusOK, w.Code)

	var response map[string]interface{}
	err := json.Unmarshal(w.Body.Bytes(), &response)
	assert.NoError(t, err)

	// Verify empty data is returned properly
	data := response["data"].([]interface{})
	assert.Len(t, data, 0)

	meta := response["meta"].(map[string]interface{})
	assert.Equal(t, float64(0), meta["data_points"])

	mockStatsService.AssertExpectations(t)
}

func TestHandler_GetVolumeTrends_CapacityForecast(t *testing.T) {
	mockStore := new(MockStore)
	mockStatsService := new(MockStatsService)
	handler := trends.NewHandler(mockStore, mockStatsService)
	router := setupTestRouter(handler)

	volumeID := "test-volume"
	now := time.Now()
	endDate := now.Truncate(24 * time.Hour)
	startDate := endDate.AddDate(0, 0, -30)

	// Most recent stat (index 0, since results are ordered by date DESC) has
	// disk capacity captured and shows a positive growth trend
	volumeStats := []*models.DailyStat{
		{
			ID:                 2,
			Date:               endDate,
			VolumeID:           volumeID,
			TotalBytes:         6000000,
			AddedBytes:         500000,
			RemovedBytes:       0,
			DiskTotalBytes:     ptrInt64(1000000000),
			DiskAvailableBytes: ptrInt64(400000000),
		},
		{
			ID:           1,
			Date:         endDate.AddDate(0, 0, -1),
			VolumeID:     volumeID,
			TotalBytes:   5500000,
			AddedBytes:   500000,
			RemovedBytes: 0,
		},
	}

	mockStatsService.On("GetVolumeStatsHistory", mock.Anything, volumeID, startDate, endDate).Return(volumeStats, nil)
	mockStatsService.On("GetTrendAnalysis", mock.Anything, volumeID, startDate, endDate).Return([]*models.TrendAnalysis{}, nil)
	mockStatsService.On("GetLatestVolumeStats", mock.Anything, volumeID).Return(volumeStats[0], nil)
	mockStatsService.On("GetMediaKindComposition", mock.Anything, volumeID, startDate, endDate).Return([]*models.MediaKindComposition{}, nil)
	mockStatsService.On("GetTopGrowingFolders", mock.Anything, volumeID, 30, int32(10)).Return([]*models.TopGrowingFolder{}, nil)

	req := httptest.NewRequest("GET", "/trends/volumes/"+volumeID+"?days=30", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)

	var response map[string]interface{}
	err := json.Unmarshal(w.Body.Bytes(), &response)
	assert.NoError(t, err)

	forecast, ok := response["capacity_forecast"].(map[string]interface{})
	assert.True(t, ok, "expected capacity_forecast object in response")

	assert.Equal(t, float64(400000000), forecast["disk_available_bytes"])
	assert.Contains(t, forecast, "days_until_capacity")
	assert.NotNil(t, forecast["days_until_capacity"])
	assert.Greater(t, forecast["days_until_capacity"], float64(0))

	series, ok := forecast["series"].([]interface{})
	assert.True(t, ok, "expected forecast series array")
	assert.Len(t, series, 90)

	mockStatsService.AssertExpectations(t)
}

func TestHandler_GetVolumeTrends_MonthlyAggregation(t *testing.T) {
	mockStore := new(MockStore)
	mockStatsService := new(MockStatsService)
	handler := trends.NewHandler(mockStore, mockStatsService)
	router := setupTestRouter(handler)

	volumeID := "test-volume"
	// Two distinct calendar months, ordered date DESC as the real query returns
	julyStats := []*models.DailyStat{
		{Date: time.Date(2026, 7, 15, 0, 0, 0, 0, time.UTC), TotalBytes: 9000000, FilesCount: 90, AddedBytes: 300000, AddedFiles: 5},
		{Date: time.Date(2026, 7, 5, 0, 0, 0, 0, time.UTC), TotalBytes: 8500000, FilesCount: 85, AddedBytes: 200000, AddedFiles: 3},
	}
	juneStats := []*models.DailyStat{
		{Date: time.Date(2026, 6, 20, 0, 0, 0, 0, time.UTC), TotalBytes: 8000000, FilesCount: 80, AddedBytes: 100000, AddedFiles: 2},
	}
	volumeStats := append(julyStats, juneStats...)

	now := time.Now()
	endDate := now.Truncate(24 * time.Hour)
	startDate := endDate.AddDate(0, 0, -60)

	mockStatsService.On("GetVolumeStatsHistory", mock.Anything, volumeID, startDate, endDate).Return(volumeStats, nil)
	mockStatsService.On("GetTrendAnalysis", mock.Anything, volumeID, startDate, endDate).Return([]*models.TrendAnalysis{}, nil)
	mockStatsService.On("GetLatestVolumeStats", mock.Anything, volumeID).Return(volumeStats[0], nil)
	mockStatsService.On("GetMediaKindComposition", mock.Anything, volumeID, startDate, endDate).Return([]*models.MediaKindComposition{}, nil)
	mockStatsService.On("GetTopGrowingFolders", mock.Anything, volumeID, 60, int32(10)).Return([]*models.TopGrowingFolder{}, nil)

	req := httptest.NewRequest("GET", "/trends/volumes/"+volumeID+"?days=60&aggregation=month", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)

	var response map[string]interface{}
	err := json.Unmarshal(w.Body.Bytes(), &response)
	assert.NoError(t, err)

	dailyStats := response["daily_stats"].([]interface{})
	assert.Len(t, dailyStats, 2, "expected the 3 daily rows to collapse into 2 monthly buckets")

	julyBucket := dailyStats[0].(map[string]interface{})
	assert.Equal(t, "2026-07-01", julyBucket["date"])
	assert.Equal(t, float64(9000000), julyBucket["total_bytes"], "bucket snapshot should use the most recent day's total, not a sum")
	assert.Equal(t, float64(500000), julyBucket["added_bytes"], "bucket deltas should sum across days in the same month")
	assert.Equal(t, float64(8), julyBucket["added_files"])

	juneBucket := dailyStats[1].(map[string]interface{})
	assert.Equal(t, "2026-06-01", juneBucket["date"])
	assert.Equal(t, float64(100000), juneBucket["added_bytes"])

	mockStatsService.AssertExpectations(t)
}

func TestHandler_GetVolumeTrends_InvalidAggregation(t *testing.T) {
	mockStore := new(MockStore)
	mockStatsService := new(MockStatsService)
	handler := trends.NewHandler(mockStore, mockStatsService)
	router := setupTestRouter(handler)

	req := httptest.NewRequest("GET", "/trends/volumes/test-volume?aggregation=hour", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestHandler_GetVolumeTrends_CapacityForecastFlatGrowth(t *testing.T) {
	mockStore := new(MockStore)
	mockStatsService := new(MockStatsService)
	handler := trends.NewHandler(mockStore, mockStatsService)
	router := setupTestRouter(handler)

	volumeID := "test-volume"
	now := time.Now()
	endDate := now.Truncate(24 * time.Hour)
	startDate := endDate.AddDate(0, 0, -30)

	// No growth at all: days_until_capacity should be omitted/null, not a
	// bogus number like 0 or a negative
	volumeStats := []*models.DailyStat{
		{
			ID:                 1,
			Date:               endDate,
			VolumeID:           volumeID,
			TotalBytes:         5000000,
			AddedBytes:         0,
			RemovedBytes:       0,
			DiskTotalBytes:     ptrInt64(1000000000),
			DiskAvailableBytes: ptrInt64(400000000),
		},
	}

	mockStatsService.On("GetVolumeStatsHistory", mock.Anything, volumeID, startDate, endDate).Return(volumeStats, nil)
	mockStatsService.On("GetTrendAnalysis", mock.Anything, volumeID, startDate, endDate).Return([]*models.TrendAnalysis{}, nil)
	mockStatsService.On("GetLatestVolumeStats", mock.Anything, volumeID).Return(volumeStats[0], nil)
	mockStatsService.On("GetMediaKindComposition", mock.Anything, volumeID, startDate, endDate).Return([]*models.MediaKindComposition{}, nil)
	mockStatsService.On("GetTopGrowingFolders", mock.Anything, volumeID, 30, int32(10)).Return([]*models.TopGrowingFolder{}, nil)

	req := httptest.NewRequest("GET", "/trends/volumes/"+volumeID+"?days=30", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)

	var response map[string]interface{}
	err := json.Unmarshal(w.Body.Bytes(), &response)
	assert.NoError(t, err)

	forecast := response["capacity_forecast"].(map[string]interface{})
	assert.Nil(t, forecast["days_until_capacity"])

	mockStatsService.AssertExpectations(t)
}

func TestHandler_GetAllVolumesTrendsSummary(t *testing.T) {
	mockStore := new(MockStore)
	mockStatsService := new(MockStatsService)
	mockVolumesRepo := new(MockVolumesRepo)
	handler := trends.NewHandler(mockStore, mockStatsService)
	router := setupTestRouter(handler)

	now := time.Now()
	endDate := now.Truncate(24 * time.Hour)
	startDate := endDate.AddDate(0, 0, -30)

	volumes := []*models.Volume{
		{VolumeID: "vol-growing"},
		{VolumeID: "vol-shrinking"},
		{VolumeID: "vol-no-stats"},
	}

	mockStore.On("Volumes").Return(mockVolumesRepo)
	mockVolumesRepo.On("ListAllVolumes", mock.Anything, int32(500), int32(0)).Return(volumes, nil)

	growingStats := []*models.DailyStat{
		{Date: endDate, TotalBytes: 6000000, AddedBytes: 1000000, RemovedBytes: 0},
		{Date: endDate.AddDate(0, 0, -1), TotalBytes: 5000000, AddedBytes: 0, RemovedBytes: 0},
	}
	shrinkingStats := []*models.DailyStat{
		{Date: endDate, TotalBytes: 4000000, AddedBytes: 0, RemovedBytes: 1000000},
		{Date: endDate.AddDate(0, 0, -1), TotalBytes: 5000000, AddedBytes: 0, RemovedBytes: 0},
	}

	mockStatsService.On("GetVolumeStatsHistory", mock.Anything, "vol-growing", startDate, endDate).Return(growingStats, nil)
	mockStatsService.On("GetVolumeStatsHistory", mock.Anything, "vol-shrinking", startDate, endDate).Return(shrinkingStats, nil)
	mockStatsService.On("GetVolumeStatsHistory", mock.Anything, "vol-no-stats", startDate, endDate).Return([]*models.DailyStat{}, nil)

	req := httptest.NewRequest("GET", "/trends/summary", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)

	var response map[string]interface{}
	err := json.Unmarshal(w.Body.Bytes(), &response)
	assert.NoError(t, err)

	assert.Equal(t, float64(3), response["total_volumes_tracked"])
	assert.Equal(t, float64(1), response["volumes_with_growth"])
	assert.Equal(t, float64(1), response["volumes_with_decline"])

	// vol-no-stats contributed nothing (skipped, no data), so only 2 of 3
	// volumes appear in the detailed breakdown
	volumesData := response["volumes"].([]interface{})
	assert.Len(t, volumesData, 2)

	mockStatsService.AssertExpectations(t)
	mockVolumesRepo.AssertExpectations(t)
}

// Helper functions
func ptrString(s string) *string {
	return &s
}

func ptrInt64(i int64) *int64 {
	return &i
}
