package cache

import (
	"sync"
	"time"

	"github.com/mantonx/volumeviz/internal/core/interfaces"
)

// cacheEntry represents a cached scan result with expiration
type cacheEntry struct {
	result    *interfaces.ScanResult
	expiresAt time.Time
}

// MemoryCache implements an in-memory cache for scan results
type MemoryCache struct {
	mu      sync.RWMutex
	entries map[string]*cacheEntry
	maxSize int
}

// NewMemoryCache creates a new in-memory cache
func NewMemoryCache(maxSize int) interfaces.Cache {
	cache := &MemoryCache{
		entries: make(map[string]*cacheEntry),
		maxSize: maxSize,
	}

	// Start cleanup goroutine
	go cache.cleanupExpired()

	return cache
}

// Get retrieves a scan result from cache
func (c *MemoryCache) Get(key string) *interfaces.ScanResult {
	c.mu.RLock()
	defer c.mu.RUnlock()

	entry, exists := c.entries[key]
	if !exists {
		return nil
	}

	// Check if entry has expired
	if time.Now().After(entry.expiresAt) {
		// Entry expired, will be cleaned up by background process
		return nil
	}

	// Return a copy to prevent external modification
	result := *entry.result
	result.CacheHit = true
	return &result
}

// Set stores a scan result in cache with TTL
func (c *MemoryCache) Set(key string, result *interfaces.ScanResult, ttl time.Duration) error {
	c.mu.Lock()
	defer c.mu.Unlock()

	// Check if we need to evict entries to make room
	if len(c.entries) >= c.maxSize {
		c.evictOldest()
	}

	// Store the entry
	entry := &cacheEntry{
		result:    result,
		expiresAt: time.Now().Add(ttl),
	}

	c.entries[key] = entry
	return nil
}

// Delete removes a specific entry from cache
func (c *MemoryCache) Delete(key string) error {
	c.mu.Lock()
	defer c.mu.Unlock()

	delete(c.entries, key)
	return nil
}

// Clear removes all entries from cache
func (c *MemoryCache) Clear() error {
	c.mu.Lock()
	defer c.mu.Unlock()

	c.entries = make(map[string]*cacheEntry)
	return nil
}

// Size returns the current number of cached entries
func (c *MemoryCache) Size() int {
	c.mu.RLock()
	defer c.mu.RUnlock()

	return len(c.entries)
}

// evictOldest removes the oldest entry to make room for new ones
func (c *MemoryCache) evictOldest() {
	if len(c.entries) == 0 {
		return
	}

	var oldestKey string
	var oldestTime time.Time
	first := true

	for key, entry := range c.entries {
		if first || entry.result.ScannedAt.Before(oldestTime) {
			oldestKey = key
			oldestTime = entry.result.ScannedAt
			first = false
		}
	}

	if oldestKey != "" {
		delete(c.entries, oldestKey)
	}
}

// cleanupExpired runs periodically to remove expired entries
func (c *MemoryCache) cleanupExpired() {
	ticker := time.NewTicker(1 * time.Minute)
	defer ticker.Stop()

	for range ticker.C {
		c.mu.Lock()
		now := time.Now()

		for key, entry := range c.entries {
			if now.After(entry.expiresAt) {
				delete(c.entries, key)
			}
		}

		c.mu.Unlock()
	}
}
