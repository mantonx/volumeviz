package previews

import (
	"context"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestNewImageProcessor(t *testing.T) {
	tests := []struct {
		name      string
		vipsPath  string
		smartCrop bool
		wantErr   bool
	}{
		{
			name:      "nonexistent vips path",
			vipsPath:  "nonexistent-vips-command",
			smartCrop: false,
			wantErr:   true,
		},
		{
			name:      "empty vips path",
			vipsPath:  "",
			smartCrop: true,
			wantErr:   true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			processor, err := NewImageProcessor(tt.vipsPath, tt.smartCrop)
			if tt.wantErr {
				assert.Error(t, err)
				assert.Nil(t, processor)
			} else {
				assert.NoError(t, err)
				assert.NotNil(t, processor)
				assert.Equal(t, tt.vipsPath, processor.vipsPath)
				assert.Equal(t, tt.smartCrop, processor.smartCrop)
			}
		})
	}
}

func TestImageProcessor_CanProcess(t *testing.T) {
	// Create processor with dummy path (won't be used for CanProcess test)
	processor := &ImageProcessor{
		vipsPath:  "vips",
		smartCrop: false,
	}

	tests := []struct {
		name     string
		mimeType string
		want     bool
	}{
		{"jpeg", "image/jpeg", true},
		{"jpg", "image/jpg", true},
		{"png", "image/png", true},
		{"gif", "image/gif", true},
		{"webp", "image/webp", true},
		{"tiff", "image/tiff", true},
		{"bmp", "image/bmp", true},
		{"svg", "image/svg+xml", true},
		{"heic", "image/heic", true},
		{"heif", "image/heif", true},
		{"avif", "image/avif", true},
		{"jxl", "image/jxl", true},
		{"case insensitive", "IMAGE/JPEG", true},
		{"video", "video/mp4", false},
		{"audio", "audio/mp3", false},
		{"text", "text/plain", false},
		{"pdf", "application/pdf", false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := processor.CanProcess(tt.mimeType)
			assert.Equal(t, tt.want, got)
		})
	}
}

func TestImageProcessor_GenerateThumbnail_InvalidFile(t *testing.T) {
	processor := &ImageProcessor{
		vipsPath:  "nonexistent-vips",
		smartCrop: false,
	}

	ctx := context.Background()

	tests := []struct {
		name       string
		sourcePath string
		size       PreviewSize
		wantErr    bool
		errContains string
	}{
		{
			name:        "nonexistent file",
			sourcePath:  "/nonexistent/file.jpg",
			size:        PreviewSizeMedium,
			wantErr:     true,
			errContains: "source file not accessible",
		},
		{
			name:        "file too large",
			sourcePath:  createLargeFile(t),
			size:        PreviewSizeMedium,
			wantErr:     true,
			errContains: "source file too large",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := processor.GenerateThumbnail(ctx, tt.sourcePath, tt.size)
			if tt.wantErr {
				assert.Error(t, err)
				if tt.errContains != "" {
					assert.Contains(t, err.Error(), tt.errContains)
				}
			} else {
				assert.NoError(t, err)
			}
		})
	}
}

func TestImageProcessor_GenerateThumbnail_VipsNotAvailable(t *testing.T) {
	processor := &ImageProcessor{
		vipsPath:  "nonexistent-vips-command",
		smartCrop: false,
	}

	ctx := context.Background()

	// Create a small test file
	tempFile := filepath.Join(t.TempDir(), "test.jpg")
	testData := []byte("fake image data")
	err := os.WriteFile(tempFile, testData, 0644)
	require.NoError(t, err)

	_, err = processor.GenerateThumbnail(ctx, tempFile, PreviewSizeMedium)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "vipsthumbnail failed")
}

func TestImageProcessor_GenerateThumbnail_Timeout(t *testing.T) {
	processor := &ImageProcessor{
		vipsPath:  "sleep", // Use sleep command to simulate timeout
		smartCrop: false,
	}

	// Create a context with very short timeout
	ctx, cancel := context.WithTimeout(context.Background(), 1*time.Millisecond)
	defer cancel()

	// Create a small test file
	tempFile := filepath.Join(t.TempDir(), "test.jpg")
	testData := []byte("fake image data")
	err := os.WriteFile(tempFile, testData, 0644)
	require.NoError(t, err)

	_, err = processor.GenerateThumbnail(ctx, tempFile, PreviewSizeMedium)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "thumbnail generation timeout")
}

func TestImageProcessor_GetImageInfo_InvalidCommand(t *testing.T) {
	processor := &ImageProcessor{
		vipsPath:  "nonexistent-vips-command",
		smartCrop: false,
	}

	// Create a small test file
	tempFile := filepath.Join(t.TempDir(), "test.jpg")
	testData := []byte("fake image data")
	err := os.WriteFile(tempFile, testData, 0644)
	require.NoError(t, err)

	width, height, err := processor.GetImageInfo(tempFile)
	assert.Error(t, err)
	assert.Equal(t, 0, width)
	assert.Equal(t, 0, height)
	assert.Contains(t, err.Error(), "failed to get image width")
}

func TestIsVipsAvailable(t *testing.T) {
	// This test depends on the system environment
	// In most test environments, vips won't be available
	available := IsVipsAvailable()
	assert.False(t, available) // Expected in test environment
}

func TestGetSizeConfig(t *testing.T) {
	tests := []struct {
		name         string
		size         PreviewSize
		expectedWidth int
		expectedHeight int
	}{
		{
			name:           "small",
			size:           PreviewSizeSmall,
			expectedWidth:  256,
			expectedHeight: 256,
		},
		{
			name:           "medium",
			size:           PreviewSizeMedium,
			expectedWidth:  512,
			expectedHeight: 512,
		},
		{
			name:           "large",
			size:           PreviewSizeLarge,
			expectedWidth:  1024,
			expectedHeight: 1024,
		},
		{
			name:           "invalid defaults to medium",
			size:           "invalid",
			expectedWidth:  512,
			expectedHeight: 512,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			config := GetSizeConfig(tt.size)
			assert.Equal(t, tt.expectedWidth, config.MaxWidth)
			assert.Equal(t, tt.expectedHeight, config.MaxHeight)
			assert.False(t, config.Crop) // All configs should have Crop=false
		})
	}
}

// Helper function to create a large file for testing
func createLargeFile(t *testing.T) string {
	tempFile := filepath.Join(t.TempDir(), "large.jpg")
	
	// Create file larger than 500MB limit
	file, err := os.Create(tempFile)
	require.NoError(t, err)
	defer file.Close()

	// Write 501MB of data
	largeSize := int64(501 * 1024 * 1024)
	err = file.Truncate(largeSize)
	require.NoError(t, err)

	return tempFile
}