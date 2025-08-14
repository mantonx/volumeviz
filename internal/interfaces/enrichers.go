package interfaces

import (
	"context"
)

// EnrichmentManager interface for coordinating media enrichment
type EnrichmentManager interface {
	// EnrichVolume enriches all eligible files in a volume
	EnrichVolume(ctx context.Context, volumeID string) error
	
	// IsEnabled returns true if enrichment is enabled
	IsEnabled() bool
}