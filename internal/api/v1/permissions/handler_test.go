package permissions_test

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/mantonx/volumeviz/internal/api/middleware"
	"github.com/mantonx/volumeviz/internal/api/v1/permissions"
	"github.com/mantonx/volumeviz/internal/db/sqlc"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
)

type MockQueries struct {
	mock.Mock
}

func (m *MockQueries) ListPermissionsByOrg(ctx context.Context, organizationID pgtype.Int8) ([]sqlc.Permissions, error) {
	args := m.Called(ctx, organizationID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]sqlc.Permissions), args.Error(1)
}

func (m *MockQueries) CreatePermission(ctx context.Context, arg sqlc.CreatePermissionParams) (sqlc.Permissions, error) {
	args := m.Called(ctx, arg)
	return args.Get(0).(sqlc.Permissions), args.Error(1)
}

func (m *MockQueries) CheckRolePermission(ctx context.Context, arg sqlc.CheckRolePermissionParams) (bool, error) {
	args := m.Called(ctx, arg)
	return args.Bool(0), args.Error(1)
}

func (m *MockQueries) DeleteOrgRolePermission(ctx context.Context, arg sqlc.DeleteOrgRolePermissionParams) error {
	args := m.Called(ctx, arg)
	return args.Error(0)
}

func setupRouter(handler *permissions.Handler, orgID int64) *gin.Engine {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.Use(func(c *gin.Context) {
		ctx := context.WithValue(c.Request.Context(), middleware.OrganizationContextKey, orgID)
		c.Request = c.Request.WithContext(ctx)
		c.Next()
	})
	router.GET("/permissions", handler.ListPermissions)
	router.PUT("/permissions", handler.UpdatePermission)
	return router
}

// setupRouterNoOrgContext mirrors what happens when AUTH_ENABLED=false -
// RequireOrganization() skips entirely and never sets OrganizationContextKey,
// so middleware.GetOrganizationID returns (0, false) rather than a real org
// ID. Handlers must reject this rather than silently writing with
// organization_id=0, which violates the permissions table's FK constraint.
func setupRouterNoOrgContext(handler *permissions.Handler) *gin.Engine {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.GET("/permissions", handler.ListPermissions)
	router.PUT("/permissions", handler.UpdatePermission)
	return router
}

func TestHandler_ListPermissions(t *testing.T) {
	mockQ := new(MockQueries)
	handler := permissions.NewHandler(mockQ)
	router := setupRouter(handler, 1)

	rows := []sqlc.Permissions{
		{ID: 1, Role: "admin", Resource: "volumes", Action: "read", OrganizationID: pgtype.Int8{}},
		{ID: 2, Role: "admin", Resource: "volumes", Action: "write", OrganizationID: pgtype.Int8{}},
		{ID: 3, Role: "operator", Resource: "volumes", Action: "read", OrganizationID: pgtype.Int8{Int64: 1, Valid: true}},
	}
	mockQ.On("ListPermissionsByOrg", mock.Anything, pgtype.Int8{Int64: 1, Valid: true}).Return(rows, nil)

	req := httptest.NewRequest("GET", "/permissions", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)

	var response map[string]interface{}
	err := json.Unmarshal(w.Body.Bytes(), &response)
	assert.NoError(t, err)

	roleList := response["roles"].([]interface{})
	assert.Len(t, roleList, 4) // admin, operator, user, viewer - fixed set

	var admin, operator map[string]interface{}
	for _, r := range roleList {
		rm := r.(map[string]interface{})
		switch rm["role"] {
		case "admin":
			admin = rm
		case "operator":
			operator = rm
		}
	}

	adminGrants := admin["grants"].(map[string]interface{})
	assert.Equal(t, true, adminGrants["volumes:read"])
	assert.Equal(t, true, adminGrants["volumes:write"])
	adminOrgGrants := admin["org_grants"].(map[string]interface{})
	assert.Empty(t, adminOrgGrants) // global-only grants, not org overrides

	operatorGrants := operator["grants"].(map[string]interface{})
	assert.Equal(t, true, operatorGrants["volumes:read"])
	operatorOrgGrants := operator["org_grants"].(map[string]interface{})
	assert.Equal(t, true, operatorOrgGrants["volumes:read"]) // org-scoped override

	mockQ.AssertExpectations(t)
}

func TestHandler_ListPermissions_Error(t *testing.T) {
	mockQ := new(MockQueries)
	handler := permissions.NewHandler(mockQ)
	router := setupRouter(handler, 1)

	mockQ.On("ListPermissionsByOrg", mock.Anything, pgtype.Int8{Int64: 1, Valid: true}).
		Return(nil, assert.AnError)

	req := httptest.NewRequest("GET", "/permissions", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusInternalServerError, w.Code)
	mockQ.AssertExpectations(t)
}

func TestHandler_UpdatePermission_Grant(t *testing.T) {
	mockQ := new(MockQueries)
	handler := permissions.NewHandler(mockQ)
	router := setupRouter(handler, 1)

	mockQ.On("CreatePermission", mock.Anything, sqlc.CreatePermissionParams{
		Role:           "operator",
		Resource:       "volumes",
		Action:         "delete",
		OrganizationID: pgtype.Int8{Int64: 1, Valid: true},
	}).Return(sqlc.Permissions{ID: 99}, nil)

	body, _ := json.Marshal(map[string]interface{}{
		"role": "operator", "resource": "volumes", "action": "delete", "granted": true,
	})
	req := httptest.NewRequest("PUT", "/permissions", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	mockQ.AssertExpectations(t)
}

func TestHandler_UpdatePermission_RevokeOrgGrant(t *testing.T) {
	mockQ := new(MockQueries)
	handler := permissions.NewHandler(mockQ)
	router := setupRouter(handler, 1)

	mockQ.On("CheckRolePermission", mock.Anything, sqlc.CheckRolePermissionParams{
		Role: "operator", Resource: "volumes", Action: "delete", OrganizationID: pgtype.Int8{},
	}).Return(false, nil)
	mockQ.On("DeleteOrgRolePermission", mock.Anything, sqlc.DeleteOrgRolePermissionParams{
		Role: "operator", Resource: "volumes", Action: "delete", OrganizationID: pgtype.Int8{Int64: 1, Valid: true},
	}).Return(nil)

	body, _ := json.Marshal(map[string]interface{}{
		"role": "operator", "resource": "volumes", "action": "delete", "granted": false,
	})
	req := httptest.NewRequest("PUT", "/permissions", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	mockQ.AssertExpectations(t)
}

func TestHandler_UpdatePermission_RevokeGlobalDefault_Rejected(t *testing.T) {
	mockQ := new(MockQueries)
	handler := permissions.NewHandler(mockQ)
	router := setupRouter(handler, 1)

	mockQ.On("CheckRolePermission", mock.Anything, sqlc.CheckRolePermissionParams{
		Role: "admin", Resource: "volumes", Action: "read", OrganizationID: pgtype.Int8{},
	}).Return(true, nil)

	body, _ := json.Marshal(map[string]interface{}{
		"role": "admin", "resource": "volumes", "action": "read", "granted": false,
	})
	req := httptest.NewRequest("PUT", "/permissions", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusConflict, w.Code)
	mockQ.AssertExpectations(t)
	mockQ.AssertNotCalled(t, "DeleteOrgRolePermission", mock.Anything, mock.Anything)
}

func TestHandler_UpdatePermission_InvalidRole_Rejected(t *testing.T) {
	mockQ := new(MockQueries)
	handler := permissions.NewHandler(mockQ)
	router := setupRouter(handler, 1)

	body, _ := json.Marshal(map[string]interface{}{
		"role": "superuser", "resource": "volumes", "action": "read", "granted": true,
	})
	req := httptest.NewRequest("PUT", "/permissions", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusBadRequest, w.Code)
	mockQ.AssertNotCalled(t, "CreatePermission", mock.Anything, mock.Anything)
}

func TestHandler_ListPermissions_NoOrgContext_Rejected(t *testing.T) {
	mockQ := new(MockQueries)
	handler := permissions.NewHandler(mockQ)
	router := setupRouterNoOrgContext(handler)

	req := httptest.NewRequest("GET", "/permissions", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusInternalServerError, w.Code)
	mockQ.AssertNotCalled(t, "ListPermissionsByOrg", mock.Anything, mock.Anything)
}

func TestHandler_UpdatePermission_NoOrgContext_Rejected(t *testing.T) {
	mockQ := new(MockQueries)
	handler := permissions.NewHandler(mockQ)
	router := setupRouterNoOrgContext(handler)

	body, _ := json.Marshal(map[string]interface{}{
		"role": "operator", "resource": "volumes", "action": "read", "granted": true,
	})
	req := httptest.NewRequest("PUT", "/permissions", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusInternalServerError, w.Code)
	mockQ.AssertNotCalled(t, "CreatePermission", mock.Anything, mock.Anything)
}
