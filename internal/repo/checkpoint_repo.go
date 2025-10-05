package repo

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgtype"
	"github.com/mantonx/volumeviz/internal/db/sqlc"
)

// CheckpointRepo provides operations for scan checkpoints (crash recovery)
type CheckpointRepo interface {
	SaveCheckpoint(ctx context.Context, checkpoint ScanCheckpoint) error
	LoadCheckpoint(ctx context.Context, scanID, checkpointType string) (*ScanCheckpoint, error)
	LoadLatestCheckpoint(ctx context.Context, scanID string) (*ScanCheckpoint, error)
	LoadAllCheckpoints(ctx context.Context, scanID string) ([]*ScanCheckpoint, error)
	DeleteCheckpoint(ctx context.Context, scanID, checkpointType string) error
	DeleteAllCheckpoints(ctx context.Context, scanID string) error
	CleanupOldCheckpoints(ctx context.Context, olderThan time.Time) (int64, error)
	GetStats(ctx context.Context) (*CheckpointStats, error)
}

// ScanCheckpoint represents a saved scan state for resume capability
type ScanCheckpoint struct {
	ID             int64
	ScanID         string
	VolumeID       string
	CheckpointType string // 'volume_scan', 'filesystem_indexing', 'enrichment'
	Phase          string
	Progress       float64 // 0.0 to 1.0
	ItemsProcessed int64
	BytesProcessed int64
	ErrorsCount    int64
	LastPath       string
	LastDepth      int
	LastFolderID   *int64                 // For resuming filesystem indexing
	ResumeData     map[string]interface{} // Method-specific data
	CreatedAt      time.Time
	UpdatedAt      time.Time
}

// CheckpointStats provides aggregate statistics about checkpoints
type CheckpointStats struct {
	TotalCheckpoints    int64
	TotalScans          int64
	TotalVolumes        int64
	AvgProgress         float64
	TotalItemsProcessed int64
	TotalBytesProcessed int64
}

type checkpointRepo struct {
	queries *sqlc.Queries
}

// NewCheckpointRepo creates a new checkpoint repository
func NewCheckpointRepo(queries *sqlc.Queries) CheckpointRepo {
	return &checkpointRepo{queries: queries}
}

// SaveCheckpoint saves or updates a checkpoint (upsert)
func (r *checkpointRepo) SaveCheckpoint(ctx context.Context, checkpoint ScanCheckpoint) error {
	// Marshal resume data to JSON
	var resumeDataJSON []byte
	var err error
	if checkpoint.ResumeData != nil {
		resumeDataJSON, err = json.Marshal(checkpoint.ResumeData)
		if err != nil {
			return fmt.Errorf("failed to marshal resume data: %w", err)
		}
	} else {
		resumeDataJSON = []byte("{}")
	}

	params := sqlc.CreateCheckpointParams{
		ScanID:         checkpoint.ScanID,
		VolumeID:       checkpoint.VolumeID,
		CheckpointType: checkpoint.CheckpointType,
		Phase:          checkpoint.Phase,
		Progress:       checkpoint.Progress,
		ItemsProcessed: checkpoint.ItemsProcessed,
		BytesProcessed: checkpoint.BytesProcessed,
		ErrorsCount:    checkpoint.ErrorsCount,
		LastPath: pgtype.Text{
			String: checkpoint.LastPath,
			Valid:  checkpoint.LastPath != "",
		},
		LastDepth: pgtype.Int4{
			Int32: int32(checkpoint.LastDepth),
			Valid: checkpoint.LastDepth > 0,
		},
		LastFolderID: pgtype.Int8{
			Int64: 0,
			Valid: false,
		},
		ResumeData: resumeDataJSON,
	}

	if checkpoint.LastFolderID != nil {
		params.LastFolderID = pgtype.Int8{
			Int64: *checkpoint.LastFolderID,
			Valid: true,
		}
	}

	_, err = r.queries.CreateCheckpoint(ctx, params)
	if err != nil {
		return fmt.Errorf("failed to save checkpoint: %w", err)
	}

	return nil
}

// LoadCheckpoint loads a specific checkpoint by scan ID and type
func (r *checkpointRepo) LoadCheckpoint(ctx context.Context, scanID, checkpointType string) (*ScanCheckpoint, error) {
	row, err := r.queries.GetCheckpoint(ctx, sqlc.GetCheckpointParams{
		ScanID:         scanID,
		CheckpointType: checkpointType,
	})
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil // No checkpoint found
		}
		return nil, fmt.Errorf("failed to load checkpoint: %w", err)
	}

	return r.rowToCheckpoint(row)
}

// LoadLatestCheckpoint loads the most recent checkpoint for a scan
func (r *checkpointRepo) LoadLatestCheckpoint(ctx context.Context, scanID string) (*ScanCheckpoint, error) {
	row, err := r.queries.GetLatestCheckpointForScan(ctx, scanID)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to load latest checkpoint: %w", err)
	}

	return r.rowToCheckpoint(row)
}

// LoadAllCheckpoints loads all checkpoints for a scan
func (r *checkpointRepo) LoadAllCheckpoints(ctx context.Context, scanID string) ([]*ScanCheckpoint, error) {
	rows, err := r.queries.GetAllCheckpointsForScan(ctx, scanID)
	if err != nil {
		return nil, fmt.Errorf("failed to load checkpoints: %w", err)
	}

	checkpoints := make([]*ScanCheckpoint, 0, len(rows))
	for _, row := range rows {
		checkpoint, err := r.rowToCheckpoint(row)
		if err != nil {
			return nil, err
		}
		checkpoints = append(checkpoints, checkpoint)
	}

	return checkpoints, nil
}

// DeleteCheckpoint deletes a specific checkpoint
func (r *checkpointRepo) DeleteCheckpoint(ctx context.Context, scanID, checkpointType string) error {
	err := r.queries.DeleteCheckpoint(ctx, sqlc.DeleteCheckpointParams{
		ScanID:         scanID,
		CheckpointType: checkpointType,
	})
	if err != nil {
		return fmt.Errorf("failed to delete checkpoint: %w", err)
	}
	return nil
}

// DeleteAllCheckpoints deletes all checkpoints for a scan
func (r *checkpointRepo) DeleteAllCheckpoints(ctx context.Context, scanID string) error {
	err := r.queries.DeleteAllCheckpointsForScan(ctx, scanID)
	if err != nil {
		return fmt.Errorf("failed to delete all checkpoints: %w", err)
	}
	return nil
}

// CleanupOldCheckpoints deletes checkpoints older than the specified time
func (r *checkpointRepo) CleanupOldCheckpoints(ctx context.Context, olderThan time.Time) (int64, error) {
	count, err := r.queries.DeleteOldCheckpoints(ctx, olderThan)
	if err != nil {
		return 0, fmt.Errorf("failed to cleanup old checkpoints: %w", err)
	}
	return count, nil
}

// GetStats retrieves aggregate checkpoint statistics
func (r *checkpointRepo) GetStats(ctx context.Context) (*CheckpointStats, error) {
	row, err := r.queries.GetCheckpointStats(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to get checkpoint stats: %w", err)
	}

	stats := &CheckpointStats{
		TotalCheckpoints:    row.TotalCheckpoints,
		TotalScans:          row.TotalScans,
		TotalVolumes:        row.TotalVolumes,
		AvgProgress:         row.AvgProgress,
		TotalItemsProcessed: row.TotalItemsProcessed,
		TotalBytesProcessed: row.TotalBytesProcessed,
	}

	return stats, nil
}

// rowToCheckpoint converts a database row to a ScanCheckpoint
func (r *checkpointRepo) rowToCheckpoint(row sqlc.ScanCheckpoints) (*ScanCheckpoint, error) {
	// Unmarshal resume data
	var resumeData map[string]interface{}
	if len(row.ResumeData) > 0 {
		if err := json.Unmarshal(row.ResumeData, &resumeData); err != nil {
			return nil, fmt.Errorf("failed to unmarshal resume data: %w", err)
		}
	}

	checkpoint := &ScanCheckpoint{
		ID:             row.ID,
		ScanID:         row.ScanID,
		VolumeID:       row.VolumeID,
		CheckpointType: row.CheckpointType,
		Phase:          row.Phase,
		Progress:       row.Progress,
		ItemsProcessed: row.ItemsProcessed,
		BytesProcessed: row.BytesProcessed,
		ErrorsCount:    row.ErrorsCount,
		LastPath:       row.LastPath.String,
		LastDepth:      int(row.LastDepth.Int32),
		ResumeData:     resumeData,
		CreatedAt:      row.CreatedAt,
		UpdatedAt:      row.UpdatedAt,
	}

	if row.LastFolderID.Valid {
		folderID := row.LastFolderID.Int64
		checkpoint.LastFolderID = &folderID
	}

	return checkpoint, nil
}
