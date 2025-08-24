package filesystem

import (
	"crypto/md5"
	"crypto/sha256"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
	"syscall"
	"time"

	"github.com/mantonx/volumeviz/internal/models"
)

// MetadataExtractor handles extraction of file and folder metadata
type MetadataExtractor struct {
	config       IndexerConfig
	mimeDetector *MimeDetector
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

// NewMetadataExtractor creates a new metadata extractor
func NewMetadataExtractor(config IndexerConfig) *MetadataExtractor {
	return &MetadataExtractor{
		config:       config,
		mimeDetector: NewMimeDetector(),
	}
}

// ExtractFolderMetadata extracts metadata from a folder
func (me *MetadataExtractor) ExtractFolderMetadata(volumeID, path string, info os.FileInfo, parentID *int64, depth int32) models.CreateFolderParams {
	pathHash := generatePathHash(path)
	name := info.Name()
	if path == "/" {
		name = "/"
	}

	params := models.CreateFolderParams{
		ParentID: parentID,
		VolumeID: volumeID,
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

// ExtractFileMetadata extracts metadata from a file
func (me *MetadataExtractor) ExtractFileMetadata(volumeID, path string, info os.FileInfo, folderID int64) models.CreateFileParams {
	pathHash := generatePathHash(path)
	name := info.Name()
	extension := extractFileExtension(name)

	params := models.CreateFileParams{
		FolderID:       folderID,
		VolumeID:       volumeID,
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
	if me.config.DetectMimeTypes {
		if mimeType, mediaKind, encoding := me.mimeDetector.DetectFile(path); mimeType != "" {
			params.Mime = &mimeType
			params.MediaKind = &mediaKind
			params.Encoding = &encoding
		}
	}

	// File hashing
	if me.config.EnableHashing && info.Size() <= me.config.MaxFileBytesForHash {
		if hash := me.computeFileHash(path, me.config.HashAlgorithm); hash != nil {
			params.HashAlgo = &me.config.HashAlgorithm
			params.Hash = hash
		}
	}

	return params
}

// ShouldUpdateFile determines if an existing file needs updating
func (me *MetadataExtractor) ShouldUpdateFile(existing *models.File, new *models.CreateFileParams) bool {
	// Check if mtime is newer or size changed
	if new.Mtime != nil && existing.Mtime != nil {
		if new.Mtime.After(*existing.Mtime) {
			return true
		}
	}
	return existing.SizeBytes != new.SizeBytes
}

// ShouldUpdateFolder determines if an existing folder needs updating
func (me *MetadataExtractor) ShouldUpdateFolder(existing *models.Folder, new *models.CreateFolderParams) bool {
	// Check if mtime is newer
	if new.Mtime != nil && existing.Mtime != nil {
		return new.Mtime.After(*existing.Mtime)
	}
	return false
}

// computeFileHash calculates file hash for deduplication and integrity
func (me *MetadataExtractor) computeFileHash(path, algorithm string) []byte {
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

// generatePathHash generates a consistent hash for a path
func generatePathHash(path string) []byte {
	hash := sha256.Sum256([]byte(path))
	return hash[:]
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

// extractFileExtension extracts extension from filename
func extractFileExtension(filename string) *string {
	ext := strings.ToLower(filepath.Ext(filename))
	if ext == "" {
		return nil
	}

	// Remove the leading dot
	if len(ext) > 1 {
		ext = ext[1:]
	}

	return &ext
}