package store

import (
	"context"
	"time"
)

// FileRow represents a normalized file/directory entry for bulk ingestion
// Designed for high-performance bulk operations with minimal allocations
type FileRow struct {
	VolumeID    string    `json:"volume_id"`
	ParentDirID *uint64   `json:"parent_dir_id,omitempty"`
	Name        string    `json:"name"`
	FullPath    string    `json:"full_path"` // Used for dir_nodes and path_hash calculation
	SizeBytes   int64     `json:"size_bytes"`
	MTime       time.Time `json:"mtime"`
	CTime       time.Time `json:"ctime"`
	Inode       *uint64   `json:"inode,omitempty"`
	UID         *uint32   `json:"uid,omitempty"`
	GID         *uint32   `json:"gid,omitempty"`
	Type        string    `json:"type"` // "file", "dir", "symlink"
	Hidden      bool      `json:"hidden"`
	Depth       int       `json:"depth"` // Used for dir_nodes
	PathHash    []byte    `json:"-"`     // Computed automatically
}

// DirRollupRow represents aggregated directory statistics for bulk ingestion
type DirRollupRow struct {
	DirID      uint64    `json:"dir_id"`
	SizeBytes  int64     `json:"size_bytes"`
	FileCount  int64     `json:"file_count"`
	ComputedAt time.Time `json:"computed_at"`
}

// BulkIngestOptions configures bulk ingestion behavior
type BulkIngestOptions struct {
	// BatchSize controls the number of rows per batch
	// PostgreSQL: affects CopyFrom batch size
	// SQLite: affects prepared statement batch size
	BatchSize int `json:"batch_size,omitempty"`

	// MaxBatches limits the total number of batches processed
	// Used for testing and rate limiting
	MaxBatches int `json:"max_batches,omitempty"`

	// UseStaging enables PostgreSQL staging table approach
	// When true, inserts to staging table first, then merges
	UseStaging bool `json:"use_staging,omitempty"`

	// SkipHashCalculation allows pre-computed path hashes
	// Set to true if PathHash is already populated in FileRows
	SkipHashCalculation bool `json:"skip_hash_calculation,omitempty"`

	// ConflictStrategy determines how to handle conflicts
	// "ignore" = skip duplicates, "replace" = update existing
	ConflictStrategy string `json:"conflict_strategy,omitempty"`

	// Adaptive controls whether to use adaptive batch sizing
	// SQLite: adjusts batch size based on performance
	Adaptive bool `json:"adaptive,omitempty"`
}

// BulkIngestResult contains results from bulk ingestion operation
type BulkIngestResult struct {
	TotalRows     int64         `json:"total_rows"`
	ProcessedRows int64         `json:"processed_rows"`
	SkippedRows   int64         `json:"skipped_rows"`
	ErrorRows     int64         `json:"error_rows"`
	FileEntries   int64         `json:"file_entries"`
	DirEntries    int64         `json:"dir_entries"`
	Duration      time.Duration `json:"duration"`
	RowsPerSecond float64       `json:"rows_per_second"`
	BatchCount    int           `json:"batch_count"`
	AvgBatchSize  float64       `json:"avg_batch_size"`
	Errors        []string      `json:"errors,omitempty"`
}

// BulkIngester defines the interface for high-performance bulk file ingestion
// Implementations provide database-specific optimizations
type BulkIngester interface {
	// IngestFiles performs bulk insertion of file/directory entries
	// Automatically separates files from directories and handles relationships
	IngestFiles(ctx context.Context, volumeID string, rows []FileRow, opts BulkIngestOptions) (*BulkIngestResult, error)

	// IngestDirectoryRollups performs bulk insertion of directory statistics
	IngestDirectoryRollups(ctx context.Context, rollups []DirRollupRow, opts BulkIngestOptions) (*BulkIngestResult, error)

	// CreateStagingTables creates temporary tables for PostgreSQL staging approach
	CreateStagingTables(ctx context.Context, suffix string) error

	// DropStagingTables removes temporary staging tables
	DropStagingTables(ctx context.Context, suffix string) error

	// GetOptimalBatchSize returns recommended batch size for the database type
	GetOptimalBatchSize() int

	// SupportsStaging returns true if the implementation supports staging tables
	SupportsStaging() bool
}

// DefaultBulkIngestOptions returns sensible defaults for bulk ingestion
func DefaultBulkIngestOptions() BulkIngestOptions {
	return BulkIngestOptions{
		BatchSize:           10000,    // 10k rows per batch for PostgreSQL
		MaxBatches:          0,        // No limit
		UseStaging:          true,     // Use staging when available
		SkipHashCalculation: false,    // Calculate path hashes
		ConflictStrategy:    "ignore", // Skip duplicates by default
		Adaptive:            true,     // Enable adaptive batch sizing
	}
}

// SQLiteOptimizedOptions returns options optimized for SQLite
func SQLiteOptimizedOptions() BulkIngestOptions {
	return BulkIngestOptions{
		BatchSize:           80, // Safe batch size for SQLite's 999 parameter limit
		MaxBatches:          0,
		UseStaging:          false, // SQLite doesn't use staging
		SkipHashCalculation: false,
		ConflictStrategy:    "ignore",
		Adaptive:            true, // Important for SQLite performance
	}
}

// PostgreSQLOptimizedOptions returns options optimized for PostgreSQL
func PostgreSQLOptimizedOptions() BulkIngestOptions {
	return BulkIngestOptions{
		BatchSize:           25000, // Large batches with CopyFrom
		MaxBatches:          0,
		UseStaging:          true, // Use staging tables
		SkipHashCalculation: false,
		ConflictStrategy:    "replace", // Use ON CONFLICT for updates
		Adaptive:            false,     // PostgreSQL batch size is consistent
	}
}
