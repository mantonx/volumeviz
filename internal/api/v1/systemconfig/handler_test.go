package systemconfig_test

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/mantonx/volumeviz/internal/api/v1/systemconfig"
	"github.com/mantonx/volumeviz/internal/config"
	"github.com/stretchr/testify/assert"
)

func testConfig() *config.Config {
	return &config.Config{
		Server:   config.ServerConfig{Mode: "release"},
		Database: config.DatabaseConfig{Type: "postgres"},
		Auth:     config.AuthConfig{Enabled: true},
		RateLimit: config.RateLimitConfig{
			Enabled: true,
			RPM:     60,
			Burst:   30,
		},
		CORS: config.CORSConfig{
			AllowedOrigins: []string{"http://localhost:5173"},
		},
		Scan: config.ScanConfig{
			Enabled:           true,
			Interval:          6 * time.Hour,
			Concurrency:       3,
			BindMountsEnabled: false,
		},
		Retention: config.RetentionConfig{
			Enabled:                    true,
			ScanJobsRetentionDays:      30,
			ScanMetricsRetentionDays:   90,
			ScanPhasesRetentionDays:    7,
			FileMetadataRetentionDays:  180,
			InactiveFilesRetentionDays: 60,
		},
		Alerts: config.AlertsConfig{
			Enabled:                   false,
			EvaluationIntervalMinutes: 1,
		},
	}
}

func TestHandler_GetConfig(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	handler := systemconfig.NewHandler(testConfig())
	router.GET("/system/config", handler.GetConfig)

	req := httptest.NewRequest("GET", "/system/config", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)

	var response map[string]interface{}
	err := json.Unmarshal(w.Body.Bytes(), &response)
	assert.NoError(t, err)

	server := response["server"].(map[string]interface{})
	assert.Equal(t, "release", server["mode"])
	assert.Equal(t, "postgres", server["database_type"])

	rateLimit := response["rate_limit"].(map[string]interface{})
	assert.Equal(t, float64(60), rateLimit["requests_per_minute"])
	assert.Equal(t, float64(30), rateLimit["burst"])

	scan := response["scan"].(map[string]interface{})
	assert.Equal(t, float64(21600), scan["interval_seconds"]) // 6h in seconds
	assert.Equal(t, float64(3), scan["concurrency"])

	retention := response["retention"].(map[string]interface{})
	assert.Equal(t, float64(30), retention["scan_jobs_days"])
	assert.Equal(t, float64(90), retention["scan_metrics_days"])

	cors := response["cors"].(map[string]interface{})
	origins := cors["allowed_origins"].([]interface{})
	assert.Equal(t, []interface{}{"http://localhost:5173"}, origins)

	// Secrets must never appear in this response
	body := w.Body.String()
	assert.NotContains(t, body, "Secret")
	assert.NotContains(t, body, "Password")
}
