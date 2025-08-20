package previews

import (
	"fmt"
	"io"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/mantonx/volumeviz/internal/services/previews"
	"github.com/mantonx/volumeviz/internal/store"
)

// Handler handles preview API endpoints
type Handler struct {
	service *previews.Service
	store   store.Store
}

// NewHandler creates a new preview handler
func NewHandler(service *previews.Service, store store.Store) *Handler {
	return &Handler{
		service: service,
		store:   store,
	}
}

// PreviewRequest represents an API request for a preview
type PreviewRequest struct {
	FileID     int64  `json:"file_id" binding:"required"`
	FilePath   string `json:"file_path" binding:"required"`
	FileHash   string `json:"file_hash,omitempty"`
	Type       string `json:"type" binding:"required,oneof=thumbnail poster cover"`
	Size       string `json:"size" binding:"required,oneof=small medium large"`
	TimeOffset string `json:"time_offset,omitempty"`
	MimeType   string `json:"mime_type" binding:"required"`
}

// PreviewResponse represents a preview API response
type PreviewResponse struct {
	ID           int64             `json:"id"`
	FileID       int64             `json:"file_id"`
	Type         string            `json:"type"`
	Size         string            `json:"size"`
	Format       string            `json:"format"`
	Width        int               `json:"width,omitempty"`
	Height       int               `json:"height,omitempty"`
	FileSize     int64             `json:"file_size"`
	URL          string            `json:"url"`
	ETag         string            `json:"etag"`
	ProcessingMS int64             `json:"processing_ms"`
	CacheHit     bool              `json:"cache_hit"`
	CreatedAt    time.Time         `json:"created_at"`
}

// GeneratePreview generates a new preview
// @Summary Generate preview
// @Description Generate a new preview (thumbnail, poster, or cover) for a file
// @Tags previews
// @Accept json
// @Produce json
// @Param request body PreviewRequest true "Preview generation request"
// @Success 201 {object} PreviewResponse "Preview generated successfully"
// @Failure 400 {object} map[string]interface{} "Bad request"
// @Failure 500 {object} map[string]interface{} "Internal server error"
// @Router /previews [post]
func (h *Handler) GeneratePreview(c *gin.Context) {
	var req PreviewRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Convert to service request
	serviceReq := &previews.PreviewRequest{
		FileID:   req.FileID,
		FilePath: req.FilePath,
		FileHash: req.FileHash,
		Type:     previews.PreviewType(req.Type),
		Size:     previews.PreviewSize(req.Size),
	}

	// Parse time offset if provided
	if req.TimeOffset != "" {
		if offset, err := strconv.ParseFloat(req.TimeOffset, 64); err == nil {
			serviceReq.TimeOffset = offset
		}
	}

	// Check if we can generate this type of preview
	if !h.service.CanGeneratePreview(req.MimeType) {
		c.JSON(http.StatusUnsupportedMediaType, gin.H{
			"error": fmt.Sprintf("Unsupported media type: %s", req.MimeType),
		})
		return
	}

	// Generate preview
	result, err := h.service.GeneratePreview(c.Request.Context(), serviceReq, req.MimeType)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Build response
	response := PreviewResponse{
		FileID:       result.Metadata.FileID,
		Type:         string(result.Metadata.Type),
		Size:         string(result.Metadata.Size),
		Format:       result.Metadata.Format,
		Width:        result.Metadata.Width,
		Height:       result.Metadata.Height,
		FileSize:     result.Metadata.FileSize,
		URL:          fmt.Sprintf("/api/v1/previews/%s", result.Metadata.StoragePath),
		ETag:         h.service.GetETag(result.Metadata.StoragePath),
		ProcessingMS: result.ProcessingMS,
		CacheHit:     result.CacheHit,
		CreatedAt:    result.Metadata.CreatedAt,
	}

	status := http.StatusCreated
	if result.CacheHit {
		status = http.StatusOK
	}

	c.JSON(status, response)
}

// GetPreview serves a preview file
// @Summary Get preview file
// @Description Serve a preview file by file ID
// @Tags previews
// @Accept json
// @Produce application/octet-stream
// @Param file_id path int true "File ID"
// @Param type query string false "Preview type" Enums(thumbnail, poster, cover)
// @Param size query string false "Preview size" Enums(small, medium, large)
// @Success 200 {file} binary "Preview file data"
// @Failure 400 {object} map[string]interface{} "Bad request"
// @Failure 404 {object} map[string]interface{} "Preview not found"
// @Failure 500 {object} map[string]interface{} "Internal server error"
// @Router /previews/{file_id} [get]
func (h *Handler) GetPreview(c *gin.Context) {
	fileIDStr := c.Param("file_id")
	fileID, err := strconv.ParseInt(fileIDStr, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid file ID"})
		return
	}

	// Get query parameters for preview type and size
	previewType := c.DefaultQuery("type", "thumbnail")
	size := c.DefaultQuery("size", "medium")
	timeOffsetStr := c.DefaultQuery("time_offset", "")

	// Get file information from database
	filesRepo := h.store.Files()
	file, err := filesRepo.GetFileByID(c.Request.Context(), fileID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error": "file not found",
		})
		return
	}

	filePath := file.Path
	mimeType := ""
	if file.Mime != nil {
		mimeType = *file.Mime
	}

	// Build preview request
	req := &previews.PreviewRequest{
		FileID:   fileID,
		FilePath: filePath,
		Type:     previews.PreviewType(previewType),
		Size:     previews.PreviewSize(size),
	}

	// Parse time offset
	if timeOffsetStr != "" {
		if offset, err := strconv.ParseFloat(timeOffsetStr, 64); err == nil {
			req.TimeOffset = offset
		}
	}

	// Check if we can generate this type of preview
	if !h.service.CanGeneratePreview(mimeType) {
		c.JSON(http.StatusUnsupportedMediaType, gin.H{
			"error": fmt.Sprintf("Unsupported media type: %s", mimeType),
		})
		return
	}

	// Only serve existing previews - don't generate on-demand for performance
	// Use file ID and modification time as cache key
	mtime := int64(0)
	if file.Mtime != nil {
		mtime = file.Mtime.Unix()
	}
	req.FileHash = fmt.Sprintf("file_%d_mtime_%d", fileID, mtime)
	
	// Check if preview exists
	if existingKey := h.service.FindExistingPreview(req.FileHash, req.Type, req.Size); existingKey != "" {
		// Serve existing preview
		result := &previews.GenerationResult{
			Metadata: &previews.PreviewMetadata{
				FileID:      fileID,
				Type:        req.Type,
				Size:        req.Size,
				StoragePath: existingKey,
			},
			CacheHit: true,
		}
		
		// Get ETag for the preview
		etag := h.service.GetETag(result.Metadata.StoragePath)
		
		// Check If-None-Match header for 304 responses
		if ifNoneMatch := c.GetHeader("If-None-Match"); ifNoneMatch != "" {
			if ifNoneMatch == etag {
				c.Status(http.StatusNotModified)
				return
			}
		}
		
		// Set cache headers
		c.Header("ETag", etag)
		c.Header("Cache-Control", "public, max-age=2592000") // 30 days
		c.Header("Content-Type", previews.ImagePreviewMimeType)
		
		// Stream the preview directly to response
		c.Stream(func(w io.Writer) bool {
			err := h.service.StreamPreview(result.Metadata.StoragePath, w)
			if err != nil {
				return false
			}
			return false
		})
		return
	}
	
	// No preview available - return 404 with a message
	c.JSON(http.StatusNotFound, gin.H{
		"error": "Preview not yet generated",
		"message": "Preview is being generated in the background, please try again in a few moments",
	})
}

// GetPreviewByFile gets or generates a preview for a specific file
// @Summary Get or generate preview by file ID
// @Description Get existing preview or generate new preview for a specific file
// @Tags previews
// @Accept json
// @Produce application/octet-stream
// @Param file_id path int true "File ID"
// @Param type query string false "Preview type" Enums(thumbnail, poster, cover) default(thumbnail)
// @Param size query string false "Preview size" Enums(small, medium, large) default(medium)
// @Param offset query string false "Time offset for video thumbnails (e.g., '5.0' for 5 seconds)"
// @Success 200 {file} binary "Preview file data"
// @Failure 400 {object} map[string]interface{} "Bad request"
// @Failure 404 {object} map[string]interface{} "File not found"
// @Failure 500 {object} map[string]interface{} "Internal server error"
// @Router /files/{file_id}/preview [get]
func (h *Handler) GetPreviewByFile(c *gin.Context) {
	fileIDStr := c.Param("file_id")
	fileID, err := strconv.ParseInt(fileIDStr, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid file ID"})
		return
	}

	// Get query parameters
	previewType := c.DefaultQuery("type", "thumbnail")
	size := c.DefaultQuery("size", "medium")
	timeOffsetStr := c.DefaultQuery("offset", "")

	// Get file information from database
	filesRepo := h.store.Files()
	file, err := filesRepo.GetFileByID(c.Request.Context(), fileID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error": "file not found",
		})
		return
	}

	filePath := file.Path
	mimeType := ""
	if file.Mime != nil {
		mimeType = *file.Mime
	}

	// Build preview request
	req := &previews.PreviewRequest{
		FileID:   fileID,
		FilePath: filePath,
		Type:     previews.PreviewType(previewType),
		Size:     previews.PreviewSize(size),
	}

	// Parse time offset
	if timeOffsetStr != "" {
		if offset, err := strconv.ParseFloat(timeOffsetStr, 64); err == nil {
			req.TimeOffset = offset
		}
	}

	// Check if we can generate this type of preview
	if !h.service.CanGeneratePreview(mimeType) {
		c.JSON(http.StatusUnsupportedMediaType, gin.H{
			"error": fmt.Sprintf("Unsupported media type: %s", mimeType),
		})
		return
	}

	// Generate or get existing preview
	_, err = h.service.GeneratePreview(c.Request.Context(), req, mimeType)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Redirect to the preview URL using file ID
	previewURL := fmt.Sprintf("/api/v1/previews/%d?type=%s&size=%s", fileID, previewType, size)
	if timeOffsetStr != "" {
		previewURL += "&time_offset=" + timeOffsetStr
	}
	c.Redirect(http.StatusTemporaryRedirect, previewURL)
}

// DeletePreview deletes a preview
// @Summary Delete preview
// @Description Delete all previews for a specific file
// @Tags previews
// @Accept json
// @Produce json
// @Param file_id path int true "File ID"
// @Success 204 "Previews deleted successfully"
// @Failure 400 {object} map[string]interface{} "Bad request"
// @Failure 500 {object} map[string]interface{} "Internal server error"
// @Router /previews/{file_id} [delete]
func (h *Handler) DeletePreview(c *gin.Context) {
	fileIDStr := c.Param("file_id")
	_, err := strconv.ParseInt(fileIDStr, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid file ID"})
		return
	}

	// For now, we'll just return not implemented since we need to 
	// implement storage key lookup by file ID
	c.JSON(http.StatusNotImplemented, gin.H{
		"error": "delete by file ID not yet implemented",
	})
}

// GetStats returns preview service statistics
// @Summary Get preview statistics
// @Description Get statistics about preview generation and usage
// @Tags previews
// @Accept json
// @Produce json
// @Success 200 {object} map[string]interface{} "Preview statistics"
// @Failure 500 {object} map[string]interface{} "Internal server error"
// @Router /previews/stats [get]
func (h *Handler) GetStats(c *gin.Context) {
	stats := h.service.GetStats()
	c.JSON(http.StatusOK, stats)
}

// GetSupportedTypes returns supported media types
// @Summary Get supported media types
// @Description Get list of supported media types for preview generation
// @Tags previews
// @Accept json
// @Produce json
// @Success 200 {object} map[string]interface{} "Supported media types"
// @Router /previews/supported [get]
func (h *Handler) GetSupportedTypes(c *gin.Context) {
	supported := h.service.GetSupportedTypes()
	c.JSON(http.StatusOK, gin.H{"supported_types": supported})
}

// HealthCheck returns the health status of the preview service
// @Summary Preview service health check
// @Description Check the health status of the preview service and its dependencies
// @Tags previews
// @Accept json
// @Produce json
// @Success 200 {object} map[string]interface{} "Service health status"
// @Router /previews/health [get]
func (h *Handler) HealthCheck(c *gin.Context) {
	// Check if required tools are available
	health := gin.H{
		"status": "ok",
		"tools":  gin.H{},
	}

	// Check vips availability
	if previews.IsVipsAvailable() {
		health["tools"].(gin.H)["vips"] = "available"
	} else {
		health["tools"].(gin.H)["vips"] = "unavailable"
		health["status"] = "degraded"
	}

	// Check ffmpeg availability
	if previews.IsFFmpegAvailable() {
		health["tools"].(gin.H)["ffmpeg"] = "available"
	} else {
		health["tools"].(gin.H)["ffmpeg"] = "unavailable"
		health["status"] = "degraded"
	}

	// Return appropriate status code
	if health["status"] == "ok" {
		c.JSON(http.StatusOK, health)
	} else {
		c.JSON(http.StatusServiceUnavailable, health)
	}
}