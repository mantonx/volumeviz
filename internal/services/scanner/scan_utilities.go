package scanner

import (
	"context"
	"fmt"
	"os"
	"strings"
	"syscall"
	"time"

	"github.com/mantonx/volumeviz/internal/interfaces"
	"github.com/mantonx/volumeviz/internal/models"
	"github.com/mantonx/volumeviz/internal/utils"
)

// scanWithMethod executes a scan using a specific method
func (vs *VolumeScanner) scanWithMethod(
	ctx context.Context,
	method interfaces.ScanMethod,
	volumeID, path string,
) (*interfaces.ScanResult, error) {
	start := time.Now()

	// Create scan context with timeout
	scanCtx, cancel := context.WithTimeout(ctx, vs.config.Scanning.DefaultTimeout)
	defer cancel()

	// Pre-scan validation
	if err := vs.validatePath(path); err != nil {
		return nil, &models.ScanError{
			VolumeID: volumeID,
			Method:   method.Name(),
			Code:     models.ErrorCodePathValidationFailed,
			Message:  "path validation failed",
			Path:     path,
			Err:      err,
			Context: map[string]any{
				"stage": "pre_scan_validation",
			},
		}
	}

	// Execute scan
	result, err := method.Scan(scanCtx, path)
	duration := time.Since(start)

	// Record scan start
	vs.metrics.ScanStarted(method.Name())
	defer vs.metrics.ScanFinished(method.Name())

	// Record metrics regardless of success/failure
	vs.metrics.RecordScanAttempt(method.Name(), duration, err == nil)

	if err != nil {
		// Record scan failure with specific error classification
		errorCode := vs.classifyError(err)
		vs.metrics.RecordScanFailure(method.Name(), errorCode)
		return nil, vs.wrapScanError(err, volumeID, method.Name(), path, duration)
	}

	// Post-scan enrichment and validation
	result.VolumeID = volumeID
	result.Duration = duration
	result.FilesystemType = vs.detectFilesystemType(path)
	result.FilesystemCapacity = vs.getFilesystemCapacity(path)

	if err := vs.validateResult(result); err != nil {
		return nil, &models.ScanError{
			VolumeID: volumeID,
			Method:   method.Name(),
			Code:     models.ErrorCodeResultValidationFailed,
			Message:  "scan result validation failed",
			Path:     path,
			Err:      err,
			Context: map[string]any{
				"result": result,
				"stage":  "post_scan_validation",
			},
		}
	}

	return result, nil
}

// getVolumePath resolves a volume ID to its filesystem path
func (vs *VolumeScanner) getVolumePath(volumeID string) (string, error) {
	ctx := context.Background()

	// First priority: Check volume mapping configuration for custom container paths
	if vs.volumeMapping != nil {
		if containerPath, exists := vs.volumeMapping.GetContainerPath(volumeID); exists {
			// Validate the container path exists and is accessible
			if _, err := os.Stat(containerPath); err == nil {
				if vs.logger != nil {
					vs.logger.Printf("Using configured container path for volume %s: %s", volumeID, containerPath)
				}
				return containerPath, nil
			} else {
				if vs.logger != nil {
					vs.logger.Printf("Configured container path %s not accessible for volume %s, falling back", containerPath, volumeID)
				}
			}
		}
	}

	// Second priority: Check database for custom mountpoint (for backwards compatibility)
	if vs.store != nil {
		if dbVolume, err := vs.store.Volumes().GetVolumeByVolumeID(ctx, volumeID); err == nil && dbVolume != nil {
			if dbVolume.Mountpoint != "" {
				// Skip Docker default paths - these are handled by Docker volume info
				if !strings.HasPrefix(dbVolume.Mountpoint, "/var/lib/docker/volumes/") {
					// Validate the database mountpoint exists and is accessible
					if _, err := os.Stat(dbVolume.Mountpoint); err == nil {
						if vs.logger != nil {
							vs.logger.Printf("Using database mountpoint for volume %s: %s", volumeID, dbVolume.Mountpoint)
						}
						return dbVolume.Mountpoint, nil
					} else {
						if vs.logger != nil {
							vs.logger.Printf("Database mountpoint %s not accessible for volume %s, falling back", dbVolume.Mountpoint, volumeID)
						}
					}
				}
			}
		}
	}

	// Third priority: Get Docker volume information and check for device mounts
	volume, err := vs.dockerService.GetVolume(ctx, volumeID)
	if err != nil {
		return "", utils.WrapError(err, "failed to get volume info")
	}

	// For user-mounted volumes, use the device path if available
	if device, hasDevice := volume.Options["device"]; hasDevice {
		// Validate the device path exists and is accessible
		if _, err := os.Stat(device); err == nil {
			if vs.logger != nil {
				vs.logger.Printf("Using device path for volume %s: %s", volumeID, device)
			}
			return device, nil
		} else {
			if vs.logger != nil {
				vs.logger.Printf("Device path %s not accessible for volume %s, falling back to mountpoint", device, volumeID)
			}
		}
	}

	// Final fallback: Use Docker internal mountpoint
	if vs.logger != nil {
		vs.logger.Printf("Using Docker mountpoint for volume %s: %s", volumeID, volume.Mountpoint)
	}
	return volume.Mountpoint, nil
}

// validatePath validates that a path exists and is accessible
func (vs *VolumeScanner) validatePath(path string) error {
	info, err := os.Stat(path)
	if err != nil {
		return utils.WrapError(err, "path not accessible")
	}

	if !info.IsDir() {
		return fmt.Errorf("path is not a directory")
	}

	return nil
}

// validateResult validates scan results
func (vs *VolumeScanner) validateResult(result *interfaces.ScanResult) error {
	if result.TotalSize < 0 {
		return fmt.Errorf("invalid total size: %d", result.TotalSize)
	}

	if result.FileCount < 0 {
		return fmt.Errorf("invalid file count: %d", result.FileCount)
	}

	if result.Method == "" {
		return fmt.Errorf("method not specified")
	}

	return nil
}

// wrapScanError wraps an error with additional context
func (vs *VolumeScanner) wrapScanError(
	err error,
	volumeID, method, path string,
	duration time.Duration,
) error {
	// If it's already a ScanError, return it as-is
	if scanErr, ok := err.(*models.ScanError); ok {
		return scanErr
	}

	return &models.ScanError{
		VolumeID: volumeID,
		Method:   method,
		Path:     path,
		Code:     models.ErrorCodeMethodUnavailable,
		Message:  fmt.Sprintf("%s scan failed", method),
		Err:      err,
		Context: map[string]any{
			"duration": duration,
		},
	}
}

// calculateCacheTTL determines appropriate cache TTL based on scan result
func (vs *VolumeScanner) calculateCacheTTL(result *interfaces.ScanResult) time.Duration {
	// Base TTL from config
	baseTTL := vs.config.Cache.TTL

	// Adjust based on size (larger volumes cached longer)
	if result.TotalSize > 100*1024*1024*1024 { // >100GB
		return baseTTL * 2
	} else if result.TotalSize < 1024*1024*1024 { // <1GB
		return baseTTL / 2
	}

	return baseTTL
}

// detectFilesystemType detects the filesystem type of a path
func (vs *VolumeScanner) detectFilesystemType(path string) string {
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

// getFilesystemCapacity gets filesystem capacity and usage information
func (vs *VolumeScanner) getFilesystemCapacity(path string) *interfaces.FilesystemInfo {
	var stat syscall.Statfs_t
	err := syscall.Statfs(path, &stat)
	if err != nil {
		// Return nil if we can't get filesystem stats
		return nil
	}

	// Calculate sizes in bytes
	blockSize := int64(stat.Bsize)
	totalBytes := int64(stat.Blocks) * blockSize
	availableBytes := int64(stat.Bavail) * blockSize // Available to non-superuser
	usedBytes := totalBytes - availableBytes

	// Calculate usage percentage using safe utility
	usagePercent := utils.SafePercentage(int64(usedBytes), int64(totalBytes))

	return &interfaces.FilesystemInfo{
		TotalBytes:     totalBytes,
		AvailableBytes: availableBytes,
		UsedBytes:      usedBytes,
		UsagePercent:   float64(usagePercent),
		BlockSize:      blockSize,
		TotalBlocks:    stat.Blocks,
		FreeBlocks:     stat.Bavail,
	}
}

// getMethodNames returns a list of method names for error context
func (vs *VolumeScanner) getMethodNames() []string {
	names := make([]string, len(vs.methods))
	for i, method := range vs.methods {
		names[i] = method.Name()
	}
	return names
}

// classifyError classifies errors for metrics reporting
func (vs *VolumeScanner) classifyError(err error) string {
	if err == nil {
		return "success"
	}

	// Check for specific error types
	if scanErr, ok := err.(*models.ScanError); ok {
		return scanErr.Code
	}

	// Classify based on error message patterns
	errMsg := err.Error()
	switch {
	case syscall.EACCES.Error() == errMsg || os.IsPermission(err):
		return models.ErrorCodePermissionDenied
	case syscall.ENOENT.Error() == errMsg || os.IsNotExist(err):
		return models.ErrorCodePathNotFound
	case syscall.ENOSPC.Error() == errMsg:
		return models.ErrorCodeInsufficientSpace
	case syscall.ETIMEDOUT.Error() == errMsg:
		return models.ErrorCodeScanTimeout
	default:
		return models.ErrorCodeUnknown
	}
}
