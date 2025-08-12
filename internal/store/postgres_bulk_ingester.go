package store

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/mantonx/volumeviz/internal/utils"
)

// PostgresBulkIngester implements BulkIngester for PostgreSQL using CopyFrom and staging tables
type PostgresBulkIngester struct {
	pool *pgxpool.Pool
}

// NewPostgresBulkIngester creates a new PostgreSQL bulk ingester
func NewPostgresBulkIngester(pool *pgxpool.Pool) *PostgresBulkIngester {
	return &PostgresBulkIngester{pool: pool}
}

// IngestFiles performs bulk insertion using PostgreSQL CopyFrom with staging tables
func (p *PostgresBulkIngester) IngestFiles(ctx context.Context, volumeID string, rows []FileRow, opts BulkIngestOptions) (*BulkIngestResult, error) {
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

	conn, err := p.pool.Acquire(ctx)
	if err != nil {
		return result, fmt.Errorf("failed to acquire connection: %w", err)
	}
	defer conn.Release()

	// Start transaction for atomic operations
	tx, err := conn.Begin(ctx)
	if err != nil {
		return result, fmt.Errorf("failed to start transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	if opts.UseStaging {
		// Use staging table approach for optimal performance
		suffix := fmt.Sprintf("_%d", time.Now().UnixNano())

		if err := p.createStagingTablesWithTx(ctx, tx, suffix); err != nil {
			return result, fmt.Errorf("failed to create staging tables: %w", err)
		}
		defer p.dropStagingTablesWithTx(ctx, tx, suffix)

		// Insert directories first (must exist before files that reference them)
		if len(dirRows) > 0 {
			processed, err := p.copyFromDirStaging(ctx, tx, dirRows, suffix, opts)
			if err != nil {
				result.Errors = append(result.Errors, fmt.Sprintf("dir staging error: %v", err))
			} else {
				result.ProcessedRows += processed
			}
		}

		// Merge directories from staging to main table
		if len(dirRows) > 0 {
			merged, err := p.mergeDirNodesFromStaging(ctx, tx, suffix, opts.ConflictStrategy)
			if err != nil {
				result.Errors = append(result.Errors, fmt.Sprintf("dir merge error: %v", err))
			} else {
				result.BatchCount++
			}
			_ = merged // Track if needed for metrics
		}

		// Insert file entries
		if len(fileRows) > 0 {
			processed, err := p.copyFromFileStaging(ctx, tx, fileRows, suffix, opts)
			if err != nil {
				result.Errors = append(result.Errors, fmt.Sprintf("file staging error: %v", err))
			} else {
				result.ProcessedRows += processed
			}
		}

		// Merge files from staging to main table
		if len(fileRows) > 0 {
			merged, err := p.mergeFileEntriesFromStaging(ctx, tx, suffix, opts.ConflictStrategy)
			if err != nil {
				result.Errors = append(result.Errors, fmt.Sprintf("file merge error: %v", err))
			} else {
				result.BatchCount++
			}
			_ = merged // Track if needed for metrics
		}

	} else {
		// Direct insertion without staging (less optimal but simpler)
		if len(dirRows) > 0 {
			processed, err := p.copyFromDirDirect(ctx, tx, dirRows, opts)
			if err != nil {
				result.Errors = append(result.Errors, fmt.Sprintf("direct dir insert error: %v", err))
			} else {
				result.ProcessedRows += processed
				result.BatchCount++
			}
		}

		if len(fileRows) > 0 {
			processed, err := p.copyFromFileDirect(ctx, tx, fileRows, opts)
			if err != nil {
				result.Errors = append(result.Errors, fmt.Sprintf("direct file insert error: %v", err))
			} else {
				result.ProcessedRows += processed
				result.BatchCount++
			}
		}
	}

	// Commit transaction
	if err := tx.Commit(ctx); err != nil {
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

// copyFromDirStaging uses COPY FROM to insert directories into staging table
func (p *PostgresBulkIngester) copyFromDirStaging(ctx context.Context, tx pgx.Tx, rows []FileRow, suffix string, opts BulkIngestOptions) (int64, error) {
	tableName := "dir_nodes_staging" + suffix

	// Sort by depth to ensure parents are inserted before children
	p.sortRowsByDepth(rows)

	// Prepare rows for COPY FROM
	copyRows := make([][]interface{}, len(rows))
	for i, row := range rows {
		copyRows[i] = []interface{}{
			row.VolumeID,
			row.ParentDirID,
			row.Name,
			row.FullPath,
			row.Depth,
			row.SizeBytes, // latest_size_bytes
			int64(0),      // latest_file_count (will be calculated later)
			row.CTime,     // created_at
			time.Now(),    // updated_at
		}
	}

	// Use CopyFrom for high-performance bulk insert
	copied, err := tx.CopyFrom(
		ctx,
		pgx.Identifier{tableName},
		[]string{"volume_id", "parent_dir_id", "name", "full_path", "depth", "latest_size_bytes", "latest_file_count", "created_at", "updated_at"},
		pgx.CopyFromRows(copyRows),
	)

	return copied, err
}

// copyFromFileStaging uses COPY FROM to insert files into staging table
func (p *PostgresBulkIngester) copyFromFileStaging(ctx context.Context, tx pgx.Tx, rows []FileRow, suffix string, opts BulkIngestOptions) (int64, error) {
	tableName := "file_entries_staging" + suffix

	// Prepare rows for COPY FROM
	copyRows := make([][]interface{}, len(rows))
	for i, row := range rows {
		copyRows[i] = []interface{}{
			row.VolumeID,
			row.ParentDirID,
			row.Name,
			row.SizeBytes,
			row.MTime,
			row.CTime,
			row.Inode,
			row.UID,
			row.GID,
			row.Type,
			row.Hidden,
			row.PathHash,
			row.CTime,  // created_at
			time.Now(), // updated_at
		}
	}

	// Use CopyFrom for high-performance bulk insert
	copied, err := tx.CopyFrom(
		ctx,
		pgx.Identifier{tableName},
		[]string{"volume_id", "parent_dir_id", "name", "size_bytes", "mtime", "ctime", "inode", "uid", "gid", "type", "hidden", "path_hash", "created_at", "updated_at"},
		pgx.CopyFromRows(copyRows),
	)

	return copied, err
}

// mergeDirNodesFromStaging merges directories from staging table to main table
func (p *PostgresBulkIngester) mergeDirNodesFromStaging(ctx context.Context, tx pgx.Tx, suffix, conflictStrategy string) (int64, error) {
	stagingTable := "dir_nodes_staging" + suffix

	var query string
	if conflictStrategy == "replace" {
		query = fmt.Sprintf(`
			INSERT INTO dir_nodes (volume_id, parent_dir_id, name, full_path, depth, latest_size_bytes, latest_file_count, created_at, updated_at)
			SELECT volume_id, parent_dir_id, name, full_path, depth, latest_size_bytes, latest_file_count, created_at, updated_at
			FROM %s
			ON CONFLICT (volume_id, full_path) 
			DO UPDATE SET 
				latest_size_bytes = EXCLUDED.latest_size_bytes,
				latest_file_count = EXCLUDED.latest_file_count,
				updated_at = EXCLUDED.updated_at
		`, stagingTable)
	} else {
		query = fmt.Sprintf(`
			INSERT INTO dir_nodes (volume_id, parent_dir_id, name, full_path, depth, latest_size_bytes, latest_file_count, created_at, updated_at)
			SELECT volume_id, parent_dir_id, name, full_path, depth, latest_size_bytes, latest_file_count, created_at, updated_at
			FROM %s
			ON CONFLICT (volume_id, full_path) DO NOTHING
		`, stagingTable)
	}

	result, err := tx.Exec(ctx, query)
	if err != nil {
		return 0, err
	}

	return result.RowsAffected(), nil
}

// mergeFileEntriesFromStaging merges files from staging table to main table
func (p *PostgresBulkIngester) mergeFileEntriesFromStaging(ctx context.Context, tx pgx.Tx, suffix, conflictStrategy string) (int64, error) {
	stagingTable := "file_entries_staging" + suffix

	var query string
	if conflictStrategy == "replace" {
		query = fmt.Sprintf(`
			INSERT INTO file_entries (volume_id, parent_dir_id, name, size_bytes, mtime, ctime, inode, uid, gid, type, hidden, path_hash, created_at, updated_at)
			SELECT volume_id, parent_dir_id, name, size_bytes, mtime, ctime, inode, uid, gid, type, hidden, path_hash, created_at, updated_at
			FROM %s
			ON CONFLICT (volume_id, path_hash) 
			DO UPDATE SET 
				size_bytes = EXCLUDED.size_bytes,
				mtime = EXCLUDED.mtime,
				updated_at = EXCLUDED.updated_at
		`, stagingTable)
	} else {
		query = fmt.Sprintf(`
			INSERT INTO file_entries (volume_id, parent_dir_id, name, size_bytes, mtime, ctime, inode, uid, gid, type, hidden, path_hash, created_at, updated_at)
			SELECT volume_id, parent_dir_id, name, size_bytes, mtime, ctime, inode, uid, gid, type, hidden, path_hash, created_at, updated_at
			FROM %s
			ON CONFLICT (volume_id, path_hash) DO NOTHING
		`, stagingTable)
	}

	result, err := tx.Exec(ctx, query)
	if err != nil {
		return 0, err
	}

	return result.RowsAffected(), nil
}

// Direct insertion methods (without staging)

func (p *PostgresBulkIngester) copyFromDirDirect(ctx context.Context, tx pgx.Tx, rows []FileRow, opts BulkIngestOptions) (int64, error) {
	p.sortRowsByDepth(rows)

	copyRows := make([][]interface{}, len(rows))
	for i, row := range rows {
		copyRows[i] = []interface{}{
			row.VolumeID, row.ParentDirID, row.Name, row.FullPath,
			row.Depth, row.SizeBytes, int64(0), row.CTime, time.Now(),
		}
	}

	// Use temporary table approach for ON CONFLICT handling
	tempTable := fmt.Sprintf("temp_dirs_%d", time.Now().UnixNano())

	// Create temporary table
	createTempSQL := fmt.Sprintf(`
		CREATE TEMP TABLE %s (LIKE dir_nodes INCLUDING ALL)
	`, tempTable)

	if _, err := tx.Exec(ctx, createTempSQL); err != nil {
		return 0, fmt.Errorf("failed to create temp table: %w", err)
	}

	// Copy to temp table
	copied, err := tx.CopyFrom(
		ctx,
		pgx.Identifier{tempTable},
		[]string{"volume_id", "parent_dir_id", "name", "full_path", "depth", "latest_size_bytes", "latest_file_count", "created_at", "updated_at"},
		pgx.CopyFromRows(copyRows),
	)
	if err != nil {
		return 0, err
	}

	// Insert from temp to main with conflict resolution
	var insertSQL string
	if opts.ConflictStrategy == "replace" {
		insertSQL = fmt.Sprintf(`
			INSERT INTO dir_nodes SELECT * FROM %s
			ON CONFLICT (volume_id, full_path) 
			DO UPDATE SET 
				latest_size_bytes = EXCLUDED.latest_size_bytes,
				updated_at = EXCLUDED.updated_at
		`, tempTable)
	} else {
		insertSQL = fmt.Sprintf(`
			INSERT INTO dir_nodes SELECT * FROM %s
			ON CONFLICT (volume_id, full_path) DO NOTHING
		`, tempTable)
	}

	if _, err := tx.Exec(ctx, insertSQL); err != nil {
		return 0, err
	}

	return copied, nil
}

func (p *PostgresBulkIngester) copyFromFileDirect(ctx context.Context, tx pgx.Tx, rows []FileRow, opts BulkIngestOptions) (int64, error) {
	copyRows := make([][]interface{}, len(rows))
	for i, row := range rows {
		copyRows[i] = []interface{}{
			row.VolumeID, row.ParentDirID, row.Name, row.SizeBytes,
			row.MTime, row.CTime, row.Inode, row.UID, row.GID,
			row.Type, row.Hidden, row.PathHash, row.CTime, time.Now(),
		}
	}

	tempTable := fmt.Sprintf("temp_files_%d", time.Now().UnixNano())

	createTempSQL := fmt.Sprintf(`
		CREATE TEMP TABLE %s (LIKE file_entries INCLUDING ALL)
	`, tempTable)

	if _, err := tx.Exec(ctx, createTempSQL); err != nil {
		return 0, fmt.Errorf("failed to create temp table: %w", err)
	}

	copied, err := tx.CopyFrom(
		ctx,
		pgx.Identifier{tempTable},
		[]string{"volume_id", "parent_dir_id", "name", "size_bytes", "mtime", "ctime", "inode", "uid", "gid", "type", "hidden", "path_hash", "created_at", "updated_at"},
		pgx.CopyFromRows(copyRows),
	)
	if err != nil {
		return 0, err
	}

	var insertSQL string
	if opts.ConflictStrategy == "replace" {
		insertSQL = fmt.Sprintf(`
			INSERT INTO file_entries SELECT * FROM %s
			ON CONFLICT (volume_id, path_hash) 
			DO UPDATE SET 
				size_bytes = EXCLUDED.size_bytes,
				mtime = EXCLUDED.mtime,
				updated_at = EXCLUDED.updated_at
		`, tempTable)
	} else {
		insertSQL = fmt.Sprintf(`
			INSERT INTO file_entries SELECT * FROM %s
			ON CONFLICT (volume_id, path_hash) DO NOTHING
		`, tempTable)
	}

	if _, err := tx.Exec(ctx, insertSQL); err != nil {
		return 0, err
	}

	return copied, nil
}

// IngestDirectoryRollups performs bulk insertion of directory rollup statistics
func (p *PostgresBulkIngester) IngestDirectoryRollups(ctx context.Context, rollups []DirRollupRow, opts BulkIngestOptions) (*BulkIngestResult, error) {
	start := time.Now()
	result := &BulkIngestResult{
		TotalRows: int64(len(rollups)),
	}

	if len(rollups) == 0 {
		result.Duration = time.Since(start)
		return result, nil
	}

	conn, err := p.pool.Acquire(ctx)
	if err != nil {
		return result, fmt.Errorf("failed to acquire connection: %w", err)
	}
	defer conn.Release()

	copyRows := make([][]interface{}, len(rollups))
	for i, rollup := range rollups {
		copyRows[i] = []interface{}{
			rollup.DirID,
			rollup.SizeBytes,
			rollup.FileCount,
			rollup.ComputedAt,
			time.Now(), // created_at
		}
	}

	copied, err := conn.CopyFrom(
		ctx,
		pgx.Identifier{"dir_rollups"},
		[]string{"dir_id", "size_bytes", "file_count", "computed_at", "created_at"},
		pgx.CopyFromRows(copyRows),
	)

	if err != nil {
		result.Errors = append(result.Errors, err.Error())
	} else {
		result.ProcessedRows = copied
		result.BatchCount = 1
	}

	result.Duration = time.Since(start)
	if result.Duration > 0 {
		result.RowsPerSecond = float64(result.ProcessedRows) / result.Duration.Seconds()
	}

	return result, nil
}

// Staging table management

func (p *PostgresBulkIngester) CreateStagingTables(ctx context.Context, suffix string) error {
	conn, err := p.pool.Acquire(ctx)
	if err != nil {
		return err
	}
	defer conn.Release()

	tx, err := conn.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	if err := p.createStagingTablesWithTx(ctx, tx, suffix); err != nil {
		return err
	}

	return tx.Commit(ctx)
}

func (p *PostgresBulkIngester) createStagingTablesWithTx(ctx context.Context, tx pgx.Tx, suffix string) error {
	// Create file_entries staging table
	filesStagingSQL := fmt.Sprintf(`
		CREATE TEMP TABLE file_entries_staging%s (
			volume_id VARCHAR(255) NOT NULL,
			parent_dir_id BIGINT,
			name VARCHAR(512) NOT NULL,
			size_bytes BIGINT NOT NULL DEFAULT 0,
			mtime TIMESTAMP WITH TIME ZONE NOT NULL,
			ctime TIMESTAMP WITH TIME ZONE NOT NULL,
			inode BIGINT,
			uid INTEGER,
			gid INTEGER,
			type VARCHAR(10) NOT NULL,
			hidden BOOLEAN NOT NULL DEFAULT FALSE,
			path_hash BYTEA NOT NULL,
			created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
			updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
		)
	`, suffix)

	if _, err := tx.Exec(ctx, filesStagingSQL); err != nil {
		return fmt.Errorf("failed to create files staging table: %w", err)
	}

	// Create dir_nodes staging table
	dirsStagingSQL := fmt.Sprintf(`
		CREATE TEMP TABLE dir_nodes_staging%s (
			volume_id VARCHAR(255) NOT NULL,
			parent_dir_id BIGINT,
			name VARCHAR(512) NOT NULL,
			full_path VARCHAR(4096) NOT NULL,
			depth INTEGER NOT NULL DEFAULT 0,
			latest_size_bytes BIGINT NOT NULL DEFAULT 0,
			latest_file_count BIGINT NOT NULL DEFAULT 0,
			created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
			updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
		)
	`, suffix)

	if _, err := tx.Exec(ctx, dirsStagingSQL); err != nil {
		return fmt.Errorf("failed to create dirs staging table: %w", err)
	}

	return nil
}

func (p *PostgresBulkIngester) DropStagingTables(ctx context.Context, suffix string) error {
	conn, err := p.pool.Acquire(ctx)
	if err != nil {
		return err
	}
	defer conn.Release()

	tx, err := conn.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	if err := p.dropStagingTablesWithTx(ctx, tx, suffix); err != nil {
		return err
	}

	return tx.Commit(ctx)
}

func (p *PostgresBulkIngester) dropStagingTablesWithTx(ctx context.Context, tx pgx.Tx, suffix string) error {
	tables := []string{
		"file_entries_staging" + suffix,
		"dir_nodes_staging" + suffix,
	}

	for _, table := range tables {
		dropSQL := fmt.Sprintf("DROP TABLE IF EXISTS %s", table)
		if _, err := tx.Exec(ctx, dropSQL); err != nil {
			return fmt.Errorf("failed to drop staging table %s: %w", table, err)
		}
	}

	return nil
}

// Utility methods

func (p *PostgresBulkIngester) GetOptimalBatchSize() int {
	return 25000 // Optimal for PostgreSQL CopyFrom
}

func (p *PostgresBulkIngester) SupportsStaging() bool {
	return true
}

// sortRowsByDepth sorts FileRow slice by depth to ensure proper parent-child insertion order
func (p *PostgresBulkIngester) sortRowsByDepth(rows []FileRow) {
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
