package previews

import (
	"context"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestNewService(t *testing.T) {
	tests := []struct {
		name    string
		config  *PreviewConfig
		wantErr bool
	}{
		{
			name: "valid config",
			config: &PreviewConfig{
				RootDir:         t.TempDir(),
				MaxConcurrent:   2,
				ProcessTimeout:  30 * time.Second,
				MaxSourceSizeMB: 500,
				VipsPath:        "nonexistent", // Will fail but should not error
				FFmpegPath:      "nonexistent", // Will fail but should not error
				SmartCrop:       true,
			},
			wantErr: false,
		},
		{
			name: "invalid root dir",
			config: &PreviewConfig{
				RootDir: "/invalid/path/that/cannot/be/created",
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			service, err := NewService(tt.config)
			if tt.wantErr {
				assert.Error(t, err)
				assert.Nil(t, service)
			} else {
				assert.NoError(t, err)
				assert.NotNil(t, service)
			}
		})
	}
}

func TestService_ValidateRequest(t *testing.T) {
	config := &PreviewConfig{
		RootDir:         t.TempDir(),
		MaxConcurrent:   2,
		ProcessTimeout:  30 * time.Second,
		MaxSourceSizeMB: 500,
	}
	service, err := NewService(config)
	require.NoError(t, err)

	tests := []struct {
		name    string
		req     *PreviewRequest
		wantErr bool
	}{
		{
			name: "valid request",
			req: &PreviewRequest{
				FileID:   1,
				FilePath: "/test/file.jpg",
				FileHash: "abcdef123456",
				Type:     PreviewTypeThumbnail,
				Size:     PreviewSizeMedium,
			},
			wantErr: false,
		},
		{
			name: "empty file path",
			req: &PreviewRequest{
				Type: PreviewTypeThumbnail,
				Size: PreviewSizeMedium,
			},
			wantErr: true,
		},
		{
			name: "empty type",
			req: &PreviewRequest{
				FilePath: "/test/file.jpg",
				Size:     PreviewSizeMedium,
			},
			wantErr: true,
		},
		{
			name: "empty size defaults to medium",
			req: &PreviewRequest{
				FilePath: "/test/file.jpg",
				Type:     PreviewTypeThumbnail,
			},
			wantErr: false,
		},
		{
			name: "invalid size",
			req: &PreviewRequest{
				FilePath: "/test/file.jpg",
				Type:     PreviewTypeThumbnail,
				Size:     "invalid",
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := service.validateRequest(tt.req)
			if tt.wantErr {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)
				// Check that empty size defaults to medium
				if tt.req.Size == "" {
					assert.Equal(t, PreviewSizeMedium, tt.req.Size)
				}
			}
		})
	}
}

func TestService_CalculateFileHash(t *testing.T) {
	config := &PreviewConfig{
		RootDir: t.TempDir(),
	}
	service, err := NewService(config)
	require.NoError(t, err)

	// Create a test file
	tempFile := filepath.Join(t.TempDir(), "test.txt")
	content := "test content for hashing"
	err = os.WriteFile(tempFile, []byte(content), 0644)
	require.NoError(t, err)

	hash, err := service.calculateFileHash(tempFile)
	assert.NoError(t, err)
	assert.NotEmpty(t, hash)
	assert.Len(t, hash, 64) // SHA256 hex string is 64 characters

	// Test with non-existent file
	_, err = service.calculateFileHash("/nonexistent/file")
	assert.Error(t, err)
}

func TestService_CanGeneratePreview(t *testing.T) {
	config := &PreviewConfig{
		RootDir: t.TempDir(),
	}
	service, err := NewService(config)
	require.NoError(t, err)

	// The processor constructors fall back to searching $PATH for ffmpeg/vips
	// when no explicit path is configured (see NewVideoProcessor/NewAudioProcessor/
	// NewImageProcessor), so whether video/audio/image preview support is available
	// depends on what's actually installed on the machine running this test —
	// it is not guaranteed to be false. Assert consistently with what the
	// service itself detected, rather than assuming a specific environment.
	tests := []struct {
		name         string
		mimeType     string
		wantSameAsProcessor func() bool
	}{
		{"image/jpeg", "image/jpeg", func() bool { return service.imageProcessor != nil }},
		{"image/png", "image/png", func() bool { return service.imageProcessor != nil }},
		{"video/mp4", "video/mp4", func() bool { return service.videoProcessor != nil }},
		{"audio/mp3", "audio/mp3", func() bool { return service.audioProcessor != nil }},
		{"text/plain", "text/plain", func() bool { return false }},
		{"application/pdf", "application/pdf", func() bool { return false }},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := service.CanGeneratePreview(tt.mimeType)
			assert.Equal(t, tt.wantSameAsProcessor(), got)
		})
	}
}

func TestService_GetSupportedTypes(t *testing.T) {
	config := &PreviewConfig{
		RootDir: t.TempDir(),
	}
	service, err := NewService(config)
	require.NoError(t, err)

	supported := service.GetSupportedTypes()

	// Whether any type is supported depends on which of ffmpeg/vips are
	// actually installed on the machine running this test (the processor
	// constructors search $PATH as a fallback) — assert consistently with
	// what the service itself detected rather than assuming an empty result.
	if service.imageProcessor == nil && service.videoProcessor == nil && service.audioProcessor == nil {
		assert.Empty(t, supported)
		return
	}
	if service.imageProcessor != nil {
		assert.Contains(t, supported, "image")
	}
	if service.videoProcessor != nil {
		assert.Contains(t, supported, "video")
	}
	if service.audioProcessor != nil {
		assert.Contains(t, supported, "audio")
	}
}

func TestService_GetStats(t *testing.T) {
	config := &PreviewConfig{
		RootDir: t.TempDir(),
	}
	service, err := NewService(config)
	require.NoError(t, err)

	stats := service.GetStats()
	assert.Equal(t, int64(0), stats.TotalGenerated)
	assert.Equal(t, int64(0), stats.TotalSizeBytes)
	assert.Equal(t, int64(0), stats.CacheHits)
	assert.Equal(t, int64(0), stats.CacheMisses)
	assert.Equal(t, 0, stats.ActiveGenerators)
}

func TestService_BuildMetadata(t *testing.T) {
	config := &PreviewConfig{
		RootDir: t.TempDir(),
	}
	service, err := NewService(config)
	require.NoError(t, err)

	req := &PreviewRequest{
		FileID:     123,
		FilePath:   "/test/file.jpg",
		Type:       PreviewTypeThumbnail,
		Size:       PreviewSizeMedium,
		TimeOffset: 5.0,
	}

	startTime := time.Now()
	time.Sleep(10 * time.Millisecond) // Small delay to ensure processing time > 0

	metadata := service.buildMetadata(req, "storage/key", "contenthash", startTime, false)

	assert.Equal(t, int64(123), metadata.FileID)
	assert.Equal(t, PreviewTypeThumbnail, metadata.Type)
	assert.Equal(t, PreviewSizeMedium, metadata.Size)
	assert.Equal(t, ImagePreviewFormat, metadata.Format)
	assert.Equal(t, "storage/key", metadata.StoragePath)
	assert.Equal(t, "contenthash", metadata.ContentHash)
	assert.Equal(t, 5.0, metadata.TimeOffset)
	assert.Greater(t, metadata.ProcessingMS, int64(0))
	assert.False(t, metadata.CreatedAt.IsZero())
	assert.False(t, metadata.AccessedAt.IsZero())

	// Test cache hit
	metadata2 := service.buildMetadata(req, "storage/key", "contenthash", startTime, true)
	assert.Equal(t, int64(0), metadata2.ProcessingMS)
}

func TestGeneratePreview_InvalidFile(t *testing.T) {
	config := &PreviewConfig{
		RootDir:         t.TempDir(),
		MaxConcurrent:   1,
		ProcessTimeout:  5 * time.Second,
		MaxSourceSizeMB: 1, // 1MB limit
	}
	service, err := NewService(config)
	require.NoError(t, err)

	ctx := context.Background()

	// Test with non-existent file
	req := &PreviewRequest{
		FileID:   1,
		FilePath: "/nonexistent/file.jpg",
		Type:     PreviewTypeThumbnail,
		Size:     PreviewSizeMedium,
	}

	result, err := service.GeneratePreview(ctx, req, "image/jpeg")
	assert.Error(t, err)
	assert.Nil(t, result)
	assert.Contains(t, err.Error(), "source file not accessible")
}

func TestGeneratePreview_FileTooLarge(t *testing.T) {
	config := &PreviewConfig{
		RootDir:         t.TempDir(),
		MaxConcurrent:   1,
		ProcessTimeout:  5 * time.Second,
		MaxSourceSizeMB: 1, // 1MB limit
	}
	service, err := NewService(config)
	require.NoError(t, err)

	ctx := context.Background()

	// Create a file larger than the limit
	tempFile := filepath.Join(t.TempDir(), "large.jpg")
	largeContent := strings.Repeat("x", 2*1024*1024) // 2MB
	err = os.WriteFile(tempFile, []byte(largeContent), 0644)
	require.NoError(t, err)

	req := &PreviewRequest{
		FileID:   1,
		FilePath: tempFile,
		Type:     PreviewTypeThumbnail,
		Size:     PreviewSizeMedium,
	}

	result, err := service.GeneratePreview(ctx, req, "image/jpeg")
	assert.Error(t, err)
	assert.Nil(t, result)
	assert.Contains(t, err.Error(), "source file too large")
}

func TestGeneratePreview_UnsupportedType(t *testing.T) {
	config := &PreviewConfig{
		RootDir:         t.TempDir(),
		MaxConcurrent:   1,
		ProcessTimeout:  5 * time.Second,
		MaxSourceSizeMB: 500,
	}
	service, err := NewService(config)
	require.NoError(t, err)

	ctx := context.Background()

	// Create a small test file
	tempFile := filepath.Join(t.TempDir(), "test.txt")
	err = os.WriteFile(tempFile, []byte("test"), 0644)
	require.NoError(t, err)

	req := &PreviewRequest{
		FileID:   1,
		FilePath: tempFile,
		Type:     PreviewTypeThumbnail,
		Size:     PreviewSizeMedium,
	}

	result, err := service.GeneratePreview(ctx, req, "image/jpeg")
	assert.Error(t, err)
	assert.NotNil(t, result)
	assert.Contains(t, err.Error(), "image processor not available")
}

func TestService_CleanupLoop(t *testing.T) {
	config := &PreviewConfig{
		RootDir:         t.TempDir(),
		CleanupEnabled:  true,
		CleanupInterval: 100 * time.Millisecond,
		MaxAge:          1 * time.Second,
	}
	service, err := NewService(config)
	require.NoError(t, err)

	// The cleanup loop runs in a goroutine, just verify it doesn't panic
	time.Sleep(200 * time.Millisecond)

	// Get stats to ensure service is still functional
	stats := service.GetStats()
	assert.NotNil(t, stats)
}
