package v1

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/mantonx/volumeviz/internal/api/middleware"
	"github.com/mantonx/volumeviz/internal/api/v1/auth"
	"github.com/mantonx/volumeviz/internal/api/v1/organizations"
	"github.com/mantonx/volumeviz/internal/api/v1/volumes"
	"github.com/mantonx/volumeviz/internal/audit"
	"github.com/mantonx/volumeviz/internal/db"
	"github.com/mantonx/volumeviz/internal/db/sqlc"
	"github.com/mantonx/volumeviz/internal/models"
	"github.com/mantonx/volumeviz/internal/services/organizations"
	authUtils "github.com/mantonx/volumeviz/internal/utils/auth"
	"github.com/mantonx/volumeviz/internal/store"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestMultiTenantAPIIntegration tests complete API-level multi-tenant functionality
func TestMultiTenantAPIIntegration(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping integration test in short mode")
	}

	// Skip if no PostgreSQL available
	dsn := os.Getenv("POSTGRES_TEST_URL")
	if dsn == "" {
		dsn = "postgres://postgres:postgres@localhost:5432/volumeviz_test?sslmode=disable"
	}

	ctx := context.Background()

	// Test database connection
	pool, err := pgxpool.New(ctx, dsn)
	if err != nil {
		t.Skipf("PostgreSQL not available at %s: %v", dsn, err)
	}
	defer pool.Close()

	if err := pool.Ping(ctx); err != nil {
		t.Skipf("PostgreSQL ping failed at %s: %v", dsn, err)
	}

	// Create database connection
	conn, err := db.ConnectPostgreSQL(ctx, dsn, 10)
	require.NoError(t, err)
	defer conn.Pool.Close()

	// Create store
	testStore := store.NewPostgreSQLStore(conn)

	// Create audit logger
	auditLogger := audit.NewAuditLogger(conn.Queries, "test-service")

	// Create services
	orgService := organizations.NewOrganizationService(testStore, auditLogger)

	// Run API integration tests
	t.Run("Organization API CRUD", testOrganizationAPICRUD(testStore, orgService, auditLogger))
	t.Run("Volume API Organization Isolation", testVolumeAPIOrganizationIsolation(testStore, auditLogger))
	t.Run("JWT Organization Context", testJWTOrganizationContext(testStore, auditLogger))
	t.Run("Cross-Organization API Access Prevention", testCrossOrganizationAPIAccess(testStore, auditLogger))
}

// testOrganizationAPICRUD tests complete organization management via API
func testOrganizationAPICRUD(testStore store.Store, orgService *organizations.OrganizationService, auditLogger *audit.AuditLogger) func(*testing.T) {
	return func(t *testing.T) {
		// Set up Gin router
		gin.SetMode(gin.TestMode)
		router := gin.New()

		// Add middleware
		router.Use(middleware.CORS())
		router.Use(middleware.RequestID())

		// Create organization handler
		orgHandler := organizations.NewOrganizationHandler(orgService, auditLogger)

		// Set up routes
		v1 := router.Group("/api/v1")
		orgHandler.RegisterRoutes(v1.Group("/organizations"))

		// Test Create Organization
		createOrgPayload := map[string]interface{}{
			"name":        "API Test Organization",
			"description": "Testing organization API",
			"plan":        "premium",
		}
		createOrgJSON, _ := json.Marshal(createOrgPayload)

		req := httptest.NewRequest("POST", "/api/v1/organizations", bytes.NewBuffer(createOrgJSON))
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusCreated, w.Code)

		var createResponse models.Organization
		err := json.Unmarshal(w.Body.Bytes(), &createResponse)
		require.NoError(t, err)
		assert.Equal(t, "API Test Organization", createResponse.Name)
		assert.Equal(t, "premium", createResponse.Plan)

		orgID := createResponse.ID

		// Test Get Organization
		req = httptest.NewRequest("GET", fmt.Sprintf("/api/v1/organizations/%d", orgID), nil)
		w = httptest.NewRecorder()
		router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusOK, w.Code)

		var getResponse models.Organization
		err = json.Unmarshal(w.Body.Bytes(), &getResponse)
		require.NoError(t, err)
		assert.Equal(t, orgID, getResponse.ID)

		// Test Update Organization
		updateOrgPayload := map[string]interface{}{
			"name":        "Updated API Test Organization",
			"description": "Updated description",
			"plan":        "enterprise",
		}
		updateOrgJSON, _ := json.Marshal(updateOrgPayload)

		req = httptest.NewRequest("PUT", fmt.Sprintf("/api/v1/organizations/%d", orgID), bytes.NewBuffer(updateOrgJSON))
		req.Header.Set("Content-Type", "application/json")
		w = httptest.NewRecorder()
		router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusOK, w.Code)

		var updateResponse models.Organization
		err = json.Unmarshal(w.Body.Bytes(), &updateResponse)
		require.NoError(t, err)
		assert.Equal(t, "Updated API Test Organization", updateResponse.Name)
		assert.Equal(t, "enterprise", updateResponse.Plan)

		// Test List Organizations
		req = httptest.NewRequest("GET", "/api/v1/organizations?limit=10&offset=0", nil)
		w = httptest.NewRecorder()
		router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusOK, w.Code)

		var listResponse []models.Organization
		err = json.Unmarshal(w.Body.Bytes(), &listResponse)
		require.NoError(t, err)
		assert.GreaterOrEqual(t, len(listResponse), 1)

		// Test Delete Organization
		req = httptest.NewRequest("DELETE", fmt.Sprintf("/api/v1/organizations/%d", orgID), nil)
		w = httptest.NewRecorder()
		router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusNoContent, w.Code)

		// Verify deletion
		req = httptest.NewRequest("GET", fmt.Sprintf("/api/v1/organizations/%d", orgID), nil)
		w = httptest.NewRecorder()
		router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusNotFound, w.Code)
	}
}

// testVolumeAPIOrganizationIsolation tests that volume APIs respect organization boundaries
func testVolumeAPIOrganizationIsolation(testStore store.Store, auditLogger *audit.AuditLogger) func(*testing.T) {
	return func(t *testing.T) {
		ctx := context.Background()

		// Create test organizations
		org1, err := testStore.Organizations().CreateOrganization(ctx, models.CreateOrganizationParams{
			Name: "Volume API Test Org 1",
			Plan: "basic",
		})
		require.NoError(t, err)

		org2, err := testStore.Organizations().CreateOrganization(ctx, models.CreateOrganizationParams{
			Name: "Volume API Test Org 2",
			Plan: "basic",
		})
		require.NoError(t, err)

		// Create users for each organization
		user1, err := testStore.Users().CreateUser(ctx, sqlc.CreateUserParams{
			Email:          "vol-user1@test.com",
			HashedPassword: "hashedpass1",
			FirstName:      "Volume",
			LastName:       "User1",
			OrganizationID: org1.ID,
		})
		require.NoError(t, err)

		user2, err := testStore.Users().CreateUser(ctx, sqlc.CreateUserParams{
			Email:          "vol-user2@test.com",
			HashedPassword: "hashedpass2",
			FirstName:      "Volume", 
			LastName:       "User2",
			OrganizationID: org2.ID,
		})
		require.NoError(t, err)

		// Create volumes for each organization
		_, err = testStore.Volumes().CreateVolume(ctx, models.CreateVolumeParams{
			ID:             "api-vol-org1",
			Name:           "API Volume Org1",
			MountPath:      "/data/api/org1",
			Driver:         "local",
			OrganizationID: org1.ID,
		})
		require.NoError(t, err)

		_, err = testStore.Volumes().CreateVolume(ctx, models.CreateVolumeParams{
			ID:             "api-vol-org2",
			Name:           "API Volume Org2",
			MountPath:      "/data/api/org2",
			Driver:         "local",
			OrganizationID: org2.ID,
		})
		require.NoError(t, err)

		// Set up Gin router
		gin.SetMode(gin.TestMode)
		router := gin.New()

		// Add middleware
		router.Use(middleware.CORS())
		router.Use(middleware.RequestID())

		// Create volume handler
		volumeHandler := volumes.NewVolumeHandler(testStore)

		// Set up routes with organization middleware
		v1 := router.Group("/api/v1")
		v1.Use(middleware.OrganizationContext(testStore))
		volumeHandler.RegisterRoutes(v1.Group("/volumes"))

		// Generate JWTs for each user
		jwt1, err := authUtils.GenerateJWT(user1.ID, user1.Email, org1.ID, user1.Role)
		require.NoError(t, err)

		jwt2, err := authUtils.GenerateJWT(user2.ID, user2.Email, org2.ID, user2.Role)
		require.NoError(t, err)

		// Test Org1 user can see only Org1 volumes
		req := httptest.NewRequest("GET", "/api/v1/volumes", nil)
		req.Header.Set("Authorization", "Bearer "+jwt1)
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusOK, w.Code)

		var org1Volumes []models.Volume
		err = json.Unmarshal(w.Body.Bytes(), &org1Volumes)
		require.NoError(t, err)

		// Should only see org1 volume
		foundOrg1Volume := false
		for _, vol := range org1Volumes {
			if vol.ID == "api-vol-org1" {
				foundOrg1Volume = true
			}
			assert.NotEqual(t, "api-vol-org2", vol.ID, "Should not see org2 volumes")
		}
		assert.True(t, foundOrg1Volume, "Should see org1 volume")

		// Test Org2 user can see only Org2 volumes
		req = httptest.NewRequest("GET", "/api/v1/volumes", nil)
		req.Header.Set("Authorization", "Bearer "+jwt2)
		w = httptest.NewRecorder()
		router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusOK, w.Code)

		var org2Volumes []models.Volume
		err = json.Unmarshal(w.Body.Bytes(), &org2Volumes)
		require.NoError(t, err)

		// Should only see org2 volume
		foundOrg2Volume := false
		for _, vol := range org2Volumes {
			if vol.ID == "api-vol-org2" {
				foundOrg2Volume = true
			}
			assert.NotEqual(t, "api-vol-org1", vol.ID, "Should not see org1 volumes")
		}
		assert.True(t, foundOrg2Volume, "Should see org2 volume")

		// Cleanup
		_ = testStore.Organizations().DeleteOrganization(ctx, org1.ID)
		_ = testStore.Organizations().DeleteOrganization(ctx, org2.ID)
	}
}

// testJWTOrganizationContext tests JWT-based organization context propagation
func testJWTOrganizationContext(testStore store.Store, auditLogger *audit.AuditLogger) func(*testing.T) {
	return func(t *testing.T) {
		ctx := context.Background()

		// Create test organization
		org, err := testStore.Organizations().CreateOrganization(ctx, models.CreateOrganizationParams{
			Name: "JWT Test Org",
			Plan: "premium",
		})
		require.NoError(t, err)

		// Create test user
		user, err := testStore.Users().CreateUser(ctx, sqlc.CreateUserParams{
			Email:          "jwt-user@test.com",
			HashedPassword: "hashedpass",
			FirstName:      "JWT",
			LastName:       "User",
			OrganizationID: org.ID,
			Role:           "admin",
		})
		require.NoError(t, err)

		// Generate JWT with organization context
		jwt, err := authUtils.GenerateJWT(user.ID, user.Email, org.ID, user.Role)
		require.NoError(t, err)

		// Set up Gin router with organization middleware
		gin.SetMode(gin.TestMode)
		router := gin.New()
		router.Use(middleware.CORS())
		router.Use(middleware.RequestID())
		router.Use(middleware.OrganizationContext(testStore))

		// Test endpoint that extracts organization from JWT
		router.GET("/test/organization", func(c *gin.Context) {
			orgID, exists := c.Get("organization_id")
			if !exists {
				c.JSON(http.StatusUnauthorized, gin.H{"error": "No organization context"})
				return
			}

			orgIDInt, ok := orgID.(int64)
			if !ok {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Invalid organization ID type"})
				return
			}

			c.JSON(http.StatusOK, gin.H{"organization_id": orgIDInt})
		})

		// Test with valid JWT
		req := httptest.NewRequest("GET", "/test/organization", nil)
		req.Header.Set("Authorization", "Bearer "+jwt)
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusOK, w.Code)

		var response map[string]interface{}
		err = json.Unmarshal(w.Body.Bytes(), &response)
		require.NoError(t, err)
		assert.Equal(t, float64(org.ID), response["organization_id"])

		// Test without JWT - should fail
		req = httptest.NewRequest("GET", "/test/organization", nil)
		w = httptest.NewRecorder()
		router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusUnauthorized, w.Code)

		// Test with invalid JWT - should fail
		req = httptest.NewRequest("GET", "/test/organization", nil)
		req.Header.Set("Authorization", "Bearer invalid.jwt.token")
		w = httptest.NewRecorder()
		router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusUnauthorized, w.Code)

		// Cleanup
		_ = testStore.Organizations().DeleteOrganization(ctx, org.ID)
	}
}

// testCrossOrganizationAPIAccess tests prevention of cross-organization API access
func testCrossOrganizationAPIAccess(testStore store.Store, auditLogger *audit.AuditLogger) func(*testing.T) {
	return func(t *testing.T) {
		ctx := context.Background()

		// Create two organizations
		org1, err := testStore.Organizations().CreateOrganization(ctx, models.CreateOrganizationParams{
			Name: "Cross Access API Org 1",
			Plan: "basic",
		})
		require.NoError(t, err)

		org2, err := testStore.Organizations().CreateOrganization(ctx, models.CreateOrganizationParams{
			Name: "Cross Access API Org 2", 
			Plan: "basic",
		})
		require.NoError(t, err)

		// Create users for each organization
		user1, err := testStore.Users().CreateUser(ctx, sqlc.CreateUserParams{
			Email:          "cross1@test.com",
			HashedPassword: "hashedpass",
			FirstName:      "Cross",
			LastName:       "User1", 
			OrganizationID: org1.ID,
		})
		require.NoError(t, err)

		user2, err := testStore.Users().CreateUser(ctx, sqlc.CreateUserParams{
			Email:          "cross2@test.com",
			HashedPassword: "hashedpass", 
			FirstName:      "Cross",
			LastName:       "User2",
			OrganizationID: org2.ID,
		})
		require.NoError(t, err)

		// Generate JWTs
		jwt1, err := authUtils.GenerateJWT(user1.ID, user1.Email, org1.ID, user1.Role)
		require.NoError(t, err)

		jwt2, err := authUtils.GenerateJWT(user2.ID, user2.Email, org2.ID, user2.Role)
		require.NoError(t, err)

		// Set up router with organization middleware
		gin.SetMode(gin.TestMode)
		router := gin.New()
		router.Use(middleware.CORS())
		router.Use(middleware.RequestID())
		router.Use(middleware.OrganizationContext(testStore))

		// Create organization service and handler
		orgService := organizations.NewOrganizationService(testStore, auditLogger)
		orgHandler := organizations.NewOrganizationHandler(orgService, auditLogger)

		// Set up routes
		v1 := router.Group("/api/v1")
		orgHandler.RegisterRoutes(v1.Group("/organizations"))

		// Test: User1 should not be able to access Org2's details
		req := httptest.NewRequest("GET", fmt.Sprintf("/api/v1/organizations/%d", org2.ID), nil)
		req.Header.Set("Authorization", "Bearer "+jwt1)
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		// Should be forbidden or not found (depending on implementation)
		assert.Contains(t, []int{http.StatusForbidden, http.StatusNotFound, http.StatusUnauthorized}, w.Code)

		// Test: User1 should be able to access their own organization
		req = httptest.NewRequest("GET", fmt.Sprintf("/api/v1/organizations/%d", org1.ID), nil)
		req.Header.Set("Authorization", "Bearer "+jwt1)
		w = httptest.NewRecorder()
		router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusOK, w.Code)

		// Test: User2 should not be able to modify Org1
		updatePayload := map[string]interface{}{
			"name": "Malicious Update",
		}
		updateJSON, _ := json.Marshal(updatePayload)

		req = httptest.NewRequest("PUT", fmt.Sprintf("/api/v1/organizations/%d", org1.ID), bytes.NewBuffer(updateJSON))
		req.Header.Set("Authorization", "Bearer "+jwt2)
		req.Header.Set("Content-Type", "application/json")
		w = httptest.NewRecorder()
		router.ServeHTTP(w, req)

		// Should be forbidden
		assert.Contains(t, []int{http.StatusForbidden, http.StatusNotFound, http.StatusUnauthorized}, w.Code)

		// Cleanup
		_ = testStore.Organizations().DeleteOrganization(ctx, org1.ID)
		_ = testStore.Organizations().DeleteOrganization(ctx, org2.ID)
	}
}