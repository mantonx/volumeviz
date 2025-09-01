package repo

import (
	"context"
	"crypto/sha256"
	"fmt"
	"path/filepath"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgtype"
	"github.com/mantonx/volumeviz/internal/db/sqlc"
	sqlcSQLite "github.com/mantonx/volumeviz/internal/db/sqlc-sqlite"
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

// NewSQLiteFilesRepo creates a new SQLite files repository
func NewSQLiteFilesRepo(queries *sqlcSQLite.Queries) *FilesRepo {
	// TODO: Implement SQLite-specific version
	return &FilesRepo{
		queries: nil,
	}
}

// CreateFile creates a new file record
func (r *FilesRepo) CreateFile(ctx context.Context, params models.CreateFileParams) (*models.File, error) {
	pathHash := sha256.Sum256([]byte(params.Path))

	result, err := r.queries.CreateFile(ctx, sqlc.CreateFileParams{
		VolumeID:    params.VolumeID,
		FolderID:    pgtype.Int8{Int64: params.FolderID, Valid: true},
		Path:        params.Path,
		PathHash:    pathHash[:],
		Name:        params.Name,
		Extension:   stringPtrToPgText(params.Extension),
		Mime:        stringPtrToPgText(params.Mime),
		SizeBytes:   params.SizeBytes,
		ModifiedAt:  timePtrToPgTimestamptz(params.Mtime),
		AccessedAt:  timePtrToPgTimestamptz(params.Ctime),
		Mode:        int32PtrToPgInt4(params.Mode),
		OwnerUid:    int32PtrToPgInt4(params.Uid),
		OwnerGid:    int32PtrToPgInt4(params.Gid),
		ContentHash: pgtype.Text{Valid: false}, // Will be set later with hash
		IsText:      pgtype.Bool{Bool: false, Valid: true}, // Default to false
		IsBinary:    pgtype.Bool{Bool: true, Valid: true}, // Default to true
		MediaKind:   stringPtrToPgText(params.MediaKind),
	})
	if err != nil {
		return nil, err
	}

	return r.GetFileByID(ctx, result.ID)
}

// GetFileByID retrieves a file by ID
func (r *FilesRepo) GetFileByID(ctx context.Context, id int64) (*models.File, error) {
	file, err := r.queries.GetFile(ctx, id)
	if err != nil {
		return nil, err
	}

	return r.convertAnyFileRowToFile(file), nil
}

// GetFileByPath retrieves a file by volume ID and path
func (r *FilesRepo) GetFileByPath(ctx context.Context, volumeID, path string) (*models.File, error) {
	file, err := r.queries.GetFileByPath(ctx, sqlc.GetFileByPathParams{
		VolumeID: volumeID,
		Path: path,
	})
	if err != nil {
		return nil, err
	}

	return r.convertAnyFileRowToFile(file), nil
}

// ListFilesByFolder lists files in a folder with pagination
func (r *FilesRepo) ListFilesByFolder(ctx context.Context, folderID int64, limit, offset int32) ([]*models.File, error) {
	files, err := r.queries.ListFilesByFolder(ctx, sqlc.ListFilesByFolderParams{
		FolderID: pgtype.Int8{Int64: folderID, Valid: true},
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
	files, err := r.queries.GetFilesByExtensionFiles(ctx, sqlc.GetFilesByExtensionFilesParams{
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
	files, err := r.queries.GetDuplicateFiles(ctx, volumeID)
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
		VolumeID:   volumeID,
		ModifiedAt: pgtype.Timestamptz{Time: since, Valid: true},
		Limit:      limit,
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
		VolumeID:   volumeID,
		ModifiedAt: pgtype.Timestamptz{Time: since, Valid: true},
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
		Column2:  pgtype.Text{String: pattern, Valid: true},
		Limit:    limit,
		Offset:   0,
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
		VolumeID:    params.VolumeID,
		FolderID:    pgtype.Int8{Int64: params.FolderID, Valid: true},
		Path:        params.Path,
		PathHash:    pathHash[:],
		Name:        params.Name,
		Extension:   stringPtrToPgText(params.Extension),
		Mime:        stringPtrToPgText(params.Mime),
		SizeBytes:   params.SizeBytes,
		ModifiedAt:  timePtrToPgTimestamptz(params.Mtime),
		AccessedAt:  timePtrToPgTimestamptz(params.Ctime),
		Mode:        int32PtrToPgInt4(params.Mode),
		OwnerUid:    int32PtrToPgInt4(params.Uid),
		OwnerGid:    int32PtrToPgInt4(params.Gid),
		ContentHash: pgtype.Text{Valid: false},
		IsText:      pgtype.Bool{Bool: false, Valid: true},
		IsBinary:    pgtype.Bool{Bool: true, Valid: true},
		MediaKind:   stringPtrToPgText(params.MediaKind),
	})
	if err != nil {
		return nil, err
	}

	return r.GetFileByID(ctx, result.ID)
}

// UpdateFileSystemMetadata updates file system metadata
func (r *FilesRepo) UpdateFileSystemMetadata(ctx context.Context, id int64, sizeBytes int64, mtime, ctime *time.Time, uid, gid, mode *int32) error {
	return r.queries.UpdateFileSystemMetadata(ctx, sqlc.UpdateFileSystemMetadataParams{
		ID:         id,
		SizeBytes:  sizeBytes,
		ModifiedAt: timePtrToPgTimestamptz(mtime),
		AccessedAt: timePtrToPgTimestamptz(ctime),
		Mode:       int32PtrToPgInt4(mode),
		OwnerUid:   int32PtrToPgInt4(uid),
		OwnerGid:   int32PtrToPgInt4(gid),
	})
}

// UpdateFileHash updates file hash information
func (r *FilesRepo) UpdateFileHash(ctx context.Context, id int64, contentHash string) error {
	return r.queries.UpdateFileHash(ctx, sqlc.UpdateFileHashParams{
		ID:          id,
		ContentHash: stringPtrToPgText(&contentHash),
	})
}

// UpdateFileMime updates file MIME and media information
func (r *FilesRepo) UpdateFileMime(ctx context.Context, id int64, mime, mediaKind *string, isText, isBinary *bool) error {
	return r.queries.UpdateFileMime(ctx, sqlc.UpdateFileMimeParams{
		ID:        id,
		Mime:      stringPtrToPgText(mime),
		MediaKind: stringPtrToPgText(mediaKind),
		IsText:    boolPtrToPgBool(isText),
		IsBinary:  boolPtrToPgBool(isBinary),
	})
}

// DeleteFile deletes a file
func (r *FilesRepo) DeleteFile(ctx context.Context, id int64) error {
	return r.queries.DeleteFile(ctx, id)
}

// DeleteFilesByFolder deletes all files in a folder
func (r *FilesRepo) DeleteFilesByFolder(ctx context.Context, folderID int64) error {
	// Since we don't have a direct DeleteFilesByFolder method, we need to implement it differently
	// For now, return an error to indicate this needs to be implemented
	return fmt.Errorf("DeleteFilesByFolder not implemented")
}

// DeleteFilesByVolume deletes all files for a volume
func (r *FilesRepo) DeleteFilesByVolume(ctx context.Context, volumeID string) error {
	return r.queries.DeleteFilesByVolume(ctx, volumeID)
}

// DeleteFilesByIDs deletes files by their IDs in batches
func (r *FilesRepo) DeleteFilesByIDs(ctx context.Context, fileIDs []int64) error {
	// Process in batches to avoid query size limits
	batchSize := 1000
	for i := 0; i < len(fileIDs); i += batchSize {
		end := i + batchSize
		if end > len(fileIDs) {
			end = len(fileIDs)
		}
		
		batch := fileIDs[i:end]
		for _, id := range batch {
			if err := r.queries.DeleteFile(ctx, id); err != nil {
				return err
			}
		}
	}
	return nil
}

// GetFilesByVolume gets all files for a volume (used for reconciliation)
func (r *FilesRepo) GetFilesByVolume(ctx context.Context, volumeID string) ([]*models.File, error) {
	files, err := r.queries.ListFilesByVolume(ctx, sqlc.ListFilesByVolumeParams{
		VolumeID: volumeID,
		Limit:    1000000, // Large limit to get all files
		Offset:   0,
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

// CountFilesByVolume counts files in a volume
func (r *FilesRepo) CountFilesByVolume(ctx context.Context, volumeID string) (int64, error) {
	return r.queries.CountFilesByVolume(ctx, volumeID)
}

// CountFilesByFolder counts files in a folder
func (r *FilesRepo) CountFilesByFolder(ctx context.Context, folderID int64) (int64, error) {
	return r.queries.CountFilesByFolder(ctx, pgtype.Int8{Int64: folderID, Valid: true})
}

// GetFileStats gets file statistics for a volume
func (r *FilesRepo) GetFileStats(ctx context.Context, volumeID string) (*models.FileStats, error) {
	stats, err := r.queries.GetFileStats(ctx, volumeID)
	if err != nil {
		return nil, err
	}

	var totalSize *int64
	if stats.TotalSize != nil {
		if size, ok := stats.TotalSize.(int64); ok && size != 0 {
			totalSize = &size
		}
	}
	var avgFileSize *float64
	if stats.AvgFileSize != nil {
		if avg, ok := stats.AvgFileSize.(float64); ok && avg != 0 {
			avgFileSize = &avg
		}
	}
	var largestFile *int64
	if stats.LargestFile != nil {
		if largest, ok := stats.LargestFile.(int64); ok && largest != 0 {
			largestFile = &largest
		}
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
		if stat.AvgSize != nil {
			if avg, ok := stat.AvgSize.(float64); ok && avg != 0 {
				avgSize = &avg
			}
		}
		var totalSize int64
		if stat.TotalSize != nil {
			if size, ok := stat.TotalSize.(int64); ok {
				totalSize = size
			}
		}
		result[i] = &models.MediaKindStat{
			MediaKind: pgTextToStringPtr(stat.MediaKind),
			FileCount: stat.FileCount,
			TotalSize: totalSize,
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
		if stat.AvgSize != nil {
			if avg, ok := stat.AvgSize.(float64); ok && avg != 0 {
				avgSize = &avg
			}
		}
		var totalSize int64
		if stat.TotalSize != nil {
			if size, ok := stat.TotalSize.(int64); ok {
				totalSize = size
			}
		}
		result[i] = &models.ExtensionStat{
			Extension: pgTextToStringPtr(stat.Extension),
			FileCount: stat.FileCount,
			TotalSize: totalSize,
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
			VolumeID:    file.VolumeID,
			FolderID:    pgtype.Int8{Int64: file.FolderID, Valid: true},
			Path:        file.Path,
			PathHash:    pathHash[:],
			Name:        file.Name,
			Extension:   stringPtrToPgText(file.Extension),
			Mime:        stringPtrToPgText(file.Mime),
			SizeBytes:   file.SizeBytes,
			ModifiedAt:  timePtrToPgTimestamptz(file.Mtime),
			AccessedAt:  timePtrToPgTimestamptz(file.Ctime),
			Mode:        int32PtrToPgInt4(file.Mode),
			OwnerUid:    int32PtrToPgInt4(file.Uid),
			OwnerGid:    int32PtrToPgInt4(file.Gid),
			ContentHash: pgtype.Text{Valid: false},
			IsText:      pgtype.Bool{Bool: false, Valid: true},
			IsBinary:    pgtype.Bool{Bool: true, Valid: true},
			MediaKind:   stringPtrToPgText(file.MediaKind),
		}
	}

	_, err := r.queries.BulkInsertFiles(ctx, rows)
	return err
}

// Helper method to convert sqlc file to domain model
func (r *FilesRepo) convertToFile(file sqlc.Files) *models.File {
	return &models.File{
		ID:             file.ID,
		FolderID:       pgInt8ToInt64(file.FolderID),
		VolumeID:       file.VolumeID,
		Name:           file.Name,
		Path:           file.Path,
		Extension:      pgTextToStringPtr(file.Extension),
		SizeBytes:      file.SizeBytes,
		DiskUsageBytes: file.SizeBytes, // Use same value as we don't track disk usage separately
		Mtime:          pgTimestamptzToTimePtr(file.ModifiedAt),
		Ctime:          pgTimestamptzToTimePtr(file.AccessedAt), // Map access time to ctime for now
		Birthtime:      pgTimestamptzToTimePtr(file.FirstSeenAt),
		Uid:            pgInt4ToInt32Ptr(file.OwnerUid),
		Gid:            pgInt4ToInt32Ptr(file.OwnerGid),
		Mode:           pgInt4ToInt32Ptr(file.Mode),
		Inode:          nil, // Not stored in our schema
		Device:         nil, // Not stored in our schema
		IsSymlink:      pgBoolToBool(file.IsText), // Map is_text to is_symlink for now
		SymlinkTarget:  nil, // Not stored in our schema
		Mime:           pgTextToStringPtr(file.Mime),
		MediaKind:      pgTextToStringPtr(file.MediaKind),
		Encoding:       nil, // Not stored in our schema
		HashAlgo:       nil, // Not stored in our schema
		Hash:           nil, // Content hash is stored as text, not bytes
		PathHash:       file.PathHash,
		CreatedAt:      file.CreatedAt,
		UpdatedAt:      file.CreatedAt, // Use created_at as we don't have updated_at
	}
}

// FileRowLike represents any SQLC generated row type that contains file data
type FileRowLike interface {
	sqlc.Files |
		sqlc.GetDuplicateFilesBySizeRow |
		sqlc.GetLargestFilesRow |
		sqlc.GetFilesByExtensionRow
}

// UpdateFileMetadata updates filesystem metadata for a file
func (r *FilesRepo) UpdateFileMetadata(ctx context.Context, fileID int64, sizeBytes, diskUsageBytes int64, mtime, ctime, birthtime *time.Time, uid, gid, mode *int32) error {
	// TODO: Implement using SQLC UpdateFileMetadata method when available
	// For now, delegate to existing UpdateFileSystemMetadata method with compatible parameters
	return r.UpdateFileSystemMetadata(ctx, fileID, sizeBytes, mtime, ctime, uid, gid, mode)
}

// convertAnyFileRowToFile converts any file row type to domain model using type assertion
func (r *FilesRepo) convertAnyFileRowToFile(row any) *models.File {
	switch file := row.(type) {
	case sqlc.Files:
		return r.convertToFile(file)
	case sqlc.GetLargestFilesRow:
		// GetLargestFilesRow only has limited fields
		return &models.File{
			ID:        file.ID,
			VolumeID:  file.VolumeID,
			Path:      file.Path,
			Name:      file.Name,
			SizeBytes: file.SizeBytes,
			Mtime:     pgTimestamptzToTimePtr(file.ModifiedAt),
		}
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
