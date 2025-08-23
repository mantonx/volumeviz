package repo

import (
	"context"
	"crypto/sha256"
	"path/filepath"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgtype"
	"github.com/mantonx/volumeviz/internal/db/sqlc"
	"github.com/mantonx/volumeviz/internal/models"
)

// FilesRepo handles file operations
type FilesRepo struct {
	db      sqlc.DBTX
	queries *sqlc.Queries
}

// NewFilesRepo creates a new files repository
func NewFilesRepo(db sqlc.DBTX) *FilesRepo {
	return &FilesRepo{
		db:      db,
		queries: sqlc.New(db),
	}
}

// CreateFile creates a new file record
func (r *FilesRepo) CreateFile(ctx context.Context, params models.CreateFileParams) (*models.File, error) {
	pathHash := sha256.Sum256([]byte(params.Path))

	result, err := r.queries.CreateFile(ctx, sqlc.CreateFileParams{
		FolderID:       params.FolderID,
		VolumeID:       params.VolumeID,
		Name:           params.Name,
		Path:           params.Path,
		Extension:      stringPtrToPgText(params.Extension),
		SizeBytes:      params.SizeBytes,
		DiskUsageBytes: params.DiskUsageBytes,
		Mtime:          timePtrToTime(params.Mtime),
		Ctime:          timePtrToTime(params.Ctime),
		Birthtime:      timePtrToPgTimestamp(params.Birthtime),
		Uid:            int32PtrToPgInt4(params.Uid),
		Gid:            int32PtrToPgInt4(params.Gid),
		Mode:           int32PtrToPgInt4(params.Mode),
		Inode:          int64PtrToPgInt8(params.Inode),
		Device:         stringPtrToPgText(params.Device),
		IsSymlink:      boolToPgBool(params.IsSymlink),
		SymlinkTarget:  stringPtrToPgText(params.SymlinkTarget),
		Mime:           stringPtrToPgText(params.Mime),
		MediaKind:      stringPtrToPgText(params.MediaKind),
		Encoding:       stringPtrToPgText(params.Encoding),
		HashAlgo:       stringPtrToPgText(params.HashAlgo),
		Hash:           params.Hash,
		PathHash:       pathHash[:],
	})
	if err != nil {
		return nil, err
	}

	return r.GetFileByID(ctx, result.ID)
}

// GetFileByID retrieves a file by ID
func (r *FilesRepo) GetFileByID(ctx context.Context, id int64) (*models.File, error) {
	file, err := r.queries.GetFileByID(ctx, id)
	if err != nil {
		return nil, err
	}

	return r.convertAnyFileRowToFile(file), nil
}

// GetFileByPath retrieves a file by volume ID and path
func (r *FilesRepo) GetFileByPath(ctx context.Context, volumeID, path string) (*models.File, error) {
	pathHash := sha256.Sum256([]byte(path))

	file, err := r.queries.GetFileByPath(ctx, sqlc.GetFileByPathParams{
		VolumeID: volumeID,
		PathHash: pathHash[:],
	})
	if err != nil {
		return nil, err
	}

	return r.convertAnyFileRowToFile(file), nil
}

// ListFilesByFolder lists files in a folder with pagination
func (r *FilesRepo) ListFilesByFolder(ctx context.Context, folderID int64, limit, offset int32) ([]*models.File, error) {
	files, err := r.queries.ListFilesByFolder(ctx, sqlc.ListFilesByFolderParams{
		FolderID: folderID,
		Limit:    limit,
		Offset:   offset,
	})
	if err != nil {
		return nil, err
	}

	result := make([]*models.File, len(files))
	for i, file := range files {
		result[i] = r.convertAnyFileRowToFile(file)
	}
	return result, nil
}

// ListFilesByVolume lists files in a volume with pagination
func (r *FilesRepo) ListFilesByVolume(ctx context.Context, volumeID string, limit, offset int32) ([]*models.File, error) {
	files, err := r.queries.ListFilesByVolume(ctx, sqlc.ListFilesByVolumeParams{
		VolumeID: volumeID,
		Limit:    limit,
		Offset:   offset,
	})
	if err != nil {
		return nil, err
	}

	result := make([]*models.File, len(files))
	for i, file := range files {
		result[i] = r.convertAnyFileRowToFile(file)
	}
	return result, nil
}

// GetLargestFiles gets files sorted by size
func (r *FilesRepo) GetLargestFiles(ctx context.Context, volumeID string, limit int32) ([]*models.File, error) {
	files, err := r.queries.GetLargestFiles(ctx, sqlc.GetLargestFilesParams{
		VolumeID: volumeID,
		Limit:    limit,
	})
	if err != nil {
		return nil, err
	}

	result := make([]*models.File, len(files))
	for i, file := range files {
		result[i] = r.convertAnyFileRowToFile(file)
	}
	return result, nil
}

// GetFilesByMediaKind gets files by media kind
func (r *FilesRepo) GetFilesByMediaKind(ctx context.Context, volumeID, mediaKind string, limit, offset int32) ([]*models.File, error) {
	files, err := r.queries.GetFilesByMediaKind(ctx, sqlc.GetFilesByMediaKindParams{
		VolumeID:  volumeID,
		MediaKind: stringPtrToPgText(&mediaKind),
		Limit:     limit,
		Offset:    offset,
	})
	if err != nil {
		return nil, err
	}

	result := make([]*models.File, len(files))
	for i, file := range files {
		result[i] = r.convertAnyFileRowToFile(file)
	}
	return result, nil
}

// GetFilesByExtension gets files by extension
func (r *FilesRepo) GetFilesByExtension(ctx context.Context, volumeID, extension string, limit, offset int32) ([]*models.File, error) {
	files, err := r.queries.GetFilesByExtension(ctx, sqlc.GetFilesByExtensionParams{
		VolumeID:  volumeID,
		Extension: stringPtrToPgText(&extension),
		Limit:     limit,
		Offset:    offset,
	})
	if err != nil {
		return nil, err
	}

	result := make([]*models.File, len(files))
	for i, file := range files {
		result[i] = r.convertAnyFileRowToFile(file)
	}
	return result, nil
}

// GetFilesByMimeType gets files by MIME type
func (r *FilesRepo) GetFilesByMimeType(ctx context.Context, volumeID, mimeType string, limit, offset int32) ([]*models.File, error) {
	files, err := r.queries.GetFilesByMimeType(ctx, sqlc.GetFilesByMimeTypeParams{
		VolumeID: volumeID,
		Mime:     stringPtrToPgText(&mimeType),
		Limit:    limit,
		Offset:   offset,
	})
	if err != nil {
		return nil, err
	}

	result := make([]*models.File, len(files))
	for i, file := range files {
		result[i] = r.convertAnyFileRowToFile(file)
	}
	return result, nil
}

// GetDuplicateFiles gets files with duplicate hashes
func (r *FilesRepo) GetDuplicateFiles(ctx context.Context, volumeID, hashAlgo string) ([]*models.File, error) {
	files, err := r.queries.GetDuplicateFiles(ctx, sqlc.GetDuplicateFilesParams{
		VolumeID: volumeID,
		HashAlgo: stringPtrToPgText(&hashAlgo),
	})
	if err != nil {
		return nil, err
	}

	result := make([]*models.File, len(files))
	for i, file := range files {
		result[i] = r.convertAnyFileRowToFile(file)
	}
	return result, nil
}

// GetRecentFiles gets recently modified files
func (r *FilesRepo) GetRecentFiles(ctx context.Context, volumeID string, since time.Time, limit int32) ([]*models.File, error) {
	files, err := r.queries.GetRecentFiles(ctx, sqlc.GetRecentFilesParams{
		VolumeID: volumeID,
		Mtime:    since,
		Limit:    limit,
	})
	if err != nil {
		return nil, err
	}

	result := make([]*models.File, len(files))
	for i, file := range files {
		result[i] = r.convertAnyFileRowToFile(file)
	}
	return result, nil
}

// GetFilesModifiedSince gets files modified since a specific time
func (r *FilesRepo) GetFilesModifiedSince(ctx context.Context, volumeID string, since time.Time) ([]*models.File, error) {
	files, err := r.queries.GetFilesModifiedSince(ctx, sqlc.GetFilesModifiedSinceParams{
		VolumeID: volumeID,
		Mtime:    since,
	})
	if err != nil {
		return nil, err
	}

	result := make([]*models.File, len(files))
	for i, file := range files {
		result[i] = r.convertAnyFileRowToFile(file)
	}
	return result, nil
}

// SearchFilesByName searches files by name pattern
func (r *FilesRepo) SearchFilesByName(ctx context.Context, volumeID, pattern string, limit int32) ([]*models.File, error) {
	files, err := r.queries.SearchFilesByName(ctx, sqlc.SearchFilesByNameParams{
		VolumeID: volumeID,
		Name:     pattern,
		Limit:    limit,
	})
	if err != nil {
		return nil, err
	}

	result := make([]*models.File, len(files))
	for i, file := range files {
		result[i] = r.convertAnyFileRowToFile(file)
	}
	return result, nil
}

// GetFilesBySize gets files within a size range
func (r *FilesRepo) GetFilesBySize(ctx context.Context, volumeID string, minSize, maxSize int64, limit int32) ([]*models.File, error) {
	files, err := r.queries.GetFilesBySize(ctx, sqlc.GetFilesBySizeParams{
		VolumeID:    volumeID,
		SizeBytes:   minSize,
		SizeBytes_2: maxSize,
		Limit:       limit,
	})
	if err != nil {
		return nil, err
	}

	result := make([]*models.File, len(files))
	for i, file := range files {
		result[i] = r.convertAnyFileRowToFile(file)
	}
	return result, nil
}

// UpsertFile creates or updates a file
func (r *FilesRepo) UpsertFile(ctx context.Context, params models.CreateFileParams) (*models.File, error) {
	pathHash := sha256.Sum256([]byte(params.Path))

	result, err := r.queries.UpsertFile(ctx, sqlc.UpsertFileParams{
		FolderID:       params.FolderID,
		VolumeID:       params.VolumeID,
		Name:           params.Name,
		Path:           params.Path,
		Extension:      stringPtrToPgText(params.Extension),
		SizeBytes:      params.SizeBytes,
		DiskUsageBytes: params.DiskUsageBytes,
		Mtime:          timePtrToTime(params.Mtime),
		Ctime:          timePtrToTime(params.Ctime),
		Birthtime:      timePtrToPgTimestamp(params.Birthtime),
		Uid:            int32PtrToPgInt4(params.Uid),
		Gid:            int32PtrToPgInt4(params.Gid),
		Mode:           int32PtrToPgInt4(params.Mode),
		Inode:          int64PtrToPgInt8(params.Inode),
		Device:         stringPtrToPgText(params.Device),
		IsSymlink:      boolToPgBool(params.IsSymlink),
		SymlinkTarget:  stringPtrToPgText(params.SymlinkTarget),
		Mime:           stringPtrToPgText(params.Mime),
		MediaKind:      stringPtrToPgText(params.MediaKind),
		Encoding:       stringPtrToPgText(params.Encoding),
		HashAlgo:       stringPtrToPgText(params.HashAlgo),
		Hash:           params.Hash,
		PathHash:       pathHash[:],
	})
	if err != nil {
		return nil, err
	}

	return r.GetFileByID(ctx, result.ID)
}

// UpdateFileMetadata updates file metadata
func (r *FilesRepo) UpdateFileMetadata(ctx context.Context, id int64, sizeBytes, diskUsageBytes int64, mtime, ctime, birthtime *time.Time, uid, gid, mode *int32) error {
	return r.queries.UpdateFileMetadata(ctx, sqlc.UpdateFileMetadataParams{
		ID:             id,
		SizeBytes:      sizeBytes,
		DiskUsageBytes: diskUsageBytes,
		Mtime:          timePtrToTime(mtime),
		Ctime:          timePtrToTime(ctime),
		Birthtime:      timePtrToPgTimestamp(birthtime),
		Uid:            int32PtrToPgInt4(uid),
		Gid:            int32PtrToPgInt4(gid),
		Mode:           int32PtrToPgInt4(mode),
	})
}

// UpdateFileHash updates file hash information
func (r *FilesRepo) UpdateFileHash(ctx context.Context, id int64, hashAlgo string, hash []byte) error {
	return r.queries.UpdateFileHash(ctx, sqlc.UpdateFileHashParams{
		ID:       id,
		HashAlgo: stringPtrToPgText(&hashAlgo),
		Hash:     hash,
	})
}

// UpdateFileMime updates file MIME and media information
func (r *FilesRepo) UpdateFileMime(ctx context.Context, id int64, mime, mediaKind, encoding *string) error {
	return r.queries.UpdateFileMime(ctx, sqlc.UpdateFileMimeParams{
		ID:        id,
		Mime:      stringPtrToPgText(mime),
		MediaKind: stringPtrToPgText(mediaKind),
		Encoding:  stringPtrToPgText(encoding),
	})
}

// DeleteFile deletes a file
func (r *FilesRepo) DeleteFile(ctx context.Context, id int64) error {
	return r.queries.DeleteFile(ctx, id)
}

// DeleteFilesByFolder deletes all files in a folder
func (r *FilesRepo) DeleteFilesByFolder(ctx context.Context, folderID int64) error {
	return r.queries.DeleteFilesByFolder(ctx, folderID)
}

// DeleteFilesByVolume deletes all files for a volume
func (r *FilesRepo) DeleteFilesByVolume(ctx context.Context, volumeID string) error {
	return r.queries.DeleteFilesByVolume(ctx, volumeID)
}

// CountFilesByVolume counts files in a volume
func (r *FilesRepo) CountFilesByVolume(ctx context.Context, volumeID string) (int64, error) {
	return r.queries.CountFilesByVolume(ctx, volumeID)
}

// CountFilesByFolder counts files in a folder
func (r *FilesRepo) CountFilesByFolder(ctx context.Context, folderID int64) (int64, error) {
	return r.queries.CountFilesByFolder(ctx, folderID)
}

// GetFileStats gets file statistics for a volume
func (r *FilesRepo) GetFileStats(ctx context.Context, volumeID string) (*models.FileStats, error) {
	stats, err := r.queries.GetFileStats(ctx, volumeID)
	if err != nil {
		return nil, err
	}

	var totalSize *int64
	if stats.TotalSize != 0 {
		totalSize = &stats.TotalSize
	}
	var avgFileSize *float64
	if stats.AvgFileSize != 0 {
		avgFileSize = &stats.AvgFileSize
	}
	var largestFile *int64
	if stats.LargestFile != 0 {
		largestFile = &stats.LargestFile
	}

	return &models.FileStats{
		TotalFiles:       stats.TotalFiles,
		TotalSize:        totalSize,
		AvgFileSize:      avgFileSize,
		LargestFile:      largestFile,
		UniqueExtensions: stats.UniqueExtensions,
		UniqueMediaKinds: stats.UniqueMediaKinds,
		HashedFiles:      stats.HashedFiles,
	}, nil
}

// GetMediaKindStats gets statistics by media kind
func (r *FilesRepo) GetMediaKindStats(ctx context.Context, volumeID string) ([]*models.MediaKindStat, error) {
	stats, err := r.queries.GetMediaKindStats(ctx, volumeID)
	if err != nil {
		return nil, err
	}

	result := make([]*models.MediaKindStat, len(stats))
	for i, stat := range stats {
		var avgSize *float64
		if stat.AvgSize != 0 {
			avgSize = &stat.AvgSize
		}
		result[i] = &models.MediaKindStat{
			MediaKind: pgTextToStringPtr(stat.MediaKind),
			FileCount: stat.FileCount,
			TotalSize: stat.TotalSize,
			AvgSize:   avgSize,
		}
	}
	return result, nil
}

// GetExtensionStats gets statistics by file extension
func (r *FilesRepo) GetExtensionStats(ctx context.Context, volumeID string, limit int32) ([]*models.ExtensionStat, error) {
	stats, err := r.queries.GetExtensionStats(ctx, sqlc.GetExtensionStatsParams{
		VolumeID: volumeID,
		Limit:    limit,
	})
	if err != nil {
		return nil, err
	}

	result := make([]*models.ExtensionStat, len(stats))
	for i, stat := range stats {
		var avgSize *float64
		if stat.AvgSize != 0 {
			avgSize = &stat.AvgSize
		}
		result[i] = &models.ExtensionStat{
			Extension: pgTextToStringPtr(stat.Extension),
			FileCount: stat.FileCount,
			TotalSize: stat.TotalSize,
			AvgSize:   avgSize,
		}
	}
	return result, nil
}

// BulkInsertFiles inserts multiple files efficiently
func (r *FilesRepo) BulkInsertFiles(ctx context.Context, files []models.CreateFileParams) error {
	rows := make([]sqlc.BulkInsertFilesParams, len(files))
	for i, file := range files {
		pathHash := sha256.Sum256([]byte(file.Path))
		rows[i] = sqlc.BulkInsertFilesParams{
			FolderID:       file.FolderID,
			VolumeID:       file.VolumeID,
			Name:           file.Name,
			Path:           file.Path,
			Extension:      stringPtrToPgText(file.Extension),
			SizeBytes:      file.SizeBytes,
			DiskUsageBytes: file.DiskUsageBytes,
			Mtime:          timePtrToTime(file.Mtime),
			Ctime:          timePtrToTime(file.Ctime),
			Birthtime:      timePtrToPgTimestamp(file.Birthtime),
			Uid:            int32PtrToPgInt4(file.Uid),
			Gid:            int32PtrToPgInt4(file.Gid),
			Mode:           int32PtrToPgInt4(file.Mode),
			Inode:          int64PtrToPgInt8(file.Inode),
			Device:         stringPtrToPgText(file.Device),
			IsSymlink:      boolToPgBool(file.IsSymlink),
			SymlinkTarget:  stringPtrToPgText(file.SymlinkTarget),
			Mime:           stringPtrToPgText(file.Mime),
			MediaKind:      stringPtrToPgText(file.MediaKind),
			Encoding:       stringPtrToPgText(file.Encoding),
			HashAlgo:       stringPtrToPgText(file.HashAlgo),
			Hash:           file.Hash,
			PathHash:       pathHash[:],
		}
	}

	_, err := r.queries.BulkInsertFiles(ctx, rows)
	return err
}

// Helper method to convert sqlc file to domain model
func (r *FilesRepo) convertToFile(file sqlc.Files) *models.File {
	return &models.File{
		ID:             file.ID,
		FolderID:       file.FolderID,
		VolumeID:       file.VolumeID,
		Name:           file.Name,
		Path:           file.Path,
		Extension:      pgTextToStringPtr(file.Extension),
		SizeBytes:      file.SizeBytes,
		DiskUsageBytes: file.DiskUsageBytes,
		Mtime:          timeToTimePtr(file.Mtime),
		Ctime:          timeToTimePtr(file.Ctime),
		Birthtime:      pgTimestampToTimePtr(file.Birthtime),
		Uid:            pgInt4ToInt32Ptr(file.Uid),
		Gid:            pgInt4ToInt32Ptr(file.Gid),
		Mode:           pgInt4ToInt32Ptr(file.Mode),
		Inode:          pgInt8ToInt64Ptr(file.Inode),
		Device:         pgTextToStringPtr(file.Device),
		IsSymlink:      pgBoolToBool(file.IsSymlink),
		SymlinkTarget:  pgTextToStringPtr(file.SymlinkTarget),
		Mime:           pgTextToStringPtr(file.Mime),
		MediaKind:      pgTextToStringPtr(file.MediaKind),
		Encoding:       pgTextToStringPtr(file.Encoding),
		HashAlgo:       pgTextToStringPtr(file.HashAlgo),
		Hash:           file.Hash,
		PathHash:       file.PathHash,
		CreatedAt:      file.CreatedAt,
		UpdatedAt:      file.UpdatedAt,
	}
}

// FileRowLike represents any SQLC generated row type that contains file data
type FileRowLike interface {
	sqlc.Files |
		sqlc.GetFileByIDRow |
		sqlc.GetFileByPathRow |
		sqlc.ListFilesByFolderRow |
		sqlc.ListFilesByVolumeRow |
		sqlc.GetLargestFilesRow |
		sqlc.GetFilesByMediaKindRow |
		sqlc.GetFilesByExtensionRow |
		sqlc.GetFilesByMimeTypeRow |
		sqlc.GetDuplicateFilesRow |
		sqlc.GetRecentFilesRow |
		sqlc.GetFilesModifiedSinceRow |
		sqlc.SearchFilesByNameRow |
		sqlc.GetFilesBySizeRow
}

// convertAnyFileRowToFile converts any file row type to domain model using type assertion
func (r *FilesRepo) convertAnyFileRowToFile(row any) *models.File {
	switch file := row.(type) {
	case sqlc.Files:
		return r.convertToFile(file)
	case sqlc.GetFileByIDRow:
		return r.convertFileRowFields(
			file.ID, file.FolderID, file.VolumeID, file.Name, file.Path,
			file.Extension, file.SizeBytes, file.DiskUsageBytes, file.Mtime,
			file.Ctime, file.Birthtime, file.Uid, file.Gid, file.Mode,
			file.Inode, file.Device, file.IsSymlink, file.SymlinkTarget,
			file.Mime, file.MediaKind, file.Encoding, file.HashAlgo,
			file.Hash, file.PathHash, file.CreatedAt, file.UpdatedAt,
		)
	case sqlc.GetFileByPathRow:
		return r.convertFileRowFields(
			file.ID, file.FolderID, file.VolumeID, file.Name, file.Path,
			file.Extension, file.SizeBytes, file.DiskUsageBytes, file.Mtime,
			file.Ctime, file.Birthtime, file.Uid, file.Gid, file.Mode,
			file.Inode, file.Device, file.IsSymlink, file.SymlinkTarget,
			file.Mime, file.MediaKind, file.Encoding, file.HashAlgo,
			file.Hash, file.PathHash, file.CreatedAt, file.UpdatedAt,
		)
	case sqlc.ListFilesByFolderRow:
		return r.convertFileRowFields(
			file.ID, file.FolderID, file.VolumeID, file.Name, file.Path,
			file.Extension, file.SizeBytes, file.DiskUsageBytes, file.Mtime,
			file.Ctime, file.Birthtime, file.Uid, file.Gid, file.Mode,
			file.Inode, file.Device, file.IsSymlink, file.SymlinkTarget,
			file.Mime, file.MediaKind, file.Encoding, file.HashAlgo,
			file.Hash, file.PathHash, file.CreatedAt, file.UpdatedAt,
		)
	case sqlc.ListFilesByVolumeRow:
		return r.convertFileRowFields(
			file.ID, file.FolderID, file.VolumeID, file.Name, file.Path,
			file.Extension, file.SizeBytes, file.DiskUsageBytes, file.Mtime,
			file.Ctime, file.Birthtime, file.Uid, file.Gid, file.Mode,
			file.Inode, file.Device, file.IsSymlink, file.SymlinkTarget,
			file.Mime, file.MediaKind, file.Encoding, file.HashAlgo,
			file.Hash, file.PathHash, file.CreatedAt, file.UpdatedAt,
		)
	case sqlc.GetLargestFilesRow:
		return r.convertFileRowFields(
			file.ID, file.FolderID, file.VolumeID, file.Name, file.Path,
			file.Extension, file.SizeBytes, file.DiskUsageBytes, file.Mtime,
			file.Ctime, file.Birthtime, file.Uid, file.Gid, file.Mode,
			file.Inode, file.Device, file.IsSymlink, file.SymlinkTarget,
			file.Mime, file.MediaKind, file.Encoding, file.HashAlgo,
			file.Hash, file.PathHash, file.CreatedAt, file.UpdatedAt,
		)
	case sqlc.GetFilesByMediaKindRow:
		return r.convertFileRowFields(
			file.ID, file.FolderID, file.VolumeID, file.Name, file.Path,
			file.Extension, file.SizeBytes, file.DiskUsageBytes, file.Mtime,
			file.Ctime, file.Birthtime, file.Uid, file.Gid, file.Mode,
			file.Inode, file.Device, file.IsSymlink, file.SymlinkTarget,
			file.Mime, file.MediaKind, file.Encoding, file.HashAlgo,
			file.Hash, file.PathHash, file.CreatedAt, file.UpdatedAt,
		)
	case sqlc.GetFilesByExtensionRow:
		return r.convertFileRowFields(
			file.ID, file.FolderID, file.VolumeID, file.Name, file.Path,
			file.Extension, file.SizeBytes, file.DiskUsageBytes, file.Mtime,
			file.Ctime, file.Birthtime, file.Uid, file.Gid, file.Mode,
			file.Inode, file.Device, file.IsSymlink, file.SymlinkTarget,
			file.Mime, file.MediaKind, file.Encoding, file.HashAlgo,
			file.Hash, file.PathHash, file.CreatedAt, file.UpdatedAt,
		)
	case sqlc.GetFilesByMimeTypeRow:
		return r.convertFileRowFields(
			file.ID, file.FolderID, file.VolumeID, file.Name, file.Path,
			file.Extension, file.SizeBytes, file.DiskUsageBytes, file.Mtime,
			file.Ctime, file.Birthtime, file.Uid, file.Gid, file.Mode,
			file.Inode, file.Device, file.IsSymlink, file.SymlinkTarget,
			file.Mime, file.MediaKind, file.Encoding, file.HashAlgo,
			file.Hash, file.PathHash, file.CreatedAt, file.UpdatedAt,
		)
	case sqlc.GetDuplicateFilesRow:
		return r.convertFileRowFields(
			file.ID, file.FolderID, file.VolumeID, file.Name, file.Path,
			file.Extension, file.SizeBytes, file.DiskUsageBytes, file.Mtime,
			file.Ctime, file.Birthtime, file.Uid, file.Gid, file.Mode,
			file.Inode, file.Device, file.IsSymlink, file.SymlinkTarget,
			file.Mime, file.MediaKind, file.Encoding, file.HashAlgo,
			file.Hash, file.PathHash, file.CreatedAt, file.UpdatedAt,
		)
	case sqlc.GetRecentFilesRow:
		return r.convertFileRowFields(
			file.ID, file.FolderID, file.VolumeID, file.Name, file.Path,
			file.Extension, file.SizeBytes, file.DiskUsageBytes, file.Mtime,
			file.Ctime, file.Birthtime, file.Uid, file.Gid, file.Mode,
			file.Inode, file.Device, file.IsSymlink, file.SymlinkTarget,
			file.Mime, file.MediaKind, file.Encoding, file.HashAlgo,
			file.Hash, file.PathHash, file.CreatedAt, file.UpdatedAt,
		)
	case sqlc.GetFilesModifiedSinceRow:
		return r.convertFileRowFields(
			file.ID, file.FolderID, file.VolumeID, file.Name, file.Path,
			file.Extension, file.SizeBytes, file.DiskUsageBytes, file.Mtime,
			file.Ctime, file.Birthtime, file.Uid, file.Gid, file.Mode,
			file.Inode, file.Device, file.IsSymlink, file.SymlinkTarget,
			file.Mime, file.MediaKind, file.Encoding, file.HashAlgo,
			file.Hash, file.PathHash, file.CreatedAt, file.UpdatedAt,
		)
	case sqlc.SearchFilesByNameRow:
		return r.convertFileRowFields(
			file.ID, file.FolderID, file.VolumeID, file.Name, file.Path,
			file.Extension, file.SizeBytes, file.DiskUsageBytes, file.Mtime,
			file.Ctime, file.Birthtime, file.Uid, file.Gid, file.Mode,
			file.Inode, file.Device, file.IsSymlink, file.SymlinkTarget,
			file.Mime, file.MediaKind, file.Encoding, file.HashAlgo,
			file.Hash, file.PathHash, file.CreatedAt, file.UpdatedAt,
		)
	case sqlc.GetFilesBySizeRow:
		return r.convertFileRowFields(
			file.ID, file.FolderID, file.VolumeID, file.Name, file.Path,
			file.Extension, file.SizeBytes, file.DiskUsageBytes, file.Mtime,
			file.Ctime, file.Birthtime, file.Uid, file.Gid, file.Mode,
			file.Inode, file.Device, file.IsSymlink, file.SymlinkTarget,
			file.Mime, file.MediaKind, file.Encoding, file.HashAlgo,
			file.Hash, file.PathHash, file.CreatedAt, file.UpdatedAt,
		)
	default:
		panic("unsupported file row type")
	}
}

// convertFileRowFields converts individual fields to domain model (shared logic)
func (r *FilesRepo) convertFileRowFields(
	id int64, folderID int64, volumeID string, name string, path string,
	extension pgtype.Text, sizeBytes int64, diskUsageBytes int64, mtime time.Time,
	ctime time.Time, birthtime pgtype.Timestamp, uid pgtype.Int4, gid pgtype.Int4, mode pgtype.Int4,
	inode pgtype.Int8, device pgtype.Text, isSymlink pgtype.Bool, symlinkTarget pgtype.Text,
	mime pgtype.Text, mediaKind pgtype.Text, encoding pgtype.Text, hashAlgo pgtype.Text,
	hash []byte, pathHash []byte, createdAt time.Time, updatedAt time.Time,
) *models.File {
	return &models.File{
		ID:             id,
		FolderID:       folderID,
		VolumeID:       volumeID,
		Name:           name,
		Path:           path,
		Extension:      pgTextToStringPtr(extension),
		SizeBytes:      sizeBytes,
		DiskUsageBytes: diskUsageBytes,
		Mtime:          timeToTimePtr(mtime),
		Ctime:          timeToTimePtr(ctime),
		Birthtime:      pgTimestampToTimePtr(birthtime),
		Uid:            pgInt4ToInt32Ptr(uid),
		Gid:            pgInt4ToInt32Ptr(gid),
		Mode:           pgInt4ToInt32Ptr(mode),
		Inode:          pgInt8ToInt64Ptr(inode),
		Device:         pgTextToStringPtr(device),
		IsSymlink:      pgBoolToBool(isSymlink),
		SymlinkTarget:  pgTextToStringPtr(symlinkTarget),
		Mime:           pgTextToStringPtr(mime),
		MediaKind:      pgTextToStringPtr(mediaKind),
		Encoding:       pgTextToStringPtr(encoding),
		HashAlgo:       pgTextToStringPtr(hashAlgo),
		Hash:           hash,
		PathHash:       pathHash,
		CreatedAt:      createdAt,
		UpdatedAt:      updatedAt,
	}
}

// ExtractFileExtension extracts extension from filename
func ExtractFileExtension(filename string) *string {
	ext := strings.ToLower(filepath.Ext(filename))
	if ext == "" {
		return nil
	}

	// Remove the leading dot
	if len(ext) > 1 {
		ext = ext[1:]
	}

	return &ext
}
