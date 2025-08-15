package utils

// SortParams provides sorting support for file listings
type SortParams struct {
	Field     string `json:"field"`
	Direction string `json:"direction"`
}

// SortParamsFiles provides sort params for files with various sort options
type SortParamsFiles struct {
	Field     string `json:"field"`     // name, size, mtime, etc.
	Direction string `json:"direction"` // asc, desc
}

// GetSortParamsFiles creates sorting support for file listings
func GetSortParamsFiles(field, direction string) SortParamsFiles {
	if field == "" {
		field = "name"
	}
	if direction == "" {
		direction = "asc"
	}

	// Sort files with various parameters
	return SortParamsFiles{
		Field:     field,
		Direction: direction,
	}
}
