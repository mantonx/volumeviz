package store

import (
	"context"
	"database/sql"
	"fmt"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/mantonx/volumeviz/internal/store/config"
)

// BulkIngestFacade provides a unified interface for bulk file ingestion across database types
// Automatically selects the optimal implementation based on database configuration
type BulkIngestFacade struct {
	ingester BulkIngester
	dbType   config.DatabaseType
}

// NewBulkIngestFacade creates a new bulk ingestion facade based on database type and integration
func NewBulkIngestFacade(integration *Integration) (*BulkIngestFacade, error) {
	if integration == nil {
		return nil, fmt.Errorf("store integration is required")
	}

	facade := &BulkIngestFacade{
		dbType: integration.GetDatabaseType(),
	}

	switch integration.GetDatabaseType() {
	case config.DatabaseTypePostgreSQL:
		if integration.pgPool == nil {
			return nil, fmt.Errorf("PostgreSQL pool is not available")
		}
		pgPool, ok := integration.pgPool.(*pgxpool.Pool)
		if !ok {
			return nil, fmt.Errorf("invalid PostgreSQL pool type")
		}
		facade.ingester = NewPostgresBulkIngester(pgPool)

	case config.DatabaseTypeSQLite:
		if integration.sqliteDB == nil {
			return nil, fmt.Errorf("SQLite database is not available")
		}
		sqliteDB, ok := integration.sqliteDB.(*sql.DB)
		if !ok {
			return nil, fmt.Errorf("invalid SQLite database type")
		}
		facade.ingester = NewSQLiteBulkIngester(sqliteDB)

	default:
		return nil, fmt.Errorf("unsupported database type for bulk ingestion: %s", integration.GetDatabaseType())
	}

	return facade, nil
}

// IngestFiles performs high-performance bulk ingestion of file/directory entries
// This is the main API for ingesting millions of file system scan results
func (f *BulkIngestFacade) IngestFiles(ctx context.Context, volumeID string, rows []FileRow, opts ...BulkIngestOptions) (*BulkIngestResult, error) {
	if f.ingester == nil {
		return nil, fmt.Errorf("bulk ingester not initialized")
	}

	// Use default options if none provided
	var options BulkIngestOptions
	if len(opts) > 0 {
		options = opts[0]
	} else {
		// Apply database-specific defaults
		switch f.dbType {
		case config.DatabaseTypePostgreSQL:
			options = PostgreSQLOptimizedOptions()
		case config.DatabaseTypeSQLite:
			options = SQLiteOptimizedOptions()
		default:
			options = DefaultBulkIngestOptions()
		}
	}

	return f.ingester.IngestFiles(ctx, volumeID, rows, options)
}

// IngestDirectoryRollups performs bulk ingestion of directory rollup statistics
func (f *BulkIngestFacade) IngestDirectoryRollups(ctx context.Context, rollups []DirRollupRow, opts ...BulkIngestOptions) (*BulkIngestResult, error) {
	if f.ingester == nil {
		return nil, fmt.Errorf("bulk ingester not initialized")
	}

	var options BulkIngestOptions
	if len(opts) > 0 {
		options = opts[0]
	} else {
		options = DefaultBulkIngestOptions()
	}

	return f.ingester.IngestDirectoryRollups(ctx, rollups, options)
}

// GetDatabaseType returns the current database type
func (f *BulkIngestFacade) GetDatabaseType() config.DatabaseType {
	return f.dbType
}

// GetOptimalBatchSize returns the recommended batch size for the current database
func (f *BulkIngestFacade) GetOptimalBatchSize() int {
	if f.ingester == nil {
		return 5000 // Conservative default
	}
	return f.ingester.GetOptimalBatchSize()
}

// SupportsStaging returns true if the current database supports staging tables
func (f *BulkIngestFacade) SupportsStaging() bool {
	if f.ingester == nil {
		return false
	}
	return f.ingester.SupportsStaging()
}

// CreateStagingTables creates staging tables (PostgreSQL only)
func (f *BulkIngestFacade) CreateStagingTables(ctx context.Context, suffix string) error {
	if f.ingester == nil {
		return fmt.Errorf("bulk ingester not initialized")
	}
	return f.ingester.CreateStagingTables(ctx, suffix)
}

// DropStagingTables removes staging tables (PostgreSQL only)
func (f *BulkIngestFacade) DropStagingTables(ctx context.Context, suffix string) error {
	if f.ingester == nil {
		return fmt.Errorf("bulk ingester not initialized")
	}
	return f.ingester.DropStagingTables(ctx, suffix)
}

// EstimateIngestionTime provides rough time estimates for large ingestion operations
func (f *BulkIngestFacade) EstimateIngestionTime(rowCount int64) (estimate EstimatedIngestionTime) {
	batchSize := int64(f.GetOptimalBatchSize())
	if batchSize == 0 {
		batchSize = 5000
	}

	batchCount := (rowCount + batchSize - 1) / batchSize // Ceiling division

	// Database-specific performance estimates (based on typical hardware)
	switch f.dbType {
	case config.DatabaseTypePostgreSQL:
		// PostgreSQL with CopyFrom: ~50k-100k rows/second on typical hardware
		estimate.RowsPerSecond = 75000
		estimate.DatabaseType = "PostgreSQL"
		estimate.Method = "CopyFrom + Staging Tables"

	case config.DatabaseTypeSQLite:
		// SQLite with prepared statements: ~20k-40k rows/second on typical hardware
		estimate.RowsPerSecond = 30000
		estimate.DatabaseType = "SQLite"
		estimate.Method = "Prepared Statements + Adaptive Batching"

	default:
		estimate.RowsPerSecond = 25000
		estimate.DatabaseType = "Unknown"
		estimate.Method = "Generic Bulk Insert"
	}

	estimate.TotalRows = rowCount
	estimate.EstimatedBatches = batchCount
	estimate.OptimalBatchSize = int(batchSize)
	estimate.EstimatedDuration = float64(rowCount) / estimate.RowsPerSecond
	estimate.MemoryEstimateMB = estimateMemoryUsage(rowCount, batchSize)

	return estimate
}

// EstimatedIngestionTime contains performance estimates for bulk ingestion
type EstimatedIngestionTime struct {
	TotalRows         int64   `json:"total_rows"`
	EstimatedDuration float64 `json:"estimated_duration_seconds"`
	RowsPerSecond     float64 `json:"rows_per_second"`
	EstimatedBatches  int64   `json:"estimated_batches"`
	OptimalBatchSize  int     `json:"optimal_batch_size"`
	MemoryEstimateMB  int64   `json:"memory_estimate_mb"`
	DatabaseType      string  `json:"database_type"`
	Method            string  `json:"method"`
}

// estimateMemoryUsage calculates rough memory requirements for bulk ingestion
func estimateMemoryUsage(rowCount, batchSize int64) int64 {
	// Rough estimates based on FileRow structure size
	// FileRow is approximately 200-300 bytes per row (strings, timestamps, etc.)
	bytesPerRow := int64(250)

	// Memory needed for one batch in memory
	batchMemory := batchSize * bytesPerRow

	// Add overhead for prepared statements, connection buffers, etc.
	overhead := batchMemory / 4 // 25% overhead

	totalMB := (batchMemory + overhead) / (1024 * 1024)

	// Minimum 16MB, maximum 512MB estimate
	if totalMB < 16 {
		totalMB = 16
	}
	if totalMB > 512 {
		totalMB = 512
	}

	return totalMB
}

// ValidateFileRows performs basic validation on FileRow data before ingestion
func (f *BulkIngestFacade) ValidateFileRows(rows []FileRow) []error {
	var errors []error

	for i, row := range rows {
		// Validate required fields
		if row.VolumeID == "" {
			errors = append(errors, fmt.Errorf("row %d: volume_id is required", i))
		}

		if row.Name == "" {
			errors = append(errors, fmt.Errorf("row %d: name is required", i))
		}

		if row.Type != "file" && row.Type != "dir" && row.Type != "symlink" {
			errors = append(errors, fmt.Errorf("row %d: invalid type '%s', must be 'file', 'dir', or 'symlink'", i, row.Type))
		}

		if row.Type == "dir" && row.FullPath == "" {
			errors = append(errors, fmt.Errorf("row %d: full_path is required for directories", i))
		}

		if row.SizeBytes < 0 {
			errors = append(errors, fmt.Errorf("row %d: size_bytes cannot be negative", i))
		}

		if row.Depth < 0 {
			errors = append(errors, fmt.Errorf("row %d: depth cannot be negative", i))
		}

		// Validate name length (database constraint)
		if len(row.Name) > 512 {
			errors = append(errors, fmt.Errorf("row %d: name too long (%d chars, max 512)", i, len(row.Name)))
		}

		// Validate full_path length for directories (database constraint)
		if row.Type == "dir" && len(row.FullPath) > 4096 {
			errors = append(errors, fmt.Errorf("row %d: full_path too long (%d chars, max 4096)", i, len(row.FullPath)))
		}
	}

	return errors
}

// SanitizeFileRows cleans and prepares FileRow data for ingestion
func (f *BulkIngestFacade) SanitizeFileRows(rows []FileRow) []FileRow {
	sanitized := make([]FileRow, len(rows))

	for i, row := range rows {
		sanitized[i] = row

		// Truncate oversized fields to fit database constraints
		if len(row.Name) > 512 {
			sanitized[i].Name = row.Name[:512]
		}

		if len(row.FullPath) > 4096 {
			sanitized[i].FullPath = row.FullPath[:4096]
		}

		// Ensure non-negative values
		if row.SizeBytes < 0 {
			sanitized[i].SizeBytes = 0
		}

		if row.Depth < 0 {
			sanitized[i].Depth = 0
		}

		// Set default type if empty
		if row.Type == "" {
			sanitized[i].Type = "file"
		}
	}

	return sanitized
}
