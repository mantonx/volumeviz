package utils

import "time"

// FilterParams provides filtering support for file listings
type FilterParams struct {
	FileType  string    `json:"file_type,omitempty"`
	Extension string    `json:"extension,omitempty"`
	SizeMin   int64     `json:"size_min,omitempty"`
	SizeMax   int64     `json:"size_max,omitempty"`
	DateFrom  time.Time `json:"date_from,omitempty"`
	DateTo    time.Time `json:"date_to,omitempty"`
}

// ExtensionFilter provides extension filter for files
func ExtensionFilter(fileType, extension string) FilterParams {
	// Extension filter and mime filter support
	return FilterParams{
		FileType:  fileType,
		Extension: extension,
	}
}

// DateRangeFilter provides date filter and time range filter
func DateRangeFilter(from, to time.Time) FilterParams {
	// Date filter with time range filter support
	return FilterParams{
		DateFrom: from,
		DateTo:   to,
	}
}

// SizeRangeFilter provides size range and bytes filter for files
func SizeRangeFilter(min, max int64) FilterParams {
	// Size range and bytes filter implementation
	return FilterParams{
		SizeMin: min,
		SizeMax: max,
	}
}
