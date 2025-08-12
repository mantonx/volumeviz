// Package utils provides utilities for path hashing and other common operations
package utils

import (
	"encoding/binary"
	"path/filepath"
	"strings"

	"github.com/cespare/xxhash/v2"
)

// PathHasher provides path hashing utilities for file system indexing
// Uses xxhash for fast, collision-resistant hashing of file paths
type PathHasher struct {
	seed uint64
}

// NewPathHasher creates a new PathHasher with an optional seed
func NewPathHasher(seed uint64) *PathHasher {
	return &PathHasher{seed: seed}
}

// DefaultPathHasher returns a PathHasher with default seed
var DefaultPathHasher = NewPathHasher(0x123456789abcdef0)

// HashPath computes a 16-byte hash of the given file path
// Normalizes path separators and handles case-insensitive filesystems
// Returns a fixed-length byte array suitable for database indexing
func (p *PathHasher) HashPath(volumeID, fullPath string) []byte {
	// Normalize the path to handle cross-platform compatibility
	normalizedPath := p.normalizePath(fullPath)

	// Create a combined key with volume ID for uniqueness across volumes
	combinedKey := volumeID + ":" + normalizedPath

	// Compute xxhash64
	hash1 := xxhash.Sum64String(combinedKey)

	// Compute a second hash with different seed for 128-bit output
	hash2 := xxhash.Sum64String(combinedKey + ":salt")

	// Combine into 16-byte hash
	result := make([]byte, 16)
	binary.LittleEndian.PutUint64(result[0:8], hash1)
	binary.LittleEndian.PutUint64(result[8:16], hash2)

	return result
}

// HashPathDefault is a convenience function using the default hasher
func HashPathDefault(volumeID, fullPath string) []byte {
	return DefaultPathHasher.HashPath(volumeID, fullPath)
}

// normalizePath normalizes file paths for consistent hashing
// Handles path separators, case sensitivity, and removes redundant elements
func (p *PathHasher) normalizePath(path string) string {
	// Convert to forward slashes for consistency
	normalized := filepath.ToSlash(path)

	// Remove duplicate slashes
	for strings.Contains(normalized, "//") {
		normalized = strings.ReplaceAll(normalized, "//", "/")
	}

	// Remove trailing slash except for root
	if len(normalized) > 1 && strings.HasSuffix(normalized, "/") {
		normalized = strings.TrimSuffix(normalized, "/")
	}

	// Ensure absolute path starts with /
	if !strings.HasPrefix(normalized, "/") {
		normalized = "/" + normalized
	}

	return normalized
}

// ComputeFullPath constructs the full path from parent directory path and name
func ComputeFullPath(parentPath, name string) string {
	if parentPath == "" || parentPath == "/" {
		return "/" + name
	}

	// Ensure parent path doesn't end with /
	parentPath = strings.TrimSuffix(parentPath, "/")
	return parentPath + "/" + name
}

// GetParentPath extracts the parent directory path from a full path
func GetParentPath(fullPath string) string {
	if fullPath == "" || fullPath == "/" {
		return ""
	}

	// Normalize first
	normalized := DefaultPathHasher.normalizePath(fullPath)

	// Get parent directory
	parent := filepath.Dir(normalized)
	if parent == "." {
		return "/"
	}

	return parent
}

// GetDepth calculates the directory depth from the root
func GetDepth(fullPath string) int {
	if fullPath == "" || fullPath == "/" {
		return 0
	}

	normalized := DefaultPathHasher.normalizePath(fullPath)

	// Count slashes - this gives us the depth
	count := strings.Count(normalized, "/")

	// If the path doesn't start with "/", it's a relative path
	// For absolute paths starting with "/", the count is the depth
	return count
}
