package previews

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"
	"os"
	"strings"
	"sync"
	"time"
)

// Service manages preview generation and storage
type Service struct {
	config         *PreviewConfig
	storage        *StorageManager
	imageProcessor *ImageProcessor
	videoProcessor *VideoProcessor
	audioProcessor *AudioProcessor

	// Concurrency control
	semaphore  chan struct{}
	activeJobs sync.Map
	mu         sync.RWMutex
}

// NewService creates a new preview service
func NewService(config *PreviewConfig) (*Service, error) {
	// Create storage manager
	storage, err := NewStorageManager(config.RootDir)
	if err != nil {
		return nil, fmt.Errorf("failed to create storage manager: %w", err)
	}

	// Create processors
	imageProcessor, err := NewImageProcessor(config.VipsPath, config.SmartCrop)
	if err != nil {
		// Image processor is optional if vips is not available
		// We can still handle video/audio
		imageProcessor = nil
	}

	videoProcessor, err := NewVideoProcessor(config.FFmpegPath, config.VideoTimeOffset)
	if err != nil {
		// Video processor is optional
		videoProcessor = nil
	}

	audioProcessor, err := NewAudioProcessor(config.FFmpegPath, config.FallbackCover)
	if err != nil {
		// Audio processor is optional
		audioProcessor = nil
	}

	// Create semaphore for concurrency control
	semaphore := make(chan struct{}, config.MaxConcurrent)

	service := &Service{
		config:         config,
		storage:        storage,
		imageProcessor: imageProcessor,
		videoProcessor: videoProcessor,
		audioProcessor: audioProcessor,
		semaphore:      semaphore,
	}

	// Start cleanup goroutine if enabled
	if config.CleanupEnabled {
		go service.cleanupLoop()
	}

	return service, nil
}

// GeneratePreview generates or retrieves a preview for a file
func (s *Service) GeneratePreview(ctx context.Context, req *PreviewRequest, mimeType string) (*GenerationResult, error) {
	startTime := time.Now()

	// Validate request
	if err := s.validateRequest(req); err != nil {
		return nil, fmt.Errorf("invalid request: %w", err)
	}

	// Check source file size
	info, err := os.Stat(req.FilePath)
	if err != nil {
		return nil, fmt.Errorf("source file not accessible: %w", err)
	}

	// For video files, we don't check size limits as ffmpeg can efficiently seek and extract frames
	// For other file types, we still enforce the size limit
	if !strings.HasPrefix(strings.ToLower(mimeType), "video/") {
		maxSize := int64(s.config.MaxSourceSizeMB * 1024 * 1024)
		if info.Size() > maxSize {
			return nil, fmt.Errorf("source file too large: %d MB (max %d MB)",
				info.Size()/(1024*1024), s.config.MaxSourceSizeMB)
		}
	}

	// Calculate source file hash if not provided
	// For performance, use file ID and modification time instead of full file hash
	if req.FileHash == "" {
		// Use file ID and modification time as a quick cache key
		// This avoids reading the entire file for hash calculation
		req.FileHash = fmt.Sprintf("file_%d_mtime_%d", req.FileID, info.ModTime().Unix())
	}

	// Generate a job key to prevent duplicate processing
	jobKey := fmt.Sprintf("%s_%s_%s", req.FileHash, req.Type, req.Size)
	
	// First check if preview already exists in storage (fast path)
	// We check for any existing preview with this source hash pattern
	if existingKey := s.storage.FindExistingPreview(req.FileHash, req.Type, req.Size); existingKey != "" {
		metadata := s.buildMetadata(req, existingKey, "", startTime, true)
		return &GenerationResult{
			Metadata:     metadata,
			CacheHit:     true,
			ProcessingMS: time.Since(startTime).Milliseconds(),
		}, nil
	}

	// Check if we're already processing this
	if _, exists := s.activeJobs.LoadOrStore(jobKey, true); exists {
		// Wait a bit and check storage again
		time.Sleep(100 * time.Millisecond)

		// Try to find the result in storage again
		if existingKey := s.storage.FindExistingPreview(req.FileHash, req.Type, req.Size); existingKey != "" {
			metadata := s.buildMetadata(req, existingKey, "", startTime, true)
			return &GenerationResult{
				Metadata:     metadata,
				CacheHit:     true,
				ProcessingMS: time.Since(startTime).Milliseconds(),
			}, nil
		}

		return nil, fmt.Errorf("preview generation already in progress")
	}
	defer s.activeJobs.Delete(jobKey)

	// Acquire semaphore for concurrency control
	select {
	case s.semaphore <- struct{}{}:
		defer func() { <-s.semaphore }()
	case <-ctx.Done():
		return nil, ctx.Err()
	}

	// Generate preview based on mime type (auto-detect correct preview type)
	var previewData []byte
	var previewErr error

	// Auto-detect the appropriate preview type based on mime type
	if req.Type == PreviewTypeThumbnail {
		// For "thumbnail" requests, automatically route to the correct processor
		if strings.HasPrefix(strings.ToLower(mimeType), "video/") {
			req.Type = PreviewTypePoster // Videos use poster frames
		} else if strings.HasPrefix(strings.ToLower(mimeType), "audio/") {
			req.Type = PreviewTypeCover // Audio uses cover art
		}
		// Images stay as thumbnails
	}

	switch req.Type {
	case PreviewTypeThumbnail:
		previewData, previewErr = s.generateThumbnail(ctx, req, mimeType)
	case PreviewTypePoster:
		previewData, previewErr = s.generatePoster(ctx, req, mimeType)
	case PreviewTypeCover:
		previewData, previewErr = s.generateCover(ctx, req, mimeType)
	default:
		return nil, fmt.Errorf("unsupported preview type: %s", req.Type)
	}

	if previewErr != nil {
		return &GenerationResult{
			Error:        previewErr,
			ProcessingMS: time.Since(startTime).Milliseconds(),
		}, previewErr
	}

	// Store the preview
	storageKey, contentHash, err := s.storage.Store(previewData, req.FileHash, req.Type, req.Size)
	if err != nil {
		return nil, fmt.Errorf("failed to store preview: %w", err)
	}

	// Build metadata
	metadata := s.buildMetadata(req, storageKey, contentHash, startTime, false)

	return &GenerationResult{
		Metadata:     metadata,
		CacheHit:     false,
		ProcessingMS: time.Since(startTime).Milliseconds(),
	}, nil
}

// generateThumbnail generates an image thumbnail
func (s *Service) generateThumbnail(ctx context.Context, req *PreviewRequest, mimeType string) ([]byte, error) {
	if s.imageProcessor == nil {
		return nil, fmt.Errorf("image processor not available")
	}

	if !s.imageProcessor.CanProcess(mimeType) {
		return nil, fmt.Errorf("unsupported image type: %s", mimeType)
	}

	// Create context with timeout
	processCtx, cancel := context.WithTimeout(ctx, s.config.ProcessTimeout)
	defer cancel()

	return s.imageProcessor.GenerateThumbnail(processCtx, req.FilePath, req.Size)
}

// generatePoster generates a video poster frame
func (s *Service) generatePoster(ctx context.Context, req *PreviewRequest, mimeType string) ([]byte, error) {
	if s.videoProcessor == nil {
		return nil, fmt.Errorf("video processor not available")
	}

	if !s.videoProcessor.CanProcess(mimeType) {
		return nil, fmt.Errorf("unsupported video type: %s", mimeType)
	}

	// Create context with timeout
	processCtx, cancel := context.WithTimeout(ctx, s.config.ProcessTimeout)
	defer cancel()

	return s.videoProcessor.GeneratePoster(processCtx, req.FilePath, req.Size, req.TimeOffset)
}

// generateCover generates audio cover art
func (s *Service) generateCover(ctx context.Context, req *PreviewRequest, mimeType string) ([]byte, error) {
	if s.audioProcessor == nil {
		return nil, fmt.Errorf("audio processor not available")
	}

	if !s.audioProcessor.CanProcess(mimeType) {
		return nil, fmt.Errorf("unsupported audio type: %s", mimeType)
	}

	// Create context with timeout
	processCtx, cancel := context.WithTimeout(ctx, s.config.ProcessTimeout)
	defer cancel()

	return s.audioProcessor.ExtractCoverArt(processCtx, req.FilePath, req.Size)
}

// GetPreview retrieves an existing preview
func (s *Service) GetPreview(storageKey string) ([]byte, error) {
	return s.storage.Retrieve(storageKey)
}

// StreamPreview streams a preview directly to a writer
func (s *Service) StreamPreview(storageKey string, w io.Writer) error {
	return s.storage.StreamTo(storageKey, w)
}

// FindExistingPreview looks for an existing preview by source hash, type and size
func (s *Service) FindExistingPreview(sourceHash string, previewType PreviewType, size PreviewSize) string {
	return s.storage.FindExistingPreview(sourceHash, previewType, size)
}

// GetETag returns the ETag for a preview
func (s *Service) GetETag(storageKey string) string {
	return s.storage.GetETag(storageKey)
}

// DeletePreview removes a preview from storage
func (s *Service) DeletePreview(storageKey string) error {
	return s.storage.Delete(storageKey)
}

// GetStats returns service statistics
func (s *Service) GetStats() PreviewStats {
	stats := s.storage.GetStats()

	// Count active generators
	count := 0
	s.activeJobs.Range(func(_, _ interface{}) bool {
		count++
		return true
	})
	stats.ActiveGenerators = count

	return stats
}

// validateRequest validates a preview request
func (s *Service) validateRequest(req *PreviewRequest) error {
	if req.FilePath == "" {
		return fmt.Errorf("file path is required")
	}

	if req.Type == "" {
		return fmt.Errorf("preview type is required")
	}

	if req.Size == "" {
		req.Size = PreviewSizeMedium // Default size
	}

	// Validate size
	switch req.Size {
	case PreviewSizeSmall, PreviewSizeMedium, PreviewSizeLarge:
		// Valid
	default:
		return fmt.Errorf("invalid preview size: %s", req.Size)
	}

	return nil
}

// calculateFileHash calculates SHA256 hash of a file
func (s *Service) calculateFileHash(filePath string) (string, error) {
	file, err := os.Open(filePath)
	if err != nil {
		return "", err
	}
	defer file.Close()

	hasher := sha256.New()
	if _, err := io.Copy(hasher, file); err != nil {
		return "", err
	}

	return hex.EncodeToString(hasher.Sum(nil)), nil
}

// buildMetadata builds preview metadata
func (s *Service) buildMetadata(req *PreviewRequest, storageKey, contentHash string, startTime time.Time, cacheHit bool) *PreviewMetadata {
	now := time.Now()
	processingMS := now.Sub(startTime).Milliseconds()

	if cacheHit {
		processingMS = 0
	}

	return &PreviewMetadata{
		FileID:       req.FileID,
		Type:         req.Type,
		Size:         req.Size,
		Format:       ImagePreviewFormat, // Always WebP
		StoragePath:  storageKey,
		ContentHash:  contentHash,
		TimeOffset:   req.TimeOffset,
		ProcessingMS: processingMS,
		CreatedAt:    now,
		AccessedAt:   now,
	}
}

// cleanupLoop runs periodic cleanup of old previews
func (s *Service) cleanupLoop() {
	ticker := time.NewTicker(s.config.CleanupInterval)
	defer ticker.Stop()

	for range ticker.C {
		count, err := s.storage.CleanupOldPreviews(s.config.MaxAge)
		if err != nil {
			// Log error in production
			continue
		}

		if count > 0 {
			// Prune empty directories after cleanup
			if err := s.storage.PruneEmptyDirectories(); err != nil {
				// Log error in production but continue
				_ = err
			}
		}
	}
}

// CanGeneratePreview checks if we can generate a preview for a given MIME type
func (s *Service) CanGeneratePreview(mimeType string) bool {
	mimeType = strings.ToLower(mimeType)

	// Check image types
	if s.imageProcessor != nil && strings.HasPrefix(mimeType, "image/") {
		return s.imageProcessor.CanProcess(mimeType)
	}

	// Check video types
	if s.videoProcessor != nil && strings.HasPrefix(mimeType, "video/") {
		return s.videoProcessor.CanProcess(mimeType)
	}

	// Check audio types
	if s.audioProcessor != nil && strings.HasPrefix(mimeType, "audio/") {
		return s.audioProcessor.CanProcess(mimeType)
	}

	return false
}

// GetSupportedTypes returns all supported MIME types
func (s *Service) GetSupportedTypes() map[string][]string {
	supported := make(map[string][]string)

	if s.imageProcessor != nil {
		supported["image"] = []string{
			"image/jpeg", "image/png", "image/gif", "image/webp",
			"image/tiff", "image/bmp", "image/svg+xml", "image/heic",
			"image/heif", "image/avif", "image/jxl",
		}
	}

	if s.videoProcessor != nil {
		supported["video"] = []string{
			"video/mp4", "video/mpeg", "video/quicktime", "video/x-msvideo",
			"video/x-matroska", "video/webm", "video/ogg", "video/mp2t",
			"video/3gpp", "video/3gpp2", "video/x-flv", "video/x-m4v",
			"video/x-ms-wmv", "video/x-ms-asf",
		}
	}

	if s.audioProcessor != nil {
		supported["audio"] = []string{
			"audio/mpeg", "audio/mp3", "audio/mp4", "audio/x-m4a",
			"audio/aac", "audio/ogg", "audio/vorbis", "audio/opus",
			"audio/flac", "audio/x-flac", "audio/wav", "audio/x-wav",
			"audio/webm", "audio/x-ms-wma", "audio/x-aiff", "audio/aiff",
			"audio/ape", "audio/x-ape", "audio/wavpack", "audio/x-wavpack",
		}
	}

	return supported
}
