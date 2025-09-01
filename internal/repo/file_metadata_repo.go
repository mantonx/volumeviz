package repo

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/mantonx/volumeviz/internal/db/sqlc"
	sqlcSQLite "github.com/mantonx/volumeviz/internal/db/sqlc-sqlite"
	"github.com/mantonx/volumeviz/internal/models"
)

// FileMetadataRepo implements the MediaMetadataRepository interface
type FileMetadataRepo struct {
	queries *sqlc.Queries
}

// NewFileMetadataRepo creates a new file metadata repository
func NewFileMetadataRepo(queries *sqlc.Queries) *FileMetadataRepo {
	return &FileMetadataRepo{
		queries: queries,
	}
}

// NewSQLiteFileMetadataRepo creates a new SQLite file metadata repository
func NewSQLiteFileMetadataRepo(queries *sqlcSQLite.Queries) *FileMetadataRepo {
	// TODO: Implement SQLite-specific version
	return &FileMetadataRepo{
		queries: nil,
	}
}

// SaveMetadata saves enriched metadata to the database
func (r *FileMetadataRepo) SaveMetadata(ctx context.Context, fileID int64, kind models.EnrichmentKind, metadata *models.MediaMetadata) error {
	// Convert metadata to JSON
	dataJSON, err := json.Marshal(metadata)
	if err != nil {
		return fmt.Errorf("failed to marshal metadata: %w", err)
	}

	// Create file metadata record
	_, err = r.queries.CreateFileMetadata(ctx, sqlc.CreateFileMetadataParams{
		FileID:               fileID,
		RawMetadata:          dataJSON,
		ExtractorVersion:     pgtype.Text{String: "v1.0", Valid: true}, // Default version
		ExtractionDurationMs: pgtype.Int4{Valid: false}, // Not tracked in this context
		ErrorMessage:         pgtype.Text{Valid: false},
	})
	if err != nil {
		return fmt.Errorf("failed to create file metadata: %w", err)
	}

	// Update enriched columns on files table
	err = r.updateFileEnrichedColumns(ctx, fileID, metadata)
	if err != nil {
		return fmt.Errorf("failed to update file enriched columns: %w", err)
	}

	return nil
}

// GetMetadata retrieves enriched metadata for a specific file and kind
func (r *FileMetadataRepo) GetMetadata(ctx context.Context, fileID int64, kind models.EnrichmentKind) (*models.MediaMetadata, error) {
	metadata, err := r.queries.GetFileMetadata(ctx, fileID)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, nil // No metadata found
		}
		return nil, fmt.Errorf("failed to get file metadata: %w", err)
	}

	// Unmarshal JSON metadata
	var mediaMetadata models.MediaMetadata
	if err := json.Unmarshal(metadata.RawMetadata, &mediaMetadata); err != nil {
		return nil, fmt.Errorf("failed to unmarshal metadata: %w", err)
	}

	return &mediaMetadata, nil
}

// GetAllFileMetadata retrieves all enriched metadata for a specific file
func (r *FileMetadataRepo) GetAllFileMetadata(ctx context.Context, fileID int64) ([]sqlc.FileMetadata, error) {
	metadata, err := r.queries.GetFileMetadata(ctx, fileID)
	if err != nil {
		return nil, err
	}
	return []sqlc.FileMetadata{metadata}, nil
}

// GetFileMetadataByKind retrieves specific kind of metadata for a file (simplified)
func (r *FileMetadataRepo) GetFileMetadataByKind(ctx context.Context, fileID int64, kind string) (sqlc.FileMetadata, error) {
	// Temporarily simplified - kind filtering not supported in new schema
	return r.queries.GetFileMetadata(ctx, fileID)
}

// BulkSaveMetadata saves metadata for multiple files efficiently
func (r *FileMetadataRepo) BulkSaveMetadata(ctx context.Context, results []models.EnrichmentResult) error {
	if len(results) == 0 {
		return nil
	}

	// Prepare bulk insert data
	fileIDs := make([]int64, 0, len(results))
	kinds := make([]string, 0, len(results))
	dataJSONs := make([][]byte, 0, len(results))
	enrichedAts := make([]time.Time, 0, len(results))

	for _, result := range results {
		if !result.Success || result.Metadata == nil {
			continue
		}

		dataJSON, err := json.Marshal(result.Metadata)
		if err != nil {
			// Log error but continue with other results
			continue
		}

		fileIDs = append(fileIDs, result.FileID)
		kinds = append(kinds, string(result.Metadata.Kind))
		dataJSONs = append(dataJSONs, dataJSON)
		enrichedAts = append(enrichedAts, result.EnrichedAt)
	}

	if len(fileIDs) == 0 {
		return nil
	}

	// Convert timestamps to pgtype
	pgTimestamps := make([]pgtype.Timestamptz, len(enrichedAts))
	for i, ts := range enrichedAts {
		pgTimestamps[i] = pgtype.Timestamptz{Time: ts, Valid: true}
	}

	// Bulk insert metadata
	// Temporarily simplified - bulk insert not supported in new schema
	// TODO: Implement individual inserts or add bulk insert query
	// log.Printf("Bulk metadata save requested for %d files (simplified)", len(results))

	// Update enriched columns for each file
	// Note: This could be optimized with a bulk update in the future
	for i, result := range results {
		if !result.Success || result.Metadata == nil {
			continue
		}
		if err := r.updateFileEnrichedColumns(ctx, fileIDs[i], result.Metadata); err != nil {
			// Log error but continue
			continue
		}
	}

	return nil
}

// GetUnenrichedFiles returns files that need enrichment
func (r *FileMetadataRepo) GetUnenrichedFiles(ctx context.Context, volumeID string, limit int) ([]models.FileInfo, error) {
	// Temporarily simplified - unenriched file detection not supported in new schema
	// TODO: Implement query to find files without metadata
	// log.Printf("GetUnenrichedFiles requested for volume %s, limit %d (simplified)", volumeID, limit)
	return []models.FileInfo{}, nil
}

// GetUnenrichedFilesPaginated returns files that need enrichment with pagination
func (r *FileMetadataRepo) GetUnenrichedFilesPaginated(ctx context.Context, volumeID string, limit int, offset int64) ([]models.FileInfo, error) {
	// Temporarily simplified - query not available in new schema
	// TODO: Implement query to find files without metadata with pagination
	return []models.FileInfo{}, nil
}

// GetUnenrichedFileCount returns total count of files that need enrichment
func (r *FileMetadataRepo) GetUnenrichedFileCount(ctx context.Context, volumeID string) (int64, error) {
	// Temporarily simplified - query not available in new schema
	// TODO: Implement query to count files without metadata
	return 0, nil
}

// GetEnrichmentProgress returns enrichment progress for a volume
func (r *FileMetadataRepo) GetEnrichmentProgress(ctx context.Context, volumeID string) (*models.EnrichmentProgress, error) {
	// Temporarily simplified - query not available in new schema
	// TODO: Implement query to get enrichment progress
	progress := &models.EnrichmentProgress{
		VolumeID:        volumeID,
		Status:          "completed", // Default to completed
		TotalFiles:      0,
		ProcessedFiles:  0,
		SuccessfulFiles: 0,
		LastUpdate:      time.Now(),
	}

	return progress, nil
}

// DeleteMetadata removes metadata for a file or volume
func (r *FileMetadataRepo) DeleteMetadata(ctx context.Context, fileID *int64, volumeID *string) error {
	if fileID != nil {
		err := r.queries.DeleteFileMetadata(ctx, *fileID)
		if err != nil {
			return fmt.Errorf("failed to delete file metadata: %w", err)
		}
	}

	if volumeID != nil {
		err := r.queries.DeleteFileMetadataByVolume(ctx, *volumeID)
		if err != nil {
			return fmt.Errorf("failed to delete volume metadata: %w", err)
		}
	}

	return nil
}

// updateFileEnrichedColumns updates the flattened metadata columns on the files table
func (r *FileMetadataRepo) updateFileEnrichedColumns(ctx context.Context, fileID int64, metadata *models.MediaMetadata) error {
	// Temporarily simplified - update enriched columns not supported in new schema
	// The new schema stores metadata as JSON in file_metadata table
	// TODO: Add query to update specific file columns if needed
	return nil
}

// GetDistinctMimeTypes returns distinct MIME types with file counts
func (r *FileMetadataRepo) GetDistinctMimeTypes(ctx context.Context, volumeID string) ([]sqlc.GetDistinctMimeTypesRow, error) {
	return r.queries.GetDistinctMimeTypes(ctx, volumeID)
}

// GetDistinctMediaKinds returns distinct media kinds with file counts
func (r *FileMetadataRepo) GetDistinctMediaKinds(ctx context.Context, volumeID string) ([]sqlc.GetDistinctMediaKindsRow, error) {
	return r.queries.GetDistinctMediaKinds(ctx, volumeID)
}

// GetDistinctExtensions returns distinct extensions with file counts
func (r *FileMetadataRepo) GetDistinctExtensions(ctx context.Context, volumeID string, limit int32) ([]sqlc.GetDistinctExtensionsRow, error) {
	return r.queries.GetDistinctExtensions(ctx, sqlc.GetDistinctExtensionsParams{
		VolumeID: volumeID,
		Limit:    limit,
	})
}
