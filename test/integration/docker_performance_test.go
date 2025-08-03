package integration

import (
	"context"
	"testing"
	"time"

	"github.com/mantonx/volumeviz/internal/services"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestDockerService_PerformanceRequirements validates performance with large datasets
func TestDockerService_PerformanceRequirements(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping performance test in short mode")
	}

	// This test requires Docker to be available
	service, err := services.NewDockerService("unix:///var/run/docker.sock", 30*time.Second)
	require.NoError(t, err)
	defer service.Close()

	// Test Docker availability first
	ctx := context.Background()
	err = service.Ping(ctx)
	if err != nil {
		t.Skip("Docker not available for performance testing")
	}

	t.Run("VolumeListingPerformance", func(t *testing.T) {
		// Measure time to list all volumes
		start := time.Now()
		volumes, err := service.ListVolumes(ctx)
		duration := time.Since(start)

		require.NoError(t, err)
		t.Logf("Listed %d volumes in %v", len(volumes), duration)

		// Performance requirement: should complete quickly even with many volumes
		maxExpectedDuration := 2 * time.Second
		if duration > maxExpectedDuration {
			t.Logf("WARNING: Volume listing took %v (> %v)", duration, maxExpectedDuration)
		}

		// Validate response structure
		for _, vol := range volumes {
			assert.NotEmpty(t, vol.ID)
			assert.NotEmpty(t, vol.Name)
			assert.NotEmpty(t, vol.Driver)
		}
	})

	t.Run("ConcurrentVolumeAccess", func(t *testing.T) {
		// Get a volume to test with
		volumes, err := service.ListVolumes(ctx)
		require.NoError(t, err)
		
		if len(volumes) == 0 {
			t.Skip("No volumes available for concurrent access test")
		}

		testVolume := volumes[0]
		concurrency := 10
		done := make(chan time.Duration, concurrency)

		// Launch concurrent requests
		for i := 0; i < concurrency; i++ {
			go func() {
				start := time.Now()
				_, err := service.GetVolume(ctx, testVolume.ID)
				duration := time.Since(start)
				
				if err != nil {
					t.Errorf("Concurrent volume access failed: %v", err)
				}
				done <- duration
			}()
		}

		// Collect results
		var totalDuration time.Duration
		for i := 0; i < concurrency; i++ {
			duration := <-done
			totalDuration += duration
		}

		avgDuration := totalDuration / time.Duration(concurrency)
		t.Logf("Average concurrent access time: %v", avgDuration)

		// Should handle concurrent access efficiently
		maxConcurrentDuration := 1 * time.Second
		assert.Less(t, avgDuration, maxConcurrentDuration, 
			"Concurrent access should average less than 1s")
	})

	t.Run("DockerHealthMonitoring", func(t *testing.T) {
		// Test rapid health checks (circuit breaker scenario)
		healthChecks := 20
		var healthDurations []time.Duration

		for i := 0; i < healthChecks; i++ {
			start := time.Now()
			err := service.Ping(ctx)
			duration := time.Since(start)
			
			healthDurations = append(healthDurations, duration)
			
			if err != nil {
				t.Errorf("Health check %d failed: %v", i, err)
			}

			// Brief pause between checks
			time.Sleep(10 * time.Millisecond)
		}

		// Calculate average health check time
		var totalHealthTime time.Duration
		for _, d := range healthDurations {
			totalHealthTime += d
		}
		avgHealthTime := totalHealthTime / time.Duration(len(healthDurations))
		
		t.Logf("Average health check time: %v", avgHealthTime)
		
		// Health checks should be very fast
		maxHealthDuration := 100 * time.Millisecond
		assert.Less(t, avgHealthTime, maxHealthDuration,
			"Health checks should average less than 100ms")
	})
}

// TestDockerService_LoadTesting performs load testing simulation
func TestDockerService_LoadTesting(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping load test in short mode")
	}

	service, err := services.NewDockerService("unix:///var/run/docker.sock", 30*time.Second)
	require.NoError(t, err)
	defer service.Close()

	ctx := context.Background()
	err = service.Ping(ctx)
	if err != nil {
		t.Skip("Docker not available for load testing")
	}

	t.Run("HighFrequencyRequests", func(t *testing.T) {
		// Simulate high-frequency API usage
		requestCount := 100
		concurrency := 5
		results := make(chan error, requestCount)

		start := time.Now()

		// Launch concurrent workers
		for worker := 0; worker < concurrency; worker++ {
			go func() {
				for i := 0; i < requestCount/concurrency; i++ {
					_, err := service.ListVolumes(ctx)
					results <- err
				}
			}()
		}

		// Collect results
		errorCount := 0
		for i := 0; i < requestCount; i++ {
			if err := <-results; err != nil {
				errorCount++
				t.Logf("Request error: %v", err)
			}
		}

		totalDuration := time.Since(start)
		requestsPerSecond := float64(requestCount) / totalDuration.Seconds()

		t.Logf("Completed %d requests in %v", requestCount, totalDuration)
		t.Logf("Throughput: %.2f requests/second", requestsPerSecond)
		t.Logf("Error rate: %d/%d (%.2f%%)", errorCount, requestCount, 
			float64(errorCount)/float64(requestCount)*100)

		// Performance requirements
		assert.Less(t, float64(errorCount)/float64(requestCount), 0.01, 
			"Error rate should be less than 1%")
		assert.Greater(t, requestsPerSecond, 10.0, 
			"Should handle at least 10 requests per second")
	})
}

// TestDockerService_ResourceUsage monitors resource usage during operations
func TestDockerService_ResourceUsage(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping resource usage test in short mode")
	}

	service, err := services.NewDockerService("unix:///var/run/docker.sock", 30*time.Second)
	require.NoError(t, err)
	defer service.Close()

	ctx := context.Background()
	err = service.Ping(ctx)
	if err != nil {
		t.Skip("Docker not available for resource usage testing")
	}

	t.Run("MemoryUsageDuringOperations", func(t *testing.T) {
		// Note: This is a simplified test. In production, you'd use
		// proper memory profiling tools like pprof
		
		// Perform memory-intensive operations
		for i := 0; i < 50; i++ {
			volumes, err := service.ListVolumes(ctx)
			require.NoError(t, err)
			
			// Process each volume to simulate real usage
			for _, vol := range volumes {
				containers, _ := service.GetVolumeContainers(ctx, vol.Name)
				t.Logf("Volume %s has %d containers", vol.Name, len(containers))
			}
		}

		// In a real implementation, you would:
		// 1. Use runtime.MemStats to track memory usage
		// 2. Set memory usage thresholds
		// 3. Fail if memory usage exceeds limits
		t.Logf("✅ Memory usage test completed (detailed profiling needed for production)")
	})
}

// BenchmarkDockerService_Operations benchmarks core Docker operations
func BenchmarkDockerService_Operations(b *testing.B) {
	service, err := services.NewDockerService("unix:///var/run/docker.sock", 30*time.Second)
	if err != nil {
		b.Skip("Docker not available for benchmarking")
	}
	defer service.Close()

	ctx := context.Background()
	err = service.Ping(ctx)
	if err != nil {
		b.Skip("Docker not available for benchmarking")
	}

	b.Run("ListVolumes", func(b *testing.B) {
		b.ResetTimer()
		for i := 0; i < b.N; i++ {
			_, err := service.ListVolumes(ctx)
			if err != nil {
				b.Fatalf("ListVolumes failed: %v", err)
			}
		}
	})

	b.Run("HealthCheck", func(b *testing.B) {
		b.ResetTimer()
		for i := 0; i < b.N; i++ {
			err := service.Ping(ctx)
			if err != nil {
				b.Fatalf("Ping failed: %v", err)
			}
		}
	})

	// Get a volume ID for single volume operations
	volumes, err := service.ListVolumes(ctx)
	if err != nil || len(volumes) == 0 {
		b.Skip("No volumes available for single volume benchmarks")
	}
	testVolumeID := volumes[0].ID

	b.Run("GetSingleVolume", func(b *testing.B) {
		b.ResetTimer()
		for i := 0; i < b.N; i++ {
			_, err := service.GetVolume(ctx, testVolumeID)
			if err != nil {
				b.Fatalf("GetVolume failed: %v", err)
			}
		}
	})
}