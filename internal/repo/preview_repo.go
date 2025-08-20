package repo

import (
	"context"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/mantonx/volumeviz/internal/db/sqlc"
	"github.com/mantonx/volumeviz/internal/services/previews"
)

// PreviewRepo handles database operations for previews
type PreviewRepo struct {
	db      *pgxpool.Pool
	queries *sqlc.Queries
}

// NewPreviewRepo creates a new preview repository
func NewPreviewRepo(db *pgxpool.Pool) *PreviewRepo {
	return &PreviewRepo{
		db:      db,
		queries: sqlc.New(db),
	}
}

// CreatePreview creates a new preview record in the database
func (r *PreviewRepo) CreatePreview(ctx context.Context, metadata *previews.PreviewMetadata) (*previews.PreviewMetadata, error) {
	params := sqlc.CreatePreviewParams{
		FileID:      metadata.FileID,
		Type:        string(metadata.Type),
		Size:        string(metadata.Size),
		Format:      metadata.Format,
		FileSize:    metadata.FileSize,
		ContentHash: metadata.ContentHash,
		StoragePath: metadata.StoragePath,
	}

	// Handle optional width
	if metadata.Width > 0 {
		params.Width = pgtype.Int4{Int32: int32(metadata.Width), Valid: true}
	}

	// Handle optional height
	if metadata.Height > 0 {
		params.Height = pgtype.Int4{Int32: int32(metadata.Height), Valid: true}
	}

	// Handle optional time offset
	if metadata.TimeOffset > 0 {
		params.TimeOffset = pgtype.Float8{Float64: metadata.TimeOffset, Valid: true}
	}

	// Handle processing time
	params.ProcessingMs = pgtype.Int8{Int64: metadata.ProcessingMS, Valid: true}

	row, err := r.queries.CreatePreview(ctx, params)
	if err != nil {
		return nil, err
	}

	return r.convertToPreviewMetadata(row), nil
}

// GetPreviewByStoragePath retrieves a preview by its storage path
func (r *PreviewRepo) GetPreviewByStoragePath(ctx context.Context, storagePath string) (*previews.PreviewMetadata, error) {
	row, err := r.queries.GetPreviewByStoragePath(ctx, storagePath)
	if err != nil {
		return nil, err
	}

	return r.convertToPreviewMetadata(row), nil
}

// GetPreviewByContentHash retrieves a preview by its content hash
func (r *PreviewRepo) GetPreviewByContentHash(ctx context.Context, contentHash string) (*previews.PreviewMetadata, error) {
	row, err := r.queries.GetPreviewByContentHash(ctx, contentHash)
	if err != nil {
		return nil, err
	}

	return r.convertToPreviewMetadata(row), nil
}

// GetPreviewsForFile retrieves all previews for a specific file
func (r *PreviewRepo) GetPreviewsForFile(ctx context.Context, fileID int64) ([]*previews.PreviewMetadata, error) {
	rows, err := r.queries.GetPreviewsForFile(ctx, fileID)
	if err != nil {
		return nil, err
	}

	var result []*previews.PreviewMetadata
	for _, row := range rows {
		result = append(result, r.convertToPreviewMetadata(row))
	}

	return result, nil
}

// GetPreviewForFileByTypeSize retrieves a specific preview for a file
func (r *PreviewRepo) GetPreviewForFileByTypeSize(ctx context.Context, fileID int64, previewType previews.PreviewType, size previews.PreviewSize, timeOffset float64) (*previews.PreviewMetadata, error) {
	params := sqlc.GetPreviewForFileByTypeSizeParams{
		FileID: fileID,
		Type:   string(previewType),
		Size:   string(size),
	}

	if timeOffset > 0 {
		params.TimeOffset = pgtype.Float8{Float64: timeOffset, Valid: true}
	}

	row, err := r.queries.GetPreviewForFileByTypeSize(ctx, params)
	if err != nil {
		return nil, err
	}

	return r.convertToPreviewMetadata(row), nil
}

// UpdatePreviewAccessTime updates the access time for a preview
func (r *PreviewRepo) UpdatePreviewAccessTime(ctx context.Context, previewID int64) error {
	return r.queries.UpdatePreviewAccessTime(ctx, previewID)
}

// UpdatePreviewAccessTimeByPath updates the access time for a preview by storage path
func (r *PreviewRepo) UpdatePreviewAccessTimeByPath(ctx context.Context, storagePath string) error {
	return r.queries.UpdatePreviewAccessTimeByPath(ctx, storagePath)
}

// DeletePreview deletes a preview by ID
func (r *PreviewRepo) DeletePreview(ctx context.Context, previewID int64) error {
	return r.queries.DeletePreview(ctx, previewID)
}

// DeletePreviewByStoragePath deletes a preview by storage path
func (r *PreviewRepo) DeletePreviewByStoragePath(ctx context.Context, storagePath string) error {
	return r.queries.DeletePreviewByStoragePath(ctx, storagePath)
}

// DeletePreviewsForFile deletes all previews for a specific file
func (r *PreviewRepo) DeletePreviewsForFile(ctx context.Context, fileID int64) error {
	return r.queries.DeletePreviewsForFile(ctx, fileID)
}

// GetOldPreviews retrieves previews older than the specified time
func (r *PreviewRepo) GetOldPreviews(ctx context.Context, cutoffTime time.Time, limit int32) ([]*previews.PreviewMetadata, error) {
	params := sqlc.GetOldPreviewsParams{
		AccessedAt: pgtype.Timestamptz{Time: cutoffTime, Valid: true},
		Limit:      limit,
	}

	rows, err := r.queries.GetOldPreviews(ctx, params)
	if err != nil {
		return nil, err
	}

	var result []*previews.PreviewMetadata
	for _, row := range rows {
		result = append(result, r.convertToPreviewMetadata(row))
	}

	return result, nil
}

// GetPreviewStats retrieves aggregated preview statistics
func (r *PreviewRepo) GetPreviewStats(ctx context.Context) (*previews.PreviewStats, error) {
	stats, err := r.queries.GetPreviewStats(ctx)
	if err != nil {
		return nil, err
	}

	// Get the stats record for cache hits/misses
	statsRecord, err := r.queries.GetPreviewStatsRecord(ctx)
	if err != nil {
		// If no stats record exists, return basic stats
		return &previews.PreviewStats{
			TotalGenerated: stats.TotalPreviews,
			TotalSizeBytes: stats.TotalSizeBytes,
			AverageTimeMS:  stats.AvgProcessingMs,
		}, nil
	}

	return &previews.PreviewStats{
		TotalGenerated: stats.TotalPreviews,
		TotalSizeBytes: stats.TotalSizeBytes,
		CacheHits:      statsRecord.CacheHits.Int64,
		CacheMisses:    statsRecord.CacheMisses.Int64,
		AverageTimeMS:  stats.AvgProcessingMs,
		LastCleanup:    statsRecord.LastCleanup.Time,
	}, nil
}

// UpdatePreviewStatsIncrement increments the preview statistics
func (r *PreviewRepo) UpdatePreviewStatsIncrement(ctx context.Context, generated int64, sizeBytes int64, cacheHits int64, cacheMisses int64) error {
	params := sqlc.UpdatePreviewStatsIncrementParams{
		TotalGenerated: pgtype.Int8{Int64: generated, Valid: true},
		TotalSizeBytes: pgtype.Int8{Int64: sizeBytes, Valid: true},
		CacheHits:      pgtype.Int8{Int64: cacheHits, Valid: true},
		CacheMisses:    pgtype.Int8{Int64: cacheMisses, Valid: true},
	}

	return r.queries.UpdatePreviewStatsIncrement(ctx, params)
}

// UpdatePreviewStatsCleanup updates the last cleanup timestamp
func (r *PreviewRepo) UpdatePreviewStatsCleanup(ctx context.Context) error {
	return r.queries.UpdatePreviewStatsCleanup(ctx)
}

// CleanupOrphanedPreviews removes previews for files that no longer exist
func (r *PreviewRepo) CleanupOrphanedPreviews(ctx context.Context) error {
	return r.queries.CleanupOrphanedPreviews(ctx)
}

// GetPreviewsNeedingCleanup retrieves previews that need cleanup
func (r *PreviewRepo) GetPreviewsNeedingCleanup(ctx context.Context, cutoffTime time.Time) ([]sqlc.GetPreviewsNeedingCleanupRow, error) {
	return r.queries.GetPreviewsNeedingCleanup(ctx, pgtype.Timestamptz{Time: cutoffTime, Valid: true})
}

// BulkDeletePreviews deletes multiple previews by storage path
func (r *PreviewRepo) BulkDeletePreviews(ctx context.Context, storagePaths []string) error {
	return r.queries.BulkDeletePreviews(ctx, storagePaths)
}

// GetPreviewCountByFileIDs gets preview counts for multiple files
func (r *PreviewRepo) GetPreviewCountByFileIDs(ctx context.Context, fileIDs []int64) ([]sqlc.GetPreviewCountByFileIDsRow, error) {
	return r.queries.GetPreviewCountByFileIDs(ctx, fileIDs)
}

// convertToPreviewMetadata converts a database row to PreviewMetadata
func (r *PreviewRepo) convertToPreviewMetadata(row sqlc.Previews) *previews.PreviewMetadata {
	metadata := &previews.PreviewMetadata{
		ID:           row.ID,
		FileID:       row.FileID,
		Type:         previews.PreviewType(row.Type),
		Size:         previews.PreviewSize(row.Size),
		Format:       row.Format,
		FileSize:     row.FileSize,
		ContentHash:  row.ContentHash,
		StoragePath:  row.StoragePath,
		ProcessingMS: row.ProcessingMs.Int64,
		CreatedAt:    row.CreatedAt,
		AccessedAt:   row.AccessedAt.Time,
	}

	if row.Width.Valid {
		metadata.Width = int(row.Width.Int32)
	}

	if row.Height.Valid {
		metadata.Height = int(row.Height.Int32)
	}

	if row.TimeOffset.Valid {
		metadata.TimeOffset = row.TimeOffset.Float64
	}

	return metadata
}

// FindExistingPreview checks if a preview already exists for the given parameters
func (r *PreviewRepo) FindExistingPreview(ctx context.Context, fileID int64, previewType previews.PreviewType, size previews.PreviewSize, timeOffset float64) (*previews.PreviewMetadata, error) {
	return r.GetPreviewForFileByTypeSize(ctx, fileID, previewType, size, timeOffset)
}