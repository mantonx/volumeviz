package sqlite

import (
	"context"
	"fmt"
	"time"

	sqlite "github.com/mantonx/volumeviz/internal/store/generated/sqlite"
	"github.com/mantonx/volumeviz/internal/store/interfaces"
	"github.com/mantonx/volumeviz/internal/store/models"
)

// SQLiteFileStore implements FileStore interface using SQLite
type SQLiteFileStore struct {
	infraStore *SQLiteInfrastructureStore
}

// NewSQLiteFileStore creates a new SQLite file store
func NewSQLiteFileStore(infraStore *SQLiteInfrastructureStore) interfaces.FileStore {
	return &SQLiteFileStore{
		infraStore: infraStore,
	}
}

// CreateFileEntry creates a new file entry
func (s *SQLiteFileStore) CreateFileEntry(ctx context.Context, entry *models.FileEntry) (*models.FileEntry, error) {
	dbEntry, err := s.infraStore.GetQueries().CreateFileEntry(ctx, sqlite.CreateFileEntryParams{
		VolumeID:    entry.VolumeID,
		ParentDirID: toSQLiteInt64(entry.ParentDirID),
		Name:        entry.Name,
		SizeBytes:   entry.SizeBytes,
		Mtime:       entry.Mtime.Format(time.RFC3339),
		Ctime:       entry.Ctime.Format(time.RFC3339),
		Inode:       toSQLiteInt64(entry.Inode),
		Uid:         toSQLiteInt64(int32PtrToInt64Ptr(entry.UID)),
		Gid:         toSQLiteInt64(int32PtrToInt64Ptr(entry.GID)),
		Type:        entry.Type,
		Hidden:      boolToSQLiteInt(entry.Hidden),
		PathHash:    entry.PathHash,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to create file entry: %w", err)
	}
	return fromSQLiteFileEntry(dbEntry)
}

// GetFileEntry retrieves a file entry by ID and volume ID
func (s *SQLiteFileStore) GetFileEntry(ctx context.Context, id int64, volumeID string) (*models.FileEntry, error) {
	dbEntry, err := s.infraStore.GetQueries().GetFileEntry(ctx, sqlite.GetFileEntryParams{
		ID:       id,
		VolumeID: volumeID,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to get file entry: %w", err)
	}
	return fromSQLiteFileEntry(dbEntry)
}

// UpsertFileEntry creates or updates a file entry
func (s *SQLiteFileStore) UpsertFileEntry(ctx context.Context, entry *models.FileEntry) (*models.FileEntry, error) {
	dbEntry, err := s.infraStore.GetQueries().UpsertFileEntry(ctx, sqlite.UpsertFileEntryParams{
		VolumeID:    entry.VolumeID,
		ParentDirID: toSQLiteInt64(entry.ParentDirID),
		Name:        entry.Name,
		SizeBytes:   entry.SizeBytes,
		Mtime:       entry.Mtime.Format(time.RFC3339),
		Ctime:       entry.Ctime.Format(time.RFC3339),
		Inode:       toSQLiteInt64(entry.Inode),
		Uid:         toSQLiteInt64(int32PtrToInt64Ptr(entry.UID)),
		Gid:         toSQLiteInt64(int32PtrToInt64Ptr(entry.GID)),
		Type:        entry.Type,
		Hidden:      boolToSQLiteInt(entry.Hidden),
		PathHash:    entry.PathHash,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to upsert file entry: %w", err)
	}
	return fromSQLiteFileEntry(dbEntry)
}

// GetFileEntriesByVolumeAndParent retrieves file entries by volume and parent directory
func (s *SQLiteFileStore) GetFileEntriesByVolumeAndParent(ctx context.Context, volumeID string, parentDirID *int64) ([]*models.FileEntry, error) {
	dbEntries, err := s.infraStore.GetQueries().GetFileEntriesByVolumeAndParent(ctx, sqlite.GetFileEntriesByVolumeAndParentParams{
		VolumeID:    volumeID,
		ParentDirID: toSQLiteInt64(parentDirID),
	})
	if err != nil {
		return nil, fmt.Errorf("failed to get file entries: %w", err)
	}

	entries := make([]*models.FileEntry, len(dbEntries))
	for i, dbEntry := range dbEntries {
		entry, err := fromSQLiteFileEntry(dbEntry)
		if err != nil {
			return nil, err
		}
		entries[i] = entry
	}
	return entries, nil
}

// GetLargestFiles retrieves the largest files in a volume
func (s *SQLiteFileStore) GetLargestFiles(ctx context.Context, volumeID string, limit int32) ([]*models.FileEntry, error) {
	dbEntries, err := s.infraStore.GetQueries().GetLargestFiles(ctx, sqlite.GetLargestFilesParams{
		VolumeID: volumeID,
		Limit:    int64(limit),
	})
	if err != nil {
		return nil, fmt.Errorf("failed to get largest files: %w", err)
	}

	entries := make([]*models.FileEntry, len(dbEntries))
	for i, dbEntry := range dbEntries {
		entry, err := fromSQLiteFileEntry(dbEntry)
		if err != nil {
			return nil, err
		}
		entries[i] = entry
	}
	return entries, nil
}

// FindFilesByPathHash finds files by their path hash
func (s *SQLiteFileStore) FindFilesByPathHash(ctx context.Context, volumeID string, pathHash []byte) ([]*models.FileEntry, error) {
	dbEntries, err := s.infraStore.GetQueries().FindFilesByPathHash(ctx, sqlite.FindFilesByPathHashParams{
		VolumeID: volumeID,
		PathHash: pathHash,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to find files by path hash: %w", err)
	}

	entries := make([]*models.FileEntry, len(dbEntries))
	for i, dbEntry := range dbEntries {
		entry, err := fromSQLiteFileEntry(dbEntry)
		if err != nil {
			return nil, err
		}
		entries[i] = entry
	}
	return entries, nil
}

// BulkInsertFileEntries performs bulk insertion of file entries
func (s *SQLiteFileStore) BulkInsertFileEntries(ctx context.Context, entries []*models.FileEntry, params interfaces.BulkInsertParams) error {
	if len(entries) == 0 {
		return nil
	}

	chunkSize := defaultChunkSize()
	if params.BatchSize > 0 {
		chunkSize = params.BatchSize
	}

	chunks := chunkSlice(entries, chunkSize)
	for _, chunk := range chunks {
		if err := s.executeBatchInsertFileEntries(ctx, chunk); err != nil {
			return fmt.Errorf("failed to execute batch insert: %w", err)
		}
	}

	return nil
}

// DeleteFileEntriesByVolume deletes all file entries for a volume
func (s *SQLiteFileStore) DeleteFileEntriesByVolume(ctx context.Context, volumeID string) error {
	err := s.infraStore.GetQueries().DeleteFileEntriesByVolume(ctx, volumeID)
	if err != nil {
		return fmt.Errorf("failed to delete file entries by volume: %w", err)
	}
	return nil
}

// CountFileEntriesByVolume counts file entries in a volume
func (s *SQLiteFileStore) CountFileEntriesByVolume(ctx context.Context, volumeID string) (int64, error) {
	count, err := s.infraStore.GetQueries().CountFileEntriesByVolume(ctx, volumeID)
	if err != nil {
		return 0, fmt.Errorf("failed to count file entries by volume: %w", err)
	}
	return count, nil
}

// GetVolumeFileStats retrieves file statistics for a volume
func (s *SQLiteFileStore) GetVolumeFileStats(ctx context.Context, volumeID string) (*models.VolumeFileStats, error) {
	stats, err := s.infraStore.GetQueries().GetVolumeFileStats(ctx, volumeID)
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

	return &models.VolumeFileStats{
		TotalFiles:   stats.TotalFiles,
		TotalSize:    totalSize,
		RegularFiles: stats.RegularFiles,
		Directories:  stats.Directories,
		HiddenFiles:  stats.HiddenFiles,
	}, nil
}

// executeBatchInsertFileEntries executes a batch insert for file entries
func (s *SQLiteFileStore) executeBatchInsertFileEntries(ctx context.Context, entries []*models.FileEntry) error {
	for _, entry := range entries {
		err := s.infraStore.GetQueries().BulkInsertFileEntry(ctx, sqlite.BulkInsertFileEntryParams{
			VolumeID:    entry.VolumeID,
			ParentDirID: toSQLiteInt64(entry.ParentDirID),
			Name:        entry.Name,
			SizeBytes:   entry.SizeBytes,
			Mtime:       entry.Mtime.Format(time.RFC3339),
			Ctime:       entry.Ctime.Format(time.RFC3339),
			Inode:       toSQLiteInt64(entry.Inode),
			Uid:         toSQLiteInt64(int32PtrToInt64Ptr(entry.UID)),
			Gid:         toSQLiteInt64(int32PtrToInt64Ptr(entry.GID)),
			Type:        entry.Type,
			Hidden:      boolToSQLiteInt(entry.Hidden),
			PathHash:    entry.PathHash,
		})
		if err != nil {
			return err
		}
	}
	return nil
}