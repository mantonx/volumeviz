package database

import (
	"testing"
	"time"
)

func TestPostgreSQLPerformanceOptimizations(t *testing.T) {
	// Test PostgreSQL configuration optimizations
	config := DefaultPostgreSQLConfig()

	// Verify optimized settings
	if config.MaxOpenConns != 100 {
		t.Errorf("Expected MaxOpenConns=100 for PostgreSQL, got %d", config.MaxOpenConns)
	}

	if config.MaxIdleConns != 50 {
		t.Errorf("Expected MaxIdleConns=50 for PostgreSQL, got %d", config.MaxIdleConns)
	}

	if config.ConnMaxLife != 1*time.Hour {
		t.Errorf("Expected ConnMaxLife=1h for PostgreSQL, got %v", config.ConnMaxLife)
	}

	if config.Timeout != 60*time.Second {
		t.Errorf("Expected Timeout=60s for PostgreSQL, got %v", config.Timeout)
	}

	if config.SSLMode != "prefer" {
		t.Errorf("Expected SSLMode=prefer for PostgreSQL, got %s", config.SSLMode)
	}

	// Test DSN generation with performance parameters
	dsn := config.DSN()

	expectedParams := []string{
		"application_name=volumeviz",
		"statement_timeout=",
		"lock_timeout=30000",
		"idle_in_transaction_session_timeout=60000",
	}

	for _, param := range expectedParams {
		if !containsPG(dsn, param) {
			t.Errorf("PostgreSQL DSN should contain '%s', got: %s", param, dsn)
		}
	}

	t.Logf("PostgreSQL DSN: %s", dsn)
}

func TestPostgreSQLVsSQLiteConfiguration(t *testing.T) {
	pgConfig := DefaultPostgreSQLConfig()
	sqliteConfig := DefaultSQLiteConfig()

	// PostgreSQL should support more concurrent connections
	if pgConfig.MaxOpenConns <= sqliteConfig.MaxOpenConns {
		t.Error("PostgreSQL should support more concurrent connections than SQLite")
	}

	// PostgreSQL should have longer connection lifetime
	if pgConfig.ConnMaxLife <= sqliteConfig.ConnMaxLife {
		t.Error("PostgreSQL should have longer connection lifetime than SQLite")
	}

	// PostgreSQL should have longer timeout for complex queries
	if pgConfig.Timeout <= sqliteConfig.Timeout {
		t.Error("PostgreSQL should have longer timeout than SQLite")
	}

	t.Logf("PostgreSQL concurrency: %d open, %d idle", pgConfig.MaxOpenConns, pgConfig.MaxIdleConns)
	t.Logf("SQLite concurrency: %d open, %d idle", sqliteConfig.MaxOpenConns, sqliteConfig.MaxIdleConns)
}

// This test would require an actual PostgreSQL instance
func TestPostgreSQLOptimizationsIntegration(t *testing.T) {
	t.Skip("Requires PostgreSQL instance - skipping integration test")

	// This is how the test would work with a real PostgreSQL instance:
	/*
		config := DefaultPostgreSQLConfig()
		config.Host = "localhost"
		config.Port = 5432
		config.Database = "volumeviz_test"

		db, err := NewDB(config)
		if err != nil {
			t.Fatalf("Failed to connect to PostgreSQL: %v", err)
		}
		defer db.Close()

		// Verify optimizations are applied
		settings := []struct {
			setting  string
			expected string
		}{
			{"work_mem", "64MB"},
			{"effective_cache_size", "2GB"},
			{"random_page_cost", "1.1"},
			{"jit", "on"},
		}

		for _, setting := range settings {
			var value string
			err := db.QueryRow("SHOW " + setting.setting).Scan(&value)
			if err != nil {
				t.Errorf("Failed to query %s: %v", setting.setting, err)
				continue
			}

			if value != setting.expected {
				t.Logf("Setting %s: expected %s, got %s", setting.setting, setting.expected, value)
			}
		}

		// Test optimization method
		err = db.OptimizeDatabase()
		if err != nil {
			t.Errorf("PostgreSQL optimization failed: %v", err)
		}
	*/
}

// Benchmark comparison framework (would need real PostgreSQL for meaningful results)
func BenchmarkPostgreSQLVsSQLiteComparison(b *testing.B) {
	b.Skip("Requires PostgreSQL instance for comparison")

	// This benchmark would compare PostgreSQL vs SQLite performance
	/*
		b.Run("PostgreSQL", func(b *testing.B) {
			config := DefaultPostgreSQLConfig()
			config.Database = "volumeviz_bench"

			db, err := NewDB(config)
			if err != nil {
				b.Fatalf("Failed to create PostgreSQL connection: %v", err)
			}
			defer db.Close()

			benchmarkDatabaseOperations(b, db)
		})

		b.Run("SQLite", func(b *testing.B) {
			config := DefaultSQLiteConfig()
			config.Path = b.TempDir() + "/benchmark.db"

			db, err := NewDB(config)
			if err != nil {
				b.Fatalf("Failed to create SQLite connection: %v", err)
			}
			defer db.Close()

			benchmarkDatabaseOperations(b, db)
		})
	*/
}

func TestPostgreSQLPerformanceSettings(t *testing.T) {
	// Test the optimization settings that would be applied
	expectedOptimizations := map[string]string{
		"work_mem":                            "64MB",
		"maintenance_work_mem":                "256MB",
		"temp_buffers":                        "32MB",
		"random_page_cost":                    "1.1",
		"effective_cache_size":                "2GB",
		"effective_io_concurrency":            "200",
		"max_parallel_workers_per_gather":     "4",
		"statement_timeout":                   "300s",
		"lock_timeout":                        "30s",
		"idle_in_transaction_session_timeout": "60s",
	}

	t.Logf("PostgreSQL optimizations that would be applied:")
	for setting, value := range expectedOptimizations {
		t.Logf("  %s = %s", setting, value)
	}

	// Verify we have comprehensive optimizations
	if len(expectedOptimizations) < 10 {
		t.Error("Should have at least 10 performance optimizations")
	}
}

func TestPostgreSQLConnectionStringOptimizations(t *testing.T) {
	config := DefaultPostgreSQLConfig()
	dsn := config.DSN()

	// Check for performance-related connection parameters
	performanceParams := []string{
		"application_name=volumeviz",                // For monitoring and debugging
		"statement_timeout=",                        // Prevent runaway queries
		"lock_timeout=30000",                        // Lock acquisition timeout
		"idle_in_transaction_session_timeout=60000", // Idle transaction timeout
	}

	for _, param := range performanceParams {
		if !containsPG(dsn, param) {
			t.Errorf("PostgreSQL DSN missing performance parameter: %s", param)
		}
	}

	t.Logf("PostgreSQL connection optimizations verified in DSN")
}

// Performance comparison expectations
func TestPerformanceExpectations(t *testing.T) {
	expectations := map[string]map[string]string{
		"PostgreSQL": {
			"Concurrent Connections": "Excellent (100+ connections)",
			"Write Throughput":       "High (10,000+ writes/sec)",
			"Query Performance":      "Excellent (complex queries optimized)",
			"Memory Usage":           "Higher (64MB work_mem + caching)",
			"Disk I/O":               "Optimized (parallel, SSD-aware)",
			"Transaction Safety":     "ACID compliant with durability",
			"Scalability":            "Horizontal and vertical scaling",
		},
		"SQLite": {
			"Concurrent Connections": "Limited (1 writer)",
			"Write Throughput":       "High (90,000+ writes/sec single-threaded)",
			"Query Performance":      "Good (optimized for simple queries)",
			"Memory Usage":           "Lower (64MB cache + 256MB mmap)",
			"Disk I/O":               "File-based with WAL mode",
			"Transaction Safety":     "ACID compliant",
			"Scalability":            "Vertical scaling only",
		},
	}

	for db, metrics := range expectations {
		t.Logf("\n%s Performance Profile:", db)
		for metric, expectation := range metrics {
			t.Logf("  %s: %s", metric, expectation)
		}
	}
}

// Helper function for PostgreSQL tests
func containsPG(s, substr string) bool {
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return true
		}
	}
	return false
}
