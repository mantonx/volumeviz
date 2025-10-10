// Package volumes provides volume management services
package volumes

import (
	"context"
	"fmt"
	"log"
	"sync"
	"sync/atomic"
	"time"

	"github.com/mantonx/volumeviz/internal/api/models"
)

// CacheEntry represents a cached volume with metadata
type CacheEntry struct {
	Volume    models.VolumeV1
	CachedAt  time.Time
	ExpiresAt time.Time
	AccessCount atomic.Int64
	LastAccess  time.Time
}

// IsExpired checks if the cache entry has expired
func (e *CacheEntry) IsExpired() bool {
	return time.Now().After(e.ExpiresAt)
}

// VolumeCacheConfig holds configuration for the volume cache
type VolumeCacheConfig struct {
	// Enabled controls whether caching is active
	Enabled bool
	// TTL is the time-to-live for cache entries
	TTL time.Duration
	// MaxSize is the maximum number of entries in the cache
	MaxSize int
	// CleanupInterval is how often to run cleanup of expired entries
	CleanupInterval time.Duration
	// EnableStats controls whether to track cache statistics
	EnableStats bool
}

// DefaultVolumeCacheConfig returns sensible defaults
func DefaultVolumeCacheConfig() VolumeCacheConfig {
	return VolumeCacheConfig{
		Enabled:         true,
		TTL:             30 * time.Second,
		MaxSize:         1000,
		CleanupInterval: 60 * time.Second,
		EnableStats:     true,
	}
}

// VolumeCache provides an in-memory LRU cache for volumes
type VolumeCache struct {
	config VolumeCacheConfig

	// Cache storage
	entries map[string]*CacheEntry
	mu      sync.RWMutex

	// LRU tracking
	accessList []string // Most recently accessed at the end

	// Lifecycle
	stopChan chan struct{}
	running  atomic.Bool

	// Statistics
	hits       atomic.Int64
	misses     atomic.Int64
	evictions  atomic.Int64
	invalidations atomic.Int64
	totalGets  atomic.Int64
	totalSets  atomic.Int64
}

// NewVolumeCache creates a new volume cache
func NewVolumeCache(config VolumeCacheConfig) *VolumeCache {
	cache := &VolumeCache{
		config:     config,
		entries:    make(map[string]*CacheEntry, config.MaxSize),
		accessList: make([]string, 0, config.MaxSize),
		stopChan:   make(chan struct{}),
	}

	if !config.Enabled {
		log.Printf("[CACHE] Volume cache is disabled")
		return cache
	}

	log.Printf("[CACHE] Volume cache initialized (TTL: %v, max size: %d)", config.TTL, config.MaxSize)
	return cache
}

// Start starts the cache cleanup goroutine
func (c *VolumeCache) Start(ctx context.Context) error {
	if !c.config.Enabled {
		return nil
	}

	if c.running.Load() {
		return fmt.Errorf("cache already running")
	}

	c.running.Store(true)

	// Start cleanup goroutine
	go c.cleanupLoop(ctx)

	log.Printf("[CACHE] Cache cleanup started (interval: %v)", c.config.CleanupInterval)
	return nil
}

// Stop stops the cache cleanup goroutine
func (c *VolumeCache) Stop() error {
	if !c.running.Load() {
		return nil
	}

	close(c.stopChan)
	c.running.Store(false)

	log.Printf("[CACHE] Cache stopped")
	return nil
}

// WarmUp pre-populates the cache with a list of volumes (Phase 3)
// This is useful on application startup to reduce initial cache misses
func (c *VolumeCache) WarmUp(volumes []models.VolumeV1) {
	if !c.config.Enabled {
		return
	}

	log.Printf("[CACHE] Warming up cache with %d volumes", len(volumes))
	c.SetMultiple(volumes)
	log.Printf("[CACHE] Cache warm-up complete")
}

// Get retrieves a volume from the cache
func (c *VolumeCache) Get(volumeID string) (models.VolumeV1, bool) {
	if !c.config.Enabled {
		c.misses.Add(1)
		return models.VolumeV1{}, false
	}

	c.totalGets.Add(1)

	c.mu.RLock()
	entry, exists := c.entries[volumeID]
	c.mu.RUnlock()

	if !exists {
		c.misses.Add(1)
		return models.VolumeV1{}, false
	}

	// Check expiration
	if entry.IsExpired() {
		c.misses.Add(1)
		// Remove expired entry
		go c.Invalidate(volumeID)
		return models.VolumeV1{}, false
	}

	// Update access tracking
	entry.AccessCount.Add(1)
	entry.LastAccess = time.Now()
	c.updateLRU(volumeID)

	c.hits.Add(1)
	return entry.Volume, true
}

// GetMultiple retrieves multiple volumes from the cache
func (c *VolumeCache) GetMultiple(volumeIDs []string) (map[string]models.VolumeV1, []string) {
	if !c.config.Enabled {
		return nil, volumeIDs
	}

	cached := make(map[string]models.VolumeV1)
	var missing []string

	for _, id := range volumeIDs {
		if vol, found := c.Get(id); found {
			cached[id] = vol
		} else {
			missing = append(missing, id)
		}
	}

	return cached, missing
}

// Set stores a volume in the cache
func (c *VolumeCache) Set(volumeID string, volume models.VolumeV1) {
	if !c.config.Enabled {
		return
	}

	c.totalSets.Add(1)

	c.mu.Lock()
	defer c.mu.Unlock()

	// Check if we need to evict
	if len(c.entries) >= c.config.MaxSize {
		c.evictLRU()
	}

	// Create new entry
	entry := &CacheEntry{
		Volume:    volume,
		CachedAt:  time.Now(),
		ExpiresAt: time.Now().Add(c.config.TTL),
		LastAccess: time.Now(),
	}
	entry.AccessCount.Store(1)

	c.entries[volumeID] = entry
	c.updateLRULocked(volumeID)
}

// SetMultiple stores multiple volumes in the cache
func (c *VolumeCache) SetMultiple(volumes []models.VolumeV1) {
	if !c.config.Enabled {
		return
	}

	for _, vol := range volumes {
		c.Set(vol.Name, vol)
	}
}

// Invalidate removes a volume from the cache
func (c *VolumeCache) Invalidate(volumeID string) {
	if !c.config.Enabled {
		return
	}

	c.mu.Lock()
	defer c.mu.Unlock()

	if _, exists := c.entries[volumeID]; exists {
		delete(c.entries, volumeID)
		c.removeFromLRU(volumeID)
		c.invalidations.Add(1)
	}
}

// InvalidateAll clears the entire cache
func (c *VolumeCache) InvalidateAll() {
	if !c.config.Enabled {
		return
	}

	c.mu.Lock()
	defer c.mu.Unlock()

	count := len(c.entries)
	c.entries = make(map[string]*CacheEntry, c.config.MaxSize)
	c.accessList = make([]string, 0, c.config.MaxSize)
	c.invalidations.Add(int64(count))

	log.Printf("[CACHE] Invalidated all %d entries", count)
}

// updateLRU updates the LRU access list (thread-safe wrapper)
func (c *VolumeCache) updateLRU(volumeID string) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.updateLRULocked(volumeID)
}

// updateLRULocked updates the LRU access list (caller must hold lock)
func (c *VolumeCache) updateLRULocked(volumeID string) {
	// Remove from current position
	c.removeFromLRU(volumeID)

	// Add to end (most recently used)
	c.accessList = append(c.accessList, volumeID)
}

// removeFromLRU removes a volume from the LRU list (caller must hold lock)
func (c *VolumeCache) removeFromLRU(volumeID string) {
	for i, id := range c.accessList {
		if id == volumeID {
			c.accessList = append(c.accessList[:i], c.accessList[i+1:]...)
			break
		}
	}
}

// evictLRU removes the least recently used entry (caller must hold lock)
func (c *VolumeCache) evictLRU() {
	if len(c.accessList) == 0 {
		return
	}

	// Get least recently used (first in list)
	lruID := c.accessList[0]

	// Remove from cache
	delete(c.entries, lruID)
	c.accessList = c.accessList[1:]

	c.evictions.Add(1)
}

// cleanupLoop periodically removes expired entries
func (c *VolumeCache) cleanupLoop(ctx context.Context) {
	ticker := time.NewTicker(c.config.CleanupInterval)
	defer ticker.Stop()

	for {
		select {
		case <-c.stopChan:
			return
		case <-ctx.Done():
			return
		case <-ticker.C:
			c.cleanup()
		}
	}
}

// cleanup removes expired entries
func (c *VolumeCache) cleanup() {
	c.mu.Lock()
	defer c.mu.Unlock()

	var expired []string
	now := time.Now()

	for id, entry := range c.entries {
		if now.After(entry.ExpiresAt) {
			expired = append(expired, id)
		}
	}

	for _, id := range expired {
		delete(c.entries, id)
		c.removeFromLRU(id)
		c.invalidations.Add(1)
	}

	if len(expired) > 0 {
		log.Printf("[CACHE] Cleaned up %d expired entries", len(expired))
	}
}

// GetStats returns cache statistics
func (c *VolumeCache) GetStats() interface{} {
	c.mu.RLock()
	entryCount := len(c.entries)
	c.mu.RUnlock()

	totalRequests := c.totalGets.Load()
	hits := c.hits.Load()
	misses := c.misses.Load()

	var hitRate float64
	if totalRequests > 0 {
		hitRate = float64(hits) / float64(totalRequests) * 100
	}

	return CacheStats{
		Enabled:       c.config.Enabled,
		EntryCount:    entryCount,
		MaxSize:       c.config.MaxSize,
		TTL:           c.config.TTL,
		TotalGets:     totalRequests,
		Hits:          hits,
		Misses:        misses,
		HitRate:       hitRate,
		Evictions:     c.evictions.Load(),
		Invalidations: c.invalidations.Load(),
		TotalSets:     c.totalSets.Load(),
	}
}

// CacheStats holds cache statistics
type CacheStats struct {
	Enabled       bool          `json:"enabled"`
	EntryCount    int           `json:"entry_count"`
	MaxSize       int           `json:"max_size"`
	TTL           time.Duration `json:"ttl"`
	TotalGets     int64         `json:"total_gets"`
	Hits          int64         `json:"hits"`
	Misses        int64         `json:"misses"`
	HitRate       float64       `json:"hit_rate_percent"`
	Evictions     int64         `json:"evictions"`
	Invalidations int64         `json:"invalidations"`
	TotalSets     int64         `json:"total_sets"`
}
