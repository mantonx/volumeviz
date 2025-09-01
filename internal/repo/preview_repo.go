package repo

import (
	"context"
	"time"

	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
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
		PreviewType: string(metadata.Type),
		FilePath:    metadata.StoragePath,
		FileSize:    pgtype.Int8{Int64: metadata.FileSize, Valid: true},
		Format:      pgtype.Text{String: metadata.Format, Valid: true},
		Status:      "completed",
		GeneratedAt: pgtype.Timestamptz{Time: time.Now(), Valid: true},
	}

	// Handle optional width
	if metadata.Width > 0 {
		params.Width = pgtype.Int4{Int32: int32(metadata.Width), Valid: true}
	}

	// Handle optional height
	if metadata.Height > 0 {
		params.Height = pgtype.Int4{Int32: int32(metadata.Height), Valid: true}
	}

	row, err := r.queries.CreatePreview(ctx, params)
	if err != nil {
		return nil, err
	}

	return r.convertToPreviewMetadata(row), nil
}

// GetPreview retrieves a preview by its ID
func (r *PreviewRepo) GetPreview(ctx context.Context, id int64) (*previews.PreviewMetadata, error) {
	row, err := r.queries.GetPreview(ctx, id)
	if err != nil {
		return nil, err
	}

	return r.convertToPreviewMetadata(row), nil
}

// GetPreviewByFileIDAndType retrieves a preview by file ID and type
func (r *PreviewRepo) GetPreviewByFileIDAndType(ctx context.Context, fileID int64, previewType string) (*previews.PreviewMetadata, error) {
	row, err := r.queries.GetPreviewByFileID(ctx, sqlc.GetPreviewByFileIDParams{
		FileID:      fileID,
		PreviewType: previewType,
	})
	if err != nil {
		return nil, err
	}

	return r.convertToPreviewMetadata(row), nil
}

// DeletePreview deletes a preview by its ID
func (r *PreviewRepo) DeletePreview(ctx context.Context, id int64) error {
	return r.queries.DeletePreview(ctx, id)
}

// DeletePreviewsByFileID deletes all previews for a file
func (r *PreviewRepo) DeletePreviewsByFileID(ctx context.Context, fileID int64) error {
	return r.queries.DeletePreviewsByFileID(ctx, fileID)
}

// GetPreviewsNeedingCleanup retrieves previews that need cleanup
func (r *PreviewRepo) GetPreviewsNeedingCleanup(ctx context.Context, cutoffTime time.Time) ([]sqlc.FilePreviews, error) {
	return r.queries.GetStaleFailedPreviews(ctx, 1000) // 1000 limit
}

// Helper method to convert sqlc preview to domain model
func (r *PreviewRepo) convertToPreviewMetadata(row sqlc.FilePreviews) *previews.PreviewMetadata {
	result := &previews.PreviewMetadata{
		ID:          row.ID,
		FileID:      row.FileID,
		Type:        previews.PreviewType(row.PreviewType),
		StoragePath: row.FilePath,
		FileSize:    pgInt8ToInt64(row.FileSize),
		Format:      pgTextToString(row.Format),
	}

	// Handle optional width
	if row.Width.Valid {
		result.Width = int(row.Width.Int32)
	}

	// Handle optional height
	if row.Height.Valid {
		result.Height = int(row.Height.Int32)
	}

	return result
}