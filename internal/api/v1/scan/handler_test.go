package scan

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/mantonx/volumeviz/internal/api/models"
	"github.com/mantonx/volumeviz/internal/core/interfaces"
	coremodels "github.com/mantonx/volumeviz/internal/core/models"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
)

// MockVolumeScanner implements interfaces.VolumeScanner for testing
type MockVolumeScanner struct {
	mock.Mock
}

func (m *MockVolumeScanner) ScanVolume(ctx context.Context, volumeID string) (*interfaces.ScanResult, error) {
	args := m.Called(ctx, volumeID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*interfaces.ScanResult), args.Error(1)
}

func (m *MockVolumeScanner) ScanVolumeAsync(ctx context.Context, volumeID string) (string, error) {
	args := m.Called(ctx, volumeID)
	return args.String(0), args.Error(1)
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

func setupTestRouter(scanner interfaces.VolumeScanner) *gin.Engine {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	handler := NewHandler(scanner)
	
	r.GET("/volumes/:id/size", handler.GetVolumeSize)
	r.POST("/volumes/:id/size/refresh", handler.RefreshVolumeSize)
	r.POST("/volumes/bulk-scan", handler.BulkScan)
	r.GET("/scans/:id/status", handler.GetScanStatus)
	r.GET("/scan-methods", handler.GetScanMethods)
	
	return r
}

func TestHandler_GetVolumeSize_Success(t *testing.T) {
	mockScanner := &MockVolumeScanner{}
	router := setupTestRouter(mockScanner)
	
	expectedResult := &interfaces.ScanResult{
		VolumeID:  "test-volume",
		TotalSize: 1024000,
		Method:    "du",
		CacheHit:  false,
		ScannedAt: time.Now(),
		Duration:  2 * time.Second,
	}
	
	mockScanner.On("ScanVolume", mock.Anything, "test-volume").Return(expectedResult, nil)
	
	req, _ := http.NewRequest("GET", "/volumes/test-volume/size", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)
	
	assert.Equal(t, http.StatusOK, w.Code)
	
	var response models.ScanResponse
	err := json.Unmarshal(w.Body.Bytes(), &response)
	assert.NoError(t, err)
	assert.Equal(t, "test-volume", response.VolumeID)
	assert.NotNil(t, response.Result)
	assert.Equal(t, int64(1024000), response.Result.TotalSize)
	assert.Equal(t, "du", response.Result.Method)
	
	mockScanner.AssertExpectations(t)
}

func TestHandler_GetVolumeSize_MissingVolumeID(t *testing.T) {
	mockScanner := &MockVolumeScanner{}
	router := setupTestRouter(mockScanner)
	
	req, _ := http.NewRequest("GET", "/volumes//size", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)
	
	assert.Equal(t, http.StatusBadRequest, w.Code)
	
	var response models.ErrorResponse
	err := json.Unmarshal(w.Body.Bytes(), &response)
	assert.NoError(t, err)
	assert.Equal(t, "Volume ID is required", response.Error)
	assert.Equal(t, "MISSING_VOLUME_ID", response.Code)
}

func TestHandler_GetVolumeSize_ScanError(t *testing.T) {
	mockScanner := &MockVolumeScanner{}
	router := setupTestRouter(mockScanner)
	
	scanError := &coremodels.ScanError{
		VolumeID: "test-volume",
		Method:   "du",
		Code:     coremodels.ErrorCodeVolumeNotFound,
		Message:  "Volume not found",
		Context:  map[string]any{"volume_id": "test-volume"},
	}
	
	mockScanner.On("ScanVolume", mock.Anything, "test-volume").Return(nil, scanError)
	
	req, _ := http.NewRequest("GET", "/volumes/test-volume/size", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)
	
	assert.Equal(t, http.StatusNotFound, w.Code)
	
	var response map[string]interface{}
	err := json.Unmarshal(w.Body.Bytes(), &response)
	assert.NoError(t, err)
	assert.Equal(t, "Volume not found", response["error"])
	assert.Equal(t, coremodels.ErrorCodeVolumeNotFound, response["code"])
	assert.Contains(t, response, "suggestion")
	
	mockScanner.AssertExpectations(t)
}

func TestHandler_RefreshVolumeSize_Sync(t *testing.T) {
	mockScanner := &MockVolumeScanner{}
	router := setupTestRouter(mockScanner)
	
	expectedResult := &interfaces.ScanResult{
		VolumeID:  "test-volume",
		TotalSize: 2048000,
		Method:    "diskus",
		CacheHit:  false,
		ScannedAt: time.Now(),
		Duration:  1 * time.Second,
	}
	
	mockScanner.On("ClearCache", "test-volume").Return(nil)
	mockScanner.On("ScanVolume", mock.Anything, "test-volume").Return(expectedResult, nil)
	
	refreshReq := coremodels.RefreshRequest{Async: false}
	reqBody, _ := json.Marshal(refreshReq)
	
	req, _ := http.NewRequest("POST", "/volumes/test-volume/size/refresh", bytes.NewBuffer(reqBody))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)
	
	assert.Equal(t, http.StatusOK, w.Code)
	
	var response map[string]interface{}
	err := json.Unmarshal(w.Body.Bytes(), &response)
	assert.NoError(t, err)
	assert.Equal(t, "Volume size refreshed", response["message"])
	assert.Contains(t, response, "result")
	
	mockScanner.AssertExpectations(t)
}

func TestHandler_RefreshVolumeSize_Async(t *testing.T) {
	mockScanner := &MockVolumeScanner{}
	router := setupTestRouter(mockScanner)
	
	mockScanner.On("ScanVolumeAsync", mock.Anything, "test-volume").Return("scan_123", nil)
	
	refreshReq := coremodels.RefreshRequest{Async: true}
	reqBody, _ := json.Marshal(refreshReq)
	
	req, _ := http.NewRequest("POST", "/volumes/test-volume/size/refresh", bytes.NewBuffer(reqBody))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)
	
	assert.Equal(t, http.StatusAccepted, w.Code)
	
	var response map[string]interface{}
	err := json.Unmarshal(w.Body.Bytes(), &response)
	assert.NoError(t, err)
	assert.Equal(t, "Async scan started", response["message"])
	assert.Equal(t, "scan_123", response["scan_id"])
	assert.Contains(t, response["status_url"], "scan_123")
	
	mockScanner.AssertExpectations(t)
}

func TestHandler_GetScanStatus_Success(t *testing.T) {
	mockScanner := &MockVolumeScanner{}
	router := setupTestRouter(mockScanner)
	
	expectedProgress := &interfaces.ScanProgress{
		ScanID:             "scan_123",
		VolumeID:           "test-volume",
		Status:             "running",
		Progress:           0.75,
		FilesScanned:       1500,
		CurrentPath:        "/mnt/test/subdir",
		EstimatedRemaining: 30 * time.Second,
		Method:             "native",
		StartedAt:          time.Now().Add(-2 * time.Minute),
	}
	
	mockScanner.On("GetScanProgress", "scan_123").Return(expectedProgress, nil)
	
	req, _ := http.NewRequest("GET", "/scans/scan_123/status", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)
	
	assert.Equal(t, http.StatusOK, w.Code)
	
	var response interfaces.ScanProgress
	err := json.Unmarshal(w.Body.Bytes(), &response)
	assert.NoError(t, err)
	assert.Equal(t, "scan_123", response.ScanID)
	assert.Equal(t, "test-volume", response.VolumeID)
	assert.Equal(t, "running", response.Status)
	assert.Equal(t, 0.75, response.Progress)
	
	mockScanner.AssertExpectations(t)
}

func TestHandler_BulkScan_Sync(t *testing.T) {
	mockScanner := &MockVolumeScanner{}
	router := setupTestRouter(mockScanner)
	
	result1 := &interfaces.ScanResult{VolumeID: "vol1", TotalSize: 1024}
	result2 := &interfaces.ScanResult{VolumeID: "vol2", TotalSize: 2048}
	
	mockScanner.On("ScanVolume", mock.Anything, "vol1").Return(result1, nil)
	mockScanner.On("ScanVolume", mock.Anything, "vol2").Return(result2, nil)
	
	bulkReq := models.BulkScanRequest{
		VolumeIDs: []string{"vol1", "vol2"},
		Async:     false,
	}
	reqBody, _ := json.Marshal(bulkReq)
	
	req, _ := http.NewRequest("POST", "/volumes/bulk-scan", bytes.NewBuffer(reqBody))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)
	
	assert.Equal(t, http.StatusOK, w.Code)
	
	var response models.BulkScanResponse
	err := json.Unmarshal(w.Body.Bytes(), &response)
	assert.NoError(t, err)
	assert.Equal(t, 2, response.Total)
	assert.Equal(t, 2, response.Success)
	assert.Equal(t, 0, response.Failures)
	assert.Len(t, response.Results, 2)
	assert.Len(t, response.Failed, 0)
	
	mockScanner.AssertExpectations(t)
}

func TestHandler_GetScanMethods(t *testing.T) {
	mockScanner := &MockVolumeScanner{}
	router := setupTestRouter(mockScanner)
	
	expectedMethods := []interfaces.MethodInfo{
		{
			Name:        "diskus",
			Available:   true,
			Description: "Fast directory scanning using diskus",
			Performance: "fast",
			Accuracy:    "high",
			Features:    []string{"fast", "external_tool"},
		},
		{
			Name:        "du",
			Available:   true,
			Description: "Reliable du-based scanning",
			Performance: "medium",
			Accuracy:    "high",
			Features:    []string{"reliable", "standard_tool"},
		},
	}
	
	mockScanner.On("GetAvailableMethods").Return(expectedMethods)
	
	req, _ := http.NewRequest("GET", "/scan-methods", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)
	
	assert.Equal(t, http.StatusOK, w.Code)
	
	var response map[string]interface{}
	err := json.Unmarshal(w.Body.Bytes(), &response)
	assert.NoError(t, err)
	
	methods := response["methods"].([]interface{})
	assert.Len(t, methods, 2)
	assert.Equal(t, float64(2), response["total"])
	
	mockScanner.AssertExpectations(t)
}