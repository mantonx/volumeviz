package utils

import (
	"fmt"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestPathHasher_HashPath(t *testing.T) {
	hasher := NewPathHasher(0x123456789abcdef0)

	tests := []struct {
		name     string
		volumeID string
		path     string
		wantLen  int
	}{
		{
			name:     "simple path",
			volumeID: "test-volume",
			path:     "/home/user/file.txt",
			wantLen:  16,
		},
		{
			name:     "root path",
			volumeID: "test-volume",
			path:     "/",
			wantLen:  16,
		},
		{
			name:     "deep nested path",
			volumeID: "test-volume",
			path:     "/very/deep/nested/directory/structure/file.txt",
			wantLen:  16,
		},
		{
			name:     "different volume same path",
			volumeID: "different-volume",
			path:     "/home/user/file.txt",
			wantLen:  16,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			hash := hasher.HashPath(tt.volumeID, tt.path)
			assert.Len(t, hash, tt.wantLen, "Hash should be exactly 16 bytes")
			assert.NotEmpty(t, hash, "Hash should not be empty")
		})
	}
}

func TestPathHasher_ConsistentHashing(t *testing.T) {
	hasher := NewPathHasher(42)
	volumeID := "test-volume"
	path := "/home/user/document.pdf"

	// Generate hash multiple times
	hash1 := hasher.HashPath(volumeID, path)
	hash2 := hasher.HashPath(volumeID, path)
	hash3 := hasher.HashPath(volumeID, path)

	assert.Equal(t, hash1, hash2, "Same input should produce same hash")
	assert.Equal(t, hash2, hash3, "Same input should produce same hash")
}

func TestPathHasher_DifferentInputsDifferentHashes(t *testing.T) {
	hasher := NewPathHasher(42)
	volumeID := "test-volume"

	hash1 := hasher.HashPath(volumeID, "/path/to/file1.txt")
	hash2 := hasher.HashPath(volumeID, "/path/to/file2.txt")
	hash3 := hasher.HashPath("different-volume", "/path/to/file1.txt")

	assert.NotEqual(t, hash1, hash2, "Different paths should produce different hashes")
	assert.NotEqual(t, hash1, hash3, "Different volume IDs should produce different hashes")
	assert.NotEqual(t, hash2, hash3, "Different volume+path combinations should produce different hashes")
}

func TestPathHasher_PathNormalization(t *testing.T) {
	hasher := NewPathHasher(0)
	volumeID := "test-volume"

	// These should all produce the same hash after normalization
	paths := []string{
		"/home/user/file.txt",
		"home/user/file.txt",
		"/home//user//file.txt",
		"/home/user/file.txt/",
		"home/user/file.txt/",
	}

	var hashes [][]byte
	for _, path := range paths {
		hash := hasher.HashPath(volumeID, path)
		hashes = append(hashes, hash)
	}

	// All normalized paths should produce the same hash
	for i := 1; i < len(hashes); i++ {
		assert.Equal(t, hashes[0], hashes[i],
			"Normalized paths should produce same hash: %q vs %q", paths[0], paths[i])
	}
}

func TestNormalizePath(t *testing.T) {
	hasher := NewPathHasher(0)

	tests := []struct {
		input    string
		expected string
	}{
		{"home/user/file.txt", "/home/user/file.txt"},
		{"/home/user/file.txt", "/home/user/file.txt"},
		{"/home//user//file.txt", "/home/user/file.txt"},
		{"/home/user/file.txt/", "/home/user/file.txt"},
		{"", "/"},
		{"/", "/"},
		{"file.txt", "/file.txt"},
		{"/home/../file.txt", "/home/../file.txt"}, // We don't resolve .. for performance
	}

	for _, tt := range tests {
		t.Run(tt.input, func(t *testing.T) {
			result := hasher.normalizePath(tt.input)
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestComputeFullPath(t *testing.T) {
	tests := []struct {
		parentPath string
		name       string
		expected   string
	}{
		{"", "file.txt", "/file.txt"},
		{"/", "file.txt", "/file.txt"},
		{"/home", "user", "/home/user"},
		{"/home/user", "documents", "/home/user/documents"},
		{"/home/user/", "documents", "/home/user/documents"},
	}

	for _, tt := range tests {
		t.Run(tt.parentPath+"_"+tt.name, func(t *testing.T) {
			result := ComputeFullPath(tt.parentPath, tt.name)
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestGetParentPath(t *testing.T) {
	tests := []struct {
		input    string
		expected string
	}{
		{"/home/user/file.txt", "/home/user"},
		{"/home/user", "/home"},
		{"/home", "/"},
		{"/", ""},
		{"", ""},
		{"/file.txt", "/"},
	}

	for _, tt := range tests {
		t.Run(tt.input, func(t *testing.T) {
			result := GetParentPath(tt.input)
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestGetDepth(t *testing.T) {
	tests := []struct {
		input    string
		expected int
	}{
		{"/", 0},
		{"", 0},
		{"/home", 1},
		{"/home/user", 2},
		{"/home/user/documents", 3},
		{"/home/user/documents/file.txt", 4},
		{"/very/deep/nested/directory/structure", 5},
	}

	for _, tt := range tests {
		t.Run(tt.input, func(t *testing.T) {
			result := GetDepth(tt.input)
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestHashPathDefault(t *testing.T) {
	volumeID := "test-volume"
	path := "/home/user/test.txt"

	hash := HashPathDefault(volumeID, path)
	assert.Len(t, hash, 16, "Default hash should be 16 bytes")
	assert.NotEmpty(t, hash, "Default hash should not be empty")

	// Should be consistent
	hash2 := HashPathDefault(volumeID, path)
	assert.Equal(t, hash, hash2, "Default hasher should be consistent")
}

func BenchmarkHashPath(b *testing.B) {
	hasher := NewPathHasher(42)
	volumeID := "benchmark-volume"
	path := "/very/long/path/to/some/deeply/nested/file/that/might/be/typical/in/large/filesystems.txt"

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_ = hasher.HashPath(volumeID, path)
	}
}

func BenchmarkHashPathDefault(b *testing.B) {
	volumeID := "benchmark-volume"
	path := "/very/long/path/to/some/deeply/nested/file/that/might/be/typical/in/large/filesystems.txt"

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_ = HashPathDefault(volumeID, path)
	}
}

// TestHashDistribution checks that hashes are reasonably distributed
func TestHashDistribution(t *testing.T) {
	hasher := NewPathHasher(42)
	volumeID := "test-volume"

	hashSet := make(map[string]bool)

	// Generate hashes for many different paths
	for i := 0; i < 1000; i++ {
		path := fmt.Sprintf("/path/to/file_%d.txt", i)
		hash := hasher.HashPath(volumeID, path)
		hashKey := string(hash)

		// Check for collisions (shouldn't happen with good hash function)
		require.False(t, hashSet[hashKey], "Hash collision detected at iteration %d", i)
		hashSet[hashKey] = true
	}

	assert.Len(t, hashSet, 1000, "Should have 1000 unique hashes")
}
