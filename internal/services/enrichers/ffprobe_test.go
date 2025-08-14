package enrichers

import (
	"encoding/json"
	"fmt"
	"os/exec"
	"testing"
	"time"

	"github.com/mantonx/volumeviz/internal/services/enrichers/testdata"
)

// mockExecCommand is used to mock exec.CommandContext
var mockExecCommand = exec.CommandContext

func TestFFprobeEnricher_Enrich(t *testing.T) {
	tests := []struct {
		name        string
		fileInfo    FileInfo
		fixture     string
		expectError bool
	}{
		{
			name: "HD H264 Video",
			fileInfo: FileInfo{
				ID:       1,
				Path:     "/test/video.mp4",
				Name:     "video.mp4",
				MimeType: "video/mp4",
				Size:     50000000,
				VolumeID: "test-volume",
			},
			fixture:     "video_h264_hd",
			expectError: false,
		},
		{
			name: "HDR10 Video",
			fileInfo: FileInfo{
				ID:       2,
				Path:     "/test/hdr_video.mkv",
				Name:     "hdr_video.mkv",
				MimeType: "video/x-matroska",
				Size:     100000000,
				VolumeID: "test-volume",
			},
			fixture:     "video_hdr10",
			expectError: false,
		},
		{
			name: "FLAC Audio",
			fileInfo: FileInfo{
				ID:       3,
				Path:     "/test/audio.flac",
				Name:     "audio.flac",
				MimeType: "audio/flac",
				Size:     30000000,
				VolumeID: "test-volume",
			},
			fixture:     "audio_flac",
			expectError: false,
		},
		{
			name: "Non-media file",
			fileInfo: FileInfo{
				ID:       4,
				Path:     "/test/document.pdf",
				Name:     "document.pdf",
				MimeType: "application/pdf",
				Size:     1000000,
				VolumeID: "test-volume",
			},
			fixture:     "",
			expectError: false, // Should return false from CanEnrich
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Create enricher with test config
			config := EnricherConfig{
				FFprobeEnabled: true,
				FFprobePath:    "ffprobe",
				FFprobeTimeout: 5 * time.Second,
			}
			enricher := NewFFprobeEnricher(config)

			// Check if enricher can handle this file
			if !enricher.CanEnrich(tt.fileInfo) {
				if tt.fixture != "" {
					t.Errorf("Expected CanEnrich to return true for %s", tt.fileInfo.MimeType)
				}
				return
			}

			// For actual tests, we would mock the ffprobe command
			// Here we're just testing the parsing logic
			if tt.fixture != "" {
				fixture := testdata.FFprobeFixtures[tt.fixture]
				metadata := parseTestFFprobeOutput(t, &fixture.Input)

				// Verify the parsed metadata
				verifyFFprobeMetadata(t, metadata, &fixture.Expected)
			}
		})
	}
}

func TestFFprobeEnricher_parseFrameRate(t *testing.T) {
	enricher := &FFprobeEnricher{}

	tests := []struct {
		input    string
		expected float64
	}{
		{"30000/1001", 29.97},
		{"24/1", 24.0},
		{"25.0", 25.0},
		{"60", 60.0},
		{"0/0", 0.0},
		{"", 0.0},
		{"invalid", 0.0},
	}

	for _, tt := range tests {
		t.Run(tt.input, func(t *testing.T) {
			result := enricher.parseFrameRate(tt.input)
			if fmt.Sprintf("%.2f", result) != fmt.Sprintf("%.2f", tt.expected) {
				t.Errorf("parseFrameRate(%s) = %.2f, want %.2f", tt.input, result, tt.expected)
			}
		})
	}
}

func TestFFprobeEnricher_detectHDRFormat(t *testing.T) {
	enricher := &FFprobeEnricher{}

	tests := []struct {
		name     string
		stream   FFprobeStream
		expected HDRFormat
	}{
		{
			name: "HDR10 - BT2020 with SMPTE2084",
			stream: FFprobeStream{
				ColorPrimaries: "bt2020",
				ColorTransfer:  "smpte2084",
			},
			expected: HDRFormatHDR10,
		},
		{
			name: "HLG HDR",
			stream: FFprobeStream{
				ColorTransfer: "arib-std-b67",
			},
			expected: HDRFormatHDR10,
		},
		{
			name: "SDR - BT709",
			stream: FFprobeStream{
				ColorPrimaries: "bt709",
				ColorTransfer:  "bt709",
			},
			expected: HDRFormatNone,
		},
		{
			name:     "No color info",
			stream:   FFprobeStream{},
			expected: HDRFormatNone,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := enricher.detectHDRFormat(tt.stream)
			if result != tt.expected {
				t.Errorf("detectHDRFormat() = %v, want %v", result, tt.expected)
			}
		})
	}
}

// Helper functions for testing

func parseTestFFprobeOutput(t *testing.T, testOutput *testdata.FFprobeJSONOutput) *MediaMetadata {
	enricher := &FFprobeEnricher{}
	fileInfo := FileInfo{Path: testOutput.Format.Filename}
	
	// Convert test data to internal format
	output := &FFprobeOutput{
		Format: FFprobeFormat{
			Filename:       testOutput.Format.Filename,
			Duration:       testOutput.Format.Duration,
			Size:           testOutput.Format.Size,
			BitRate:        testOutput.Format.BitRate,
			FormatName:     testOutput.Format.FormatName,
			FormatLongName: testOutput.Format.FormatLongName,
			Tags:           testOutput.Format.Tags,
		},
		Streams: make([]FFprobeStream, len(testOutput.Streams)),
	}
	
	for i, s := range testOutput.Streams {
		output.Streams[i] = FFprobeStream{
			Index:          s.Index,
			CodecName:      s.CodecName,
			CodecType:      s.CodecType,
			Width:          s.Width,
			Height:         s.Height,
			AvgFrameRate:   s.AvgFrameRate,
			RFrameRate:     s.RFrameRate,
			SampleRate:     s.SampleRate,
			Channels:       s.Channels,
			Duration:       s.Duration,
			BitRate:        s.BitRate,
			Profile:        s.Profile,
			Level:          s.Level,
			ColorPrimaries: s.ColorPrimaries,
			ColorTransfer:  s.ColorTransfer,
			ColorSpace:     s.ColorSpace,
		}
	}
	
	metadata, err := enricher.parseFFprobeOutput(output, fileInfo)
	if err != nil {
		t.Fatalf("parseFFprobeOutput failed: %v", err)
	}
	
	return metadata
}

func verifyFFprobeMetadata(t *testing.T, actual *MediaMetadata, expected *testdata.ExpectedMetadata) {
	// Verify kind
	if string(actual.Kind) != expected.Kind {
		t.Errorf("Kind = %v, want %v", actual.Kind, expected.Kind)
	}

	// Verify duration
	if expected.DurationMs > 0 {
		if actual.DurationMs == nil || *actual.DurationMs != expected.DurationMs {
			t.Errorf("DurationMs = %v, want %v", getInt64Value(actual.DurationMs), expected.DurationMs)
		}
	}

	// Verify bitrate
	if expected.BitrateKbps > 0 {
		if actual.BitrateKbps == nil || *actual.BitrateKbps != expected.BitrateKbps {
			t.Errorf("BitrateKbps = %v, want %v", getInt32Value(actual.BitrateKbps), expected.BitrateKbps)
		}
	}

	// Verify video properties
	if expected.Width > 0 {
		if actual.Width == nil || *actual.Width != expected.Width {
			t.Errorf("Width = %v, want %v", getInt32Value(actual.Width), expected.Width)
		}
	}

	if expected.Height > 0 {
		if actual.Height == nil || *actual.Height != expected.Height {
			t.Errorf("Height = %v, want %v", getInt32Value(actual.Height), expected.Height)
		}
	}

	if expected.FPS > 0 {
		if actual.FPS == nil || fmt.Sprintf("%.2f", *actual.FPS) != fmt.Sprintf("%.2f", expected.FPS) {
			t.Errorf("FPS = %.2f, want %.2f", getFloat64Value(actual.FPS), expected.FPS)
		}
	}

	// Verify HDR
	if string(actual.HDRFormat) != expected.HDRFormat {
		t.Errorf("HDRFormat = %v, want %v", actual.HDRFormat, expected.HDRFormat)
	}

	// Verify audio properties
	if expected.AudioChannels > 0 {
		if actual.AudioChannels == nil || *actual.AudioChannels != expected.AudioChannels {
			t.Errorf("AudioChannels = %v, want %v", getInt32Value(actual.AudioChannels), expected.AudioChannels)
		}
	}

	if expected.AudioCodec != "" {
		if actual.AudioCodec == nil || *actual.AudioCodec != expected.AudioCodec {
			t.Errorf("AudioCodec = %v, want %v", getStringValue(actual.AudioCodec), expected.AudioCodec)
		}
	}

	if expected.AudioSampleRate > 0 {
		if actual.AudioSampleRate == nil || *actual.AudioSampleRate != expected.AudioSampleRate {
			t.Errorf("AudioSampleRate = %v, want %v", getInt32Value(actual.AudioSampleRate), expected.AudioSampleRate)
		}
	}
}

// Helper functions to safely dereference pointers
func getInt64Value(p *int64) int64 {
	if p == nil {
		return 0
	}
	return *p
}

func getInt32Value(p *int32) int32 {
	if p == nil {
		return 0
	}
	return *p
}

func getFloat64Value(p *float64) float64 {
	if p == nil {
		return 0
	}
	return *p
}

func getStringValue(p *string) string {
	if p == nil {
		return ""
	}
	return *p
}

// Test the FFprobe JSON parsing directly
func TestFFprobeEnricher_parseFFprobeJSON(t *testing.T) {
	// Test parsing actual FFprobe JSON structure
	jsonData := `{
		"format": {
			"filename": "/test/video.mp4",
			"duration": "120.500000",
			"size": "50000000",
			"bit_rate": "3321404",
			"format_name": "mov,mp4,m4a,3gp,3g2,mj2"
		},
		"streams": [
			{
				"index": 0,
				"codec_name": "h264",
				"codec_type": "video",
				"width": 1920,
				"height": 1080,
				"avg_frame_rate": "30000/1001"
			}
		]
	}`

	var output FFprobeOutput
	err := json.Unmarshal([]byte(jsonData), &output)
	if err != nil {
		t.Fatalf("Failed to unmarshal JSON: %v", err)
	}

	if output.Format.Duration != "120.500000" {
		t.Errorf("Duration = %v, want %v", output.Format.Duration, "120.500000")
	}

	if len(output.Streams) != 1 {
		t.Errorf("Streams count = %v, want %v", len(output.Streams), 1)
	}

	if output.Streams[0].Width != 1920 {
		t.Errorf("Width = %v, want %v", output.Streams[0].Width, 1920)
	}
}