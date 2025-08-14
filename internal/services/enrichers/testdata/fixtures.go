// Package testdata provides test fixtures for enricher testing
package testdata

import (
	"encoding/json"
	"time"
)

// FFprobeFixtures provides test data for ffprobe enricher testing
var FFprobeFixtures = map[string]FFprobeTestCase{
	"video_h264_hd": {
		Input: FFprobeJSONOutput{
			Format: FFprobeFormat{
				Filename:       "/test/video.mp4",
				Duration:       "120.5",
				Size:           "50000000",
				BitRate:        "3321404",
				FormatName:     "mov,mp4,m4a,3gp,3g2,mj2",
				FormatLongName: "QuickTime / MOV",
			},
			Streams: []FFprobeStream{
				{
					Index:          0,
					CodecName:      "h264",
					CodecType:      "video",
					Width:          1920,
					Height:         1080,
					AvgFrameRate:   "30000/1001",
					RFrameRate:     "30000/1001",
					Profile:        "High",
					Level:          "4.1",
					ColorPrimaries: "bt709",
					ColorTransfer:  "bt709",
					ColorSpace:     "bt709",
				},
				{
					Index:       1,
					CodecName:   "aac",
					CodecType:   "audio",
					SampleRate:  "48000",
					Channels:    2,
				},
			},
		},
		Expected: ExpectedMetadata{
			Kind:                  "video",
			DurationMs:            120500,
			BitrateKbps:           3321,
			Width:                 1920,
			Height:                1080,
			FPS:                   29.97,
			ColorPrimaries:        "bt709",
			TransferCharacteristic: "bt709",
			HDRFormat:             "none",
			VideoCodec:            "h264",
			VideoProfile:          "High",
			VideoLevel:            "4.1",
			AudioChannels:         2,
			AudioCodec:            "aac",
			AudioSampleRate:       48000,
		},
	},
	"video_hdr10": {
		Input: FFprobeJSONOutput{
			Format: FFprobeFormat{
				Filename:   "/test/hdr_video.mkv",
				Duration:   "90.0",
				Size:       "100000000",
				BitRate:    "8888888",
				FormatName: "matroska,webm",
			},
			Streams: []FFprobeStream{
				{
					Index:          0,
					CodecName:      "hevc",
					CodecType:      "video",
					Width:          3840,
					Height:         2160,
					AvgFrameRate:   "24/1",
					Profile:        "Main 10",
					Level:          "5.1",
					ColorPrimaries: "bt2020",
					ColorTransfer:  "smpte2084",
					ColorSpace:     "bt2020nc",
				},
			},
		},
		Expected: ExpectedMetadata{
			Kind:                  "video",
			DurationMs:            90000,
			BitrateKbps:           8888,
			Width:                 3840,
			Height:                2160,
			FPS:                   24.0,
			ColorPrimaries:        "bt2020",
			TransferCharacteristic: "smpte2084",
			HDRFormat:             "hdr10",
			VideoCodec:            "hevc",
			VideoProfile:          "Main 10",
			VideoLevel:            "5.1",
		},
	},
	"audio_flac": {
		Input: FFprobeJSONOutput{
			Format: FFprobeFormat{
				Filename:   "/test/audio.flac",
				Duration:   "180.5",
				Size:       "30000000",
				BitRate:    "1328903",
				FormatName: "flac",
			},
			Streams: []FFprobeStream{
				{
					Index:       0,
					CodecName:   "flac",
					CodecType:   "audio",
					SampleRate:  "96000",
					Channels:    2,
					BitRate:     "1328903",
				},
			},
		},
		Expected: ExpectedMetadata{
			Kind:            "audio",
			DurationMs:      180500,
			BitrateKbps:     1328,
			AudioChannels:   2,
			AudioCodec:      "flac",
			AudioSampleRate: 96000,
		},
	},
}

// EXIFFixtures provides test data for EXIF enricher testing
var EXIFFixtures = map[string]EXIFTestCase{
	"image_with_camera": {
		Input: EXIFJSONOutput{
			ImageWidth:       4032,
			ImageHeight:      3024,
			DateTimeOriginal: "2023:10:15 14:30:00",
			Make:             "Canon",
			Model:            "Canon EOS R5",
			LensModel:        "EF24-70mm f/2.8L II USM",
			Orientation:      1,
			ExposureTime:     "1/250",
			FNumber:          "5.6",
			ISO:              400,
			FocalLength:      "50 mm",
		},
		Expected: ExpectedEXIFMetadata{
			Width:           4032,
			Height:          3024,
			CaptureDateTime: parseTestTime("2023-10-15T14:30:00Z"),
			CameraMake:      "Canon",
			CameraModel:     "Canon EOS R5",
			LensModel:       "EF24-70mm f/2.8L II USM",
			Orientation:     1,
		},
	},
	"image_with_gps": {
		Input: EXIFJSONOutput{
			ImageWidth:       2048,
			ImageHeight:      1536,
			DateTimeOriginal: "2024:01:20 09:15:30",
			Make:             "Apple",
			Model:            "iPhone 15 Pro",
			Orientation:      6,
			GPSLatitude:      "40.748817",
			GPSLongitude:     "-73.985428",
			GPSLatitudeRef:   "N",
			GPSLongitudeRef:  "W",
		},
		Expected: ExpectedEXIFMetadata{
			Width:           2048,
			Height:          1536,
			CaptureDateTime: parseTestTime("2024-01-20T09:15:30Z"),
			CameraMake:      "Apple",
			CameraModel:     "iPhone 15 Pro",
			Orientation:     6,
			GPSLatitude:     40.748817,
			GPSLongitude:    -73.985428,
		},
		ExpectedRedacted: ExpectedEXIFMetadata{
			Width:           2048,
			Height:          1536,
			CaptureDateTime: parseTestTime("2024-01-20T09:15:30Z"),
			CameraMake:      "Apple",
			CameraModel:     "iPhone 15 Pro",
			Orientation:     6,
			GPSLatitude:     40.749,  // Rounded to 3 decimal places
			GPSLongitude:    -73.985, // Rounded to 3 decimal places
		},
	},
}

// SubtitleFixtures provides test data for subtitle enricher testing
var SubtitleFixtures = map[string]SubtitleTestCase{
	"srt_english": {
		Content: `1
00:00:00,000 --> 00:00:02,500
Welcome to the video

2
00:00:03,000 --> 00:00:05,500
This is a test subtitle

3
00:00:06,000 --> 00:00:08,500
Thank you for watching`,
		FileName: "video.en.srt",
		Expected: ExpectedSubtitleMetadata{
			Format:          "srt",
			Language:        "English",
			CueCount:        3,
			CoveragePercent: 70.59, // 6 seconds of subtitles in 8.5 seconds total
			TotalDuration:   8500,  // milliseconds
		},
	},
	"vtt_spanish": {
		Content: `WEBVTT

00:00:00.000 --> 00:00:03.000
Bienvenido al video

00:00:03.500 --> 00:00:06.500
Este es un subtítulo de prueba

00:00:07.000 --> 00:00:10.000
Gracias por ver`,
		FileName: "video.es.vtt",
		Expected: ExpectedSubtitleMetadata{
			Format:          "vtt",
			Language:        "Spanish",
			CueCount:        3,
			CoveragePercent: 90.0, // 9 seconds of subtitles in 10 seconds total
			TotalDuration:   10000,
		},
	},
	"ass_japanese": {
		Content: `[Script Info]
Title: Test Subtitle
ScriptType: v4.00+

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour
Style: Default,Arial,20,&H00FFFFFF,&H000000FF

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,0:00:00.00,0:00:02.00,Default,,0,0,0,,ビデオへようこそ
Dialogue: 0,0:00:02.50,0:00:04.50,Default,,0,0,0,,これはテストです
Dialogue: 0,0:00:05.00,0:00:07.00,Default,,0,0,0,,ありがとうございます`,
		FileName: "video.ja.ass",
		Expected: ExpectedSubtitleMetadata{
			Format:          "ass",
			Language:        "Japanese",
			CueCount:        3,
			CoveragePercent: 85.71, // 6 seconds of subtitles in 7 seconds total
			TotalDuration:   7000,
		},
	},
}

// Test case structures
type FFprobeTestCase struct {
	Input    FFprobeJSONOutput `json:"input"`
	Expected ExpectedMetadata  `json:"expected"`
}

type EXIFTestCase struct {
	Input            EXIFJSONOutput       `json:"input"`
	Expected         ExpectedEXIFMetadata `json:"expected"`
	ExpectedRedacted ExpectedEXIFMetadata `json:"expected_redacted,omitempty"`
}

type SubtitleTestCase struct {
	Content  string                    `json:"content"`
	FileName string                    `json:"filename"`
	Expected ExpectedSubtitleMetadata  `json:"expected"`
}

// FFprobe output structures
type FFprobeJSONOutput struct {
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
	Tags           map[string]string `json:"tags,omitempty"`
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
	Level          string            `json:"level,omitempty"`
	ColorPrimaries string            `json:"color_primaries,omitempty"`
	ColorTransfer  string            `json:"color_transfer,omitempty"`
	ColorSpace     string            `json:"color_space,omitempty"`
}

// EXIF output structures
type EXIFJSONOutput struct {
	ImageWidth       int    `json:"ImageWidth,omitempty"`
	ImageHeight      int    `json:"ImageHeight,omitempty"`
	DateTimeOriginal string `json:"DateTimeOriginal,omitempty"`
	Make             string `json:"Make,omitempty"`
	Model            string `json:"Model,omitempty"`
	LensModel        string `json:"LensModel,omitempty"`
	Orientation      int    `json:"Orientation,omitempty"`
	GPSLatitude      string `json:"GPSLatitude,omitempty"`
	GPSLongitude     string `json:"GPSLongitude,omitempty"`
	GPSLatitudeRef   string `json:"GPSLatitudeRef,omitempty"`
	GPSLongitudeRef  string `json:"GPSLongitudeRef,omitempty"`
	ExposureTime     string `json:"ExposureTime,omitempty"`
	FNumber          string `json:"FNumber,omitempty"`
	ISO              int    `json:"ISO,omitempty"`
	FocalLength      string `json:"FocalLength,omitempty"`
}

// Expected metadata structures
type ExpectedMetadata struct {
	Kind                   string  `json:"kind"`
	DurationMs             int64   `json:"duration_ms,omitempty"`
	BitrateKbps            int32   `json:"bitrate_kbps,omitempty"`
	Width                  int32   `json:"width,omitempty"`
	Height                 int32   `json:"height,omitempty"`
	FPS                    float64 `json:"fps,omitempty"`
	ColorPrimaries         string  `json:"color_primaries,omitempty"`
	TransferCharacteristic string  `json:"transfer_characteristic,omitempty"`
	HDRFormat              string  `json:"hdr_format,omitempty"`
	AudioChannels          int32   `json:"audio_channels,omitempty"`
	AudioCodec             string  `json:"audio_codec,omitempty"`
	AudioSampleRate        int32   `json:"audio_sample_rate,omitempty"`
	VideoCodec             string  `json:"video_codec,omitempty"`
	VideoProfile           string  `json:"video_profile,omitempty"`
	VideoLevel             string  `json:"video_level,omitempty"`
}

type ExpectedEXIFMetadata struct {
	Width           int32     `json:"width,omitempty"`
	Height          int32     `json:"height,omitempty"`
	CaptureDateTime time.Time `json:"capture_datetime,omitempty"`
	CameraMake      string    `json:"camera_make,omitempty"`
	CameraModel     string    `json:"camera_model,omitempty"`
	LensModel       string    `json:"lens_model,omitempty"`
	Orientation     int32     `json:"orientation,omitempty"`
	GPSLatitude     float64   `json:"gps_latitude,omitempty"`
	GPSLongitude    float64   `json:"gps_longitude,omitempty"`
}

type ExpectedSubtitleMetadata struct {
	Format          string  `json:"format"`
	Language        string  `json:"language"`
	CueCount        int32   `json:"cue_count"`
	CoveragePercent float64 `json:"coverage_percent"`
	TotalDuration   int64   `json:"total_duration"`
}

// Helper functions
func parseTestTime(s string) time.Time {
	t, _ := time.Parse(time.RFC3339, s)
	return t
}

// FFprobeJSONString returns a JSON string for testing ffprobe output parsing
func FFprobeJSONString(testCase string) (string, error) {
	fixture, ok := FFprobeFixtures[testCase]
	if !ok {
		return "", nil
	}
	
	data, err := json.Marshal(fixture.Input)
	if err != nil {
		return "", err
	}
	
	return string(data), nil
}

// EXIFJSONString returns a JSON string for testing EXIF output parsing
func EXIFJSONString(testCase string) (string, error) {
	fixture, ok := EXIFFixtures[testCase]
	if !ok {
		return "", nil
	}
	
	// exiftool returns an array
	data, err := json.Marshal([]EXIFJSONOutput{fixture.Input})
	if err != nil {
		return "", err
	}
	
	return string(data), nil
}