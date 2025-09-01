package search

import (
	"context"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/mantonx/volumeviz/internal/db/sqlc"
	sqlcSQLite "github.com/mantonx/volumeviz/internal/db/sqlc-sqlite"
	"github.com/mantonx/volumeviz/internal/repo"
	"github.com/mantonx/volumeviz/internal/store"
)

// Handler handles search-related endpoints
type Handler struct {
	store store.Store
}

// NewHandler creates a new search handler
func NewHandler(store store.Store) *Handler {
	return &Handler{
		store: store,
	}
}

// SearchFilesRequest represents the search request with advanced filters
type SearchFilesRequest struct {
	// Text search
	Q     string `form:"q" json:"q"`         // Query string for text search
	Path  string `form:"path" json:"path"`   // Path prefix filter
	Glob  string `form:"glob" json:"glob"`   // Glob pattern for path matching
	Regex string `form:"regex" json:"regex"` // Regex pattern for path matching

	// Media filters
	MediaKind string   `form:"mediaKind" json:"mediaKind"` // Media kind: video, audio, image, document
	Mime      []string `form:"mime" json:"mime"`           // MIME type filters

	// Size filters
	MinSize int64 `form:"minSize" json:"minSize"` // Minimum file size in bytes
	MaxSize int64 `form:"maxSize" json:"maxSize"` // Maximum file size in bytes

	// Time filters
	MtimeFrom time.Time `form:"mtimeFrom" json:"mtimeFrom" time_format:"2006-01-02T15:04:05Z"` // Modified time from
	MtimeTo   time.Time `form:"mtimeTo" json:"mtimeTo" time_format:"2006-01-02T15:04:05Z"`     // Modified time to

	// Media metadata filters
	DurationFrom int64 `form:"durationFrom" json:"durationFrom"` // Min duration in ms (video/audio)
	DurationTo   int64 `form:"durationTo" json:"durationTo"`     // Max duration in ms
	MinWidth     int32 `form:"minWidth" json:"minWidth"`         // Min width in pixels (video/image)
	MaxWidth     int32 `form:"maxWidth" json:"maxWidth"`         // Max width in pixels
	MinHeight    int32 `form:"minHeight" json:"minHeight"`       // Min height in pixels
	MaxHeight    int32 `form:"maxHeight" json:"maxHeight"`       // Max height in pixels
	HasGPS       *bool `form:"hasGps" json:"hasGps"`             // Has GPS coordinates
	HasSubs      *bool `form:"hasSubs" json:"hasSubs"`           // Has subtitles
	HashPresent  *bool `form:"hashPresent" json:"hashPresent"`   // Has computed hash

	// Pagination and sorting
	Page    int    `form:"page" json:"page" binding:"min=1"`
	PerPage int    `form:"perPage" json:"perPage" binding:"min=1,max=100"`
	Sort    string `form:"sort" json:"sort"`   // Sort field: relevance, name, size, mtime, ctime, duration, type, media_kind
	Order   string `form:"order" json:"order"` // Sort order: asc, desc
}

// SearchFilesResponse represents the search response
type SearchFilesResponse struct {
	Files       []FileResult `json:"files"`
	TotalCount  int64        `json:"total_count"`
	Page        int          `json:"page"`
	PerPage     int          `json:"per_page"`
	TotalPages  int          `json:"total_pages"`
	QueryTimeMs int64        `json:"query_time_ms"`
	Filters     interface{}  `json:"filters"`
}

// FileResult represents a search result
type FileResult struct {
	ID           int64                  `json:"id"`
	VolumeID     string                 `json:"volume_id"`
	Path         string                 `json:"path"`
	Name         string                 `json:"name"`
	Size         int64                  `json:"size"`
	DiskUsage    int64                  `json:"disk_usage"`
	Extension    string                 `json:"extension,omitempty"`
	MimeType     string                 `json:"mime_type,omitempty"`
	MediaKind    string                 `json:"media_kind,omitempty"`
	ModifiedTime *time.Time             `json:"modified_time,omitempty"`
	CreatedTime  *time.Time             `json:"created_time,omitempty"`
	Metadata     map[string]interface{} `json:"metadata,omitempty"`
	PreviewURL   string                 `json:"preview_url,omitempty"`

	// Media metadata
	Duration    *int64     `json:"duration_ms,omitempty"`
	Width       *int32     `json:"width,omitempty"`
	Height      *int32     `json:"height,omitempty"`
	VideoCodec  *string    `json:"video_codec,omitempty"`
	AudioCodec  *string    `json:"audio_codec,omitempty"`
	HasGPS      bool       `json:"has_gps,omitempty"`
	GPSLat      *float64   `json:"gps_lat,omitempty"`
	GPSLon      *float64   `json:"gps_lon,omitempty"`
	CameraModel *string    `json:"camera_model,omitempty"`
	CaptureDate *time.Time `json:"capture_date,omitempty"`
}

// SearchFiles performs advanced file search with filters
// @Summary Search files with advanced filters
// @Description Search files across volumes with text search and metadata filters
// @Tags Search
// @Accept json
// @Produce json
// @Param q query string false "Text search query"
// @Param path query string false "Path prefix filter"
// @Param glob query string false "Glob pattern"
// @Param regex query string false "Regex pattern"
// @Param mediaKind query string false "Media kind filter"
// @Param mime query []string false "MIME type filters"
// @Param minSize query int false "Minimum file size"
// @Param maxSize query int false "Maximum file size"
// @Param mtimeFrom query string false "Modified time from"
// @Param mtimeTo query string false "Modified time to"
// @Param durationFrom query int false "Min duration in ms"
// @Param durationTo query int false "Max duration in ms"
// @Param minWidth query int false "Min width in pixels"
// @Param maxWidth query int false "Max width in pixels"
// @Param minHeight query int false "Min height in pixels"
// @Param maxHeight query int false "Max height in pixels"
// @Param hasGps query bool false "Has GPS coordinates"
// @Param hasSubs query bool false "Has subtitles"
// @Param hashPresent query bool false "Has computed hash"
// @Param page query int false "Page number"
// @Param perPage query int false "Items per page"
// @Param sort query string false "Sort field"
// @Param order query string false "Sort order"
// @Success 200 {object} SearchFilesResponse
// @Router /api/v1/search/files [get]
func (h *Handler) SearchFiles(c *gin.Context) {
	var req SearchFilesRequest
	if err := c.ShouldBindQuery(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "Invalid request parameters",
			"details": err.Error(),
		})
		return
	}

	// Set defaults
	if req.Page < 1 {
		req.Page = 1
	}
	if req.PerPage < 1 {
		req.PerPage = 20
	}
	if req.PerPage > 100 {
		req.PerPage = 100
	}
	if req.Sort == "" {
		// Default to relevance when there's a search query, otherwise name
		if req.Q != "" {
			req.Sort = "relevance"
		} else {
			req.Sort = "name"
		}
	}
	if req.Order == "" {
		// Default order depends on sort field
		if req.Sort == "relevance" || req.Sort == "mtime" || req.Sort == "ctime" || req.Sort == "size" {
			req.Order = "desc" // Most relevant, newest, or largest first
		} else {
			req.Order = "asc" // Alphabetical, smallest first
		}
	}

	startTime := time.Now()

	// Convert request to repo parameters
	searchParams := h.buildSearchParams(req)

	// Execute search using repository
	results, totalCount, err := h.executeRepoSearch(c.Request.Context(), searchParams)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "Search failed",
			"details": err.Error(),
		})
		return
	}

	queryTime := time.Since(startTime).Milliseconds()

	// Calculate total pages
	totalPages := int(totalCount) / req.PerPage
	if int(totalCount)%req.PerPage > 0 {
		totalPages++
	}

	response := SearchFilesResponse{
		Files:       results,
		TotalCount:  totalCount,
		Page:        req.Page,
		PerPage:     req.PerPage,
		TotalPages:  totalPages,
		QueryTimeMs: queryTime,
		Filters:     h.getActiveFilters(req),
	}

	c.JSON(http.StatusOK, response)
}

// buildSearchParams converts request to repo parameters
func (h *Handler) buildSearchParams(req SearchFilesRequest) repo.SearchFilesParams {
	// Time filters
	var mtimeFrom, mtimeTo *time.Time
	if !req.MtimeFrom.IsZero() {
		mtimeFrom = &req.MtimeFrom
	}
	if !req.MtimeTo.IsZero() {
		mtimeTo = &req.MtimeTo
	}

	// Handle multiple MIME types by joining them
	mimeType := ""
	if len(req.Mime) > 0 {
		// For now, join multiple MIME types with comma - we'll handle OR logic in SQL
		mimeType = strings.Join(req.Mime, ",")
	}

	return repo.SearchFilesParams{
		SearchQuery:  req.Q,
		PathPrefix:   req.Path,
		MediaKind:    req.MediaKind,
		MimeType:     mimeType,
		MinSize:      req.MinSize,
		MaxSize:      req.MaxSize,
		MtimeFrom:    mtimeFrom,
		MtimeTo:      mtimeTo,
		DurationFrom: req.DurationFrom,
		DurationTo:   req.DurationTo,
		MinWidth:     req.MinWidth,
		MaxWidth:     req.MaxWidth,
		MinHeight:    req.MinHeight,
		MaxHeight:    req.MaxHeight,
		HasGPS:       req.HasGPS,
		HasSubs:      req.HasSubs,
		HasHash:      req.HashPresent,
		SortField:    req.Sort,
		SortOrder:    req.Order,
		PageOffset:   int32((req.Page - 1) * req.PerPage),
		PageLimit:    int32(req.PerPage),
	}
}

// executeRepoSearch executes search using repository
func (h *Handler) executeRepoSearch(ctx context.Context, params repo.SearchFilesParams) ([]FileResult, int64, error) {
	searchRepo := h.store.Search()

	// Get total count
	totalCount, err := searchRepo.CountSearchFiles(ctx, params)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to count search results: %w", err)
	}

	// Execute search
	filesInterface, err := searchRepo.SearchFiles(ctx, params)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to execute search: %w", err)
	}

	// Convert to FileResult based on database type
	var results []FileResult
	if filesInterface == nil {
		return results, totalCount, nil
	}

	// Type assertion based on the database type
	switch files := filesInterface.(type) {
	case []sqlc.SearchFilesRow:
		// PostgreSQL results
		results = make([]FileResult, len(files))
		for i, file := range files {
			results[i] = h.convertPostgreSQLFileRow(file)
		}
	case []sqlcSQLite.SearchFilesRow:
		// SQLite results
		results = make([]FileResult, len(files))
		for i, file := range files {
			results[i] = h.convertSQLiteFileRow(file)
		}
	default:
		return nil, 0, fmt.Errorf("unexpected search result type: %T", filesInterface)
	}

	return results, totalCount, nil
}

// canGeneratePreview checks if a preview can be generated for the given mime type
func (h *Handler) canGeneratePreview(mimeType string) bool {
	if mimeType == "" {
		return false
	}

	// Check if it's an image, video, or audio file
	return strings.HasPrefix(mimeType, "image/") ||
		strings.HasPrefix(mimeType, "video/") ||
		strings.HasPrefix(mimeType, "audio/")
}

// getActiveFilters returns the active filters for the response
func (h *Handler) getActiveFilters(req SearchFilesRequest) map[string]interface{} {
	filters := make(map[string]interface{})

	if req.Q != "" {
		filters["q"] = req.Q
	}
	if req.Path != "" {
		filters["path"] = req.Path
	}
	if req.Glob != "" {
		filters["glob"] = req.Glob
	}
	if req.MediaKind != "" {
		filters["mediaKind"] = req.MediaKind
	}
	if len(req.Mime) > 0 {
		filters["mime"] = req.Mime
	}
	if req.MinSize > 0 {
		filters["minSize"] = req.MinSize
	}
	if req.MaxSize > 0 {
		filters["maxSize"] = req.MaxSize
	}
	if !req.MtimeFrom.IsZero() {
		filters["mtimeFrom"] = req.MtimeFrom
	}
	if !req.MtimeTo.IsZero() {
		filters["mtimeTo"] = req.MtimeTo
	}
	if req.DurationFrom > 0 {
		filters["durationFrom"] = req.DurationFrom
	}
	if req.DurationTo > 0 {
		filters["durationTo"] = req.DurationTo
	}
	if req.MinWidth > 0 {
		filters["minWidth"] = req.MinWidth
	}
	if req.MaxWidth > 0 {
		filters["maxWidth"] = req.MaxWidth
	}
	if req.MinHeight > 0 {
		filters["minHeight"] = req.MinHeight
	}
	if req.MaxHeight > 0 {
		filters["maxHeight"] = req.MaxHeight
	}
	if req.HasGPS != nil {
		filters["hasGps"] = *req.HasGPS
	}
	if req.HasSubs != nil {
		filters["hasSubs"] = *req.HasSubs
	}
	if req.HashPresent != nil {
		filters["hashPresent"] = *req.HashPresent
	}

	return filters
}

// convertPostgreSQLFileRow converts PostgreSQL SearchFilesRow to FileResult
func (h *Handler) convertPostgreSQLFileRow(row sqlc.SearchFilesRow) FileResult {
	result := FileResult{
		ID:        row.ID,
		VolumeID:  row.VolumeID,
		Path:      row.Path,
		Name:      row.Name,
		Size:      row.SizeBytes,
		DiskUsage: row.SizeBytes, // Assume disk usage equals file size for now
	}

	// Handle optional fields
	if row.Extension.Valid {
		result.Extension = row.Extension.String
	}
	if row.Mime.Valid {
		result.MimeType = row.Mime.String
	}
	if row.MediaKind.Valid {
		result.MediaKind = row.MediaKind.String
	}

	// Time fields
	result.CreatedTime = &row.CreatedAt
	if row.ModifiedAt.Valid {
		result.ModifiedTime = &row.ModifiedAt.Time
	}
	if row.AccessedAt.Valid {
		result.CreatedTime = &row.AccessedAt.Time
	}

	// Generate preview URL if applicable
	if h.canGeneratePreview(result.MimeType) {
		result.PreviewURL = fmt.Sprintf("/api/v1/files/%d/preview", result.ID)
	}

	return result
}

// convertSQLiteFileRow converts SQLite SearchFilesRow to FileResult
func (h *Handler) convertSQLiteFileRow(row sqlcSQLite.SearchFilesRow) FileResult {
	result := FileResult{
		ID:        row.ID,
		VolumeID:  row.VolumeID,
		Path:      row.Path,
		Name:      row.Name,
		Size:      row.SizeBytes,
		DiskUsage: row.SizeBytes, // Assume disk usage equals file size for now
	}

	// Handle optional fields
	if row.Extension.Valid {
		result.Extension = row.Extension.String
	}
	if row.Mime.Valid {
		result.MimeType = row.Mime.String
	}
	if row.MediaKind.Valid {
		result.MediaKind = row.MediaKind.String
	}

	// Time fields
	result.CreatedTime = &row.CreatedAt
	// Note: SQLite has modified_at and accessed_at as strings, need to parse
	if row.ModifiedAt.Valid {
		if t, err := time.Parse(time.RFC3339, row.ModifiedAt.String); err == nil {
			result.ModifiedTime = &t
		}
	}
	// Note: Accessed time would need similar parsing but the FileResult doesn't have it

	// Generate preview URL if applicable
	if h.canGeneratePreview(result.MimeType) {
		result.PreviewURL = fmt.Sprintf("/api/v1/files/%d/preview", result.ID)
	}

	return result
}
