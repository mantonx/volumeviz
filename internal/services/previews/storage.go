package previews

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"
)

// StorageManager handles content-addressed storage of preview files
type StorageManager struct {
	rootDir string
	mu      sync.RWMutex
	stats   PreviewStats
}

// NewStorageManager creates a new storage manager
func NewStorageManager(rootDir string) (*StorageManager, error) {
	// Ensure root directory exists
	if err := os.MkdirAll(rootDir, 0755); err != nil {
		return nil, fmt.Errorf("failed to create preview root directory: %w", err)
	}

	return &StorageManager{
		rootDir: rootDir,
		stats:   PreviewStats{},
	}, nil
}

// GenerateStorageKey creates a content-addressed storage key
// Format: {source_hash}/{type}/{size}/{preview_hash}.webp
// Example: ab/cd/ef.../thumbnail/medium/12/34/56...webp
func (sm *StorageManager) GenerateStorageKey(sourceHash string, previewType PreviewType, size PreviewSize, contentHash string) string {
	// Handle file ID based hashes differently
	if strings.HasPrefix(sourceHash, "file_") {
		// For file ID based caching, use a simpler structure
		// by_file_id/{file_hash}/{type}/{size}/{content_hash}.webp
		if contentHash == "" {
			contentHash = "preview" // Default name when no content hash
		}
		return filepath.Join(
			"by_file_id",
			sourceHash,
			string(previewType),
			string(size),
			contentHash+ImagePreviewExtension,
		)
	}

	// Traditional hash-based storage for backward compatibility
	if len(sourceHash) < 4 || len(contentHash) < 4 {
		// Fallback for short hashes
		return filepath.Join(
			"misc",
			sourceHash,
			string(previewType),
			string(size),
			contentHash+ImagePreviewExtension,
		)
	}

	// Use first 2 chars of source hash for directory sharding
	// This prevents too many files in a single directory
	dir1 := sourceHash[:2]
	dir2 := sourceHash[2:4]

	// For video/audio, we might have multiple previews per source
	// so we use content hash to differentiate
	contentDir1 := contentHash[:2]
	contentDir2 := contentHash[2:4]

	// Build the path: source_hash_dirs/type/size/content_hash_dirs/full_content_hash.webp
	return filepath.Join(
		dir1, dir2, sourceHash[4:],
		string(previewType),
		string(size),
		contentDir1, contentDir2,
		contentHash[4:]+ImagePreviewExtension,
	)
}

// GetFullPath returns the full filesystem path for a storage key
func (sm *StorageManager) GetFullPath(storageKey string) string {
	return filepath.Join(sm.rootDir, storageKey)
}

// Store saves preview data to the content-addressed storage
func (sm *StorageManager) Store(data []byte, sourceHash string, previewType PreviewType, size PreviewSize) (string, string, error) {
	// Calculate content hash of the preview data
	hasher := sha256.New()
	hasher.Write(data)
	contentHash := hex.EncodeToString(hasher.Sum(nil))

	// Generate storage key
	storageKey := sm.GenerateStorageKey(sourceHash, previewType, size, contentHash)
	fullPath := sm.GetFullPath(storageKey)

	// Check if file already exists (content-addressed = deduplication)
	if _, err := os.Stat(fullPath); err == nil {
		// File already exists, update access time
		os.Chtimes(fullPath, time.Now(), time.Now())
		sm.updateStats(true, 0)
		return storageKey, contentHash, nil
	}

	// Create directory structure
	dir := filepath.Dir(fullPath)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return "", "", fmt.Errorf("failed to create directory structure: %w", err)
	}

	// Write file atomically (write to temp, then rename)
	tempFile := fullPath + ".tmp"
	if err := os.WriteFile(tempFile, data, 0644); err != nil {
		return "", "", fmt.Errorf("failed to write preview file: %w", err)
	}

	// Atomic rename
	if err := os.Rename(tempFile, fullPath); err != nil {
		os.Remove(tempFile) // Clean up temp file
		return "", "", fmt.Errorf("failed to finalize preview file: %w", err)
	}

	sm.updateStats(false, int64(len(data)))
	return storageKey, contentHash, nil
}

// Retrieve gets preview data from storage
func (sm *StorageManager) Retrieve(storageKey string) ([]byte, error) {
	fullPath := sm.GetFullPath(storageKey)

	// Read file
	data, err := os.ReadFile(fullPath)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, fmt.Errorf("preview not found: %s", storageKey)
		}
		return nil, fmt.Errorf("failed to read preview: %w", err)
	}

	// Update access time for LRU cleanup
	os.Chtimes(fullPath, time.Now(), time.Now())

	return data, nil
}

// StreamTo streams preview data directly to a writer
func (sm *StorageManager) StreamTo(storageKey string, w io.Writer) error {
	fullPath := sm.GetFullPath(storageKey)

	file, err := os.Open(fullPath)
	if err != nil {
		if os.IsNotExist(err) {
			return fmt.Errorf("preview not found: %s", storageKey)
		}
		return fmt.Errorf("failed to open preview: %w", err)
	}
	defer file.Close()

	// Update access time
	os.Chtimes(fullPath, time.Now(), time.Now())

	// Stream the file
	_, err = io.Copy(w, file)
	return err
}

// Exists checks if a preview exists in storage
func (sm *StorageManager) Exists(storageKey string) bool {
	fullPath := sm.GetFullPath(storageKey)
	_, err := os.Stat(fullPath)
	return err == nil
}

// FindExistingPreview looks for an existing preview by source hash, type and size
// Returns the storage key if found, empty string if not
func (sm *StorageManager) FindExistingPreview(sourceHash string, previewType PreviewType, size PreviewSize) string {
	var searchDir string

	// For file ID based hashes, we need a different approach
	// The hash format is "file_<id>_mtime_<timestamp>"
	if strings.HasPrefix(sourceHash, "file_") {
		// Use a simpler directory structure for file ID based caching
		searchDir = filepath.Join(
			sm.rootDir,
			"by_file_id",
			sourceHash,
			string(previewType),
			string(size),
		)
	} else if len(sourceHash) >= 4 {
		// Traditional hash-based path
		dir1 := sourceHash[:2]
		dir2 := sourceHash[2:4]
		searchDir = filepath.Join(
			sm.rootDir,
			dir1, dir2, sourceHash[4:],
			string(previewType),
			string(size),
		)
	} else {
		return "" // Invalid hash
	}

	// Check if directory exists
	if _, err := os.Stat(searchDir); os.IsNotExist(err) {
		return ""
	}

	// Find the first .webp file in the directory structure
	var foundKey string
	filepath.Walk(searchDir, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return nil // Continue walking
		}
		if !info.IsDir() && strings.HasSuffix(info.Name(), ImagePreviewExtension) {
			// Found a preview file, construct the storage key
			relPath, _ := filepath.Rel(sm.rootDir, path)
			foundKey = relPath
			return filepath.SkipDir // Stop walking
		}
		return nil
	})

	return foundKey
}

// GetETag generates an ETag for a storage key
func (sm *StorageManager) GetETag(storageKey string) string {
	// Extract content hash from storage key
	// Format: .../content_hash.webp
	parts := strings.Split(storageKey, "/")
	if len(parts) > 0 {
		filename := parts[len(parts)-1]
		if strings.HasSuffix(filename, ImagePreviewExtension) {
			hash := strings.TrimSuffix(filename, ImagePreviewExtension)
			// Reconstruct full hash from path components
			if len(parts) >= 3 {
				// Get the content hash directory parts
				contentHashPart := parts[len(parts)-3] + parts[len(parts)-2] + hash
				return fmt.Sprintf(`W/"%s"`, contentHashPart)
			}
		}
	}
	// Fallback to using the full storage key as ETag
	return fmt.Sprintf(`W/"%x"`, sha256.Sum256([]byte(storageKey)))
}

// Delete removes a preview from storage
func (sm *StorageManager) Delete(storageKey string) error {
	fullPath := sm.GetFullPath(storageKey)

	info, err := os.Stat(fullPath)
	if err != nil {
		if os.IsNotExist(err) {
			return nil // Already deleted
		}
		return err
	}

	size := info.Size()
	if err := os.Remove(fullPath); err != nil {
		return fmt.Errorf("failed to delete preview: %w", err)
	}

	sm.updateStats(false, -size)
	return nil
}

// CleanupOldPreviews removes previews older than maxAge
func (sm *StorageManager) CleanupOldPreviews(maxAge time.Duration) (int, error) {
	cutoff := time.Now().Add(-maxAge)
	count := 0

	err := filepath.Walk(sm.rootDir, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return nil // Skip errors
		}

		// Only process WebP files
		if !info.IsDir() && strings.HasSuffix(path, ImagePreviewExtension) {
			// Check access time (not modification time)
			if info.ModTime().Before(cutoff) {
				if err := os.Remove(path); err == nil {
					count++
					sm.updateStats(false, -info.Size())
				}
			}
		}

		return nil
	})

	sm.mu.Lock()
	sm.stats.LastCleanup = time.Now()
	sm.mu.Unlock()

	return count, err
}

// GetStorageSize returns the total size of all previews
func (sm *StorageManager) GetStorageSize() (int64, error) {
	var totalSize int64

	err := filepath.Walk(sm.rootDir, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return nil // Skip errors
		}

		if !info.IsDir() && strings.HasSuffix(path, ImagePreviewExtension) {
			totalSize += info.Size()
		}

		return nil
	})

	return totalSize, err
}

// GetStats returns current storage statistics
func (sm *StorageManager) GetStats() PreviewStats {
	sm.mu.RLock()
	defer sm.mu.RUnlock()
	return sm.stats
}

// updateStats updates storage statistics
func (sm *StorageManager) updateStats(cacheHit bool, sizeChange int64) {
	sm.mu.Lock()
	defer sm.mu.Unlock()

	if cacheHit {
		sm.stats.CacheHits++
	} else {
		sm.stats.CacheMisses++
		if sizeChange > 0 {
			sm.stats.TotalGenerated++
		}
	}

	sm.stats.TotalSizeBytes += sizeChange
}

// PruneEmptyDirectories removes empty directories in the storage tree
func (sm *StorageManager) PruneEmptyDirectories() error {
	// Walk the directory tree bottom-up and remove empty directories
	return filepath.Walk(sm.rootDir, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return nil // Skip errors
		}

		if info.IsDir() && path != sm.rootDir {
			// Check if directory is empty
			entries, err := os.ReadDir(path)
			if err == nil && len(entries) == 0 {
				os.Remove(path) // Remove empty directory
			}
		}

		return nil
	})
}
