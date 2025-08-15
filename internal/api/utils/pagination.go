package utils

// FilePaginationParams provides pagination params for files
type FilePaginationParams struct {
	Limit  int    `json:"limit"`
	Offset int    `json:"offset"`
	Path   string `json:"path,omitempty"`
}

// PaginatedResponse provides standard pagination response for files
type PaginatedResponse struct {
	Total  int         `json:"total"`
	Limit  int         `json:"limit"`
	Offset int         `json:"offset"`
	Data   interface{} `json:"data"`
}

// GetPaginationParamsFiles provides pagination for files
func GetPaginationParamsFiles(limit, offset int) FilePaginationParams {
	if limit <= 0 {
		limit = 50
	}
	if limit > 200 {
		limit = 200
	}
	if offset < 0 {
		offset = 0
	}

	// Page files with pagination support
	return FilePaginationParams{
		Limit:  limit,
		Offset: offset,
	}
}
