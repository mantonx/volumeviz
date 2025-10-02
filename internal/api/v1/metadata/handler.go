package metadata

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/mantonx/volumeviz/internal/api/utils"
	"github.com/mantonx/volumeviz/internal/db/sqlc"
	"github.com/mantonx/volumeviz/internal/models"
	"github.com/mantonx/volumeviz/internal/store"
)

// Handler handles file metadata-related HTTP requests
type Handler struct {
	store store.Store
}

// NewHandler creates a new file metadata handler
func NewHandler(store store.Store) *Handler {
	return &Handler{
		store: store,
	}
}

// GetFileDetails returns detailed information about a file
// @Summary Get file details
// @Description Get comprehensive information about a specific file including metadata
// @Tags files
// @Accept json
// @Produce json
// @Param id path int true "File ID"
// @Success 200 {object} models.FileDetailsResponse
// @Failure 400 {object} models.ErrorResponse
// @Failure 404 {object} models.ErrorResponse
// @Failure 500 {object} models.ErrorResponse
// @Router /files/{id}/details [get]
func (h *Handler) GetFileDetails(c *gin.Context) {
	fileIDStr := c.Param("id")
	fileID, err := strconv.ParseInt(fileIDStr, 10, 64)
	if err != nil {
		utils.RespondWithBadRequest(c, "Invalid file ID", nil)
		return
	}

	ctx := c.Request.Context()

	// Get the file record
	file, err := h.store.Files().GetFileByID(ctx, fileID)
	if err != nil || file == nil {
		utils.RespondWithNotFound(c, "File not found")
		return
	}

	// Handle nullable fields
	var mimeType string
	if file.Mime != nil {
		mimeType = *file.Mime
	}

	var extension string
	if file.Extension != nil {
		extension = *file.Extension
	}

	var mediaKind string
	if file.MediaKind != nil {
		mediaKind = *file.MediaKind
	}

	// Create response
	response := models.FileDetailsResponse{
		ID:        file.ID,
		Name:      file.Name,
		Path:      file.Path,
		VolumeID:  file.VolumeID,
		Size:      file.SizeBytes,
		DiskUsage: file.DiskUsageBytes,
		MimeType:  mimeType,
		MediaKind: mediaKind,
		Extension: extension,
		Modified:  *file.Mtime, // Assuming Mtime is always present for files
		// Created, Permissions, Checksums, IsSymlink would be populated if available
	}

	c.JSON(http.StatusOK, response)
}

// GetFileMetadata returns enriched metadata for a file
// @Summary Get file metadata
// @Description Get enriched metadata for a specific file (media properties, EXIF, etc.)
// @Tags files
// @Accept json
// @Produce json
// @Param id path int true "File ID"
// @Param kind query string false "Metadata kind filter" Enums(media,exif,ffmpeg)
// @Success 200 {object} models.FileMetadataResponse
// @Failure 400 {object} models.ErrorResponse
// @Failure 404 {object} models.ErrorResponse
// @Failure 500 {object} models.ErrorResponse
// @Router /files/{id}/metadata [get]
func (h *Handler) GetFileMetadata(c *gin.Context) {
	fileIDStr := c.Param("id")
	fileID, err := strconv.ParseInt(fileIDStr, 10, 64)
	if err != nil {
		utils.RespondWithBadRequest(c, "Invalid file ID", nil)
		return
	}

	kindFilter := c.Query("kind")
	ctx := c.Request.Context()

	// Verify file exists
	file, err := h.store.Files().GetFileByID(ctx, fileID)
	if err != nil || file == nil {
		utils.RespondWithNotFound(c, "File not found")
		return
	}

	// Get enriched metadata from file_metadata table
	var metadata []sqlc.FileMetadata
	if kindFilter != "" {
		// Get specific kind of metadata
		metadataRecord, err := h.store.FileMetadata().GetFileMetadataByKind(ctx, fileID, kindFilter)
		if err == nil {
			metadata = []sqlc.FileMetadata{metadataRecord}
		}
	} else {
		// Get all metadata for the file
		metadata, err = h.store.FileMetadata().GetAllFileMetadata(ctx, fileID)
		if err != nil {
			utils.RespondWithInternalError(c, "Failed to retrieve file metadata", err)
			return
		}
	}

	// Build metadata response
	metadataMap := make(map[string]interface{})
	var lastEnriched *time.Time

	// Add basic file properties
	if file.Mime != nil {
		metadataMap["mime_type"] = *file.Mime
	}
	if file.MediaKind != nil {
		metadataMap["media_kind"] = *file.MediaKind
	}
	metadataMap["file_size"] = file.SizeBytes

	// Add enriched metadata
	for _, meta := range metadata {
		if len(meta.RawMetadata) > 0 {
			var enrichedData map[string]interface{}
			if err := json.Unmarshal(meta.RawMetadata, &enrichedData); err == nil {
				// Namespace metadata by kind - using extracted_at as timestamp
				metadataMap["metadata"] = enrichedData
				if meta.ExtractedAt.Valid && (lastEnriched == nil || meta.ExtractedAt.Time.After(*lastEnriched)) {
					lastEnriched = &meta.ExtractedAt.Time
				}
			}
		}
	}

	updatedAt := *file.Mtime
	if lastEnriched != nil {
		updatedAt = *lastEnriched
	}

	response := models.FileMetadataResponse{
		FileID:    fileID,
		Metadata:  metadataMap,
		Enriched:  len(metadata) > 0,
		UpdatedAt: updatedAt,
	}

	c.JSON(http.StatusOK, response)
}

// GetFilesByMediaKind gets files filtered by media kind
// @Summary Get files by media kind
// @Description Retrieve files filtered by media kind (video, image, audio, document, etc.) with pagination
// @Tags Metadata
// @Accept json
// @Produce json
// @Param volume_id query string true "Volume ID" example(vol_123)
// @Param media_kind query string true "Media kind to filter by" example(video)
// @Param page query int false "Page number (default: 1)" example(1)
// @Param limit query int false "Items per page (default: 50, max: 200)" example(50)
// @Success 200 {object} map[string]interface{} "Files retrieved successfully"
// @Failure 400 {object} map[string]interface{} "Invalid request parameters"
// @Failure 404 {object} map[string]interface{} "Volume not found"
// @Failure 500 {object} map[string]interface{} "Internal server error"
// @Router /api/v1/metadata/files/by-media-kind [get]
func (h *Handler) GetFilesByMediaKind(c *gin.Context) {
	volumeID := c.Query("volume_id")
	mediaKind := c.Query("media_kind")

	if volumeID == "" || mediaKind == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "volume_id and media_kind are required"})
		return
	}

	// Parse pagination parameters
	page := 1
	limit := 50
	if p := c.Query("page"); p != "" {
		if parsed, err := strconv.Atoi(p); err == nil && parsed > 0 {
			page = parsed
		}
	}
	if l := c.Query("limit"); l != "" {
		if parsed, err := strconv.Atoi(l); err == nil && parsed > 0 {
			if parsed > 200 {
				parsed = 200
			}
			limit = parsed
		}
	}

	offset := (page - 1) * limit

	// Get files from repository
	fileRepo := h.store.Files()
	files, err := fileRepo.GetFilesByMediaKind(c.Request.Context(), volumeID, mediaKind, int32(limit), int32(offset))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve files", "details": err.Error()})
		return
	}

	// Convert files to response format
	var fileResponses []map[string]interface{}
	for _, file := range files {
		fileResponse := map[string]interface{}{
			"id":         file.ID,
			"name":       file.Name,
			"path":       file.Path,
			"size":       file.SizeBytes,
			"media_kind": file.MediaKind,
			"mime_type":  file.Mime,
			"extension":  file.Extension,
		}

		if file.Mtime != nil {
			fileResponse["modified_time"] = file.Mtime.Format("2006-01-02T15:04:05Z")
		}

		fileResponses = append(fileResponses, fileResponse)
	}

	// Calculate total pages (approximated)
	allFiles, err := fileRepo.GetFilesByMediaKind(c.Request.Context(), volumeID, mediaKind, 10000, 0)
	totalCount := len(allFiles)
	totalPages := (totalCount + limit - 1) / limit

	response := map[string]interface{}{
		"files":       fileResponses,
		"total_count": totalCount,
		"page":        page,
		"limit":       limit,
		"total_pages": totalPages,
	}

	c.JSON(http.StatusOK, response)
}

// Request/Response types for new metadata endpoints

// GetFilesByResolutionRequest represents the request for files by resolution
type GetFilesByResolutionRequest struct {
	VolumeID  string `form:"volume_id" json:"volume_id" binding:"required"`
	Width     *int   `form:"width" json:"width"`
	Height    *int   `form:"height" json:"height"`
	MinWidth  *int   `form:"min_width" json:"min_width"`
	MaxWidth  *int   `form:"max_width" json:"max_width"`
	MinHeight *int   `form:"min_height" json:"min_height"`
	MaxHeight *int   `form:"max_height" json:"max_height"`
	Page      int    `form:"page,default=1" json:"page"`
	Limit     int    `form:"limit,default=100" json:"limit"`
}

type GetFilesByResolutionResponse struct {
	Files      []FileResolutionItem `json:"files"`
	TotalCount int                  `json:"total_count"`
	Page       int                  `json:"page"`
	Limit      int                  `json:"limit"`
	TotalPages int                  `json:"total_pages"`
}

type FileResolutionItem struct {
	ID        int64  `json:"id"`
	Name      string `json:"name"`
	Path      string `json:"path"`
	Size      int64  `json:"size"`
	Width     int    `json:"width"`
	Height    int    `json:"height"`
	MediaType string `json:"media_type"`
}

// GetFilesByDurationRequest represents the request for files by duration
type GetFilesByDurationRequest struct {
	VolumeID    string `form:"volume_id" json:"volume_id" binding:"required"`
	MinDuration *int   `form:"min_duration" json:"min_duration"`
	MaxDuration *int   `form:"max_duration" json:"max_duration"`
	Page        int    `form:"page,default=1" json:"page"`
	Limit       int    `form:"limit,default=100" json:"limit"`
}

type GetFilesByDurationResponse struct {
	Files      []FileDurationItem `json:"files"`
	TotalCount int                `json:"total_count"`
	Page       int                `json:"page"`
	Limit      int                `json:"limit"`
	TotalPages int                `json:"total_pages"`
}

type FileDurationItem struct {
	ID        int64  `json:"id"`
	Name      string `json:"name"`
	Path      string `json:"path"`
	Size      int64  `json:"size"`
	Duration  int    `json:"duration_seconds"`
	MediaType string `json:"media_type"`
}

// GetFilesByLocationRequest represents the request for files by GPS location
type GetFilesByLocationRequest struct {
	VolumeID    string   `form:"volume_id" json:"volume_id" binding:"required"`
	Latitude    float64  `form:"latitude" json:"latitude"`
	Longitude   float64  `form:"longitude" json:"longitude"`
	Radius      *float64 `form:"radius" json:"radius"`
	HasLocation *bool    `form:"has_location" json:"has_location"`
	Page        int      `form:"page,default=1" json:"page"`
	Limit       int      `form:"limit,default=100" json:"limit"`
}

type GetFilesByLocationResponse struct {
	Files      []FileLocationItem `json:"files"`
	TotalCount int                `json:"total_count"`
	Page       int                `json:"page"`
	Limit      int                `json:"limit"`
	TotalPages int                `json:"total_pages"`
}

type FileLocationItem struct {
	ID        int64    `json:"id"`
	Name      string   `json:"name"`
	Path      string   `json:"path"`
	Size      int64    `json:"size"`
	Latitude  *float64 `json:"latitude,omitempty"`
	Longitude *float64 `json:"longitude,omitempty"`
	MediaType string   `json:"media_type"`
}

// GetFilesByResolution gets files filtered by resolution
// @Summary Get files by resolution
// @Description Retrieve files filtered by image/video resolution with pagination support
// @Tags metadata
// @Accept json
// @Produce json
// @Param volume_id query string true "Volume ID" example(vol_123)
// @Param width query int false "Image/video width" example(1920)
// @Param height query int false "Image/video height" example(1080)
// @Param min_width query int false "Minimum width" example(1024)
// @Param max_width query int false "Maximum width" example(4096)
// @Param min_height query int false "Minimum height" example(768)
// @Param max_height query int false "Maximum height" example(2160)
// @Param page query int false "Page number (default: 1)" example(1)
// @Param limit query int false "Items per page (default: 100, max: 500)" example(100)
// @Success 200 {object} GetFilesByResolutionResponse "Files retrieved successfully"
// @Failure 400 {object} map[string]interface{} "Invalid request parameters"
// @Failure 500 {object} map[string]interface{} "Internal server error"
// @Router /api/v1/metadata/files/by-resolution [get]
func (h *Handler) GetFilesByResolution(c *gin.Context) {
	var req GetFilesByResolutionRequest
	if err := c.ShouldBindQuery(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request parameters", "details": err.Error()})
		return
	}

	// Set defaults
	if req.Page < 1 {
		req.Page = 1
	}
	if req.Limit < 1 {
		req.Limit = 100
	}
	if req.Limit > 500 {
		req.Limit = 500
	}

	ctx := c.Request.Context()

	// Get SQLC queries from store
	queries, ok := h.store.Queries().(*sqlc.Queries)
	if !ok {
		utils.RespondWithInternalError(c, "Database queries not available", nil)
		return
	}

	// Calculate offset
	offset := int32((req.Page - 1) * req.Limit)

	// Build query parameters with nullable values
	params := sqlc.GetFilesByResolutionParams{
		VolumeID:  req.VolumeID,
		Limit:     int32(req.Limit),
		Offset:    offset,
		MinWidth:  pgtype.Int4{Valid: req.MinWidth != nil, Int32: getInt32Value(req.MinWidth)},
		MaxWidth:  pgtype.Int4{Valid: req.MaxWidth != nil, Int32: getInt32Value(req.MaxWidth)},
		MinHeight: pgtype.Int4{Valid: req.MinHeight != nil, Int32: getInt32Value(req.MinHeight)},
		MaxHeight: pgtype.Int4{Valid: req.MaxHeight != nil, Int32: getInt32Value(req.MaxHeight)},
	}

	// Query files by resolution
	rows, err := queries.GetFilesByResolution(ctx, params)
	if err != nil {
		utils.RespondWithInternalError(c, "Failed to query files by resolution", err)
		return
	}

	// Get total count
	countParams := sqlc.CountFilesByResolutionParams{
		VolumeID:  req.VolumeID,
		MinWidth:  params.MinWidth,
		MaxWidth:  params.MaxWidth,
		MinHeight: params.MinHeight,
		MaxHeight: params.MaxHeight,
	}
	totalCount, err := queries.CountFilesByResolution(ctx, countParams)
	if err != nil {
		utils.RespondWithInternalError(c, "Failed to count files", err)
		return
	}

	// Convert to response format
	fileItems := make([]FileResolutionItem, 0, len(rows))
	for _, row := range rows {
		item := FileResolutionItem{
			ID:     row.ID,
			Name:   row.Name,
			Path:   row.Path,
			Size:   row.SizeBytes,
			Width:  int(row.Width),
			Height: int(row.Height),
		}
		if row.Mime.Valid {
			item.MediaType = row.Mime.String
		}
		fileItems = append(fileItems, item)
	}

	totalPages := int((totalCount + int64(req.Limit) - 1) / int64(req.Limit))

	response := GetFilesByResolutionResponse{
		Files:      fileItems,
		TotalCount: int(totalCount),
		Page:       req.Page,
		Limit:      req.Limit,
		TotalPages: totalPages,
	}

	c.JSON(http.StatusOK, response)
}

// GetFilesByDuration gets files filtered by video/audio duration
// @Summary Get files by duration
// @Description Retrieve files filtered by video/audio duration with pagination support
// @Tags metadata
// @Accept json
// @Produce json
// @Param volume_id query string true "Volume ID" example(vol_123)
// @Param min_duration query int false "Minimum duration in seconds" example(60)
// @Param max_duration query int false "Maximum duration in seconds" example(3600)
// @Param page query int false "Page number (default: 1)" example(1)
// @Param limit query int false "Items per page (default: 100, max: 500)" example(100)
// @Success 200 {object} GetFilesByDurationResponse "Files retrieved successfully"
// @Failure 400 {object} map[string]interface{} "Invalid request parameters"
// @Failure 500 {object} map[string]interface{} "Internal server error"
// @Router /api/v1/metadata/files/by-duration [get]
func (h *Handler) GetFilesByDuration(c *gin.Context) {
	var req GetFilesByDurationRequest
	if err := c.ShouldBindQuery(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request parameters", "details": err.Error()})
		return
	}

	// Set defaults
	if req.Page < 1 {
		req.Page = 1
	}
	if req.Limit < 1 {
		req.Limit = 100
	}
	if req.Limit > 500 {
		req.Limit = 500
	}

	ctx := c.Request.Context()

	// Get SQLC queries from store
	queries, ok := h.store.Queries().(*sqlc.Queries)
	if !ok {
		utils.RespondWithInternalError(c, "Database queries not available", nil)
		return
	}

	// Calculate offset
	offset := int32((req.Page - 1) * req.Limit)

	// Build query parameters with nullable values
	params := sqlc.GetFilesByDurationParams{
		VolumeID:    req.VolumeID,
		Limit:       int32(req.Limit),
		Offset:      offset,
		MinDuration: pgtype.Float8{Valid: req.MinDuration != nil, Float64: getFloat64FromInt(req.MinDuration)},
		MaxDuration: pgtype.Float8{Valid: req.MaxDuration != nil, Float64: getFloat64FromInt(req.MaxDuration)},
	}

	// Query files by duration
	rows, err := queries.GetFilesByDuration(ctx, params)
	if err != nil {
		utils.RespondWithInternalError(c, "Failed to query files by duration", err)
		return
	}

	// Get total count
	countParams := sqlc.CountFilesByDurationParams{
		VolumeID:    req.VolumeID,
		MinDuration: params.MinDuration,
		MaxDuration: params.MaxDuration,
	}
	totalCount, err := queries.CountFilesByDuration(ctx, countParams)
	if err != nil {
		utils.RespondWithInternalError(c, "Failed to count files", err)
		return
	}

	// Convert to response format
	fileItems := make([]FileDurationItem, 0, len(rows))
	for _, row := range rows {
		item := FileDurationItem{
			ID:       row.ID,
			Name:     row.Name,
			Path:     row.Path,
			Size:     row.SizeBytes,
			Duration: int(row.Duration), // Convert float64 to int seconds
		}
		if row.Mime.Valid {
			item.MediaType = row.Mime.String
		}
		fileItems = append(fileItems, item)
	}

	totalPages := int((totalCount + int64(req.Limit) - 1) / int64(req.Limit))

	response := GetFilesByDurationResponse{
		Files:      fileItems,
		TotalCount: int(totalCount),
		Page:       req.Page,
		Limit:      req.Limit,
		TotalPages: totalPages,
	}

	c.JSON(http.StatusOK, response)
}

// GetFilesByLocation gets files filtered by GPS location metadata
// @Summary Get files by location
// @Description Retrieve files filtered by GPS coordinates with pagination support
// @Tags metadata
// @Accept json
// @Produce json
// @Param volume_id query string true "Volume ID" example(vol_123)
// @Param latitude query float64 false "GPS latitude" example(37.7749)
// @Param longitude query float64 false "GPS longitude" example(-122.4194)
// @Param radius query float64 false "Search radius in kilometers" example(10.0)
// @Param has_location query bool false "Filter files that have GPS data" example(true)
// @Param page query int false "Page number (default: 1)" example(1)
// @Param limit query int false "Items per page (default: 100, max: 500)" example(100)
// @Success 200 {object} GetFilesByLocationResponse "Files retrieved successfully"
// @Failure 400 {object} map[string]interface{} "Invalid request parameters"
// @Failure 500 {object} map[string]interface{} "Internal server error"
// @Router /api/v1/metadata/files/by-location [get]
func (h *Handler) GetFilesByLocation(c *gin.Context) {
	var req GetFilesByLocationRequest
	if err := c.ShouldBindQuery(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request parameters", "details": err.Error()})
		return
	}

	// Set defaults
	if req.Page < 1 {
		req.Page = 1
	}
	if req.Limit < 1 {
		req.Limit = 100
	}
	if req.Limit > 500 {
		req.Limit = 500
	}

	ctx := c.Request.Context()

	// Get SQLC queries from store
	queries, ok := h.store.Queries().(*sqlc.Queries)
	if !ok {
		utils.RespondWithInternalError(c, "Database queries not available", nil)
		return
	}

	// Calculate offset
	offset := int32((req.Page - 1) * req.Limit)

	// Query files by location
	rows, err := queries.GetFilesByLocation(ctx, sqlc.GetFilesByLocationParams{
		VolumeID: req.VolumeID,
		Limit:    int32(req.Limit),
		Offset:   offset,
	})
	if err != nil {
		utils.RespondWithInternalError(c, "Failed to query files by location", err)
		return
	}

	// Get total count
	totalCount, err := queries.CountFilesByLocation(ctx, req.VolumeID)
	if err != nil {
		utils.RespondWithInternalError(c, "Failed to count files", err)
		return
	}

	// Convert to response format
	fileItems := make([]FileLocationItem, 0, len(rows))
	for _, row := range rows {
		item := FileLocationItem{
			ID:        row.ID,
			Name:      row.Name,
			Path:      row.Path,
			Size:      row.SizeBytes,
			Latitude:  &row.Latitude,
			Longitude: &row.Longitude,
		}
		if row.Mime.Valid {
			item.MediaType = row.Mime.String
		}
		fileItems = append(fileItems, item)
	}

	totalPages := int((totalCount + int64(req.Limit) - 1) / int64(req.Limit))

	response := GetFilesByLocationResponse{
		Files:      fileItems,
		TotalCount: int(totalCount),
		Page:       req.Page,
		Limit:      req.Limit,
		TotalPages: totalPages,
	}

	c.JSON(http.StatusOK, response)
}

// GetFilterMetadata returns metadata for filter dropdowns
// @Summary Get filter metadata
// @Description Get available MIME types, media kinds, and extensions for filter dropdowns
// @Tags metadata
// @Accept json
// @Produce json
// @Success 200 {object} models.FilterMetadataResponse
// @Failure 500 {object} models.ErrorResponse
// @Router /api/v1/metadata/filters [get]
func (h *Handler) GetFilterMetadata(c *gin.Context) {
	ctx := c.Request.Context()

	// Get distinct MIME types - using empty volumeID for all volumes
	mimeTypes, err := h.store.FileMetadata().GetDistinctMimeTypes(ctx, "")
	if err != nil {
		utils.RespondWithInternalError(c, "Failed to retrieve MIME types", err)
		return
	}

	// Get distinct media kinds - using empty volumeID for all volumes
	mediaKinds, err := h.store.FileMetadata().GetDistinctMediaKinds(ctx, "")
	if err != nil {
		utils.RespondWithInternalError(c, "Failed to retrieve media kinds", err)
		return
	}

	// Get distinct extensions - using empty volumeID and limit of 100
	extensions, err := h.store.FileMetadata().GetDistinctExtensions(ctx, "", 100)
	if err != nil {
		utils.RespondWithInternalError(c, "Failed to retrieve extensions", err)
		return
	}

	// Create response with user-friendly labels
	response := models.FilterMetadataResponse{
		MimeTypes:  make([]models.MimeTypeOption, 0, len(mimeTypes)),
		MediaKinds: make([]models.MediaKindOption, 0, len(mediaKinds)),
		Extensions: make([]models.ExtensionOption, 0, len(extensions)),
	}

	// Convert MIME types with user-friendly labels
	for _, mt := range mimeTypes {
		mimeTypeStr := ""
		if mt.MimeType.Valid {
			mimeTypeStr = mt.MimeType.String
		}
		label := generateMimeTypeLabel(mimeTypeStr)
		response.MimeTypes = append(response.MimeTypes, models.MimeTypeOption{
			Value:     mimeTypeStr,
			Label:     label,
			FileCount: int(mt.Count),
		})
	}

	// Convert media kinds
	for _, mk := range mediaKinds {
		mediaKindStr := ""
		if mk.MediaKind.Valid {
			mediaKindStr = mk.MediaKind.String
		}
		response.MediaKinds = append(response.MediaKinds, models.MediaKindOption{
			Value:     mediaKindStr,
			Label:     capitalizeFirst(mediaKindStr),
			FileCount: int(mk.Count),
		})
	}

	// Convert extensions
	for _, ext := range extensions {
		extensionStr := ""
		if ext.Extension.Valid {
			extensionStr = ext.Extension.String
		}
		response.Extensions = append(response.Extensions, models.ExtensionOption{
			Value:     extensionStr,
			Label:     strings.ToUpper(extensionStr) + " Files",
			FileCount: int(ext.Count),
		})
	}

	c.JSON(http.StatusOK, response)
}

// generateMimeTypeLabel creates user-friendly labels for MIME types
func generateMimeTypeLabel(mimeType string) string {
	// Map of common MIME types to user-friendly labels
	labelMap := map[string]string{
		// Video
		"video/x-matroska": "MKV Video",
		"video/mp4":        "MP4 Video",
		"video/x-msvideo":  "AVI Video",
		"video/x-flv":      "FLV Video",
		"video/mp2t":       "TS Video",
		"video/quicktime":  "MOV Video",
		"video/webm":       "WebM Video",
		"video/x-ms-wmv":   "WMV Video",
		"video/3gpp":       "3GP Video",

		// Audio
		"audio/mpeg":     "MP3 Audio",
		"audio/flac":     "FLAC Audio",
		"audio/wav":      "WAV Audio",
		"audio/x-wav":    "WAV Audio",
		"audio/mp4":      "M4A Audio",
		"audio/ogg":      "OGG Audio",
		"audio/x-mod":    "MOD Audio",
		"audio/aac":      "AAC Audio",
		"audio/x-ms-wma": "WMA Audio",

		// Image
		"image/jpeg":    "JPEG Image",
		"image/png":     "PNG Image",
		"image/gif":     "GIF Image",
		"image/webp":    "WebP Image",
		"image/svg+xml": "SVG Image",
		"image/tiff":    "TIFF Image",
		"image/bmp":     "BMP Image",
		"image/x-icon":  "ICO Image",
		"image/heic":    "HEIC Image",

		// Document
		"application/pdf":        "PDF Document",
		"text/plain":             "Text File",
		"application/json":       "JSON File",
		"text/x-nfo":             "NFO File",
		"application/xml":        "XML File",
		"text/html":              "HTML File",
		"text/css":               "CSS File",
		"application/javascript": "JavaScript File",

		// Archive
		"application/zip":              "ZIP Archive",
		"application/x-rar-compressed": "RAR Archive",
		"application/x-7z-compressed":  "7Z Archive",
		"application/x-tar":            "TAR Archive",
		"application/gzip":             "GZIP Archive",
	}

	if label, exists := labelMap[mimeType]; exists {
		return label
	}

	// Fallback: create label from MIME type
	parts := strings.Split(mimeType, "/")
	if len(parts) == 2 {
		category := capitalizeFirst(parts[0])
		subtype := strings.ReplaceAll(parts[1], "-", " ")
		subtype = strings.ReplaceAll(subtype, "_", " ")
		subtype = capitalizeFirst(subtype)
		return fmt.Sprintf("%s (%s)", subtype, category)
	}

	return mimeType
}

// capitalizeFirst capitalizes the first letter of a string
func capitalizeFirst(s string) string {
	if len(s) == 0 {
		return s
	}
	return strings.ToUpper(s[:1]) + s[1:]
}

// getInt32Value safely converts a nullable int pointer to int32
func getInt32Value(ptr *int) int32 {
	if ptr == nil {
		return 0
	}
	return int32(*ptr)
}

// getFloat64Value safely converts a nullable float64 pointer to float64
func getFloat64Value(ptr *float64) float64 {
	if ptr == nil {
		return 0
	}
	return *ptr
}

// getFloat64FromInt safely converts a nullable int pointer to float64
func getFloat64FromInt(ptr *int) float64 {
	if ptr == nil {
		return 0
	}
	return float64(*ptr)
}
