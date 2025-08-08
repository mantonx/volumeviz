package volumes

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/docker/docker/api/types"
	"github.com/gin-gonic/gin"
	"github.com/mantonx/volumeviz/internal/models"
	"github.com/mantonx/volumeviz/internal/websocket"
	"github.com/stretchr/testify/mock"
)

// MockDockerService for benchmarking
type MockDockerServiceBench struct {
	mock.Mock
}

func (m *MockDockerServiceBench) Ping(ctx context.Context) error {
	return nil
}

func (m *MockDockerServiceBench) Close() error {
	return nil
}

func (m *MockDockerServiceBench) IsDockerAvailable(ctx context.Context) bool {
	return true
}

func (m *MockDockerServiceBench) GetVersion(ctx context.Context) (types.Version, error) {
	return types.Version{}, nil
}

func (m *MockDockerServiceBench) ListVolumes(ctx context.Context) ([]models.Volume, error) {
	args := m.Called(ctx)
	return args.Get(0).([]models.Volume), args.Error(1)
}

func (m *MockDockerServiceBench) GetVolume(ctx context.Context, volumeID string) (*models.Volume, error) {
	args := m.Called(ctx, volumeID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.Volume), args.Error(1)
}

func (m *MockDockerServiceBench) GetVolumeContainers(ctx context.Context, volumeName string) ([]models.VolumeContainer, error) {
	args := m.Called(ctx, volumeName)
	return args.Get(0).([]models.VolumeContainer), args.Error(1)
}

func (m *MockDockerServiceBench) GetVolumesByDriver(ctx context.Context, driver string) ([]models.Volume, error) {
	args := m.Called(ctx, driver)
	return args.Get(0).([]models.Volume), args.Error(1)
}

func (m *MockDockerServiceBench) GetVolumesByLabel(ctx context.Context, labelKey, labelValue string) ([]models.Volume, error) {
	args := m.Called(ctx, labelKey, labelValue)
	return args.Get(0).([]models.Volume), args.Error(1)
}

// generateMockVolumes creates a large number of mock volumes for testing
func generateMockVolumes(count int) []models.Volume {
	volumes := make([]models.Volume, count)
	for i := 0; i < count; i++ {
		volumes[i] = models.Volume{
			ID:         "test-volume-" + string(rune(i)),
			Name:       "test-volume-" + string(rune(i)),
			Driver:     "local",
			Mountpoint: "/var/lib/docker/volumes/test-volume-" + string(rune(i)) + "/_data",
			CreatedAt:  time.Now(),
			Labels:     map[string]string{"test": "true"},
			Options:    map[string]string{},
			Scope:      "local",
		}
	}
	return volumes
}

// BenchmarkListVolumes_Small tests performance with small volume count
func BenchmarkListVolumes_Small(b *testing.B) {
	gin.SetMode(gin.TestMode)
	mockService := &MockDockerServiceBench{}
	handler := NewHandler(mockService, &websocket.Hub{})

	volumes := generateMockVolumes(10)
	mockService.On("ListVolumes", mock.Anything).Return(volumes, nil)

	router := gin.New()
	router.GET("/volumes", handler.ListVolumes)

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		req, _ := http.NewRequest("GET", "/volumes", nil)
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		if w.Code != http.StatusOK {
			b.Fatalf("Expected status 200, got %d", w.Code)
		}
	}
}

// BenchmarkListVolumes_Large tests performance with 1000+ volumes (SLO requirement)
func BenchmarkListVolumes_Large(b *testing.B) {
	gin.SetMode(gin.TestMode)
	mockService := &MockDockerServiceBench{}
	handler := NewHandler(mockService, &websocket.Hub{})

	// Generate 1000+ volumes as per enhanced requirements
	volumes := generateMockVolumes(1000)
	mockService.On("ListVolumes", mock.Anything).Return(volumes, nil)

	router := gin.New()
	router.GET("/volumes", handler.ListVolumes)

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		req, _ := http.NewRequest("GET", "/volumes", nil)
		w := httptest.NewRecorder()

		start := time.Now()
		router.ServeHTTP(w, req)
		duration := time.Since(start)

		if w.Code != http.StatusOK {
			b.Fatalf("Expected status 200, got %d", w.Code)
		}

		// Validate SLO: 95th percentile < 500ms
		if duration > 500*time.Millisecond {
			b.Logf("WARNING: Response time %v exceeds 500ms SLO", duration)
		}
	}
}

// BenchmarkListVolumes_Concurrent tests concurrent request performance
func BenchmarkListVolumes_Concurrent(b *testing.B) {
	gin.SetMode(gin.TestMode)
	mockService := &MockDockerServiceBench{}
	handler := NewHandler(mockService, &websocket.Hub{})

	volumes := generateMockVolumes(500)
	mockService.On("ListVolumes", mock.Anything).Return(volumes, nil)

	router := gin.New()
	router.GET("/volumes", handler.ListVolumes)

	b.ResetTimer()
	b.RunParallel(func(pb *testing.PB) {
		for pb.Next() {
			req, _ := http.NewRequest("GET", "/volumes", nil)
			w := httptest.NewRecorder()

			start := time.Now()
			router.ServeHTTP(w, req)
			duration := time.Since(start)

			if w.Code != http.StatusOK {
				b.Fatalf("Expected status 200, got %d", w.Code)
			}

			// Track performance under concurrent load
			if duration > 500*time.Millisecond {
				b.Logf("Concurrent request exceeded SLO: %v", duration)
			}
		}
	})
}

// BenchmarkGetVolume tests single volume retrieval performance
func BenchmarkGetVolume(b *testing.B) {
	gin.SetMode(gin.TestMode)
	mockService := &MockDockerServiceBench{}
	handler := NewHandler(mockService, &websocket.Hub{})

	volume := &models.Volume{
		ID:         "test-volume",
		Name:       "test-volume",
		Driver:     "local",
		Mountpoint: "/var/lib/docker/volumes/test-volume/_data",
		CreatedAt:  time.Now(),
	}

	mockService.On("GetVolume", mock.Anything, "test-volume").Return(volume, nil)

	router := gin.New()
	router.GET("/volumes/:id", handler.GetVolume)

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		req, _ := http.NewRequest("GET", "/volumes/test-volume", nil)
		w := httptest.NewRecorder()

		start := time.Now()
		router.ServeHTTP(w, req)
		duration := time.Since(start)

		if w.Code != http.StatusOK {
			b.Fatalf("Expected status 200, got %d", w.Code)
		}

		// Single volume requests should be very fast
		if duration > 100*time.Millisecond {
			b.Logf("Single volume request took %v (>100ms)", duration)
		}
	}
}

// TestSLOCompliance validates the 95th percentile < 500ms requirement
func TestSLOCompliance(t *testing.T) {
	gin.SetMode(gin.TestMode)
	mockService := &MockDockerServiceBench{}
	handler := NewHandler(mockService, &websocket.Hub{})

	volumes := generateMockVolumes(1000)
	mockService.On("ListVolumes", mock.Anything).Return(volumes, nil)

	router := gin.New()
	router.GET("/volumes", handler.ListVolumes)

	// Collect response times for 100 requests
	durations := make([]time.Duration, 100)
	for i := 0; i < 100; i++ {
		req, _ := http.NewRequest("GET", "/volumes", nil)
		w := httptest.NewRecorder()

		start := time.Now()
		router.ServeHTTP(w, req)
		durations[i] = time.Since(start)

		if w.Code != http.StatusOK {
			t.Fatalf("Request %d failed with status %d", i, w.Code)
		}
	}

	// Calculate 95th percentile
	// Sort durations and find 95th percentile
	for i := 0; i < len(durations)-1; i++ {
		for j := i + 1; j < len(durations); j++ {
			if durations[i] > durations[j] {
				durations[i], durations[j] = durations[j], durations[i]
			}
		}
	}

	p95Index := int(float64(len(durations)) * 0.95)
	p95Duration := durations[p95Index]

	t.Logf("95th percentile response time: %v", p95Duration)
	t.Logf("SLO requirement: < 500ms")

	if p95Duration >= 500*time.Millisecond {
		t.Errorf("SLO VIOLATION: 95th percentile (%v) >= 500ms", p95Duration)
	} else {
		t.Logf("✅ SLO COMPLIANT: 95th percentile (%v) < 500ms", p95Duration)
	}
}
