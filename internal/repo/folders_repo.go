package repo

import (
	"context"
	"crypto/sha256"
	"path/filepath"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/mantonx/volumeviz/internal/db/sqlc"
	"github.com/mantonx/volumeviz/internal/models"
)

// FoldersRepo handles folder operations
type FoldersRepo struct {
	db      sqlc.DBTX
	queries *sqlc.Queries
}

// NewFoldersRepo creates a new folders repository
func NewFoldersRepo(db sqlc.DBTX) *FoldersRepo {
	return &FoldersRepo{
		db:      db,
		queries: sqlc.New(db),
	}
}

// CreateFolder creates a new folder record
func (r *FoldersRepo) CreateFolder(ctx context.Context, params models.CreateFolderParams) (*models.Folder, error) {
	pathHash := sha256.Sum256([]byte(params.Path))

	result, err := r.queries.CreateFolder(ctx, sqlc.CreateFolderParams{
		ParentID:      int64PtrToPgInt8(params.ParentID),
		VolumeID:      params.VolumeID,
		Name:          params.Name,
		Path:          params.Path,
		PathHash:      pathHash[:],
		Depth:         params.Depth,
		Mtime:         timePtrToTime(params.Mtime),
		Ctime:         timePtrToTime(params.Ctime),
		Uid:           int32PtrToPgInt4(params.Uid),
		Gid:           int32PtrToPgInt4(params.Gid),
		Mode:          int32PtrToPgInt4(params.Mode),
		IsSymlink:     boolToPgBool(params.IsSymlink),
		SymlinkTarget: stringPtrToPgText(params.SymlinkTarget),
	})
	if err != nil {
		return nil, err
	}

	return r.GetFolderByID(ctx, result.ID)
}

// GetFolderByID retrieves a folder by ID
func (r *FoldersRepo) GetFolderByID(ctx context.Context, id int64) (*models.Folder, error) {
	folder, err := r.queries.GetFolderByID(ctx, id)
	if err != nil {
		return nil, err
	}

	return r.convertToFolder(folder), nil
}

// GetFolderByPath retrieves a folder by volume ID and path
func (r *FoldersRepo) GetFolderByPath(ctx context.Context, volumeID, path string) (*models.Folder, error) {
	pathHash := sha256.Sum256([]byte(path))

	folder, err := r.queries.GetFolderByPath(ctx, sqlc.GetFolderByPathParams{
		VolumeID: volumeID,
		PathHash: pathHash[:],
	})
	if err != nil {
		return nil, err
	}

	return r.convertToFolder(folder), nil
}

// ListFoldersByVolume lists folders in a volume with pagination
func (r *FoldersRepo) ListFoldersByVolume(ctx context.Context, volumeID string, limit, offset int32) ([]*models.Folder, error) {
	folders, err := r.queries.ListFoldersByVolume(ctx, sqlc.ListFoldersByVolumeParams{
		VolumeID: volumeID,
		Limit:    limit,
		Offset:   offset,
	})
	if err != nil {
		return nil, err
	}

	result := make([]*models.Folder, len(folders))
	for i, folder := range folders {
		result[i] = r.convertToFolder(folder)
	}
	return result, nil
}

// ListFoldersByParent lists folders under a parent folder
func (r *FoldersRepo) ListFoldersByParent(ctx context.Context, volumeID string, parentID *int64) ([]*models.Folder, error) {
	folders, err := r.queries.ListFoldersByParent(ctx, sqlc.ListFoldersByParentParams{
		VolumeID: volumeID,
		ParentID: int64PtrToPgInt8(parentID),
	})
	if err != nil {
		return nil, err
	}

	result := make([]*models.Folder, len(folders))
	for i, folder := range folders {
		result[i] = r.convertToFolder(folder)
	}
	return result, nil
}

// GetRootFolders gets root folders for a volume
func (r *FoldersRepo) GetRootFolders(ctx context.Context, volumeID string) ([]*models.Folder, error) {
	folders, err := r.queries.GetRootFolders(ctx, volumeID)
	if err != nil {
		return nil, err
	}

	result := make([]*models.Folder, len(folders))
	for i, folder := range folders {
		result[i] = r.convertToFolder(folder)
	}
	return result, nil
}

// GetLargestFolders gets folders sorted by size
func (r *FoldersRepo) GetLargestFolders(ctx context.Context, volumeID string, limit int32) ([]*models.Folder, error) {
	folders, err := r.queries.GetLargestFolders(ctx, sqlc.GetLargestFoldersParams{
		VolumeID: volumeID,
		Limit:    limit,
	})
	if err != nil {
		return nil, err
	}

	result := make([]*models.Folder, len(folders))
	for i, folder := range folders {
		result[i] = r.convertToFolder(folder)
	}
	return result, nil
}

// GetFoldersWithMostFiles gets folders with the most files
func (r *FoldersRepo) GetFoldersWithMostFiles(ctx context.Context, volumeID string, limit int32) ([]*models.Folder, error) {
	folders, err := r.queries.GetFoldersWithMostFiles(ctx, sqlc.GetFoldersWithMostFilesParams{
		VolumeID: volumeID,
		Limit:    limit,
	})
	if err != nil {
		return nil, err
	}

	result := make([]*models.Folder, len(folders))
	for i, folder := range folders {
		result[i] = r.convertToFolder(folder)
	}
	return result, nil
}

// UpsertFolder creates or updates a folder
func (r *FoldersRepo) UpsertFolder(ctx context.Context, params models.CreateFolderParams) (*models.Folder, error) {
	pathHash := sha256.Sum256([]byte(params.Path))

	result, err := r.queries.UpsertFolder(ctx, sqlc.UpsertFolderParams{
		ParentID:      int64PtrToPgInt8(params.ParentID),
		VolumeID:      params.VolumeID,
		Name:          params.Name,
		Path:          params.Path,
		PathHash:      pathHash[:],
		Depth:         params.Depth,
		Mtime:         timePtrToTime(params.Mtime),
		Ctime:         timePtrToTime(params.Ctime),
		Uid:           int32PtrToPgInt4(params.Uid),
		Gid:           int32PtrToPgInt4(params.Gid),
		Mode:          int32PtrToPgInt4(params.Mode),
		IsSymlink:     boolToPgBool(params.IsSymlink),
		SymlinkTarget: stringPtrToPgText(params.SymlinkTarget),
	})
	if err != nil {
		return nil, err
	}

	return r.GetFolderByID(ctx, result.ID)
}

// DeleteFolder deletes a folder
func (r *FoldersRepo) DeleteFolder(ctx context.Context, id int64) error {
	return r.queries.DeleteFolder(ctx, id)
}

// DeleteFoldersByVolume deletes all folders for a volume
func (r *FoldersRepo) DeleteFoldersByVolume(ctx context.Context, volumeID string) error {
	return r.queries.DeleteFoldersByVolume(ctx, volumeID)
}

// CountFoldersByVolume counts folders in a volume
func (r *FoldersRepo) CountFoldersByVolume(ctx context.Context, volumeID string) (int64, error) {
	return r.queries.CountFoldersByVolume(ctx, volumeID)
}

// GetFolderStats gets folder statistics for a volume
func (r *FoldersRepo) GetFolderStats(ctx context.Context, volumeID string) (*models.FolderStats, error) {
	stats, err := r.queries.GetFolderStats(ctx, volumeID)
	if err != nil {
		return nil, err
	}

	var maxDepth *int32
	if stats.MaxDepth != nil {
		if md, ok := stats.MaxDepth.(int32); ok {
			maxDepth = &md
		}
	}
	var avgFilesPerFolder *float64
	if stats.AvgFilesPerFolder != 0 {
		avgFilesPerFolder = &stats.AvgFilesPerFolder
	}
	var totalSize *int64
	if stats.TotalSize != 0 {
		totalSize = &stats.TotalSize
	}
	var largestFolderSize *int64
	if stats.LargestFolderSize != nil {
		if lfs, ok := stats.LargestFolderSize.(int64); ok {
			largestFolderSize = &lfs
		}
	}

	return &models.FolderStats{
		TotalFolders:      stats.TotalFolders,
		RootFolders:       stats.RootFolders,
		MaxDepth:          maxDepth,
		AvgFilesPerFolder: avgFilesPerFolder,
		TotalSize:         totalSize,
		LargestFolderSize: largestFolderSize,
	}, nil
}

// GetFolderTree gets a folder and its children up to specified depth
func (r *FoldersRepo) GetFolderTree(ctx context.Context, folderID int64, maxDepth int32) ([]*models.Folder, error) {
	folders, err := r.queries.GetFolderTree(ctx, sqlc.GetFolderTreeParams{
		ID:    folderID,
		Depth: maxDepth,
	})
	if err != nil {
		return nil, err
	}

	result := make([]*models.Folder, len(folders))
	for i, folder := range folders {
		result[i] = r.convertToFolder(folder)
	}
	return result, nil
}

// GetFolderPath gets the path from root to the specified folder
func (r *FoldersRepo) GetFolderPath(ctx context.Context, folderID int64) ([]*models.Folder, error) {
	folders, err := r.queries.GetFolderPath(ctx, folderID)
	if err != nil {
		return nil, err
	}

	result := make([]*models.Folder, len(folders))
	for i, folder := range folders {
		result[i] = &models.Folder{
			ID:       folder.ID,
			ParentID: pgInt8ToInt64Ptr(folder.ParentID),
			VolumeID: folder.VolumeID,
			Name:     folder.Name,
			Path:     folder.Path,
			Depth:    folder.Depth,
		}
	}
	return result, nil
}

// UpdateFolderStats updates folder statistics
func (r *FoldersRepo) UpdateFolderStats(ctx context.Context, id int64, sizeBytes, diskUsageBytes, fileCount, dirCount int64) error {
	return r.queries.UpdateFolderStats(ctx, sqlc.UpdateFolderStatsParams{
		ID:                      id,
		SizeBytesRecursive:      sizeBytes,
		DiskUsageBytesRecursive: diskUsageBytes,
		FileCount:               fileCount,
		DirCount:                dirCount,
	})
}

// UpdateFolderMetadata updates folder metadata
func (r *FoldersRepo) UpdateFolderMetadata(ctx context.Context, id int64, mtime, ctime *time.Time, uid, gid, mode *int32) error {
	return r.queries.UpdateFolderMetadata(ctx, sqlc.UpdateFolderMetadataParams{
		ID:    id,
		Mtime: timePtrToTime(mtime),
		Ctime: timePtrToTime(ctime),
		Uid:   int32PtrToPgInt4(uid),
		Gid:   int32PtrToPgInt4(gid),
		Mode:  int32PtrToPgInt4(mode),
	})
}

// BulkInsertFolders inserts multiple folders efficiently
func (r *FoldersRepo) BulkInsertFolders(ctx context.Context, folders []models.CreateFolderParams) error {
	rows := make([]sqlc.BulkInsertFoldersParams, len(folders))
	for i, folder := range folders {
		pathHash := sha256.Sum256([]byte(folder.Path))
		rows[i] = sqlc.BulkInsertFoldersParams{
			ParentID:      int64PtrToPgInt8(folder.ParentID),
			VolumeID:      folder.VolumeID,
			Name:          folder.Name,
			Path:          folder.Path,
			PathHash:      pathHash[:],
			Depth:         folder.Depth,
			Mtime:         timePtrToTime(folder.Mtime),
			Ctime:         timePtrToTime(folder.Ctime),
			Uid:           int32PtrToPgInt4(folder.Uid),
			Gid:           int32PtrToPgInt4(folder.Gid),
			Mode:          int32PtrToPgInt4(folder.Mode),
			IsSymlink:     boolToPgBool(folder.IsSymlink),
			SymlinkTarget: stringPtrToPgText(folder.SymlinkTarget),
		}
	}

	_, err := r.queries.BulkInsertFolders(ctx, rows)
	return err
}

// Helper method to convert sqlc folder to domain model
func (r *FoldersRepo) convertToFolder(folder interface{}) *models.Folder {
	// Use reflection to access common fields from different row types
	// This is a temporary solution until sqlc generates a common interface

	switch f := folder.(type) {
	case sqlc.Folders:
		return &models.Folder{
			ID:                      f.ID,
			ParentID:                pgInt8ToInt64Ptr(f.ParentID),
			VolumeID:                f.VolumeID,
			Name:                    f.Name,
			Path:                    f.Path,
			PathHash:                f.PathHash,
			SizeBytesRecursive:      f.SizeBytesRecursive,
			DiskUsageBytesRecursive: f.DiskUsageBytesRecursive,
			FileCount:               f.FileCount,
			DirCount:                f.DirCount,
			Depth:                   f.Depth,
			Mtime:                   timeToTimePtr(f.Mtime),
			Ctime:                   timeToTimePtr(f.Ctime),
			Uid:                     pgInt4ToInt32Ptr(f.Uid),
			Gid:                     pgInt4ToInt32Ptr(f.Gid),
			Mode:                    pgInt4ToInt32Ptr(f.Mode),
			IsSymlink:               pgBoolToBool(f.IsSymlink),
			SymlinkTarget:           pgTextToStringPtr(f.SymlinkTarget),
			CreatedAt:               f.CreatedAt,
			UpdatedAt:               f.UpdatedAt,
		}
	case sqlc.GetFolderByIDRow:
		return &models.Folder{
			ID:                      f.ID,
			ParentID:                pgInt8ToInt64Ptr(f.ParentID),
			VolumeID:                f.VolumeID,
			Name:                    f.Name,
			Path:                    f.Path,
			PathHash:                f.PathHash,
			SizeBytesRecursive:      f.SizeBytesRecursive,
			DiskUsageBytesRecursive: f.DiskUsageBytesRecursive,
			FileCount:               f.FileCount,
			DirCount:                f.DirCount,
			Depth:                   f.Depth,
			Mtime:                   timeToTimePtr(f.Mtime),
			Ctime:                   timeToTimePtr(f.Ctime),
			Uid:                     pgInt4ToInt32Ptr(f.Uid),
			Gid:                     pgInt4ToInt32Ptr(f.Gid),
			Mode:                    pgInt4ToInt32Ptr(f.Mode),
			IsSymlink:               pgBoolToBool(f.IsSymlink),
			SymlinkTarget:           pgTextToStringPtr(f.SymlinkTarget),
			CreatedAt:               f.CreatedAt,
			UpdatedAt:               f.UpdatedAt,
		}
	case sqlc.GetFolderByPathRow:
		return &models.Folder{
			ID:                      f.ID,
			ParentID:                pgInt8ToInt64Ptr(f.ParentID),
			VolumeID:                f.VolumeID,
			Name:                    f.Name,
			Path:                    f.Path,
			PathHash:                f.PathHash,
			SizeBytesRecursive:      f.SizeBytesRecursive,
			DiskUsageBytesRecursive: f.DiskUsageBytesRecursive,
			FileCount:               f.FileCount,
			DirCount:                f.DirCount,
			Depth:                   f.Depth,
			Mtime:                   timeToTimePtr(f.Mtime),
			Ctime:                   timeToTimePtr(f.Ctime),
			Uid:                     pgInt4ToInt32Ptr(f.Uid),
			Gid:                     pgInt4ToInt32Ptr(f.Gid),
			Mode:                    pgInt4ToInt32Ptr(f.Mode),
			IsSymlink:               pgBoolToBool(f.IsSymlink),
			SymlinkTarget:           pgTextToStringPtr(f.SymlinkTarget),
			CreatedAt:               f.CreatedAt,
			UpdatedAt:               f.UpdatedAt,
		}
	case sqlc.ListFoldersByVolumeRow:
		return &models.Folder{
			ID:                      f.ID,
			ParentID:                pgInt8ToInt64Ptr(f.ParentID),
			VolumeID:                f.VolumeID,
			Name:                    f.Name,
			Path:                    f.Path,
			PathHash:                f.PathHash,
			SizeBytesRecursive:      f.SizeBytesRecursive,
			DiskUsageBytesRecursive: f.DiskUsageBytesRecursive,
			FileCount:               f.FileCount,
			DirCount:                f.DirCount,
			Depth:                   f.Depth,
			Mtime:                   timeToTimePtr(f.Mtime),
			Ctime:                   timeToTimePtr(f.Ctime),
			Uid:                     pgInt4ToInt32Ptr(f.Uid),
			Gid:                     pgInt4ToInt32Ptr(f.Gid),
			Mode:                    pgInt4ToInt32Ptr(f.Mode),
			IsSymlink:               pgBoolToBool(f.IsSymlink),
			SymlinkTarget:           pgTextToStringPtr(f.SymlinkTarget),
			CreatedAt:               f.CreatedAt,
			UpdatedAt:               f.UpdatedAt,
		}
	case sqlc.ListFoldersByParentRow:
		return &models.Folder{
			ID:                      f.ID,
			ParentID:                pgInt8ToInt64Ptr(f.ParentID),
			VolumeID:                f.VolumeID,
			Name:                    f.Name,
			Path:                    f.Path,
			PathHash:                f.PathHash,
			SizeBytesRecursive:      f.SizeBytesRecursive,
			DiskUsageBytesRecursive: f.DiskUsageBytesRecursive,
			FileCount:               f.FileCount,
			DirCount:                f.DirCount,
			Depth:                   f.Depth,
			Mtime:                   timeToTimePtr(f.Mtime),
			Ctime:                   timeToTimePtr(f.Ctime),
			Uid:                     pgInt4ToInt32Ptr(f.Uid),
			Gid:                     pgInt4ToInt32Ptr(f.Gid),
			Mode:                    pgInt4ToInt32Ptr(f.Mode),
			IsSymlink:               pgBoolToBool(f.IsSymlink),
			SymlinkTarget:           pgTextToStringPtr(f.SymlinkTarget),
			CreatedAt:               f.CreatedAt,
			UpdatedAt:               f.UpdatedAt,
		}
	case sqlc.GetRootFoldersRow:
		return &models.Folder{
			ID:                      f.ID,
			ParentID:                pgInt8ToInt64Ptr(f.ParentID),
			VolumeID:                f.VolumeID,
			Name:                    f.Name,
			Path:                    f.Path,
			PathHash:                f.PathHash,
			SizeBytesRecursive:      f.SizeBytesRecursive,
			DiskUsageBytesRecursive: f.DiskUsageBytesRecursive,
			FileCount:               f.FileCount,
			DirCount:                f.DirCount,
			Depth:                   f.Depth,
			Mtime:                   timeToTimePtr(f.Mtime),
			Ctime:                   timeToTimePtr(f.Ctime),
			Uid:                     pgInt4ToInt32Ptr(f.Uid),
			Gid:                     pgInt4ToInt32Ptr(f.Gid),
			Mode:                    pgInt4ToInt32Ptr(f.Mode),
			IsSymlink:               pgBoolToBool(f.IsSymlink),
			SymlinkTarget:           pgTextToStringPtr(f.SymlinkTarget),
			CreatedAt:               f.CreatedAt,
			UpdatedAt:               f.UpdatedAt,
		}
	case sqlc.GetLargestFoldersRow:
		return &models.Folder{
			ID:                      f.ID,
			ParentID:                pgInt8ToInt64Ptr(f.ParentID),
			VolumeID:                f.VolumeID,
			Name:                    f.Name,
			Path:                    f.Path,
			PathHash:                f.PathHash,
			SizeBytesRecursive:      f.SizeBytesRecursive,
			DiskUsageBytesRecursive: f.DiskUsageBytesRecursive,
			FileCount:               f.FileCount,
			DirCount:                f.DirCount,
			Depth:                   f.Depth,
			Mtime:                   timeToTimePtr(f.Mtime),
			Ctime:                   timeToTimePtr(f.Ctime),
			Uid:                     pgInt4ToInt32Ptr(f.Uid),
			Gid:                     pgInt4ToInt32Ptr(f.Gid),
			Mode:                    pgInt4ToInt32Ptr(f.Mode),
			IsSymlink:               pgBoolToBool(f.IsSymlink),
			SymlinkTarget:           pgTextToStringPtr(f.SymlinkTarget),
			CreatedAt:               f.CreatedAt,
			UpdatedAt:               f.UpdatedAt,
		}
	case sqlc.GetFoldersWithMostFilesRow:
		return &models.Folder{
			ID:                      f.ID,
			ParentID:                pgInt8ToInt64Ptr(f.ParentID),
			VolumeID:                f.VolumeID,
			Name:                    f.Name,
			Path:                    f.Path,
			PathHash:                f.PathHash,
			SizeBytesRecursive:      f.SizeBytesRecursive,
			DiskUsageBytesRecursive: f.DiskUsageBytesRecursive,
			FileCount:               f.FileCount,
			DirCount:                f.DirCount,
			Depth:                   f.Depth,
			Mtime:                   timeToTimePtr(f.Mtime),
			Ctime:                   timeToTimePtr(f.Ctime),
			Uid:                     pgInt4ToInt32Ptr(f.Uid),
			Gid:                     pgInt4ToInt32Ptr(f.Gid),
			Mode:                    pgInt4ToInt32Ptr(f.Mode),
			IsSymlink:               pgBoolToBool(f.IsSymlink),
			SymlinkTarget:           pgTextToStringPtr(f.SymlinkTarget),
			CreatedAt:               f.CreatedAt,
			UpdatedAt:               f.UpdatedAt,
		}
	case sqlc.GetFolderTreeRow:
		return &models.Folder{
			ID:                      f.ID,
			ParentID:                pgInt8ToInt64Ptr(f.ParentID),
			VolumeID:                f.VolumeID,
			Name:                    f.Name,
			Path:                    f.Path,
			PathHash:                f.PathHash,
			SizeBytesRecursive:      f.SizeBytesRecursive,
			DiskUsageBytesRecursive: f.DiskUsageBytesRecursive,
			FileCount:               f.FileCount,
			DirCount:                f.DirCount,
			Depth:                   f.Depth,
			Mtime:                   timeToTimePtr(f.Mtime),
			Ctime:                   timeToTimePtr(f.Ctime),
			Uid:                     pgInt4ToInt32Ptr(f.Uid),
			Gid:                     pgInt4ToInt32Ptr(f.Gid),
			Mode:                    pgInt4ToInt32Ptr(f.Mode),
			IsSymlink:               pgBoolToBool(f.IsSymlink),
			SymlinkTarget:           pgTextToStringPtr(f.SymlinkTarget),
			CreatedAt:               f.CreatedAt,
			UpdatedAt:               f.UpdatedAt,
		}
	default:
		// This should not happen, but return nil to avoid panic
		return nil
	}
}

// CreateFolderHierarchy creates folder hierarchy from a path
func (r *FoldersRepo) CreateFolderHierarchy(ctx context.Context, volumeID, fullPath string) (*models.Folder, error) {
	// Normalize and split path into components
	fullPath = filepath.Clean(fullPath)
	parts := strings.Split(strings.Trim(fullPath, "/"), "/")
	if len(parts) == 0 || (len(parts) == 1 && parts[0] == "") {
		return nil, nil
	}

	var parentID *int64
	currentPath := ""
	var lastFolder *models.Folder

	for i, part := range parts {
		if part == "" {
			continue
		}

		currentPath = filepath.Join(currentPath, part)
		depth := int32(i)

		// Check if folder already exists
		existing, err := r.GetFolderByPath(ctx, volumeID, currentPath)
		if err == nil {
			parentID = &existing.ID
			lastFolder = existing
			continue
		}
		if err != pgx.ErrNoRows {
			return nil, err
		}

		// Create the folder
		folder, err := r.CreateFolder(ctx, models.CreateFolderParams{
			ParentID: parentID,
			VolumeID: volumeID,
			Name:     part,
			Path:     currentPath,
			Depth:    depth,
		})
		if err != nil {
			return nil, err
		}

		parentID = &folder.ID
		lastFolder = folder
	}

	return lastFolder, nil
}
