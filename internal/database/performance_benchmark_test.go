package database

import (
	"fmt"
	"os"
	"path/filepath"
	"testing"
	"time"
)

// BenchmarkDatabaseOperations compares SQLite vs PostgreSQL performance
func BenchmarkDatabaseOperations(b *testing.B) {
	// Only run if benchmark is specifically requested
	if !testing.Short() {
		b.Skip("Skipping benchmark in short mode")
	}
	
	benchmarks := []struct {
		name     string
		dbType   DatabaseType
		getDB    func(b *testing.B) *DB
	}{
		{
			name:   "SQLite",
			dbType: DatabaseTypeSQLite,
			getDB:  setupSQLiteDB,
		},
		// PostgreSQL benchmark would require actual PostgreSQL instance
		// {
		// 	name:   "PostgreSQL", 
		// 	dbType: DatabaseTypePostgreSQL,
		// 	getDB:  setupPostgreSQLDB,
		// },
	}
	
	for _, bm := range benchmarks {
		b.Run(fmt.Sprintf("%s_Connection", bm.name), func(b *testing.B) {
			benchmarkConnection(b, bm.getDB)
		})
		
		b.Run(fmt.Sprintf("%s_SimpleQuery", bm.name), func(b *testing.B) {
			benchmarkSimpleQuery(b, bm.getDB)
		})
		
		b.Run(fmt.Sprintf("%s_Insert", bm.name), func(b *testing.B) {
			benchmarkInsert(b, bm.getDB)
		})
		
		b.Run(fmt.Sprintf("%s_Transaction", bm.name), func(b *testing.B) {
			benchmarkTransaction(b, bm.getDB)
		})
		
		b.Run(fmt.Sprintf("%s_Migration", bm.name), func(b *testing.B) {
			benchmarkMigration(b, bm.getDB)
		})
	}
}

func setupSQLiteDB(b *testing.B) *DB {
	tempDir := b.TempDir()
	dbPath := filepath.Join(tempDir, "benchmark.db")
	
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
		b.Fatalf("Failed to create SQLite database: %v", err)
	}
	
	// Setup test table
	_, err = db.Exec(`
		CREATE TABLE IF NOT EXISTS benchmark_test (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			name TEXT NOT NULL,
			value INTEGER NOT NULL,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP
		)
	`)
	if err != nil {
		b.Fatalf("Failed to create test table: %v", err)
	}
	
	b.Cleanup(func() {
		db.Close()
	})
	
	return db
}

func benchmarkConnection(b *testing.B, getDB func(b *testing.B) *DB) {
	b.ResetTimer()
	
	for i := 0; i < b.N; i++ {
		db := getDB(b)
		err := db.Ping()
		if err != nil {
			b.Fatalf("Ping failed: %v", err)
		}
		db.Close()
	}
}

func benchmarkSimpleQuery(b *testing.B, getDB func(b *testing.B) *DB) {
	db := getDB(b)
	
	// Insert some test data
	for i := 0; i < 100; i++ {
		_, err := db.Exec("INSERT INTO benchmark_test (name, value) VALUES (?, ?)", 
			fmt.Sprintf("test_%d", i), i)
		if err != nil {
			b.Fatalf("Failed to insert test data: %v", err)
		}
	}
	
	b.ResetTimer()
	
	for i := 0; i < b.N; i++ {
		rows, err := db.Query("SELECT id, name, value FROM benchmark_test LIMIT 10")
		if err != nil {
			b.Fatalf("Query failed: %v", err)
		}
		
		count := 0
		for rows.Next() {
			var id int
			var name string
			var value int
			err := rows.Scan(&id, &name, &value)
			if err != nil {
				b.Fatalf("Scan failed: %v", err)
			}
			count++
		}
		rows.Close()
		
		if count != 10 {
			b.Fatalf("Expected 10 rows, got %d", count)
		}
	}
}

func benchmarkInsert(b *testing.B, getDB func(b *testing.B) *DB) {
	db := getDB(b)
	
	b.ResetTimer()
	
	for i := 0; i < b.N; i++ {
		_, err := db.Exec("INSERT INTO benchmark_test (name, value) VALUES (?, ?)", 
			fmt.Sprintf("bench_%d", i), i)
		if err != nil {
			b.Fatalf("Insert failed: %v", err)
		}
	}
}

func benchmarkTransaction(b *testing.B, getDB func(b *testing.B) *DB) {
	db := getDB(b)
	
	b.ResetTimer()
	
	for i := 0; i < b.N; i++ {
		tx, err := db.BeginTx()
		if err != nil {
			b.Fatalf("Begin transaction failed: %v", err)
		}
		
		_, err = tx.Exec("INSERT INTO benchmark_test (name, value) VALUES (?, ?)", 
			fmt.Sprintf("tx_%d", i), i)
		if err != nil {
			tx.Rollback()
			b.Fatalf("Insert in transaction failed: %v", err)
		}
		
		err = tx.Commit()
		if err != nil {
			b.Fatalf("Commit failed: %v", err)
		}
	}
}

func benchmarkMigration(b *testing.B, getDB func(b *testing.B) *DB) {
	b.ResetTimer()
	
	for i := 0; i < b.N; i++ {
		db := getDB(b)
		mm := NewMigrationManager(db)
		
		start := time.Now()
		err := mm.EnsureMigrationTable()
		duration := time.Since(start)
		
		if err != nil {
			b.Fatalf("Migration failed: %v", err)
		}
		
		// Record the migration time for analysis
		b.ReportMetric(float64(duration.Nanoseconds()), "ns/migration")
		
		db.Close()
	}
}

// Performance comparison test
func TestDatabasePerformanceComparison(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping performance test in short mode")
	}
	
	// Test SQLite performance characteristics
	tempDir := t.TempDir()
	dbPath := filepath.Join(tempDir, "perf_test.db")
	
	config := &Config{
		Type:         DatabaseTypeSQLite,
		Path:         dbPath,
		MaxOpenConns: 1,
		MaxIdleConns: 1,
	}
	
	db, err := NewDB(config)
	if err != nil {
		t.Fatalf("Failed to create SQLite database: %v", err)
	}
	defer db.Close()
	
	// Create test table
	_, err = db.Exec(`
		CREATE TABLE perf_test (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			data TEXT NOT NULL,
			timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
		)
	`)
	if err != nil {
		t.Fatalf("Failed to create test table: %v", err)
	}
	
	// Measure insert performance
	insertCount := 1000
	start := time.Now()
	
	for i := 0; i < insertCount; i++ {
		_, err := db.Exec("INSERT INTO perf_test (data) VALUES (?)", 
			fmt.Sprintf("test_data_%d", i))
		if err != nil {
			t.Fatalf("Insert failed: %v", err)
		}
	}
	
	insertDuration := time.Since(start)
	insertRate := float64(insertCount) / insertDuration.Seconds()
	
	t.Logf("SQLite Insert Performance:")
	t.Logf("  - %d inserts in %v", insertCount, insertDuration)
	t.Logf("  - Rate: %.2f inserts/second", insertRate)
	
	// Measure query performance
	queryCount := 100
	start = time.Now()
	
	for i := 0; i < queryCount; i++ {
		rows, err := db.Query("SELECT id, data FROM perf_test LIMIT 10")
		if err != nil {
			t.Fatalf("Query failed: %v", err)
		}
		
		for rows.Next() {
			var id int
			var data string
			rows.Scan(&id, &data)
		}
		rows.Close()
	}
	
	queryDuration := time.Since(start)
	queryRate := float64(queryCount) / queryDuration.Seconds()
	
	t.Logf("SQLite Query Performance:")
	t.Logf("  - %d queries in %v", queryCount, queryDuration)
	t.Logf("  - Rate: %.2f queries/second", queryRate)
	
	// Measure database size
	if stat, err := os.Stat(dbPath); err == nil {
		t.Logf("SQLite Database Size: %d bytes (%.2f KB)", stat.Size(), float64(stat.Size())/1024.0)
	}
}