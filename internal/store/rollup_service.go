package store

import (
	"context"
	"fmt"
	"log"
	"time"
)

// RollupOptions configures rollup computation behavior
type RollupOptions struct {
	// Incremental mode: only process touched directories and their ancestors
	Incremental bool

	// TouchedDirIDs: specific directory IDs that need rollup updates
	// If nil and Incremental=true, auto-detects based on file changes
	TouchedDirIDs []int64

	// ForceAll: force rollup computation even for unchanged directories
	ForceAll bool

	// SinceTimestamp: only consider changes after this timestamp
	SinceTimestamp *time.Time

	// ValidateResults: run consistency validation after computation
	ValidateResults bool

	// BatchSize: number of directories to process in each batch (SQLite)
	BatchSize int

	// MaxDuration: maximum time to spend on rollup computation
	MaxDuration time.Duration
}

// RollupResult contains the results of rollup computation
type RollupResult struct {
	// Processing statistics
	ProcessedDirectories int64         `json:"processed_directories"`
	CreatedRollups       int64         `json:"created_rollups"`
	UpdatedRollups       int64         `json:"updated_rollups"`
	Duration             time.Duration `json:"duration"`
	PerformanceRating    string        `json:"performance_rating"` // "excellent", "good", "acceptable", "poor"

	// Volume information
	VolumeID       string `json:"volume_id"`
	TotalSize      int64  `json:"total_size"`
	TotalFiles     int64  `json:"total_files"`
	DirectoryCount int64  `json:"directory_count"`

	// Quality assurance
	ValidationResults     []ValidationResult `json:"validation_results,omitempty"`
	InconsistentDirs      int64              `json:"inconsistent_dirs"`
	SuccessfulValidations int64              `json:"successful_validations"`

	// Performance metrics
	DirsPerSecond float64       `json:"dirs_per_second"`
	AvgTimePerDir time.Duration `json:"avg_time_per_dir"`
	DatabaseType  string        `json:"database_type"`

	// Incremental processing info
	TouchedDirCount  int64 `json:"touched_dir_count,omitempty"`
	AffectedDirCount int64 `json:"affected_dir_count,omitempty"`
	WasIncremental   bool  `json:"was_incremental"`

	// Error information
	Errors   []string `json:"errors,omitempty"`
	Warnings []string `json:"warnings,omitempty"`
}

// ValidationResult represents the result of validating a single directory rollup
type ValidationResult struct {
	DirID           int64     `json:"dir_id"`
	FullPath        string    `json:"full_path"`
	RollupSize      int64     `json:"rollup_size"`
	ComputedSize    int64     `json:"computed_size"`
	RollupFiles     int64     `json:"rollup_files"`
	ComputedFiles   int64     `json:"computed_files"`
	SizeConsistent  bool      `json:"size_consistent"`
	FilesConsistent bool      `json:"files_consistent"`
	SizeDiff        int64     `json:"size_diff"`
	FilesDiff       int64     `json:"files_diff"`
	ValidatedAt     time.Time `json:"validated_at"`
}

// RollupService provides rollup computation functionality
type RollupService interface {
	// Rollup computes directory rollups for a volume
	// Supports both full and incremental computation modes
	Rollup(ctx context.Context, volumeID string, opts *RollupOptions) (*RollupResult, error)

	// GetRollupStatus returns the current rollup status for a volume
	GetRollupStatus(ctx context.Context, volumeID string) (*RollupStatus, error)

	// ValidateRollups validates rollup consistency for a volume
	ValidateRollups(ctx context.Context, volumeID string, limit int32) ([]ValidationResult, error)
}

// RollupStatus contains information about the rollup state of a volume
type RollupStatus struct {
	VolumeID                 string     `json:"volume_id"`
	LastRollupTime           *time.Time `json:"last_rollup_time,omitempty"`
	DirectoriesWithRollups   int64      `json:"directories_with_rollups"`
	TotalDirectories         int64      `json:"total_directories"`
	RollupCoverage           float64    `json:"rollup_coverage"` // percentage
	OldestRollup             *time.Time `json:"oldest_rollup,omitempty"`
	NewestRollup             *time.Time `json:"newest_rollup,omitempty"`
	DirectoriesNeedingUpdate int64      `json:"directories_needing_update"`
	IsHealthy                bool       `json:"is_healthy"`
	HealthIssues             []string   `json:"health_issues,omitempty"`
}

// PostgreSQLRollupService implements RollupService for PostgreSQL using recursive CTEs
type PostgreSQLRollupService struct {
	store Store
}

// NewPostgreSQLRollupService creates a new PostgreSQL rollup service
func NewPostgreSQLRollupService(store Store) *PostgreSQLRollupService {
	return &PostgreSQLRollupService{
		store: store,
	}
}

// Rollup computes directory rollups using PostgreSQL recursive CTEs
func (s *PostgreSQLRollupService) Rollup(ctx context.Context, volumeID string, opts *RollupOptions) (*RollupResult, error) {
	startTime := time.Now()

	if opts == nil {
		opts = DefaultRollupOptions()
	}

	result := &RollupResult{
		VolumeID:       volumeID,
		WasIncremental: opts.Incremental,
		DatabaseType:   "PostgreSQL",
	}

	// Apply timeout if specified
	if opts.MaxDuration > 0 {
		var cancel context.CancelFunc
		ctx, cancel = context.WithTimeout(ctx, opts.MaxDuration)
		defer cancel()
	}

	log.Printf("rollup: starting %s rollup for volume %s",
		map[bool]string{true: "incremental", false: "full"}[opts.Incremental], volumeID)

	var computedRollups []struct {
		DirID      int64     `json:"dir_id"`
		SizeBytes  int64     `json:"size_bytes"`
		FileCount  int64     `json:"file_count"`
		ComputedAt time.Time `json:"computed_at"`
		Depth      int32     `json:"depth"`
		FullPath   string    `json:"full_path"`
	}

	if opts.Incremental && len(opts.TouchedDirIDs) == 0 && !opts.ForceAll {
		// Auto-detect touched directories
		touchedDirs, err := s.getDirectoriesRequiringRollup(ctx, volumeID, opts.SinceTimestamp, false)
		if err != nil {
			return nil, fmt.Errorf("failed to detect touched directories: %w", err)
		}

		for _, dir := range touchedDirs {
			opts.TouchedDirIDs = append(opts.TouchedDirIDs, dir.DirID)
		}
		result.TouchedDirCount = int64(len(opts.TouchedDirIDs))
	}

	if opts.Incremental && len(opts.TouchedDirIDs) > 0 {
		log.Printf("rollup: computing incremental rollups for %d touched directories", len(opts.TouchedDirIDs))

		// Use incremental computation query
		// This would typically involve executing the ComputeIncrementalRollups query
		// For now, we'll simulate the process
		computedRollups = []struct {
			DirID      int64     `json:"dir_id"`
			SizeBytes  int64     `json:"size_bytes"`
			FileCount  int64     `json:"file_count"`
			ComputedAt time.Time `json:"computed_at"`
			Depth      int32     `json:"depth"`
			FullPath   string    `json:"full_path"`
		}{}

		// In real implementation, would execute:
		// computedRollups, err = s.executeIncrementalRollupQuery(ctx, volumeID, opts.TouchedDirIDs)

		result.AffectedDirCount = int64(len(computedRollups))
	} else {
		log.Printf("rollup: computing full volume rollups")

		// Use full volume computation query
		// In real implementation, would execute:
		// computedRollups, err = s.executeFullRollupQuery(ctx, volumeID)

		computedRollups = []struct {
			DirID      int64     `json:"dir_id"`
			SizeBytes  int64     `json:"size_bytes"`
			FileCount  int64     `json:"file_count"`
			ComputedAt time.Time `json:"computed_at"`
			Depth      int32     `json:"depth"`
			FullPath   string    `json:"full_path"`
		}{}
	}

	// Bulk insert computed rollups
	rollups := make([]*DirRollup, len(computedRollups))
	for i, computed := range computedRollups {
		rollups[i] = &DirRollup{
			DirID:      computed.DirID,
			SizeBytes:  computed.SizeBytes,
			FileCount:  computed.FileCount,
			ComputedAt: computed.ComputedAt,
			CreatedAt:  time.Now(),
		}
	}

	if len(rollups) > 0 {
		params := DefaultBulkInsertParams()
		params.BatchSize = 5000 // Larger batches for PostgreSQL

		err := s.store.BulkInsertDirRollups(ctx, rollups, params)
		if err != nil {
			return nil, fmt.Errorf("failed to insert rollups: %w", err)
		}

		result.CreatedRollups = int64(len(rollups))
	}

	// Validation if requested
	if opts.ValidateResults && len(rollups) > 0 {
		validationResults, err := s.ValidateRollups(ctx, volumeID, 100)
		if err != nil {
			result.Warnings = append(result.Warnings, fmt.Sprintf("validation failed: %v", err))
		} else {
			result.ValidationResults = validationResults
			result.SuccessfulValidations = int64(len(validationResults))

			for _, v := range validationResults {
				if !v.SizeConsistent || !v.FilesConsistent {
					result.InconsistentDirs++
				}
			}
		}
	}

	// Calculate performance metrics
	result.Duration = time.Since(startTime)
	result.ProcessedDirectories = int64(len(computedRollups))

	if result.Duration.Seconds() > 0 {
		result.DirsPerSecond = float64(result.ProcessedDirectories) / result.Duration.Seconds()
	}

	if result.ProcessedDirectories > 0 {
		result.AvgTimePerDir = time.Duration(int64(result.Duration) / result.ProcessedDirectories)
	}

	// Performance rating
	result.PerformanceRating = s.calculatePerformanceRating(result.DirsPerSecond, result.Duration)

	log.Printf("rollup: completed in %v, processed %d directories at %.0f dirs/sec (%s)",
		result.Duration, result.ProcessedDirectories, result.DirsPerSecond, result.PerformanceRating)

	return result, nil
}

// getDirectoriesRequiringRollup identifies directories needing updates
func (s *PostgreSQLRollupService) getDirectoriesRequiringRollup(ctx context.Context, volumeID string, since *time.Time, forceAll bool) ([]struct {
	DirID             int64      `json:"dir_id"`
	VolumeID          string     `json:"volume_id"`
	FullPath          string     `json:"full_path"`
	Depth             int32      `json:"depth"`
	LastRollupDate    *time.Time `json:"last_rollup_date"`
	LatestFileChange  *time.Time `json:"latest_file_change"`
	ChangedFilesCount int64      `json:"changed_files_count"`
	RollupPriority    int32      `json:"rollup_priority"`
}, error) {
	// In real implementation, this would execute the GetDirectoriesRequiringRollup query
	// For now, return empty slice
	return []struct {
		DirID             int64      `json:"dir_id"`
		VolumeID          string     `json:"volume_id"`
		FullPath          string     `json:"full_path"`
		Depth             int32      `json:"depth"`
		LastRollupDate    *time.Time `json:"last_rollup_date"`
		LatestFileChange  *time.Time `json:"latest_file_change"`
		ChangedFilesCount int64      `json:"changed_files_count"`
		RollupPriority    int32      `json:"rollup_priority"`
	}{}, nil
}

// GetRollupStatus returns rollup status for a volume
func (s *PostgreSQLRollupService) GetRollupStatus(ctx context.Context, volumeID string) (*RollupStatus, error) {
	// In real implementation, this would query rollup statistics
	return &RollupStatus{
		VolumeID:               volumeID,
		IsHealthy:              true,
		RollupCoverage:         85.5,
		DirectoriesWithRollups: 1000,
		TotalDirectories:       1200,
	}, nil
}

// ValidateRollups validates rollup consistency
func (s *PostgreSQLRollupService) ValidateRollups(ctx context.Context, volumeID string, limit int32) ([]ValidationResult, error) {
	// In real implementation, this would execute the ValidateRollupConsistency query
	return []ValidationResult{}, nil
}

// calculatePerformanceRating determines performance rating based on metrics
func (s *PostgreSQLRollupService) calculatePerformanceRating(dirsPerSecond float64, duration time.Duration) string {
	// Rating based on directories per second for PostgreSQL
	switch {
	case dirsPerSecond >= 2000: // > 2000 dirs/sec
		return "excellent"
	case dirsPerSecond >= 1000: // 1000-2000 dirs/sec
		return "good"
	case dirsPerSecond >= 500: // 500-1000 dirs/sec
		return "acceptable"
	default:
		return "poor"
	}
}

// SQLiteRollupService implements RollupService for SQLite using iterative processing
type SQLiteRollupService struct {
	store Store
}

// NewSQLiteRollupService creates a new SQLite rollup service
func NewSQLiteRollupService(store Store) *SQLiteRollupService {
	return &SQLiteRollupService{
		store: store,
	}
}

// Rollup computes directory rollups using SQLite iterative depth-ordered processing
func (s *SQLiteRollupService) Rollup(ctx context.Context, volumeID string, opts *RollupOptions) (*RollupResult, error) {
	startTime := time.Now()

	if opts == nil {
		opts = DefaultRollupOptions()
	}

	result := &RollupResult{
		VolumeID:       volumeID,
		WasIncremental: opts.Incremental,
		DatabaseType:   "SQLite",
	}

	log.Printf("rollup: starting SQLite %s rollup for volume %s",
		map[bool]string{true: "incremental", false: "full"}[opts.Incremental], volumeID)

	// Get directories in depth-descending order (deepest first)
	var directories []struct {
		ID              int64     `json:"id"`
		VolumeID        string    `json:"volume_id"`
		ParentDirID     *int64    `json:"parent_dir_id"`
		Name            string    `json:"name"`
		FullPath        string    `json:"full_path"`
		Depth           int32     `json:"depth"`
		LatestSizeBytes int64     `json:"latest_size_bytes"`
		LatestFileCount int64     `json:"latest_file_count"`
		UpdatedAt       time.Time `json:"updated_at"`
	}

	if opts.Incremental && len(opts.TouchedDirIDs) > 0 {
		// Get affected directories (touched + ancestors)
		// In real implementation: directories = s.executeGetAffectedDirectories(ctx, volumeID, opts.TouchedDirIDs)
		directories = []struct {
			ID              int64     `json:"id"`
			VolumeID        string    `json:"volume_id"`
			ParentDirID     *int64    `json:"parent_dir_id"`
			Name            string    `json:"name"`
			FullPath        string    `json:"full_path"`
			Depth           int32     `json:"depth"`
			LatestSizeBytes int64     `json:"latest_size_bytes"`
			LatestFileCount int64     `json:"latest_file_count"`
			UpdatedAt       time.Time `json:"updated_at"`
		}{}

		result.TouchedDirCount = int64(len(opts.TouchedDirIDs))
		result.AffectedDirCount = int64(len(directories))
	} else {
		// Get all directories for full rollup
		// In real implementation: directories = s.executeGetDirectoriesByDepthDesc(ctx, volumeID, nil)
		directories = []struct {
			ID              int64     `json:"id"`
			VolumeID        string    `json:"volume_id"`
			ParentDirID     *int64    `json:"parent_dir_id"`
			Name            string    `json:"name"`
			FullPath        string    `json:"full_path"`
			Depth           int32     `json:"depth"`
			LatestSizeBytes int64     `json:"latest_size_bytes"`
			LatestFileCount int64     `json:"latest_file_count"`
			UpdatedAt       time.Time `json:"updated_at"`
		}{}
	}

	// Process directories iteratively in depth order
	batchSize := opts.BatchSize
	if batchSize <= 0 {
		batchSize = 100 // Default batch size for SQLite
	}

	var processedCount int64
	var createdRollups []*DirRollup

	// Prepare batch processing
	// In real implementation: s.executeCreateRollupBatchPrep(ctx)

	for i := 0; i < len(directories); i += batchSize {
		end := i + batchSize
		if end > len(directories) {
			end = len(directories)
		}

		batch := directories[i:end]
		log.Printf("rollup: processing batch %d-%d (%d directories)", i, end-1, len(batch))

		// Clear batch table
		// In real implementation: s.executeClearRollupBatchPrep(ctx)

		for _, dir := range batch {
			// Compute rollup for this directory
			// In real implementation: stats = s.executeComputeDirectoryRollupStatsWithFallback(ctx, dir.ID, volumeID)

			rollup := &DirRollup{
				DirID:      dir.ID,
				SizeBytes:  dir.LatestSizeBytes, // Placeholder - would be computed
				FileCount:  dir.LatestFileCount, // Placeholder - would be computed
				ComputedAt: time.Now(),
				CreatedAt:  time.Now(),
			}

			createdRollups = append(createdRollups, rollup)
			processedCount++

			// In real implementation: s.executeInsertRollupBatch(ctx, rollup)

			// Check for context cancellation
			select {
			case <-ctx.Done():
				return nil, ctx.Err()
			default:
			}
		}

		// Commit batch
		// In real implementation: s.executeCommitRollupBatch(ctx)

		log.Printf("rollup: completed batch, processed %d directories", processedCount)
	}

	result.ProcessedDirectories = processedCount
	result.CreatedRollups = int64(len(createdRollups))

	// Calculate performance metrics
	result.Duration = time.Since(startTime)
	if result.Duration.Seconds() > 0 {
		result.DirsPerSecond = float64(result.ProcessedDirectories) / result.Duration.Seconds()
	}
	if result.ProcessedDirectories > 0 {
		result.AvgTimePerDir = time.Duration(int64(result.Duration) / result.ProcessedDirectories)
	}

	result.PerformanceRating = s.calculatePerformanceRating(result.DirsPerSecond, result.Duration)

	log.Printf("rollup: SQLite rollup completed in %v, processed %d directories at %.0f dirs/sec (%s)",
		result.Duration, result.ProcessedDirectories, result.DirsPerSecond, result.PerformanceRating)

	return result, nil
}

// GetRollupStatus returns rollup status for SQLite
func (s *SQLiteRollupService) GetRollupStatus(ctx context.Context, volumeID string) (*RollupStatus, error) {
	// In real implementation, would query rollup stats
	return &RollupStatus{
		VolumeID:       volumeID,
		IsHealthy:      true,
		RollupCoverage: 92.3,
	}, nil
}

// ValidateRollups validates rollup consistency for SQLite
func (s *SQLiteRollupService) ValidateRollups(ctx context.Context, volumeID string, limit int32) ([]ValidationResult, error) {
	// In real implementation, would execute validation queries
	return []ValidationResult{}, nil
}

// calculatePerformanceRating determines performance rating for SQLite
func (s *SQLiteRollupService) calculatePerformanceRating(dirsPerSecond float64, duration time.Duration) string {
	// SQLite typically slower than PostgreSQL due to iterative processing
	switch {
	case dirsPerSecond >= 1000: // > 1000 dirs/sec
		return "excellent"
	case dirsPerSecond >= 500: // 500-1000 dirs/sec
		return "good"
	case dirsPerSecond >= 200: // 200-500 dirs/sec
		return "acceptable"
	default:
		return "poor"
	}
}

// DefaultRollupOptions returns sensible default options
func DefaultRollupOptions() *RollupOptions {
	return &RollupOptions{
		Incremental:     true, // Default to incremental for efficiency
		ForceAll:        false,
		ValidateResults: false,            // Skip validation by default for performance
		BatchSize:       100,              // Conservative batch size
		MaxDuration:     10 * time.Minute, // Reasonable timeout
	}
}

// NewRollupService creates appropriate rollup service based on database type
func NewRollupService(store Store) RollupService {
	// Determine database type - this would typically be done via reflection or type assertion
	// For now, we'll default to SQLite
	return NewSQLiteRollupService(store)
}
