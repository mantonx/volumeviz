package previews

import (
	"bytes"
	"context"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"
)

// AudioProcessor handles audio cover art extraction using ffmpeg
type AudioProcessor struct {
	ffmpegPath    string
	fallbackImage string // Path to fallback image when no cover art exists
}

// NewAudioProcessor creates a new audio processor
func NewAudioProcessor(ffmpegPath string, fallbackImage string) (*AudioProcessor, error) {
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

	return &AudioProcessor{
		ffmpegPath:    ffmpegPath,
		fallbackImage: fallbackImage,
	}, nil
}

// ExtractCoverArt extracts embedded cover art from audio files and converts to WebP
func (ap *AudioProcessor) ExtractCoverArt(ctx context.Context, sourcePath string, size PreviewSize) ([]byte, error) {
	// Get size configuration
	sizeConfig := GetSizeConfig(size)

	// Check if source file exists
	_, err := os.Stat(sourcePath)
	if err != nil {
		return nil, fmt.Errorf("source file not accessible: %w", err)
	}

	// No size limit for audio files - ffmpeg can efficiently extract cover art
	// without loading the entire file into memory

	// First, try to extract embedded cover art
	coverData, err := ap.extractEmbeddedArt(ctx, sourcePath, sizeConfig)
	if err == nil && len(coverData) > 0 {
		return coverData, nil
	}

	// If no embedded art and we have a fallback image, use that
	if ap.fallbackImage != "" {
		if _, err := os.Stat(ap.fallbackImage); err == nil {
			return ap.processFallbackImage(ctx, ap.fallbackImage, sizeConfig)
		}
	}

	// Try to generate a waveform visualization as a last resort
	return ap.generateWaveform(ctx, sourcePath, sizeConfig)
}

// extractEmbeddedArt attempts to extract embedded album art
func (ap *AudioProcessor) extractEmbeddedArt(ctx context.Context, sourcePath string, sizeConfig SizeConfig) ([]byte, error) {
	// Use ffmpeg to extract cover art and convert to WebP in one pass
	// The video stream in audio files is usually the cover art
	args := []string{
		"-i", sourcePath,
		"-an",                // Disable audio
		"-vcodec", "libwebp", // Convert to WebP
		"-vf", fmt.Sprintf("scale='min(%d,iw)':min'(%d,ih)':force_original_aspect_ratio=decrease",
			sizeConfig.MaxWidth, sizeConfig.MaxHeight),
		"-quality", fmt.Sprintf("%d", ImagePreviewQuality),
		"-preset", "photo",
		"-f", "webp",
		"pipe:1", // Output to stdout
	}

	cmd := exec.CommandContext(ctx, ap.ffmpegPath, args...)

	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr

	err := cmd.Run()
	if err != nil {
		// Check if there's no video stream (no cover art)
		if strings.Contains(stderr.String(), "does not contain any stream") ||
			strings.Contains(stderr.String(), "Output file is empty") {
			return nil, fmt.Errorf("no cover art found")
		}
		return nil, fmt.Errorf("failed to extract cover art: %w", err)
	}

	webpData := stdout.Bytes()
	if len(webpData) == 0 {
		return nil, fmt.Errorf("no cover art data extracted")
	}

	return webpData, nil
}

// processFallbackImage processes a fallback image to WebP
func (ap *AudioProcessor) processFallbackImage(ctx context.Context, imagePath string, sizeConfig SizeConfig) ([]byte, error) {
	// Use ffmpeg to resize and convert fallback image to WebP
	args := []string{
		"-i", imagePath,
		"-vf", fmt.Sprintf("scale='min(%d,iw)':min'(%d,ih)':force_original_aspect_ratio=decrease",
			sizeConfig.MaxWidth, sizeConfig.MaxHeight),
		"-c:v", "libwebp",
		"-quality", fmt.Sprintf("%d", ImagePreviewQuality),
		"-preset", "photo",
		"-f", "webp",
		"pipe:1",
	}

	cmd := exec.CommandContext(ctx, ap.ffmpegPath, args...)

	var stdout bytes.Buffer
	cmd.Stdout = &stdout

	if err := cmd.Run(); err != nil {
		return nil, fmt.Errorf("failed to process fallback image: %w", err)
	}

	return stdout.Bytes(), nil
}

// generateWaveform generates a waveform visualization as WebP
func (ap *AudioProcessor) generateWaveform(ctx context.Context, sourcePath string, sizeConfig SizeConfig) ([]byte, error) {
	// Create a simple waveform visualization using ffmpeg's showwavespic filter
	// This creates a static image of the audio waveform

	// Create temporary file for the waveform image
	tempFile := filepath.Join(os.TempDir(), fmt.Sprintf("waveform_%d.png", time.Now().UnixNano()))
	defer os.Remove(tempFile)

	// Generate waveform with ffmpeg
	waveformArgs := []string{
		"-i", sourcePath,
		"-filter_complex",
		fmt.Sprintf("[0:a]showwavespic=s=%dx%d:colors=white|white:split_channels=1",
			sizeConfig.MaxWidth, sizeConfig.MaxHeight),
		"-frames:v", "1",
		"-f", "image2",
		tempFile,
	}

	cmd := exec.CommandContext(ctx, ap.ffmpegPath, waveformArgs...)

	var stderr bytes.Buffer
	cmd.Stderr = &stderr

	if err := cmd.Run(); err != nil {
		// If waveform generation fails, return error
		return nil, fmt.Errorf("failed to generate waveform: %w (stderr: %s)", err, stderr.String())
	}

	// Now convert the waveform PNG to WebP
	convertArgs := []string{
		"-i", tempFile,
		"-c:v", "libwebp",
		"-quality", fmt.Sprintf("%d", ImagePreviewQuality),
		"-preset", "picture", // Good for graphics
		"-f", "webp",
		"pipe:1",
	}

	cmd = exec.CommandContext(ctx, ap.ffmpegPath, convertArgs...)

	var stdout bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr

	if err := cmd.Run(); err != nil {
		return nil, fmt.Errorf("failed to convert waveform to WebP: %w", err)
	}

	return stdout.Bytes(), nil
}

// GetAudioMetadata extracts basic audio metadata
func (ap *AudioProcessor) GetAudioMetadata(ctx context.Context, sourcePath string) (map[string]string, error) {
	ffprobePath := strings.Replace(ap.ffmpegPath, "ffmpeg", "ffprobe", 1)

	// Extract metadata tags
	args := []string{
		"-v", "error",
		"-show_entries", "format_tags",
		"-of", "json",
		sourcePath,
	}

	cmd := exec.CommandContext(ctx, ffprobePath, args...)
	output, err := cmd.Output()
	if err != nil {
		return nil, fmt.Errorf("failed to get audio metadata: %w", err)
	}

	// Parse JSON output - simplified for now
	// In production, properly unmarshal JSON
	metadata := make(map[string]string)

	// Extract common tags
	lines := strings.Split(string(output), "\n")
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if strings.Contains(line, "\"title\"") {
			parts := strings.Split(line, ":")
			if len(parts) > 1 {
				title := strings.Trim(parts[1], " \",")
				metadata["title"] = title
			}
		}
		if strings.Contains(line, "\"artist\"") {
			parts := strings.Split(line, ":")
			if len(parts) > 1 {
				artist := strings.Trim(parts[1], " \",")
				metadata["artist"] = artist
			}
		}
		if strings.Contains(line, "\"album\"") {
			parts := strings.Split(line, ":")
			if len(parts) > 1 {
				album := strings.Trim(parts[1], " \",")
				metadata["album"] = album
			}
		}
	}

	return metadata, nil
}

// CanProcess checks if a file can be processed as audio
func (ap *AudioProcessor) CanProcess(mimeType string) bool {
	// List of audio MIME types we can process
	supportedTypes := []string{
		"audio/mpeg", // MP3
		"audio/mp3",
		"audio/mp4", // M4A, AAC
		"audio/x-m4a",
		"audio/aac",
		"audio/ogg", // OGG Vorbis
		"audio/vorbis",
		"audio/opus", // Opus
		"audio/flac", // FLAC
		"audio/x-flac",
		"audio/wav", // WAV
		"audio/x-wav",
		"audio/webm",     // WebM audio
		"audio/x-ms-wma", // WMA
		"audio/x-aiff",   // AIFF
		"audio/aiff",
		"audio/ape", // Monkey's Audio
		"audio/x-ape",
		"audio/wavpack", // WavPack
		"audio/x-wavpack",
	}

	for _, supported := range supportedTypes {
		if strings.EqualFold(mimeType, supported) {
			return true
		}
	}

	return false
}

// GenerateAudioPreview creates a visual representation for audio files
// This is the main entry point that tries different methods
func (ap *AudioProcessor) GenerateAudioPreview(ctx context.Context, sourcePath string, size PreviewSize) ([]byte, error) {
	// Try methods in order of preference:
	// 1. Extract embedded cover art
	// 2. Use fallback image if configured
	// 3. Generate waveform visualization

	return ap.ExtractCoverArt(ctx, sourcePath, size)
}
