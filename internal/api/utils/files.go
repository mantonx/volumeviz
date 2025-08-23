package utils

import (
	"github.com/gin-gonic/gin"
)

// FilesPaginationParams represents pagination parameters specifically for files
type FilesPaginationParams struct {
	PaginationParams
	SortParams
	FilterParams
}

// ParseFilterParams extracts generic filter parameters from the context.
// You may need to adjust the returned struct according to your FilterParams definition.
func ParseFilterParams(c *gin.Context) FilterParams {
	// Example implementation, adjust fields as needed
	return FilterParams{
		// Add field extraction logic here, e.g.:
		// Name: c.Query("name"),
	}
}

// SortParamsForFiles represents sorting parameters specifically for file listings
type SortParamsForFiles struct {
	SortBy    string `json:"sort_by" example:"name"`
	SortOrder string `json:"sort_order" example:"asc"`
}

// ExtensionFilterParams represents extension-based filtering for files
type ExtensionFilterParams struct {
	Extension   string `json:"extension" example:"pdf"`
	MimeFilter  string `json:"mime_filter" example:"application/pdf"`
	MediaFilter string `json:"media_filter" example:"video"`
}

// ParseFilesPaginationParams extracts pagination parameters for file listings
func ParseFilesPaginationParams(c *gin.Context) FilesPaginationParams {
	paginationParams, _ := ParsePaginationParams(c)
	sortParams, _ := ParseSortParams(c, []string{"name", "date", "size"})

	// Convert []SortParam to SortParams (using the first sort parameter if available)
	var sortParam SortParams
	if len(sortParams) > 0 {
		sortParam.Field = sortParams[0].Field
		sortParam.Direction = sortParams[0].Direction
	} else {
		sortParam.Field = "name"
		sortParam.Direction = "asc"
	}

	return FilesPaginationParams{
		PaginationParams: *paginationParams,
		SortParams:       sortParam,
		FilterParams:     ParseFilterParams(c),
	}
}

// ParseSortParamsForFiles extracts sorting parameters for file operations
func ParseSortParamsForFiles(c *gin.Context) SortParamsForFiles {
	params := SortParamsForFiles{
		SortBy:    "name",
		SortOrder: "asc",
	}

	if sortBy := c.Query("sort_by"); sortBy != "" {
		params.SortBy = sortBy
	}

	if sortOrder := c.Query("sort_order"); sortOrder != "" {
		params.SortOrder = sortOrder
	}

	return params
}

// ParseExtensionFilterParams extracts extension and mime filtering parameters
func ParseExtensionFilterParams(c *gin.Context) ExtensionFilterParams {
	return ExtensionFilterParams{
		Extension:   c.Query("extension"),
		MimeFilter:  c.Query("mime_filter"),
		MediaFilter: c.Query("media_filter"),
	}
}
