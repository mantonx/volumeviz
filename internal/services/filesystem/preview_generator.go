package filesystem

import (
	"context"
	"fmt"
	"os"
	"strings"
	"time"

	"github.com/mantonx/volumeviz/internal/models"
	"github.com/mantonx/volumeviz/internal/services/previews"
)

// PreviewGenerator handles asynchronous preview generation for files
type PreviewGenerator struct {
	previewService *previews.Service
	mimeDetector   *MimeDetector
}

// NewPreviewGenerator creates a new preview generator
func NewPreviewGenerator(previewService *previews.Service, mimeDetector *MimeDetector) *PreviewGenerator {
	return &PreviewGenerator{
		previewService: previewService,
		mimeDetector:   mimeDetector,
	}
}

// GenerateAsync generates a preview for a file asynchronously
func (pg *PreviewGenerator) GenerateAsync(volumeID string, file *models.File, path string, info os.FileInfo, errorCallback func(string, string)) {
	if pg.previewService == nil {
		return // No preview service available
	}

	go pg.generatePreview(volumeID, file, path, info, errorCallback)
}

// generatePreview performs the actual preview generation
func (pg *PreviewGenerator) generatePreview(volumeID string, file *models.File, path string, info os.FileInfo, errorCallback func(string, string)) {
	// Create context with timeout for preview generation
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	// Detect MIME type if not already detected
	mimeType := ""
	if file.Mime != nil {
		mimeType = *file.Mime
	} else {
		// Try to detect MIME type
		detected, _, _ := pg.mimeDetector.DetectFile(path)
		if detected != "" {
			mimeType = detected
		}
	}

	// Skip if no MIME type or unsupported file type
	if mimeType == "" || !pg.previewService.CanGeneratePreview(mimeType) {
		return
	}

	// Use file ID and modification time as cache key for performance
	// This avoids reading the entire file for hash calculation
	fileHash := fmt.Sprintf("file_%d_mtime_%d", file.ID, info.ModTime().Unix())

	// Determine preview type based on MIME type
	previewType := pg.determinePreviewType(mimeType)
	if previewType == "" {
		return // Unsupported type
	}

	// Create preview request
	req := &previews.PreviewRequest{
		FileID:     file.ID,
		FilePath:   path,
		FileHash:   fileHash,
		Type:       previews.PreviewType(previewType),
		Size:       previews.PreviewSizeMedium, // Default to medium size during indexing
		TimeOffset: 5.0,                        // Default time offset for videos
	}

	// Generate preview (this will handle deduplication automatically)
	_, err := pg.previewService.GeneratePreview(ctx, req, mimeType)
	if err != nil {
		// Log error but don't block indexing
		if errorCallback != nil {
			errorCallback(volumeID, fmt.Sprintf("failed to generate preview for %s: %v", path, err))
		}
	}
}

// determinePreviewType determines the appropriate preview type based on MIME type
func (pg *PreviewGenerator) determinePreviewType(mimeType string) string {
	switch {
	case strings.HasPrefix(mimeType, "image/"):
		return string(previews.PreviewTypeThumbnail)
	case strings.HasPrefix(mimeType, "video/"):
		return string(previews.PreviewTypePoster)
	case strings.HasPrefix(mimeType, "audio/"):
		return string(previews.PreviewTypeCover)
	default:
		return "" // Unsupported type
	}
}