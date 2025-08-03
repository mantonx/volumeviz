package integration

import (
	"fmt"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mantonx/volumeviz/internal/database"
)

// TestDatabaseBasicIntegration tests basic database functionality with testcontainers
func TestDatabaseBasicIntegration(t *testing.T) {
	DockerRequiredOrSkip(t)

	WithPostgreSQLContainer(t, "volumeviz_basic_test", func(container *PostgreSQLTestContainer) {
		t.Run("Database Connection", func(t *testing.T) {
			testDatabaseConnection(t, container)
		})

		t.Run("Migration System", func(t *testing.T) {
			testMigrationSystemBasic(t, container)
		})

		t.Run("Table Verification", func(t *testing.T) {
			testTableVerification(t, container)
		})

		t.Run("Database Health", func(t *testing.T) {
			testDatabaseHealth(t, container)
		})

		t.Run("Basic CRUD Operations", func(t *testing.T) {
			testBasicCRUDOperations(t, container)
		})
	})
}

// testDatabaseConnection verifies database connectivity
func testDatabaseConnection(t *testing.T, container *PostgreSQLTestContainer) {
	// Test ping
	err := container.DB.Ping()
	require.NoError(t, err)

	// Test basic query
	var result int
	err = container.DB.QueryRow("SELECT 1").Scan(&result)
	require.NoError(t, err)
	assert.Equal(t, 1, result)

	// Test connection stats
	stats := container.DB.Stats()
	assert.GreaterOrEqual(t, stats.OpenConnections, 0)
	assert.LessOrEqual(t, stats.OpenConnections, stats.MaxOpenConnections)

	t.Logf("Database connection verified: %d open connections", stats.OpenConnections)
}

// testMigrationSystemBasic tests migration functionality
func testMigrationSystemBasic(t *testing.T, container *PostgreSQLTestContainer) {
	migrationMgr := database.NewMigrationManager(container.DB.DB)

	// Get migration status
	status, err := migrationMgr.GetMigrationStatus()
	require.NoError(t, err)
	assert.NotNil(t, status)

	t.Logf("Migration status: %d total, %d applied, %d pending", 
		status.TotalMigrations, status.AppliedCount, status.PendingCount)

	// Verify migrations are up to date (they were applied in helper)
	assert.True(t, status.IsUpToDate(), "All migrations should be applied")
	assert.Equal(t, 0, status.PendingCount, "No pending migrations expected")
	assert.Greater(t, status.AppliedCount, 0, "At least one migration should be applied")

	// Get migration history
	history, err := migrationMgr.GetAppliedMigrations()
	require.NoError(t, err)
	assert.Greater(t, len(history), 0, "Should have migration history")

	// Verify first migration has required fields
	firstMigration := history[0]
	assert.NotEmpty(t, firstMigration.Version)
	assert.NotEmpty(t, firstMigration.Description)
	assert.NotEmpty(t, firstMigration.Checksum)
	assert.Greater(t, firstMigration.ExecutionTime, int64(0))
}

// testTableVerification verifies that all expected tables exist
func testTableVerification(t *testing.T, container *PostgreSQLTestContainer) {
	expectedTables := []string{
		"volumes", "volume_sizes", "containers", "volume_mounts",
		"scan_jobs", "volume_metrics", "system_health", "scan_cache", 
		"migration_history",
	}

	for _, tableName := range expectedTables {
		var exists bool
		query := `
			SELECT EXISTS (
				SELECT FROM information_schema.tables 
				WHERE table_schema = 'public' 
				AND table_name = $1
			)`
		
		err := container.DB.QueryRow(query, tableName).Scan(&exists)
		require.NoError(t, err)
		assert.True(t, exists, "Table %s should exist", tableName)
	}

	// Verify table structures for key tables
	t.Run("Volumes Table Structure", func(t *testing.T) {
		columns := getTableColumns(t, container, "volumes")
		expectedColumns := []string{
			"id", "volume_id", "name", "driver", "mountpoint", 
			"labels", "options", "scope", "status", "last_scanned", 
			"is_active", "created_at", "updated_at",
		}
		
		for _, expectedCol := range expectedColumns {
			assert.Contains(t, columns, expectedCol, 
				"Table volumes should have column %s", expectedCol)
		}
	})

	t.Run("Scan Jobs Table Structure", func(t *testing.T) {
		columns := getTableColumns(t, container, "scan_jobs")
		expectedColumns := []string{
			"id", "scan_id", "volume_id", "status", "progress", "method",
			"started_at", "completed_at", "error_message", "result_id",
			"estimated_duration", "created_at", "updated_at",
		}
		
		for _, expectedCol := range expectedColumns {
			assert.Contains(t, columns, expectedCol,
				"Table scan_jobs should have column %s", expectedCol)
		}
	})
}

// testDatabaseHealth verifies database health monitoring
func testDatabaseHealth(t *testing.T, container *PostgreSQLTestContainer) {
	health := container.DB.Health()
	assert.NotNil(t, health)
	assert.Contains(t, []string{"healthy", "degraded"}, health.Status)
	assert.Greater(t, health.ResponseTime, time.Duration(0))
	assert.GreaterOrEqual(t, health.OpenConns, 0)
	assert.GreaterOrEqual(t, health.MaxOpenConns, health.OpenConns)

	t.Logf("Database health: %s (response time: %v)", health.Status, health.ResponseTime)
}

// testBasicCRUDOperations tests basic database operations using raw SQL
func testBasicCRUDOperations(t *testing.T, container *PostgreSQLTestContainer) {
	// Test insert
	t.Run("Insert Volume", func(t *testing.T) {
		query := `
			INSERT INTO volumes (volume_id, name, driver, mountpoint, labels, options, scope, status, is_active)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
			RETURNING id, created_at, updated_at
		`
		
		var id int
		var createdAt, updatedAt time.Time
		err := container.DB.QueryRow(query,
			"test_vol_basic_001",
			"basic-integration-test-volume",
			"local",
			"/var/lib/docker/volumes/basic-integration-test-volume/_data",
			`{"env":"test","integration":"basic"}`,
			`{"type":"none"}`,
			"local",
			"active",
			true,
		).Scan(&id, &createdAt, &updatedAt)
		
		require.NoError(t, err)
		assert.Greater(t, id, 0)
		assert.True(t, createdAt.After(time.Time{}))
		assert.True(t, updatedAt.After(time.Time{}))

		t.Logf("Inserted volume with ID: %d", id)
	})

	// Test select
	t.Run("Select Volume", func(t *testing.T) {
		query := `
			SELECT volume_id, name, driver, status, is_active 
			FROM volumes 
			WHERE volume_id = $1
		`
		
		var volumeID, name, driver, status string
		var isActive bool
		err := container.DB.QueryRow(query, "test_vol_basic_001").Scan(
			&volumeID, &name, &driver, &status, &isActive)
		
		require.NoError(t, err)
		assert.Equal(t, "test_vol_basic_001", volumeID)
		assert.Equal(t, "basic-integration-test-volume", name)
		assert.Equal(t, "local", driver)
		assert.Equal(t, "active", status)
		assert.True(t, isActive)
	})

	// Test update
	t.Run("Update Volume", func(t *testing.T) {
		query := `
			UPDATE volumes 
			SET status = $1, updated_at = CURRENT_TIMESTAMP 
			WHERE volume_id = $2
		`
		
		result, err := container.DB.Exec(query, "inactive", "test_vol_basic_001")
		require.NoError(t, err)
		
		rowsAffected, err := result.RowsAffected()
		require.NoError(t, err)
		assert.Equal(t, int64(1), rowsAffected)
	})

	// Test scan job operations
	t.Run("Insert Scan Job", func(t *testing.T) {
		query := `
			INSERT INTO scan_jobs (scan_id, volume_id, status, progress, method)
			VALUES ($1, $2, $3, $4, $5)
			RETURNING id, created_at
		`
		
		var id int
		var createdAt time.Time
		err := container.DB.QueryRow(query,
			"scan_basic_001",
			"test_vol_basic_001",
			"queued",
			0,
			"du",
		).Scan(&id, &createdAt)
		
		require.NoError(t, err)
		assert.Greater(t, id, 0)
		assert.True(t, createdAt.After(time.Time{}))

		t.Logf("Inserted scan job with ID: %d", id)
	})

	// Test count operations
	t.Run("Count Records", func(t *testing.T) {
		var volumeCount, scanJobCount int
		
		err := container.DB.QueryRow("SELECT COUNT(*) FROM volumes").Scan(&volumeCount)
		require.NoError(t, err)
		assert.GreaterOrEqual(t, volumeCount, 1)
		
		err = container.DB.QueryRow("SELECT COUNT(*) FROM scan_jobs").Scan(&scanJobCount)
		require.NoError(t, err)
		assert.GreaterOrEqual(t, scanJobCount, 1)

		t.Logf("Database contains: %d volumes, %d scan jobs", volumeCount, scanJobCount)
	})
}

// getTableColumns returns the column names for a given table
func getTableColumns(t *testing.T, container *PostgreSQLTestContainer, tableName string) []string {
	query := `
		SELECT column_name 
		FROM information_schema.columns 
		WHERE table_schema = 'public' 
		AND table_name = $1
		ORDER BY ordinal_position
	`
	
	rows, err := container.DB.Query(query, tableName)
	require.NoError(t, err)
	defer rows.Close()

	var columns []string
	for rows.Next() {
		var columnName string
		err := rows.Scan(&columnName)
		require.NoError(t, err)
		columns = append(columns, columnName)
	}
	
	require.NoError(t, rows.Err())
	return columns
}

// TestDatabaseConcurrency tests concurrent database operations
func TestDatabaseConcurrency(t *testing.T) {
	DockerRequiredOrSkip(t)

	WithPostgreSQLContainer(t, "volumeviz_concurrency_test", func(container *PostgreSQLTestContainer) {
		const numGoroutines = 20
		results := make(chan error, numGoroutines)

		// Test concurrent reads
		for i := 0; i < numGoroutines; i++ {
			go func(id int) {
				var result int
				err := container.DB.QueryRow("SELECT $1", id).Scan(&result)
				results <- err
			}(i)
		}

		// Wait for all goroutines to complete
		successCount := 0
		for i := 0; i < numGoroutines; i++ {
			err := <-results
			if err == nil {
				successCount++
			} else {
				t.Logf("Concurrent query failed: %v", err)
			}
		}

		assert.Equal(t, numGoroutines, successCount, "All concurrent queries should succeed")

		// Verify connection pool is working properly
		stats := container.DB.Stats()
		assert.LessOrEqual(t, stats.OpenConnections, container.Config.MaxOpenConns)
		assert.LessOrEqual(t, stats.Idle, container.Config.MaxIdleConns)

		t.Logf("Concurrency test: %d/%d successful, pool: %d open, %d idle", 
			successCount, numGoroutines, stats.OpenConnections, stats.Idle)
	})
}

// TestDatabasePerformanceBasic tests basic performance characteristics
func TestDatabasePerformanceBasic(t *testing.T) {
	DockerRequiredOrSkip(t)

	WithPostgreSQLContainer(t, "volumeviz_performance_test", func(container *PostgreSQLTestContainer) {
		// Test bulk insert performance
		t.Run("Bulk Insert Performance", func(t *testing.T) {
			const numRecords = 100
			start := time.Now()

			for i := 0; i < numRecords; i++ {
				query := `
					INSERT INTO volumes (volume_id, name, driver, mountpoint, labels, options, scope, status, is_active)
					VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
				`
				_, err := container.DB.Exec(query,
					fmt.Sprintf("perf_vol_%04d", i),
					fmt.Sprintf("performance-test-volume-%d", i),
					"local",
					fmt.Sprintf("/test/perf/%d", i),
					`{"test":"performance"}`,
					`{}`,
					"local",
					"active",
					true,
				)
				require.NoError(t, err)
			}

			duration := time.Since(start)
			ratePerSecond := float64(numRecords) / duration.Seconds()

			t.Logf("Inserted %d records in %v (%.2f records/sec)", 
				numRecords, duration, ratePerSecond)

			// Performance assertions
			assert.Less(t, duration, 10*time.Second, 
				"Bulk insert should complete within 10 seconds")
			assert.Greater(t, ratePerSecond, 5.0, 
				"Should insert at least 5 records per second")
		})

		// Test query performance
		t.Run("Query Performance", func(t *testing.T) {
			start := time.Now()
			
			var count int
			err := container.DB.QueryRow("SELECT COUNT(*) FROM volumes").Scan(&count)
			
			duration := time.Since(start)
			
			require.NoError(t, err)
			assert.Greater(t, count, 0)

			t.Logf("Count query completed in %v (returned %d records)", duration, count)
			assert.Less(t, duration, 1*time.Second, 
				"Count query should complete within 1 second")
		})
	})
}