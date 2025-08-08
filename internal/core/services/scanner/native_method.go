package scanner

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"syscall"
	"time"

	"github.com/mantonx/volumeviz/internal/core/interfaces"
	"github.com/mantonx/volumeviz/internal/core/models"
)

// NativeMethod implements directory scanning using pure Go filepath.Walk
type NativeMethod struct {
	timeout          time.Duration
	progressCallback func(interfaces.ProgressUpdate)
}

// NewNativeMethod creates a new native Go scan method
func NewNativeMethod(config models.ScanConfig) interfaces.ScanMethod {
	return &NativeMethod{
		timeout: config.DefaultTimeout,
	}
}

func (n *NativeMethod) Name() string {
	return "native"
}

func (n *NativeMethod) Available() bool {
	// Native method is always available
	return true
}

func (n *NativeMethod) EstimatedDuration(path string) time.Duration {
	// Native method is the slowest - estimate conservatively
	if entries, err := os.ReadDir(path); err == nil {
		entryCount := len(entries)
		// Very rough estimate: native Go can process ~100 files per second
		seconds := entryCount / 100
		if seconds < 5 {
			return 5 * time.Second
		}
		return time.Duration(seconds) * time.Second
	}
	return 30 * time.Second // Default conservative estimate
}

func (n *NativeMethod) SupportsProgress() bool {
	return true // Native method can provide progress updates
}

func (n *NativeMethod) SetProgressCallback(callback func(interfaces.ProgressUpdate)) {
	n.progressCallback = callback
}

func (n *NativeMethod) Scan(ctx context.Context, path string) (*interfaces.ScanResult, error) {
	// Create a timeout context if none provided
	scanCtx, cancel := context.WithTimeout(ctx, n.timeout)
	defer cancel()

	var totalSize int64
	var fileCount, dirCount int
	var largestFile int64
	var progressCounter int

	start := time.Now()
	lastProgressUpdate := start

	err := filepath.Walk(path, func(currentPath string, info os.FileInfo, err error) error {
		// Check context cancellation frequently
		select {
		case <-scanCtx.Done():
			return &models.ScanError{
				Method:  "native",
				Path:    currentPath,
				Code:    models.ErrorCodeScanCanceled,
				Message: "scan cancelled due to timeout or context cancellation",
				Err:     scanCtx.Err(),
				Context: map[string]any{
					"elapsed_time":  time.Since(start),
					"files_scanned": fileCount,
				},
			}
		default:
		}

		if err != nil {
			// Check if it's a permission error
			if os.IsPermission(err) {
				// Log permission errors but continue scanning
				// Don't fail the entire scan for individual file permission issues
				return nil
			}

			// Check if it's a "no such file" error (broken symlink, etc.)
			if os.IsNotExist(err) {
				return nil
			}

			// For other errors, continue but could log them
			return nil
		}

		if info.IsDir() {
			dirCount++
		} else {
			fileCount++
			fileSize := info.Size()
			totalSize += fileSize

			if fileSize > largestFile {
				largestFile = fileSize
			}
		}

		// Progress reporting with throttling (every 1000 files or every second)
		progressCounter++
		if progressCounter%1000 == 0 || time.Since(lastProgressUpdate) >= time.Second {
			if n.progressCallback != nil {
				progress := interfaces.ProgressUpdate{
					FilesScanned: fileCount,
					CurrentPath:  currentPath,
					ElapsedTime:  time.Since(start),
				}
				n.progressCallback(progress)
			}
			lastProgressUpdate = time.Now()
		}

		return nil
	})

	duration := time.Since(start)

	if err != nil {
		// Check if it's our custom ScanError
		if scanErr, ok := err.(*models.ScanError); ok {
			return nil, scanErr
		}

		// Handle other filepath.Walk errors
		return nil, &models.ScanError{
			Method:  "native",
			Path:    path,
			Code:    models.ErrorCodeMethodUnavailable,
			Message: "filesystem walk failed",
			Err:     err,
			Context: map[string]any{
				"duration":      duration,
				"files_scanned": fileCount,
			},
		}
	}

	return &interfaces.ScanResult{
		TotalSize:      totalSize,
		FileCount:      fileCount,
		DirectoryCount: dirCount,
		LargestFile:    largestFile,
		Method:         "native",
		ScannedAt:      time.Now(),
		Duration:       duration,
		FilesystemType: "", // Will be filled by the scanner
	}, nil
}

// detectFilesystemType attempts to detect the filesystem type
func (n *NativeMethod) detectFilesystemType(path string) string {
	var stat syscall.Statfs_t
	err := syscall.Statfs(path, &stat)
	if err != nil {
		return "unknown"
	}

	// Common filesystem type detection based on magic numbers
	switch stat.Type {
	case 0x58465342: // XFS
		return "xfs"
	case 0xEF53: // EXT2/EXT3/EXT4
		return "ext4"
	case 0x9123683E: // BTRFS
		return "btrfs"
	case 0x6969: // NFS
		return "nfs"
	case 0xFF534D42: // CIFS
		return "cifs"
	case 0x01021994: // TMPFS
		return "tmpfs"
	case 0x858458F6: // RAMFS
		return "ramfs"
	default:
		return fmt.Sprintf("unknown(0x%x)", stat.Type)
	}
}
