package previews

import (
	"bytes"
	"context"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"time"
)

// VideoProcessor handles video poster/thumbnail generation using ffmpeg
type VideoProcessor struct {
	ffmpegPath    string
	defaultOffset float64
}

// NewVideoProcessor creates a new video processor
func NewVideoProcessor(ffmpegPath string, defaultOffset float64) (*VideoProcessor, error) {
	// Check if ffmpeg is available
	if _, err := exec.LookPath(ffmpegPath); err != nil {
		// Try common ffmpeg command names
		if path, err := exec.LookPath("ffmpeg"); err == nil {
			ffmpegPath = path
		} else {
			return nil, fmt.Errorf("ffmpeg not found")
		}
	}

	// Verify ffmpeg works
	cmd := exec.Command(ffmpegPath, "-version")
	if err := cmd.Run(); err != nil {
		return nil, fmt.Errorf("ffmpeg not available: %w", err)
	}

	// Default offset of 5 seconds if not specified
	if defaultOffset <= 0 {
		defaultOffset = 5.0
	}

	return &VideoProcessor{
		ffmpegPath:    ffmpegPath,
		defaultOffset: defaultOffset,
	}, nil
}

// GeneratePoster creates a WebP poster frame from a video file
func (vp *VideoProcessor) GeneratePoster(ctx context.Context, sourcePath string, size PreviewSize, timeOffset float64) ([]byte, error) {
	// Get size configuration
	sizeConfig := GetSizeConfig(size)

	// Check if source file exists
	_, err := os.Stat(sourcePath)
	if err != nil {
		return nil, fmt.Errorf("source file not accessible: %w", err)
	}

	// No size limit for videos - ffmpeg can efficiently seek and extract frames
	// even from very large files without loading them into memory

	// Get video duration first to determine best offset
	duration, err := vp.getVideoDuration(ctx, sourcePath)
	if err != nil {
		// If we can't get duration, use a safe default
		duration = 60.0 // Assume 60 seconds
	}

	// Use smart offset selection if not specified
	if timeOffset <= 0 {
		// For longer videos (>30 min), skip more of the intro/credits
		if duration > 1800 { // 30+ minutes
			// Use 20% into the video or 10 minutes, whichever is smaller
			timeOffset = duration * 0.2
			if timeOffset > 600 {
				timeOffset = 600 // Max 10 minutes
			}
			if timeOffset < 300 {
				timeOffset = 300 // Min 5 minutes for long videos
			}
		} else if duration > 600 { // 10+ minutes
			// Use 15% into the video
			timeOffset = duration * 0.15
			if timeOffset < 60 {
				timeOffset = 60 // Min 1 minute
			}
		} else {
			// Short videos, use 10% but not less than 5 seconds
			timeOffset = duration * 0.1
			if timeOffset < 5.0 {
				timeOffset = 5.0
			}
		}
	}

	// Ensure offset doesn't exceed duration
	if timeOffset >= duration && duration > 0 {
		// Use 10% of video duration or 1 second, whichever is larger
		timeOffset = duration * 0.1
		if timeOffset < 1.0 {
			timeOffset = 1.0
		}
	}

	// Create temporary file for the WebP output
	tempFile := filepath.Join(os.TempDir(), fmt.Sprintf("poster_%d.webp", time.Now().UnixNano()))
	defer os.Remove(tempFile)

	// Build ffmpeg command to extract frame and convert to WebP
	// Use a simpler, more reliable approach
	args := []string{
		"-v", "error", // Reduce verbosity
		"-i", sourcePath, // Input file
		"-ss", fmt.Sprintf("%.2f", timeOffset), // Seek to time offset
		"-frames:v", "1", // Extract only 1 frame
		"-vf", fmt.Sprintf("scale=%d:%d:force_original_aspect_ratio=decrease,pad=%d:%d:-1:-1:color=black",
			sizeConfig.MaxWidth, sizeConfig.MaxHeight, sizeConfig.MaxWidth, sizeConfig.MaxHeight), // Scale and pad
		"-f", "webp", // Force WebP format
		"-quality", strconv.Itoa(ImagePreviewQuality), // WebP quality
		"-y",     // Overwrite output
		"pipe:1", // Output to stdout
	}

	// Create command with context
	cmd := exec.CommandContext(ctx, vp.ffmpegPath, args...)

	// Capture output
	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr

	// Run the command
	err = cmd.Run()
	if err != nil {
		if ctx.Err() == context.DeadlineExceeded {
			return nil, fmt.Errorf("poster generation timeout")
		}

		// If frame extraction failed, try different time offsets
		if timeOffset > 30 {
			// Try 30 seconds into the video
			return vp.GeneratePoster(ctx, sourcePath, size, 30.0)
		} else if timeOffset > 10 {
			// Try 10 seconds
			return vp.GeneratePoster(ctx, sourcePath, size, 10.0)
		} else if timeOffset > 1 {
			// Try near the beginning
			return vp.GeneratePoster(ctx, sourcePath, size, 1.0)
		}

		return nil, fmt.Errorf("ffmpeg failed after trying multiple time offsets: %w (stderr: %s)", err, stderr.String())
	}

	// Get the WebP data
	webpData := stdout.Bytes()
	if len(webpData) == 0 {
		// If no output and we haven't tried other offsets, retry
		if timeOffset > 30 {
			return vp.GeneratePoster(ctx, sourcePath, size, 30.0)
		} else if timeOffset > 10 {
			return vp.GeneratePoster(ctx, sourcePath, size, 10.0)
		} else if timeOffset > 1 {
			return vp.GeneratePoster(ctx, sourcePath, size, 1.0)
		}
		return nil, fmt.Errorf("ffmpeg produced no output after trying multiple time offsets")
	}

	// Check if the image is likely to be all black (very small size indicates this)
	if len(webpData) < 500 {
		// Very small WebP files are likely black frames, try a different offset
		if timeOffset > 30 {
			return vp.GeneratePoster(ctx, sourcePath, size, 30.0)
		} else if timeOffset > 10 {
			return vp.GeneratePoster(ctx, sourcePath, size, 10.0)
		} else if timeOffset > 1 {
			return vp.GeneratePoster(ctx, sourcePath, size, 1.0)
		}
	}

	return webpData, nil
}

// GenerateAnimatedPreview creates an animated WebP preview (like a GIF but better)
func (vp *VideoProcessor) GenerateAnimatedPreview(ctx context.Context, sourcePath string, size PreviewSize) ([]byte, error) {
	// Get size configuration
	sizeConfig := GetSizeConfig(size)

	// Build ffmpeg command for animated WebP
	// Extract 3 seconds at 10 fps for a small animated preview
	args := []string{
		"-i", sourcePath,
		"-ss", fmt.Sprintf("%.2f", vp.defaultOffset), // Start from offset
		"-t", "3", // Duration of 3 seconds
		"-vf", fmt.Sprintf("fps=10,scale='min(%d,iw)':min'(%d,ih)':force_original_aspect_ratio=decrease",
			sizeConfig.MaxWidth, sizeConfig.MaxHeight),
		"-loop", "0", // Infinite loop
		"-c:v", "libwebp", // WebP codec
		"-quality", strconv.Itoa(ImagePreviewQuality), // Quality setting
		"-preset", "default", // Default preset for animated
		"-f", "webp",
		"pipe:1", // Output to stdout
	}

	cmd := exec.CommandContext(ctx, vp.ffmpegPath, args...)

	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr

	if err := cmd.Run(); err != nil {
		if ctx.Err() == context.DeadlineExceeded {
			return nil, fmt.Errorf("animated preview generation timeout")
		}
		return nil, fmt.Errorf("ffmpeg failed for animated preview: %w", err)
	}

	return stdout.Bytes(), nil
}

// getVideoDuration gets the duration of a video in seconds
func (vp *VideoProcessor) getVideoDuration(ctx context.Context, sourcePath string) (float64, error) {
	// Use ffprobe to get duration
	ffprobePath := strings.Replace(vp.ffmpegPath, "ffmpeg", "ffprobe", 1)

	args := []string{
		"-v", "error",
		"-show_entries", "format=duration",
		"-of", "default=noprint_wrappers=1:nokey=1",
		sourcePath,
	}

	cmd := exec.CommandContext(ctx, ffprobePath, args...)
	output, err := cmd.Output()
	if err != nil {
		return 0, fmt.Errorf("failed to get video duration: %w", err)
	}

	duration, err := strconv.ParseFloat(strings.TrimSpace(string(output)), 64)
	if err != nil {
		return 0, fmt.Errorf("failed to parse duration: %w", err)
	}

	return duration, nil
}

// CanProcess checks if a file can be processed as a video
func (vp *VideoProcessor) CanProcess(mimeType string) bool {
	// List of video MIME types we can process
	supportedTypes := []string{
		"video/mp4",
		"video/mpeg",
		"video/quicktime",
		"video/x-msvideo",  // AVI
		"video/x-matroska", // MKV
		"video/webm",
		"video/ogg",
		"video/mp2t", // MPEG transport stream
		"video/3gpp",
		"video/3gpp2",
		"video/x-flv",
		"video/x-m4v",
		"video/x-ms-wmv",
		"video/x-ms-asf",
	}

	for _, supported := range supportedTypes {
		if strings.EqualFold(mimeType, supported) {
			return true
		}
	}

	return false
}

// GetVideoInfo extracts basic video information
func (vp *VideoProcessor) GetVideoInfo(ctx context.Context, sourcePath string) (width, height int, fps float64, err error) {
	ffprobePath := strings.Replace(vp.ffmpegPath, "ffmpeg", "ffprobe", 1)

	// Get video stream information
	args := []string{
		"-v", "error",
		"-select_streams", "v:0",
		"-show_entries", "stream=width,height,r_frame_rate",
		"-of", "csv=p=0",
		sourcePath,
	}

	cmd := exec.CommandContext(ctx, ffprobePath, args...)
	output, err := cmd.Output()
	if err != nil {
		return 0, 0, 0, fmt.Errorf("failed to get video info: %w", err)
	}

	// Parse output: width,height,fps_num/fps_den
	parts := strings.Split(strings.TrimSpace(string(output)), ",")
	if len(parts) < 3 {
		return 0, 0, 0, fmt.Errorf("unexpected ffprobe output format")
	}

	width, _ = strconv.Atoi(parts[0])
	height, _ = strconv.Atoi(parts[1])

	// Parse frame rate (might be in format like "30000/1001")
	fpsStr := parts[2]
	if strings.Contains(fpsStr, "/") {
		fpsParts := strings.Split(fpsStr, "/")
		if len(fpsParts) == 2 {
			num, _ := strconv.ParseFloat(fpsParts[0], 64)
			den, _ := strconv.ParseFloat(fpsParts[1], 64)
			if den > 0 {
				fps = num / den
			}
		}
	} else {
		fps, _ = strconv.ParseFloat(fpsStr, 64)
	}

	return width, height, fps, nil
}

// IsFFmpegAvailable checks if ffmpeg is available on the system
func IsFFmpegAvailable() bool {
	for _, cmd := range []string{"ffmpeg", "/usr/bin/ffmpeg", "/usr/local/bin/ffmpeg"} {
		if _, err := exec.LookPath(cmd); err == nil {
			return true
		}
	}
	return false
}
