package repo

import (
	"context"
	"path/filepath"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/mantonx/volumeviz/internal/db/sqlc"
	sqlcSQLite "github.com/mantonx/volumeviz/internal/db/sqlc-sqlite"
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

// NewSQLiteFoldersRepo creates a new SQLite folders repository
func NewSQLiteFoldersRepo(queries *sqlcSQLite.Queries) *FoldersRepo {
	// TODO: Implement SQLite-specific version
	return &FoldersRepo{
		queries: nil,
	}
}

// CreateFolder creates a new folder record
func (r *FoldersRepo) CreateFolder(ctx context.Context, params models.CreateFolderParams) (*models.Folder, error) {
	// Use the pre-computed path hash from params (already hex-encoded)
	// Don't recompute it here to avoid binary data in TEXT column

	result, err := r.queries.CreateFolder(ctx, sqlc.CreateFolderParams{
		VolumeID:           params.VolumeID,
		ParentID:           int64PtrToPgInt8(params.ParentID),
		Path:               params.Path,
		Name:               params.Name,
		PathHash:           []byte(params.PathHash),  // Convert string to []byte for SQLC
		SizeBytes:          pgtype.Int8{Valid: false},
		SizeBytesRecursive: pgtype.Int8{Valid: false},
		FileCount:          pgtype.Int4{Valid: false},
		FileCountRecursive: pgtype.Int4{Valid: false},
		SubfolderCount:     pgtype.Int4{Valid: false},
		MediaFileCount:     pgtype.Int4{Valid: false},
		HasMediaFiles:      pgtype.Bool{Valid: false},
		ModifiedAt:         timePtrToPgTimestamptz(params.Mtime),
		AccessedAt:         timePtrToPgTimestamptz(params.Ctime),
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
	folder, err := r.queries.GetFolderByPath(ctx, sqlc.GetFolderByPathParams{
		VolumeID: volumeID,
		Path:     path,
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
	folders, err := r.queries.ListSubfolders(ctx, int64PtrToPgInt8(parentID))
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
		result[i] = &models.Folder{
			ID:                      folder.ID,
			VolumeID:                folder.VolumeID,
			Path:                    folder.Path,
			Name:                    folder.Name,
			SizeBytesRecursive:      pgInt8ToInt64(folder.SizeBytesRecursive),
			DiskUsageBytesRecursive: pgInt8ToInt64(folder.SizeBytesRecursive),
			FileCount:               0, // Not available in this query
			DirCount:                0, // Not available
			CreatedAt:               time.Now(), // Placeholder
			UpdatedAt:               time.Now(), // Placeholder
		}
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
	// Use the pre-computed path hash from params (already hex-encoded)
	// Don't recompute it here to avoid binary data in TEXT column

	result, err := r.queries.UpsertFolder(ctx, sqlc.UpsertFolderParams{
		VolumeID:           params.VolumeID,
		ParentID:           int64PtrToPgInt8(params.ParentID),
		Path:               params.Path,
		Name:               params.Name,
		PathHash:           []byte(params.PathHash),  // Convert string to []byte for SQLC
		SizeBytes:          pgtype.Int8{Valid: false},
		SizeBytesRecursive: pgtype.Int8{Valid: false},
		FileCount:          pgtype.Int4{Valid: false},
		FileCountRecursive: pgtype.Int4{Valid: false},
		SubfolderCount:     pgtype.Int4{Valid: false},
		MediaFileCount:     pgtype.Int4{Valid: false},
		HasMediaFiles:      pgtype.Bool{Valid: false},
		ModifiedAt:         timePtrToPgTimestamptz(params.Mtime),
		AccessedAt:         timePtrToPgTimestamptz(params.Ctime),
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

// DeleteFoldersByIDs deletes folders by their IDs in batches
func (r *FoldersRepo) DeleteFoldersByIDs(ctx context.Context, folderIDs []int64) error {
	// Process in batches to avoid query size limits
	batchSize := 1000
	for i := 0; i < len(folderIDs); i += batchSize {
		end := i + batchSize
		if end > len(folderIDs) {
			end = len(folderIDs)
		}
		
		batch := folderIDs[i:end]
		for _, id := range batch {
			if err := r.queries.DeleteFolder(ctx, id); err != nil {
				return err
			}
		}
	}
	return nil
}

// GetFoldersByVolume gets all folders for a volume (used for reconciliation)
func (r *FoldersRepo) GetFoldersByVolume(ctx context.Context, volumeID string) ([]*models.Folder, error) {
	folders, err := r.queries.ListFoldersByVolume(ctx, sqlc.ListFoldersByVolumeParams{
		VolumeID: volumeID,
		Limit:    1000000, // Large limit to get all folders
		Offset:   0,
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

	return &models.FolderStats{
		TotalFolders:      stats.TotalFolders,
		RootFolders:       0, // Not available in current stats
		MaxDepth:          nil, // Not available
		AvgFilesPerFolder: nil, // Not available
		TotalSize:         nil, // Will need to handle interface{} conversion
		LargestFolderSize: nil, // Will need to handle interface{} conversion
	}, nil
}

// GetFolderTree gets a folder and its children up to specified depth
func (r *FoldersRepo) GetFolderTree(ctx context.Context, folderID int64, maxDepth int32) ([]*models.Folder, error) {
	folders, err := r.queries.GetFolderTree(ctx, sqlc.GetFolderTreeParams{
		ParentID: pgtype.Int8{Int64: folderID, Valid: true},
		VolumeID: "",
		Limit:    maxDepth,
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
			Depth:    0, // Will need to calculate this
		}
	}
	return result, nil
}

// UpdateFolderStats updates folder statistics
func (r *FoldersRepo) UpdateFolderStats(ctx context.Context, id int64, sizeBytes, diskUsageBytes, fileCount, dirCount int64) error {
	return r.queries.UpdateFolderStats(ctx, sqlc.UpdateFolderStatsParams{
		ID:                 id,
		SizeBytes:          pgtype.Int8{Int64: sizeBytes, Valid: true},
		SizeBytesRecursive: pgtype.Int8{Int64: sizeBytes, Valid: true},
		FileCount:          pgtype.Int4{Int32: int32(fileCount), Valid: true},
		FileCountRecursive: pgtype.Int4{Int32: int32(fileCount), Valid: true},
		SubfolderCount:     pgtype.Int4{Int32: int32(dirCount), Valid: true},
	})
}

// UpdateFolderMetadata updates folder metadata
func (r *FoldersRepo) UpdateFolderMetadata(ctx context.Context, id int64, mtime, ctime *time.Time, uid, gid, mode *int32) error {
	return r.queries.UpdateFolderMetadata(ctx, sqlc.UpdateFolderMetadataParams{
		ID:         id,
		ModifiedAt: timePtrToPgTimestamptz(mtime),
		AccessedAt: timePtrToPgTimestamptz(ctime),
	})
}

// BulkInsertFolders inserts multiple folders efficiently
func (r *FoldersRepo) BulkInsertFolders(ctx context.Context, folders []models.CreateFolderParams) error {
	for _, folder := range folders {
		// Use the pre-computed path hash from params (already hex-encoded)
		// Don't recompute it here to avoid binary data in TEXT column
		_, err := r.queries.BulkInsertFolders(ctx, sqlc.BulkInsertFoldersParams{
			VolumeID:           folder.VolumeID,
			ParentID:           int64PtrToPgInt8(folder.ParentID),
			Path:               folder.Path,
			Name:               folder.Name,
			PathHash:           []byte(folder.PathHash),  // Convert string to []byte for SQLC
			SizeBytes:          pgtype.Int8{Valid: false},
			SizeBytesRecursive: pgtype.Int8{Valid: false},
			FileCount:          pgtype.Int4{Valid: false},
			FileCountRecursive: pgtype.Int4{Valid: false},
			SubfolderCount:     pgtype.Int4{Valid: false},
			MediaFileCount:     pgtype.Int4{Valid: false},
			HasMediaFiles:      pgtype.Bool{Valid: false},
			ModifiedAt:         timePtrToPgTimestamptz(folder.Mtime),
			AccessedAt:         timePtrToPgTimestamptz(folder.Ctime),
		})
		if err != nil {
			return err
		}
	}
	var err error
	return err
}

// Helper method to convert sqlc folder to domain model
func (r *FoldersRepo) convertToFolder(f sqlc.Folders) *models.Folder {
	return &models.Folder{
		ID:                      f.ID,
		ParentID:                pgInt8ToInt64Ptr(f.ParentID),
		VolumeID:                f.VolumeID,
		Name:                    f.Name,
		Path:                    f.Path,
		PathHash:                f.PathHash,
		SizeBytesRecursive:      pgInt8ToInt64(f.SizeBytesRecursive),
		DiskUsageBytesRecursive: pgInt8ToInt64(f.SizeBytesRecursive), // Use same value
		FileCount:               int64(pgInt4ToInt32(f.FileCount)),
		DirCount:                int64(pgInt4ToInt32(f.SubfolderCount)),
		Depth:                   0, // Will need to calculate this
		Mtime:                   pgTimestamptzToTimePtr(f.ModifiedAt),
		Ctime:                   pgTimestamptzToTimePtr(f.AccessedAt),
		Uid:                     nil, // Not in current schema
		Gid:                     nil, // Not in current schema
		Mode:                    nil, // Not in current schema
		IsSymlink:               false, // Not in current schema
		SymlinkTarget:           nil, // Not in current schema
		CreatedAt:               f.CreatedAt,
		UpdatedAt:               f.CreatedAt, // Use same value since we don't have updated_at
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

// SearchFoldersByName searches for folders by name (case-insensitive)
func (r *FoldersRepo) SearchFoldersByName(ctx context.Context, volumeID, searchQuery string, limit, offset int32) ([]*models.Folder, error) {
	folders, err := r.queries.SearchFoldersByName(ctx, sqlc.SearchFoldersByNameParams{
		VolumeID: volumeID,
		Column2:  pgtype.Text{String: searchQuery, Valid: true},
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
