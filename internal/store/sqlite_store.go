package store

import (
	"context"
	"database/sql"
	"fmt"
	"strings"
	"time"

	"github.com/mantonx/volumeviz/internal/store/config"
	sqlite "github.com/mantonx/volumeviz/internal/store/generated/sqlite"
	_ "modernc.org/sqlite"
)

// SQLite datetime formats
const (
	sqliteTimeFormat = "2006-01-02 15:04:05"
)

// parseSQLiteTime parses SQLite's datetime format into time.Time
// It handles both SQLite's native format and RFC3339
func parseSQLiteTime(timeStr string) (time.Time, error) {
	if timeStr == "" {
		return time.Time{}, nil
	}

	// Try RFC3339 first (what we insert from Go)
	if t, err := time.Parse(time.RFC3339, timeStr); err == nil {
		return t, nil
	}

	// Try SQLite's datetime format
	if t, err := time.Parse(sqliteTimeFormat, timeStr); err == nil {
		return t, nil
	}

	// Try RFC3339Nano as fallback
	if t, err := time.Parse(time.RFC3339Nano, timeStr); err == nil {
		return t, nil
	}

	return time.Time{}, fmt.Errorf("unable to parse time '%s' in any known format", timeStr)
}

// SQLiteStore implements Store interface using SQLite with sqlc
type SQLiteStore struct {
	db      *sql.DB
	queries *sqlite.Queries
	facade  *StoreFacade
}

// NewSQLiteStore creates a new SQLite store with optimized settings
func NewSQLiteStore(cfg *config.Config) (*SQLiteStore, error) {
	// Use SQLite DSN with performance optimizations
	db, err := sql.Open("sqlite", cfg.DSN())
	if err != nil {
		return nil, fmt.Errorf("failed to open SQLite database: %w", err)
	}

	// Apply SQLite-specific settings
	pragmas := []string{
		"PRAGMA journal_mode=WAL",
		"PRAGMA synchronous=NORMAL",
		"PRAGMA cache_size=-64000", // 64MB cache
		"PRAGMA temp_store=memory",
		"PRAGMA mmap_size=268435456", // 256MB mmap
		"PRAGMA page_size=4096",
		"PRAGMA foreign_keys=ON",
		fmt.Sprintf("PRAGMA busy_timeout=%d", int(cfg.Timeout.Milliseconds())),
	}

	for _, pragma := range pragmas {
		if _, err := db.Exec(pragma); err != nil {
			// Log warning but don't fail for unsupported pragmas
			fmt.Printf("Warning: Failed to apply SQLite optimization '%s': %v\n", pragma, err)
		}
	}

	// Test connection
	if err := db.Ping(); err != nil {
		db.Close()
		return nil, fmt.Errorf("failed to ping database: %w", err)
	}

	store := &SQLiteStore{
		db:      db,
		queries: sqlite.New(db),
	}
	
	// Create facade
	store.facade = NewStoreFacade(config.DatabaseTypeSQLite, nil, db)
	
	return store, nil
}

// Close closes the database connection
func (s *SQLiteStore) Close() error {
	return s.db.Close()
}

// Health checks database connectivity
func (s *SQLiteStore) Health(ctx context.Context) error {
	return s.db.PingContext(ctx)
}

// File Entry Operations

func (s *SQLiteStore) CreateFileEntry(ctx context.Context, entry *FileEntry) (*FileEntry, error) {
	dbEntry, err := s.queries.CreateFileEntry(ctx, sqlite.CreateFileEntryParams{
		VolumeID:    entry.VolumeID,
		ParentDirID: toSQLiteInt64(entry.ParentDirID),
		Name:        entry.Name,
		SizeBytes:   entry.SizeBytes,
		Mtime:       entry.Mtime.Format(time.RFC3339),
		Ctime:       entry.Ctime.Format(time.RFC3339),
		Inode:       toSQLiteInt64(entry.Inode),
		Uid:         toSQLiteInt64(int64ToPtr(entry.UID)),
		Gid:         toSQLiteInt64(int64ToPtr(entry.GID)),
		Type:        entry.Type,
		Hidden:      boolToSQLiteInt(entry.Hidden),
		PathHash:    entry.PathHash,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to create file entry: %w", err)
	}
	return fromSQLiteFileEntry(dbEntry)
}

func (s *SQLiteStore) GetFileEntry(ctx context.Context, id int64, volumeID string) (*FileEntry, error) {
	dbEntry, err := s.queries.GetFileEntry(ctx, sqlite.GetFileEntryParams{
		ID:       id,
		VolumeID: volumeID,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to get file entry: %w", err)
	}
	return fromSQLiteFileEntry(dbEntry)
}

func (s *SQLiteStore) GetFileEntriesByVolumeAndParent(ctx context.Context, volumeID string, parentDirID *int64) ([]*FileEntry, error) {
	dbEntries, err := s.queries.GetFileEntriesByVolumeAndParent(ctx, sqlite.GetFileEntriesByVolumeAndParentParams{
		VolumeID:    volumeID,
		ParentDirID: toSQLiteInt64(parentDirID),
	})
	if err != nil {
		return nil, fmt.Errorf("failed to get file entries: %w", err)
	}

	entries := make([]*FileEntry, len(dbEntries))
	for i, dbEntry := range dbEntries {
		entry, err := fromSQLiteFileEntry(dbEntry)
		if err != nil {
			return nil, err
		}
		entries[i] = entry
	}
	return entries, nil
}

func (s *SQLiteStore) GetLargestFiles(ctx context.Context, volumeID string, limit int32) ([]*FileEntry, error) {
	dbEntries, err := s.queries.GetLargestFiles(ctx, sqlite.GetLargestFilesParams{
		VolumeID: volumeID,
		Limit:    int64(limit),
	})
	if err != nil {
		return nil, fmt.Errorf("failed to get largest files: %w", err)
	}

	entries := make([]*FileEntry, len(dbEntries))
	for i, dbEntry := range dbEntries {
		entry, err := fromSQLiteFileEntry(dbEntry)
		if err != nil {
			return nil, err
		}
		entries[i] = entry
	}
	return entries, nil
}

func (s *SQLiteStore) FindFilesByPathHash(ctx context.Context, volumeID string, pathHash []byte) ([]*FileEntry, error) {
	dbEntries, err := s.queries.FindFilesByPathHash(ctx, sqlite.FindFilesByPathHashParams{
		VolumeID: volumeID,
		PathHash: pathHash,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to find files by path hash: %w", err)
	}

	entries := make([]*FileEntry, len(dbEntries))
	for i, dbEntry := range dbEntries {
		entry, err := fromSQLiteFileEntry(dbEntry)
		if err != nil {
			return nil, err
		}
		entries[i] = entry
	}
	return entries, nil
}

func (s *SQLiteStore) UpsertFileEntry(ctx context.Context, entry *FileEntry) (*FileEntry, error) {
	dbEntry, err := s.queries.UpsertFileEntry(ctx, sqlite.UpsertFileEntryParams{
		VolumeID:    entry.VolumeID,
		ParentDirID: toSQLiteInt64(entry.ParentDirID),
		Name:        entry.Name,
		SizeBytes:   entry.SizeBytes,
		Mtime:       entry.Mtime.Format(time.RFC3339),
		Ctime:       entry.Ctime.Format(time.RFC3339),
		Inode:       toSQLiteInt64(entry.Inode),
		Uid:         toSQLiteInt64(int64ToPtr(entry.UID)),
		Gid:         toSQLiteInt64(int64ToPtr(entry.GID)),
		Type:        entry.Type,
		Hidden:      boolToSQLiteInt(entry.Hidden),
		PathHash:    entry.PathHash,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to upsert file entry: %w", err)
	}
	return fromSQLiteFileEntry(dbEntry)
}

func (s *SQLiteStore) DeleteFileEntriesByVolume(ctx context.Context, volumeID string) error {
	err := s.queries.DeleteFileEntriesByVolume(ctx, volumeID)
	if err != nil {
		return fmt.Errorf("failed to delete file entries by volume: %w", err)
	}
	return nil
}

func (s *SQLiteStore) CountFileEntriesByVolume(ctx context.Context, volumeID string) (int64, error) {
	count, err := s.queries.CountFileEntriesByVolume(ctx, volumeID)
	if err != nil {
		return 0, fmt.Errorf("failed to count file entries by volume: %w", err)
	}
	return count, nil
}

func (s *SQLiteStore) GetVolumeFileStats(ctx context.Context, volumeID string) (*VolumeFileStats, error) {
	stats, err := s.queries.GetVolumeFileStats(ctx, volumeID)
	if err != nil {
		return nil, fmt.Errorf("failed to get volume file stats: %w", err)
	}

	// Handle interface{} type from COALESCE SQL function
	totalSize := int64(0)
	if stats.TotalSize != nil {
		if val, ok := stats.TotalSize.(int64); ok {
			totalSize = val
		}
	}

	return &VolumeFileStats{
		TotalFiles:   stats.TotalFiles,
		TotalSize:    totalSize,
		RegularFiles: stats.RegularFiles,
		Directories:  stats.Directories,
		HiddenFiles:  stats.HiddenFiles,
	}, nil
}

// Directory Node Operations

func (s *SQLiteStore) CreateDirNode(ctx context.Context, node *DirNode) (*DirNode, error) {
	dbNode, err := s.queries.CreateDirNode(ctx, sqlite.CreateDirNodeParams{
		VolumeID:        node.VolumeID,
		ParentDirID:     toSQLiteInt64(node.ParentDirID),
		Name:            node.Name,
		FullPath:        node.FullPath,
		Depth:           int64(node.Depth),
		LatestSizeBytes: node.LatestSizeBytes,
		LatestFileCount: node.LatestFileCount,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to create dir node: %w", err)
	}
	return fromSQLiteDirNode(dbNode), nil
}

func (s *SQLiteStore) GetDirNode(ctx context.Context, id int64, volumeID string) (*DirNode, error) {
	dbNode, err := s.queries.GetDirNode(ctx, sqlite.GetDirNodeParams{
		ID:       id,
		VolumeID: volumeID,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to get dir node: %w", err)
	}
	return fromSQLiteDirNode(dbNode), nil
}

func (s *SQLiteStore) GetDirNodeByPath(ctx context.Context, volumeID string, fullPath string) (*DirNode, error) {
	dbNode, err := s.queries.GetDirNodeByPath(ctx, sqlite.GetDirNodeByPathParams{
		VolumeID: volumeID,
		FullPath: fullPath,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to get dir node by path: %w", err)
	}
	return fromSQLiteDirNode(dbNode), nil
}

func (s *SQLiteStore) GetChildDirNodes(ctx context.Context, volumeID string, parentDirID *int64) ([]*DirNode, error) {
	dbNodes, err := s.queries.GetChildDirNodes(ctx, sqlite.GetChildDirNodesParams{
		VolumeID:    volumeID,
		ParentDirID: toSQLiteInt64(parentDirID),
	})
	if err != nil {
		return nil, fmt.Errorf("failed to get child dir nodes: %w", err)
	}

	nodes := make([]*DirNode, len(dbNodes))
	for i, dbNode := range dbNodes {
		nodes[i] = fromSQLiteDirNode(dbNode)
	}
	return nodes, nil
}

func (s *SQLiteStore) GetRootDirNodes(ctx context.Context, volumeID string) ([]*DirNode, error) {
	dbNodes, err := s.queries.GetRootDirNodes(ctx, volumeID)
	if err != nil {
		return nil, fmt.Errorf("failed to get root dir nodes: %w", err)
	}

	nodes := make([]*DirNode, len(dbNodes))
	for i, dbNode := range dbNodes {
		nodes[i] = fromSQLiteDirNode(dbNode)
	}
	return nodes, nil
}

func (s *SQLiteStore) GetLargestDirectories(ctx context.Context, volumeID string, limit int32) ([]*DirNode, error) {
	dbNodes, err := s.queries.GetLargestDirectories(ctx, sqlite.GetLargestDirectoriesParams{
		VolumeID: volumeID,
		Limit:    int64(limit),
	})
	if err != nil {
		return nil, fmt.Errorf("failed to get largest directories: %w", err)
	}

	nodes := make([]*DirNode, len(dbNodes))
	for i, dbNode := range dbNodes {
		nodes[i] = fromSQLiteDirNode(dbNode)
	}
	return nodes, nil
}

func (s *SQLiteStore) GetDirectoryTree(ctx context.Context, volumeID string, maxDepth int32) ([]*DirNode, error) {
	dbNodes, err := s.queries.GetDirectoryTree(ctx, sqlite.GetDirectoryTreeParams{
		VolumeID: volumeID,
		MaxDepth: int64(maxDepth),
	})
	if err != nil {
		return nil, fmt.Errorf("failed to get directory tree: %w", err)
	}

	nodes := make([]*DirNode, len(dbNodes))
	for i, dbNode := range dbNodes {
		nodes[i] = fromSQLiteGetDirectoryTreeRow(dbNode)
	}
	return nodes, nil
}

func (s *SQLiteStore) UpsertDirNode(ctx context.Context, node *DirNode) (*DirNode, error) {
	dbNode, err := s.queries.UpsertDirNode(ctx, sqlite.UpsertDirNodeParams{
		VolumeID:        node.VolumeID,
		ParentDirID:     toSQLiteInt64(node.ParentDirID),
		Name:            node.Name,
		FullPath:        node.FullPath,
		Depth:           int64(node.Depth),
		LatestSizeBytes: node.LatestSizeBytes,
		LatestFileCount: node.LatestFileCount,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to upsert dir node: %w", err)
	}
	return fromSQLiteDirNode(dbNode), nil
}

func (s *SQLiteStore) UpdateDirNodeStats(ctx context.Context, id int64, volumeID string, sizeBytes int64, fileCount int64) error {
	err := s.queries.UpdateDirNodeStats(ctx, sqlite.UpdateDirNodeStatsParams{
		LatestSizeBytes: sizeBytes,
		LatestFileCount: fileCount,
		ID:              id,
		VolumeID:        volumeID,
	})
	if err != nil {
		return fmt.Errorf("failed to update dir node stats: %w", err)
	}
	return nil
}

func (s *SQLiteStore) DeleteDirNodesByVolume(ctx context.Context, volumeID string) error {
	err := s.queries.DeleteDirNodesByVolume(ctx, volumeID)
	if err != nil {
		return fmt.Errorf("failed to delete dir nodes by volume: %w", err)
	}
	return nil
}

func (s *SQLiteStore) CountDirNodesByVolume(ctx context.Context, volumeID string) (int64, error) {
	count, err := s.queries.CountDirNodesByVolume(ctx, volumeID)
	if err != nil {
		return 0, fmt.Errorf("failed to count dir nodes by volume: %w", err)
	}
	return count, nil
}

// Directory Rollup Operations

func (s *SQLiteStore) CreateDirRollup(ctx context.Context, rollup *DirRollup) (*DirRollup, error) {
	dbRollup, err := s.queries.CreateDirRollup(ctx, sqlite.CreateDirRollupParams{
		DirID:      rollup.DirID,
		SizeBytes:  rollup.SizeBytes,
		FileCount:  rollup.FileCount,
		ComputedAt: rollup.ComputedAt.Format(time.RFC3339),
	})
	if err != nil {
		return nil, fmt.Errorf("failed to create dir rollup: %w", err)
	}
	return fromSQLiteDirRollup(dbRollup)
}

func (s *SQLiteStore) GetDirRollup(ctx context.Context, id int64) (*DirRollup, error) {
	dbRollup, err := s.queries.GetDirRollup(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("failed to get dir rollup: %w", err)
	}
	return fromSQLiteDirRollup(dbRollup)
}

func (s *SQLiteStore) GetLatestDirRollup(ctx context.Context, dirID int64) (*DirRollup, error) {
	dbRollup, err := s.queries.GetLatestDirRollup(ctx, dirID)
	if err != nil {
		return nil, fmt.Errorf("failed to get latest dir rollup: %w", err)
	}
	return fromSQLiteDirRollup(dbRollup)
}

func (s *SQLiteStore) GetDirRollupHistory(ctx context.Context, dirID int64, limit int32) ([]*DirRollup, error) {
	dbRollups, err := s.queries.GetDirRollupHistory(ctx, sqlite.GetDirRollupHistoryParams{
		DirID: dirID,
		Limit: int64(limit),
	})
	if err != nil {
		return nil, fmt.Errorf("failed to get dir rollup history: %w", err)
	}

	rollups := make([]*DirRollup, len(dbRollups))
	for i, dbRollup := range dbRollups {
		rollup, err := fromSQLiteDirRollup(dbRollup)
		if err != nil {
			return nil, err
		}
		rollups[i] = rollup
	}
	return rollups, nil
}

func (s *SQLiteStore) GetDirRollupsInTimeRange(ctx context.Context, dirID int64, startTime, endTime time.Time) ([]*DirRollup, error) {
	dbRollups, err := s.queries.GetDirRollupsInTimeRange(ctx, sqlite.GetDirRollupsInTimeRangeParams{
		DirID:        dirID,
		ComputedAt:   startTime.Format(time.RFC3339),
		ComputedAt_2: endTime.Format(time.RFC3339),
	})
	if err != nil {
		return nil, fmt.Errorf("failed to get dir rollups in time range: %w", err)
	}

	rollups := make([]*DirRollup, len(dbRollups))
	for i, dbRollup := range dbRollups {
		rollup, err := fromSQLiteDirRollup(dbRollup)
		if err != nil {
			return nil, err
		}
		rollups[i] = rollup
	}
	return rollups, nil
}

func (s *SQLiteStore) DeleteOldRollups(ctx context.Context, cutoffTime time.Time) error {
	err := s.queries.DeleteOldRollups(ctx, cutoffTime.Format(time.RFC3339))
	if err != nil {
		return fmt.Errorf("failed to delete old rollups: %w", err)
	}
	return nil
}

func (s *SQLiteStore) DeleteRollupsByDirID(ctx context.Context, dirID int64) error {
	err := s.queries.DeleteRollupsByDirId(ctx, dirID)
	if err != nil {
		return fmt.Errorf("failed to delete rollups by dir ID: %w", err)
	}
	return nil
}

func (s *SQLiteStore) CountRollupsByDirID(ctx context.Context, dirID int64) (int64, error) {
	count, err := s.queries.CountRollupsByDirId(ctx, dirID)
	if err != nil {
		return 0, fmt.Errorf("failed to count rollups by dir ID: %w", err)
	}
	return count, nil
}

func (s *SQLiteStore) GetRollupStats(ctx context.Context) (*RollupStats, error) {
	stats, err := s.queries.GetRollupStats(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to get rollup stats: %w", err)
	}

	var oldestRollup, newestRollup *time.Time
	if stats.OldestRollup != nil {
		if timeStr, ok := stats.OldestRollup.(string); ok {
			if parsed, err := time.Parse(time.RFC3339, timeStr); err == nil {
				oldestRollup = &parsed
			}
		}
	}
	if stats.NewestRollup != nil {
		if timeStr, ok := stats.NewestRollup.(string); ok {
			if parsed, err := time.Parse(time.RFC3339, timeStr); err == nil {
				newestRollup = &parsed
			}
		}
	}

	return &RollupStats{
		TotalRollups:           stats.TotalRollups,
		DirectoriesWithRollups: stats.DirectoriesWithRollups,
		OldestRollup:           oldestRollup,
		NewestRollup:           newestRollup,
	}, nil
}

// Bulk Operations using batched multi-row INSERT for SQLite

func (s *SQLiteStore) BulkInsertFileEntries(ctx context.Context, entries []*FileEntry, params BulkInsertParams) error {
	if len(entries) == 0 {
		return nil
	}

	// Create context with timeout
	ctx, cancel := context.WithTimeout(ctx, params.Timeout)
	defer cancel()

	// Process entries in batches with multi-row INSERT
	batchSize := params.BatchSize
	if batchSize <= 0 {
		batchSize = 1000
	}

	for i := 0; i < len(entries); i += batchSize {
		end := i + batchSize
		if end > len(entries) {
			end = len(entries)
		}

		batch := entries[i:end]
		if err := s.executeBatchInsertFileEntries(ctx, batch); err != nil {
			return fmt.Errorf("failed to bulk insert file entries batch %d-%d: %w", i, end, err)
		}
	}

	return nil
}

func (s *SQLiteStore) BulkInsertDirNodes(ctx context.Context, nodes []*DirNode, params BulkInsertParams) error {
	if len(nodes) == 0 {
		return nil
	}

	// Create context with timeout
	ctx, cancel := context.WithTimeout(ctx, params.Timeout)
	defer cancel()

	// Process nodes in batches
	batchSize := params.BatchSize
	if batchSize <= 0 {
		batchSize = 1000
	}

	for i := 0; i < len(nodes); i += batchSize {
		end := i + batchSize
		if end > len(nodes) {
			end = len(nodes)
		}

		batch := nodes[i:end]
		if err := s.executeBatchInsertDirNodes(ctx, batch); err != nil {
			return fmt.Errorf("failed to bulk insert dir nodes batch %d-%d: %w", i, end, err)
		}
	}

	return nil
}

func (s *SQLiteStore) BulkInsertDirRollups(ctx context.Context, rollups []*DirRollup, params BulkInsertParams) error {
	if len(rollups) == 0 {
		return nil
	}

	// Create context with timeout
	ctx, cancel := context.WithTimeout(ctx, params.Timeout)
	defer cancel()

	// Process rollups in batches
	batchSize := params.BatchSize
	if batchSize <= 0 {
		batchSize = 1000
	}

	for i := 0; i < len(rollups); i += batchSize {
		end := i + batchSize
		if end > len(rollups) {
			end = len(rollups)
		}

		batch := rollups[i:end]
		if err := s.executeBatchInsertDirRollups(ctx, batch); err != nil {
			return fmt.Errorf("failed to bulk insert dir rollups batch %d-%d: %w", i, end, err)
		}
	}

	return nil
}

// Helper functions for SQLite batch inserts

func (s *SQLiteStore) executeBatchInsertFileEntries(ctx context.Context, entries []*FileEntry) error {
	// Build multi-row INSERT statement
	valueStrings := make([]string, len(entries))
	valueArgs := make([]interface{}, 0, len(entries)*12)

	for i, entry := range entries {
		valueStrings[i] = "(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
		valueArgs = append(valueArgs,
			entry.VolumeID,
			entry.ParentDirID,
			entry.Name,
			entry.SizeBytes,
			entry.Mtime.Format(time.RFC3339),
			entry.Ctime.Format(time.RFC3339),
			entry.Inode,
			int64ToPtr(entry.UID),
			int64ToPtr(entry.GID),
			entry.Type,
			boolToSQLiteInt(entry.Hidden),
			entry.PathHash,
		)
	}

	stmt := fmt.Sprintf(`
		INSERT INTO file_entries (
			volume_id, parent_dir_id, name, size_bytes, mtime, ctime,
			inode, uid, gid, type, hidden, path_hash
		) VALUES %s`,
		strings.Join(valueStrings, ","),
	)

	_, err := s.db.ExecContext(ctx, stmt, valueArgs...)
	return err
}

func (s *SQLiteStore) executeBatchInsertDirNodes(ctx context.Context, nodes []*DirNode) error {
	// Build multi-row INSERT statement
	valueStrings := make([]string, len(nodes))
	valueArgs := make([]interface{}, 0, len(nodes)*7)

	for i, node := range nodes {
		valueStrings[i] = "(?, ?, ?, ?, ?, ?, ?)"
		valueArgs = append(valueArgs,
			node.VolumeID,
			node.ParentDirID,
			node.Name,
			node.FullPath,
			node.Depth,
			node.LatestSizeBytes,
			node.LatestFileCount,
		)
	}

	stmt := fmt.Sprintf(`
		INSERT INTO dir_nodes (
			volume_id, parent_dir_id, name, full_path, depth,
			latest_size_bytes, latest_file_count
		) VALUES %s`,
		strings.Join(valueStrings, ","),
	)

	_, err := s.db.ExecContext(ctx, stmt, valueArgs...)
	return err
}

func (s *SQLiteStore) executeBatchInsertDirRollups(ctx context.Context, rollups []*DirRollup) error {
	// Build multi-row INSERT statement
	valueStrings := make([]string, len(rollups))
	valueArgs := make([]interface{}, 0, len(rollups)*4)

	for i, rollup := range rollups {
		valueStrings[i] = "(?, ?, ?, ?)"
		valueArgs = append(valueArgs,
			rollup.DirID,
			rollup.SizeBytes,
			rollup.FileCount,
			rollup.ComputedAt.Format(time.RFC3339),
		)
	}

	stmt := fmt.Sprintf(`
		INSERT INTO dir_rollups (
			dir_id, size_bytes, file_count, computed_at
		) VALUES %s`,
		strings.Join(valueStrings, ","),
	)

	_, err := s.db.ExecContext(ctx, stmt, valueArgs...)
	return err
}

// Helper functions for type conversion between store types and sqlite types

func toSQLiteInt64(val *int64) sql.NullInt64 {
	if val == nil {
		return sql.NullInt64{Valid: false}
	}
	return sql.NullInt64{Int64: *val, Valid: true}
}

func fromSQLiteInt64(val sql.NullInt64) *int64 {
	if !val.Valid {
		return nil
	}
	return &val.Int64
}

func int64ToPtr(val *int32) *int64 {
	if val == nil {
		return nil
	}
	result := int64(*val)
	return &result
}

func int64PtrToInt32Ptr(val *int64) *int32 {
	if val == nil {
		return nil
	}
	result := int32(*val)
	return &result
}

func boolToSQLiteInt(b bool) int64 {
	if b {
		return 1
	}
	return 0
}

func sqliteIntToBool(i int64) bool {
	return i != 0
}

func fromSQLiteFileEntry(dbEntry sqlite.FileEntries) (*FileEntry, error) {
	mtime, err := parseSQLiteTime(dbEntry.Mtime)
	if err != nil {
		return nil, fmt.Errorf("failed to parse mtime: %w", err)
	}

	ctime, err := parseSQLiteTime(dbEntry.Ctime)
	if err != nil {
		return nil, fmt.Errorf("failed to parse ctime: %w", err)
	}

	createdAt, err := parseSQLiteTime(dbEntry.CreatedAt)
	if err != nil {
		return nil, fmt.Errorf("failed to parse created_at: %w", err)
	}

	updatedAt, err := parseSQLiteTime(dbEntry.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("failed to parse updated_at: %w", err)
	}

	return &FileEntry{
		ID:          dbEntry.ID,
		VolumeID:    dbEntry.VolumeID,
		ParentDirID: fromSQLiteInt64(dbEntry.ParentDirID),
		Name:        dbEntry.Name,
		SizeBytes:   dbEntry.SizeBytes,
		Mtime:       mtime,
		Ctime:       ctime,
		Inode:       fromSQLiteInt64(dbEntry.Inode),
		UID:         int64PtrToInt32Ptr(fromSQLiteInt64(dbEntry.Uid)),
		GID:         int64PtrToInt32Ptr(fromSQLiteInt64(dbEntry.Gid)),
		Type:        dbEntry.Type,
		Hidden:      sqliteIntToBool(dbEntry.Hidden),
		PathHash:    dbEntry.PathHash,
		CreatedAt:   createdAt,
		UpdatedAt:   updatedAt,
	}, nil
}

func fromSQLiteDirNode(dbNode sqlite.DirNodes) *DirNode {
	createdAt, _ := parseSQLiteTime(dbNode.CreatedAt)
	updatedAt, _ := parseSQLiteTime(dbNode.UpdatedAt)

	return &DirNode{
		ID:              dbNode.ID,
		VolumeID:        dbNode.VolumeID,
		ParentDirID:     fromSQLiteInt64(dbNode.ParentDirID),
		Name:            dbNode.Name,
		FullPath:        dbNode.FullPath,
		Depth:           int32(dbNode.Depth),
		LatestSizeBytes: dbNode.LatestSizeBytes,
		LatestFileCount: dbNode.LatestFileCount,
		CreatedAt:       createdAt,
		UpdatedAt:       updatedAt,
	}
}

func fromSQLiteDirRollup(dbRollup sqlite.DirRollups) (*DirRollup, error) {
	computedAt, err := parseSQLiteTime(dbRollup.ComputedAt)
	if err != nil {
		return nil, fmt.Errorf("failed to parse computed_at: %w", err)
	}

	createdAt, err := parseSQLiteTime(dbRollup.CreatedAt)
	if err != nil {
		return nil, fmt.Errorf("failed to parse created_at: %w", err)
	}

	return &DirRollup{
		ID:         dbRollup.ID,
		DirID:      dbRollup.DirID,
		SizeBytes:  dbRollup.SizeBytes,
		FileCount:  dbRollup.FileCount,
		ComputedAt: computedAt,
		CreatedAt:  createdAt,
	}, nil
}

func fromSQLiteGetDirectoryTreeRow(dbRow sqlite.GetDirectoryTreeRow) *DirNode {
	createdAt, _ := time.Parse(time.RFC3339, dbRow.CreatedAt)
	updatedAt, _ := time.Parse(time.RFC3339, dbRow.UpdatedAt)

	return &DirNode{
		ID:              dbRow.ID,
		VolumeID:        dbRow.VolumeID,
		ParentDirID:     fromSQLiteInt64(dbRow.ParentDirID),
		Name:            dbRow.Name,
		FullPath:        dbRow.FullPath,
		Depth:           int32(dbRow.Depth),
		LatestSizeBytes: dbRow.LatestSizeBytes,
		LatestFileCount: dbRow.LatestFileCount,
		CreatedAt:       createdAt,
		UpdatedAt:       updatedAt,
	}
}

// Usage Snapshots Methods

func (s *SQLiteStore) CreateUsageSnapshot(ctx context.Context, params CreateUsageSnapshotParams) (*UsageSnapshot, error) {
	// Convert time to SQLite format
	snapshotDate := params.SnapshotDate.Format("2006-01-02 15:04:05")

	// Convert optional values to sql.Null types
	var growthBytes, growthFiles, scanDurationMs sql.NullInt64
	if params.GrowthBytes != 0 {
		growthBytes = sql.NullInt64{Int64: params.GrowthBytes, Valid: true}
	}
	if params.GrowthFiles != 0 {
		growthFiles = sql.NullInt64{Int64: params.GrowthFiles, Valid: true}
	}
	if params.ScanDurationMs != 0 {
		scanDurationMs = sql.NullInt64{Int64: params.ScanDurationMs, Valid: true}
	}

	var growthRate sql.NullFloat64
	if params.GrowthRateBytesPerDay != 0 {
		growthRate = sql.NullFloat64{Float64: params.GrowthRateBytesPerDay, Valid: true}
	}

	sqliteParams := sqlite.CreateUsageSnapshotParams{
		VolumeID:              params.VolumeID,
		SnapshotDate:          snapshotDate,
		SnapshotType:          params.SnapshotType,
		TotalSize:             params.TotalSize,
		FileCount:             params.FileCount,
		DirectoryCount:        params.DirectoryCount,
		LargestFile:           params.LargestFile,
		GrowthBytes:           growthBytes,
		GrowthFiles:           growthFiles,
		GrowthRateBytesPerDay: growthRate,
		ScanMethod:            params.ScanMethod,
		ScanDurationMs:        scanDurationMs,
	}

	dbSnapshot, err := s.queries.CreateUsageSnapshot(ctx, sqliteParams)
	if err != nil {
		return nil, fmt.Errorf("failed to create usage snapshot: %w", err)
	}

	return fromSQLiteUsageSnapshot(dbSnapshot), nil
}

func (s *SQLiteStore) GetLatestSnapshot(ctx context.Context, volumeID, snapshotType string) (*UsageSnapshot, error) {
	params := sqlite.GetLatestSnapshotParams{
		VolumeID:     volumeID,
		SnapshotType: snapshotType,
	}

	dbSnapshot, err := s.queries.GetLatestSnapshot(ctx, params)
	if err != nil {
		return nil, fmt.Errorf("failed to get latest snapshot: %w", err)
	}

	return fromSQLiteUsageSnapshot(dbSnapshot), nil
}

func (s *SQLiteStore) Get7DayTrend(ctx context.Context, volumeID string) (*TrendData, error) {
	row, err := s.queries.Get7DayTrend(ctx, volumeID)
	if err != nil {
		return nil, fmt.Errorf("failed to get 7-day trend: %w", err)
	}

	return &TrendData{
		AvgGrowthRate: sqliteFromInterfaceToFloat64(row.AvgGrowthRate),
		TotalGrowth:   sqliteFromInterfaceToInt64(row.TotalGrowth),
		DataPoints:    row.DataPoints,
		PeriodStart:   fromSQLiteStringToTimePtr(row.PeriodStart),
		PeriodEnd:     fromSQLiteStringToTimePtr(row.PeriodEnd),
	}, nil
}

func (s *SQLiteStore) Get30DayTrend(ctx context.Context, volumeID string) (*TrendData, error) {
	row, err := s.queries.Get30DayTrend(ctx, volumeID)
	if err != nil {
		return nil, fmt.Errorf("failed to get 30-day trend: %w", err)
	}

	return &TrendData{
		AvgGrowthRate: sqliteFromInterfaceToFloat64(row.AvgGrowthRate),
		TotalGrowth:   sqliteFromInterfaceToInt64(row.TotalGrowth),
		DataPoints:    row.DataPoints,
		PeriodStart:   fromSQLiteStringToTimePtr(row.PeriodStart),
		PeriodEnd:     fromSQLiteStringToTimePtr(row.PeriodEnd),
	}, nil
}

func (s *SQLiteStore) GetGrowthDeltas(ctx context.Context, params GetGrowthDeltasParams) (*GrowthDeltasResult, error) {
	sqliteParams := sqlite.GetGrowthDeltasParams{
		VolumeID:     params.VolumeID,
		SnapshotType: params.SnapshotType,
		Limit:        int64(params.Limit),
	}

	row, err := s.queries.GetGrowthDeltas(ctx, sqliteParams)
	if err != nil {
		return nil, fmt.Errorf("failed to get growth deltas: %w", err)
	}

	return &GrowthDeltasResult{
		TotalSizeChange:      sqliteFromInterfaceToInt64(row.TotalSizeChange),
		TotalFilesChange:     sqliteFromInterfaceToInt64(row.TotalFilesChange),
		AvgSizeChangePerDay:  sqliteFromInterfaceToFloat64(row.AvgSizeChangePerDay),
		AvgFilesChangePerDay: sqliteFromInterfaceToFloat64(row.AvgFilesChangePerDay),
		SnapshotCount:        row.SnapshotCount,
		PeriodStart:          fromSQLiteStringToTimePtr(row.PeriodStart),
		PeriodEnd:            fromSQLiteStringToTimePtr(row.PeriodEnd),
	}, nil
}

func (s *SQLiteStore) GetVolumeStepSeries(ctx context.Context, params GetVolumeStepSeriesParams) ([]*StepSeriesPoint, error) {
	dateStr := params.Date.Format("2006-01-02")
	sqliteParams := sqlite.GetVolumeStepSeriesParams{
		VolumeID:     params.VolumeID,
		SnapshotType: params.SnapshotType,
		SnapshotDate: dateStr,
	}

	rows, err := s.queries.GetVolumeStepSeries(ctx, sqliteParams)
	if err != nil {
		return nil, fmt.Errorf("failed to get volume step series: %w", err)
	}

	result := make([]*StepSeriesPoint, len(rows))
	for i, row := range rows {
		date, _ := time.Parse("2006-01-02", row.Date)
		result[i] = &StepSeriesPoint{
			Date:       date,
			TotalSize:  row.TotalSize,
			FileCount:  row.FileCount,
			GrowthRate: sqliteFromInterfaceToFloat64(row.GrowthRate),
		}
	}

	return result, nil
}

func (s *SQLiteStore) GetTrendSlope(ctx context.Context, params GetTrendSlopeParams) (*TrendSlopeResult, error) {
	dateStr := params.Date.Format("2006-01-02")
	sqliteParams := sqlite.GetTrendSlopeParams{
		VolumeID:     params.VolumeID,
		SnapshotType: params.SnapshotType,
		SnapshotDate: dateStr,
	}

	row, err := s.queries.GetTrendSlope(ctx, sqliteParams)
	if err != nil {
		return nil, fmt.Errorf("failed to get trend slope: %w", err)
	}

	return &TrendSlopeResult{
		Slope:      sqliteFromInterfaceToFloat64(row.Slope),
		DataPoints: row.DataPoints,
	}, nil
}

// Rollup computes directory rollups for a volume (stub implementation)
// TODO: Integrate with existing rollup_service.go implementation
func (s *SQLiteStore) Rollup(ctx context.Context, volumeID string, opts *RollupOptions) (*RollupResult, error) {
	// Stub implementation for now - needs integration with rollup service
	return &RollupResult{
		VolumeID:             volumeID,
		Duration:             0,
		ProcessedDirectories: 0,
		CreatedRollups:       0,
		UpdatedRollups:       0,
		PerformanceRating:    "not_implemented",
	}, nil
}

// Transaction management implementation for SQLiteStore

// Tx executes a function within a database transaction with automatic rollback/commit
func (s *SQLiteStore) Tx(ctx context.Context, fn TxFunc) error {
	return s.TxWithTimeout(ctx, 30*time.Second, fn)
}

// TxWithTimeout executes a transaction with a specific timeout
func (s *SQLiteStore) TxWithTimeout(ctx context.Context, timeout time.Duration, fn TxFunc) error {
	// Create context with timeout for the entire transaction
	txCtx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()

	// Begin transaction
	tx, err := s.db.BeginTx(txCtx, nil)
	if err != nil {
		return fmt.Errorf("failed to begin SQLite transaction: %w", err)
	}

	// Create a new SQLiteStore instance that uses the transaction
	txStore := &SQLiteStore{
		db:      nil, // Don't use db for transaction operations
		queries: s.queries.WithTx(tx),
	}

	// Track completion status to avoid double rollback/commit
	var committed bool
	defer func() {
		if !committed {
			if rollbackErr := tx.Rollback(); rollbackErr != nil {
				// Log rollback error but don't overwrite original error
				fmt.Printf("[WARN] SQLite transaction rollback failed: %v (original error: %v)\n", rollbackErr, err)
			}
		}
	}()

	// Execute the transaction function
	if err = fn(txCtx, txStore); err != nil {
		return fmt.Errorf("SQLite transaction function failed: %w", err)
	}

	// Commit the transaction
	if err = tx.Commit(); err != nil {
		return fmt.Errorf("failed to commit SQLite transaction: %w", err)
	}

	committed = true
	return nil
}

// ReadOnlyTx executes a read-only transaction
func (s *SQLiteStore) ReadOnlyTx(ctx context.Context, fn TxFunc) error {
	return s.TxWithTimeout(ctx, 15*time.Second, fn)
}

// FastTx executes a transaction with a shorter timeout for simple operations
func (s *SQLiteStore) FastTx(ctx context.Context, fn TxFunc) error {
	return s.TxWithTimeout(ctx, 5*time.Second, fn)
}

// BulkTx executes a transaction with a longer timeout for bulk operations
func (s *SQLiteStore) BulkTx(ctx context.Context, fn TxFunc) error {
	return s.TxWithTimeout(ctx, 5*time.Minute, fn)
}

// Helper functions for converting between SQLite and store types

func fromSQLiteUsageSnapshot(dbSnapshot sqlite.UsageSnapshots) *UsageSnapshot {
	// Parse date string
	snapshotDate, _ := time.Parse("2006-01-02", dbSnapshot.SnapshotDate)
	createdAt, _ := time.Parse("2006-01-02 15:04:05", dbSnapshot.CreatedAt)
	updatedAt, _ := time.Parse("2006-01-02 15:04:05", dbSnapshot.UpdatedAt)

	return &UsageSnapshot{
		ID:                    dbSnapshot.ID,
		VolumeID:              dbSnapshot.VolumeID,
		SnapshotDate:          snapshotDate,
		SnapshotType:          dbSnapshot.SnapshotType,
		TotalSize:             dbSnapshot.TotalSize,
		FileCount:             dbSnapshot.FileCount,
		DirectoryCount:        dbSnapshot.DirectoryCount,
		LargestFile:           dbSnapshot.LargestFile,
		GrowthBytes:           sqliteFromInterfaceToInt64(dbSnapshot.GrowthBytes),
		GrowthFiles:           sqliteFromInterfaceToInt64(dbSnapshot.GrowthFiles),
		GrowthRateBytesPerDay: sqliteFromInterfaceToFloat64(dbSnapshot.GrowthRateBytesPerDay),
		ScanMethod:            dbSnapshot.ScanMethod,
		ScanDurationMs:        sqliteFromInterfaceToInt64(dbSnapshot.ScanDurationMs),
		CreatedAt:             createdAt,
		UpdatedAt:             updatedAt,
	}
}

func sqliteFromInterfaceToFloat64(val interface{}) float64 {
	if val == nil {
		return 0
	}
	switch v := val.(type) {
	case float64:
		return v
	case int64:
		return float64(v)
	case int:
		return float64(v)
	default:
		return 0
	}
}

func sqliteFromInterfaceToInt64(val interface{}) int64 {
	if val == nil {
		return 0
	}
	switch v := val.(type) {
	case int64:
		return v
	case int:
		return int64(v)
	case float64:
		return int64(v)
	default:
		return 0
	}
}

func fromSQLiteStringToTimePtr(val interface{}) *time.Time {
	if val == nil {
		return nil
	}
	if str, ok := val.(string); ok {
		if t, err := time.Parse("2006-01-02", str); err == nil {
			return &t
		}
		if t, err := time.Parse("2006-01-02 15:04:05", str); err == nil {
			return &t
		}
	}
	return nil
}

// Volume operations
func (s *SQLiteStore) UpsertVolume(ctx context.Context, volume *Volume) error {
	// TODO: Implement using sqlc queries
	return nil
}

func (s *SQLiteStore) DeleteVolume(ctx context.Context, volumeID string) error {
	// TODO: Implement using sqlc queries
	return nil
}

func (s *SQLiteStore) GetVolumeByName(ctx context.Context, name string) (*Volume, error) {
	// TODO: Implement using sqlc queries
	return nil, nil
}

func (s *SQLiteStore) ListAllVolumes(ctx context.Context) ([]*Volume, error) {
	// TODO: Implement using sqlc queries
	return []*Volume{}, nil
}

// Container operations
// TODO: Add container and volume mount queries to sqlc
func (s *SQLiteStore) UpsertContainer(ctx context.Context, container *Container) error {
	// Placeholder implementation until queries are added
	return nil
}

func (s *SQLiteStore) DeleteContainer(ctx context.Context, containerID string) error {
	// Placeholder implementation until queries are added
	return nil
}

func (s *SQLiteStore) GetContainerByID(ctx context.Context, containerID string) (*Container, error) {
	// Placeholder implementation until queries are added
	return nil, nil
}

func (s *SQLiteStore) ListAllContainers(ctx context.Context) ([]*Container, error) {
	// Placeholder implementation until queries are added
	return []*Container{}, nil
}

// Volume mount operations
func (s *SQLiteStore) UpsertVolumeMount(ctx context.Context, mount *VolumeMount) error {
	// Placeholder implementation until queries are added
	return nil
}

func (s *SQLiteStore) DeleteVolumeMount(ctx context.Context, volumeID, containerID string) error {
	// Placeholder implementation until queries are added
	return nil
}

func (s *SQLiteStore) GetVolumeMountsByContainer(ctx context.Context, containerID string) ([]*VolumeMount, error) {
	// Placeholder implementation until queries are added
	return []*VolumeMount{}, nil
}

func (s *SQLiteStore) GetVolumeMountsByVolume(ctx context.Context, volumeID string) ([]*VolumeMount, error) {
	// Placeholder implementation until queries are added
	return []*VolumeMount{}, nil
}

func (s *SQLiteStore) DeactivateVolumeMounts(ctx context.Context, containerID string) error {
	// Placeholder implementation until queries are added
	return nil
}

func (s *SQLiteStore) ListAllVolumeMounts(ctx context.Context) ([]*VolumeMount, error) {
	// Placeholder implementation until queries are added
	return []*VolumeMount{}, nil
}

// GetFacade returns the store facade for legacy compatibility
func (s *SQLiteStore) GetFacade() *StoreFacade {
	return s.facade
}
