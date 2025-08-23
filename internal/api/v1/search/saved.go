package search

import (
	"encoding/json"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/mantonx/volumeviz/internal/db/sqlc"
	"github.com/mantonx/volumeviz/internal/repo"
)

// SavedSearch represents a saved search query
type SavedSearch struct {
	ID          int64                  `json:"id"`
	Name        string                 `json:"name" binding:"required"`
	Description string                 `json:"description"`
	Query       SearchFilesRequest     `json:"query"`
	Tags        []string               `json:"tags"`
	IsPublic    bool                   `json:"is_public"`
	CreatedAt   time.Time              `json:"created_at"`
	UpdatedAt   time.Time              `json:"updated_at"`
	LastRunAt   *time.Time             `json:"last_run_at,omitempty"`
	RunCount    int                    `json:"run_count"`
	Metadata    map[string]interface{} `json:"metadata,omitempty"`
}

// CreateSavedSearchRequest represents a request to create a saved search
type CreateSavedSearchRequest struct {
	Name        string                 `json:"name" binding:"required"`
	Description string                 `json:"description"`
	Query       SearchFilesRequest     `json:"query" binding:"required"`
	Tags        []string               `json:"tags"`
	IsPublic    bool                   `json:"is_public"`
	Metadata    map[string]interface{} `json:"metadata"`
}

// UpdateSavedSearchRequest represents a request to update a saved search
type UpdateSavedSearchRequest struct {
	Name        string                 `json:"name"`
	Description string                 `json:"description"`
	Query       *SearchFilesRequest    `json:"query"`
	Tags        []string               `json:"tags"`
	IsPublic    *bool                  `json:"is_public"`
	Metadata    map[string]interface{} `json:"metadata"`
}

// ListSavedSearchesResponse represents a list of saved searches
type ListSavedSearchesResponse struct {
	Searches   []SavedSearch `json:"searches"`
	TotalCount int           `json:"total_count"`
	Page       int           `json:"page"`
	PerPage    int           `json:"per_page"`
}

// CreateSavedSearch creates a new saved search
// @Summary Create a saved search
// @Description Save a search query for later use
// @Tags Search
// @Accept json
// @Produce json
// @Param search body CreateSavedSearchRequest true "Saved search details"
// @Success 201 {object} SavedSearch
// @Router /api/v1/search/saved [post]
func (h *Handler) CreateSavedSearch(c *gin.Context) {
	var req CreateSavedSearchRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "Invalid request body",
			"details": err.Error(),
		})
		return
	}

	// Convert query to map for storage
	queryMap := make(map[string]interface{})
	queryBytes, _ := json.Marshal(req.Query)
	json.Unmarshal(queryBytes, &queryMap)

	// Create using repository
	searchRepo := h.store.Search()
	result, err := searchRepo.CreateSavedSearch(c.Request.Context(), repo.SavedSearchParams{
		Name:        req.Name,
		Description: req.Description,
		Query:       queryMap,
		Tags:        req.Tags,
		IsPublic:    req.IsPublic,
		Metadata:    req.Metadata,
	})

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "Failed to save search",
			"details": err.Error(),
		})
		return
	}

	// Convert to response format
	savedSearch := h.convertSavedSearch(result)
	c.JSON(http.StatusCreated, savedSearch)
}

// ListSavedSearches lists all saved searches
// @Summary List saved searches
// @Description Get a list of all saved searches
// @Tags Search
// @Accept json
// @Produce json
// @Param page query int false "Page number"
// @Param perPage query int false "Items per page"
// @Param tags query []string false "Filter by tags"
// @Success 200 {object} ListSavedSearchesResponse
// @Router /api/v1/search/saved [get]
func (h *Handler) ListSavedSearches(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	perPage, _ := strconv.Atoi(c.DefaultQuery("perPage", "20"))
	tags := c.QueryArray("tags")

	if page < 1 {
		page = 1
	}
	if perPage < 1 {
		perPage = 20
	}
	if perPage > 100 {
		perPage = 100
	}

	// Use repository to list saved searches
	searchRepo := h.store.Search()

	// Get count first
	totalCount, err := searchRepo.CountSavedSearches(c.Request.Context(), tags)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "Failed to count searches",
			"details": err.Error(),
		})
		return
	}

	// Get paginated results
	offset := (page - 1) * perPage
	var results []sqlc.SavedSearches
	results, err = searchRepo.ListSavedSearches(c.Request.Context(), repo.ListSavedSearchesParams{
		FilterTags: tags,
		PageLimit:  int32(perPage),
		PageOffset: int32(offset),
	})

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "Failed to list searches",
			"details": err.Error(),
		})
		return
	}

	// Convert to response format
	var searches []SavedSearch
	for _, result := range results {
		searches = append(searches, h.convertSavedSearch(&result))
	}

	c.JSON(http.StatusOK, ListSavedSearchesResponse{
		Searches:   searches,
		TotalCount: int(totalCount),
		Page:       page,
		PerPage:    perPage,
	})
}

// convertSavedSearch converts sqlc.SavedSearches to SavedSearch
func (h *Handler) convertSavedSearch(s *sqlc.SavedSearches) SavedSearch {
	result := SavedSearch{
		ID:        s.ID,
		Name:      s.Name,
		CreatedAt: s.CreatedAt,
		UpdatedAt: s.UpdatedAt,
		RunCount:  int(s.RunCount.Int32),
	}

	// Handle nullable fields
	if s.Description.Valid {
		result.Description = s.Description.String
	}
	if s.IsPublic.Valid {
		result.IsPublic = s.IsPublic.Bool
	}
	if s.LastRunAt.Valid {
		result.LastRunAt = &s.LastRunAt.Time
	}
	if len(s.Tags) > 0 {
		result.Tags = s.Tags
	}

	// Parse query JSON
	if len(s.Query) > 0 {
		json.Unmarshal(s.Query, &result.Query)
	}

	// Parse metadata JSON
	if len(s.Metadata) > 0 {
		json.Unmarshal(s.Metadata, &result.Metadata)
	}

	return result
}

// GetSavedSearch retrieves a saved search by ID
// @Summary Get a saved search
// @Description Get details of a specific saved search
// @Tags Search
// @Accept json
// @Produce json
// @Param id path int true "Saved search ID"
// @Success 200 {object} SavedSearch
// @Router /api/v1/search/saved/{id} [get]
func (h *Handler) GetSavedSearch(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid search ID",
		})
		return
	}

	// Use repository to get saved search
	searchRepo := h.store.Search()
	result, err := searchRepo.GetSavedSearch(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error": "Saved search not found",
		})
		return
	}

	// Convert to response format
	savedSearch := h.convertSavedSearch(result)
	c.JSON(http.StatusOK, savedSearch)
}

// UpdateSavedSearch updates a saved search
// @Summary Update a saved search
// @Description Update an existing saved search
// @Tags Search
// @Accept json
// @Produce json
// @Param id path int true "Saved search ID"
// @Param search body UpdateSavedSearchRequest true "Updated search details"
// @Success 200 {object} SavedSearch
// @Router /api/v1/search/saved/{id} [put]
func (h *Handler) UpdateSavedSearch(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid search ID",
		})
		return
	}

	var req UpdateSavedSearchRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "Invalid request body",
			"details": err.Error(),
		})
		return
	}

	// Convert query to map if provided
	var queryMap map[string]interface{}
	if req.Query != nil {
		queryBytes, _ := json.Marshal(req.Query)
		json.Unmarshal(queryBytes, &queryMap)
	}

	// Use repository to update
	searchRepo := h.store.Search()
	result, err := searchRepo.UpdateSavedSearch(c.Request.Context(), repo.UpdateSavedSearchParams{
		ID:          id,
		Name:        &req.Name,
		Description: &req.Description,
		Query:       queryMap,
		Tags:        req.Tags,
		IsPublic:    req.IsPublic,
		Metadata:    req.Metadata,
	})

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "Failed to update search",
			"details": err.Error(),
		})
		return
	}

	// Convert to response format
	savedSearch := h.convertSavedSearch(result)
	c.JSON(http.StatusOK, savedSearch)
}

// DeleteSavedSearch deletes a saved search
// @Summary Delete a saved search
// @Description Delete a saved search by ID
// @Tags Search
// @Accept json
// @Produce json
// @Param id path int true "Saved search ID"
// @Success 204 "No content"
// @Router /api/v1/search/saved/{id} [delete]
func (h *Handler) DeleteSavedSearch(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid search ID",
		})
		return
	}

	// Use repository to delete
	searchRepo := h.store.Search()
	err = searchRepo.DeleteSavedSearch(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "Failed to delete search",
			"details": err.Error(),
		})
		return
	}

	c.Status(http.StatusNoContent)
}

// RunSavedSearch executes a saved search
// @Summary Run a saved search
// @Description Execute a saved search and return results
// @Tags Search
// @Accept json
// @Produce json
// @Param id path int true "Saved search ID"
// @Success 200 {object} SearchFilesResponse
// @Router /api/v1/search/saved/{id}/run [post]
func (h *Handler) RunSavedSearch(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid search ID",
		})
		return
	}

	searchRepo := h.store.Search()

	// Get saved search query
	queryJSON, err := searchRepo.GetSavedSearchQuery(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error": "Saved search not found",
		})
		return
	}

	// Unmarshal query
	var searchQuery SearchFilesRequest
	if err := json.Unmarshal(queryJSON, &searchQuery); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "Failed to parse saved query",
			"details": err.Error(),
		})
		return
	}

	// Update last run time and run count
	searchRepo.UpdateSavedSearchStats(c.Request.Context(), id)

	// Execute the search using repository
	startTime := time.Now()
	searchParams := h.buildSearchParams(searchQuery)
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
	totalPages := int(totalCount) / searchQuery.PerPage
	if int(totalCount)%searchQuery.PerPage > 0 {
		totalPages++
	}

	response := SearchFilesResponse{
		Files:       results,
		TotalCount:  totalCount,
		Page:        searchQuery.Page,
		PerPage:     searchQuery.PerPage,
		TotalPages:  totalPages,
		QueryTimeMs: queryTime,
		Filters:     h.getActiveFilters(searchQuery),
	}

	c.JSON(http.StatusOK, response)
}
