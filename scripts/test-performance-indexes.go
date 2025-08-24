package main

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"time"

	_ "github.com/lib/pq"
)

func main() {
	// Connect to PostgreSQL database
	dbURL := "postgres://volumeviz:volumeviz@localhost:5432/volumeviz?sslmode=disable"
	db, err := sql.Open("postgres", dbURL)
	if err != nil {
		log.Fatal("Failed to connect to database:", err)
	}
	defer db.Close()

	ctx := context.Background()

	fmt.Println("🚀 VolumeViz Database Performance Index Testing")
	fmt.Println("=" + string(make([]byte, 50)) + "=")

	// Test the GetUnenrichedFiles query performance
	testGetUnenrichedFilesPerformance(ctx, db)

	// Test the GetUnenrichedFileCount query performance  
	testGetUnenrichedFileCountPerformance(ctx, db)

	// Check index usage statistics
	checkIndexUsage(ctx, db)

	fmt.Println("\n✅ Performance index testing completed successfully!")
}

func testGetUnenrichedFilesPerformance(ctx context.Context, db *sql.DB) {
	fmt.Println("\n📊 Testing GetUnenrichedFiles Query Performance")
	fmt.Println("---")

	query := `
		SELECT id, volume_id, name, mime, size_bytes 
		FROM files 
		WHERE volume_id = $1
		AND mime IN (
			'video/mp4', 'video/x-msvideo', 'video/x-matroska', 'video/quicktime', 'video/x-ms-wmv',
			'audio/mpeg', 'audio/flac', 'audio/wav', 'audio/aac', 'audio/ogg',
			'image/jpeg', 'image/png', 'image/tiff', 'image/bmp', 'image/webp'
		) AND (
			-- Video/audio files missing duration or codec info
			(mime LIKE 'video/%' OR mime LIKE 'audio/%') AND (duration_ms IS NULL OR video_codec IS NULL OR audio_codec IS NULL)
			OR
			-- Image files missing dimensions or EXIF data  
			mime LIKE 'image/%' AND (width IS NULL OR height IS NULL OR capture_datetime IS NULL)
		)
		ORDER BY size_bytes DESC 
		LIMIT $2`

	// Test with different volume IDs and limits
	testCases := []struct {
		volumeID string
		limit    int
		name     string
	}{
		{"test-performance-vol", 100, "Small batch (100 files)"},
		{"test-performance-vol", 1000, "Medium batch (1000 files)"},
		{"test-performance-vol", 10000, "Large batch (10000 files)"},
	}

	for _, tc := range testCases {
		start := time.Now()
		
		rows, err := db.QueryContext(ctx, query, tc.volumeID, tc.limit)
		if err != nil {
			fmt.Printf("❌ Query failed for %s: %v\n", tc.name, err)
			continue
		}

		count := 0
		for rows.Next() {
			var id int64
			var volumeID, name, mime string
			var sizeBytes int64
			
			err := rows.Scan(&id, &volumeID, &name, &mime, &sizeBytes)
			if err != nil {
				log.Printf("Scan error: %v", err)
				continue
			}
			count++
		}
		rows.Close()

		duration := time.Since(start)
		
		fmt.Printf("  • %s: %d files in %v (%.2f files/ms)\n", 
			tc.name, count, duration, float64(count)/float64(duration.Nanoseconds())*1000000)
	}
}

func testGetUnenrichedFileCountPerformance(ctx context.Context, db *sql.DB) {
	fmt.Println("\n📈 Testing GetUnenrichedFileCount Query Performance") 
	fmt.Println("---")

	query := `
		SELECT COUNT(*) FROM files
		WHERE volume_id = $1
		AND mime IN (
			'video/mp4', 'video/x-msvideo', 'video/x-matroska', 'video/quicktime',
			'audio/mpeg', 'audio/flac', 'audio/wav', 'audio/aac',
			'image/jpeg', 'image/png', 'image/tiff', 'image/bmp'
		) AND (
			(mime LIKE 'video/%' OR mime LIKE 'audio/%') AND (duration_ms IS NULL OR video_codec IS NULL OR audio_codec IS NULL)
			OR
			mime LIKE 'image/%' AND (width IS NULL OR height IS NULL OR capture_datetime IS NULL)
		)`

	volumeID := "test-performance-vol"
	
	start := time.Now()
	var count int64
	err := db.QueryRowContext(ctx, query, volumeID).Scan(&count)
	duration := time.Since(start)

	if err != nil {
		fmt.Printf("❌ Count query failed: %v\n", err)
		return
	}

	fmt.Printf("  • Unenriched file count: %d files in %v\n", count, duration)
}

func checkIndexUsage(ctx context.Context, db *sql.DB) {
	fmt.Println("\n🔍 Index Usage Statistics")
	fmt.Println("---")

	query := `
		SELECT 
			indexrelname as index_name,
			idx_scan as scans,
			idx_tup_read as tuples_read,
			idx_tup_fetch as tuples_fetched,
			pg_size_pretty(pg_relation_size(indexrelid)) as index_size
		FROM pg_stat_user_indexes 
		WHERE relname = 'files' 
		AND indexrelname LIKE '%unenriched%'
		ORDER BY idx_scan DESC`

	rows, err := db.QueryContext(ctx, query)
	if err != nil {
		fmt.Printf("❌ Index usage query failed: %v\n", err)
		return
	}
	defer rows.Close()

	fmt.Printf("  %-40s %-10s %-12s %-12s %-10s\n", "Index Name", "Scans", "Tuples Read", "Tuples Fetched", "Size")
	fmt.Printf("  %s\n", string(make([]byte, 90)))

	for rows.Next() {
		var indexName string
		var scans, tuplesRead, tuplesFetched int64
		var indexSize string

		err := rows.Scan(&indexName, &scans, &tuplesRead, &tuplesFetched, &indexSize)
		if err != nil {
			log.Printf("Scan error: %v", err)
			continue
		}

		fmt.Printf("  %-40s %-10d %-12d %-12d %-10s\n", 
			indexName, scans, tuplesRead, tuplesFetched, indexSize)
	}
}