package enrichers

import (
	"context"
	"encoding/json"
	"fmt"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/mantonx/volumeviz/internal/utils"
)

// FFprobeEnricher extracts metadata from audio and video files using ffprobe
type FFprobeEnricher struct {
	config      EnricherConfig
	ffprobePath string
}

// NewFFprobeEnricher creates a new FFprobe enricher
func NewFFprobeEnricher(config EnricherConfig) *FFprobeEnricher {
	return &FFprobeEnricher{
		config:      config,
		ffprobePath: config.FFprobePath,
	}
}

// Name returns the enricher name
func (f *FFprobeEnricher) Name() string {
	return "ffprobe"
}

// CanEnrich determines if this enricher can process the given file
func (f *FFprobeEnricher) CanEnrich(fileInfo FileInfo) bool {
	if !f.config.FFprobeEnabled {
		return false
	}

	// Check if it's a video or audio file
	return strings.HasPrefix(fileInfo.MimeType, "video/") ||
		strings.HasPrefix(fileInfo.MimeType, "audio/")
}

// IsAvailable checks if ffprobe is available on the system
func (f *FFprobeEnricher) IsAvailable() bool {
	if !f.config.FFprobeEnabled {
		return false
	}

	runner := utils.NewCommandRunner("ffprobe", f.config.FFprobeTimeout)
	return runner.IsAvailable()
}

// GetCapabilities returns what this enricher can extract
func (f *FFprobeEnricher) GetCapabilities() EnricherCapabilities {
	return EnricherCapabilities{
		Name: "ffprobe",
		SupportedMimes: []string{
			"video/mp4", "video/avi", "video/mkv", "video/mov", "video/wmv",
			"video/flv", "video/webm", "video/m4v", "video/3gp", "video/ts",
			"audio/mp3", "audio/flac", "audio/wav", "audio/aac", "audio/ogg",
			"audio/m4a", "audio/wma", "audio/opus", "audio/mp2",
		},
		ExtractedFields: []string{
			"duration_ms", "bitrate_kbps", "width", "height", "fps",
			"color_primaries", "transfer_characteristic", "hdr_format",
			"audio_channels", "audio_codec", "audio_sample_rate",
			"video_codec", "video_profile", "video_level",
		},
		RequiredTools: []string{"ffprobe"},
		Performance:   "medium",
		Accuracy:      "high",
		Features:      []string{"detailed_metadata", "comprehensive_formats", "hdr_detection"},
	}
}

// Enrich extracts metadata using ffprobe
func (f *FFprobeEnricher) Enrich(ctx context.Context, fileInfo FileInfo) (*MediaMetadata, error) {
	// Create context with timeout
	timeoutCtx, cancel := context.WithTimeout(ctx, f.config.FFprobeTimeout)
	defer cancel()

	// Run ffprobe to get JSON metadata
	probeData, err := f.runFFprobe(timeoutCtx, fileInfo.Path)
	if err != nil {
		return nil, fmt.Errorf("ffprobe failed: %w", err)
	}

	// Parse and convert to our metadata format
	metadata, err := f.parseFFprobeOutput(probeData, fileInfo)
	if err != nil {
		return nil, fmt.Errorf("failed to parse ffprobe output: %w", err)
	}

	return metadata, nil
}

// FFprobeOutput represents the structure of ffprobe JSON output
type FFprobeOutput struct {
	Format  FFprobeFormat   `json:"format"`
	Streams []FFprobeStream `json:"streams"`
}

type FFprobeFormat struct {
	Filename       string            `json:"filename"`
	Duration       string            `json:"duration"`
	Size           string            `json:"size"`
	BitRate        string            `json:"bit_rate"`
	FormatName     string            `json:"format_name"`
	FormatLongName string            `json:"format_long_name"`
	Tags           map[string]string `json:"tags"`
}

type FFprobeStream struct {
	Index          int               `json:"index"`
	CodecName      string            `json:"codec_name"`
	CodecType      string            `json:"codec_type"`
	Width          int               `json:"width,omitempty"`
	Height         int               `json:"height,omitempty"`
	AvgFrameRate   string            `json:"avg_frame_rate,omitempty"`
	RFrameRate     string            `json:"r_frame_rate,omitempty"`
	SampleRate     string            `json:"sample_rate,omitempty"`
	Channels       int               `json:"channels,omitempty"`
	Duration       string            `json:"duration,omitempty"`
	BitRate        string            `json:"bit_rate,omitempty"`
	Profile        string            `json:"profile,omitempty"`
	Level          interface{}       `json:"level,omitempty"`
	ColorPrimaries string            `json:"color_primaries,omitempty"`
	ColorTransfer  string            `json:"color_transfer,omitempty"`
	ColorSpace     string            `json:"color_space,omitempty"`
	SideDataList   []FFprobeSideData `json:"side_data_list,omitempty"`
	Tags           map[string]string `json:"tags,omitempty"`
	Disposition    map[string]int    `json:"disposition,omitempty"`
}

type FFprobeSideData struct {
	SideDataType string `json:"side_data_type"`
	// HDR metadata fields would be here for advanced HDR detection
}

// runFFprobe executes ffprobe and returns the JSON output
func (f *FFprobeEnricher) runFFprobe(ctx context.Context, filePath string) (*FFprobeOutput, error) {
	// Use command runner for consistent command execution
	runner := utils.NewCommandRunner("ffprobe", f.config.FFprobeTimeout)
	runner.ToolPath = f.ffprobePath
	runner.SetDefaultArgs([]string{
		"-v", "quiet",
		"-print_format", "json",
		"-show_format",
		"-show_streams",
		"-hide_banner",
	})

	result, err := runner.Run(ctx, filePath)
	if err != nil {
		return nil, fmt.Errorf("ffprobe execution failed for file %s: %w", filepath.Base(filePath), err)
	}

	if result.ExitCode != 0 {
		return nil, fmt.Errorf("ffprobe execution failed for file %s: exit code %d (stderr: %s)",
			filepath.Base(filePath), result.ExitCode, string(result.Stderr))
	}

	var probeData FFprobeOutput
	if err := json.Unmarshal(result.Stdout, &probeData); err != nil {
		return nil, fmt.Errorf("failed to parse ffprobe JSON: %w", err)
	}

	return &probeData, nil
}

// parseFFprobeOutput converts ffprobe output to our MediaMetadata format
func (f *FFprobeEnricher) parseFFprobeOutput(probeData *FFprobeOutput, fileInfo FileInfo) (*MediaMetadata, error) {
	metadata := &MediaMetadata{
		RawMetadata: make(map[string]interface{}),
	}

	// Determine kind based on streams
	hasVideo := false
	hasAudio := false

	for _, stream := range probeData.Streams {
		if stream.CodecType == "video" {
			hasVideo = true
		} else if stream.CodecType == "audio" {
			hasAudio = true
		}
	}

	// Set kind based on what we found
	if hasVideo {
		metadata.Kind = EnrichmentKindVideo
	} else if hasAudio {
		metadata.Kind = EnrichmentKindAudio
	} else {
		return nil, fmt.Errorf("no recognizable audio or video streams found")
	}

	// Parse format-level metadata
	if duration, err := strconv.ParseFloat(probeData.Format.Duration, 64); err == nil {
		durationMs := int64(duration * 1000)
		metadata.DurationMs = &durationMs
	}

	if bitrate, err := strconv.ParseInt(probeData.Format.BitRate, 10, 32); err == nil {
		bitrateKbps := int32(bitrate / 1000)
		metadata.BitrateKbps = &bitrateKbps
	}

	// Process streams
	for _, stream := range probeData.Streams {
		switch stream.CodecType {
		case "video":
			f.parseVideoStream(stream, metadata)
		case "audio":
			f.parseAudioStream(stream, metadata)
		}
	}

	// Store raw metadata for advanced queries
	metadata.RawMetadata["ffprobe_format"] = probeData.Format
	metadata.RawMetadata["ffprobe_streams"] = probeData.Streams

	return metadata, nil
}

// parseVideoStream extracts video-specific metadata
func (f *FFprobeEnricher) parseVideoStream(stream FFprobeStream, metadata *MediaMetadata) {
	// Resolution
	if stream.Width > 0 {
		width := int32(stream.Width)
		metadata.Width = &width
	}
	if stream.Height > 0 {
		height := int32(stream.Height)
		metadata.Height = &height
	}

	// Frame rate - try avg_frame_rate first, then r_frame_rate
	fps := f.parseFrameRate(stream.AvgFrameRate)
	if fps == 0 {
		fps = f.parseFrameRate(stream.RFrameRate)
	}
	if fps > 0 {
		metadata.FPS = &fps
	}

	// Codec information
	if stream.CodecName != "" {
		metadata.VideoCodec = &stream.CodecName
	}
	if stream.Profile != "" {
		metadata.VideoProfile = &stream.Profile
	}
	if stream.Level != nil && stream.Level != "" {
		levelStr := fmt.Sprintf("%v", stream.Level)
		metadata.VideoLevel = &levelStr
	}

	// Color information
	if stream.ColorPrimaries != "" {
		metadata.ColorPrimaries = &stream.ColorPrimaries
	}
	if stream.ColorTransfer != "" {
		metadata.TransferCharacteristic = &stream.ColorTransfer
	}

	// HDR Detection
	hdrFormat := f.detectHDRFormat(stream)
	if hdrFormat != HDRFormatNone {
		metadata.HDRFormat = hdrFormat
	}
}

// parseAudioStream extracts audio-specific metadata
func (f *FFprobeEnricher) parseAudioStream(stream FFprobeStream, metadata *MediaMetadata) {
	// Channels
	if stream.Channels > 0 {
		channels := int32(stream.Channels)
		metadata.AudioChannels = &channels
	}

	// Sample rate
	if sampleRate, err := strconv.ParseInt(stream.SampleRate, 10, 32); err == nil {
		rate := int32(sampleRate)
		metadata.AudioSampleRate = &rate
	}

	// Codec
	if stream.CodecName != "" {
		metadata.AudioCodec = &stream.CodecName
	}
}

// parseFrameRate parses frame rate strings like "30000/1001" or "30.0"
func (f *FFprobeEnricher) parseFrameRate(frameRateStr string) float64 {
	if frameRateStr == "" || frameRateStr == "0/0" {
		return 0
	}

	// Handle fraction format like "30000/1001"
	if strings.Contains(frameRateStr, "/") {
		parts := strings.Split(frameRateStr, "/")
		if len(parts) == 2 {
			numerator, err1 := strconv.ParseFloat(parts[0], 64)
			denominator, err2 := strconv.ParseFloat(parts[1], 64)
			if err1 == nil && err2 == nil && denominator != 0 {
				return numerator / denominator
			}
		}
		return 0
	}

	// Handle decimal format
	fps, err := strconv.ParseFloat(frameRateStr, 64)
	if err != nil {
		return 0
	}
	return fps
}

// detectHDRFormat detects HDR format from stream metadata
func (f *FFprobeEnricher) detectHDRFormat(stream FFprobeStream) HDRFormat {
	// Check color transfer characteristics for HDR indicators
	transfer := strings.ToLower(stream.ColorTransfer)
	primaries := strings.ToLower(stream.ColorPrimaries)

	// HDR10 detection
	if transfer == "smpte2084" || transfer == "arib-std-b67" {
		// Check for Dolby Vision first (more specific)
		for _, sideData := range stream.SideDataList {
			if strings.Contains(strings.ToLower(sideData.SideDataType), "dolby") {
				return HDRFormatDolbyVision
			}
		}

		// Check for HDR10+ indicators
		if transfer == "smpte2084" && (primaries == "bt2020" || primaries == "bt.2020") {
			// More advanced HDR10+ detection would examine side data
			return HDRFormatHDR10
		}

		return HDRFormatHDR10
	}

	// HLG (Hybrid Log-Gamma) is also HDR
	if transfer == "arib-std-b67" {
		return HDRFormatHDR10
	}

	return HDRFormatNone
}
