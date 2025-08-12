//go:build integration
// +build integration

package trends

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/mantonx/volumeviz/internal/store"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
)

// MockStore for testing trends handler
type MockStore struct {
	mock.Mock
}

// Implement the Store interface methods used by trends handler
func (m *MockStore) GetGrowthDeltas(ctx context.Context, params store.GetGrowthDeltasParams) (*store.GrowthDeltasResult, error) {
	args := m.Called(ctx, params)
	return args.Get(0).(*store.GrowthDeltasResult), args.Error(1)
}

func (m *MockStore) GetVolumeStepSeries(ctx context.Context, params store.GetVolumeStepSeriesParams) ([]*store.StepSeriesPoint, error) {
	args := m.Called(ctx, params)
	return args.Get(0).([]*store.StepSeriesPoint), args.Error(1)
}

func (m *MockStore) GetTrendSlope(ctx context.Context, params store.GetTrendSlopeParams) (*store.TrendSlopeResult, error) {
	args := m.Called(ctx, params)
	return args.Get(0).(*store.TrendSlopeResult), args.Error(1)
}

func (m *MockStore) Get7DayTrend(ctx context.Context, volumeID string) (*store.TrendData, error) {
	args := m.Called(ctx, volumeID)
	return args.Get(0).(*store.TrendData), args.Error(1)
}

func (m *MockStore) Get30DayTrend(ctx context.Context, volumeID string) (*store.TrendData, error) {
	args := m.Called(ctx, volumeID)
	return args.Get(0).(*store.TrendData), args.Error(1)
}

func (m *MockStore) CreateUsageSnapshot(ctx context.Context, params store.CreateUsageSnapshotParams) (*store.UsageSnapshot, error) {
	args := m.Called(ctx, params)
	return args.Get(0).(*store.UsageSnapshot), args.Error(1)
}

// Stub implementations for other Store interface methods not used in trends handler
func (m *MockStore) GetLatestSnapshot(ctx context.Context, volumeID, snapshotType string) (*store.UsageSnapshot, error) {
	return nil, nil
}
func (m *MockStore) CreateFileEntry(ctx context.Context, entry *store.FileEntry) (*store.FileEntry, error) {
	return nil, nil
}
func (m *MockStore) GetFileEntry(ctx context.Context, id int64, volumeID string) (*store.FileEntry, error) {
	return nil, nil
}
func (m *MockStore) GetFileEntriesByVolumeAndParent(ctx context.Context, volumeID string, parentDirID *int64) ([]*store.FileEntry, error) {
	return nil, nil
}
func (m *MockStore) GetLargestFiles(ctx context.Context, volumeID string, limit int32) ([]*store.FileEntry, error) {
	return nil, nil
}
func (m *MockStore) FindFilesByPathHash(ctx context.Context, volumeID string, pathHash []byte) ([]*store.FileEntry, error) {
	return nil, nil
}
func (m *MockStore) UpsertFileEntry(ctx context.Context, entry *store.FileEntry) (*store.FileEntry, error) {
	return nil, nil
}
func (m *MockStore) DeleteFileEntriesByVolume(ctx context.Context, volumeID string) error { return nil }
func (m *MockStore) CountFileEntriesByVolume(ctx context.Context, volumeID string) (int64, error) {
	return 0, nil
}
func (m *MockStore) GetVolumeFileStats(ctx context.Context, volumeID string) (*store.VolumeFileStats, error) {
	return nil, nil
}
func (m *MockStore) CreateDirNode(ctx context.Context, node *store.DirNode) (*store.DirNode, error) {
	return nil, nil
}
func (m *MockStore) GetDirNode(ctx context.Context, id int64, volumeID string) (*store.DirNode, error) {
	return nil, nil
}
func (m *MockStore) GetDirNodeByPath(ctx context.Context, volumeID string, fullPath string) (*store.DirNode, error) {
	return nil, nil
}
func (m *MockStore) GetChildDirNodes(ctx context.Context, volumeID string, parentDirID *int64) ([]*store.DirNode, error) {
	return nil, nil
}
func (m *MockStore) GetRootDirNodes(ctx context.Context, volumeID string) ([]*store.DirNode, error) {
	return nil, nil
}
func (m *MockStore) GetLargestDirectories(ctx context.Context, volumeID string, limit int32) ([]*store.DirNode, error) {
	return nil, nil
}
func (m *MockStore) GetDirectoryTree(ctx context.Context, volumeID string, maxDepth int32) ([]*store.DirNode, error) {
	return nil, nil
}
func (m *MockStore) UpsertDirNode(ctx context.Context, node *store.DirNode) (*store.DirNode, error) {
	return nil, nil
}
func (m *MockStore) UpdateDirNodeStats(ctx context.Context, id int64, volumeID string, sizeBytes int64, fileCount int64) error {
	return nil
}
func (m *MockStore) DeleteDirNodesByVolume(ctx context.Context, volumeID string) error { return nil }
func (m *MockStore) CountDirNodesByVolume(ctx context.Context, volumeID string) (int64, error) {
	return 0, nil
}
func (m *MockStore) CreateDirRollup(ctx context.Context, rollup *store.DirRollup) (*store.DirRollup, error) {
	return nil, nil
}
func (m *MockStore) GetDirRollup(ctx context.Context, id int64) (*store.DirRollup, error) {
	return nil, nil
}
func (m *MockStore) GetLatestDirRollup(ctx context.Context, dirID int64) (*store.DirRollup, error) {
	return nil, nil
}
func (m *MockStore) GetDirRollupHistory(ctx context.Context, dirID int64, limit int32) ([]*store.DirRollup, error) {
	return nil, nil
}
func (m *MockStore) GetDirRollupsInTimeRange(ctx context.Context, dirID int64, startTime, endTime time.Time) ([]*store.DirRollup, error) {
	return nil, nil
}
func (m *MockStore) DeleteOldRollups(ctx context.Context, cutoffTime time.Time) error { return nil }
func (m *MockStore) DeleteRollupsByDirID(ctx context.Context, dirID int64) error      { return nil }
func (m *MockStore) CountRollupsByDirID(ctx context.Context, dirID int64) (int64, error) {
	return 0, nil
}
func (m *MockStore) GetRollupStats(ctx context.Context) (*store.RollupStats, error) { return nil, nil }
func (m *MockStore) Rollup(ctx context.Context, volumeID string, opts *store.RollupOptions) (*store.RollupResult, error) {
	return nil, nil
}
func (m *MockStore) BulkInsertFileEntries(ctx context.Context, entries []*store.FileEntry, params store.BulkInsertParams) error {
	return nil
}
func (m *MockStore) BulkInsertDirNodes(ctx context.Context, nodes []*store.DirNode, params store.BulkInsertParams) error {
	return nil
}
func (m *MockStore) BulkInsertDirRollups(ctx context.Context, rollups []*store.DirRollup, params store.BulkInsertParams) error {
	return nil
}
func (m *MockStore) Close() error                     { return nil }
func (m *MockStore) Health(ctx context.Context) error { return nil }

func setupTestRouter(handler *Handler) *gin.Engine {
	gin.SetMode(gin.TestMode)
	router := gin.New()

	// Register routes
	router.GET("/trends/volumes/:volumeId/deltas", handler.GetVolumeGrowthDeltas)
	router.GET("/trends/volumes/:volumeId/series", handler.GetVolumeStepSeries)
	router.GET("/trends/volumes/:volumeId/slope", handler.GetVolumeTrendSlope)
	router.GET("/trends/volumes/:volumeId/7day", handler.Get7DayTrend)
	router.GET("/trends/volumes/:volumeId/30day", handler.Get30DayTrend)
	router.GET("/trends/summary", handler.GetAllVolumesTrendsSummary)
	router.POST("/trends/volumes/:volumeId/snapshots", handler.CreateSnapshot)

	return router
}

func TestHandler_GetVolumeGrowthDeltas(t *testing.T) {
	// Setup
	mockStore := new(MockStore)
	handler := NewHandler(mockStore)
	router := setupTestRouter(handler)

	volumeID := "test-volume"
	expectedDeltas := &store.GrowthDeltasResult{
		TotalSizeChange:      500000,
		TotalFilesChange:     250,
		AvgSizeChangePerDay:  50000.0,
		AvgFilesChangePerDay: 25.0,
		SnapshotCount:        10,
	}

	mockStore.On("GetGrowthDeltas", mock.Anything, mock.MatchedBy(func(params store.GetGrowthDeltasParams) bool {
		return params.VolumeID == volumeID &&
			params.SnapshotType == "daily" &&
			params.Limit == 30
	})).Return(expectedDeltas, nil)

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

	data := response["data"].(map[string]interface{})
	assert.Equal(t, float64(500000), data["total_size_change"])
	assert.Equal(t, float64(250), data["total_files_change"])

	mockStore.AssertExpectations(t)
}

func TestHandler_GetVolumeStepSeries(t *testing.T) {
	// Setup
	mockStore := new(MockStore)
	handler := NewHandler(mockStore)
	router := setupTestRouter(handler)

	volumeID := "test-volume"
	expectedSeries := []*store.StepSeriesPoint{
		{
			Date:       time.Now().AddDate(0, 0, -2),
			TotalSize:  1000000,
			FileCount:  500,
			GrowthRate: 100.0,
		},
		{
			Date:       time.Now().AddDate(0, 0, -1),
			TotalSize:  1100000,
			FileCount:  550,
			GrowthRate: 110.0,
		},
	}

	mockStore.On("GetVolumeStepSeries", mock.Anything, mock.MatchedBy(func(params store.GetVolumeStepSeriesParams) bool {
		return params.VolumeID == volumeID && params.SnapshotType == "daily"
	})).Return(expectedSeries, nil)

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
	assert.Equal(t, "daily", meta["snapshot_type"])
	assert.Equal(t, float64(30), meta["days"])
	assert.Equal(t, float64(2), meta["data_points"]) // Length of expectedSeries

	mockStore.AssertExpectations(t)
}

func TestHandler_Get7DayTrend(t *testing.T) {
	// Setup
	mockStore := new(MockStore)
	handler := NewHandler(mockStore)
	router := setupTestRouter(handler)

	volumeID := "test-volume"
	expectedTrend := &store.TrendData{
		AvgGrowthRate: 150.5,
		TotalGrowth:   5000,
		DataPoints:    7,
	}

	mockStore.On("Get7DayTrend", mock.Anything, volumeID).Return(expectedTrend, nil)

	// Execute
	req := httptest.NewRequest("GET", "/trends/volumes/"+volumeID+"/7day", nil)
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

	data := response["data"].(map[string]interface{})
	assert.Equal(t, float64(150.5), data["avg_growth_rate"])
	assert.Equal(t, float64(5000), data["total_growth"])
	assert.Equal(t, float64(7), data["data_points"])

	mockStore.AssertExpectations(t)
}

func TestHandler_CreateSnapshot(t *testing.T) {
	// Setup
	mockStore := new(MockStore)
	handler := NewHandler(mockStore)
	router := setupTestRouter(handler)

	volumeID := "test-volume"
	requestBody := map[string]interface{}{
		"total_size":       1000000,
		"file_count":       500,
		"directory_count":  50,
		"largest_file":     50000,
		"scan_method":      "manual",
		"scan_duration_ms": 1000,
	}

	expectedSnapshot := &store.UsageSnapshot{
		ID:             1,
		VolumeID:       volumeID,
		SnapshotDate:   time.Now().UTC().Truncate(24 * time.Hour),
		SnapshotType:   "daily",
		TotalSize:      1000000,
		FileCount:      500,
		DirectoryCount: 50,
		LargestFile:    50000,
		ScanMethod:     "manual",
		ScanDurationMs: 1000,
		CreatedAt:      time.Now(),
		UpdatedAt:      time.Now(),
	}

	mockStore.On("CreateUsageSnapshot", mock.Anything, mock.MatchedBy(func(params store.CreateUsageSnapshotParams) bool {
		return params.VolumeID == volumeID &&
			params.SnapshotType == "daily" &&
			params.TotalSize == 1000000 &&
			params.FileCount == 500 &&
			params.ScanMethod == "manual"
	})).Return(expectedSnapshot, nil)

	// Execute
	jsonBody, _ := json.Marshal(requestBody)
	req := httptest.NewRequest("POST", "/trends/volumes/"+volumeID+"/snapshots", bytes.NewBuffer(jsonBody))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	// Assert
	assert.Equal(t, http.StatusCreated, w.Code)

	var response map[string]interface{}
	err := json.Unmarshal(w.Body.Bytes(), &response)
	assert.NoError(t, err)

	// Check response structure
	assert.Contains(t, response, "data")
	assert.Contains(t, response, "meta")

	data := response["data"].(map[string]interface{})
	assert.Equal(t, volumeID, data["volume_id"])
	assert.Equal(t, "daily", data["snapshot_type"])
	assert.Equal(t, float64(1000000), data["total_size"])

	mockStore.AssertExpectations(t)
}

func TestHandler_GetAllVolumesTrendsSummary(t *testing.T) {
	// Setup
	mockStore := new(MockStore)
	handler := NewHandler(mockStore)
	router := setupTestRouter(handler)

	// Execute
	req := httptest.NewRequest("GET", "/trends/summary", nil)
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

	data := response["data"].(map[string]interface{})
	assert.Contains(t, data, "total_volumes_tracked")
	assert.Contains(t, data, "volumes_with_growth")
	assert.Contains(t, data, "period")
	assert.Contains(t, data, "generated_at")

	// No mock expectations needed since this endpoint doesn't call the store
}

func TestHandler_GetVolumeGrowthDeltas_InvalidType(t *testing.T) {
	// Setup
	mockStore := new(MockStore)
	handler := NewHandler(mockStore)
	router := setupTestRouter(handler)

	volumeID := "test-volume"

	// Execute with invalid type
	req := httptest.NewRequest("GET", "/trends/volumes/"+volumeID+"/deltas?type=invalid", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	// Assert
	assert.Equal(t, http.StatusBadRequest, w.Code)

	var response map[string]interface{}
	err := json.Unmarshal(w.Body.Bytes(), &response)
	assert.NoError(t, err)

	assert.Equal(t, "INVALID_TYPE", response["code"])
}

func TestHandler_CreateSnapshot_InvalidJSON(t *testing.T) {
	// Setup
	mockStore := new(MockStore)
	handler := NewHandler(mockStore)
	router := setupTestRouter(handler)

	volumeID := "test-volume"

	// Execute with invalid JSON
	req := httptest.NewRequest("POST", "/trends/volumes/"+volumeID+"/snapshots", bytes.NewBuffer([]byte("invalid json")))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	// Assert
	assert.Equal(t, http.StatusBadRequest, w.Code)

	var response map[string]interface{}
	err := json.Unmarshal(w.Body.Bytes(), &response)
	assert.NoError(t, err)

	assert.Equal(t, "INVALID_JSON", response["code"])
}
