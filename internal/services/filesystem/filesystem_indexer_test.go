package filesystem

import (
	"os"
	"path/filepath"
	"testing"
	"time"
)

func TestMimeDetector(t *testing.T) {
	detector := NewMimeDetector()

	tests := []struct {
		filename     string
		content      []byte
		expectedMime string
		expectedKind string
	}{
		{
			filename:     "test.txt",
			content:      []byte("Hello, World!"),
			expectedMime: "text/plain",
			expectedKind: "text",
		},
		{
			filename:     "test.json",
			content:      []byte(`{"key": "value"}`),
			expectedMime: "application/json",
			expectedKind: "data",
		},
		{
			filename:     "test.pdf",
			content:      []byte("%PDF-1.4"),
			expectedMime: "application/pdf",
			expectedKind: "document",
		},
	}

	// Create temporary directory for test files
	tmpDir, err := os.MkdirTemp("", "mime_test")
	if err != nil {
		t.Fatalf("Failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tmpDir)

	for _, test := range tests {
		t.Run(test.filename, func(t *testing.T) {
			// Create test file
			filePath := filepath.Join(tmpDir, test.filename)
			err := os.WriteFile(filePath, test.content, 0644)
			if err != nil {
				t.Fatalf("Failed to write test file: %v", err)
			}

			// Test MIME detection
			mimeType, mediaKind, _ := detector.DetectFile(filePath)

			if mimeType != test.expectedMime {
				t.Errorf("Expected MIME type %s, got %s", test.expectedMime, mimeType)
			}

			if mediaKind != test.expectedKind {
				t.Errorf("Expected media kind %s, got %s", test.expectedKind, mediaKind)
			}
		})
	}
}

func TestIndexerConfig(t *testing.T) {
	config := IndexerConfig{
		EnableHashing:       true,
		MaxFileBytesForHash: 1024,
		HashAlgorithm:       "sha256",
		SkipPatterns:        []string{`\.git`, `\.tmp$`},
		SkipHidden:          true,
		MaxDepth:            10,
		ConcurrentReads:     3,
		BatchSize:           500,
		DetectMimeTypes:     true,
	}

	// Test that config values are set correctly
	if !config.EnableHashing {
		t.Error("EnableHashing should be true")
	}

	if config.HashAlgorithm != "sha256" {
		t.Errorf("Expected hash algorithm 'sha256', got '%s'", config.HashAlgorithm)
	}

	if len(config.SkipPatterns) != 2 {
		t.Errorf("Expected 2 skip patterns, got %d", len(config.SkipPatterns))
	}
}

func TestFilesystemIndexer_shouldSkip(t *testing.T) {
	config := IndexerConfig{
		SkipHidden:   true,
		SkipPatterns: []string{`\.git`, `\.tmp$`, `node_modules`},
	}

	indexer := &FilesystemIndexer{
		config: config,
	}

	skipRegexes, err := indexer.compileSkipPatterns()
	if err != nil {
		t.Fatalf("Failed to compile skip patterns: %v", err)
	}

	tests := []struct {
		name     string
		path     string
		filename string
		isHidden bool
		expected bool
	}{
		{
			name:     "hidden file",
			path:     "/home/user/.bashrc",
			filename: ".bashrc",
			isHidden: true,
			expected: true,
		},
		{
			name:     "git directory",
			path:     "/home/user/project/.git",
			filename: ".git",
			isHidden: true,
			expected: true,
		},
		{
			name:     "tmp file",
			path:     "/home/user/file.tmp",
			filename: "file.tmp",
			isHidden: false,
			expected: true,
		},
		{
			name:     "node_modules directory",
			path:     "/home/user/project/node_modules",
			filename: "node_modules",
			isHidden: false,
			expected: true,
		},
		{
			name:     "regular file",
			path:     "/home/user/document.txt",
			filename: "document.txt",
			isHidden: false,
			expected: false,
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			// Create a mock FileInfo
			info := &mockFileInfo{
				name:    test.filename,
				isDir:   false,
				modTime: time.Now(),
			}

			result := indexer.shouldSkip(test.path, info, skipRegexes)
			if result != test.expected {
				t.Errorf("Expected shouldSkip to return %v for %s, got %v", test.expected, test.path, result)
			}
		})
	}
}

func TestIndexingProgress(t *testing.T) {
	config := IndexerConfig{}
	indexer := &FilesystemIndexer{
		config: config,
	}

	// Test progress initialization
	volumeID := "test-volume"
	indexer.currentScan = &IndexingProgress{
		VolumeID:   volumeID,
		Status:     "running",
		StartedAt:  time.Now(),
		LastUpdate: time.Now(),
	}

	// Test progress retrieval
	progress := indexer.GetProgress()
	if progress == nil {
		t.Fatal("Expected progress to be non-nil")
	}

	if progress.VolumeID != volumeID {
		t.Errorf("Expected volume ID %s, got %s", volumeID, progress.VolumeID)
	}

	if progress.Status != "running" {
		t.Errorf("Expected status 'running', got '%s'", progress.Status)
	}

	// Test progress updates
	indexer.incrementFileCount()
	indexer.incrementFolderCount()
	indexer.addBytesProcessed(1024)

	progress = indexer.GetProgress()
	if progress.FilesScanned != 1 {
		t.Errorf("Expected 1 file scanned, got %d", progress.FilesScanned)
	}

	if progress.FoldersScanned != 1 {
		t.Errorf("Expected 1 folder scanned, got %d", progress.FoldersScanned)
	}

	if progress.BytesProcessed != 1024 {
		t.Errorf("Expected 1024 bytes processed, got %d", progress.BytesProcessed)
	}
}

// Mock FileInfo implementation for testing
type mockFileInfo struct {
	name    string
	size    int64
	mode    os.FileMode
	modTime time.Time
	isDir   bool
}

func (m *mockFileInfo) Name() string       { return m.name }
func (m *mockFileInfo) Size() int64        { return m.size }
func (m *mockFileInfo) Mode() os.FileMode  { return m.mode }
func (m *mockFileInfo) ModTime() time.Time { return m.modTime }
func (m *mockFileInfo) IsDir() bool        { return m.isDir }
func (m *mockFileInfo) Sys() interface{}   { return nil }

func TestPathHashGeneration(t *testing.T) {
	path1 := "/home/user/document.txt"
	path2 := "/home/user/document.txt"
	path3 := "/home/user/different.txt"

	hash1 := generatePathHash(path1)
	hash2 := generatePathHash(path2)
	hash3 := generatePathHash(path3)

	// Same paths should generate same hashes
	if !equalBytes(hash1, hash2) {
		t.Error("Same paths should generate identical hashes")
	}

	// Different paths should generate different hashes
	if equalBytes(hash1, hash3) {
		t.Error("Different paths should generate different hashes")
	}

	// Hash should be 32 bytes (SHA256)
	if len(hash1) != 32 {
		t.Errorf("Expected hash length 32, got %d", len(hash1))
	}
}

func equalBytes(a, b []byte) bool {
	if len(a) != len(b) {
		return false
	}
	for i := range a {
		if a[i] != b[i] {
			return false
		}
	}
	return true
}

func TestFileHashing(t *testing.T) {
	// Create temporary directory and file for testing
	tmpDir, err := os.MkdirTemp("", "hash_test")
	if err != nil {
		t.Fatalf("Failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tmpDir)

	testContent := []byte("Hello, World! This is test content for hashing.")
	testFile := filepath.Join(tmpDir, "test.txt")
	err = os.WriteFile(testFile, testContent, 0644)
	if err != nil {
		t.Fatalf("Failed to write test file: %v", err)
	}

	walker := &indexingWalker{}

	// Test SHA256 hashing
	hash := walker.computeFileHash(testFile, "sha256")
	if hash == nil {
		t.Error("Expected non-nil hash for SHA256")
	}
	if len(hash) != 32 {
		t.Errorf("Expected SHA256 hash length 32, got %d", len(hash))
	}

	// Test MD5 hashing
	hash = walker.computeFileHash(testFile, "md5")
	if hash == nil {
		t.Error("Expected non-nil hash for MD5")
	}
	if len(hash) != 16 {
		t.Errorf("Expected MD5 hash length 16, got %d", len(hash))
	}

	// Test unsupported algorithm
	hash = walker.computeFileHash(testFile, "unsupported")
	if hash != nil {
		t.Error("Expected nil hash for unsupported algorithm")
	}

	// Test non-existent file
	hash = walker.computeFileHash("/non/existent/file", "sha256")
	if hash != nil {
		t.Error("Expected nil hash for non-existent file")
	}
}

func TestMediaKindClassification(t *testing.T) {
	detector := NewMimeDetector()

	tests := []struct {
		mimeType     string
		expectedKind string
	}{
		{"image/jpeg", "image"},
		{"image/png", "image"},
		{"video/mp4", "video"},
		{"audio/mpeg", "audio"},
		{"text/plain", "text"},
		{"application/pdf", "document"},
		{"application/zip", "archive"},
		{"application/json", "data"},
		{"application/javascript", "code"},
		{"application/octet-stream", "binary"},
		{"invalid/type", "unknown"},
		{"", "unknown"},
	}

	for _, test := range tests {
		t.Run(test.mimeType, func(t *testing.T) {
			kind := detector.classifyMediaKind(test.mimeType)
			if kind != test.expectedKind {
				t.Errorf("Expected media kind %s for MIME type %s, got %s",
					test.expectedKind, test.mimeType, kind)
			}
		})
	}
}
