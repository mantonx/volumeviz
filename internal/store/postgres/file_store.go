package postgres

import (
	"context"
	"fmt"

	"github.com/mantonx/volumeviz/internal/store/generated/postgres"
	"github.com/mantonx/volumeviz/internal/store/interfaces"
	"github.com/mantonx/volumeviz/internal/store/models"
)

// PostgresFileStore implements FileStore interface for PostgreSQL
type PostgresFileStore struct {
	*PostgresInfrastructureStore
}

// NewPostgresFileStore creates a new PostgreSQL file store
func NewPostgresFileStore(infra *PostgresInfrastructureStore) interfaces.FileStore {
	return &PostgresFileStore{
		PostgresInfrastructureStore: infra,
	}
}

// CreateFileEntry creates a new file entry in the database
func (s *PostgresFileStore) CreateFileEntry(ctx context.Context, entry *models.FileEntry) (*models.FileEntry, error) {
	params := toPostgresCreateFileEntryParams(entry)
	
	row, err := s.queries.CreateFileEntry(ctx, params)
	if err != nil {
		return nil, fmt.Errorf("failed to create file entry: %w", err)
	}

	return fromPostgresFileEntry(&row), nil
}

// GetFileEntry retrieves a file entry by ID and volume ID
func (s *PostgresFileStore) GetFileEntry(ctx context.Context, id int64, volumeID string) (*models.FileEntry, error) {
	row, err := s.queries.GetFileEntry(ctx, postgres.GetFileEntryParams{
		ID:       id,
		VolumeID: volumeID,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to get file entry: %w", err)
	}

	return fromPostgresFileEntry(&row), nil
}

// GetFileEntriesByVolumeAndParent retrieves file entries by volume and parent directory
func (s *PostgresFileStore) GetFileEntriesByVolumeAndParent(ctx context.Context, volumeID string, parentDirID *int64) ([]*models.FileEntry, error) {
	params := postgres.GetFileEntriesByVolumeAndParentParams{
		VolumeID:    volumeID,
		ParentDirID: nullInt64FromInt64Ptr(parentDirID),
	}

	rows, err := s.queries.GetFileEntriesByVolumeAndParent(ctx, params)
	if err != nil {
		return nil, fmt.Errorf("failed to get file entries by volume and parent: %w", err)
	}

	entries := make([]*models.FileEntry, len(rows))
	for i, row := range rows {
		entries[i] = fromPostgresFileEntry(&row)
	}

	return entries, nil
}

// GetLargestFiles retrieves the largest files in a volume
func (s *PostgresFileStore) GetLargestFiles(ctx context.Context, volumeID string, limit int32) ([]*models.FileEntry, error) {
	rows, err := s.queries.GetLargestFiles(ctx, postgres.GetLargestFilesParams{
		VolumeID: volumeID,
		Limit:    limit,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to get largest files: %w", err)
	}

	entries := make([]*models.FileEntry, len(rows))
	for i, row := range rows {
		entries[i] = fromPostgresFileEntry(&row)
	}

	return entries, nil
}

// FindFilesByPathHash finds files by path hash
func (s *PostgresFileStore) FindFilesByPathHash(ctx context.Context, volumeID string, pathHash []byte) ([]*models.FileEntry, error) {
	rows, err := s.queries.FindFilesByPathHash(ctx, postgres.FindFilesByPathHashParams{
		VolumeID: volumeID,
		PathHash: pathHash,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to find files by path hash: %w", err)
	}

	entries := make([]*models.FileEntry, len(rows))
	for i, row := range rows {
		entries[i] = fromPostgresFileEntry(&row)
	}

	return entries, nil
}

// UpsertFileEntry creates or updates a file entry
func (s *PostgresFileStore) UpsertFileEntry(ctx context.Context, entry *models.FileEntry) (*models.FileEntry, error) {
	params := postgres.UpsertFileEntryParams{
		VolumeID:    entry.VolumeID,
		Name:        entry.Name,
		ParentDirID: nullInt64FromInt64Ptr(entry.ParentDirID),
		Type:        entry.Type,
		SizeBytes:   entry.SizeBytes,
		Mtime:       entry.Mtime,
		Ctime:       entry.Ctime,
		Inode:       nullInt64FromInt64Ptr(entry.Inode),
		Uid:         nullInt32FromInt32Ptr(entry.UID),
		Gid:         nullInt32FromInt32Ptr(entry.GID),
		PathHash:    entry.PathHash,
		Hidden:      entry.Hidden,
	}

	row, err := s.queries.UpsertFileEntry(ctx, params)
	if err != nil {
		return nil, fmt.Errorf("failed to upsert file entry: %w", err)
	}

	return fromPostgresFileEntry(&row), nil
}

// DeleteFileEntriesByVolume deletes all file entries for a volume
func (s *PostgresFileStore) DeleteFileEntriesByVolume(ctx context.Context, volumeID string) error {
	err := s.queries.DeleteFileEntriesByVolume(ctx, volumeID)
	if err != nil {
		return fmt.Errorf("failed to delete file entries by volume: %w", err)
	}
	return nil
}

// CountFileEntriesByVolume counts file entries in a volume
func (s *PostgresFileStore) CountFileEntriesByVolume(ctx context.Context, volumeID string) (int64, error) {
	count, err := s.queries.CountFileEntriesByVolume(ctx, volumeID)
	if err != nil {
		return 0, fmt.Errorf("failed to count file entries by volume: %w", err)
	}
	return count, nil
}

// GetVolumeFileStats gets file statistics for a volume
func (s *PostgresFileStore) GetVolumeFileStats(ctx context.Context, volumeID string) (*models.VolumeFileStats, error) {
	row, err := s.queries.GetVolumeFileStats(ctx, volumeID)
	if err != nil {
		return nil, fmt.Errorf("failed to get volume file stats: %w", err)
	}

	// Convert interface{} TotalSize to int64
	totalSize := int64(0)
	if row.TotalSize != nil {
		if val, ok := row.TotalSize.(int64); ok {
			totalSize = val
		}
	}

	return &models.VolumeFileStats{
		TotalFiles:   row.TotalFiles,
		TotalSize:    totalSize,
		RegularFiles: row.RegularFiles,
		Directories:  row.Directories,
		HiddenFiles:  row.HiddenFiles,
	}, nil
}

// BulkInsertFileEntries performs bulk insertion of file entries
func (s *PostgresFileStore) BulkInsertFileEntries(ctx context.Context, entries []*models.FileEntry, params models.BulkInsertParams) error {
	// Convert to PostgreSQL batch insert format
	var bulkParams []postgres.BulkInsertFileEntriesParams
	for _, entry := range entries {
		bulkParams = append(bulkParams, postgres.BulkInsertFileEntriesParams{
			VolumeID:    entry.VolumeID,
			Name:        entry.Name,
			ParentDirID: nullInt64FromInt64Ptr(entry.ParentDirID),
			Type:        entry.Type,
			SizeBytes:   entry.SizeBytes,
			Mtime:       entry.Mtime,
			Ctime:       entry.Ctime,
			Inode:       nullInt64FromInt64Ptr(entry.Inode),
			Uid:         nullInt32FromInt32Ptr(entry.UID),
			Gid:         nullInt32FromInt32Ptr(entry.GID),
			PathHash:    entry.PathHash,
			Hidden:      entry.Hidden,
		})
	}

	// Execute bulk insert
	_, err := s.queries.BulkInsertFileEntries(ctx, bulkParams)
	if err != nil {
		return fmt.Errorf("failed to bulk insert file entries: %w", err)
	}

	return nil
}