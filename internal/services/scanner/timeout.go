package scanner

import (
	"context"
	"time"
)

// TimeoutConfig holds timeout configuration for scan operations
type TimeoutConfig struct {
	PerMethodTimeout time.Duration // Timeout for individual scan methods
	OverallTimeout   time.Duration // Total timeout for entire scan
	IndexingTimeout  time.Duration // Timeout for filesystem indexing
}

// DefaultTimeoutConfig returns sensible defaults
func DefaultTimeoutConfig() TimeoutConfig {
	return TimeoutConfig{
		PerMethodTimeout: 30 * time.Minute,
		OverallTimeout:   2 * time.Hour,
		IndexingTimeout:  4 * time.Hour,
	}
}

// EstimateTimeout estimates scan timeout based on volume characteristics
func (vs *VolumeScanner) estimateTimeout(volumeID string) time.Duration {
	// Try to get cached result for size estimation
	if cachedResult := vs.cache.Get(volumeID); cachedResult != nil {
		// Rough heuristic: 1 hour per TB of data
		sizeInTB := float64(cachedResult.TotalSize) / (1024 * 1024 * 1024 * 1024)
		estimatedDuration := time.Duration(sizeInTB * float64(time.Hour))

		// Add 50% buffer for safety
		estimatedDuration = time.Duration(float64(estimatedDuration) * 1.5)

		// Cap between min and max
		if estimatedDuration < 30*time.Minute {
			return 30 * time.Minute
		}
		if estimatedDuration > 8*time.Hour {
			return 8 * time.Hour
		}

		return estimatedDuration
	}

	// Default timeout if no cached data available
	return vs.timeoutConfig.OverallTimeout
}

// withTimeout wraps a context with a timeout
func withTimeout(ctx context.Context, timeout time.Duration) (context.Context, context.CancelFunc) {
	if timeout <= 0 {
		// No timeout, return context as-is with a no-op cancel
		return ctx, func() {}
	}

	return context.WithTimeout(ctx, timeout)
}
