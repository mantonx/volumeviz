// Package sqlite demonstrates SQLite performance optimizations in VolumeViz
// This example shows how to use the optimized SQLite database connection
// and measure the performance improvements from the applied optimizations.
package sqlite

import (
	"fmt"
	"log"
	"os"
	"path/filepath"
	"time"

	"github.com/mantonx/volumeviz/internal/database"
)

func Demo() {
	// Create temporary directory for demo
	tempDir, err := os.MkdirTemp("", "volumeviz_sqlite_demo")
	if err != nil {
		log.Fatal(err)
	}
	defer os.RemoveAll(tempDir)

	dbPath := filepath.Join(tempDir, "demo.db")
	fmt.Printf("Creating SQLite database at: %s\n", dbPath)

	// Create optimized SQLite configuration
	config := &database.Config{
		Type:         database.DatabaseTypeSQLite,
		Path:         dbPath,
		MaxOpenConns: 1,
		MaxIdleConns: 1,
		ConnMaxLife:  30 * time.Minute,
		Timeout:      30 * time.Second,
	}

	// Create database connection (automatically applies optimizations)
	db, err := database.NewDB(config)
	if err != nil {
		log.Fatalf("Failed to create database: %v", err)
	}
	defer db.Close()

	fmt.Println("\n🚀 SQLite Performance Optimizations Applied:")
	fmt.Println("   ✓ WAL mode for better concurrency")
	fmt.Println("   ✓ 64MB cache for faster queries")
	fmt.Println("   ✓ Memory-mapped I/O (256MB)")
	fmt.Println("   ✓ Optimized page size (4KB)")
	fmt.Println("   ✓ Foreign key constraints enabled")
	fmt.Println("   ✓ Incremental auto-vacuum")

	// Verify optimizations are active
	fmt.Println("\n📊 Current SQLite Settings:")
	if err := printSQLiteSettings(db); err != nil {
		log.Printf("Failed to print settings: %v", err)
	}

	// Create test table
	fmt.Println("\n🔧 Setting up test table...")
	createTableSQL := `
		CREATE TABLE IF NOT EXISTS performance_test (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			name TEXT NOT NULL,
			value INTEGER NOT NULL,
			data TEXT,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP
		)
	`
	if _, err := db.Exec(createTableSQL); err != nil {
		log.Fatalf("Failed to create table: %v", err)
	}

	// Performance test: Inserts
	fmt.Println("\n⚡ Running performance tests...")
	
	insertCount := 5000
	start := time.Now()
	
	for i := 0; i < insertCount; i++ {
		_, err := db.Exec("INSERT INTO performance_test (name, value, data) VALUES (?, ?, ?)",
			fmt.Sprintf("test_%d", i), i, fmt.Sprintf("data_for_record_%d", i))
		if err != nil {
			log.Fatalf("Insert failed: %v", err)
		}
	}
	
	insertDuration := time.Since(start)
	insertRate := float64(insertCount) / insertDuration.Seconds()
	
	fmt.Printf("   📝 Inserts: %d records in %v (%.0f records/sec)\n", 
		insertCount, insertDuration, insertRate)

	// Performance test: Queries
	queryCount := 1000
	start = time.Now()
	
	for i := 0; i < queryCount; i++ {
		rows, err := db.Query("SELECT id, name, value FROM performance_test LIMIT 10")
		if err != nil {
			log.Fatalf("Query failed: %v", err)
		}
		
		// Process results
		for rows.Next() {
			var id int
			var name string
			var value int
			rows.Scan(&id, &name, &value)
		}
		rows.Close()
	}
	
	queryDuration := time.Since(start)
	queryRate := float64(queryCount) / queryDuration.Seconds()
	
	fmt.Printf("   🔍 Queries: %d queries in %v (%.0f queries/sec)\n", 
		queryCount, queryDuration, queryRate)

	// Run database optimization
	fmt.Println("\n🔧 Running database optimization...")
	start = time.Now()
	if err := db.OptimizeDatabase(); err != nil {
		log.Printf("Optimization failed: %v", err)
	} else {
		optimizeDuration := time.Since(start)
		fmt.Printf("   ✨ Optimization completed in %v\n", optimizeDuration)
	}

	// Check database file size
	if stat, err := os.Stat(dbPath); err == nil {
		fmt.Printf("\n💾 Database file size: %d bytes (%.2f KB)\n", 
			stat.Size(), float64(stat.Size())/1024.0)
	}

	// Performance summary
	fmt.Println("\n📈 Performance Summary:")
	fmt.Printf("   • Insert throughput: %.0f records/second\n", insertRate)
	fmt.Printf("   • Query throughput:  %.0f queries/second\n", queryRate)
	fmt.Printf("   • Total records:     %d\n", insertCount)
	fmt.Printf("   • Database type:     %s\n", db.GetDatabaseType())
	
	if insertRate > 30000 {
		fmt.Println("   🎉 Excellent insert performance!")
	}
	if queryRate > 50000 {
		fmt.Println("   🎉 Excellent query performance!")
	}

	fmt.Println("\n✅ SQLite performance demo completed successfully!")
}

func printSQLiteSettings(db *database.DB) error {
	settings := []struct {
		pragma string
		name   string
	}{
		{"PRAGMA journal_mode", "Journal Mode"},
		{"PRAGMA synchronous", "Synchronous"},
		{"PRAGMA cache_size", "Cache Size"},
		{"PRAGMA foreign_keys", "Foreign Keys"},
		{"PRAGMA temp_store", "Temp Store"},
		{"PRAGMA mmap_size", "Memory-Mapped I/O"},
		{"PRAGMA page_size", "Page Size"},
		{"PRAGMA auto_vacuum", "Auto-Vacuum"},
	}

	for _, setting := range settings {
		var value string
		err := db.QueryRow(setting.pragma).Scan(&value)
		if err != nil {
			fmt.Printf("   ⚠️  %s: Unable to query\n", setting.name)
			continue
		}

		// Format values for better readability
		switch setting.pragma {
		case "PRAGMA cache_size":
			if cacheSize := parseIntSafe(value); cacheSize < 0 {
				fmt.Printf("   📊 %s: %s KB\n", setting.name, formatInt(-cacheSize))
			} else {
				fmt.Printf("   📊 %s: %s pages\n", setting.name, value)
			}
		case "PRAGMA mmap_size":
			if mmapSize := parseIntSafe(value); mmapSize > 0 {
				fmt.Printf("   📊 %s: %.1f MB\n", setting.name, float64(mmapSize)/1024/1024)
			}
		case "PRAGMA page_size":
			fmt.Printf("   📊 %s: %s bytes\n", setting.name, value)
		case "PRAGMA journal_mode":
			emoji := "📄"
			if value == "wal" {
				emoji = "⚡"
			}
			fmt.Printf("   %s %s: %s\n", emoji, setting.name, value)
		case "PRAGMA foreign_keys":
			emoji := "❌"
			if value == "1" {
				emoji = "✅"
			}
			fmt.Printf("   %s %s: %s\n", emoji, setting.name, value)
		default:
			fmt.Printf("   📊 %s: %s\n", setting.name, value)
		}
	}

	return nil
}

func parseIntSafe(s string) int64 {
	var result int64
	fmt.Sscanf(s, "%d", &result)
	return result
}

func formatInt(n int64) string {
	if n < 1000 {
		return fmt.Sprintf("%d", n)
	}
	if n < 1000000 {
		return fmt.Sprintf("%.1fK", float64(n)/1000)
	}
	return fmt.Sprintf("%.1fM", float64(n)/1000000)
}