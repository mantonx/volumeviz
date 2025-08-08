package utils

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
)

// TestingConfig holds configuration for test environments
type TestingConfig struct {
	DockerHost    string
	DockerTimeout time.Duration
	SkipDocker    bool
}

// GetTestConfig returns testing configuration
func GetTestConfig() *TestingConfig {
	return &TestingConfig{
		DockerHost:    "",
		DockerTimeout: 5 * time.Second,
		SkipDocker:    false,
	}
}

// CreateTestContext creates a Gin test context
func CreateTestContext() (*gin.Context, *httptest.ResponseRecorder) {
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	return c, w
}

// CreateTestRequest creates a test HTTP request
func CreateTestRequest(method, path string, body string) *http.Request {
	var req *http.Request
	if body != "" {
		req = httptest.NewRequest(method, path, strings.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
	} else {
		req = httptest.NewRequest(method, path, nil)
	}
	return req
}

// AssertJSONResponse asserts that the response is valid JSON and contains expected fields
func AssertJSONResponse(t *testing.T, w *httptest.ResponseRecorder, expectedStatus int) map[string]interface{} {
	t.Helper()

	if w.Code != expectedStatus {
		t.Errorf("Expected status %d, got %d", expectedStatus, w.Code)
		t.Logf("Response body: %s", w.Body.String())
	}

	var response map[string]interface{}
	err := json.Unmarshal(w.Body.Bytes(), &response)
	if err != nil {
		t.Errorf("Failed to parse JSON response: %v", err)
		t.Logf("Response body: %s", w.Body.String())
	}

	return response
}

// AssertJSONArrayResponse asserts that the response is a valid JSON array
func AssertJSONArrayResponse(t *testing.T, w *httptest.ResponseRecorder, expectedStatus int) []interface{} {
	t.Helper()

	if w.Code != expectedStatus {
		t.Errorf("Expected status %d, got %d", expectedStatus, w.Code)
		t.Logf("Response body: %s", w.Body.String())
	}

	var response []interface{}
	err := json.Unmarshal(w.Body.Bytes(), &response)
	if err != nil {
		t.Errorf("Failed to parse JSON array response: %v", err)
		t.Logf("Response body: %s", w.Body.String())
	}

	return response
}

// AssertErrorResponse asserts that the response is an error with expected code
func AssertErrorResponse(t *testing.T, w *httptest.ResponseRecorder, expectedStatus int, expectedCode string) {
	t.Helper()

	response := AssertJSONResponse(t, w, expectedStatus)

	if errorCode, ok := response["code"].(string); ok {
		if errorCode != expectedCode {
			t.Errorf("Expected error code %s, got %s", expectedCode, errorCode)
		}
	} else {
		t.Error("Response missing error code")
	}

	if _, ok := response["error"].(string); !ok {
		t.Error("Response missing error message")
	}
}

// Contains checks if a string contains a substring
func Contains(s, substr string) bool {
	return strings.Contains(s, substr)
}

// ContainsJSON checks if a JSON response contains a specific key-value pair
func ContainsJSON(response map[string]interface{}, key string, value interface{}) bool {
	if val, ok := response[key]; ok {
		return val == value
	}
	return false
}

// GetTestContext returns a context with timeout for tests
func GetTestContext(timeout time.Duration) (context.Context, context.CancelFunc) {
	return context.WithTimeout(context.Background(), timeout)
}

// SkipIfDockerUnavailable skips the test if Docker is not available
func SkipIfDockerUnavailable(t *testing.T, err error) {
	t.Helper()
	if err != nil {
		if Contains(err.Error(), "connection refused") ||
			Contains(err.Error(), "permission denied") ||
			Contains(err.Error(), "cannot connect") {
			t.Skipf("Docker not available: %v", err)
		}
	}
}

// WaitForCondition waits for a condition to be true with timeout
func WaitForCondition(timeout time.Duration, checkInterval time.Duration, condition func() bool) bool {
	deadline := time.Now().Add(timeout)
	for time.Now().Before(deadline) {
		if condition() {
			return true
		}
		time.Sleep(checkInterval)
	}
	return false
}

// CompareStrings compares two strings and reports differences
func CompareStrings(t *testing.T, expected, actual, message string) {
	t.Helper()
	if expected != actual {
		t.Errorf("%s: expected %q, got %q", message, expected, actual)
	}
}

// CompareInts compares two integers and reports differences
func CompareInts(t *testing.T, expected, actual int, message string) {
	t.Helper()
	if expected != actual {
		t.Errorf("%s: expected %d, got %d", message, expected, actual)
	}
}
