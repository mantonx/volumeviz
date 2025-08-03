package cache

import (
	"testing"
	"time"

	"github.com/mantonx/volumeviz/internal/core/interfaces"
	"github.com/stretchr/testify/assert"
)

func TestMemoryCache_SetAndGet(t *testing.T) {
	cache := NewMemoryCache(10)
	
	result := &interfaces.ScanResult{
		VolumeID:  "test-volume",
		TotalSize: 1024,
		Method:    "test",
	}
	
	// Set a result in cache
	err := cache.Set("test-key", result, 5*time.Minute)
	assert.NoError(t, err)
	
	// Get the result back
	cached := cache.Get("test-key")
	assert.NotNil(t, cached)
	assert.Equal(t, "test-volume", cached.VolumeID)
	assert.Equal(t, int64(1024), cached.TotalSize)
	assert.Equal(t, "test", cached.Method)
	assert.True(t, cached.CacheHit) // Should be marked as cache hit
}

func TestMemoryCache_GetNonExistent(t *testing.T) {
	cache := NewMemoryCache(10)
	
	// Try to get a non-existent key
	result := cache.Get("non-existent")
	assert.Nil(t, result)
}

func TestMemoryCache_Expiration(t *testing.T) {
	cache := NewMemoryCache(10)
	
	result := &interfaces.ScanResult{
		VolumeID:  "test-volume",
		TotalSize: 1024,
		Method:    "test",
	}
	
	// Set with very short TTL
	err := cache.Set("test-key", result, 10*time.Millisecond)
	assert.NoError(t, err)
	
	// Should be available initially
	cached := cache.Get("test-key")
	assert.NotNil(t, cached)
	
	// Wait for expiration
	time.Sleep(20 * time.Millisecond)
	
	// Should be expired now
	cached = cache.Get("test-key")
	assert.Nil(t, cached)
}

func TestMemoryCache_Delete(t *testing.T) {
	cache := NewMemoryCache(10)
	
	result := &interfaces.ScanResult{
		VolumeID:  "test-volume",
		TotalSize: 1024,
		Method:    "test",
	}
	
	// Set a result
	err := cache.Set("test-key", result, 5*time.Minute)
	assert.NoError(t, err)
	
	// Verify it exists
	cached := cache.Get("test-key")
	assert.NotNil(t, cached)
	
	// Delete it
	err = cache.Delete("test-key")
	assert.NoError(t, err)
	
	// Should be gone now
	cached = cache.Get("test-key")
	assert.Nil(t, cached)
}

func TestMemoryCache_Clear(t *testing.T) {
	cache := NewMemoryCache(10).(*MemoryCache)
	
	result1 := &interfaces.ScanResult{VolumeID: "vol1", TotalSize: 1024}
	result2 := &interfaces.ScanResult{VolumeID: "vol2", TotalSize: 2048}
	
	// Set multiple results
	cache.Set("key1", result1, 5*time.Minute)
	cache.Set("key2", result2, 5*time.Minute)
	
	// Verify they exist
	assert.NotNil(t, cache.Get("key1"))
	assert.NotNil(t, cache.Get("key2"))
	assert.Equal(t, 2, cache.Size())
	
	// Clear the cache
	err := cache.Clear()
	assert.NoError(t, err)
	
	// Should be empty now
	assert.Nil(t, cache.Get("key1"))
	assert.Nil(t, cache.Get("key2"))
	assert.Equal(t, 0, cache.Size())
}

func TestMemoryCache_MaxSizeEviction(t *testing.T) {
	// Create cache with size limit of 2
	cache := NewMemoryCache(2).(*MemoryCache)
	
	result1 := &interfaces.ScanResult{
		VolumeID:  "vol1",
		TotalSize: 1024,
		ScannedAt: time.Now().Add(-2 * time.Minute), // Oldest
	}
	result2 := &interfaces.ScanResult{
		VolumeID:  "vol2", 
		TotalSize: 2048,
		ScannedAt: time.Now().Add(-1 * time.Minute),
	}
	result3 := &interfaces.ScanResult{
		VolumeID:  "vol3",
		TotalSize: 3072,
		ScannedAt: time.Now(), // Newest
	}
	
	// Fill cache to capacity
	cache.Set("key1", result1, 5*time.Minute)
	cache.Set("key2", result2, 5*time.Minute)
	assert.Equal(t, 2, cache.Size())
	
	// Add one more - should evict oldest
	cache.Set("key3", result3, 5*time.Minute)
	assert.Equal(t, 2, cache.Size())
	
	// key1 (oldest) should be evicted
	assert.Nil(t, cache.Get("key1"))
	assert.NotNil(t, cache.Get("key2"))
	assert.NotNil(t, cache.Get("key3"))
}

func TestMemoryCache_Size(t *testing.T) {
	cache := NewMemoryCache(10).(*MemoryCache)
	
	assert.Equal(t, 0, cache.Size())
	
	result := &interfaces.ScanResult{VolumeID: "test", TotalSize: 1024}
	cache.Set("key1", result, 5*time.Minute)
	assert.Equal(t, 1, cache.Size())
	
	cache.Set("key2", result, 5*time.Minute)
	assert.Equal(t, 2, cache.Size())
	
	cache.Delete("key1")
	assert.Equal(t, 1, cache.Size())
}