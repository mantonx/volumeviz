package interfaces

import (
	"context"
	"github.com/mantonx/volumeviz/internal/models"
)

// EnrichmentManager interface for coordinating media enrichment
type EnrichmentManager interface {
	// EnrichVolume enriches all eligible files in a volume
	EnrichVolume(ctx context.Context, volumeID string) error

	// EnrichVolumeWithScanID enriches all eligible files in a volume with scan ID for database tracking
	EnrichVolumeWithScanID(ctx context.Context, volumeID string, scanID string) error

	// IsEnabled returns true if enrichment is enabled
	IsEnabled() bool

	// GetProgress returns current enrichment progress
	GetProgress(volumeID string) *models.EnrichmentProgress
}
