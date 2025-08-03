package integration

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/testcontainers/testcontainers-go"
	"github.com/testcontainers/testcontainers-go/modules/postgres"
	"github.com/testcontainers/testcontainers-go/wait"

	"github.com/mantonx/volumeviz/internal/api/v1/database"
	dbPkg "github.com/mantonx/volumeviz/internal/database"
)

// TestDatabaseAPIIntegration tests database API endpoints with real PostgreSQL
func TestDatabaseAPIIntegration(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping API integration tests in short mode")
	}

	ctx := context.Background()

	// Start PostgreSQL container
	postgresContainer, er := postgres.Run(ctx,
		"postgres:15-alpine",
		postgres.WithDatabase("volumeviz_api_test"),
		postgres.WithUsername("api_user"),
		postgres.WithPassword("api_password"),
		testcontainers.WithWaitStrategy(
			wait.ForLog("database system is ready to accept connections").
				WithOccurrence(2).
				WithStartupTimeout(60*time.Second)),
	)
	require.NoError(t, er)
	defer func() {
		err := testcontainers.TerminateContainer(postgresContainer)
		if err != nil {
			t.Logf("Failed to terminate container: %v", err)
		}
	}()

	// Get connection details
	host, err := postgresContainer.Host(ctx)
	require.NoError(t, err)

	port, err := postgresContainer.MappedPort(ctx, "5432")
	require.NoError(t, err)

	// Create database configuration
	config := &dbPkg.Config{
		Host:         host,
		Port:         port.Int(),
		User:         "api_user",
		Password:     "api_password",
		Database:     "volumeviz_api_test",
		SSLMode:      "disable",
		MaxOpenConns: 10,
		MaxIdleConns: 5,
		ConnMaxLife:  5 * time.Minute,
		Timeout:      30 * time.Second,
	}

	// Connect to database
	db, err := dbPkg.NewDB(config)
	require.NoError(t, err)
	defer db.Close()

	// Apply migrations first
	migrationMgr := dbPkg.NewMigrationManager(db.DB)
	err = migrationMgr.ApplyAllPending()
	require.NoError(t, err)

	// Set up Gin router with database handler
	gin.SetMode(gin.TestMode)
	router := gin.New()
	handler := database.NewHandler(db)

	// Register database API routes
	api := router.Group("/api/v1")
	dbRoutes := api.Group("/database")
	{
		dbRoutes.GET("/health", handler.GetDatabaseHealth)
		dbRoutes.GET("/test-connection", handler.TestDatabaseConnection)
		dbRoutes.GET("/stats", handler.GetDatabaseStats)
		
		migrations := dbRoutes.Group("/migrations")
		{
			migrations.GET("/status", handler.GetMigrationStatus)
			migrations.GET("/history", handler.GetMigrationHistory)
			migrations.POST("/apply", handler.ApplyPendingMigrations)
			migrations.POST("/:version/rollback", handler.RollbackMigration)
		}
		
		performance := dbRoutes.Group("/performance")
		{
			performance.GET("/table-sizes", handler.GetTableSizes)
			performance.GET("/slow-queries", handler.GetSlowQueries)
		}
	}

	// Run API tests
	t.Run("Database Health Endpoints", func(t *testing.T) {
		testDatabaseHealthEndpoints(t, router)
	})

	t.Run("Migration Endpoints", func(t *testing.T) {
		testMigrationEndpoints(t, router)
	})

	t.Run("Database Statistics", func(t *testing.T) {
		testDatabaseStatsEndpoints(t, router)
	})

	t.Run("Performance Endpoints", func(t *testing.T) {
		testPerformanceEndpoints(t, router)
	})
}

// testDatabaseHealthEndpoints tests health and connection endpoints
func testDatabaseHealthEndpoints(t *testing.T, router *gin.Engine) {
	// Test database health endpoint
	t.Run("GET /database/health", func(t *testing.T) {
		req := httptest.NewRequest("GET", "/api/v1/database/health", nil)
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusOK, w.Code)

		var health dbPkg.HealthStatus
		err := json.Unmarshal(w.Body.Bytes(), &health)
		require.NoError(t, err)

		assert.Contains(t, []string{"healthy", "degraded"}, health.Status)
		assert.Greater(t, health.ResponseTime, time.Duration(0))
		assert.GreaterOrEqual(t, health.OpenConns, 0)
		assert.GreaterOrEqual(t, health.MaxOpenConns, health.OpenConns)
	})

	// Test database connection test endpoint
	t.Run("GET /database/test-connection", func(t *testing.T) {
		req := httptest.NewRequest("GET", "/api/v1/database/test-connection", nil)
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusOK, w.Code)

		var result database.ConnectionTestResult
		err := json.Unmarshal(w.Body.Bytes(), &result)
		require.NoError(t, err)

		assert.True(t, result.Success)
		assert.Equal(t, "Database connection is healthy", result.Message)
		assert.Empty(t, result.Error)
		assert.GreaterOrEqual(t, result.OpenConnections, 0)
		assert.GreaterOrEqual(t, result.MaxOpenConnections, result.OpenConnections)
	})
}

// testMigrationEndpoints tests migration management endpoints
func testMigrationEndpoints(t *testing.T, router *gin.Engine) {
	// Test migration status endpoint
	t.Run("GET /database/migrations/status", func(t *testing.T) {
		req := httptest.NewRequest("GET", "/api/v1/database/migrations/status", nil)
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusOK, w.Code)

		var status dbPkg.MigrationStatus
		err := json.Unmarshal(w.Body.Bytes(), &status)
		require.NoError(t, err)

		assert.GreaterOrEqual(t, status.TotalMigrations, 1)
		assert.GreaterOrEqual(t, status.AppliedCount, 1)
		assert.GreaterOrEqual(t, status.PendingCount, 0)
		assert.True(t, status.IsUpToDate()) // Should be up to date after applying all
	})

	// Test migration history endpoint
	t.Run("GET /database/migrations/history", func(t *testing.T) {
		req := httptest.NewRequest("GET", "/api/v1/database/migrations/history", nil)
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusOK, w.Code)

		var history []dbPkg.MigrationHistory
		err := json.Unmarshal(w.Body.Bytes(), &history)
		require.NoError(t, err)

		assert.Greater(t, len(history), 0)
		
		// Check first migration has required fields
		firstMigration := history[0]
		assert.NotEmpty(t, firstMigration.Version)
		assert.NotEmpty(t, firstMigration.Description)
		assert.NotEmpty(t, firstMigration.Checksum)
		assert.Greater(t, firstMigration.ExecutionTime, int64(0))
	})

	// Test apply migrations endpoint (should have no pending)
	t.Run("POST /database/migrations/apply - no pending", func(t *testing.T) {
		req := httptest.NewRequest("POST", "/api/v1/database/migrations/apply", nil)
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusBadRequest, w.Code)

		var response map[string]interface{}
		err := json.Unmarshal(w.Body.Bytes(), &response)
		require.NoError(t, err)

		assert.Equal(t, "No pending migrations to apply", response["error"])
		assert.Equal(t, "NO_PENDING_MIGRATIONS", response["code"])
	})

	// Test rollback endpoint with invalid version
	t.Run("POST /database/migrations/999/rollback - invalid version", func(t *testing.T) {
		req := httptest.NewRequest("POST", "/api/v1/database/migrations/999/rollback", nil)
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusNotFound, w.Code)

		var response map[string]interface{}
		err := json.Unmarshal(w.Body.Bytes(), &response)
		require.NoError(t, err)

		assert.Equal(t, "Migration not found", response["error"])
		assert.Equal(t, "MIGRATION_NOT_FOUND", response["code"])
	})
}

// testDatabaseStatsEndpoints tests statistics endpoints
func testDatabaseStatsEndpoints(t *testing.T, router *gin.Engine) {
	// First, create some test data
	createTestData(t, router)

	// Test database stats endpoint
	t.Run("GET /database/stats", func(t *testing.T) {
		req := httptest.NewRequest("GET", "/api/v1/database/stats", nil)
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusOK, w.Code)

		var stats database.DatabaseStats
		err := json.Unmarshal(w.Body.Bytes(), &stats)
		require.NoError(t, err)

		// Verify all stats components are present
		assert.NotNil(t, stats.VolumeStats)
		assert.NotNil(t, stats.ScanJobStats)
		assert.NotNil(t, stats.DatabaseHealth)
		assert.NotNil(t, stats.MigrationStatus)

		// Verify volume stats structure
		assert.GreaterOrEqual(t, stats.VolumeStats.TotalVolumes, 0)
		assert.GreaterOrEqual(t, stats.VolumeStats.ActiveVolumes, 0)
		assert.GreaterOrEqual(t, stats.VolumeStats.UniqueDrivers, 0)

		// Verify scan job stats structure  
		assert.GreaterOrEqual(t, stats.ScanJobStats.TotalJobs, 0)

		// Verify database health
		assert.Contains(t, []string{"healthy", "degraded", "unhealthy"}, stats.DatabaseHealth.Status)

		// Verify migration status
		assert.GreaterOrEqual(t, stats.MigrationStatus.TotalMigrations, 1)
	})
}

// testPerformanceEndpoints tests performance monitoring endpoints
func testPerformanceEndpoints(t *testing.T, router *gin.Engine) {
	// Test table sizes endpoint
	t.Run("GET /database/performance/table-sizes", func(t *testing.T) {
		req := httptest.NewRequest("GET", "/api/v1/database/performance/table-sizes", nil)
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusOK, w.Code)

		var tableSizes []database.TableSizeInfo
		err := json.Unmarshal(w.Body.Bytes(), &tableSizes)
		require.NoError(t, err)

		// Should have at least some table statistics
		// Note: pg_stats might be empty for new database, so we just check structure
		for _, info := range tableSizes {
			assert.NotEmpty(t, info.SchemaName)
			assert.NotEmpty(t, info.TableName)
			assert.NotEmpty(t, info.ColumnName)
		}
	})

	// Test slow queries endpoint
	t.Run("GET /database/performance/slow-queries", func(t *testing.T) {
		req := httptest.NewRequest("GET", "/api/v1/database/performance/slow-queries", nil)
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusOK, w.Code)

		var slowQueries []database.SlowQueryInfo
		err := json.Unmarshal(w.Body.Bytes(), &slowQueries)
		require.NoError(t, err)

		// pg_stat_statements might not be available, so empty result is acceptable
		for _, query := range slowQueries {
			assert.NotEmpty(t, query.Query)
			assert.GreaterOrEqual(t, query.Calls, int64(0))
			assert.GreaterOrEqual(t, query.TotalTime, 0.0)
		}
	})

	// Test slow queries with limit parameter
	t.Run("GET /database/performance/slow-queries?limit=5", func(t *testing.T) {
		req := httptest.NewRequest("GET", "/api/v1/database/performance/slow-queries?limit=5", nil)
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusOK, w.Code)

		var slowQueries []database.SlowQueryInfo
		err := json.Unmarshal(w.Body.Bytes(), &slowQueries)
		require.NoError(t, err)

		// Should respect limit parameter
		assert.LessOrEqual(t, len(slowQueries), 5)
	})
}

// createTestData creates test data for statistics testing
func createTestData(t *testing.T, router *gin.Engine) {
	// This would normally create test volumes and scan jobs
	// For integration testing, we can use the database directly
	// or create test endpoints that populate data
	
	// For now, we'll just verify the endpoints work with empty/minimal data
	// In a real scenario, you'd populate the database with test fixtures
	_ = router // Avoid unused variable warning
}

// TestDatabaseAPIErrorHandling tests error scenarios
func TestDatabaseAPIErrorHandling(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping API error handling tests in short mode")
	}

	// Set up router with nil database to test error handling
	gin.SetMode(gin.TestMode)
	_ = gin.New() // router would be used for error testing
	
	// Use invalid database configuration to trigger errors
	config := &dbPkg.Config{
		Host:     "invalid-host",
		Port:     9999,
		User:     "invalid",
		Password: "invalid",
		Database: "invalid",
		SSLMode:  "disable",
		Timeout:  1 * time.Second,
	}

	// This should fail to connect
	db, err := dbPkg.NewDB(config)
	if err == nil {
		// If somehow it connects, close it
		db.Close()
		t.Skip("Cannot test error handling - unexpected successful connection")
	}

	// Test various error scenarios would go here
	// For now, we'll focus on the successful integration tests
}

// TestDatabaseAPIConcurrency tests concurrent API requests
func TestDatabaseAPIConcurrency(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping concurrency tests in short mode")
	}

	ctx := context.Background()

	// Start PostgreSQL container
	postgresContainer, err := postgres.Run(ctx,
		"postgres:15-alpine", 
		postgres.WithDatabase("volumeviz_concurrency_test"),
		postgres.WithUsername("concurrency_user"),
		postgres.WithPassword("concurrency_password"),
		testcontainers.WithWaitStrategy(
			wait.ForLog("database system is ready to accept connections").
				WithOccurrence(2).
				WithStartupTimeout(60*time.Second)),
	)
	require.NoError(t, err)
	defer func() {
		err := testcontainers.TerminateContainer(postgresContainer)
		if err != nil {
			t.Logf("Failed to terminate container: %v", err)
		}
	}()

	// Get connection details
	host, err := postgresContainer.Host(ctx)
	require.NoError(t, err)

	port, err := postgresContainer.MappedPort(ctx, "5432")
	require.NoError(t, err)

	// Create database configuration
	config := &dbPkg.Config{
		Host:         host,
		Port:         port.Int(),
		User:         "concurrency_user",
		Password:     "concurrency_password",
		Database:     "volumeviz_concurrency_test",
		SSLMode:      "disable",
		MaxOpenConns: 10,
		MaxIdleConns: 5,
		ConnMaxLife:  5 * time.Minute,
		Timeout:      30 * time.Second,
	}

	// Connect to database
	db, err := dbPkg.NewDB(config)
	require.NoError(t, err)
	defer db.Close()

	// Apply migrations
	migrationMgr := dbPkg.NewMigrationManager(db.DB)
	err = migrationMgr.ApplyAllPending()
	require.NoError(t, err)

	// Set up router
	gin.SetMode(gin.TestMode)
	router := gin.New()
	handler := database.NewHandler(db)
	
	api := router.Group("/api/v1/database")
	api.GET("/health", handler.GetDatabaseHealth)
	api.GET("/test-connection", handler.TestDatabaseConnection)

	// Test concurrent requests
	const numRequests = 50
	results := make(chan int, numRequests)

	for i := 0; i < numRequests; i++ {
		go func(id int) {
			// Alternate between health and connection test endpoints
			endpoint := "/api/v1/database/health"
			if id%2 == 0 {
				endpoint = "/api/v1/database/test-connection"
			}

			req := httptest.NewRequest("GET", endpoint, nil)
			w := httptest.NewRecorder()
			router.ServeHTTP(w, req)

			results <- w.Code
		}(i)
	}

	// Collect results
	successCount := 0
	for i := 0; i < numRequests; i++ {
		statusCode := <-results
		if statusCode == http.StatusOK {
			successCount++
		}
	}

	// All requests should succeed
	assert.Equal(t, numRequests, successCount, "All concurrent requests should succeed")

	t.Logf("Successfully handled %d concurrent requests", successCount)
}