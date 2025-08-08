package integration

import (
	"context"
	"database/sql"
	"fmt"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/testcontainers/testcontainers-go"
	"github.com/testcontainers/testcontainers-go/modules/postgres"
	"github.com/testcontainers/testcontainers-go/wait"

	"github.com/mantonx/volumeviz/internal/database"
)

// TestDatabaseIntegration runs comprehensive integration tests with a real PostgreSQL container
func TestDatabaseIntegration(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping integration tests in short mode")
	}

	ctx := context.Background()

	// Start PostgreSQL container
	postgresContainer, err := postgres.Run(ctx,
		"postgres:15-alpine",
		postgres.WithDatabase("volumeviz_test"),
		postgres.WithUsername("test_user"),
		postgres.WithPassword("test_password"),
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
	config := &database.Config{
		Host:         host,
		Port:         port.Int(),
		User:         "test_user",
		Password:     "test_password",
		Database:     "volumeviz_test",
		SSLMode:      "disable",
		MaxOpenConns: 10,
		MaxIdleConns: 5,
		ConnMaxLife:  5 * time.Minute,
		Timeout:      30 * time.Second,
	}

	// Connect to database
	db, err := database.NewDB(config)
	require.NoError(t, err)
	defer db.Close()

	// Test database connection
	err = db.Ping()
	require.NoError(t, err)

	// Run migration tests
	t.Run("Migration System", func(t *testing.T) {
		testMigrationSystem(t, db)
	})

	// Run repository tests
	t.Run("Volume Repository", func(t *testing.T) {
		testVolumeRepository(t, db)
	})

	t.Run("Scan Job Repository", func(t *testing.T) {
		testScanJobRepository(t, db)
	})

	// Run transaction tests
	t.Run("Transaction Support", func(t *testing.T) {
		testTransactionSupport(t, db)
	})

	// Run performance tests
	t.Run("Performance Tests", func(t *testing.T) {
		testDatabasePerformance(t, db)
	})
}

// testMigrationSystem tests the migration system with real database
func testMigrationSystem(t *testing.T, db *database.DB) {
	migrationMgr := database.NewMigrationManager(db)

	// Test getting initial migration status
	status, err := migrationMgr.GetMigrationStatus()
	require.NoError(t, err)
	assert.NotNil(t, status)

	// Load migrations from files
	migrations, err := migrationMgr.LoadMigrationsFromFiles()
	require.NoError(t, err)
	assert.Greater(t, len(migrations), 0, "Should have at least one migration")

	// Apply all migrations
	err = migrationMgr.ApplyAllPending()
	require.NoError(t, err)

	// Verify migrations were applied
	finalStatus, err := migrationMgr.GetMigrationStatus()
	require.NoError(t, err)
	assert.True(t, finalStatus.IsUpToDate())
	assert.Equal(t, 0, finalStatus.PendingCount)

	// Test migration history
	history, err := migrationMgr.GetAppliedMigrations()
	require.NoError(t, err)
	assert.Greater(t, len(history), 0)

	// Verify tables exist
	tables := []string{"volumes", "volume_sizes", "containers", "volume_mounts", 
		"scan_jobs", "volume_metrics", "system_health", "scan_cache", "migration_history"}
	
	for _, table := range tables {
		var exists bool
		err := db.QueryRow(`
			SELECT EXISTS (
				SELECT FROM information_schema.tables 
				WHERE table_schema = 'public' 
				AND table_name = $1
			)`, table).Scan(&exists)
		require.NoError(t, err)
		assert.True(t, exists, "Table %s should exist", table)
	}
}

// testVolumeRepository tests volume repository operations
func testVolumeRepository(t *testing.T, db *database.DB) {
	repo := database.NewVolumeRepository(db)

	// Create test volume
	now := time.Now()
	volume := &database.Volume{
		VolumeID:    "test_vol_integration_001",
		Name:        "integration-test-volume",
		Driver:      "local",
		Mountpoint:  "/var/lib/docker/volumes/integration-test-volume/_data",
		Labels:      database.Labels{"env": "test", "integration": "true"},
		Options:     database.Labels{"type": "none"},
		Scope:       "local",
		Status:      "active",
		IsActive:    true,
		LastScanned: &now,
	}

	// Test Create
	err := repo.Create(volume)
	require.NoError(t, err)
	assert.Greater(t, volume.ID, 0, "ID should be assigned")

	// Test GetByVolumeID
	retrieved, err := repo.GetByVolumeID("test_vol_integration_001")
	require.NoError(t, err)
	assert.Equal(t, volume.VolumeID, retrieved.VolumeID)
	assert.Equal(t, volume.Name, retrieved.Name)
	assert.Equal(t, volume.Driver, retrieved.Driver)

	// Test UpsertVolume (update existing)
	retrieved.Status = "inactive"
	retrieved.IsActive = false
	err = repo.UpsertVolume(retrieved)
	require.NoError(t, err)

	// Verify update
	updated, err := repo.GetByVolumeID("test_vol_integration_001")
	require.NoError(t, err)
	assert.Equal(t, "inactive", updated.Status)
	assert.False(t, updated.IsActive)

	// Test List with pagination
	options := &database.FilterOptions{
		Limit:  &[]int{10}[0],
		Offset: &[]int{0}[0],
	}
	result, err := repo.List(options)
	require.NoError(t, err)
	assert.NotNil(t, result)
	assert.Greater(t, result.Total, 0)
	assert.GreaterOrEqual(t, len(result.Items), 1)

	// Test UpdateLastScanned
	newScanTime := time.Now().Add(1 * time.Hour)
	err = repo.UpdateLastScanned("test_vol_integration_001", newScanTime)
	require.NoError(t, err)

	// Verify scan time update
	scanned, err := repo.GetByVolumeID("test_vol_integration_001")
	require.NoError(t, err)
	assert.True(t, scanned.LastScanned.After(now))

	// Test GetVolumeStats
	stats, err := repo.GetVolumeStats()
	require.NoError(t, err)
	assert.NotNil(t, stats)
	assert.GreaterOrEqual(t, stats.TotalVolumes, 1)

	// Create another volume for bulk operations
	volume2 := &database.Volume{
		VolumeID:   "test_vol_integration_002",
		Name:       "integration-test-volume-2",
		Driver:     "local",
		Mountpoint: "/var/lib/docker/volumes/integration-test-volume-2/_data",
		Labels:     database.Labels{"env": "test"},
		Options:    database.Labels{},
		Scope:      "local",
		Status:     "active",
		IsActive:   true,
	}
	err = repo.Create(volume2)
	require.NoError(t, err)

	// Test bulk operations would go here
	// For now, verify we have multiple volumes
	allResult, err := repo.List(nil)
	require.NoError(t, err)
	assert.GreaterOrEqual(t, allResult.Total, 2)
}

// testScanJobRepository tests scan job repository operations
func testScanJobRepository(t *testing.T, db *database.DB) {
	repo := database.NewScanJobRepository(db)

	// Create test scan job
	duration := 30 * time.Second
	job := &database.ScanJob{
		ScanID:            "scan_integration_001",
		VolumeID:          "test_vol_integration_001",
		Status:            "queued",
		Progress:          0,
		Method:            "du",
		EstimatedDuration: &duration,
	}

	// Test Create
	err := repo.Create(job)
	require.NoError(t, err)
	assert.Greater(t, job.ID, 0)

	// Test GetByScanID
	retrieved, err := repo.GetByScanID("scan_integration_001")
	require.NoError(t, err)
	assert.Equal(t, "scan_integration_001", retrieved.ScanID)
	assert.Equal(t, "queued", retrieved.Status)

	// Test StartJob
	err = repo.StartJob("scan_integration_001")
	require.NoError(t, err)

	// Verify job started
	started, err := repo.GetByScanID("scan_integration_001")
	require.NoError(t, err)
	assert.Equal(t, "running", started.Status)
	assert.NotNil(t, started.StartedAt)

	// Test UpdateStatus
	err = repo.UpdateStatus("scan_integration_001", "running", 50)
	require.NoError(t, err)

	// Verify status update
	updated, err := repo.GetByScanID("scan_integration_001")
	require.NoError(t, err)
	assert.Equal(t, 50, updated.Progress)

	// Test CompleteJob successfully
	resultID := 42
	err = repo.CompleteJob("scan_integration_001", &resultID, nil)
	require.NoError(t, err)

	// Verify completion
	completed, err := repo.GetByScanID("scan_integration_001")
	require.NoError(t, err)
	assert.Equal(t, "completed", completed.Status)
	assert.Equal(t, 100, completed.Progress)
	assert.NotNil(t, completed.CompletedAt)
	assert.NotNil(t, completed.ResultID)
	assert.Equal(t, 42, *completed.ResultID)

	// Test GetActiveJobs (should be empty now)
	activeJobs, err := repo.GetActiveJobs()
	require.NoError(t, err)
	assert.Equal(t, 0, len(activeJobs))

	// Test GetJobsByStatus
	completedJobs, err := repo.GetJobsByStatus("completed")
	require.NoError(t, err)
	assert.GreaterOrEqual(t, len(completedJobs), 1)

	// Test GetJobStats
	stats, err := repo.GetJobStats()
	require.NoError(t, err)
	assert.NotNil(t, stats)
	assert.GreaterOrEqual(t, stats.TotalJobs, 1)
	assert.GreaterOrEqual(t, stats.CompletedJobs, 1)

	// Create and test failed job
	failedJob := &database.ScanJob{
		ScanID:   "scan_integration_failed",
		VolumeID: "test_vol_integration_001",
		Status:   "queued",
		Progress: 0,
		Method:   "find",
	}
	err = repo.Create(failedJob)
	require.NoError(t, err)

	err = repo.StartJob("scan_integration_failed")
	require.NoError(t, err)

	// Fail the job
	errorMsg := "Mock scan failure for testing"
	err = repo.CompleteJob("scan_integration_failed", nil, &errorMsg)
	require.NoError(t, err)

	// Verify failure
	failed, err := repo.GetByScanID("scan_integration_failed")
	require.NoError(t, err)
	assert.Equal(t, "failed", failed.Status)
	assert.NotNil(t, failed.ErrorMessage)
	assert.Equal(t, errorMsg, *failed.ErrorMessage)
	assert.Nil(t, failed.ResultID)
}

// testTransactionSupport tests transaction functionality
func testTransactionSupport(t *testing.T, db *database.DB) {
	volumeRepo := database.NewVolumeRepository(db)
	scanJobRepo := database.NewScanJobRepository(db)

	// Test successful transaction
	t.Run("Successful Transaction", func(t *testing.T) {
		tx, err := db.BeginTx()
		require.NoError(t, err)

		// Use repositories with transaction
		txVolumeRepo := volumeRepo.WithTx(tx)
		txScanJobRepo := scanJobRepo.WithTx(tx)

		// Create volume within transaction
		volume := &database.Volume{
			VolumeID:   "tx_test_vol_001",
			Name:       "transaction-test-volume",
			Driver:     "local",
			Mountpoint: "/test/path",
			Labels:     database.Labels{},
			Options:    database.Labels{},
			Scope:      "local",
			Status:     "active",
			IsActive:   true,
		}
		err = txVolumeRepo.Create(volume)
		require.NoError(t, err)

		// Create scan job within same transaction
		job := &database.ScanJob{
			ScanID:   "tx_scan_001",
			VolumeID: "tx_test_vol_001",
			Status:   "queued",
			Progress: 0,
			Method:   "du",
		}
		err = txScanJobRepo.Create(job)
		require.NoError(t, err)

		// Commit transaction
		err = tx.Commit()
		require.NoError(t, err)

		// Verify both records exist
		_, err = volumeRepo.GetByVolumeID("tx_test_vol_001")
		assert.NoError(t, err)

		_, err = scanJobRepo.GetByScanID("tx_scan_001")
		assert.NoError(t, err)
	})

	// Test rollback transaction
	t.Run("Rollback Transaction", func(t *testing.T) {
		tx, err := db.BeginTx()
		require.NoError(t, err)

		txVolumeRepo := volumeRepo.WithTx(tx)

		// Create volume within transaction
		volume := &database.Volume{
			VolumeID:   "tx_rollback_vol_001",
			Name:       "rollback-test-volume",
			Driver:     "local",
			Mountpoint: "/test/rollback/path",
			Labels:     database.Labels{},
			Options:    database.Labels{},
			Scope:      "local",
			Status:     "active",
			IsActive:   true,
		}
		err = txVolumeRepo.Create(volume)
		require.NoError(t, err)

		// Rollback transaction
		err = tx.Rollback()
		require.NoError(t, err)

		// Verify record doesn't exist
		_, err = volumeRepo.GetByVolumeID("tx_rollback_vol_001")
		assert.Error(t, err)
		assert.Equal(t, sql.ErrNoRows, err)
	})
}

// testDatabasePerformance tests database performance characteristics
func testDatabasePerformance(t *testing.T, db *database.DB) {
	repo := database.NewVolumeRepository(db)

	// Test bulk insert performance
	t.Run("Bulk Insert Performance", func(t *testing.T) {
		const numRecords = 1000
		start := time.Now()

		for i := 0; i < numRecords; i++ {
			volume := &database.Volume{
				VolumeID:   fmt.Sprintf("perf_test_vol_%04d", i),
				Name:       fmt.Sprintf("performance-test-volume-%d", i),
				Driver:     "local", 
				Mountpoint: fmt.Sprintf("/test/perf/%d", i),
				Labels:     database.Labels{"test": "performance", "batch": "bulk_insert"},
				Options:    database.Labels{},
				Scope:      "local",
				Status:     "active",
				IsActive:   true,
			}
			err := repo.Create(volume)
			require.NoError(t, err)
		}

		duration := time.Since(start)
		ratePerSecond := float64(numRecords) / duration.Seconds()

		t.Logf("Inserted %d records in %v (%.2f records/sec)", numRecords, duration, ratePerSecond)
		
		// Performance assertions (adjust based on acceptable performance)
		assert.Less(t, duration, 30*time.Second, "Bulk insert should complete within 30 seconds")
		assert.Greater(t, ratePerSecond, 10.0, "Should insert at least 10 records per second")
	})

	// Test query performance
	t.Run("Query Performance", func(t *testing.T) {
		// Test pagination performance
		options := &database.FilterOptions{
			Limit:  &[]int{100}[0],
			Offset: &[]int{0}[0],
		}

		start := time.Now()
		result, err := repo.List(options)
		duration := time.Since(start)

		require.NoError(t, err)
		assert.GreaterOrEqual(t, len(result.Items), 100)

		t.Logf("Paginated query (100 records) completed in %v", duration)
		assert.Less(t, duration, 1*time.Second, "Paginated query should complete within 1 second")
	})

	// Test database health under load
	t.Run("Database Health", func(t *testing.T) {
		health := db.Health()
		assert.Equal(t, "healthy", health.Status)
		assert.Less(t, health.ResponseTime, 100*time.Millisecond)
		assert.Greater(t, health.OpenConns, 0)
		assert.LessOrEqual(t, health.OpenConns, health.MaxOpenConns)
	})
}

// TestDatabaseConnectionPool tests connection pool behavior
func TestDatabaseConnectionPool(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping connection pool tests in short mode")
	}

	ctx := context.Background()

	// Start PostgreSQL container
	postgresContainer, err := postgres.Run(ctx,
		"postgres:15-alpine",
		postgres.WithDatabase("volumeviz_pool_test"),
		postgres.WithUsername("test_user"),
		postgres.WithPassword("test_password"),
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

	// Create database configuration with small pool
	config := &database.Config{
		Host:         host,
		Port:         port.Int(),
		User:         "test_user",
		Password:     "test_password",
		Database:     "volumeviz_pool_test",
		SSLMode:      "disable",
		MaxOpenConns: 5,
		MaxIdleConns: 2,
		ConnMaxLife:  1 * time.Minute,
		Timeout:      10 * time.Second,
	}

	db, err := database.NewDB(config)
	require.NoError(t, err)
	defer db.Close()

	// Test concurrent connections
	const numGoroutines = 10
	results := make(chan error, numGoroutines)

	for i := 0; i < numGoroutines; i++ {
		go func(id int) {
			var result int
			err := db.QueryRow("SELECT $1", id).Scan(&result)
			results <- err
		}(i)
	}

	// Wait for all goroutines to complete
	for i := 0; i < numGoroutines; i++ {
		err := <-results
		assert.NoError(t, err, "Concurrent query should succeed")
	}

	// Verify connection pool stats
	stats := db.Stats()
	assert.LessOrEqual(t, stats.OpenConnections, config.MaxOpenConns)
	assert.LessOrEqual(t, stats.Idle, config.MaxIdleConns)
	assert.Equal(t, config.MaxOpenConns, stats.MaxOpenConnections)

	t.Logf("Connection pool stats: Open=%d, Idle=%d, Max=%d", 
		stats.OpenConnections, stats.Idle, stats.MaxOpenConnections)
}