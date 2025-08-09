package utils

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
)

func TestParsePaginationParams(t *testing.T) {
	gin.SetMode(gin.TestMode)

	tests := []struct {
		name        string
		query       string
		expected    *PaginationParams
		expectError bool
	}{
		{
			name:  "default values",
			query: "",
			expected: &PaginationParams{
				Page:     1,
				PageSize: 25,
				Offset:   0,
				Limit:    25,
			},
		},
		{
			name:  "custom values",
			query: "page=3&page_size=50",
			expected: &PaginationParams{
				Page:     3,
				PageSize: 50,
				Offset:   100,
				Limit:    50,
			},
		},
		{
			name:  "max page size enforced",
			query: "page=1&page_size=500",
			expected: &PaginationParams{
				Page:     1,
				PageSize: 200,
				Offset:   0,
				Limit:    200,
			},
		},
		{
			name:        "invalid page",
			query:       "page=0",
			expectError: true,
		},
		{
			name:        "invalid page_size",
			query:       "page_size=-5",
			expectError: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodGet, "/?"+tt.query, nil)
			w := httptest.NewRecorder()
			c, _ := gin.CreateTestContext(w)
			c.Request = req

			result, err := ParsePaginationParams(c)

			if tt.expectError {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)
				assert.Equal(t, tt.expected, result)
			}
		})
	}
}

func TestParseSortParams(t *testing.T) {
	gin.SetMode(gin.TestMode)
	allowedFields := []string{"name", "driver", "created_at", "size_bytes"}

	tests := []struct {
		name        string
		query       string
		expected    []SortParam
		expectError bool
	}{
		{
			name:     "empty sort",
			query:    "",
			expected: nil,
		},
		{
			name:  "single sort field",
			query: "sort=name:asc",
			expected: []SortParam{
				{Field: "name", Direction: "asc"},
			},
		},
		{
			name:  "multiple sort fields",
			query: "sort=size_bytes:desc,name:asc",
			expected: []SortParam{
				{Field: "size_bytes", Direction: "desc"},
				{Field: "name", Direction: "asc"},
			},
		},
		{
			name:        "invalid field",
			query:       "sort=invalid_field:asc",
			expectError: true,
		},
		{
			name:        "invalid direction",
			query:       "sort=name:invalid",
			expectError: true,
		},
		{
			name:        "invalid format",
			query:       "sort=name-asc",
			expectError: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodGet, "/?"+tt.query, nil)
			w := httptest.NewRecorder()
			c, _ := gin.CreateTestContext(w)
			c.Request = req

			result, err := ParseSortParams(c, allowedFields)

			if tt.expectError {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)
				assert.Equal(t, tt.expected, result)
			}
		})
	}
}

func TestParseVolumeFilters(t *testing.T) {
	gin.SetMode(gin.TestMode)

	tests := []struct {
		name        string
		query       string
		check       func(t *testing.T, filters *VolumeFilters)
		expectError bool
	}{
		{
			name:  "empty filters",
			query: "",
			check: func(t *testing.T, filters *VolumeFilters) {
				assert.Empty(t, filters.Query)
				assert.Empty(t, filters.Driver)
				assert.Nil(t, filters.Orphaned)
				assert.False(t, filters.System)
			},
		},
		{
			name:  "all filters",
			query: "q=test&driver=local&orphaned=true&system=true",
			check: func(t *testing.T, filters *VolumeFilters) {
				assert.Equal(t, "test", filters.Query)
				assert.Equal(t, "local", filters.Driver)
				assert.NotNil(t, filters.Orphaned)
				assert.True(t, *filters.Orphaned)
				assert.True(t, filters.System)
			},
		},
		{
			name:  "date filters",
			query: "created_after=2025-01-01T00:00:00Z&created_before=2025-12-31T23:59:59Z",
			check: func(t *testing.T, filters *VolumeFilters) {
				assert.NotNil(t, filters.CreatedAfter)
				assert.NotNil(t, filters.CreatedBefore)
				assert.Equal(t, 2025, filters.CreatedAfter.Year())
				assert.Equal(t, 2025, filters.CreatedBefore.Year())
			},
		},
		{
			name:        "invalid date format",
			query:       "created_after=invalid-date",
			expectError: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodGet, "/?"+tt.query, nil)
			w := httptest.NewRecorder()
			c, _ := gin.CreateTestContext(w)
			c.Request = req

			result, err := ParseVolumeFilters(c)

			if tt.expectError {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)
				if tt.check != nil {
					tt.check(t, result)
				}
			}
		})
	}
}

func TestBuildSQLOrderBy(t *testing.T) {
	tests := []struct {
		name         string
		sortParams   []SortParam
		fieldMapping map[string]string
		expected     string
	}{
		{
			name:       "empty sort params",
			sortParams: nil,
			expected:   "",
		},
		{
			name: "single sort field",
			sortParams: []SortParam{
				{Field: "name", Direction: "asc"},
			},
			expected: "ORDER BY name ASC",
		},
		{
			name: "multiple sort fields",
			sortParams: []SortParam{
				{Field: "size_bytes", Direction: "desc"},
				{Field: "name", Direction: "asc"},
			},
			expected: "ORDER BY size_bytes DESC, name ASC",
		},
		{
			name: "with field mapping",
			sortParams: []SortParam{
				{Field: "created_at", Direction: "desc"},
			},
			fieldMapping: map[string]string{
				"created_at": "created_timestamp",
			},
			expected: "ORDER BY created_timestamp DESC",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := BuildSQLOrderBy(tt.sortParams, tt.fieldMapping)
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestBuildPagedResponse(t *testing.T) {
	data := []string{"item1", "item2", "item3"}
	pagination := &PaginationParams{
		Page:     2,
		PageSize: 10,
	}
	sortParams := []SortParam{
		{Field: "name", Direction: "asc"},
		{Field: "size", Direction: "desc"},
	}
	filters := map[string]interface{}{
		"driver": "local",
		"system": false,
	}

	response := BuildPagedResponse(data, pagination, 100, sortParams, filters)

	assert.Equal(t, data, response.Data)
	assert.Equal(t, 2, response.Page)
	assert.Equal(t, 10, response.PageSize)
	assert.Equal(t, int64(100), response.Total)
	assert.Equal(t, "name:asc,size:desc", response.Sort)
	assert.Equal(t, filters, response.Filters)
}