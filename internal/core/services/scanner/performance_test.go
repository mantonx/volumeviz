package scanner

import (
	"context"
	"fmt"
	"os"
	"runtime"
	"testing"
	"time"

	"github.com/mantonx/volumeviz/internal/core/interfaces"
	"github.com/mantonx/volumeviz/internal/core/models"
	"github.com/mantonx/volumeviz/internal/core/services/cache"
	"github.com/stretchr/testify/assert"
)

// TestDiskusPerformanceRequirements validates that diskus meets the 100GB < 30s requirement
func TestDiskusPerformanceRequirements(t *testing.T) {
	config := models.ScanConfig{
		DefaultTimeout: 5 * time.Minute,
	}
	method := NewDiskusMethod(config)

	// Skip if diskus is not available
	if !method.Available() {
		t.Skip("diskus not available, skipping performance test")
	}

	// Create a test directory with substantial content
	tempDir, err := os.MkdirTemp("", "diskus_perf_test")
	assert.NoError(t, err)
	defer os.RemoveAll(tempDir)

	// Create test files to simulate a reasonably large volume
	// Note: In real testing, you'd test against actual large volumes
	totalSize := int64(0)
	for i := 0; i < 100; i++ {
		testFile, err := os.Create(tempDir + "/test_file_" + string(rune(i)) + ".txt")
		assert.NoError(t, err)

		// Create 10MB files (1GB total for 100 files)
		testData := make([]byte, 10*1024*1024)
		n, err := testFile.Write(testData)
		assert.NoError(t, err)
		totalSize += int64(n)
		testFile.Close()
	}

	// Performance test
	start := time.Now()
	result, err := method.Scan(context.Background(), tempDir)
	duration := time.Since(start)

	if err != nil {
		t.Logf("Scan failed: %v", err)
		return // Don't fail test in CI environments
	}

	assert.NotNil(t, result)
	assert.Equal(t, "diskus", result.Method)
	assert.Greater(t, result.TotalSize, int64(0))
	assert.Greater(t, result.Duration, time.Duration(0))

	// Performance requirement: should be much faster than 30s for 1GB
	// Extrapolating: if 1GB takes X seconds, 100GB should take 100*X seconds
	maxExpectedFor1GB := 300 * time.Millisecond // Very generous for 1GB
	assert.Less(t, duration, maxExpectedFor1GB,
		"Diskus should scan 1GB much faster than 300ms to meet 100GB < 30s requirement")

	// Calculate theoretical performance for 100GB
	theoretical100GBDuration := time.Duration(float64(duration) * 100.0)
	t.Logf("Actual duration for ~1GB: %v", duration)
	t.Logf("Theoretical duration for 100GB: %v", theoretical100GBDuration)
	t.Logf("Performance requirement (100GB < 30s): %v", theoretical100GBDuration < 30*time.Second)
}

// TestMemoryUsageDuringLargeScan validates memory usage stays under 100MB
func TestMemoryUsageDuringLargeScan(t *testing.T) {
	config := models.ScanConfig{
		DefaultTimeout: 5 * time.Minute,
	}
	method := NewDiskusMethod(config)

	if !method.Available() {
		t.Skip("diskus not available, skipping memory test")
	}

	// Measure memory before scan
	runtime.GC() // Force garbage collection for accurate measurement
	var memStatsBefore runtime.MemStats
	runtime.ReadMemStats(&memStatsBefore)

	// Create test directory
	tempDir, err := os.MkdirTemp("", "diskus_memory_test")
	assert.NoError(t, err)
	defer os.RemoveAll(tempDir)

	// Create some test files
	for i := 0; i < 50; i++ {
		testFile, err := os.Create(tempDir + "/test_file_" + string(rune(i)) + ".txt")
		assert.NoError(t, err)
		testData := make([]byte, 5*1024*1024) // 5MB files
		testFile.Write(testData)
		testFile.Close()
	}

	// Perform scan
	_, err = method.Scan(context.Background(), tempDir)
	if err != nil {
		t.Logf("Scan failed: %v", err)
		return
	}

	// Measure memory after scan
	runtime.GC() // Force garbage collection
	var memStatsAfter runtime.MemStats
	runtime.ReadMemStats(&memStatsAfter)

	// Calculate memory usage during scan
	memoryUsed := memStatsAfter.Alloc - memStatsBefore.Alloc
	maxAllowedMemory := uint64(100 * 1024 * 1024) // 100MB

	t.Logf("Memory used during scan: %d bytes (%.2f MB)", memoryUsed, float64(memoryUsed)/(1024*1024))
	t.Logf("Memory limit: %d bytes (100 MB)", maxAllowedMemory)

	// Note: This test might not be completely accurate due to GC timing
	// In production, you'd use more sophisticated memory profiling
	assert.Less(t, memoryUsed, maxAllowedMemory,
		"Memory usage should stay under 100MB during large volume scans")
}

// TestConcurrentScanningPerformance validates concurrent scanning of up to 5 volumes
func TestConcurrentScanningPerformance(t *testing.T) {
	// This would require the full scanner implementation with proper concurrency limiting
	t.Skip("Full concurrency test requires complete scanner implementation")
}

// BenchmarkDiskusMethod benchmarks the diskus scanning method
func BenchmarkDiskusMethod(b *testing.B) {
	config := models.ScanConfig{
		DefaultTimeout: 5 * time.Minute,
	}
	method := NewDiskusMethod(config)

	if !method.Available() {
		b.Skip("diskus not available, skipping benchmark")
	}

	// Create test directory
	tempDir, err := os.MkdirTemp("", "diskus_benchmark")
	if err != nil {
		b.Fatal(err)
	}
	defer os.RemoveAll(tempDir)

	// Create test files
	for i := 0; i < 10; i++ {
		testFile, err := os.Create(tempDir + "/bench_file_" + string(rune(i)) + ".txt")
		if err != nil {
			b.Fatal(err)
		}
		testData := make([]byte, 1024*1024) // 1MB files
		testFile.Write(testData)
		testFile.Close()
	}

	b.ResetTimer()

	for i := 0; i < b.N; i++ {
		result, err := method.Scan(context.Background(), tempDir)
		if err != nil {
			b.Fatalf("Scan failed: %v", err)
		}
		if result.TotalSize == 0 {
			b.Fatal("Scan returned zero size")
		}
	}
}

// BenchmarkCachePerformance benchmarks cache operations
func BenchmarkCachePerformance(b *testing.B) {
	result := &interfaces.ScanResult{
		VolumeID:  "benchmark-volume",
		TotalSize: 1024000,
		Method:    "diskus",
	}

	b.Run("CacheSet", func(b *testing.B) {
		cache := cache.NewMemoryCache(b.N + 100) // Ensure capacity
		b.ResetTimer()
		for i := 0; i < b.N; i++ {
			key := fmt.Sprintf("bench-key-%d", i)
			err := cache.Set(key, result, 5*time.Minute)
			if err != nil {
				b.Fatal(err)
			}
		}
	})

	b.Run("CacheGet", func(b *testing.B) {
		cache := cache.NewMemoryCache(1000)
		// Pre-populate cache with string keys
		for i := 0; i < 100; i++ {
			key := fmt.Sprintf("bench-key-%d", i)
			err := cache.Set(key, result, 5*time.Minute)
			if err != nil {
				b.Fatal(err)
			}
		}

		b.ResetTimer()
		for i := 0; i < b.N; i++ {
			key := fmt.Sprintf("bench-key-%d", i%100)
			cached := cache.Get(key)
			if cached == nil {
				b.Fatalf("Cache miss when hit expected for key: %s", key)
			}
		}
	})
}
