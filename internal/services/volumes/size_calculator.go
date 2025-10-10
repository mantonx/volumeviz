// Package volumes provides volume management services
package volumes

import (
	"context"
	"fmt"
	"io/fs"
	"log"
	"path/filepath"
	"sync/atomic"
	"time"

	"github.com/jackc/pgx/v5/pgtype"
	"github.com/mantonx/volumeviz/internal/db/sqlc"
	"github.com/mantonx/volumeviz/internal/interfaces"
	"github.com/mantonx/volumeviz/internal/store"
)

// SizeCalculationMode determines how volume size is calculated
type SizeCalculationMode string

const (
	// ModeAuto automatically chooses the best method based on driver type
	ModeAuto SizeCalculationMode = "auto"
	// ModeDockerAPI uses Docker's built-in disk usage API (fast, local volumes only)
	ModeDockerAPI SizeCalculationMode = "docker"
	// ModeFilesystem performs a filesystem walk (slower, works for all volume types)
	ModeFilesystem SizeCalculationMode = "filesystem"
)

// SizeCalculationResult contains the result of a size calculation
type SizeCalculationResult struct {
	VolumeID         string
	TotalSizeBytes   int64
	UsedSizeBytes    int64
	FreeSizeBytes    int64
	FileCount        int64
	FolderCount      int64
	CalculationMode  SizeCalculationMode
	Duration         time.Duration
	Error            error
	Timestamp        time.Time
	FilesystemType   string
	MountPoint       string
}

// SizeCalculatorConfig holds configuration for the size calculator
type SizeCalculatorConfig struct {
	// Timeout for size calculation operations
	Timeout time.Duration
	// RateLimit controls how many size calculations can run concurrently
	RateLimit int
	// DefaultMode specifies the default calculation mode
	DefaultMode SizeCalculationMode
	// MaxFilesystemWalkDepth limits filesystem walk depth (0 = unlimited)
	MaxFilesystemWalkDepth int
	// EnableProgressTracking enables progress reporting during calculation
	EnableProgressTracking bool
}

// DefaultSizeCalculatorConfig returns sensible defaults
func DefaultSizeCalculatorConfig() SizeCalculatorConfig {
	return SizeCalculatorConfig{
		Timeout:                5 * time.Minute, // 5 minutes for network volumes
		RateLimit:              2,                // Max 2 concurrent calculations
		DefaultMode:            ModeAuto,
		MaxFilesystemWalkDepth: 0, // Unlimited
		EnableProgressTracking: true,
	}
}

// SizeCalculator handles volume size calculations
type SizeCalculator struct {
	dockerService interfaces.DockerService
	store         store.Store
	config        SizeCalculatorConfig

	// Metrics
	totalCalculations   atomic.Int64
	successfulCalcs     atomic.Int64
	failedCalcs         atomic.Int64
	dockerAPICalcs      atomic.Int64
	filesystemCalcs     atomic.Int64
	totalBytesProcessed atomic.Int64
}

// NewSizeCalculator creates a new size calculator service
func NewSizeCalculator(
	dockerService interfaces.DockerService,
	store store.Store,
	config SizeCalculatorConfig,
) *SizeCalculator {
	return &SizeCalculator{
		dockerService: dockerService,
		store:         store,
		config:        config,
	}
}

// CalculateSize calculates the size of a volume using the most appropriate method
func (s *SizeCalculator) CalculateSize(ctx context.Context, volumeID, driver, mountPoint string) (*SizeCalculationResult, error) {
	s.totalCalculations.Add(1)
	startTime := time.Now()

	result := &SizeCalculationResult{
		VolumeID:       volumeID,
		Timestamp:      startTime,
		FilesystemType: driver,
		MountPoint:     mountPoint,
	}

	// Create timeout context
	timeoutCtx, cancel := context.WithTimeout(ctx, s.config.Timeout)
	defer cancel()

	// Determine calculation mode
	mode := s.determineCalculationMode(driver)
	result.CalculationMode = mode

	log.Printf("[SIZE-CALC] Calculating size for volume %s (mode: %s, driver: %s)", volumeID, mode, driver)

	// Calculate size based on mode
	var err error
	switch mode {
	case ModeDockerAPI:
		err = s.calculateViaDockerAPI(timeoutCtx, result)
		s.dockerAPICalcs.Add(1)
	case ModeFilesystem:
		err = s.calculateViaFilesystem(timeoutCtx, result)
		s.filesystemCalcs.Add(1)
	default:
		err = fmt.Errorf("unsupported calculation mode: %s", mode)
	}

	result.Duration = time.Since(startTime)
	result.Error = err

	if err != nil {
		s.failedCalcs.Add(1)
		log.Printf("[SIZE-CALC] Failed to calculate size for %s: %v (duration: %v)", volumeID, err, result.Duration)
		return result, err
	}

	s.successfulCalcs.Add(1)
	s.totalBytesProcessed.Add(result.TotalSizeBytes)

	log.Printf("[SIZE-CALC] Successfully calculated size for %s: %d bytes (%s) in %v",
		volumeID, result.TotalSizeBytes, s.formatBytes(result.TotalSizeBytes), result.Duration)

	return result, nil
}

// determineCalculationMode chooses the best calculation mode based on driver
func (s *SizeCalculator) determineCalculationMode(driver string) SizeCalculationMode {
	if s.config.DefaultMode != ModeAuto {
		return s.config.DefaultMode
	}

	// Use Docker API for local volumes (fast)
	if driver == "local" || driver == "" {
		return ModeDockerAPI
	}

	// Use filesystem walk for network volumes (NFS, CIFS, etc.)
	return ModeFilesystem
}

// calculateViaDockerAPI uses Docker's disk usage API (fast, local volumes only)
func (s *SizeCalculator) calculateViaDockerAPI(ctx context.Context, result *SizeCalculationResult) error {
	// Get volume info from Docker
	volume, err := s.dockerService.GetVolume(ctx, result.VolumeID)
	if err != nil {
		return fmt.Errorf("failed to get volume: %w", err)
	}

	// Check if we have size information from usage data
	if volume.UsageData != nil && volume.UsageData.Size > 0 {
		result.TotalSizeBytes = volume.UsageData.Size
		result.UsedSizeBytes = volume.UsageData.Size // Docker only provides total size
		result.FreeSizeBytes = 0                      // Not available from Docker API
		result.FileCount = int64(volume.UsageData.RefCount)
		result.FolderCount = 0 // Not available from Docker API
		return nil
	}

	// Fallback to filesystem walk if size not available
	log.Printf("[SIZE-CALC] Docker API returned no size data for %s, falling back to filesystem walk", result.VolumeID)
	return s.calculateViaFilesystem(ctx, result)
}

// calculateViaFilesystem performs a filesystem walk to calculate size (works for all volume types)
func (s *SizeCalculator) calculateViaFilesystem(ctx context.Context, result *SizeCalculationResult) error {
	if result.MountPoint == "" {
		return fmt.Errorf("mount point not available for filesystem walk")
	}

	var totalSize int64
	var fileCount int64
	var folderCount int64
	var walkErr error

	// Progress tracking
	var processedFiles atomic.Int64
	var lastLogTime time.Time

	// Perform filesystem walk
	err := filepath.WalkDir(result.MountPoint, func(path string, d fs.DirEntry, err error) error {
		// Check context cancellation
		select {
		case <-ctx.Done():
			return ctx.Err()
		default:
		}

		if err != nil {
			// Log error but continue walking
			log.Printf("[SIZE-CALC] Error accessing %s: %v", path, err)
			return nil // Continue despite errors
		}

		if d.IsDir() {
			folderCount++
		} else {
			fileCount++

			// Get file info
			info, err := d.Info()
			if err != nil {
				return nil // Skip files we can't stat
			}

			totalSize += info.Size()
		}

		// Progress logging (every 10k files)
		if s.config.EnableProgressTracking {
			count := processedFiles.Add(1)
			if count%10000 == 0 && time.Since(lastLogTime) > 5*time.Second {
				log.Printf("[SIZE-CALC] Progress for %s: %d files, %d folders, %s",
					result.VolumeID, fileCount, folderCount, s.formatBytes(totalSize))
				lastLogTime = time.Now()
			}
		}

		return nil
	})

	if err != nil {
		walkErr = fmt.Errorf("filesystem walk failed: %w", err)
	}

	result.TotalSizeBytes = totalSize
	result.UsedSizeBytes = totalSize // We count all files as "used"
	result.FreeSizeBytes = 0         // We don't have capacity info from filesystem walk
	result.FileCount = fileCount
	result.FolderCount = folderCount

	return walkErr
}

// StoreResult stores the calculation result in the database
func (s *SizeCalculator) StoreResult(ctx context.Context, result *SizeCalculationResult, organizationID int64) error {
	if result.Error != nil {
		return fmt.Errorf("cannot store failed calculation result: %w", result.Error)
	}

	// Get sqlc queries
	queries, ok := s.store.Queries().(*sqlc.Queries)
	if !ok {
		return fmt.Errorf("database queries not available")
	}

	// Update volume size in database using UpdateVolumeStats
	_, err := queries.UpdateVolumeStats(ctx, sqlc.UpdateVolumeStatsParams{
		VolumeID:        result.VolumeID,
		TotalSizeBytes:  pgtype.Int8{Int64: result.TotalSizeBytes, Valid: true},
		UsedSizeBytes:   pgtype.Int8{Int64: result.UsedSizeBytes, Valid: true},
		FreeSizeBytes:   pgtype.Int8{Int64: result.FreeSizeBytes, Valid: true},
		OrganizationID:  pgtype.Int8{Int64: organizationID, Valid: true},
	})

	if err != nil {
		return fmt.Errorf("failed to update volume stats: %w", err)
	}

	log.Printf("[SIZE-CALC] Updated database: volume=%s size=%d bytes files=%d folders=%d",
		result.VolumeID, result.TotalSizeBytes, result.FileCount, result.FolderCount)

	return nil
}

// GetMetrics returns current calculator metrics
func (s *SizeCalculator) GetMetrics() map[string]int64 {
	return map[string]int64{
		"total_calculations":    s.totalCalculations.Load(),
		"successful_calcs":      s.successfulCalcs.Load(),
		"failed_calcs":          s.failedCalcs.Load(),
		"docker_api_calcs":      s.dockerAPICalcs.Load(),
		"filesystem_calcs":      s.filesystemCalcs.Load(),
		"total_bytes_processed": s.totalBytesProcessed.Load(),
	}
}

// formatBytes formats bytes into human-readable string
func (s *SizeCalculator) formatBytes(bytes int64) string {
	const unit = 1024
	if bytes < unit {
		return fmt.Sprintf("%d B", bytes)
	}
	div, exp := int64(unit), 0
	for n := bytes / unit; n >= unit; n /= unit {
		div *= unit
		exp++
	}
	return fmt.Sprintf("%.1f %ciB", float64(bytes)/float64(div), "KMGTPE"[exp])
}
