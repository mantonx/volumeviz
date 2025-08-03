package utils

import (
	"strings"
	"unicode"
)

// TrimAndUpper trims whitespace and converts to uppercase
// Useful for SQL query normalization
func TrimAndUpper(s string) string {
	return strings.TrimSpace(strings.ToUpper(s))
}

// ExtractFirstWord gets the first word from a string
// Strips quotes and handles empty strings gracefully
func ExtractFirstWord(s string) string {
	fields := strings.Fields(s)
	if len(fields) > 0 {
		return strings.Trim(fields[0], "\"'`")
	}
	return ""
}

// SplitAndGetAfter splits a string and returns the part after delimiter
// Returns empty string if delimiter not found
func SplitAndGetAfter(s, delimiter string) string {
	parts := strings.Split(s, delimiter)
	if len(parts) > 1 {
		return strings.TrimSpace(parts[1])
	}
	return ""
}

// HasAnyPrefix checks if string has any of the given prefixes
// Case-insensitive comparison
func HasAnyPrefix(s string, prefixes ...string) bool {
	upper := strings.ToUpper(s)
	for _, prefix := range prefixes {
		if strings.HasPrefix(upper, strings.ToUpper(prefix)) {
			return true
		}
	}
	return false
}

// ContainsAny checks if string contains any of the given substrings
// Case-insensitive comparison
func ContainsAny(s string, substrs ...string) bool {
	upper := strings.ToUpper(s)
	for _, substr := range substrs {
		if strings.Contains(upper, strings.ToUpper(substr)) {
			return true
		}
	}
	return false
}

// ContainsIgnoreCase checks if a string contains a substring (case-insensitive)
// Simpler version of ContainsAny for single substring check
func ContainsIgnoreCase(s, substr string) bool {
	return strings.Contains(strings.ToUpper(s), strings.ToUpper(substr))
}

// SafeLower converts to lowercase and trims quotes
// Handles nil/empty strings gracefully
func SafeLower(s string) string {
	return strings.ToLower(strings.Trim(s, "\"'`"))
}

// CamelToSnake converts CamelCase to snake_case
// Useful for struct field to database column conversion
func CamelToSnake(s string) string {
	var result strings.Builder
	for i, r := range s {
		if unicode.IsUpper(r) && i > 0 {
			result.WriteRune('_')
		}
		result.WriteRune(unicode.ToLower(r))
	}
	return result.String()
}

// SnakeToCamel converts snake_case to CamelCase
// Useful for database column to struct field conversion
func SnakeToCamel(s string) string {
	parts := strings.Split(s, "_")
	for i, part := range parts {
		if len(part) > 0 {
			parts[i] = strings.ToUpper(part[:1]) + part[1:]
		}
	}
	return strings.Join(parts, "")
}