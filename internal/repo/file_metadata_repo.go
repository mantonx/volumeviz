package repo

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/mantonx/volumeviz/internal/db/sqlc"
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

// SaveMetadata saves enriched metadata to the database
func (r *FileMetadataRepo) SaveMetadata(ctx context.Context, fileID int64, kind models.EnrichmentKind, metadata *models.MediaMetadata) error {
	// Convert metadata to JSON
	dataJSON, err := json.Marshal(metadata)
	if err != nil {
		return fmt.Errorf("failed to marshal metadata: %w", err)
	}

	// Create file metadata record
	_, err = r.queries.CreateFileMetadata(ctx, sqlc.CreateFileMetadataParams{
		FileID:     fileID,
		Kind:       string(kind),
		DataJson:   dataJSON,
		EnrichedAt: pgtype.Timestamptz{Time: time.Now(), Valid: true},
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
	metadata, err := r.queries.GetFileMetadataByKind(ctx, sqlc.GetFileMetadataByKindParams{
		FileID: fileID,
		Kind:   string(kind),
	})
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, nil // No metadata found
		}
		return nil, fmt.Errorf("failed to get file metadata: %w", err)
	}

	// Unmarshal JSON metadata
	var mediaMetadata models.MediaMetadata
	if err := json.Unmarshal(metadata.DataJson, &mediaMetadata); err != nil {
		return nil, fmt.Errorf("failed to unmarshal metadata: %w", err)
	}

	return &mediaMetadata, nil
}

// GetAllFileMetadata retrieves all enriched metadata for a specific file
func (r *FileMetadataRepo) GetAllFileMetadata(ctx context.Context, fileID int64) ([]sqlc.FileMetadata, error) {
	return r.queries.GetFileMetadata(ctx, fileID)
}

// GetFileMetadataByKind retrieves specific kind of metadata for a file
func (r *FileMetadataRepo) GetFileMetadataByKind(ctx context.Context, fileID int64, kind string) (sqlc.FileMetadata, error) {
	return r.queries.GetFileMetadataByKind(ctx, sqlc.GetFileMetadataByKindParams{
		FileID: fileID,
		Kind:   kind,
	})
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
	err := r.queries.BulkInsertFileMetadata(ctx, sqlc.BulkInsertFileMetadataParams{
		Column1: fileIDs,
		Column2: kinds,
		Column3: dataJSONs,
		Column4: pgTimestamps,
	})
	if err != nil {
		return fmt.Errorf("failed to bulk insert file metadata: %w", err)
	}

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
	files, err := r.queries.GetUnenrichedFiles(ctx, sqlc.GetUnenrichedFilesParams{
		VolumeID: volumeID,
		Limit:    int32(limit),
	})
	if err != nil {
		return nil, fmt.Errorf("failed to get unenriched files: %w", err)
	}

	// Convert to enricher FileInfo
	fileInfos := make([]models.FileInfo, len(files))
	for i, file := range files {
		fileInfos[i] = models.FileInfo{
			ID:       file.ID,
			Path:     file.Path,
			Name:     file.Name,
			MimeType: pgTextToString(file.Mime),
			Size:     file.SizeBytes,
			VolumeID: file.VolumeID,
		}
	}

	return fileInfos, nil
}

// GetEnrichmentProgress returns enrichment progress for a volume
func (r *FileMetadataRepo) GetEnrichmentProgress(ctx context.Context, volumeID string) (*models.EnrichmentProgress, error) {
	stats, err := r.queries.GetEnrichmentProgress(ctx, volumeID)
	if err != nil {
		return nil, fmt.Errorf("failed to get enrichment progress: %w", err)
	}

	progress := &models.EnrichmentProgress{
		VolumeID:        volumeID,
		Status:          "completed", // This is historical data
		TotalFiles:      stats.TotalEnrichable,
		ProcessedFiles:  stats.EnrichedCount,
		SuccessfulFiles: stats.EnrichedCount,
		LastUpdate:      time.Now(),
	}

	return progress, nil
}

// DeleteMetadata removes metadata for a file or volume
func (r *FileMetadataRepo) DeleteMetadata(ctx context.Context, fileID *int64, volumeID *string) error {
	if fileID != nil {
		err := r.queries.DeleteFileMetadataByFileID(ctx, *fileID)
		if err != nil {
			return fmt.Errorf("failed to delete file metadata: %w", err)
		}
	}

	if volumeID != nil {
		err := r.queries.DeleteFileMetadataByVolumeID(ctx, *volumeID)
		if err != nil {
			return fmt.Errorf("failed to delete volume metadata: %w", err)
		}
	}

	return nil
}

// updateFileEnrichedColumns updates the flattened metadata columns on the files table
func (r *FileMetadataRepo) updateFileEnrichedColumns(ctx context.Context, fileID int64, metadata *models.MediaMetadata) error {
	params := sqlc.UpdateFileEnrichedColumnsParams{
		ID: fileID,
	}

	// Map metadata to SQL parameters
	params.DurationMs = int64PtrToPgInt8(metadata.DurationMs)
	params.BitrateKbps = int32PtrToPgInt4(metadata.BitrateKbps)
	params.Width = int32PtrToPgInt4(metadata.Width)
	params.Height = int32PtrToPgInt4(metadata.Height)
	params.Fps = float64PtrToPgNumeric(metadata.FPS)
	params.ColorPrimaries = stringPtrToPgText(metadata.ColorPrimaries)
	params.TransferCharacteristic = stringPtrToPgText(metadata.TransferCharacteristic)
	params.HdrFormat = string(metadata.HDRFormat)
	params.CaptureDatetime = timePtrToPgTimestamptz(metadata.CaptureDateTime)
	params.CameraMake = stringPtrToPgText(metadata.CameraMake)
	params.CameraModel = stringPtrToPgText(metadata.CameraModel)
	params.LensModel = stringPtrToPgText(metadata.LensModel)
	params.Orientation = int32PtrToPgInt4(metadata.Orientation)
	params.GpsLatitude = float64PtrToPgNumeric(metadata.GPSLatitude)
	params.GpsLongitude = float64PtrToPgNumeric(metadata.GPSLongitude)
	params.SubtitleLanguage = stringPtrToPgText(metadata.Language)
	params.SubtitleFormat = stringPtrToPgText(metadata.Format)
	params.CueCount = int32PtrToPgInt4(metadata.CueCount)
	params.CoveragePercent = float64PtrToPgNumeric(metadata.CoveragePercent)
	params.AudioChannels = int32PtrToPgInt4(metadata.AudioChannels)
	params.AudioCodec = stringPtrToPgText(metadata.AudioCodec)
	params.AudioSampleRate = int32PtrToPgInt4(metadata.AudioSampleRate)
	params.VideoCodec = stringPtrToPgText(metadata.VideoCodec)
	params.VideoProfile = stringPtrToPgText(metadata.VideoProfile)
	params.VideoLevel = stringPtrToPgText(metadata.VideoLevel)

	err := r.queries.UpdateFileEnrichedColumns(ctx, params)
	if err != nil {
		return fmt.Errorf("failed to update file enriched columns: %w", err)
	}

	return nil
}

// GetDistinctMimeTypes returns distinct MIME types with file counts
func (r *FileMetadataRepo) GetDistinctMimeTypes(ctx context.Context) ([]sqlc.GetDistinctMimeTypesRow, error) {
	return r.queries.GetDistinctMimeTypes(ctx)
}

// GetDistinctMediaKinds returns distinct media kinds with file counts
func (r *FileMetadataRepo) GetDistinctMediaKinds(ctx context.Context) ([]sqlc.GetDistinctMediaKindsRow, error) {
	return r.queries.GetDistinctMediaKinds(ctx)
}

// GetDistinctExtensions returns distinct extensions with file counts
func (r *FileMetadataRepo) GetDistinctExtensions(ctx context.Context) ([]sqlc.GetDistinctExtensionsRow, error) {
	return r.queries.GetDistinctExtensions(ctx)
}
