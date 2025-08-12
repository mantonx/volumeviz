package store

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/mantonx/volumeviz/internal/store/config"
	"github.com/mantonx/volumeviz/internal/store/generated/postgres"
)

// Helper functions for JSON marshaling
func jsonMarshal(v interface{}) ([]byte, error) {
	return json.Marshal(v)
}

func jsonUnmarshal(data []byte, v interface{}) error {
	return json.Unmarshal(data, v)
}

// PostgresStore implements Store interface using PostgreSQL with sqlc and pgx
type PostgresStore struct {
	pool    *pgxpool.Pool
	queries *postgres.Queries
	facade  *StoreFacade
}

// NewPostgresStore creates a new PostgreSQL store with connection pool
func NewPostgresStore(cfg *config.Config) (*PostgresStore, error) {
	// Build connection string with pool configuration
	dsn := fmt.Sprintf(
		"host=%s port=%d user=%s password=%s dbname=%s sslmode=%s pool_max_conns=%d pool_min_conns=%d pool_max_conn_lifetime=%s pool_max_conn_idle_time=%s",
		cfg.Host, cfg.Port, cfg.User, cfg.Password, cfg.Database, cfg.SSLMode,
		cfg.MaxOpenConns, cfg.MaxIdleConns, cfg.ConnMaxLife, cfg.Timeout,
	)

	poolConfig, err := pgxpool.ParseConfig(dsn)
	if err != nil {
		return nil, fmt.Errorf("failed to parse connection string: %w", err)
	}

	// Performance optimizations for bulk operations
	poolConfig.MaxConns = int32(cfg.MaxOpenConns)
	poolConfig.MinConns = int32(cfg.MaxIdleConns)
	poolConfig.MaxConnLifetime = cfg.ConnMaxLife
	poolConfig.MaxConnIdleTime = cfg.Timeout

	pool, err := pgxpool.NewWithConfig(context.Background(), poolConfig)
	if err != nil {
		return nil, fmt.Errorf("failed to create connection pool: %w", err)
	}

	// Test connection
	if err := pool.Ping(context.Background()); err != nil {
		pool.Close()
		return nil, fmt.Errorf("failed to ping database: %w", err)
	}

	store := &PostgresStore{
		pool:    pool,
		queries: postgres.New(pool),
	}
	
	// Create facade
	store.facade = NewStoreFacade(config.DatabaseTypePostgreSQL, pool, nil)
	
	return store, nil
}

// Close closes the database connection pool
func (s *PostgresStore) Close() error {
	s.pool.Close()
	return nil
}

// Health checks database connectivity
func (s *PostgresStore) Health(ctx context.Context) error {
	return s.pool.Ping(ctx)
}

// File Entry Operations

func (s *PostgresStore) CreateFileEntry(ctx context.Context, entry *FileEntry) (*FileEntry, error) {
	dbEntry, err := s.queries.CreateFileEntry(ctx, postgres.CreateFileEntryParams{
		VolumeID:    entry.VolumeID,
		ParentDirID: toPostgresInt8(entry.ParentDirID),
		Name:        entry.Name,
		SizeBytes:   entry.SizeBytes,
		Mtime:       entry.Mtime,
		Ctime:       entry.Ctime,
		Inode:       toPostgresInt8(entry.Inode),
		Uid:         toPostgresInt4(entry.UID),
		Gid:         toPostgresInt4(entry.GID),
		Type:        entry.Type,
		Hidden:      entry.Hidden,
		PathHash:    entry.PathHash,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to create file entry: %w", err)
	}
	return fromPostgresFileEntry(dbEntry), nil
}

func (s *PostgresStore) GetFileEntry(ctx context.Context, id int64, volumeID string) (*FileEntry, error) {
	dbEntry, err := s.queries.GetFileEntry(ctx, postgres.GetFileEntryParams{
		ID:       id,
		VolumeID: volumeID,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to get file entry: %w", err)
	}
	return fromPostgresFileEntry(dbEntry), nil
}

func (s *PostgresStore) GetFileEntriesByVolumeAndParent(ctx context.Context, volumeID string, parentDirID *int64) ([]*FileEntry, error) {
	dbEntries, err := s.queries.GetFileEntriesByVolumeAndParent(ctx, postgres.GetFileEntriesByVolumeAndParentParams{
		VolumeID:    volumeID,
		ParentDirID: toPostgresInt8(parentDirID),
	})
	if err != nil {
		return nil, fmt.Errorf("failed to get file entries: %w", err)
	}

	entries := make([]*FileEntry, len(dbEntries))
	for i, dbEntry := range dbEntries {
		entries[i] = fromPostgresFileEntry(dbEntry)
	}
	return entries, nil
}

func (s *PostgresStore) GetLargestFiles(ctx context.Context, volumeID string, limit int32) ([]*FileEntry, error) {
	dbEntries, err := s.queries.GetLargestFiles(ctx, postgres.GetLargestFilesParams{
		VolumeID: volumeID,
		Limit:    limit,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to get largest files: %w", err)
	}

	entries := make([]*FileEntry, len(dbEntries))
	for i, dbEntry := range dbEntries {
		entries[i] = fromPostgresFileEntry(dbEntry)
	}
	return entries, nil
}

func (s *PostgresStore) FindFilesByPathHash(ctx context.Context, volumeID string, pathHash []byte) ([]*FileEntry, error) {
	dbEntries, err := s.queries.FindFilesByPathHash(ctx, postgres.FindFilesByPathHashParams{
		VolumeID: volumeID,
		PathHash: pathHash,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to find files by path hash: %w", err)
	}

	entries := make([]*FileEntry, len(dbEntries))
	for i, dbEntry := range dbEntries {
		entries[i] = fromPostgresFileEntry(dbEntry)
	}
	return entries, nil
}

func (s *PostgresStore) UpsertFileEntry(ctx context.Context, entry *FileEntry) (*FileEntry, error) {
	dbEntry, err := s.queries.UpsertFileEntry(ctx, postgres.UpsertFileEntryParams{
		VolumeID:    entry.VolumeID,
		ParentDirID: toPostgresInt8(entry.ParentDirID),
		Name:        entry.Name,
		SizeBytes:   entry.SizeBytes,
		Mtime:       entry.Mtime,
		Ctime:       entry.Ctime,
		Inode:       toPostgresInt8(entry.Inode),
		Uid:         toPostgresInt4(entry.UID),
		Gid:         toPostgresInt4(entry.GID),
		Type:        entry.Type,
		Hidden:      entry.Hidden,
		PathHash:    entry.PathHash,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to upsert file entry: %w", err)
	}
	return fromPostgresFileEntry(dbEntry), nil
}

func (s *PostgresStore) DeleteFileEntriesByVolume(ctx context.Context, volumeID string) error {
	err := s.queries.DeleteFileEntriesByVolume(ctx, volumeID)
	if err != nil {
		return fmt.Errorf("failed to delete file entries by volume: %w", err)
	}
	return nil
}

func (s *PostgresStore) CountFileEntriesByVolume(ctx context.Context, volumeID string) (int64, error) {
	count, err := s.queries.CountFileEntriesByVolume(ctx, volumeID)
	if err != nil {
		return 0, fmt.Errorf("failed to count file entries by volume: %w", err)
	}
	return count, nil
}

func (s *PostgresStore) GetVolumeFileStats(ctx context.Context, volumeID string) (*VolumeFileStats, error) {
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

func (s *PostgresStore) CreateDirNode(ctx context.Context, node *DirNode) (*DirNode, error) {
	dbNode, err := s.queries.CreateDirNode(ctx, postgres.CreateDirNodeParams{
		VolumeID:        node.VolumeID,
		ParentDirID:     toPostgresInt8(node.ParentDirID),
		Name:            node.Name,
		FullPath:        node.FullPath,
		Depth:           node.Depth,
		LatestSizeBytes: node.LatestSizeBytes,
		LatestFileCount: node.LatestFileCount,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to create dir node: %w", err)
	}
	return fromPostgresDirNode(dbNode), nil
}

func (s *PostgresStore) GetDirNode(ctx context.Context, id int64, volumeID string) (*DirNode, error) {
	dbNode, err := s.queries.GetDirNode(ctx, postgres.GetDirNodeParams{
		ID:       id,
		VolumeID: volumeID,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to get dir node: %w", err)
	}
	return fromPostgresDirNode(dbNode), nil
}

func (s *PostgresStore) GetDirNodeByPath(ctx context.Context, volumeID string, fullPath string) (*DirNode, error) {
	dbNode, err := s.queries.GetDirNodeByPath(ctx, postgres.GetDirNodeByPathParams{
		VolumeID: volumeID,
		FullPath: fullPath,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to get dir node by path: %w", err)
	}
	return fromPostgresDirNode(dbNode), nil
}

func (s *PostgresStore) GetChildDirNodes(ctx context.Context, volumeID string, parentDirID *int64) ([]*DirNode, error) {
	dbNodes, err := s.queries.GetChildDirNodes(ctx, postgres.GetChildDirNodesParams{
		VolumeID:    volumeID,
		ParentDirID: toPostgresInt8(parentDirID),
	})
	if err != nil {
		return nil, fmt.Errorf("failed to get child dir nodes: %w", err)
	}

	nodes := make([]*DirNode, len(dbNodes))
	for i, dbNode := range dbNodes {
		nodes[i] = fromPostgresDirNode(dbNode)
	}
	return nodes, nil
}

func (s *PostgresStore) GetRootDirNodes(ctx context.Context, volumeID string) ([]*DirNode, error) {
	dbNodes, err := s.queries.GetRootDirNodes(ctx, volumeID)
	if err != nil {
		return nil, fmt.Errorf("failed to get root dir nodes: %w", err)
	}

	nodes := make([]*DirNode, len(dbNodes))
	for i, dbNode := range dbNodes {
		nodes[i] = fromPostgresDirNode(dbNode)
	}
	return nodes, nil
}

func (s *PostgresStore) GetLargestDirectories(ctx context.Context, volumeID string, limit int32) ([]*DirNode, error) {
	dbNodes, err := s.queries.GetLargestDirectories(ctx, postgres.GetLargestDirectoriesParams{
		VolumeID: volumeID,
		Limit:    limit,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to get largest directories: %w", err)
	}

	nodes := make([]*DirNode, len(dbNodes))
	for i, dbNode := range dbNodes {
		nodes[i] = fromPostgresDirNode(dbNode)
	}
	return nodes, nil
}

func (s *PostgresStore) GetDirectoryTree(ctx context.Context, volumeID string, maxDepth int32) ([]*DirNode, error) {
	dbNodes, err := s.queries.GetDirectoryTree(ctx, postgres.GetDirectoryTreeParams{
		VolumeID: volumeID,
		MaxDepth: maxDepth,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to get directory tree: %w", err)
	}

	nodes := make([]*DirNode, len(dbNodes))
	for i, dbNode := range dbNodes {
		nodes[i] = fromPostgresGetDirectoryTreeRow(dbNode)
	}
	return nodes, nil
}

func (s *PostgresStore) UpsertDirNode(ctx context.Context, node *DirNode) (*DirNode, error) {
	dbNode, err := s.queries.UpsertDirNode(ctx, postgres.UpsertDirNodeParams{
		VolumeID:        node.VolumeID,
		ParentDirID:     toPostgresInt8(node.ParentDirID),
		Name:            node.Name,
		FullPath:        node.FullPath,
		Depth:           node.Depth,
		LatestSizeBytes: node.LatestSizeBytes,
		LatestFileCount: node.LatestFileCount,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to upsert dir node: %w", err)
	}
	return fromPostgresDirNode(dbNode), nil
}

func (s *PostgresStore) UpdateDirNodeStats(ctx context.Context, id int64, volumeID string, sizeBytes int64, fileCount int64) error {
	err := s.queries.UpdateDirNodeStats(ctx, postgres.UpdateDirNodeStatsParams{
		ID:              id,
		VolumeID:        volumeID,
		LatestSizeBytes: sizeBytes,
		LatestFileCount: fileCount,
	})
	if err != nil {
		return fmt.Errorf("failed to update dir node stats: %w", err)
	}
	return nil
}

func (s *PostgresStore) DeleteDirNodesByVolume(ctx context.Context, volumeID string) error {
	err := s.queries.DeleteDirNodesByVolume(ctx, volumeID)
	if err != nil {
		return fmt.Errorf("failed to delete dir nodes by volume: %w", err)
	}
	return nil
}

func (s *PostgresStore) CountDirNodesByVolume(ctx context.Context, volumeID string) (int64, error) {
	count, err := s.queries.CountDirNodesByVolume(ctx, volumeID)
	if err != nil {
		return 0, fmt.Errorf("failed to count dir nodes by volume: %w", err)
	}
	return count, nil
}

// Directory Rollup Operations

func (s *PostgresStore) CreateDirRollup(ctx context.Context, rollup *DirRollup) (*DirRollup, error) {
	dbRollup, err := s.queries.CreateDirRollup(ctx, postgres.CreateDirRollupParams{
		DirID:      rollup.DirID,
		SizeBytes:  rollup.SizeBytes,
		FileCount:  rollup.FileCount,
		ComputedAt: rollup.ComputedAt,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to create dir rollup: %w", err)
	}
	return fromPostgresDirRollup(dbRollup), nil
}

func (s *PostgresStore) GetDirRollup(ctx context.Context, id int64) (*DirRollup, error) {
	dbRollup, err := s.queries.GetDirRollup(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("failed to get dir rollup: %w", err)
	}
	return fromPostgresDirRollup(dbRollup), nil
}

func (s *PostgresStore) GetLatestDirRollup(ctx context.Context, dirID int64) (*DirRollup, error) {
	dbRollup, err := s.queries.GetLatestDirRollup(ctx, dirID)
	if err != nil {
		return nil, fmt.Errorf("failed to get latest dir rollup: %w", err)
	}
	return fromPostgresDirRollup(dbRollup), nil
}

func (s *PostgresStore) GetDirRollupHistory(ctx context.Context, dirID int64, limit int32) ([]*DirRollup, error) {
	dbRollups, err := s.queries.GetDirRollupHistory(ctx, postgres.GetDirRollupHistoryParams{
		DirID: dirID,
		Limit: limit,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to get dir rollup history: %w", err)
	}

	rollups := make([]*DirRollup, len(dbRollups))
	for i, dbRollup := range dbRollups {
		rollups[i] = fromPostgresDirRollup(dbRollup)
	}
	return rollups, nil
}

func (s *PostgresStore) GetDirRollupsInTimeRange(ctx context.Context, dirID int64, startTime, endTime time.Time) ([]*DirRollup, error) {
	dbRollups, err := s.queries.GetDirRollupsInTimeRange(ctx, postgres.GetDirRollupsInTimeRangeParams{
		DirID:        dirID,
		ComputedAt:   startTime,
		ComputedAt_2: endTime,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to get dir rollups in time range: %w", err)
	}

	rollups := make([]*DirRollup, len(dbRollups))
	for i, dbRollup := range dbRollups {
		rollups[i] = fromPostgresDirRollup(dbRollup)
	}
	return rollups, nil
}

func (s *PostgresStore) DeleteOldRollups(ctx context.Context, cutoffTime time.Time) error {
	err := s.queries.DeleteOldRollups(ctx, cutoffTime)
	if err != nil {
		return fmt.Errorf("failed to delete old rollups: %w", err)
	}
	return nil
}

func (s *PostgresStore) DeleteRollupsByDirID(ctx context.Context, dirID int64) error {
	err := s.queries.DeleteRollupsByDirId(ctx, dirID)
	if err != nil {
		return fmt.Errorf("failed to delete rollups by dir ID: %w", err)
	}
	return nil
}

func (s *PostgresStore) CountRollupsByDirID(ctx context.Context, dirID int64) (int64, error) {
	count, err := s.queries.CountRollupsByDirId(ctx, dirID)
	if err != nil {
		return 0, fmt.Errorf("failed to count rollups by dir ID: %w", err)
	}
	return count, nil
}

func (s *PostgresStore) GetRollupStats(ctx context.Context) (*RollupStats, error) {
	stats, err := s.queries.GetRollupStats(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to get rollup stats: %w", err)
	}

	var oldestRollup, newestRollup *time.Time
	if stats.OldestRollup != nil {
		if val, ok := stats.OldestRollup.(time.Time); ok {
			oldestRollup = &val
		}
	}
	if stats.NewestRollup != nil {
		if val, ok := stats.NewestRollup.(time.Time); ok {
			newestRollup = &val
		}
	}

	return &RollupStats{
		TotalRollups:           stats.TotalRollups,
		DirectoriesWithRollups: stats.DirectoriesWithRollups,
		OldestRollup:           oldestRollup,
		NewestRollup:           newestRollup,
	}, nil
}

// Bulk Operations using PostgreSQL COPY FROM for maximum performance

func (s *PostgresStore) BulkInsertFileEntries(ctx context.Context, entries []*FileEntry, params BulkInsertParams) error {
	if len(entries) == 0 {
		return nil
	}

	// Create context with timeout
	ctx, cancel := context.WithTimeout(ctx, params.Timeout)
	defer cancel()

	// Process entries in batches
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
		copySlice := make([][]interface{}, len(batch))

		for j, entry := range batch {
			copySlice[j] = []interface{}{
				entry.VolumeID,
				entry.ParentDirID,
				entry.Name,
				entry.SizeBytes,
				entry.Mtime,
				entry.Ctime,
				entry.Inode,
				entry.UID,
				entry.GID,
				entry.Type,
				entry.Hidden,
				entry.PathHash,
			}
		}

		_, err := s.pool.CopyFrom(ctx, pgx.Identifier{"file_entries"}, []string{
			"volume_id", "parent_dir_id", "name", "size_bytes", "mtime", "ctime",
			"inode", "uid", "gid", "type", "hidden", "path_hash",
		}, pgx.CopyFromRows(copySlice))

		if err != nil {
			return fmt.Errorf("failed to bulk insert file entries batch %d-%d: %w", i, end, err)
		}
	}

	return nil
}

func (s *PostgresStore) BulkInsertDirNodes(ctx context.Context, nodes []*DirNode, params BulkInsertParams) error {
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
		copySlice := make([][]interface{}, len(batch))

		for j, node := range batch {
			copySlice[j] = []interface{}{
				node.VolumeID,
				node.ParentDirID,
				node.Name,
				node.FullPath,
				node.Depth,
				node.LatestSizeBytes,
				node.LatestFileCount,
			}
		}

		_, err := s.pool.CopyFrom(ctx, pgx.Identifier{"dir_nodes"}, []string{
			"volume_id", "parent_dir_id", "name", "full_path", "depth",
			"latest_size_bytes", "latest_file_count",
		}, pgx.CopyFromRows(copySlice))

		if err != nil {
			return fmt.Errorf("failed to bulk insert dir nodes batch %d-%d: %w", i, end, err)
		}
	}

	return nil
}

func (s *PostgresStore) BulkInsertDirRollups(ctx context.Context, rollups []*DirRollup, params BulkInsertParams) error {
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
		copySlice := make([][]interface{}, len(batch))

		for j, rollup := range batch {
			copySlice[j] = []interface{}{
				rollup.DirID,
				rollup.SizeBytes,
				rollup.FileCount,
				rollup.ComputedAt,
			}
		}

		_, err := s.pool.CopyFrom(ctx, pgx.Identifier{"dir_rollups"}, []string{
			"dir_id", "size_bytes", "file_count", "computed_at",
		}, pgx.CopyFromRows(copySlice))

		if err != nil {
			return fmt.Errorf("failed to bulk insert dir rollups batch %d-%d: %w", i, end, err)
		}
	}

	return nil
}

// Helper functions for type conversion between store types and postgres types

func toPostgresInt8(val *int64) pgtype.Int8 {
	if val == nil {
		return pgtype.Int8{Valid: false}
	}
	return pgtype.Int8{Int64: *val, Valid: true}
}

func toPostgresInt4(val *int32) pgtype.Int4 {
	if val == nil {
		return pgtype.Int4{Valid: false}
	}
	return pgtype.Int4{Int32: *val, Valid: true}
}

func fromPostgresInt8(val pgtype.Int8) *int64 {
	if !val.Valid {
		return nil
	}
	return &val.Int64
}

func fromPostgresInt4(val pgtype.Int4) *int32 {
	if !val.Valid {
		return nil
	}
	return &val.Int32
}

func fromPostgresFileEntry(dbEntry postgres.FileEntries) *FileEntry {
	return &FileEntry{
		ID:          dbEntry.ID,
		VolumeID:    dbEntry.VolumeID,
		ParentDirID: fromPostgresInt8(dbEntry.ParentDirID),
		Name:        dbEntry.Name,
		SizeBytes:   dbEntry.SizeBytes,
		Mtime:       dbEntry.Mtime,
		Ctime:       dbEntry.Ctime,
		Inode:       fromPostgresInt8(dbEntry.Inode),
		UID:         fromPostgresInt4(dbEntry.Uid),
		GID:         fromPostgresInt4(dbEntry.Gid),
		Type:        dbEntry.Type,
		Hidden:      dbEntry.Hidden,
		PathHash:    dbEntry.PathHash,
		CreatedAt:   dbEntry.CreatedAt,
		UpdatedAt:   dbEntry.UpdatedAt,
	}
}

func fromPostgresDirNode(dbNode postgres.DirNodes) *DirNode {
	return &DirNode{
		ID:              dbNode.ID,
		VolumeID:        dbNode.VolumeID,
		ParentDirID:     fromPostgresInt8(dbNode.ParentDirID),
		Name:            dbNode.Name,
		FullPath:        dbNode.FullPath,
		Depth:           dbNode.Depth,
		LatestSizeBytes: dbNode.LatestSizeBytes,
		LatestFileCount: dbNode.LatestFileCount,
		CreatedAt:       dbNode.CreatedAt,
		UpdatedAt:       dbNode.UpdatedAt,
	}
}

func fromPostgresDirRollup(dbRollup postgres.DirRollups) *DirRollup {
	return &DirRollup{
		ID:         dbRollup.ID,
		DirID:      dbRollup.DirID,
		SizeBytes:  dbRollup.SizeBytes,
		FileCount:  dbRollup.FileCount,
		ComputedAt: dbRollup.ComputedAt,
		CreatedAt:  dbRollup.CreatedAt,
	}
}

func fromPostgresGetDirectoryTreeRow(dbRow postgres.GetDirectoryTreeRow) *DirNode {
	return &DirNode{
		ID:              dbRow.ID,
		VolumeID:        dbRow.VolumeID,
		ParentDirID:     fromPostgresInt8(dbRow.ParentDirID),
		Name:            dbRow.Name,
		FullPath:        dbRow.FullPath,
		Depth:           dbRow.Depth,
		LatestSizeBytes: dbRow.LatestSizeBytes,
		LatestFileCount: dbRow.LatestFileCount,
		CreatedAt:       dbRow.CreatedAt,
		UpdatedAt:       dbRow.UpdatedAt,
	}
}

// Usage Snapshots Methods

func (s *PostgresStore) CreateUsageSnapshot(ctx context.Context, params CreateUsageSnapshotParams) (*UsageSnapshot, error) {
	pgParams := postgres.CreateUsageSnapshotParams{
		VolumeID:              params.VolumeID,
		SnapshotDate:          params.SnapshotDate,
		SnapshotType:          params.SnapshotType,
		TotalSize:             params.TotalSize,
		FileCount:             params.FileCount,
		DirectoryCount:        params.DirectoryCount,
		LargestFile:           params.LargestFile,
		GrowthBytes:           toPostgresInt8(&params.GrowthBytes),
		GrowthFiles:           toPostgresInt8(&params.GrowthFiles),
		GrowthRateBytesPerDay: toPostgresFloat8(&params.GrowthRateBytesPerDay),
		ScanMethod:            params.ScanMethod,
		ScanDurationMs:        toPostgresInt8(&params.ScanDurationMs),
	}

	dbSnapshot, err := s.queries.CreateUsageSnapshot(ctx, pgParams)
	if err != nil {
		return nil, fmt.Errorf("failed to create usage snapshot: %w", err)
	}

	return fromPostgresUsageSnapshot(dbSnapshot), nil
}

func (s *PostgresStore) GetLatestSnapshot(ctx context.Context, volumeID, snapshotType string) (*UsageSnapshot, error) {
	params := postgres.GetLatestSnapshotParams{
		VolumeID:     volumeID,
		SnapshotType: snapshotType,
	}

	dbSnapshot, err := s.queries.GetLatestSnapshot(ctx, params)
	if err != nil {
		return nil, fmt.Errorf("failed to get latest snapshot: %w", err)
	}

	return fromPostgresUsageSnapshot(dbSnapshot), nil
}

func (s *PostgresStore) Get7DayTrend(ctx context.Context, volumeID string) (*TrendData, error) {
	row, err := s.queries.Get7DayTrend(ctx, volumeID)
	if err != nil {
		return nil, fmt.Errorf("failed to get 7-day trend: %w", err)
	}

	return &TrendData{
		AvgGrowthRate: postgresFromInterfaceToFloat64(row.AvgGrowthRate),
		TotalGrowth:   postgresFromInterfaceToInt64(row.TotalGrowth),
		DataPoints:    row.DataPoints,
		PeriodStart:   fromInterfaceToTimePtr(row.PeriodStart),
		PeriodEnd:     fromInterfaceToTimePtr(row.PeriodEnd),
	}, nil
}

func (s *PostgresStore) Get30DayTrend(ctx context.Context, volumeID string) (*TrendData, error) {
	row, err := s.queries.Get30DayTrend(ctx, volumeID)
	if err != nil {
		return nil, fmt.Errorf("failed to get 30-day trend: %w", err)
	}

	return &TrendData{
		AvgGrowthRate: postgresFromInterfaceToFloat64(row.AvgGrowthRate),
		TotalGrowth:   postgresFromInterfaceToInt64(row.TotalGrowth),
		DataPoints:    row.DataPoints,
		PeriodStart:   fromInterfaceToTimePtr(row.PeriodStart),
		PeriodEnd:     fromInterfaceToTimePtr(row.PeriodEnd),
	}, nil
}

func (s *PostgresStore) GetGrowthDeltas(ctx context.Context, params GetGrowthDeltasParams) (*GrowthDeltasResult, error) {
	pgParams := postgres.GetGrowthDeltasParams{
		VolumeID:     params.VolumeID,
		SnapshotType: params.SnapshotType,
		Limit:        params.Limit,
	}

	row, err := s.queries.GetGrowthDeltas(ctx, pgParams)
	if err != nil {
		return nil, fmt.Errorf("failed to get growth deltas: %w", err)
	}

	return &GrowthDeltasResult{
		TotalSizeChange:      postgresFromInterfaceToInt64(row.TotalSizeChange),
		TotalFilesChange:     postgresFromInterfaceToInt64(row.TotalFilesChange),
		AvgSizeChangePerDay:  postgresFromInterfaceToFloat64(row.AvgSizeChangePerDay),
		AvgFilesChangePerDay: postgresFromInterfaceToFloat64(row.AvgFilesChangePerDay),
		SnapshotCount:        row.SnapshotCount,
		PeriodStart:          fromInterfaceToTimePtr(row.PeriodStart),
		PeriodEnd:            fromInterfaceToTimePtr(row.PeriodEnd),
	}, nil
}

func (s *PostgresStore) GetVolumeStepSeries(ctx context.Context, params GetVolumeStepSeriesParams) ([]*StepSeriesPoint, error) {
	pgParams := postgres.GetVolumeStepSeriesParams{
		VolumeID:     params.VolumeID,
		SnapshotType: params.SnapshotType,
		SnapshotDate: params.Date,
	}

	rows, err := s.queries.GetVolumeStepSeries(ctx, pgParams)
	if err != nil {
		return nil, fmt.Errorf("failed to get volume step series: %w", err)
	}

	result := make([]*StepSeriesPoint, len(rows))
	for i, row := range rows {
		result[i] = &StepSeriesPoint{
			Date:       row.Date,
			TotalSize:  row.TotalSize,
			FileCount:  row.FileCount,
			GrowthRate: fromPostgresFloat8(row.GrowthRate),
		}
	}

	return result, nil
}

// Volume operations
func (s *PostgresStore) UpsertVolume(ctx context.Context, volume *Volume) error {
	// Convert labels and options to JSON
	var labelsJSON, optionsJSON []byte
	var err error
	if volume.Labels != nil {
		labelsJSON, err = jsonMarshal(volume.Labels)
		if err != nil {
			return fmt.Errorf("failed to marshal labels: %w", err)
		}
	}
	if volume.Options != nil {
		optionsJSON, err = jsonMarshal(volume.Options)
		if err != nil {
			return fmt.Errorf("failed to marshal options: %w", err)
		}
	}

	// Use generated SQLC method (assuming we have one)
	params := postgres.UpsertVolumeParams{
		VolumeID:   volume.VolumeID,
		Name:       volume.Name,
		Driver:     volume.Driver,
		Mountpoint: volume.Mountpoint,
		Labels:     labelsJSON,
		Options:    optionsJSON,
		Scope:      pgtype.Text{String: volume.Scope, Valid: volume.Scope != ""},
		Status:     pgtype.Text{String: volume.Status, Valid: volume.Status != ""},
		IsActive:   pgtype.Bool{Bool: volume.IsActive, Valid: true},
	}
	
	_, err = s.queries.UpsertVolume(ctx, params)
	return err
}

func (s *PostgresStore) DeleteVolume(ctx context.Context, volumeID string) error {
	// Use SoftDeleteVolume to mark as inactive - we need to get the volume ID first
	vol, err := s.queries.GetVolumeByVolumeID(ctx, volumeID)
	if err != nil {
		return err
	}
	return s.queries.SoftDeleteVolume(ctx, vol.ID)
}

func (s *PostgresStore) GetVolumeByName(ctx context.Context, name string) (*Volume, error) {
	vol, err := s.queries.GetVolumeByVolumeID(ctx, name)
	if err != nil {
		return nil, err
	}
	return s.convertPostgresVolume(&vol), nil
}

func (s *PostgresStore) ListAllVolumes(ctx context.Context) ([]*Volume, error) {
	// Use ListVolumes with a large limit to get all volumes
	vols, err := s.queries.ListVolumes(ctx, postgres.ListVolumesParams{
		Limit:  10000, // Large limit to get all volumes
		Offset: 0,
	})
	if err != nil {
		return nil, err
	}
	
	result := make([]*Volume, len(vols))
	for i, vol := range vols {
		result[i] = s.convertPostgresVolume(&vol)
	}
	return result, nil
}

// Container operations  
// TODO: Add container queries to sqlc
func (s *PostgresStore) UpsertContainer(ctx context.Context, container *Container) error {
	// Placeholder implementation until queries are added
	return nil
}

func (s *PostgresStore) DeleteContainer(ctx context.Context, containerID string) error {
	// Placeholder implementation until queries are added
	return nil
}

func (s *PostgresStore) GetContainerByID(ctx context.Context, containerID string) (*Container, error) {
	// Placeholder implementation until queries are added
	return nil, nil
}

func (s *PostgresStore) ListAllContainers(ctx context.Context) ([]*Container, error) {
	// Placeholder implementation until queries are added
	return []*Container{}, nil
}

// Volume mount operations
func (s *PostgresStore) UpsertVolumeMount(ctx context.Context, mount *VolumeMount) error {
	// Placeholder implementation until queries are added
	return nil
}

func (s *PostgresStore) DeleteVolumeMount(ctx context.Context, volumeID, containerID string) error {
	// Placeholder implementation until queries are added
	return nil
}

func (s *PostgresStore) GetVolumeMountsByContainer(ctx context.Context, containerID string) ([]*VolumeMount, error) {
	// Placeholder implementation until queries are added
	return []*VolumeMount{}, nil
}

func (s *PostgresStore) GetVolumeMountsByVolume(ctx context.Context, volumeID string) ([]*VolumeMount, error) {
	// Placeholder implementation until queries are added
	return []*VolumeMount{}, nil
}

func (s *PostgresStore) DeactivateVolumeMounts(ctx context.Context, containerID string) error {
	// Placeholder implementation until queries are added
	return nil
}

func (s *PostgresStore) ListAllVolumeMounts(ctx context.Context) ([]*VolumeMount, error) {
	// Placeholder implementation until queries are added
	return []*VolumeMount{}, nil
}

// Conversion helpers
func (s *PostgresStore) convertPostgresVolume(vol *postgres.Volumes) *Volume {
	labels := make(map[string]string)
	options := make(map[string]string)
	
	if vol.Labels != nil {
		jsonUnmarshal(vol.Labels, &labels)
	}
	if vol.Options != nil {
		jsonUnmarshal(vol.Options, &options)
	}
	
	return &Volume{
		ID:         int64(vol.ID),
		VolumeID:   vol.VolumeID,
		Name:       vol.Name,
		Driver:     vol.Driver,
		Mountpoint: vol.Mountpoint,
		Labels:     labels,
		Options:    options,
		Scope:      vol.Scope.String,
		Status:     vol.Status.String,
		IsActive:   vol.IsActive.Bool,
		CreatedAt:  vol.CreatedAt,
		UpdatedAt:  vol.UpdatedAt,
	}
}

func (s *PostgresStore) convertPostgresContainer(cont *postgres.Containers) *Container {
	labels := make(map[string]string)
	if cont.Labels != nil {
		jsonUnmarshal(cont.Labels, &labels)
	}
	
	var startedAt, finishedAt *time.Time
	if cont.StartedAt.Valid {
		startedAt = &cont.StartedAt.Time
	}
	if cont.FinishedAt.Valid {
		finishedAt = &cont.FinishedAt.Time
	}
	
	return &Container{
		ID:          int64(cont.ID),
		ContainerID: cont.ContainerID,
		Name:        cont.Name,
		Image:       cont.Image,
		State:       cont.State,
		Status:      cont.Status.String,
		Labels:      labels,
		StartedAt:   startedAt,
		FinishedAt:  finishedAt,
		IsActive:    cont.IsActive.Bool,
		CreatedAt:   cont.CreatedAt,
		UpdatedAt:   cont.UpdatedAt,
	}
}

func (s *PostgresStore) convertPostgresVolumeMount(mount *postgres.VolumeMounts) *VolumeMount {
	return &VolumeMount{
		ID:          int64(mount.ID),
		VolumeID:    mount.VolumeID,
		ContainerID: mount.ContainerID,
		MountPath:   mount.MountPath,
		AccessMode:  mount.AccessMode,
		IsActive:    mount.IsActive.Bool,
		CreatedAt:   mount.CreatedAt,
		UpdatedAt:   mount.UpdatedAt,
	}
}

func timeToPgTimestamptz(t *time.Time) pgtype.Timestamptz {
	if t == nil {
		return pgtype.Timestamptz{Valid: false}
	}
	return pgtype.Timestamptz{Time: *t, Valid: true}
}

// Helper functions

func (s *PostgresStore) GetTrendSlope(ctx context.Context, params GetTrendSlopeParams) (*TrendSlopeResult, error) {
	pgParams := postgres.GetTrendSlopeParams{
		VolumeID:     params.VolumeID,
		SnapshotType: params.SnapshotType,
		SnapshotDate: params.Date,
	}

	row, err := s.queries.GetTrendSlope(ctx, pgParams)
	if err != nil {
		return nil, fmt.Errorf("failed to get trend slope: %w", err)
	}

	return &TrendSlopeResult{
		Slope:      postgresFromInterfaceToFloat64(row.Slope),
		DataPoints: row.DataPoints,
	}, nil
}

// Rollup computes directory rollups for a volume (stub implementation)
// TODO: Integrate with existing rollup_service.go implementation
func (s *PostgresStore) Rollup(ctx context.Context, volumeID string, opts *RollupOptions) (*RollupResult, error) {
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

// Transaction management implementation for PostgresStore

// Tx executes a function within a database transaction with automatic rollback/commit
func (s *PostgresStore) Tx(ctx context.Context, fn TxFunc) error {
	return s.TxWithTimeout(ctx, 30*time.Second, fn)
}

// TxWithTimeout executes a transaction with a specific timeout
func (s *PostgresStore) TxWithTimeout(ctx context.Context, timeout time.Duration, fn TxFunc) error {
	// Create context with timeout for the entire transaction
	txCtx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()

	// Begin transaction
	tx, err := s.pool.Begin(txCtx)
	if err != nil {
		return fmt.Errorf("failed to begin PostgreSQL transaction: %w", err)
	}

	// Create a new PostgresStore instance that uses the transaction
	txStore := &PostgresStore{
		pool:    nil, // Don't use pool for transaction operations
		queries: s.queries.WithTx(tx),
	}

	// Track completion status to avoid double rollback/commit
	var committed bool
	defer func() {
		if !committed {
			if rollbackErr := tx.Rollback(context.Background()); rollbackErr != nil {
				// Log rollback error but don't overwrite original error
				fmt.Printf("[WARN] PostgreSQL transaction rollback failed: %v (original error: %v)\n", rollbackErr, err)
			}
		}
	}()

	// Execute the transaction function
	if err = fn(txCtx, txStore); err != nil {
		return fmt.Errorf("PostgreSQL transaction function failed: %w", err)
	}

	// Commit the transaction
	if err = tx.Commit(txCtx); err != nil {
		return fmt.Errorf("failed to commit PostgreSQL transaction: %w", err)
	}

	committed = true
	return nil
}

// ReadOnlyTx executes a read-only transaction
func (s *PostgresStore) ReadOnlyTx(ctx context.Context, fn TxFunc) error {
	return s.TxWithTimeout(ctx, 15*time.Second, fn)
}

// FastTx executes a transaction with a shorter timeout for simple operations
func (s *PostgresStore) FastTx(ctx context.Context, fn TxFunc) error {
	return s.TxWithTimeout(ctx, 5*time.Second, fn)
}

// BulkTx executes a transaction with a longer timeout for bulk operations
func (s *PostgresStore) BulkTx(ctx context.Context, fn TxFunc) error {
	return s.TxWithTimeout(ctx, 5*time.Minute, fn)
}

// Helper functions for converting between postgres and store types

func fromPostgresUsageSnapshot(dbSnapshot postgres.UsageSnapshots) *UsageSnapshot {
	return &UsageSnapshot{
		ID:                    dbSnapshot.ID,
		VolumeID:              dbSnapshot.VolumeID,
		SnapshotDate:          dbSnapshot.SnapshotDate,
		SnapshotType:          dbSnapshot.SnapshotType,
		TotalSize:             dbSnapshot.TotalSize,
		FileCount:             dbSnapshot.FileCount,
		DirectoryCount:        dbSnapshot.DirectoryCount,
		LargestFile:           dbSnapshot.LargestFile,
		GrowthBytes:           fromPostgresInt8ToInt64(dbSnapshot.GrowthBytes),
		GrowthFiles:           fromPostgresInt8ToInt64(dbSnapshot.GrowthFiles),
		GrowthRateBytesPerDay: fromPostgresFloat8(dbSnapshot.GrowthRateBytesPerDay),
		ScanMethod:            dbSnapshot.ScanMethod,
		ScanDurationMs:        fromPostgresInt8ToInt64(dbSnapshot.ScanDurationMs),
		CreatedAt:             dbSnapshot.CreatedAt,
		UpdatedAt:             dbSnapshot.UpdatedAt,
	}
}

func toPostgresFloat8(val *float64) pgtype.Float8 {
	if val == nil {
		return pgtype.Float8{}
	}
	return pgtype.Float8{Float64: *val, Valid: true}
}

func fromPostgresFloat8(val pgtype.Float8) float64 {
	if !val.Valid {
		return 0
	}
	return val.Float64
}

func fromPostgresInt8ToInt64(val pgtype.Int8) int64 {
	if !val.Valid {
		return 0
	}
	return val.Int64
}

func postgresFromInterfaceToFloat64(val interface{}) float64 {
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

func postgresFromInterfaceToInt64(val interface{}) int64 {
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

func fromInterfaceToTimePtr(val interface{}) *time.Time {
	if val == nil {
		return nil
	}
	switch v := val.(type) {
	case time.Time:
		return &v
	default:
		return nil
	}
}

// GetFacade returns the store facade for legacy compatibility
func (s *PostgresStore) GetFacade() *StoreFacade {
	return s.facade
}
