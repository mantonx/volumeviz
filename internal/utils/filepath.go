package utils

import (
	"os"
	"path/filepath"
	"strings"
)

// CalculatePathDepth calculates the depth of a path relative to a root path
func CalculatePathDepth(path, rootPath string) int {
	// Clean paths for comparison
	path = filepath.Clean(path)
	rootPath = filepath.Clean(rootPath)

	// Get relative path
	relPath, err := filepath.Rel(rootPath, path)
	if err != nil {
		return 0
	}

	// Count separators in relative path
	if relPath == "." {
		return 0
	}

	depth := strings.Count(relPath, string(os.PathSeparator))
	// Add 1 because depth 0 is the root itself
	return depth
}

// IsPathWithinDepth checks if a path is within the specified depth from root
func IsPathWithinDepth(path, rootPath string, maxDepth int) bool {
	if maxDepth < 0 {
		return true // No depth limit
	}
	depth := CalculatePathDepth(path, rootPath)
	return depth <= maxDepth
}

// GetRelativePath safely gets the relative path from root to target
func GetRelativePath(rootPath, targetPath string) string {
	relPath, err := filepath.Rel(rootPath, targetPath)
	if err != nil {
		return targetPath // Return absolute path if relative fails
	}
	return relPath
}

// IsHiddenFile checks if a file or directory is hidden (starts with .)
func IsHiddenFile(name string) bool {
	return strings.HasPrefix(name, ".")
}

// NormalizePath normalizes a file path for consistent comparison
func NormalizePath(path string) string {
	return filepath.Clean(path)
}
