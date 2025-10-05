package repo

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgtype"
	"github.com/mantonx/volumeviz/internal/db/sqlc"
)

// SnapshotRepo provides operations for volume snapshots (incremental scanning)
type SnapshotRepo interface {
	// Volume snapshot operations
	CreateSnapshot(ctx context.Context, snapshot VolumeSnapshot) (*VolumeSnapshot, error)
	GetLatestSnapshot(ctx context.Context, volumeID string) (*VolumeSnapshot, error)
	GetSnapshotByScanID(ctx context.Context, scanID string) (*VolumeSnapshot, error)
	GetSnapshots(ctx context.Context, volumeID string, limit int) ([]*VolumeSnapshot, error)
	DeleteOldSnapshots(ctx context.Context, olderThan time.Time) (int64, error)
	DeleteSnapshotsByVolume(ctx context.Context, volumeID string) error
	CountSnapshots(ctx context.Context, volumeID string) (int64, error)

	// Directory snapshot operations
	CreateDirectorySnapshot(ctx context.Context, dirSnapshot DirectorySnapshot) (*DirectorySnapshot, error)
	GetDirectorySnapshots(ctx context.Context, snapshotID int64) ([]*DirectorySnapshot, error)
	GetDirectorySnapshotByPath(ctx context.Context, snapshotID int64, dirPath string) (*DirectorySnapshot, error)
	GetChangedDirectories(ctx context.Context, prevSnapshotID, currSnapshotID int64) ([]*DirectoryChange, error)

	// Statistics
	GetStats(ctx context.Context) (*SnapshotStats, error)
}

// VolumeSnapshot represents a snapshot of a volume at a point in time
type VolumeSnapshot struct {
	ID                 int64
	VolumeID           string
	ScanID             string
	SnapshotTime       time.Time
	ScanMethod         string
	TotalSize          int64
	FileCount          int64
	FolderCount        int64
	RootMtime          *time.Time
	ContentHash        string
	ScanDurationMS     *int64
	IndexingDurationMS *int64
	CreatedAt          time.Time
}

// DirectorySnapshot represents a directory snapshot for change detection
type DirectorySnapshot struct {
	ID           int64
	SnapshotID   int64
	VolumeID     string
	DirPath      string
	DirMtime     time.Time
	DirSize      int64
	FileCount    int32
	SubdirCount  int32
	ContentHash  string
	CreatedAt    time.Time
}

// DirectoryChange represents a detected change in a directory
type DirectoryChange struct {
	DirPath    string
	ChangeType string // 'added', 'deleted', 'modified', 'unchanged'
}

// SnapshotStats provides aggregate statistics about snapshots
type SnapshotStats struct {
	TotalSnapshots      int64
	TotalVolumes        int64
	TotalSizeTracked    int64
	TotalFilesTracked   int64
	AvgScanDurationMS   float64
}

type snapshotRepo struct {
	queries *sqlc.Queries
}

// NewSnapshotRepo creates a new snapshot repository
func NewSnapshotRepo(queries *sqlc.Queries) SnapshotRepo {
	return &snapshotRepo{queries: queries}
}

// CreateSnapshot creates a new volume snapshot
func (r *snapshotRepo) CreateSnapshot(ctx context.Context, snapshot VolumeSnapshot) (*VolumeSnapshot, error) {
	params := sqlc.CreateVolumeSnapshotParams{
		VolumeID:  snapshot.VolumeID,
		ScanID:    snapshot.ScanID,
		SnapshotTime: pgtype.Timestamptz{
			Time:  snapshot.SnapshotTime,
			Valid: true,
		},
		ScanMethod:  snapshot.ScanMethod,
		TotalSize:   snapshot.TotalSize,
		FileCount:   snapshot.FileCount,
		FolderCount: snapshot.FolderCount,
		RootMtime: pgtype.Timestamptz{
			Time:  time.Time{},
			Valid: false,
		},
		ContentHash: pgtype.Text{
			String: snapshot.ContentHash,
			Valid:  snapshot.ContentHash != "",
		},
		ScanDurationMs: pgtype.Int8{
			Int64: 0,
			Valid: false,
		},
		IndexingDurationMs: pgtype.Int8{
			Int64: 0,
			Valid: false,
		},
	}

	if snapshot.RootMtime != nil {
		params.RootMtime = pgtype.Timestamptz{
			Time:  *snapshot.RootMtime,
			Valid: true,
		}
	}

	if snapshot.ScanDurationMS != nil {
		params.ScanDurationMs = pgtype.Int8{
			Int64: *snapshot.ScanDurationMS,
			Valid: true,
		}
	}

	if snapshot.IndexingDurationMS != nil {
		params.IndexingDurationMs = pgtype.Int8{
			Int64: *snapshot.IndexingDurationMS,
			Valid: true,
		}
	}

	row, err := r.queries.CreateVolumeSnapshot(ctx, params)
	if err != nil {
		return nil, fmt.Errorf("failed to create snapshot: %w", err)
	}

	return r.rowToSnapshot(row), nil
}

// GetLatestSnapshot gets the most recent snapshot for a volume
func (r *snapshotRepo) GetLatestSnapshot(ctx context.Context, volumeID string) (*VolumeSnapshot, error) {
	row, err := r.queries.GetLatestSnapshotForVolume(ctx, volumeID)
	if err != nil {
		return nil, fmt.Errorf("failed to get latest snapshot: %w", err)
	}

	return r.rowToSnapshot(row), nil
}

// GetSnapshotByScanID gets a snapshot by scan ID
func (r *snapshotRepo) GetSnapshotByScanID(ctx context.Context, scanID string) (*VolumeSnapshot, error) {
	row, err := r.queries.GetSnapshotByScanID(ctx, scanID)
	if err != nil {
		return nil, fmt.Errorf("failed to get snapshot by scan ID: %w", err)
	}

	return r.rowToSnapshot(row), nil
}

// GetSnapshots gets recent snapshots for a volume
func (r *snapshotRepo) GetSnapshots(ctx context.Context, volumeID string, limit int) ([]*VolumeSnapshot, error) {
	rows, err := r.queries.GetSnapshotsForVolume(ctx, sqlc.GetSnapshotsForVolumeParams{
		VolumeID: volumeID,
		Limit:    int32(limit),
	})
	if err != nil {
		return nil, fmt.Errorf("failed to get snapshots: %w", err)
	}

	snapshots := make([]*VolumeSnapshot, 0, len(rows))
	for _, row := range rows {
		snapshots = append(snapshots, r.rowToSnapshot(row))
	}

	return snapshots, nil
}

// DeleteOldSnapshots deletes snapshots older than the specified time
func (r *snapshotRepo) DeleteOldSnapshots(ctx context.Context, olderThan time.Time) (int64, error) {
	count, err := r.queries.DeleteOldSnapshots(ctx, olderThan)
	if err != nil {
		return 0, fmt.Errorf("failed to delete old snapshots: %w", err)
	}
	return count, nil
}

// DeleteSnapshotsByVolume deletes all snapshots for a volume
func (r *snapshotRepo) DeleteSnapshotsByVolume(ctx context.Context, volumeID string) error {
	err := r.queries.DeleteSnapshotsByVolume(ctx, volumeID)
	if err != nil {
		return fmt.Errorf("failed to delete snapshots: %w", err)
	}
	return nil
}

// CountSnapshots counts snapshots for a volume
func (r *snapshotRepo) CountSnapshots(ctx context.Context, volumeID string) (int64, error) {
	count, err := r.queries.CountSnapshotsForVolume(ctx, volumeID)
	if err != nil {
		return 0, fmt.Errorf("failed to count snapshots: %w", err)
	}
	return count, nil
}

// CreateDirectorySnapshot creates a directory snapshot
func (r *snapshotRepo) CreateDirectorySnapshot(ctx context.Context, dirSnapshot DirectorySnapshot) (*DirectorySnapshot, error) {
	params := sqlc.CreateDirectorySnapshotParams{
		SnapshotID: dirSnapshot.SnapshotID,
		VolumeID:   dirSnapshot.VolumeID,
		DirPath:    dirSnapshot.DirPath,
		DirMtime: pgtype.Timestamptz{
			Time:  dirSnapshot.DirMtime,
			Valid: true,
		},
		DirSize:     dirSnapshot.DirSize,
		FileCount:   dirSnapshot.FileCount,
		SubdirCount: dirSnapshot.SubdirCount,
		ContentHash: pgtype.Text{
			String: dirSnapshot.ContentHash,
			Valid:  dirSnapshot.ContentHash != "",
		},
	}

	row, err := r.queries.CreateDirectorySnapshot(ctx, params)
	if err != nil {
		return nil, fmt.Errorf("failed to create directory snapshot: %w", err)
	}

	return r.rowToDirectorySnapshot(row), nil
}

// GetDirectorySnapshots gets all directory snapshots for a snapshot
func (r *snapshotRepo) GetDirectorySnapshots(ctx context.Context, snapshotID int64) ([]*DirectorySnapshot, error) {
	rows, err := r.queries.GetDirectorySnapshotsForSnapshot(ctx, snapshotID)
	if err != nil {
		return nil, fmt.Errorf("failed to get directory snapshots: %w", err)
	}

	dirSnapshots := make([]*DirectorySnapshot, 0, len(rows))
	for _, row := range rows {
		dirSnapshots = append(dirSnapshots, r.rowToDirectorySnapshot(row))
	}

	return dirSnapshots, nil
}

// GetDirectorySnapshotByPath gets a specific directory snapshot
func (r *snapshotRepo) GetDirectorySnapshotByPath(ctx context.Context, snapshotID int64, dirPath string) (*DirectorySnapshot, error) {
	row, err := r.queries.GetDirectorySnapshotByPath(ctx, sqlc.GetDirectorySnapshotByPathParams{
		SnapshotID: snapshotID,
		DirPath:    dirPath,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to get directory snapshot: %w", err)
	}

	return r.rowToDirectorySnapshot(row), nil
}

// GetChangedDirectories gets directories that changed between snapshots
func (r *snapshotRepo) GetChangedDirectories(ctx context.Context, prevSnapshotID, currSnapshotID int64) ([]*DirectoryChange, error) {
	rows, err := r.queries.GetChangedDirectories(ctx, sqlc.GetChangedDirectoriesParams{
		PrevSnapshotID: prevSnapshotID,
		CurrSnapshotID: currSnapshotID,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to get changed directories: %w", err)
	}

	changes := make([]*DirectoryChange, 0, len(rows))
	for _, row := range rows {
		changes = append(changes, &DirectoryChange{
			DirPath:    row.DirPath,
			ChangeType: row.ChangeType,
		})
	}

	return changes, nil
}

// GetStats gets aggregate statistics about snapshots
func (r *snapshotRepo) GetStats(ctx context.Context) (*SnapshotStats, error) {
	row, err := r.queries.GetSnapshotStats(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to get snapshot stats: %w", err)
	}

	stats := &SnapshotStats{
		TotalSnapshots:    row.TotalSnapshots,
		TotalVolumes:      row.TotalVolumes,
		TotalSizeTracked:  row.TotalSizeTracked,
		TotalFilesTracked: row.TotalFilesTracked,
		AvgScanDurationMS: row.AvgScanDurationMs,
	}

	return stats, nil
}

// rowToSnapshot converts a database row to VolumeSnapshot
func (r *snapshotRepo) rowToSnapshot(row sqlc.VolumeSnapshots) *VolumeSnapshot {
	snapshot := &VolumeSnapshot{
		ID:           row.ID,
		VolumeID:     row.VolumeID,
		ScanID:       row.ScanID,
		SnapshotTime: row.SnapshotTime.Time,
		ScanMethod:   row.ScanMethod,
		TotalSize:    row.TotalSize,
		FileCount:    row.FileCount,
		FolderCount:  row.FolderCount,
		ContentHash:  row.ContentHash.String,
		CreatedAt:    row.CreatedAt,
	}

	if row.RootMtime.Valid {
		snapshot.RootMtime = &row.RootMtime.Time
	}

	if row.ScanDurationMs.Valid {
		snapshot.ScanDurationMS = &row.ScanDurationMs.Int64
	}

	if row.IndexingDurationMs.Valid {
		snapshot.IndexingDurationMS = &row.IndexingDurationMs.Int64
	}

	return snapshot
}

// rowToDirectorySnapshot converts a database row to DirectorySnapshot
func (r *snapshotRepo) rowToDirectorySnapshot(row sqlc.VolumeDirectorySnapshots) *DirectorySnapshot {
	return &DirectorySnapshot{
		ID:          row.ID,
		SnapshotID:  row.SnapshotID,
		VolumeID:    row.VolumeID,
		DirPath:     row.DirPath,
		DirMtime:    row.DirMtime.Time,
		DirSize:     row.DirSize,
		FileCount:   row.FileCount,
		SubdirCount: row.SubdirCount,
		ContentHash: row.ContentHash.String,
		CreatedAt:   row.CreatedAt,
	}
}
