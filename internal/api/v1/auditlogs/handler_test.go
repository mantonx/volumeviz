package auditlogs_test

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/mantonx/volumeviz/internal/api/middleware"
	"github.com/mantonx/volumeviz/internal/api/v1/auditlogs"
	"github.com/mantonx/volumeviz/internal/audit"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
)

type MockAuditLogger struct {
	mock.Mock
}

func (m *MockAuditLogger) LogEvent(ctx context.Context, event audit.Event) error {
	args := m.Called(ctx, event)
	return args.Error(0)
}

func (m *MockAuditLogger) GetEvents(ctx context.Context, filters audit.EventFilters) ([]*audit.Event, error) {
	args := m.Called(ctx, filters)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]*audit.Event), args.Error(1)
}

func (m *MockAuditLogger) SearchEvents(ctx context.Context, filters audit.SearchFilters) ([]*audit.Event, int64, error) {
	args := m.Called(ctx, filters)
	if args.Get(0) == nil {
		return nil, 0, args.Error(2)
	}
	return args.Get(0).([]*audit.Event), int64(args.Int(1)), args.Error(2)
}

func setupRouter(handler *auditlogs.Handler, orgID int64) *gin.Engine {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.Use(func(c *gin.Context) {
		ctx := context.WithValue(c.Request.Context(), middleware.OrganizationContextKey, orgID)
		c.Request = c.Request.WithContext(ctx)
		c.Next()
	})
	router.GET("/audit-logs", handler.SearchAuditLogs)
	router.GET("/audit-logs/export", handler.ExportAuditLogs)
	return router
}

func TestHandler_SearchAuditLogs(t *testing.T) {
	mockLogger := new(MockAuditLogger)
	handler := auditlogs.NewHandler(mockLogger)
	router := setupRouter(handler, 1)

	events := []*audit.Event{
		{ID: 2, Username: "admin", Action: "volume.delete", Status: "success", Timestamp: time.Now()},
		{ID: 1, Username: "demouser", Action: "login", Status: "failed", Timestamp: time.Now()},
	}

	mockLogger.On("SearchEvents", mock.Anything, audit.SearchFilters{
		OrganizationID: 1,
		Limit:          25,
	}).Return(events, 2, nil)

	req := httptest.NewRequest("GET", "/audit-logs", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)

	var response map[string]interface{}
	err := json.Unmarshal(w.Body.Bytes(), &response)
	assert.NoError(t, err)
	assert.Equal(t, float64(2), response["total"])

	logs := response["logs"].([]interface{})
	assert.Len(t, logs, 2)
	first := logs[0].(map[string]interface{})
	assert.Equal(t, "volume.delete", first["action"])
	assert.Equal(t, "admin", first["username"])

	mockLogger.AssertExpectations(t)
}

func TestHandler_SearchAuditLogs_AppliesFilters(t *testing.T) {
	mockLogger := new(MockAuditLogger)
	handler := auditlogs.NewHandler(mockLogger)
	router := setupRouter(handler, 1)

	action := "login"
	status := "failed"
	search := "demouser"

	mockLogger.On("SearchEvents", mock.Anything, audit.SearchFilters{
		OrganizationID: 1,
		Action:         &action,
		Status:         &status,
		Search:         &search,
		Limit:          10,
		Offset:         5,
	}).Return([]*audit.Event{}, 0, nil)

	req := httptest.NewRequest("GET", "/audit-logs?action=login&status=failed&search=demouser&limit=10&offset=5", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	mockLogger.AssertExpectations(t)
}

func TestHandler_SearchAuditLogs_CapsLimitAtMax(t *testing.T) {
	mockLogger := new(MockAuditLogger)
	handler := auditlogs.NewHandler(mockLogger)
	router := setupRouter(handler, 1)

	mockLogger.On("SearchEvents", mock.Anything, audit.SearchFilters{
		OrganizationID: 1,
		Limit:          25,
	}).Return([]*audit.Event{}, 0, nil)

	req := httptest.NewRequest("GET", "/audit-logs?limit=99999", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	mockLogger.AssertExpectations(t)
}

func TestHandler_SearchAuditLogs_Error(t *testing.T) {
	mockLogger := new(MockAuditLogger)
	handler := auditlogs.NewHandler(mockLogger)
	router := setupRouter(handler, 1)

	mockLogger.On("SearchEvents", mock.Anything, audit.SearchFilters{
		OrganizationID: 1,
		Limit:          25,
	}).Return(nil, 0, assert.AnError)

	req := httptest.NewRequest("GET", "/audit-logs", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusInternalServerError, w.Code)
	mockLogger.AssertExpectations(t)
}

func TestHandler_ExportAuditLogs(t *testing.T) {
	mockLogger := new(MockAuditLogger)
	handler := auditlogs.NewHandler(mockLogger)
	router := setupRouter(handler, 1)

	ts := time.Date(2026, 1, 1, 12, 0, 0, 0, time.UTC)
	events := []*audit.Event{
		{ID: 1, Username: "admin", Action: "login", Status: "success", Timestamp: ts},
	}

	mockLogger.On("SearchEvents", mock.Anything, mock.MatchedBy(func(f audit.SearchFilters) bool {
		return f.OrganizationID == 1 && f.Limit == 10000 && f.Offset == 0
	})).Return(events, 1, nil)

	req := httptest.NewRequest("GET", "/audit-logs/export", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	assert.Equal(t, "text/csv", w.Header().Get("Content-Type"))
	body := w.Body.String()
	assert.Contains(t, body, "id,timestamp,username,action,resource_type,resource_id,ip_address,status")
	assert.Contains(t, body, "admin")
	assert.Contains(t, body, "login")

	mockLogger.AssertExpectations(t)
}
