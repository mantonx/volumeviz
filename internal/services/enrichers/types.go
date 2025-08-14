// Package enrichers provides media metadata enrichment capabilities
package enrichers

import (
	"context"
	"time"

	"github.com/mantonx/volumeviz/internal/models"
)

// Type aliases for models - services can use enrichers.MediaMetadata for convenience
type (
	EnrichmentKind      = models.EnrichmentKind
	HDRFormat           = models.HDRFormat
	MediaMetadata       = models.MediaMetadata
	FileInfo            = models.FileInfo
	EnrichmentResult    = models.EnrichmentResult
	EnrichmentProgress  = models.EnrichmentProgress
	EnricherProgress    = models.EnricherProgress
)

// Constants for enrichment kinds
const (
	EnrichmentKindAudio    = models.EnrichmentKindAudio
	EnrichmentKindVideo    = models.EnrichmentKindVideo
	EnrichmentKindImage    = models.EnrichmentKindImage
	EnrichmentKindSubtitle = models.EnrichmentKindSubtitle
)

// Constants for HDR formats
const (
	HDRFormatNone        = models.HDRFormatNone
	HDRFormatHDR10       = models.HDRFormatHDR10
	HDRFormatHDR10Plus   = models.HDRFormatHDR10Plus
	HDRFormatDolbyVision = models.HDRFormatDolbyVision
)

// EnricherConfig holds configuration for all enrichers
type EnricherConfig struct {
	// Global settings
	Enabled              bool `env:"VV_ENABLE_ENRICHERS" envDefault:"true"`
	MaxConcurrentWorkers int  `env:"VV_MAX_CONCURRENT_ENRICHERS" envDefault:"3"`
	TimeoutPerFile       time.Duration `env:"VV_ENRICHER_TIMEOUT_PER_FILE" envDefault:"30s"`
	
	// FFprobe settings
	FFprobeEnabled    bool   `env:"VV_ENABLE_FFPROBE" envDefault:"true"`
	FFprobePath       string `env:"VV_FFPROBE_PATH" envDefault:"ffprobe"`
	FFprobeTimeout    time.Duration `env:"VV_FFPROBE_TIMEOUT" envDefault:"15s"`
	
	// EXIF settings
	EXIFEnabled    bool `env:"VV_ENABLE_EXIF" envDefault:"true"`
	EnableGPS      bool `env:"VV_ENABLE_EXIF_GPS" envDefault:"false"`
	RedactGPS      bool `env:"VV_REDACT_GPS" envDefault:"true"`
	GPSPrecision   int  `env:"VV_GPS_PRECISION" envDefault:"3"` // decimal places for GPS coordinates
	
	// Subtitle settings
	SubtitleEnabled bool `env:"VV_ENABLE_SUBTITLE_ENRICHMENT" envDefault:"true"`
}

// Enricher interface defines the contract for media enrichers
type Enricher interface {
	// Name returns the enricher name (e.g., "ffprobe", "exif", "subtitle")
	Name() string
	
	// CanEnrich determines if this enricher can process the given file
	CanEnrich(fileInfo FileInfo) bool
	
	// Enrich extracts metadata from the file and returns structured data
	Enrich(ctx context.Context, fileInfo FileInfo) (*MediaMetadata, error)
	
	// IsAvailable checks if the enricher's dependencies are available
	IsAvailable() bool
	
	// GetCapabilities returns what this enricher can extract
	GetCapabilities() EnricherCapabilities
}

// EnricherCapabilities describes what an enricher can extract
type EnricherCapabilities struct {
	Name            string      `json:"name"`
	SupportedMimes  []string    `json:"supported_mimes"`
	ExtractedFields []string    `json:"extracted_fields"`
	RequiredTools   []string    `json:"required_tools,omitempty"`
	Performance     string      `json:"performance"` // "fast", "medium", "slow"
	Accuracy        string      `json:"accuracy"`    // "high", "medium", "low"
	Features        []string    `json:"features"`
}

// MediaMetadataRepository defines the interface for persisting enrichment data
type MediaMetadataRepository interface {
	// SaveMetadata saves enriched metadata to the database
	SaveMetadata(ctx context.Context, fileID int64, kind EnrichmentKind, metadata *MediaMetadata) error
	
	// GetMetadata retrieves metadata for a file
	GetMetadata(ctx context.Context, fileID int64, kind EnrichmentKind) (*MediaMetadata, error)
	
	// BulkSaveMetadata saves metadata for multiple files efficiently
	BulkSaveMetadata(ctx context.Context, results []EnrichmentResult) error
	
	// GetUnenrichedFiles returns files that need enrichment
	GetUnenrichedFiles(ctx context.Context, volumeID string, limit int) ([]FileInfo, error)
	
	// GetEnrichmentProgress returns enrichment progress for a volume
	GetEnrichmentProgress(ctx context.Context, volumeID string) (*EnrichmentProgress, error)
	
	// DeleteMetadata removes metadata for a file or volume
	DeleteMetadata(ctx context.Context, fileID *int64, volumeID *string) error
}

// EnrichmentManager coordinates multiple enrichers
type EnrichmentManager interface {
	// EnrichVolume enriches all eligible files in a volume
	EnrichVolume(ctx context.Context, volumeID string) error
	
	// EnrichFile enriches a single file
	EnrichFile(ctx context.Context, fileInfo FileInfo) (*EnrichmentResult, error)
	
	// GetProgress returns current enrichment progress
	GetProgress(volumeID string) *EnrichmentProgress
	
	// GetCapabilities returns combined capabilities of all enrichers
	GetCapabilities() []EnricherCapabilities
	
	// IsEnabled returns true if enrichment is enabled
	IsEnabled() bool
	
	// RegisterEnricher adds a new enricher
	RegisterEnricher(enricher Enricher)
	
	// GetEnrichers returns all registered enrichers
	GetEnrichers() []Enricher
}

// EnrichmentEvent represents events during enrichment process
type EnrichmentEvent struct {
	Type      string      `json:"type"` // "started", "progress", "completed", "error"
	VolumeID  string      `json:"volume_id"`
	FileID    *int64      `json:"file_id,omitempty"`
	Progress  *EnrichmentProgress `json:"progress,omitempty"`
	Result    *EnrichmentResult   `json:"result,omitempty"`
	Error     string      `json:"error,omitempty"`
	Timestamp time.Time   `json:"timestamp"`
}