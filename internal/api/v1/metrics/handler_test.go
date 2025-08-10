package metrics

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
)

func TestValidateTimeRange(t *testing.T) {
	testCases := []struct {
		timeRange string
		wantErr   bool
	}{
		{"1h", false},
		{"6h", false},
		{"1d", false},
		{"7d", false},
		{"30d", false},
		{"90d", false},
		{"1y", false},
		{"invalid", true},
		{"", true},
		{"2h", true}, // Not in allowed list
	}

	for _, tc := range testCases {
		t.Run(tc.timeRange, func(t *testing.T) {
			err := validateTimeRange(tc.timeRange)
			if tc.wantErr {
				assert.Error(t, err)
				assert.Contains(t, err.Error(), "timeRange must be one of")
			} else {
				assert.NoError(t, err)
			}
		})
	}
}

func TestValidateVolumeID(t *testing.T) {
	testCases := []struct {
		name     string
		volumeID string
		wantErr  bool
		errMsg   string
	}{
		{
			name:     "valid volume ID",
			volumeID: "test-volume",
			wantErr:  false,
		},
		{
			name:     "empty volume ID",
			volumeID: "",
			wantErr:  true,
			errMsg:   "volume ID is required",
		},
		{
			name:     "too long volume ID",
			volumeID: strings.Repeat("a", 256),
			wantErr:  true,
			errMsg:   "volume ID too long",
		},
		{
			name:     "max length volume ID",
			volumeID: strings.Repeat("a", 255),
			wantErr:  false,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			err := validateVolumeID(tc.volumeID)
			if tc.wantErr {
				assert.Error(t, err)
				assert.Contains(t, err.Error(), tc.errMsg)
			} else {
				assert.NoError(t, err)
			}
		})
	}
}

func TestParseTimeRange(t *testing.T) {
	testCases := []struct {
		timeRange string
		expected  time.Duration
		wantErr   bool
	}{
		{"1h", time.Hour, false},
		{"6h", 6 * time.Hour, false},
		{"1d", 24 * time.Hour, false},
		{"7d", 7 * 24 * time.Hour, false},
		{"30d", 30 * 24 * time.Hour, false},
		{"90d", 90 * 24 * time.Hour, false},
		{"1y", 365 * 24 * time.Hour, false},
		{"2h", 2 * time.Hour, false}, // Should work via time.ParseDuration
		{"30s", 30 * time.Second, false},
		{"5m", 5 * time.Minute, false},
		{"invalid", 0, true},
		{"", 0, true},
	}

	for _, tc := range testCases {
		t.Run(tc.timeRange, func(t *testing.T) {
			result, err := parseTimeRange(tc.timeRange)
			if tc.wantErr {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)
				assert.Equal(t, tc.expected, result)
			}
		})
	}
}

func TestParseVolumeIDs(t *testing.T) {
	testCases := []struct {
		name     string
		param    string
		expected []string
	}{
		{
			name:     "single volume ID",
			param:    "vol1",
			expected: []string{"vol1"},
		},
		{
			name:     "multiple volume IDs",
			param:    "vol1,vol2,vol3",
			expected: []string{"vol1", "vol2", "vol3"},
		},
		{
			name:     "volume IDs with spaces",
			param:    " vol1 , vol2 , vol3 ",
			expected: []string{"vol1", "vol2", "vol3"},
		},
		{
			name:     "empty string",
			param:    "",
			expected: []string{},
		},
		{
			name:     "comma only",
			param:    ",",
			expected: []string{},
		},
		{
			name:     "multiple commas",
			param:    "vol1,,,vol2,,vol3,",
			expected: []string{"vol1", "vol2", "vol3"},
		},
		{
			name:     "spaces only",
			param:    "   ,   ,   ",
			expected: []string{},
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			result := parseVolumeIDs(tc.param)
			assert.Equal(t, tc.expected, result)
		})
	}
}

func TestNewHandler(t *testing.T) {
	// We can't easily test this without setting up a real DB
	// but we can test that it creates a handler without panic
	assert.NotPanics(t, func() {
		// This will create a handler with nil DB
		// In real usage, a proper DB would be passed
		handler := NewHandler(nil)
		assert.NotNil(t, handler)
	})
}

// Test HTTP handlers with mock setup
func setupTestRouter() *gin.Engine {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	
	// Create handler with nil DB for testing
	// In real tests, you'd use a mock database or test database
	handler := &Handler{
		metricsRepo: nil, // This will cause errors, but we're testing validation
	}
	
	// Set up routes
	api := router.Group("/api/v1")
	{
		api.GET("/volumes/:name/metrics", handler.GetVolumeMetrics)
		api.GET("/volumes/trends", handler.GetVolumeTrends)
	}
	
	return router
}

func TestGetVolumeMetrics_ValidationErrors(t *testing.T) {
	router := setupTestRouter()

	testCases := []struct {
		name           string
		url            string
		expectedStatus int
		expectedError  string
	}{
		{
			name:           "empty volume ID",
			url:            "/api/v1/volumes//metrics",
			expectedStatus: http.StatusBadRequest,
			expectedError:  "volume ID is required",
		},
		{
			name:           "invalid time range",
			url:            "/api/v1/volumes/test-vol/metrics?timeRange=invalid",
			expectedStatus: http.StatusBadRequest,
			expectedError:  "invalid time range",
		},
		{
			name:           "valid parameters but no repo",
			url:            "/api/v1/volumes/test-vol/metrics?timeRange=1d",
			expectedStatus: http.StatusInternalServerError,
			expectedError:  "", // Will fail at repo level
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			req := httptest.NewRequest("GET", tc.url, nil)
			w := httptest.NewRecorder()
			
			router.ServeHTTP(w, req)
			
			assert.Equal(t, tc.expectedStatus, w.Code)
			if tc.expectedError != "" {
				assert.Contains(t, w.Body.String(), tc.expectedError)
			}
		})
	}
}

func TestGetVolumeMetrics_QueryParameters(t *testing.T) {
	router := setupTestRouter()

	testCases := []struct {
		name        string
		queryParams string
		expectError bool
	}{
		{
			name:        "default parameters",
			queryParams: "",
			expectError: true, // Will fail at repo level
		},
		{
			name:        "custom time range",
			queryParams: "?timeRange=1h",
			expectError: true, // Will fail at repo level
		},
		{
			name:        "custom interval",
			queryParams: "?interval=30m",
			expectError: true, // Will fail at repo level
		},
		{
			name:        "both parameters",
			queryParams: "?timeRange=7d&interval=2h",
			expectError: true, // Will fail at repo level
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			url := "/api/v1/volumes/test-vol/metrics" + tc.queryParams
			req := httptest.NewRequest("GET", url, nil)
			w := httptest.NewRecorder()
			
			router.ServeHTTP(w, req)
			
			if tc.expectError {
				assert.Equal(t, http.StatusInternalServerError, w.Code)
			} else {
				assert.Equal(t, http.StatusOK, w.Code)
			}
		})
	}
}

func TestGetVolumeTrends_ValidationErrors(t *testing.T) {
	router := setupTestRouter()

	testCases := []struct {
		name           string
		url            string
		expectedStatus int
	}{
		{
			name:           "no volume IDs specified",
			url:            "/api/v1/volumes/trends",
			expectedStatus: http.StatusInternalServerError, // Will fail at repo.GetAllActiveVolumeIDs
		},
		{
			name:           "specific volume IDs",
			url:            "/api/v1/volumes/trends?volumeIds=vol1,vol2",
			expectedStatus: http.StatusInternalServerError, // Will fail at repo level
		},
		{
			name:           "custom time range",
			url:            "/api/v1/volumes/trends?timeRange=90d",
			expectedStatus: http.StatusInternalServerError, // Will fail at repo level
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			req := httptest.NewRequest("GET", tc.url, nil)
			w := httptest.NewRecorder()
			
			router.ServeHTTP(w, req)
			
			assert.Equal(t, tc.expectedStatus, w.Code)
		})
	}
}

func TestParseVolumeIDs_EdgeCases(t *testing.T) {
	// Additional edge case tests
	testCases := []struct {
		input    string
		expected []string
	}{
		{"a", []string{"a"}},
		{"a,", []string{"a"}},
		{",a", []string{"a"}},
		{",a,", []string{"a"}},
		{"a,b,c,d,e", []string{"a", "b", "c", "d", "e"}},
		{" \t vol1 \t , \n vol2 \n ", []string{"vol1", "vol2"}},
	}

	for _, tc := range testCases {
		t.Run("input_"+tc.input, func(t *testing.T) {
			result := parseVolumeIDs(tc.input)
			assert.Equal(t, tc.expected, result)
		})
	}
}

func TestTimeRangeValidation_AllValidCases(t *testing.T) {
	validRanges := []string{"1h", "6h", "1d", "7d", "30d", "90d", "1y"}
	
	for _, tr := range validRanges {
		t.Run("valid_"+tr, func(t *testing.T) {
			err := validateTimeRange(tr)
			assert.NoError(t, err)
			
			// Also test parsing
			duration, err := parseTimeRange(tr)
			assert.NoError(t, err)
			assert.Greater(t, duration, time.Duration(0))
		})
	}
}

func TestVolumeIDValidation_BoundaryTests(t *testing.T) {
	testCases := []struct {
		name     string
		volumeID string
		wantErr  bool
	}{
		{"single char", "a", false},
		{"254 chars", strings.Repeat("a", 254), false},
		{"255 chars", strings.Repeat("a", 255), false},
		{"256 chars", strings.Repeat("a", 256), true},
		{"1000 chars", strings.Repeat("a", 1000), true},
		{"unicode chars", "测试-volume-名称", false},
		{"special chars", "volume-with-special_chars.123", false},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			err := validateVolumeID(tc.volumeID)
			if tc.wantErr {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)
			}
		})
	}
}