package previews

import (
	"time"
)

// PreviewType represents the type of preview
type PreviewType string

const (
	PreviewTypeThumbnail PreviewType = "thumbnail"
	PreviewTypePoster    PreviewType = "poster" // Video poster frame
	PreviewTypeCover     PreviewType = "cover"  // Audio cover art
)

// PreviewSize represents preset size configurations
type PreviewSize string

const (
	PreviewSizeSmall  PreviewSize = "small"  // 256x256
	PreviewSizeMedium PreviewSize = "medium" // 512x512
	PreviewSizeLarge  PreviewSize = "large"  // 1024x1024
)

// All image previews are ALWAYS converted to WebP format
// This is not configurable - WebP provides the best compression
// and quality balance for web delivery
const (
	ImagePreviewFormat    = "webp"
	ImagePreviewMimeType  = "image/webp"
	ImagePreviewExtension = ".webp"

	// Quality settings for WebP encoding
	ImagePreviewQuality  = 85    // 85 is optimal for quality/size balance
	ImagePreviewLossless = false // Lossy compression for smaller files
)

// PreviewRequest represents a request to generate a preview
type PreviewRequest struct {
	FileID   int64       `json:"file_id"`
	FilePath string      `json:"file_path"`
	FileHash string      `json:"file_hash"` // SHA256 of source file
	Type     PreviewType `json:"type"`
	Size     PreviewSize `json:"size"`
	// Format is always WebP for images, not configurable
	TimeOffset  float64 `json:"time_offset"`  // For video thumbnails (seconds)
	CacheBuster string  `json:"cache_buster"` // Optional cache buster
}

// PreviewMetadata stores metadata about a generated preview
type PreviewMetadata struct {
	ID           int64       `json:"id" db:"id"`
	FileID       int64       `json:"file_id" db:"file_id"`
	Type         PreviewType `json:"type" db:"type"`
	Size         PreviewSize `json:"size" db:"size"`
	Format       string      `json:"format" db:"format"` // Always "webp" for images
	Width        int         `json:"width" db:"width"`
	Height       int         `json:"height" db:"height"`
	FileSize     int64       `json:"file_size" db:"file_size"`
	ContentHash  string      `json:"content_hash" db:"content_hash"` // SHA256 of preview file
	StoragePath  string      `json:"storage_path" db:"storage_path"`
	TimeOffset   float64     `json:"time_offset,omitempty" db:"time_offset"`
	ProcessingMS int64       `json:"processing_ms" db:"processing_ms"`
	CreatedAt    time.Time   `json:"created_at" db:"created_at"`
	AccessedAt   time.Time   `json:"accessed_at" db:"accessed_at"`
}

// PreviewConfig holds configuration for preview generation
type PreviewConfig struct {
	// Storage settings
	RootDir         string        `env:"VV_PREVIEW_DIR" envDefault:"/var/lib/volumeviz/previews"`
	MaxStorageGB    int           `env:"VV_PREVIEW_MAX_STORAGE_GB" envDefault:"10"`
	CleanupEnabled  bool          `env:"VV_PREVIEW_CLEANUP_ENABLED" envDefault:"true"`
	CleanupInterval time.Duration `env:"VV_PREVIEW_CLEANUP_INTERVAL" envDefault:"1h"`
	MaxAge          time.Duration `env:"VV_PREVIEW_MAX_AGE" envDefault:"720h"` // 30 days

	// Processing settings
	MaxConcurrent   int           `env:"VV_PREVIEW_MAX_CONCURRENT" envDefault:"3"`
	ProcessTimeout  time.Duration `env:"VV_PREVIEW_PROCESS_TIMEOUT" envDefault:"30s"`
	MaxSourceSizeMB int           `env:"VV_PREVIEW_MAX_SOURCE_SIZE_MB" envDefault:"500"`

	// Image settings (libvips)
	VipsPath string `env:"VV_VIPS_PATH" envDefault:"vips"`
	// Images are ALWAYS converted to WebP - not configurable
	SmartCrop bool `env:"VV_PREVIEW_SMART_CROP" envDefault:"true"`

	// Video settings (ffmpeg)
	FFmpegPath      string  `env:"VV_FFMPEG_PATH" envDefault:"ffmpeg"`
	VideoTimeOffset float64 `env:"VV_PREVIEW_VIDEO_TIME_OFFSET" envDefault:"5.0"`
	VideoQuality    int     `env:"VV_PREVIEW_VIDEO_QUALITY" envDefault:"2"` // CRF for ffmpeg

	// Audio settings
	ExtractCoverArt bool   `env:"VV_PREVIEW_EXTRACT_COVER_ART" envDefault:"true"`
	FallbackCover   string `env:"VV_PREVIEW_FALLBACK_COVER" envDefault:""`

	// Caching settings
	EnableETag    bool `env:"VV_PREVIEW_ENABLE_ETAG" envDefault:"true"`
	MaxAgeSeconds int  `env:"VV_PREVIEW_MAX_AGE_SECONDS" envDefault:"2592000"` // 30 days

	// Security settings
	MaxWidth  int `env:"VV_PREVIEW_MAX_WIDTH" envDefault:"2048"`
	MaxHeight int `env:"VV_PREVIEW_MAX_HEIGHT" envDefault:"2048"`
	// Output format is always WebP - not configurable
}

// SizeConfig defines the dimensions for each size preset
type SizeConfig struct {
	Width     int
	Height    int
	MaxWidth  int
	MaxHeight int
	Crop      bool
}

// GetSizeConfig returns the configuration for a given size
func GetSizeConfig(size PreviewSize) SizeConfig {
	switch size {
	case PreviewSizeSmall:
		return SizeConfig{
			MaxWidth:  256,
			MaxHeight: 256,
			Crop:      false,
		}
	case PreviewSizeMedium:
		return SizeConfig{
			MaxWidth:  512,
			MaxHeight: 512,
			Crop:      false,
		}
	case PreviewSizeLarge:
		return SizeConfig{
			MaxWidth:  1024,
			MaxHeight: 1024,
			Crop:      false,
		}
	default:
		return SizeConfig{
			MaxWidth:  512,
			MaxHeight: 512,
			Crop:      false,
		}
	}
}

// GenerationResult represents the result of preview generation
type GenerationResult struct {
	Metadata     *PreviewMetadata
	Error        error
	CacheHit     bool
	ProcessingMS int64
}

// PreviewStats holds statistics about preview generation
type PreviewStats struct {
	TotalGenerated   int64     `json:"total_generated"`
	TotalSizeBytes   int64     `json:"total_size_bytes"`
	CacheHits        int64     `json:"cache_hits"`
	CacheMisses      int64     `json:"cache_misses"`
	AverageTimeMS    float64   `json:"average_time_ms"`
	LastCleanup      time.Time `json:"last_cleanup"`
	ActiveGenerators int       `json:"active_generators"`
}
