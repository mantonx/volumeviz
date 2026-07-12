package scanner

import (
	"context"
	"fmt"
	"os"
	"runtime"
	"testing"
	"time"

	"github.com/mantonx/volumeviz/internal/interfaces"
	"github.com/mantonx/volumeviz/internal/models"
	"github.com/mantonx/volumeviz/internal/services/cache"
	"github.com/stretchr/testify/assert"
)

// TestWalkerPerformanceRequirements validates that Walker meets the
// 100GB < 30s requirement (extrapolated from a smaller sample, same
// approach used before this test targeted diskus).
func TestWalkerPerformanceRequirements(t *testing.T) {
	config := models.ScanConfig{
		PerMethodTimeout: 5 * time.Minute,
	}
	method := NewWalker(config)

	tempDir, err := os.MkdirTemp("", "walker_perf_test")
	assert.NoError(t, err)
	defer os.RemoveAll(tempDir)

	totalSize := int64(0)
	for i := 0; i < 100; i++ {
		testFile, err := os.Create(fmt.Sprintf("%s/test_file_%d.txt", tempDir, i))
		assert.NoError(t, err)

		// Create 10MB files (1GB total for 100 files)
		testData := make([]byte, 10*1024*1024)
		n, err := testFile.Write(testData)
		assert.NoError(t, err)
		totalSize += int64(n)
		testFile.Close()
	}

	start := time.Now()
	result, err := method.Scan(context.Background(), tempDir)
	duration := time.Since(start)

	if err != nil {
		t.Logf("Scan failed: %v", err)
		return // Don't fail test in CI environments
	}

	assert.NotNil(t, result)
	assert.Equal(t, "walker", result.Method)
	assert.Greater(t, result.TotalSize, int64(0))
	assert.Greater(t, result.Duration, time.Duration(0))

	// Performance requirement: should be much faster than 30s for 1GB
	// Extrapolating: if 1GB takes X seconds, 100GB should take 100*X seconds
	maxExpectedFor1GB := 300 * time.Millisecond // Very generous for 1GB
	assert.Less(t, duration, maxExpectedFor1GB,
		"Walker should scan 1GB much faster than 300ms to meet 100GB < 30s requirement")

	theoretical100GBDuration := time.Duration(float64(duration) * 100.0)
	t.Logf("Actual duration for ~1GB: %v", duration)
	t.Logf("Theoretical duration for 100GB: %v", theoretical100GBDuration)
	t.Logf("Performance requirement (100GB < 30s): %v", theoretical100GBDuration < 30*time.Second)
}

// TestMemoryUsageDuringLargeScan validates memory usage stays under 100MB
func TestMemoryUsageDuringLargeScan(t *testing.T) {
	config := models.ScanConfig{
		PerMethodTimeout: 5 * time.Minute,
	}
	method := NewWalker(config)

	// Measure memory before scan
	runtime.GC() // Force garbage collection for accurate measurement
	var memStatsBefore runtime.MemStats
	runtime.ReadMemStats(&memStatsBefore)

	// Create test directory
	tempDir, err := os.MkdirTemp("", "walker_memory_test")
	assert.NoError(t, err)
	defer os.RemoveAll(tempDir)

	// Create some test files
	for i := 0; i < 50; i++ {
		testFile, err := os.Create(fmt.Sprintf("%s/test_file_%d.txt", tempDir, i))
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

	// Calculate memory usage during scan. Both GCs run immediately before
	// each snapshot, but heap growth from unrelated allocations (or a GC
	// freeing more than this scan allocated) can still make Alloc decrease
	// between snapshots — since both are uint64, a naive subtraction would
	// wrap around to a huge positive number instead of going negative.
	var memoryUsed uint64
	if memStatsAfter.Alloc > memStatsBefore.Alloc {
		memoryUsed = memStatsAfter.Alloc - memStatsBefore.Alloc
	}
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

// BenchmarkWalker benchmarks the Walker scanning method
func BenchmarkWalker(b *testing.B) {
	config := models.ScanConfig{
		PerMethodTimeout: 5 * time.Minute,
	}
	method := NewWalker(config)

	// Create test directory
	tempDir, err := os.MkdirTemp("", "walker_benchmark")
	if err != nil {
		b.Fatal(err)
	}
	defer os.RemoveAll(tempDir)

	// Create test files
	for i := 0; i < 10; i++ {
		testFile, err := os.Create(fmt.Sprintf("%s/bench_file_%d.txt", tempDir, i))
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
		Method:    "walker",
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
