// Package store provides the transactional layer
// Store manages transactions and provides access to repositories
// No SQL or business logic here - only transaction orchestration
package store

import (
	"context"
	"time"

	"github.com/mantonx/volumeviz/internal/repo"
)

// Store provides access to repositories with transaction support
type Store interface {
	// WithTx executes a function within a database transaction
	WithTx(ctx context.Context, fn func(TxStore) error) error

	// Repository access (non-transactional)
	Volumes() repo.VolumesRepo
	Scans() repo.ScansRepo
	Retention() repo.RetentionRepo
	// TODO: Add other repos as they're implemented
	// Stats() repo.StatsRepo
	// Offsets() repo.OffsetsRepo

	// Analytics and snapshots methods
	CreateUsageSnapshot(ctx context.Context, params CreateUsageSnapshotParams) (*UsageSnapshot, error)
	GetLatestSnapshot(ctx context.Context, volumeID, snapshotType string) (*UsageSnapshot, error)
	Get7DayTrend(ctx context.Context, volumeID string) (*TrendData, error)
	Get30DayTrend(ctx context.Context, volumeID string) (*TrendData, error)
	GetVolumeStepSeries(ctx context.Context, params GetVolumeStepSeriesParams) ([]*StepSeriesPoint, error)
	GetTrendSlope(ctx context.Context, params GetTrendSlopeParams) (*TrendSlope, error)
	GetGrowthDeltas(ctx context.Context, params GetGrowthDeltasParams) (*GrowthDeltas, error)
}

// TxStore provides access to repositories within a transaction context
type TxStore interface {
	// Repository access (transactional)
	Volumes() repo.VolumesRepo
	Scans() repo.ScansRepo
	Retention() repo.RetentionRepo
	// TODO: Add other repos as they're implemented  
	// Stats() repo.StatsRepo
	// Offsets() repo.OffsetsRepo
}

// ==============================================================================
// ANALYTICS AND SNAPSHOTS MODELS
// These support the existing analytics services
// ==============================================================================

// UsageSnapshot represents a usage snapshot
type UsageSnapshot struct {
	ID                    int64     `json:"id"`
	VolumeID              string    `json:"volume_id"`
	SnapshotDate          time.Time `json:"snapshot_date"`
	SnapshotType          string    `json:"snapshot_type"`
	TotalSize             int64     `json:"total_size"`
	FileCount             int64     `json:"file_count"`
	DirectoryCount        int64     `json:"directory_count"`
	LargestFile           int64     `json:"largest_file"`
	GrowthBytes           *int64    `json:"growth_bytes,omitempty"`
	GrowthFiles           *int64    `json:"growth_files,omitempty"`
	GrowthRateBytesPerDay *float64  `json:"growth_rate_bytes_per_day,omitempty"`
	ScanMethod            string    `json:"scan_method"`
	ScanDurationMs        *int64    `json:"scan_duration_ms,omitempty"`
	CreatedAt             time.Time `json:"created_at"`
	UpdatedAt             time.Time `json:"updated_at"`
}

// TrendData represents trend analysis data
type TrendData struct {
	VolumeID              string    `json:"volume_id"`
	TrendPeriod           string    `json:"trend_period"`
	StartDate             time.Time `json:"start_date"`
	EndDate               time.Time `json:"end_date"`
	StartSize             int64     `json:"start_size"`
	EndSize               int64     `json:"end_size"`
	SizeChange            int64     `json:"size_change"`
	StartFileCount        int64     `json:"start_file_count"`
	EndFileCount          int64     `json:"end_file_count"`
	FileCountChange       int64     `json:"file_count_change"`
	GrowthRateBytesPerDay float64   `json:"growth_rate_bytes_per_day"`
	GrowthRateFilesPerDay float64   `json:"growth_rate_files_per_day"`
}

// StepSeriesPoint represents a point in a step series chart
type StepSeriesPoint struct {
	Timestamp   time.Time `json:"timestamp"`
	Size        int64     `json:"size"`
	FileCount   int64     `json:"file_count"`
	GrowthBytes *int64    `json:"growth_bytes,omitempty"`
	GrowthFiles *int64    `json:"growth_files,omitempty"`
}

// CreateUsageSnapshotParams represents parameters for creating a usage snapshot
type CreateUsageSnapshotParams struct {
	VolumeID              string    `json:"volume_id"`
	SnapshotDate          time.Time `json:"snapshot_date"`
	SnapshotType          string    `json:"snapshot_type"`
	TotalSize             int64     `json:"total_size"`
	FileCount             int64     `json:"file_count"`
	DirectoryCount        int64     `json:"directory_count"`
	LargestFile           int64     `json:"largest_file"`
	GrowthBytes           *int64    `json:"growth_bytes,omitempty"`
	GrowthFiles           *int64    `json:"growth_files,omitempty"`
	GrowthRateBytesPerDay *float64  `json:"growth_rate_bytes_per_day,omitempty"`
	ScanMethod            string    `json:"scan_method"`
	ScanDurationMs        *int64    `json:"scan_duration_ms,omitempty"`
}

// GetVolumeStepSeriesParams represents parameters for getting volume step series
type GetVolumeStepSeriesParams struct {
	VolumeID  string    `json:"volume_id"`
	StartDate time.Time `json:"start_date"`
	EndDate   time.Time `json:"end_date"`
	StepSize  string    `json:"step_size"`
}

// GetTrendSlopeParams represents parameters for getting trend slope
type GetTrendSlopeParams struct {
	VolumeID  string    `json:"volume_id"`
	StartDate time.Time `json:"start_date"`
	EndDate   time.Time `json:"end_date"`
}

// TrendSlope represents the slope of a trend line
type TrendSlope struct {
	SizeSlope      float64 `json:"size_slope"`
	FileCountSlope float64 `json:"file_count_slope"`
}

// GetGrowthDeltasParams represents parameters for getting growth deltas
type GetGrowthDeltasParams struct {
	VolumeID  string    `json:"volume_id"`
	StartDate time.Time `json:"start_date"`
	EndDate   time.Time `json:"end_date"`
}

// GrowthDeltas represents growth deltas over a period
type GrowthDeltas struct {
	VolumeID    string  `json:"volume_id"`
	SizeGrowth  int64   `json:"size_growth"`
	FileGrowth  int64   `json:"file_growth"`
	GrowthRate  float64 `json:"growth_rate"`
	Period      string  `json:"period"`
}