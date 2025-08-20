package search

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
)

// SearchSuggestionsRequest represents the suggestions request
type SearchSuggestionsRequest struct {
	Q     string `form:"q" json:"q" binding:"required,min=1"`           // Partial query string
	Limit int    `form:"limit" json:"limit" binding:"min=1,max=20"`     // Max suggestions to return
	Type  string `form:"type" json:"type"`                              // Suggestion type: "filename", "extension", "path"
}

// SearchSuggestion represents a single search suggestion
type SearchSuggestion struct {
	Text        string `json:"text"`                    // Suggested text
	Type        string `json:"type"`                    // Type: "filename", "extension", "path", "recent"
	Description string `json:"description,omitempty"`  // Optional description
	Count       int64  `json:"count,omitempty"`        // Number of matching files
}

// SearchSuggestionsResponse represents the suggestions response
type SearchSuggestionsResponse struct {
	Suggestions []SearchSuggestion `json:"suggestions"`
	QueryTime   int64              `json:"query_time_ms"`
}

// GetSearchSuggestions provides intelligent search suggestions
// @Summary Get search suggestions
// @Description Get intelligent search suggestions based on partial query
// @Tags Search
// @Accept json
// @Produce json
// @Param q query string true "Partial query string"
// @Param limit query int false "Maximum suggestions to return (1-20)" default(10)
// @Param type query string false "Suggestion type filter"
// @Success 200 {object} SearchSuggestionsResponse
// @Router /api/v1/search/suggestions [get]
func (h *Handler) GetSearchSuggestions(c *gin.Context) {
	var req SearchSuggestionsRequest
	if err := c.ShouldBindQuery(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "Invalid request parameters",
			"details": err.Error(),
		})
		return
	}

	// Set defaults
	if req.Limit < 1 {
		req.Limit = 10
	}
	if req.Limit > 20 {
		req.Limit = 20
	}

	suggestions, err := h.generateSuggestions(c, req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "Failed to generate suggestions",
			"details": err.Error(),
		})
		return
	}

	// Ensure suggestions is never nil
	if suggestions == nil {
		suggestions = []SearchSuggestion{}
	}

	response := SearchSuggestionsResponse{
		Suggestions: suggestions,
		QueryTime:   1, // Placeholder - would measure actual time
	}

	c.JSON(http.StatusOK, response)
}

// generateSuggestions creates intelligent suggestions based on the query
func (h *Handler) generateSuggestions(c *gin.Context, req SearchSuggestionsRequest) ([]SearchSuggestion, error) {
	query := strings.ToLower(strings.TrimSpace(req.Q))
	suggestions := make([]SearchSuggestion, 0, req.Limit) // Initialize with capacity

	// For now, just provide smart suggestions since we need to add the SQL queries
	// TODO: Add file name, extension, and path suggestions once SQL queries are ready

	// 4. Add some smart suggestions for common patterns
	smartSuggestions := h.getSmartSuggestions(query)
	suggestions = append(suggestions, smartSuggestions...)

	// Limit and sort by relevance
	if len(suggestions) > req.Limit {
		suggestions = suggestions[:req.Limit]
	}

	return suggestions, nil
}

// getSmartSuggestions provides intelligent suggestions based on patterns
func (h *Handler) getSmartSuggestions(query string) []SearchSuggestion {
	var suggestions []SearchSuggestion
	lowerQuery := strings.ToLower(query)

	// Media type suggestions
	mediaKeywords := map[string][]string{
		"video": {"mediaKind:video", "Filter by video files"},
		"movie": {"mediaKind:video", "Filter by video files"},
		"film":  {"mediaKind:video", "Filter by video files"},
		"audio": {"mediaKind:audio", "Filter by audio files"},
		"music": {"mediaKind:audio", "Filter by audio files"},
		"song":  {"mediaKind:audio", "Filter by audio files"},
		"image": {"mediaKind:image", "Filter by image files"},
		"photo": {"mediaKind:image", "Filter by image files"},
		"pic":   {"mediaKind:image", "Filter by image files"},
		"doc":   {"mediaKind:document", "Filter by document files"},
		"pdf":   {"mediaKind:document", "Filter by document files"},
		"text":  {"mediaKind:document", "Filter by document files"},
	}

	for keyword, filterData := range mediaKeywords {
		if strings.Contains(lowerQuery, keyword) {
			suggestions = append(suggestions, SearchSuggestion{
				Text:        filterData[0],
				Type:        "filter",
				Description: filterData[1],
			})
		}
	}

	// Size suggestions
	sizeKeywords := map[string][]string{
		"large": {"minSize:100MB", "Files larger than 100MB"},
		"big":   {"minSize:100MB", "Files larger than 100MB"},
		"huge":  {"minSize:1GB", "Files larger than 1GB"},
		"small": {"maxSize:1MB", "Files smaller than 1MB"},
		"tiny":  {"maxSize:100KB", "Files smaller than 100KB"},
	}

	for keyword, filterData := range sizeKeywords {
		if strings.Contains(lowerQuery, keyword) {
			suggestions = append(suggestions, SearchSuggestion{
				Text:        filterData[0],
				Type:        "filter",
				Description: filterData[1],
			})
		}
	}

	// Date/time suggestions
	timeKeywords := map[string][]string{
		"recent":    {"mtimeFrom:7d", "Files modified in last 7 days"},
		"today":     {"mtimeFrom:1d", "Files modified today"},
		"yesterday": {"mtimeFrom:1d mtimeTo:1d", "Files modified yesterday"},
		"week":      {"mtimeFrom:7d", "Files from this week"},
		"month":     {"mtimeFrom:30d", "Files from this month"},
		"old":       {"mtimeTo:365d", "Files older than 1 year"},
	}

	for keyword, filterData := range timeKeywords {
		if strings.Contains(lowerQuery, keyword) {
			suggestions = append(suggestions, SearchSuggestion{
				Text:        filterData[0],
				Type:        "filter",
				Description: filterData[1],
			})
		}
	}

	// Common file extensions
	if strings.Contains(lowerQuery, ".") || len(lowerQuery) <= 4 {
		extensions := []string{
			"mp4", "mkv", "avi", "mov", "wmv",
			"mp3", "flac", "wav", "aac",
			"jpg", "jpeg", "png", "gif", "webp",
			"pdf", "docx", "txt", "md",
			"zip", "rar", "7z", "tar",
		}

		for _, ext := range extensions {
			if strings.Contains(lowerQuery, ext) || (len(lowerQuery) <= 3 && strings.HasPrefix(ext, lowerQuery)) {
				suggestions = append(suggestions, SearchSuggestion{
					Text:        "*." + ext,
					Type:        "extension",
					Description: "Files with ." + ext + " extension",
				})
				// Limit extension suggestions
				if len(suggestions) >= 3 {
					break
				}
			}
		}
	}

	// Feature suggestions
	featureKeywords := map[string][]string{
		"gps":      {"hasGps:true", "Files with GPS coordinates"},
		"location": {"hasGps:true", "Files with GPS coordinates"},
		"subtitle": {"hasSubs:true", "Files with subtitles"},
		"subs":     {"hasSubs:true", "Files with subtitles"},
		"hash":     {"hashPresent:true", "Files with computed hash"},
		"hd":       {"minWidth:1280 minHeight:720", "HD quality videos/images"},
		"4k":       {"minWidth:3840 minHeight:2160", "4K quality videos/images"},
	}

	for keyword, filterData := range featureKeywords {
		if strings.Contains(lowerQuery, keyword) {
			suggestions = append(suggestions, SearchSuggestion{
				Text:        filterData[0],
				Type:        "filter",
				Description: filterData[1],
			})
		}
	}

	return suggestions
}