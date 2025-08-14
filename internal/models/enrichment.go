package models

import (
	"time"
)

// EnrichmentKind represents the type of enrichment to perform
type EnrichmentKind string

const (
	EnrichmentKindAudio    EnrichmentKind = "audio"
	EnrichmentKindVideo    EnrichmentKind = "video"
	EnrichmentKindImage    EnrichmentKind = "image"
	EnrichmentKindSubtitle EnrichmentKind = "subtitle"
)

// HDRFormat represents HDR format types
type HDRFormat string

const (
	HDRFormatNone        HDRFormat = "none"
	HDRFormatHDR10       HDRFormat = "hdr10"
	HDRFormatHDR10Plus   HDRFormat = "hdr10+"
	HDRFormatDolbyVision HDRFormat = "dovi"
)

// MediaMetadata represents enriched metadata for a media file
type MediaMetadata struct {
	Kind        EnrichmentKind         `json:"kind"`
	RawMetadata map[string]any `json:"raw_metadata,omitempty"`

	// Common fields (populated based on media type)
	DurationMs  *int64  `json:"duration_ms,omitempty"`  // Audio/Video duration
	BitrateKbps *int32  `json:"bitrate_kbps,omitempty"` // Audio/Video bitrate

	// Video/Image dimensions
	Width  *int32 `json:"width,omitempty"`
	Height *int32 `json:"height,omitempty"`

	// Video-specific
	FPS                     *float64 `json:"fps,omitempty"`
	ColorPrimaries          *string  `json:"color_primaries,omitempty"`
	TransferCharacteristic  *string  `json:"transfer_characteristic,omitempty"`
	HDRFormat               HDRFormat `json:"hdr_format"`
	AudioChannels           *int32   `json:"audio_channels,omitempty"`
	AudioCodec              *string  `json:"audio_codec,omitempty"`
	AudioSampleRate         *int32   `json:"audio_sample_rate,omitempty"`
	VideoCodec              *string  `json:"video_codec,omitempty"`
	VideoProfile            *string  `json:"video_profile,omitempty"`
	VideoLevel              *string  `json:"video_level,omitempty"`

	// Image/Camera metadata
	CaptureDateTime *time.Time `json:"capture_datetime,omitempty"`
	CameraMake      *string    `json:"camera_make,omitempty"`
	CameraModel     *string    `json:"camera_model,omitempty"`
	LensModel       *string    `json:"lens_model,omitempty"`
	Orientation     *int32     `json:"orientation,omitempty"`
	
	// GPS data (with privacy controls)
	GPSLatitude  *float64 `json:"gps_latitude,omitempty"`
	GPSLongitude *float64 `json:"gps_longitude,omitempty"`

	// Subtitle-specific
	Language        *string  `json:"language,omitempty"`
	Format          *string  `json:"format,omitempty"`
	CueCount        *int32   `json:"cue_count,omitempty"`
	CoveragePercent *float64 `json:"coverage_percent,omitempty"`
}

// FileInfo represents basic file information for enrichment
type FileInfo struct {
	ID       int64  `json:"id"`
	Path     string `json:"path"`
	Name     string `json:"name"`
	MimeType string `json:"mime_type"`
	Size     int64  `json:"size"`
	VolumeID string `json:"volume_id"`
}

// EnrichmentResult represents the result of enriching a single file
type EnrichmentResult struct {
	FileID       int64          `json:"file_id"`
	Success      bool           `json:"success"`
	Metadata     *MediaMetadata `json:"metadata,omitempty"`
	Error        string         `json:"error,omitempty"`
	Duration     time.Duration  `json:"duration"`
	EnrichedAt   time.Time      `json:"enriched_at"`
	EnricherName string         `json:"enricher_name"`
}

// EnrichmentProgress represents the progress of enriching a volume
type EnrichmentProgress struct {
	VolumeID        string    `json:"volume_id"`
	Status          string    `json:"status"` // "running", "completed", "failed", "paused"
	StartedAt       time.Time `json:"started_at"`
	LastUpdate      time.Time `json:"last_update"`
	
	// Overall progress
	TotalFiles      int64 `json:"total_files"`
	ProcessedFiles  int64 `json:"processed_files"`
	SuccessfulFiles int64 `json:"successful_files"`
	FailedFiles     int64 `json:"failed_files"`
	SkippedFiles    int64 `json:"skipped_files"`
	
	// Current operation
	CurrentFile     string `json:"current_file"`
	CurrentEnricher string `json:"current_enricher"`
	
	// Performance metrics
	FilesPerSecond     float64       `json:"files_per_sec"`
	EstimatedRemaining time.Duration `json:"estimated_remaining"`
	
	// Error tracking
	LastError   string `json:"last_error,omitempty"`
	ErrorsCount int64  `json:"errors_count"`
	
	// Enricher-specific progress
	EnricherProgress map[string]*EnricherProgress `json:"enricher_progress,omitempty"`
}

// EnricherProgress tracks progress for a specific enricher
type EnricherProgress struct {
	Name            string        `json:"name"`
	Status          string        `json:"status"`
	ProcessedFiles  int64         `json:"processed_files"`
	SuccessfulFiles int64         `json:"successful_files"`
	FailedFiles     int64         `json:"failed_files"`
	SkippedFiles    int64         `json:"skipped_files"`
	LastUpdate      time.Time     `json:"last_update"`
	AverageTime     time.Duration `json:"average_time"`
}