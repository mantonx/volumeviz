package scan

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/mantonx/volumeviz/internal/api/models"
	"github.com/mantonx/volumeviz/internal/core/interfaces"
	coremodels "github.com/mantonx/volumeviz/internal/core/models"
	"github.com/mantonx/volumeviz/internal/websocket"
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

// Optional interface for volume-based scan progress (used in GetScanStatus)
func (m *MockVolumeScanner) GetScanProgressByVolume(volumeID string) (*interfaces.ScanProgress, error) {
	args := m.Called(volumeID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*interfaces.ScanProgress), args.Error(1)
}

func setupTestRouter(scanner interfaces.VolumeScanner) *gin.Engine {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	handler := NewHandler(scanner, &websocket.Hub{}, nil, nil)

	r.GET("/volumes/:id/size", handler.GetVolumeSize)
	r.POST("/volumes/:id/size/refresh", handler.RefreshVolumeSize)
	r.POST("/volumes/bulk-scan", handler.BulkScan)
	r.GET("/scans/:id/status", handler.GetScanStatus)
	r.GET("/volumes/:id/scan/status", handler.GetScanStatus) // Volume-based status route
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

	var response models.ScanResponse
	err := json.Unmarshal(w.Body.Bytes(), &response)
	assert.NoError(t, err)
	assert.Equal(t, "test-volume", response.VolumeID)
	assert.NotNil(t, response.Result)
	assert.Equal(t, int64(2048000), response.Result.TotalSize)
	assert.False(t, response.Cached) // Should be false since cache was cleared

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

// Additional comprehensive test cases for better coverage

func TestHandler_RefreshVolumeSize_MissingVolumeID(t *testing.T) {
	mockScanner := &MockVolumeScanner{}
	router := setupTestRouter(mockScanner)

	req, _ := http.NewRequest("POST", "/volumes//size/refresh", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusBadRequest, w.Code)

	var response map[string]interface{}
	err := json.Unmarshal(w.Body.Bytes(), &response)
	assert.NoError(t, err)
	assert.Equal(t, "Volume ID is required", response["error"])
	assert.Equal(t, "MISSING_VOLUME_ID", response["code"])
}

func TestHandler_RefreshVolumeSize_ClearCacheError(t *testing.T) {
	mockScanner := &MockVolumeScanner{}
	router := setupTestRouter(mockScanner)

	mockScanner.On("ClearCache", "test-volume").Return(assert.AnError)

	refreshReq := coremodels.RefreshRequest{Async: false}
	reqBody, _ := json.Marshal(refreshReq)

	req, _ := http.NewRequest("POST", "/volumes/test-volume/size/refresh", bytes.NewBuffer(reqBody))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusInternalServerError, w.Code)

	var response map[string]interface{}
	err := json.Unmarshal(w.Body.Bytes(), &response)
	assert.NoError(t, err)
	assert.Equal(t, "Failed to clear cache", response["error"])

	mockScanner.AssertExpectations(t)
}

func TestHandler_RefreshVolumeSize_AsyncError(t *testing.T) {
	mockScanner := &MockVolumeScanner{}
	router := setupTestRouter(mockScanner)

	mockScanner.On("ScanVolumeAsync", mock.Anything, "test-volume").Return("", assert.AnError)

	refreshReq := coremodels.RefreshRequest{Async: true}
	reqBody, _ := json.Marshal(refreshReq)

	req, _ := http.NewRequest("POST", "/volumes/test-volume/size/refresh", bytes.NewBuffer(reqBody))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusInternalServerError, w.Code)

	mockScanner.AssertExpectations(t)
}

func TestHandler_RefreshVolumeSize_BadJSON(t *testing.T) {
	mockScanner := &MockVolumeScanner{}
	router := setupTestRouter(mockScanner)

	// Test with invalid JSON - should default to sync (Async: false)
	mockScanner.On("ClearCache", "test-volume").Return(nil)
	expectedResult := &interfaces.ScanResult{
		VolumeID:  "test-volume",
		TotalSize: 1024,
		Method:    "du",
		ScannedAt: time.Now(),
	}
	mockScanner.On("ScanVolume", mock.Anything, "test-volume").Return(expectedResult, nil)

	req, _ := http.NewRequest("POST", "/volumes/test-volume/size/refresh", bytes.NewBuffer([]byte("invalid json")))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)

	mockScanner.AssertExpectations(t)
}

func TestHandler_GetScanStatus_MissingID(t *testing.T) {
	mockScanner := &MockVolumeScanner{}
	router := setupTestRouter(mockScanner)

	req, _ := http.NewRequest("GET", "/scans//status", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusBadRequest, w.Code)

	var response map[string]interface{}
	err := json.Unmarshal(w.Body.Bytes(), &response)
	assert.NoError(t, err)
	assert.Equal(t, "ID is required", response["error"])
	assert.Equal(t, "MISSING_ID", response["code"])
}

func TestHandler_GetScanStatus_NotFound(t *testing.T) {
	mockScanner := &MockVolumeScanner{}
	router := setupTestRouter(mockScanner)

	mockScanner.On("GetScanProgress", "scan_123").Return(nil, assert.AnError)

	req, _ := http.NewRequest("GET", "/scans/scan_123/status", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusNotFound, w.Code)

	var response map[string]interface{}
	err := json.Unmarshal(w.Body.Bytes(), &response)
	assert.NoError(t, err)
	assert.Equal(t, "Scan not found", response["error"])
	assert.Equal(t, "SCAN_NOT_FOUND", response["code"])

	mockScanner.AssertExpectations(t)
}

func TestHandler_BulkScan_EmptyVolumeList(t *testing.T) {
	mockScanner := &MockVolumeScanner{}
	router := setupTestRouter(mockScanner)

	bulkReq := models.BulkScanRequest{
		VolumeIDs: []string{},
		Async:     false,
	}
	reqBody, _ := json.Marshal(bulkReq)

	req, _ := http.NewRequest("POST", "/volumes/bulk-scan", bytes.NewBuffer(reqBody))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusBadRequest, w.Code)

	var response map[string]interface{}
	err := json.Unmarshal(w.Body.Bytes(), &response)
	assert.NoError(t, err)
	assert.Equal(t, "At least one volume ID is required", response["error"])
	assert.Equal(t, "EMPTY_VOLUME_LIST", response["code"])
}

func TestHandler_BulkScan_InvalidJSON(t *testing.T) {
	mockScanner := &MockVolumeScanner{}
	router := setupTestRouter(mockScanner)

	req, _ := http.NewRequest("POST", "/volumes/bulk-scan", bytes.NewBuffer([]byte("invalid json")))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusBadRequest, w.Code)

	var response map[string]interface{}
	err := json.Unmarshal(w.Body.Bytes(), &response)
	assert.NoError(t, err)
	assert.Equal(t, "Invalid request format", response["error"])
}

func TestHandler_BulkScan_Async(t *testing.T) {
	mockScanner := &MockVolumeScanner{}
	router := setupTestRouter(mockScanner)

	mockScanner.On("ScanVolumeAsync", mock.Anything, "vol1").Return("scan_123", nil)
	mockScanner.On("ScanVolumeAsync", mock.Anything, "vol2").Return("scan_456", nil)

	bulkReq := models.BulkScanRequest{
		VolumeIDs: []string{"vol1", "vol2"},
		Async:     true,
	}
	reqBody, _ := json.Marshal(bulkReq)

	req, _ := http.NewRequest("POST", "/volumes/bulk-scan", bytes.NewBuffer(reqBody))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusAccepted, w.Code)

	var response map[string]interface{}
	err := json.Unmarshal(w.Body.Bytes(), &response)
	assert.NoError(t, err)
	assert.Equal(t, "Bulk async scan started", response["message"])
	scanIDs := response["scan_ids"].([]interface{})
	assert.Len(t, scanIDs, 2)
	assert.Equal(t, float64(2), response["total"])

	mockScanner.AssertExpectations(t)
}

func TestHandler_BulkScan_AsyncError(t *testing.T) {
	mockScanner := &MockVolumeScanner{}
	router := setupTestRouter(mockScanner)

	mockScanner.On("ScanVolumeAsync", mock.Anything, "vol1").Return("", assert.AnError)

	bulkReq := models.BulkScanRequest{
		VolumeIDs: []string{"vol1"},
		Async:     true,
	}
	reqBody, _ := json.Marshal(bulkReq)

	req, _ := http.NewRequest("POST", "/volumes/bulk-scan", bytes.NewBuffer(reqBody))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusInternalServerError, w.Code)

	var response map[string]interface{}
	err := json.Unmarshal(w.Body.Bytes(), &response)
	assert.NoError(t, err)
	assert.Equal(t, "Failed to start async scan", response["error"])
	assert.Equal(t, "vol1", response["volume"])

	mockScanner.AssertExpectations(t)
}

func TestHandler_BulkScan_PartialFailure(t *testing.T) {
	mockScanner := &MockVolumeScanner{}
	router := setupTestRouter(mockScanner)

	result1 := &interfaces.ScanResult{VolumeID: "vol1", TotalSize: 1024}
	mockScanner.On("ScanVolume", mock.Anything, "vol1").Return(result1, nil)
	mockScanner.On("ScanVolume", mock.Anything, "vol2").Return(nil, assert.AnError)

	bulkReq := models.BulkScanRequest{
		VolumeIDs: []string{"vol1", "vol2"},
		Async:     false,
	}
	reqBody, _ := json.Marshal(bulkReq)

	req, _ := http.NewRequest("POST", "/volumes/bulk-scan", bytes.NewBuffer(reqBody))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusPartialContent, w.Code)

	var response models.BulkScanResponse
	err := json.Unmarshal(w.Body.Bytes(), &response)
	assert.NoError(t, err)
	assert.Equal(t, 2, response.Total)
	assert.Equal(t, 1, response.Success)
	assert.Equal(t, 1, response.Failures)
	assert.Len(t, response.Results, 1)
	assert.Len(t, response.Failed, 1)

	mockScanner.AssertExpectations(t)
}

func TestHandler_BulkScan_AllFailed(t *testing.T) {
	mockScanner := &MockVolumeScanner{}
	router := setupTestRouter(mockScanner)

	mockScanner.On("ScanVolume", mock.Anything, "vol1").Return(nil, assert.AnError)
	mockScanner.On("ScanVolume", mock.Anything, "vol2").Return(nil, assert.AnError)

	bulkReq := models.BulkScanRequest{
		VolumeIDs: []string{"vol1", "vol2"},
		Async:     false,
	}
	reqBody, _ := json.Marshal(bulkReq)

	req, _ := http.NewRequest("POST", "/volumes/bulk-scan", bytes.NewBuffer(reqBody))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusInternalServerError, w.Code)

	var response models.BulkScanResponse
	err := json.Unmarshal(w.Body.Bytes(), &response)
	assert.NoError(t, err)
	assert.Equal(t, 2, response.Total)
	assert.Equal(t, 0, response.Success)
	assert.Equal(t, 2, response.Failures)
	assert.Len(t, response.Results, 0)
	assert.Len(t, response.Failed, 2)

	mockScanner.AssertExpectations(t)
}

// Test error handling scenarios
func TestHandler_HandleScanError_AllErrorTypes(t *testing.T) {
	tests := []struct {
		name           string
		errorCode      string
		expectedStatus int
	}{
		{"queue timeout", coremodels.ErrorCodeScanQueueTimeout, http.StatusRequestTimeout},
		{"path validation", coremodels.ErrorCodePathValidationFailed, http.StatusBadRequest},
		{"volume not found", coremodels.ErrorCodeVolumeNotFound, http.StatusNotFound},
		{"permission denied", coremodels.ErrorCodePermissionDenied, http.StatusForbidden},
		{"all methods failed", coremodels.ErrorCodeAllMethodsFailed, http.StatusInternalServerError},
		{"scan canceled", coremodels.ErrorCodeScanCanceled, http.StatusRequestTimeout},
		{"unknown error", "UNKNOWN_CUSTOM_ERROR", http.StatusInternalServerError},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockScanner := &MockVolumeScanner{}
			router := setupTestRouter(mockScanner)

			scanError := &coremodels.ScanError{
				VolumeID: "test-volume",
				Method:   "du",
				Code:     tt.errorCode,
				Message:  "Test error message",
				Context:  map[string]any{"volume_id": "test-volume"},
			}

			mockScanner.On("ScanVolume", mock.Anything, "test-volume").Return(nil, scanError)

			req, _ := http.NewRequest("GET", "/volumes/test-volume/size", nil)
			w := httptest.NewRecorder()
			router.ServeHTTP(w, req)

			assert.Equal(t, tt.expectedStatus, w.Code)

			var response map[string]interface{}
			err := json.Unmarshal(w.Body.Bytes(), &response)
			assert.NoError(t, err)
			assert.Equal(t, "Test error message", response["error"])
			assert.Equal(t, tt.errorCode, response["code"])
			if tt.errorCode != "UNKNOWN_CUSTOM_ERROR" {
				assert.Contains(t, response, "suggestion")
			}

			mockScanner.AssertExpectations(t)
		})
	}
}

func TestHandler_HandleScanError_GenericError(t *testing.T) {
	mockScanner := &MockVolumeScanner{}
	router := setupTestRouter(mockScanner)

	// Test with a non-ScanError type
	mockScanner.On("ScanVolume", mock.Anything, "test-volume").Return(nil, assert.AnError)

	req, _ := http.NewRequest("GET", "/volumes/test-volume/size", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusInternalServerError, w.Code)

	var response map[string]interface{}
	err := json.Unmarshal(w.Body.Bytes(), &response)
	assert.NoError(t, err)
	assert.Equal(t, "Internal server error", response["error"])

	mockScanner.AssertExpectations(t)
}

// Test additional edge cases and validations

// Test validator functions
func TestHandler_ValidateVolumeID(t *testing.T) {
	handler := &Handler{}

	tests := []struct {
		name     string
		volumeID string
		wantErr  bool
	}{
		{"valid ID", "test-volume", false},
		{"empty ID", "", true},
		{"ID with path traversal", "../volume", true},
		{"ID with slash", "vol/ume", true},
		{"ID too long", strings.Repeat("a", 256), true},
		{"ID max length", strings.Repeat("a", 255), false},
		{"ID with unicode", "测试-volume", false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := handler.ValidateVolumeID(tt.volumeID)
			if tt.wantErr {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)
			}
		})
	}
}

// Test NewHandler constructor
func TestNewHandler(t *testing.T) {
	mockScanner := &MockVolumeScanner{}
	hub := &websocket.Hub{}

	handler := NewHandler(mockScanner, hub, nil, nil)

	assert.NotNil(t, handler)
	assert.Equal(t, mockScanner, handler.scanner)
	assert.Equal(t, hub, handler.hub)
	assert.Nil(t, handler.scheduler)
	assert.Nil(t, handler.realtimePublisher)
}

// Test volume-based scan status endpoint
func TestHandler_GetScanStatus_VolumeRoute_Success(t *testing.T) {
	mockScanner := &MockVolumeScanner{}
	router := setupTestRouter(mockScanner)

	expectedProgress := &interfaces.ScanProgress{
		ScanID:    "scan_789",
		VolumeID:  "test-volume",
		Status:    "completed",
		Progress:  1.0,
		Method:    "du",
		StartedAt: time.Now().Add(-5 * time.Minute),
	}

	mockScanner.On("GetScanProgressByVolume", "test-volume").Return(expectedProgress, nil)

	req, _ := http.NewRequest("GET", "/volumes/test-volume/scan/status", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)

	var response interfaces.ScanProgress
	err := json.Unmarshal(w.Body.Bytes(), &response)
	assert.NoError(t, err)
	assert.Equal(t, "scan_789", response.ScanID)
	assert.Equal(t, "test-volume", response.VolumeID)
	assert.Equal(t, "completed", response.Status)

	mockScanner.AssertExpectations(t)
}

// Test GetScanStatus fallback when GetScanProgressByVolume is not available
func TestHandler_GetScanStatus_VolumeRoute_Fallback(t *testing.T) {
	// Create a scanner and mock the GetScanProgressByVolume method to return error
	mockScanner := &MockVolumeScanner{}
	router := setupTestRouter(mockScanner)

	mockScanner.On("GetScanProgressByVolume", "test-volume").Return(nil, assert.AnError)

	req, _ := http.NewRequest("GET", "/volumes/test-volume/scan/status", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusNotFound, w.Code)

	var response map[string]interface{}
	err := json.Unmarshal(w.Body.Bytes(), &response)
	assert.NoError(t, err)
	assert.Equal(t, "No active scan found for volume", response["error"])
	assert.Equal(t, "NO_ACTIVE_SCAN", response["code"])

	mockScanner.AssertExpectations(t)
}
