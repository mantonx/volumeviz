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

// ImageProcessor handles image thumbnail generation using libvips
type ImageProcessor struct {
	vipsPath  string
	smartCrop bool
}

// NewImageProcessor creates a new image processor
func NewImageProcessor(vipsPath string, smartCrop bool) (*ImageProcessor, error) {
	// Check if vips is available
	if _, err := exec.LookPath(vipsPath); err != nil {
		// Try common vips command names
		for _, cmd := range []string{"vips", "vipsthumbnail"} {
			if path, err := exec.LookPath(cmd); err == nil {
				vipsPath = path
				break
			}
		}
	}

	// Verify vips works
	cmd := exec.Command(vipsPath, "--version")
	if err := cmd.Run(); err != nil {
		return nil, fmt.Errorf("vips not available: %w", err)
	}

	return &ImageProcessor{
		vipsPath:  vipsPath,
		smartCrop: smartCrop,
	}, nil
}

// GenerateThumbnail creates a WebP thumbnail from an image file
func (ip *ImageProcessor) GenerateThumbnail(ctx context.Context, sourcePath string, size PreviewSize) ([]byte, error) {
	// Get size configuration
	sizeConfig := GetSizeConfig(size)

	// Check if source file exists and is readable
	info, err := os.Stat(sourcePath)
	if err != nil {
		return nil, fmt.Errorf("source file not accessible: %w", err)
	}

	// Check file size limit (500MB default)
	maxSize := int64(500 * 1024 * 1024)
	if info.Size() > maxSize {
		return nil, fmt.Errorf("source file too large: %d bytes (max %d)", info.Size(), maxSize)
	}

	// Use vipsthumbnail for efficient thumbnail generation
	// vipsthumbnail is optimized for thumbnails and handles many formats
	// Create a temporary output file since vipsthumbnail doesn't support stdout well
	tempFile := filepath.Join(os.TempDir(), fmt.Sprintf("thumb_%d.webp", time.Now().UnixNano()))
	defer os.Remove(tempFile)
	
	args := []string{
		sourcePath,
		"-s", fmt.Sprintf("%d", sizeConfig.MaxWidth), // Just width, height will be proportional
		"-o", tempFile + "[Q=" + strconv.Itoa(ImagePreviewQuality) + ",strip]", // Output to temp file with WebP options
	}

	// Add smart crop if enabled
	if ip.smartCrop {
		args = append(args, "--smartcrop", "attention")
	}

	// Create command with context for timeout
	// Use vipsthumbnail command (vips has vipsthumbnail as a separate command)
	vipsThumbnailCmd := "vipsthumbnail"
	if _, err := exec.LookPath(vipsThumbnailCmd); err != nil {
		// Try with vips thumbnail subcommand
		vipsThumbnailCmd = ip.vipsPath
		args = append([]string{"thumbnail"}, args...)
	}
	cmd := exec.CommandContext(ctx, vipsThumbnailCmd, args...)

	// Capture output
	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr

	// Run the command
	err = cmd.Run()
	if err != nil {
		if ctx.Err() == context.DeadlineExceeded {
			return nil, fmt.Errorf("thumbnail generation timeout")
		}
		return nil, fmt.Errorf("vipsthumbnail failed: %w (stderr: %s)", err, stderr.String())
	}

	// Read the generated WebP file
	webpData, err := os.ReadFile(tempFile)
	if err != nil {
		return nil, fmt.Errorf("failed to read generated thumbnail: %w", err)
	}
	
	if len(webpData) == 0 {
		return nil, fmt.Errorf("vipsthumbnail produced empty output")
	}

	return webpData, nil
}

// GenerateThumbnailWithVips uses vips CLI directly for more control
func (ip *ImageProcessor) GenerateThumbnailWithVips(ctx context.Context, sourcePath string, size PreviewSize) ([]byte, error) {
	// Get size configuration
	sizeConfig := GetSizeConfig(size)

	// Create a temporary output file for WebP
	tempFile := filepath.Join(os.TempDir(), fmt.Sprintf("preview_%d.webp", time.Now().UnixNano()))
	defer os.Remove(tempFile) // Clean up temp file

	// Build vips command
	// vips thumbnail input.jpg output.webp 512 --height 512 --size down
	args := []string{
		"thumbnail",
		sourcePath,
		tempFile,
		strconv.Itoa(sizeConfig.MaxWidth),
		"--height", strconv.Itoa(sizeConfig.MaxHeight),
		"--size", "down", // Only downscale
	}

	// Add WebP-specific options
	args = append(args,
		"--export-profile", "srgb", // Ensure sRGB color space
		"--intent", "perceptual", // Best for photos
	)

	if ip.smartCrop {
		args = append(args, "--smartcrop", "attention")
	}

	// Create command with context
	cmd := exec.CommandContext(ctx, ip.vipsPath, args...)

	// Capture stderr for debugging
	var stderr bytes.Buffer
	cmd.Stderr = &stderr

	// Run the command
	if err := cmd.Run(); err != nil {
		if ctx.Err() == context.DeadlineExceeded {
			return nil, fmt.Errorf("thumbnail generation timeout")
		}
		return nil, fmt.Errorf("vips failed: %w (stderr: %s)", err, stderr.String())
	}

	// Now convert to WebP with specific quality settings
	webpArgs := []string{
		"webpsave",
		tempFile,
		tempFile + ".webp",
		"--Q", strconv.Itoa(ImagePreviewQuality),
		"--strip", // Remove metadata
	}

	if !ImagePreviewLossless {
		webpArgs = append(webpArgs, "--lossless=false")
	}

	cmd = exec.CommandContext(ctx, ip.vipsPath, webpArgs...)
	cmd.Stderr = &stderr

	if err := cmd.Run(); err != nil {
		return nil, fmt.Errorf("webp conversion failed: %w (stderr: %s)", err, stderr.String())
	}

	// Read the WebP file
	webpData, err := os.ReadFile(tempFile + ".webp")
	if err != nil {
		return nil, fmt.Errorf("failed to read webp output: %w", err)
	}

	// Clean up WebP temp file
	os.Remove(tempFile + ".webp")

	return webpData, nil
}

// CanProcess checks if a file can be processed as an image
func (ip *ImageProcessor) CanProcess(mimeType string) bool {
	// List of image MIME types we can process
	supportedTypes := []string{
		"image/jpeg",
		"image/jpg",
		"image/png",
		"image/gif",
		"image/webp",
		"image/tiff",
		"image/bmp",
		"image/svg+xml",
		"image/heic",
		"image/heif",
		"image/avif",
		"image/jxl", // JPEG XL
	}

	for _, supported := range supportedTypes {
		if strings.EqualFold(mimeType, supported) {
			return true
		}
	}

	return false
}

// GetImageInfo extracts basic image information using vips
func (ip *ImageProcessor) GetImageInfo(sourcePath string) (width, height int, err error) {
	// Use vips to get image header information
	cmd := exec.Command(ip.vipsPath, "header", "-f", "width", sourcePath)
	output, err := cmd.Output()
	if err != nil {
		return 0, 0, fmt.Errorf("failed to get image width: %w", err)
	}

	width, err = strconv.Atoi(strings.TrimSpace(string(output)))
	if err != nil {
		return 0, 0, fmt.Errorf("failed to parse width: %w", err)
	}

	cmd = exec.Command(ip.vipsPath, "header", "-f", "height", sourcePath)
	output, err = cmd.Output()
	if err != nil {
		return 0, 0, fmt.Errorf("failed to get image height: %w", err)
	}

	height, err = strconv.Atoi(strings.TrimSpace(string(output)))
	if err != nil {
		return 0, 0, fmt.Errorf("failed to parse height: %w", err)
	}

	return width, height, nil
}

// IsVipsAvailable checks if vips is available on the system
func IsVipsAvailable() bool {
	for _, cmd := range []string{"vips", "vipsthumbnail"} {
		if _, err := exec.LookPath(cmd); err == nil {
			return true
		}
	}
	return false
}
