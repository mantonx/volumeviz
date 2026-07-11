package activity_test

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/mantonx/volumeviz/internal/api/middleware"
	"github.com/mantonx/volumeviz/internal/api/v1/activity"
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

func setupRouter(handler *activity.Handler, orgID int64) *gin.Engine {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.Use(func(c *gin.Context) {
		ctx := context.WithValue(c.Request.Context(), middleware.OrganizationContextKey, orgID)
		c.Request = c.Request.WithContext(ctx)
		c.Next()
	})
	router.GET("/activity/recent", handler.GetRecentActivity)
	return router
}

func TestHandler_GetRecentActivity(t *testing.T) {
	mockLogger := new(MockAuditLogger)
	handler := activity.NewHandler(mockLogger)
	router := setupRouter(handler, 1)

	orgID := int64(1)
	events := []*audit.Event{
		{ID: 2, Action: "volume.delete", ResourceType: "volume", ResourceID: "abc", Status: "success"},
		{ID: 1, Action: "volume.track", ResourceType: "volume", ResourceID: "def", Status: "success"},
	}

	mockLogger.On("GetEvents", mock.Anything, audit.EventFilters{
		OrganizationID: &orgID,
		Limit:          10,
	}).Return(events, nil)

	req := httptest.NewRequest("GET", "/activity/recent", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)

	var response map[string]interface{}
	err := json.Unmarshal(w.Body.Bytes(), &response)
	assert.NoError(t, err)

	respEvents := response["events"].([]interface{})
	assert.Len(t, respEvents, 2)
	first := respEvents[0].(map[string]interface{})
	assert.Equal(t, "volume.delete", first["action"])

	mockLogger.AssertExpectations(t)
}

func TestHandler_GetRecentActivity_RespectsLimitParam(t *testing.T) {
	mockLogger := new(MockAuditLogger)
	handler := activity.NewHandler(mockLogger)
	router := setupRouter(handler, 1)

	orgID := int64(1)
	mockLogger.On("GetEvents", mock.Anything, audit.EventFilters{
		OrganizationID: &orgID,
		Limit:          5,
	}).Return([]*audit.Event{}, nil)

	req := httptest.NewRequest("GET", "/activity/recent?limit=5", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	mockLogger.AssertExpectations(t)
}

func TestHandler_GetRecentActivity_CapsLimitAtMax(t *testing.T) {
	mockLogger := new(MockAuditLogger)
	handler := activity.NewHandler(mockLogger)
	router := setupRouter(handler, 1)

	orgID := int64(1)
	// A limit above the max (50) should fall back to the default (10),
	// not silently clamp to 50 or pass the oversized value straight through
	mockLogger.On("GetEvents", mock.Anything, audit.EventFilters{
		OrganizationID: &orgID,
		Limit:          10,
	}).Return([]*audit.Event{}, nil)

	req := httptest.NewRequest("GET", "/activity/recent?limit=9999", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	mockLogger.AssertExpectations(t)
}

func TestHandler_GetRecentActivity_Error(t *testing.T) {
	mockLogger := new(MockAuditLogger)
	handler := activity.NewHandler(mockLogger)
	router := setupRouter(handler, 1)

	orgID := int64(1)
	mockLogger.On("GetEvents", mock.Anything, audit.EventFilters{
		OrganizationID: &orgID,
		Limit:          10,
	}).Return(nil, assert.AnError)

	req := httptest.NewRequest("GET", "/activity/recent", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusInternalServerError, w.Code)
	mockLogger.AssertExpectations(t)
}
