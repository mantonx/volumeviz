package database

import (
	"path/filepath"
	"testing"
	"time"
)

func TestSQLiteOptimizations(t *testing.T) {
	// Create temporary database
	tempDir := t.TempDir()
	dbPath := filepath.Join(tempDir, "optimizations_test.db")

	config := &Config{
		Type:         DatabaseTypeSQLite,
		Path:         dbPath,
		MaxOpenConns: 1,
		MaxIdleConns: 1,
		ConnMaxLife:  30 * time.Minute,
		Timeout:      30 * time.Second,
	}

	db, err := NewDB(config)
	if err != nil {
		t.Fatalf("Failed to create SQLite database: %v", err)
	}
	defer db.Close()

	// Verify WAL mode is active
	var journalMode string
	err = db.QueryRow("PRAGMA journal_mode").Scan(&journalMode)
	if err != nil {
		t.Fatalf("Failed to query journal mode: %v", err)
	}

	if journalMode != "wal" {
		t.Errorf("Expected WAL mode, got %s", journalMode)
	}

	// Verify foreign keys are enabled
	var foreignKeys int
	err = db.QueryRow("PRAGMA foreign_keys").Scan(&foreignKeys)
	if err != nil {
		t.Fatalf("Failed to query foreign keys: %v", err)
	}

	if foreignKeys != 1 {
		t.Error("Foreign keys should be enabled")
	}

	// Verify cache size
	var cacheSize int
	err = db.QueryRow("PRAGMA cache_size").Scan(&cacheSize)
	if err != nil {
		t.Fatalf("Failed to query cache size: %v", err)
	}

	// Cache size should be negative (meaning KB) and around 64000
	if cacheSize > -50000 {
		t.Errorf("Expected cache size around -64000, got %d", cacheSize)
	}

	// Verify synchronous mode
	var syncMode string
	err = db.QueryRow("PRAGMA synchronous").Scan(&syncMode)
	if err != nil {
		t.Fatalf("Failed to query synchronous mode: %v", err)
	}

	if syncMode != "1" { // NORMAL mode = 1
		t.Errorf("Expected synchronous mode NORMAL (1), got %s", syncMode)
	}

	// Verify mmap size
	var mmapSize int64
	err = db.QueryRow("PRAGMA mmap_size").Scan(&mmapSize)
	if err != nil {
		t.Fatalf("Failed to query mmap size: %v", err)
	}

	if mmapSize < 200000000 { // Should be around 256MB
		t.Errorf("Expected mmap size around 256MB, got %d", mmapSize)
	}

	// Test database optimization
	err = db.OptimizeDatabase()
	if err != nil {
		t.Fatalf("Database optimization failed: %v", err)
	}

	t.Logf("SQLite optimizations verified:")
	t.Logf("  - Journal mode: %s", journalMode)
	t.Logf("  - Foreign keys: %d", foreignKeys)
	t.Logf("  - Cache size: %d KB", -cacheSize)
	t.Logf("  - Synchronous mode: %s", syncMode)
	t.Logf("  - Memory-mapped I/O: %d bytes", mmapSize)
}

func TestPostgreSQLOptimizations(t *testing.T) {
	// Test PostgreSQL configuration (doesn't require actual connection)
	config := DefaultConfig()

	if config.Type != DatabaseTypePostgreSQL {
		t.Errorf("Expected PostgreSQL type, got %v", config.Type)
	}

	// Test that PostgreSQL DSN doesn't contain SQLite-specific parameters
	dsn := config.DSN()
	if containsOpt(dsn, "_journal_mode") || containsOpt(dsn, "_cache_size") {
		t.Error("PostgreSQL DSN should not contain SQLite-specific parameters")
	}

	if !containsOpt(dsn, "host=") || !containsOpt(dsn, "port=") {
		t.Error("PostgreSQL DSN should contain host and port")
	}
}

func TestDatabaseTypeDetection(t *testing.T) {
	tempDir := t.TempDir()

	// Test SQLite detection
	sqliteConfig := &Config{
		Type: DatabaseTypeSQLite,
		Path: filepath.Join(tempDir, "test_sqlite.db"),
	}

	sqliteDB, err := NewDB(sqliteConfig)
	if err != nil {
		t.Fatalf("Failed to create SQLite database: %v", err)
	}
	defer sqliteDB.Close()

	if !sqliteDB.IsSQLite() {
		t.Error("Database should be detected as SQLite")
	}

	if sqliteDB.IsPostgreSQL() {
		t.Error("Database should not be detected as PostgreSQL")
	}

	if sqliteDB.GetDatabaseType() != DatabaseTypeSQLite {
		t.Errorf("Expected SQLite, got %v", sqliteDB.GetDatabaseType())
	}
}

func BenchmarkSQLiteOptimizedPerformance(b *testing.B) {
	tempDir := b.TempDir()
	dbPath := filepath.Join(tempDir, "benchmark_optimized.db")

	config := &Config{
		Type:         DatabaseTypeSQLite,
		Path:         dbPath,
		MaxOpenConns: 1,
		MaxIdleConns: 1,
	}

	db, err := NewDB(config)
	if err != nil {
		b.Fatalf("Failed to create SQLite database: %v", err)
	}
	defer db.Close()

	// Create test table
	_, err = db.Exec(`
		CREATE TABLE bench_optimized (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			data TEXT NOT NULL,
			value INTEGER NOT NULL
		)
	`)
	if err != nil {
		b.Fatalf("Failed to create test table: %v", err)
	}

	b.ResetTimer()

	// Benchmark insert performance with optimizations
	b.Run("Insert", func(b *testing.B) {
		for i := 0; i < b.N; i++ {
			_, err := db.Exec("INSERT INTO bench_optimized (data, value) VALUES (?, ?)",
				"benchmark_data", i)
			if err != nil {
				b.Fatalf("Insert failed: %v", err)
			}
		}
	})

	// Insert some data for query benchmarks
	for i := 0; i < 1000; i++ {
		db.Exec("INSERT INTO bench_optimized (data, value) VALUES (?, ?)",
			"benchmark_data", i)
	}

	// Benchmark query performance with optimizations
	b.Run("Query", func(b *testing.B) {
		for i := 0; i < b.N; i++ {
			rows, err := db.Query("SELECT id, data, value FROM bench_optimized LIMIT 10")
			if err != nil {
				b.Fatalf("Query failed: %v", err)
			}

			for rows.Next() {
				var id int
				var data string
				var value int
				rows.Scan(&id, &data, &value)
			}
			rows.Close()
		}
	})

	// Benchmark optimization operations
	b.Run("Optimize", func(b *testing.B) {
		for i := 0; i < b.N; i++ {
			err := db.OptimizeDatabase()
			if err != nil {
				b.Fatalf("Optimization failed: %v", err)
			}
		}
	})
}

// Helper function for string searching
func containsOpt(s, substr string) bool {
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return true
		}
	}
	return false
}
