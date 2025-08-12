package store

import (
	"context"
	"database/sql"
	"fmt"
	"strings"
	"time"

	"github.com/mantonx/volumeviz/internal/utils"
)

// SQLiteBulkIngester implements BulkIngester for SQLite using prepared statements and adaptive batching
type SQLiteBulkIngester struct {
	db *sql.DB
	// Adaptive batch sizing metrics
	lastBatchDuration time.Duration
	currentBatchSize  int
	minBatchSize      int
	maxBatchSize      int
}

// NewSQLiteBulkIngester creates a new SQLite bulk ingester with adaptive batch sizing
func NewSQLiteBulkIngester(db *sql.DB) *SQLiteBulkIngester {
	return &SQLiteBulkIngester{
		db:               db,
		currentBatchSize: 80,  // Start with SQLite-safe batch size
		minBatchSize:     20,  // Conservative minimum
		maxBatchSize:     100, // Safe maximum for directories
	}
}

// calculateSafeBatchSize calculates the maximum safe batch size for SQLite's parameter limit
func (s *SQLiteBulkIngester) calculateSafeBatchSize(paramsPerRow int, requestedBatchSize int) int {
	const sqliteMaxParams = 999
	maxRowsForParams := sqliteMaxParams / paramsPerRow

	// Use the smaller of requested size or parameter limit
	safeBatchSize := requestedBatchSize
	if maxRowsForParams < requestedBatchSize {
		safeBatchSize = maxRowsForParams
	}

	// Ensure minimum batch size
	if safeBatchSize < s.minBatchSize {
		safeBatchSize = s.minBatchSize
	}

	return safeBatchSize
}

// IngestFiles performs bulk insertion using SQLite prepared statements with adaptive batching
func (s *SQLiteBulkIngester) IngestFiles(ctx context.Context, volumeID string, rows []FileRow, opts BulkIngestOptions) (*BulkIngestResult, error) {
	start := time.Now()
	result := &BulkIngestResult{
		TotalRows: int64(len(rows)),
	}

	if len(rows) == 0 {
		result.Duration = time.Since(start)
		return result, nil
	}

	// Calculate path hashes if needed
	if !opts.SkipHashCalculation {
		for i := range rows {
			if len(rows[i].PathHash) == 0 {
				rows[i].PathHash = utils.HashPathDefault(rows[i].VolumeID, rows[i].FullPath)
			}
		}
	}

	// Separate files from directories
	var fileRows []FileRow
	var dirRows []FileRow

	for _, row := range rows {
		if row.Type == "dir" {
			dirRows = append(dirRows, row)
		} else {
			fileRows = append(fileRows, row)
		}
	}

	result.DirEntries = int64(len(dirRows))
	result.FileEntries = int64(len(fileRows))

	// Apply SQLite optimizations before transaction
	if err := s.setSQLiteOptimizations(ctx, s.db); err != nil {
		result.Errors = append(result.Errors, fmt.Sprintf("optimization error: %v", err))
	}

	// Start transaction for atomic operations
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return result, fmt.Errorf("failed to start transaction: %w", err)
	}
	defer tx.Rollback()

	// Insert directories first (must exist before files that reference them)
	if len(dirRows) > 0 {
		processed, batchCount, err := s.insertDirectoriesAdaptive(ctx, tx, dirRows, opts)
		if err != nil {
			result.Errors = append(result.Errors, fmt.Sprintf("dir insert error: %v", err))
		} else {
			result.ProcessedRows += processed
			result.BatchCount += batchCount
		}
	}

	// Insert file entries
	if len(fileRows) > 0 {
		processed, batchCount, err := s.insertFilesAdaptive(ctx, tx, fileRows, opts)
		if err != nil {
			result.Errors = append(result.Errors, fmt.Sprintf("file insert error: %v", err))
		} else {
			result.ProcessedRows += processed
			result.BatchCount += batchCount
		}
	}

	// Commit transaction
	if err := tx.Commit(); err != nil {
		return result, fmt.Errorf("failed to commit transaction: %w", err)
	}

	result.Duration = time.Since(start)
	if result.Duration > 0 {
		result.RowsPerSecond = float64(result.ProcessedRows) / result.Duration.Seconds()
	}
	if result.BatchCount > 0 {
		result.AvgBatchSize = float64(result.ProcessedRows) / float64(result.BatchCount)
	}

	return result, nil
}

// insertDirectoriesAdaptive inserts directories using adaptive batch sizing
func (s *SQLiteBulkIngester) insertDirectoriesAdaptive(ctx context.Context, tx *sql.Tx, rows []FileRow, opts BulkIngestOptions) (int64, int, error) {
	// Sort by depth to ensure parents are inserted before children
	s.sortRowsByDepth(rows)

	var totalProcessed int64
	var batchCount int

	// Determine starting batch size
	batchSize := opts.BatchSize
	if opts.Adaptive && s.currentBatchSize > 0 {
		batchSize = s.currentBatchSize
	}
	if batchSize <= 0 {
		batchSize = 80
	}

	// Apply SQLite parameter safety limit for directories (9 params per row)
	const dirParamsPerRow = 9
	batchSize = s.calculateSafeBatchSize(dirParamsPerRow, batchSize)

	// Process in adaptive batches
	for i := 0; i < len(rows); {
		end := i + batchSize
		if end > len(rows) {
			end = len(rows)
		}

		batch := rows[i:end]
		batchStart := time.Now()

		processed, err := s.insertDirectoryBatch(ctx, tx, batch, opts.ConflictStrategy)
		batchDuration := time.Since(batchStart)

		if err != nil {
			return totalProcessed, batchCount, fmt.Errorf("batch %d-%d failed: %w", i, end, err)
		}

		totalProcessed += processed
		batchCount++

		// Adaptive batch sizing logic for SQLite
		if opts.Adaptive {
			batchSize = s.adjustBatchSize(batchSize, batchDuration, len(batch))
		}

		i = end

		// Check for context cancellation
		if ctx.Err() != nil {
			return totalProcessed, batchCount, ctx.Err()
		}

		// Optional: yield to other goroutines for very large datasets
		if batchCount%10 == 0 {
			time.Sleep(1 * time.Millisecond)
		}
	}

	return totalProcessed, batchCount, nil
}

// insertFilesAdaptive inserts files using adaptive batch sizing
func (s *SQLiteBulkIngester) insertFilesAdaptive(ctx context.Context, tx *sql.Tx, rows []FileRow, opts BulkIngestOptions) (int64, int, error) {
	var totalProcessed int64
	var batchCount int

	batchSize := opts.BatchSize
	if opts.Adaptive && s.currentBatchSize > 0 {
		batchSize = s.currentBatchSize
	}
	if batchSize <= 0 {
		batchSize = 60
	}

	// Apply SQLite parameter safety limit for files (14 params per row)
	const fileParamsPerRow = 14
	batchSize = s.calculateSafeBatchSize(fileParamsPerRow, batchSize)

	for i := 0; i < len(rows); {
		end := i + batchSize
		if end > len(rows) {
			end = len(rows)
		}

		batch := rows[i:end]
		batchStart := time.Now()

		processed, err := s.insertFileBatch(ctx, tx, batch, opts.ConflictStrategy)
		batchDuration := time.Since(batchStart)

		if err != nil {
			return totalProcessed, batchCount, fmt.Errorf("batch %d-%d failed: %w", i, end, err)
		}

		totalProcessed += processed
		batchCount++

		if opts.Adaptive {
			batchSize = s.adjustBatchSize(batchSize, batchDuration, len(batch))
		}

		i = end

		if ctx.Err() != nil {
			return totalProcessed, batchCount, ctx.Err()
		}

		if batchCount%10 == 0 {
			time.Sleep(1 * time.Millisecond)
		}
	}

	return totalProcessed, batchCount, nil
}

// insertDirectoryBatch inserts a batch of directories using prepared statements
func (s *SQLiteBulkIngester) insertDirectoryBatch(ctx context.Context, tx *sql.Tx, batch []FileRow, conflictStrategy string) (int64, error) {
	if len(batch) == 0 {
		return 0, nil
	}

	// Build multi-value INSERT statement
	var conflictClause string
	if conflictStrategy == "replace" {
		conflictClause = "ON CONFLICT(volume_id, full_path) DO UPDATE SET latest_size_bytes=excluded.latest_size_bytes, updated_at=excluded.updated_at"
	} else {
		conflictClause = "ON CONFLICT(volume_id, full_path) DO NOTHING"
	}

	// Create parameterized query with multiple value sets
	valuePlaceholders := make([]string, len(batch))
	args := make([]interface{}, 0, len(batch)*9) // 9 columns per row

	for i, row := range batch {
		valuePlaceholders[i] = "(?, ?, ?, ?, ?, ?, ?, ?, ?)"

		// Convert nullable uint64 to interface{}
		var parentDirID interface{}
		if row.ParentDirID != nil {
			parentDirID = int64(*row.ParentDirID)
		}

		args = append(args,
			row.VolumeID,
			parentDirID,
			row.Name,
			row.FullPath,
			row.Depth,
			row.SizeBytes, // latest_size_bytes
			0,             // latest_file_count
			row.CTime.Format(time.RFC3339),
			time.Now().Format(time.RFC3339),
		)
	}

	query := fmt.Sprintf(`
		INSERT INTO dir_nodes (volume_id, parent_dir_id, name, full_path, depth, latest_size_bytes, latest_file_count, created_at, updated_at)
		VALUES %s
		%s
	`, strings.Join(valuePlaceholders, ", "), conflictClause)

	result, err := tx.ExecContext(ctx, query, args...)
	if err != nil {
		return 0, fmt.Errorf("failed to execute directory batch insert: %w", err)
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return 0, fmt.Errorf("failed to get rows affected: %w", err)
	}

	return rowsAffected, nil
}

// insertFileBatch inserts a batch of files using prepared statements
func (s *SQLiteBulkIngester) insertFileBatch(ctx context.Context, tx *sql.Tx, batch []FileRow, conflictStrategy string) (int64, error) {
	if len(batch) == 0 {
		return 0, nil
	}

	var conflictClause string
	if conflictStrategy == "replace" {
		conflictClause = "ON CONFLICT(volume_id, path_hash) DO UPDATE SET size_bytes=excluded.size_bytes, mtime=excluded.mtime, updated_at=excluded.updated_at"
	} else {
		conflictClause = "ON CONFLICT(volume_id, path_hash) DO NOTHING"
	}

	valuePlaceholders := make([]string, len(batch))
	args := make([]interface{}, 0, len(batch)*14) // 14 columns per row

	for i, row := range batch {
		valuePlaceholders[i] = "(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"

		var parentDirID, inode, uid, gid interface{}
		if row.ParentDirID != nil {
			parentDirID = int64(*row.ParentDirID)
		}
		if row.Inode != nil {
			inode = int64(*row.Inode)
		}
		if row.UID != nil {
			uid = int64(*row.UID)
		}
		if row.GID != nil {
			gid = int64(*row.GID)
		}

		hidden := 0
		if row.Hidden {
			hidden = 1
		}

		args = append(args,
			row.VolumeID,
			parentDirID,
			row.Name,
			row.SizeBytes,
			row.MTime.Format(time.RFC3339),
			row.CTime.Format(time.RFC3339),
			inode,
			uid,
			gid,
			row.Type,
			hidden,
			row.PathHash,
			row.CTime.Format(time.RFC3339),
			time.Now().Format(time.RFC3339),
		)
	}

	query := fmt.Sprintf(`
		INSERT INTO file_entries (volume_id, parent_dir_id, name, size_bytes, mtime, ctime, inode, uid, gid, type, hidden, path_hash, created_at, updated_at)
		VALUES %s
		%s
	`, strings.Join(valuePlaceholders, ", "), conflictClause)

	result, err := tx.ExecContext(ctx, query, args...)
	if err != nil {
		return 0, fmt.Errorf("failed to execute file batch insert: %w", err)
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return 0, fmt.Errorf("failed to get rows affected: %w", err)
	}

	return rowsAffected, nil
}

// IngestDirectoryRollups performs bulk insertion of directory rollup statistics
func (s *SQLiteBulkIngester) IngestDirectoryRollups(ctx context.Context, rollups []DirRollupRow, opts BulkIngestOptions) (*BulkIngestResult, error) {
	start := time.Now()
	result := &BulkIngestResult{
		TotalRows: int64(len(rollups)),
	}

	if len(rollups) == 0 {
		result.Duration = time.Since(start)
		return result, nil
	}

	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return result, fmt.Errorf("failed to start transaction: %w", err)
	}
	defer tx.Rollback()

	// Process rollups in batches
	batchSize := opts.BatchSize
	if batchSize <= 0 {
		batchSize = 2000
	}

	var totalProcessed int64
	var batchCount int

	for i := 0; i < len(rollups); i += batchSize {
		end := i + batchSize
		if end > len(rollups) {
			end = len(rollups)
		}

		batch := rollups[i:end]
		processed, err := s.insertRollupBatch(ctx, tx, batch)
		if err != nil {
			result.Errors = append(result.Errors, fmt.Sprintf("rollup batch %d-%d failed: %v", i, end, err))
			continue
		}

		totalProcessed += processed
		batchCount++

		if ctx.Err() != nil {
			return result, ctx.Err()
		}
	}

	if err := tx.Commit(); err != nil {
		return result, fmt.Errorf("failed to commit transaction: %w", err)
	}

	result.ProcessedRows = totalProcessed
	result.BatchCount = batchCount
	result.Duration = time.Since(start)

	if result.Duration > 0 {
		result.RowsPerSecond = float64(result.ProcessedRows) / result.Duration.Seconds()
	}
	if result.BatchCount > 0 {
		result.AvgBatchSize = float64(result.ProcessedRows) / float64(result.BatchCount)
	}

	return result, nil
}

// insertRollupBatch inserts a batch of directory rollups
func (s *SQLiteBulkIngester) insertRollupBatch(ctx context.Context, tx *sql.Tx, batch []DirRollupRow) (int64, error) {
	if len(batch) == 0 {
		return 0, nil
	}

	valuePlaceholders := make([]string, len(batch))
	args := make([]interface{}, 0, len(batch)*5) // 5 columns per row

	for i, rollup := range batch {
		valuePlaceholders[i] = "(?, ?, ?, ?, ?)"
		args = append(args,
			rollup.DirID,
			rollup.SizeBytes,
			rollup.FileCount,
			rollup.ComputedAt.Format(time.RFC3339),
			time.Now().Format(time.RFC3339),
		)
	}

	query := fmt.Sprintf(`
		INSERT INTO dir_rollups (dir_id, size_bytes, file_count, computed_at, created_at)
		VALUES %s
	`, strings.Join(valuePlaceholders, ", "))

	result, err := tx.ExecContext(ctx, query, args...)
	if err != nil {
		return 0, fmt.Errorf("failed to execute rollup batch insert: %w", err)
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return 0, fmt.Errorf("failed to get rows affected: %w", err)
	}

	return rowsAffected, nil
}

// setSQLiteOptimizations applies SQLite-specific performance optimizations
func (s *SQLiteBulkIngester) setSQLiteOptimizations(ctx context.Context, db *sql.DB) error {
	optimizations := []string{
		"PRAGMA synchronous = OFF",     // Faster writes, less durability
		"PRAGMA journal_mode = MEMORY", // Keep journal in memory
		"PRAGMA temp_store = MEMORY",   // Store temp data in memory
		"PRAGMA cache_size = -64000",   // 64MB cache
		"PRAGMA foreign_keys = OFF",    // Disable FK checks during bulk insert
	}

	for _, pragma := range optimizations {
		if _, err := db.ExecContext(ctx, pragma); err != nil {
			return fmt.Errorf("failed to set pragma %s: %w", pragma, err)
		}
	}

	return nil
}

// adjustBatchSize implements adaptive batch sizing based on performance feedback
func (s *SQLiteBulkIngester) adjustBatchSize(currentSize int, duration time.Duration, actualRows int) int {
	// Target: ~100-200ms per batch for optimal balance of throughput and responsiveness
	targetDuration := 150 * time.Millisecond

	s.lastBatchDuration = duration

	// If batch took too long, decrease size
	if duration > targetDuration*2 {
		newSize := int(float64(currentSize) * 0.7) // Reduce by 30%
		if newSize < s.minBatchSize {
			newSize = s.minBatchSize
		}
		s.currentBatchSize = newSize
		return newSize
	}

	// If batch was very fast, increase size
	if duration < targetDuration/2 {
		newSize := int(float64(currentSize) * 1.3) // Increase by 30%
		if newSize > s.maxBatchSize {
			newSize = s.maxBatchSize
		}
		s.currentBatchSize = newSize
		return newSize
	}

	// Batch timing was reasonable, make small adjustments
	if duration < targetDuration {
		newSize := currentSize + 200 // Small increase
		if newSize > s.maxBatchSize {
			newSize = s.maxBatchSize
		}
		s.currentBatchSize = newSize
		return newSize
	} else {
		newSize := currentSize - 200 // Small decrease
		if newSize < s.minBatchSize {
			newSize = s.minBatchSize
		}
		s.currentBatchSize = newSize
		return newSize
	}
}

// Staging table operations (not supported in SQLite)

func (s *SQLiteBulkIngester) CreateStagingTables(ctx context.Context, suffix string) error {
	return fmt.Errorf("staging tables not supported in SQLite")
}

func (s *SQLiteBulkIngester) DropStagingTables(ctx context.Context, suffix string) error {
	return fmt.Errorf("staging tables not supported in SQLite")
}

// Utility methods

func (s *SQLiteBulkIngester) GetOptimalBatchSize() int {
	return 70 // Safe for both files (70 * 14 = 980 params) and directories (70 * 9 = 630 params)
}

func (s *SQLiteBulkIngester) SupportsStaging() bool {
	return false
}

// sortRowsByDepth sorts FileRow slice by depth to ensure proper parent-child insertion order
func (s *SQLiteBulkIngester) sortRowsByDepth(rows []FileRow) {
	// Simple insertion sort by depth (efficient for pre-sorted or small datasets)
	for i := 1; i < len(rows); i++ {
		key := rows[i]
		j := i - 1
		for j >= 0 && rows[j].Depth > key.Depth {
			rows[j+1] = rows[j]
			j--
		}
		rows[j+1] = key
	}
}
