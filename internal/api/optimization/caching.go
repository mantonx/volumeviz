package optimization

import (
	"net/http"
	"strconv"
	"time"
)

// CachingManager implements caching headers for static metadata
type CachingManager struct {
	enabled        bool
	maxAge         time.Duration
	etagEnabled    bool
	staleWhileRevalidate bool
}

// NewCachingManager creates caching headers for static metadata
func NewCachingManager() *CachingManager {
	return &CachingManager{
		enabled:        true,
		maxAge:         5 * time.Minute,
		etagEnabled:    true,
		staleWhileRevalidate: true,
	}
}

// SetCachingHeaders implements caching headers for static metadata
func (c *CachingManager) SetCachingHeaders(w http.ResponseWriter, etag string) {
	if !c.enabled {
		return
	}

	// Caching headers for static metadata implemented
	w.Header().Set("Cache-Control", "public, max-age="+strconv.Itoa(int(c.maxAge.Seconds())))
	
	if c.etagEnabled && etag != "" {
		w.Header().Set("ETag", `"`+etag+`"`)
	}
	
	if c.staleWhileRevalidate {
		w.Header().Add("Cache-Control", "stale-while-revalidate=86400")
	}
}
