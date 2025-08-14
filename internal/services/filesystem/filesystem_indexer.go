package filesystem

import (
	"context"
	"crypto/md5"
	"crypto/sha256"
	"fmt"
	"io"
	"mime"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"sync"
	"syscall"
	"time"

	"github.com/mantonx/volumeviz/internal/models"
	"github.com/mantonx/volumeviz/internal/repo"
)

// FilesystemIndexer provides streaming filesystem indexing with rich metadata
type FilesystemIndexer struct {
	foldersRepo *repo.FoldersRepo
	filesRepo   *repo.FilesRepo
	config      IndexerConfig
	mimeDetector *MimeDetector
	
	// Progress tracking
	progressMutex sync.RWMutex
	currentScan   *IndexingProgress
}

// IndexerConfig holds configuration for filesystem indexing
type IndexerConfig struct {
	// Hashing configuration
	EnableHashing      bool   `yaml:"enable_hashing" env:"VV_ENABLE_HASHING" envDefault:"false"`
	MaxFileBytesForHash int64 `yaml:"max_file_bytes_for_hash" env:"VV_MAX_FILE_BYTES_FOR_HASH" envDefault:"10485760"` // 10MB
	HashAlgorithm      string `yaml:"hash_algorithm" env:"VV_HASH_ALGO" envDefault:"sha256"`
	
	// Skip rules
	SkipPatterns []string `yaml:"skip_patterns" env:"VV_SKIP_PATTERNS" envSeparator:","`
	SkipHidden   bool     `yaml:"skip_hidden" env:"VV_SKIP_HIDDEN" envDefault:"true"`
	
	// Performance settings  
	MaxDepth         int `yaml:"max_depth" env:"VV_MAX_DEPTH" envDefault:"20"`
	ConcurrentReads  int `yaml:"concurrent_reads" env:"VV_CONCURRENT_READS" envDefault:"5"`
	BatchSize        int `yaml:"batch_size" env:"VV_BATCH_SIZE" envDefault:"1000"`
	
	// Metadata collection
	CollectExtendedAttributes bool `yaml:"collect_extended_attributes" env:"VV_COLLECT_EXTENDED_ATTRS" envDefault:"false"`
	DetectMimeTypes          bool `yaml:"detect_mime_types" env:"VV_DETECT_MIME_TYPES" envDefault:"true"`
}

// IndexingProgress tracks the progress of filesystem indexing
type IndexingProgress struct {
	VolumeID        string    `json:"volume_id"`
	Status          string    `json:"status"` // "running", "completed", "failed", "canceled"
	StartedAt       time.Time `json:"started_at"`
	LastUpdate      time.Time `json:"last_update"`
	
	// Counters
	FoldersScanned  int64     `json:"folders_scanned"`
	FilesScanned    int64     `json:"files_scanned"`
	BytesProcessed  int64     `json:"bytes_processed"`
	ErrorsCount     int64     `json:"errors_count"`
	
	// Current state
	CurrentPath     string    `json:"current_path"`
	CurrentDepth    int       `json:"current_depth"`
	
	// Rates
	FoldersPerSec   float64   `json:"folders_per_sec"`
	FilesPerSec     float64   `json:"files_per_sec"`
	
	// Errors
	LastError       string    `json:"last_error,omitempty"`
}

// NewFilesystemIndexer creates a new filesystem indexer
func NewFilesystemIndexer(foldersRepo *repo.FoldersRepo, filesRepo *repo.FilesRepo, config IndexerConfig) *FilesystemIndexer {
	return &FilesystemIndexer{
		foldersRepo:  foldersRepo,
		filesRepo:    filesRepo, 
		config:       config,
		mimeDetector: NewMimeDetector(),
	}
}

// IndexVolume performs complete filesystem indexing for a volume
func (fi *FilesystemIndexer) IndexVolume(ctx context.Context, volumeID, mountpoint string, deltaMode bool) error {
	// Initialize progress tracking
	fi.progressMutex.Lock()
	fi.currentScan = &IndexingProgress{
		VolumeID:    volumeID,
		Status:      "running",
		StartedAt:   time.Now(),
		LastUpdate:  time.Now(),
	}
	fi.progressMutex.Unlock()
	
	defer func() {
		fi.progressMutex.Lock()
		if fi.currentScan.Status == "running" {
			fi.currentScan.Status = "completed"
		}
		fi.currentScan.LastUpdate = time.Now()
		fi.progressMutex.Unlock()
	}()

	// Clear existing data if not in delta mode
	if !deltaMode {
		if err := fi.foldersRepo.DeleteFoldersByVolume(ctx, volumeID); err != nil {
			return fmt.Errorf("failed to clear existing folders: %w", err)
		}
		if err := fi.filesRepo.DeleteFilesByVolume(ctx, volumeID); err != nil {
			return fmt.Errorf("failed to clear existing files: %w", err)
		}
	}

	// Compile skip patterns
	skipRegexes, err := fi.compileSkipPatterns()
	if err != nil {
		return fmt.Errorf("failed to compile skip patterns: %w", err)
	}

	// Start the indexing walk
	walker := &indexingWalker{
		indexer:     fi,
		ctx:         ctx,
		volumeID:    volumeID,
		skipRegexes: skipRegexes,
		folderCache: make(map[string]*models.Folder),
		deltaMode:   deltaMode,
	}

	return walker.walk(mountpoint)
}

// GetProgress returns the current indexing progress
func (fi *FilesystemIndexer) GetProgress() *IndexingProgress {
	fi.progressMutex.RLock()
	defer fi.progressMutex.RUnlock()
	
	if fi.currentScan == nil {
		return nil
	}
	
	// Create a copy to avoid race conditions
	progress := *fi.currentScan
	return &progress
}

// compileSkipPatterns compiles skip patterns into regex
func (fi *FilesystemIndexer) compileSkipPatterns() ([]*regexp.Regexp, error) {
	var regexes []*regexp.Regexp
	
	for _, pattern := range fi.config.SkipPatterns {
		regex, err := regexp.Compile(pattern)
		if err != nil {
			return nil, fmt.Errorf("invalid skip pattern '%s': %w", pattern, err)
		}
		regexes = append(regexes, regex)
	}
	
	return regexes, nil
}

// shouldSkip determines if a path should be skipped based on rules
func (fi *FilesystemIndexer) shouldSkip(path string, info os.FileInfo, skipRegexes []*regexp.Regexp) bool {
	name := info.Name()
	
	// Skip hidden files/directories if configured
	if fi.config.SkipHidden && strings.HasPrefix(name, ".") {
		return true
	}
	
	// Check skip patterns
	for _, regex := range skipRegexes {
		if regex.MatchString(path) || regex.MatchString(name) {
			return true
		}
	}
	
	return false
}

// indexingWalker handles the filesystem walking and indexing logic
type indexingWalker struct {
	indexer     *FilesystemIndexer
	ctx         context.Context
	volumeID    string
	skipRegexes []*regexp.Regexp
	folderCache map[string]*models.Folder
	deltaMode   bool
	
	// Batching
	folderBatch []models.CreateFolderParams
	fileBatch   []models.CreateFileParams
}

// walk performs the filesystem walk and indexing
func (w *indexingWalker) walk(rootPath string) error {
	return filepath.Walk(rootPath, func(path string, info os.FileInfo, err error) error {
		// Check for cancellation
		select {
		case <-w.ctx.Done():
			return w.ctx.Err()
		default:
		}

		// Handle walk errors
		if err != nil {
			w.indexer.recordError(fmt.Sprintf("walk error for %s: %v", path, err))
			return nil // Continue walking
		}

		// Check skip rules
		if w.indexer.shouldSkip(path, info, w.skipRegexes) {
			if info.IsDir() {
				return filepath.SkipDir
			}
			return nil
		}

		// Check depth limits
		depth := strings.Count(strings.TrimPrefix(path, rootPath), string(os.PathSeparator))
		if depth > w.indexer.config.MaxDepth {
			if info.IsDir() {
				return filepath.SkipDir
			}
			return nil
		}

		// Update progress
		w.indexer.updateProgress(path, depth)

		// Process based on type
		if info.IsDir() {
			return w.processFolder(path, info, depth)
		} else {
			return w.processFile(path, info, depth)
		}
	})
}

// processFolder handles folder indexing
func (w *indexingWalker) processFolder(path string, info os.FileInfo, depth int) error {
	// Get parent folder ID
	var parentID *int64
	if depth > 0 {
		parentPath := filepath.Dir(path)
		if parent, exists := w.folderCache[parentPath]; exists {
			parentID = &parent.ID
		}
	}

	// Extract metadata
	folderParams := w.extractFolderMetadata(path, info, parentID, int32(depth))
	
	// Check if folder exists in delta mode
	if w.deltaMode {
		existing, err := w.indexer.foldersRepo.GetFolderByPath(w.ctx, w.volumeID, path)
		if err == nil {
			// Folder exists, check if it needs updating
			if w.shouldUpdateFolder(existing, &folderParams) {
				// Update existing folder metadata
				err = w.indexer.foldersRepo.UpdateFolderMetadata(w.ctx, existing.ID, 
					folderParams.Mtime, folderParams.Ctime, folderParams.Uid, folderParams.Gid, folderParams.Mode)
				if err != nil {
					w.indexer.recordError(fmt.Sprintf("failed to update folder %s: %v", path, err))
				}
			}
			// Cache the existing folder
			w.folderCache[path] = existing
			return nil
		}
	}

	// Create new folder
	folder, err := w.indexer.foldersRepo.CreateFolder(w.ctx, folderParams)
	if err != nil {
		w.indexer.recordError(fmt.Sprintf("failed to create folder %s: %v", path, err))
		return nil
	}

	// Cache the folder for child references
	w.folderCache[path] = folder
	
	w.indexer.incrementFolderCount()
	return nil
}

// processFile handles file indexing
func (w *indexingWalker) processFile(path string, info os.FileInfo, depth int) error {
	// Get folder ID
	folderPath := filepath.Dir(path)
	folder, exists := w.folderCache[folderPath]
	if !exists {
		w.indexer.recordError(fmt.Sprintf("parent folder not found for file %s", path))
		return nil
	}

	// Extract metadata
	fileParams := w.extractFileMetadata(path, info, folder.ID)
	
	// Check if file exists in delta mode
	if w.deltaMode {
		existing, err := w.indexer.filesRepo.GetFileByPath(w.ctx, w.volumeID, path)
		if err == nil {
			// File exists, check if it needs updating
			if w.shouldUpdateFile(existing, &fileParams) {
				// Update existing file metadata
				err = w.indexer.filesRepo.UpdateFileMetadata(w.ctx, existing.ID,
					fileParams.SizeBytes, fileParams.DiskUsageBytes,
					fileParams.Mtime, fileParams.Ctime, fileParams.Birthtime,
					fileParams.Uid, fileParams.Gid, fileParams.Mode)
				if err != nil {
					w.indexer.recordError(fmt.Sprintf("failed to update file %s: %v", path, err))
				}
			}
			return nil
		}
	}

	// Create new file
	_, err := w.indexer.filesRepo.CreateFile(w.ctx, fileParams)
	if err != nil {
		w.indexer.recordError(fmt.Sprintf("failed to create file %s: %v", path, err))
		return nil
	}

	w.indexer.incrementFileCount()
	w.indexer.addBytesProcessed(info.Size())
	return nil
}

// extractFolderMetadata extracts metadata from a folder
func (w *indexingWalker) extractFolderMetadata(path string, info os.FileInfo, parentID *int64, depth int32) models.CreateFolderParams {
	pathHash := generatePathHash(path)
	name := info.Name()
	if path == "/" {
		name = "/"
	}

	params := models.CreateFolderParams{
		ParentID: parentID,
		VolumeID: w.volumeID,
		Name:     name,
		Path:     path,
		PathHash: pathHash,
		Depth:    depth,
	}

	// Extract timestamps
	if modTime := info.ModTime(); !modTime.IsZero() {
		params.Mtime = &modTime
	}

	// Extract system-specific metadata
	if sysStat := getSystemStat(info); sysStat != nil {
		params.Ctime = sysStat.Ctime
		params.Uid = sysStat.Uid
		params.Gid = sysStat.Gid
		params.Mode = sysStat.Mode
	}

	// Handle symlinks
	if info.Mode()&os.ModeSymlink != 0 {
		params.IsSymlink = true
		if target, err := os.Readlink(path); err == nil {
			params.SymlinkTarget = &target
		}
	}

	return params
}

// extractFileMetadata extracts metadata from a file
func (w *indexingWalker) extractFileMetadata(path string, info os.FileInfo, folderID int64) models.CreateFileParams {
	pathHash := generatePathHash(path)
	name := info.Name()
	extension := repo.ExtractFileExtension(name)

	params := models.CreateFileParams{
		FolderID:       folderID,
		VolumeID:       w.volumeID,
		Name:           name,
		Path:           path,
		Extension:      extension,
		SizeBytes:      info.Size(),
		DiskUsageBytes: info.Size(), // TODO: Get actual disk usage
		PathHash:       pathHash,
	}

	// Extract timestamps
	if modTime := info.ModTime(); !modTime.IsZero() {
		params.Mtime = &modTime
	}

	// Extract system-specific metadata
	if sysStat := getSystemStat(info); sysStat != nil {
		params.Ctime = sysStat.Ctime
		params.Birthtime = sysStat.Birthtime
		params.Uid = sysStat.Uid
		params.Gid = sysStat.Gid
		params.Mode = sysStat.Mode
		params.Inode = sysStat.Inode
		params.Device = sysStat.Device
	}

	// Handle symlinks
	if info.Mode()&os.ModeSymlink != 0 {
		params.IsSymlink = true
		if target, err := os.Readlink(path); err == nil {
			params.SymlinkTarget = &target
		}
	}

	// MIME detection
	if w.indexer.config.DetectMimeTypes {
		if mimeType, mediaKind, encoding := w.indexer.mimeDetector.DetectFile(path); mimeType != "" {
			params.Mime = &mimeType
			params.MediaKind = &mediaKind  
			params.Encoding = &encoding
		}
	}

	// File hashing
	if w.indexer.config.EnableHashing && info.Size() <= w.indexer.config.MaxFileBytesForHash {
		if hash := w.computeFileHash(path, w.indexer.config.HashAlgorithm); hash != nil {
			params.HashAlgo = &w.indexer.config.HashAlgorithm
			params.Hash = hash
		}
	}

	return params
}

// Helper methods for progress tracking
func (fi *FilesystemIndexer) updateProgress(currentPath string, depth int) {
	fi.progressMutex.Lock()
	defer fi.progressMutex.Unlock()
	
	if fi.currentScan != nil {
		fi.currentScan.CurrentPath = currentPath
		fi.currentScan.CurrentDepth = depth
		fi.currentScan.LastUpdate = time.Now()
		
		// Calculate rates
		elapsed := time.Since(fi.currentScan.StartedAt).Seconds()
		if elapsed > 0 {
			fi.currentScan.FoldersPerSec = float64(fi.currentScan.FoldersScanned) / elapsed
			fi.currentScan.FilesPerSec = float64(fi.currentScan.FilesScanned) / elapsed
		}
	}
}

func (fi *FilesystemIndexer) incrementFolderCount() {
	fi.progressMutex.Lock()
	defer fi.progressMutex.Unlock()
	if fi.currentScan != nil {
		fi.currentScan.FoldersScanned++
	}
}

func (fi *FilesystemIndexer) incrementFileCount() {
	fi.progressMutex.Lock()
	defer fi.progressMutex.Unlock()
	if fi.currentScan != nil {
		fi.currentScan.FilesScanned++
	}
}

func (fi *FilesystemIndexer) addBytesProcessed(bytes int64) {
	fi.progressMutex.Lock()
	defer fi.progressMutex.Unlock()
	if fi.currentScan != nil {
		fi.currentScan.BytesProcessed += bytes
	}
}

func (fi *FilesystemIndexer) recordError(msg string) {
	fi.progressMutex.Lock()
	defer fi.progressMutex.Unlock()
	if fi.currentScan != nil {
		fi.currentScan.ErrorsCount++
		fi.currentScan.LastError = msg
	}
}

// Utility functions
func generatePathHash(path string) []byte {
	hash := sha256.Sum256([]byte(path))
	return hash[:]
}

func (w *indexingWalker) shouldUpdateFolder(existing *models.Folder, new *models.CreateFolderParams) bool {
	// Check if mtime is newer
	if new.Mtime != nil && existing.Mtime != nil {
		return new.Mtime.After(*existing.Mtime)
	}
	return false
}

func (w *indexingWalker) shouldUpdateFile(existing *models.File, new *models.CreateFileParams) bool {
	// Check if mtime is newer or size changed
	if new.Mtime != nil && existing.Mtime != nil {
		if new.Mtime.After(*existing.Mtime) {
			return true
		}
	}
	return existing.SizeBytes != new.SizeBytes
}

func (w *indexingWalker) computeFileHash(path, algorithm string) []byte {
	file, err := os.Open(path)
	if err != nil {
		return nil
	}
	defer file.Close()

	switch algorithm {
	case "md5":
		hasher := md5.New()
		if _, err := io.Copy(hasher, file); err != nil {
			return nil
		}
		return hasher.Sum(nil)
	case "sha256":
		hasher := sha256.New()
		if _, err := io.Copy(hasher, file); err != nil {
			return nil
		}
		return hasher.Sum(nil)
	default:
		return nil
	}
}

// MimeDetector handles MIME type detection and media classification
type MimeDetector struct {
	// Cache for file extensions to improve performance
	extensionCache map[string]string
	mutex         sync.RWMutex
}

// NewMimeDetector creates a new MIME detector
func NewMimeDetector() *MimeDetector {
	return &MimeDetector{
		extensionCache: make(map[string]string),
	}
}

// DetectFile detects MIME type, media kind, and encoding for a file
func (md *MimeDetector) DetectFile(path string) (mimeType, mediaKind, encoding string) {
	// First try detection by file extension (fast path)
	ext := strings.ToLower(filepath.Ext(path))
	if ext != "" {
		md.mutex.RLock()
		cachedMime, exists := md.extensionCache[ext]
		md.mutex.RUnlock()
		
		if exists {
			return cachedMime, md.classifyMediaKind(cachedMime), ""
		}
		
		// Get MIME type by extension
		if extMime := mime.TypeByExtension(ext); extMime != "" {
			md.mutex.Lock()
			md.extensionCache[ext] = extMime
			md.mutex.Unlock()
			return extMime, md.classifyMediaKind(extMime), ""
		}
	}

	// Fallback to content detection (slower but more accurate)
	file, err := os.Open(path)
	if err != nil {
		return "application/octet-stream", "binary", ""
	}
	defer file.Close()

	// Read first 512 bytes for content detection
	buffer := make([]byte, 512)
	n, err := file.Read(buffer)
	if err != nil && err != io.EOF {
		return "application/octet-stream", "binary", ""
	}

	// Detect MIME type from content
	detectedMime := http.DetectContentType(buffer[:n])
	if detectedMime == "" {
		detectedMime = "application/octet-stream"
	}

	// Cache result if we have an extension
	if ext != "" {
		md.mutex.Lock()
		md.extensionCache[ext] = detectedMime
		md.mutex.Unlock()
	}

	return detectedMime, md.classifyMediaKind(detectedMime), md.detectEncoding(buffer[:n])
}

// classifyMediaKind classifies MIME types into broader media categories
func (md *MimeDetector) classifyMediaKind(mimeType string) string {
	if mimeType == "" {
		return "unknown"
	}

	// Split MIME type into main type and subtype
	parts := strings.Split(mimeType, "/")
	if len(parts) != 2 {
		return "unknown"
	}

	mainType := parts[0]
	subType := parts[1]

	switch mainType {
	case "image":
		return "image"
	case "video":
		return "video"
	case "audio":
		return "audio"
	case "text":
		return "text"
	case "application":
		// Further classify application types
		switch {
		case strings.Contains(subType, "pdf"):
			return "document"
		case strings.Contains(subType, "zip"), strings.Contains(subType, "tar"), strings.Contains(subType, "gzip"):
			return "archive"
		case strings.Contains(subType, "json"), strings.Contains(subType, "xml"):
			return "data"
		case strings.Contains(subType, "javascript"), strings.Contains(subType, "sql"):
			return "code"
		case strings.Contains(subType, "msword"), strings.Contains(subType, "officedocument"):
			return "document"
		default:
			return "binary"
		}
	default:
		return "unknown"
	}
}

// detectEncoding detects text encoding from file content
func (md *MimeDetector) detectEncoding(content []byte) string {
	// Simple encoding detection - can be enhanced with more sophisticated algorithms
	if len(content) == 0 {
		return ""
	}

	// Check for UTF-8 BOM
	if len(content) >= 3 && content[0] == 0xEF && content[1] == 0xBB && content[2] == 0xBF {
		return "utf-8-bom"
	}

	// Check for UTF-16 BOM
	if len(content) >= 2 {
		if content[0] == 0xFF && content[1] == 0xFE {
			return "utf-16le"
		}
		if content[0] == 0xFE && content[1] == 0xFF {
			return "utf-16be"
		}
	}

	// Check if content is valid UTF-8
	if isValidUTF8(content) {
		return "utf-8"
	}

	// Check for ASCII
	if isASCII(content) {
		return "ascii"
	}

	return "binary"
}

// isValidUTF8 checks if content is valid UTF-8
func isValidUTF8(content []byte) bool {
	for i := 0; i < len(content); {
		r, size := decodeRuneInBytes(content[i:])
		if r == 0xFFFD && size == 1 {
			return false // Invalid UTF-8
		}
		i += size
	}
	return true
}

// isASCII checks if content contains only ASCII characters
func isASCII(content []byte) bool {
	for _, b := range content {
		if b > 127 {
			return false
		}
	}
	return true
}

// decodeRuneInBytes is a simplified version of utf8.DecodeRune
func decodeRuneInBytes(b []byte) (rune, int) {
	if len(b) == 0 {
		return 0xFFFD, 0
	}
	b0 := b[0]
	if b0 < 0x80 {
		return rune(b0), 1
	}
	if len(b) < 2 {
		return 0xFFFD, 1
	}
	// Simplified - full implementation would handle all UTF-8 cases
	return 0xFFFD, 1
}

// SystemStat holds system-specific file metadata
type SystemStat struct {
	Ctime     *time.Time
	Birthtime *time.Time
	Uid       *int32
	Gid       *int32
	Mode      *int32
	Inode     *int64
	Device    *string
}

// getSystemStat extracts system-specific metadata from os.FileInfo
func getSystemStat(info os.FileInfo) *SystemStat {
	// Get underlying syscall.Stat_t
	sys := info.Sys()
	if sys == nil {
		return nil
	}

	stat, ok := sys.(*syscall.Stat_t)
	if !ok {
		return nil
	}

	sysStat := &SystemStat{}

	// Extract timestamps
	if stat.Ctim.Sec != 0 {
		ctime := time.Unix(stat.Ctim.Sec, stat.Ctim.Nsec)
		sysStat.Ctime = &ctime
	}

	// Birthtime is not available on Linux, but we can try
	// On Linux, we'll use ctime as a fallback for birthtime
	if stat.Ctim.Sec != 0 {
		birthtime := time.Unix(stat.Ctim.Sec, stat.Ctim.Nsec)
		sysStat.Birthtime = &birthtime
	}

	// Extract ownership and permissions
	uid := int32(stat.Uid)
	sysStat.Uid = &uid

	gid := int32(stat.Gid)
	sysStat.Gid = &gid

	mode := int32(stat.Mode)
	sysStat.Mode = &mode

	// Extract inode and device
	inode := int64(stat.Ino)
	sysStat.Inode = &inode

	device := fmt.Sprintf("%d", stat.Dev)
	sysStat.Device = &device

	return sysStat
}