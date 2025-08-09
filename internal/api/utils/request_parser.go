package utils

import (
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

// PaginationParams holds pagination parameters
type PaginationParams struct {
	Page     int
	PageSize int
	Offset   int
	Limit    int
}

// SortParam represents a single sort field with direction
type SortParam struct {
	Field     string
	Direction string // "asc" or "desc"
}

// VolumeFilters holds volume-specific filter parameters
type VolumeFilters struct {
	Query          string    // Search query (q parameter)
	Driver         string    // Exact driver match
	Orphaned       *bool     // Filter by orphaned status
	System         bool      // Include system volumes
	CreatedAfter   *time.Time
	CreatedBefore  *time.Time
}

// ParsePaginationParams extracts and validates pagination parameters from request
func ParsePaginationParams(c *gin.Context) (*PaginationParams, error) {
	pageStr := c.DefaultQuery("page", "1")
	pageSizeStr := c.DefaultQuery("page_size", "25")

	page, err := strconv.Atoi(pageStr)
	if err != nil || page < 1 {
		return nil, fmt.Errorf("invalid page parameter: must be a positive integer")
	}

	pageSize, err := strconv.Atoi(pageSizeStr)
	if err != nil || pageSize < 1 {
		return nil, fmt.Errorf("invalid page_size parameter: must be a positive integer")
	}

	// Enforce maximum page size
	const maxPageSize = 200
	if pageSize > maxPageSize {
		pageSize = maxPageSize
	}

	// Calculate offset and limit for database queries
	offset := (page - 1) * pageSize
	limit := pageSize

	return &PaginationParams{
		Page:     page,
		PageSize: pageSize,
		Offset:   offset,
		Limit:    limit,
	}, nil
}

// ParseSortParams extracts and validates sort parameters from request
// Format: "field1:dir1,field2:dir2" (e.g., "name:asc,size_bytes:desc")
func ParseSortParams(c *gin.Context, allowedFields []string) ([]SortParam, error) {
	sortStr := c.DefaultQuery("sort", "")
	if sortStr == "" {
		return nil, nil
	}

	var sortParams []SortParam
	parts := strings.Split(sortStr, ",")

	for _, part := range parts {
		part = strings.TrimSpace(part)
		if part == "" {
			continue
		}

		fieldDir := strings.Split(part, ":")
		if len(fieldDir) != 2 {
			return nil, fmt.Errorf("invalid sort format: %s (expected field:direction)", part)
		}

		field := strings.TrimSpace(fieldDir[0])
		direction := strings.ToLower(strings.TrimSpace(fieldDir[1]))

		// Validate field is allowed
		fieldAllowed := false
		for _, allowed := range allowedFields {
			if field == allowed {
				fieldAllowed = true
				break
			}
		}
		if !fieldAllowed {
			return nil, fmt.Errorf("invalid sort field: %s (allowed: %v)", field, allowedFields)
		}

		// Validate direction
		if direction != "asc" && direction != "desc" {
			return nil, fmt.Errorf("invalid sort direction: %s (must be 'asc' or 'desc')", direction)
		}

		sortParams = append(sortParams, SortParam{
			Field:     field,
			Direction: direction,
		})
	}

	return sortParams, nil
}

// ParseVolumeFilters extracts volume-specific filter parameters
func ParseVolumeFilters(c *gin.Context) (*VolumeFilters, error) {
	filters := &VolumeFilters{
		Query:  c.Query("q"),
		Driver: c.Query("driver"),
		System: c.DefaultQuery("system", "false") == "true",
	}

	// Parse orphaned filter
	if orphanedStr := c.Query("orphaned"); orphanedStr != "" {
		orphaned := orphanedStr == "true"
		filters.Orphaned = &orphaned
	}

	// Parse date filters
	if createdAfterStr := c.Query("created_after"); createdAfterStr != "" {
		t, err := time.Parse(time.RFC3339, createdAfterStr)
		if err != nil {
			return nil, fmt.Errorf("invalid created_after format: %v", err)
		}
		filters.CreatedAfter = &t
	}

	if createdBeforeStr := c.Query("created_before"); createdBeforeStr != "" {
		t, err := time.Parse(time.RFC3339, createdBeforeStr)
		if err != nil {
			return nil, fmt.Errorf("invalid created_before format: %v", err)
		}
		filters.CreatedBefore = &t
	}

	return filters, nil
}

// BuildSQLOrderBy constructs SQL ORDER BY clause from sort params
func BuildSQLOrderBy(sortParams []SortParam, fieldMapping map[string]string) string {
	if len(sortParams) == 0 {
		return ""
	}

	var orderParts []string
	for _, param := range sortParams {
		// Map API field names to database column names
		dbField := param.Field
		if mapped, ok := fieldMapping[param.Field]; ok {
			dbField = mapped
		}

		orderParts = append(orderParts, fmt.Sprintf("%s %s", dbField, strings.ToUpper(param.Direction)))
	}

	return "ORDER BY " + strings.Join(orderParts, ", ")
}

// PagedResponse represents a generic paginated response
type PagedResponse struct {
	Data       interface{}            `json:"data"`
	Page       int                    `json:"page"`
	PageSize   int                    `json:"page_size"`
	Total      int64                  `json:"total"`
	Sort       string                 `json:"sort,omitempty"`
	Filters    map[string]interface{} `json:"filters,omitempty"`
}

// BuildPagedResponse creates a standardized paged response
func BuildPagedResponse(data interface{}, pagination *PaginationParams, total int64, sortParams []SortParam, filters map[string]interface{}) PagedResponse {
	// Build sort string for response
	var sortStr string
	if len(sortParams) > 0 {
		var sortParts []string
		for _, param := range sortParams {
			sortParts = append(sortParts, fmt.Sprintf("%s:%s", param.Field, param.Direction))
		}
		sortStr = strings.Join(sortParts, ",")
	}

	return PagedResponse{
		Data:     data,
		Page:     pagination.Page,
		PageSize: pagination.PageSize,
		Total:    total,
		Sort:     sortStr,
		Filters:  filters,
	}
}