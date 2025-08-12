package interfaces

import (
	"context"
	"time"
)

// RollupOptions defines options for rollup computation
type RollupOptions struct {
	FullRecompute    bool      `json:"full_recompute"`
	TouchedPaths     []string  `json:"touched_paths,omitempty"`
	CutoffTime       time.Time `json:"cutoff_time"`
	BatchSize        int       `json:"batch_size"`
	ParallelWorkers  int       `json:"parallel_workers"`
	SkipValidation   bool      `json:"skip_validation"`
}

// RollupResult contains the results of a rollup operation
type RollupResult struct {
	DirectoriesProcessed int           `json:"directories_processed"`
	RollupsCreated      int           `json:"rollups_created"`
	RollupsUpdated      int           `json:"rollups_updated"`
	ProcessingTime      time.Duration `json:"processing_time"`
	ErrorCount          int           `json:"error_count"`
	LastError           error         `json:"last_error,omitempty"`
}

// UsageSnapshot represents a snapshot of volume usage at a point in time
type UsageSnapshot struct {
	ID                    int64     `json:"id"`
	VolumeID              string    `json:"volume_id"`
	SnapshotDate          time.Time `json:"snapshot_date"`
	SnapshotType          string    `json:"snapshot_type"`
	TotalSize             int64     `json:"total_size"`
	FileCount             int64     `json:"file_count"`
	DirectoryCount        int64     `json:"directory_count"`
	LargestFile           int64     `json:"largest_file"`
	GrowthBytes           int64     `json:"growth_bytes"`
	GrowthFiles           int64     `json:"growth_files"`
	GrowthRateBytesPerDay float64   `json:"growth_rate_bytes_per_day"`
	ScanMethod            string    `json:"scan_method"`
	ScanDurationMs        int64     `json:"scan_duration_ms"`
	CreatedAt             time.Time `json:"created_at"`
	UpdatedAt             time.Time `json:"updated_at"`
}

// CreateUsageSnapshotParams holds parameters for creating a usage snapshot
type CreateUsageSnapshotParams struct {
	VolumeID              string    `json:"volume_id"`
	SnapshotDate          time.Time `json:"snapshot_date"`
	SnapshotType          string    `json:"snapshot_type"`
	TotalSize             int64     `json:"total_size"`
	FileCount             int64     `json:"file_count"`
	DirectoryCount        int64     `json:"directory_count"`
	LargestFile           int64     `json:"largest_file"`
	GrowthBytes           int64     `json:"growth_bytes"`
	GrowthFiles           int64     `json:"growth_files"`
	GrowthRateBytesPerDay float64   `json:"growth_rate_bytes_per_day"`
	ScanMethod            string    `json:"scan_method"`
	ScanDurationMs        int64     `json:"scan_duration_ms"`
}

// TrendData represents trending information for a volume
type TrendData struct {
	VolumeID       string    `json:"volume_id"`
	StartDate      time.Time `json:"start_date"`
	EndDate        time.Time `json:"end_date"`
	StartSize      int64     `json:"start_size"`
	EndSize        int64     `json:"end_size"`
	GrowthBytes    int64     `json:"growth_bytes"`
	GrowthPercent  float64   `json:"growth_percent"`
	DailyGrowthAvg float64   `json:"daily_growth_avg"`
	DataPoints     int       `json:"data_points"`
}

// GetGrowthDeltasParams defines parameters for getting growth deltas
type GetGrowthDeltasParams struct {
	VolumeID  string    `json:"volume_id"`
	StartDate time.Time `json:"start_date"`
	EndDate   time.Time `json:"end_date"`
}

// GrowthDeltasResult contains growth delta information
type GrowthDeltasResult struct {
	VolumeID    string  `json:"volume_id"`
	TotalGrowth int64   `json:"total_growth"`
	GrowthRate  float64 `json:"growth_rate"`
}

// GetVolumeStepSeriesParams defines parameters for getting volume step series
type GetVolumeStepSeriesParams struct {
	VolumeID  string    `json:"volume_id"`
	StartDate time.Time `json:"start_date"`
	EndDate   time.Time `json:"end_date"`
	StepSize  string    `json:"step_size"` // "hour", "day", "week", "month"
}

// StepSeriesPoint represents a point in a step series
type StepSeriesPoint struct {
	Timestamp time.Time `json:"timestamp"`
	Value     int64     `json:"value"`
}

// GetTrendSlopeParams defines parameters for getting trend slope
type GetTrendSlopeParams struct {
	VolumeID  string    `json:"volume_id"`
	StartDate time.Time `json:"start_date"`
	EndDate   time.Time `json:"end_date"`
}

// TrendSlopeResult contains trend slope information
type TrendSlopeResult struct {
	VolumeID string  `json:"volume_id"`
	Slope    float64 `json:"slope"`
	RSquared float64 `json:"r_squared"`
}

// AnalyticsStore handles analytics and rollup operations
type AnalyticsStore interface {
	// Rollup computation
	Rollup(ctx context.Context, volumeID string, opts *RollupOptions) (*RollupResult, error)
	
	// Usage Snapshots Operations
	CreateUsageSnapshot(ctx context.Context, params CreateUsageSnapshotParams) (*UsageSnapshot, error)
	GetLatestSnapshot(ctx context.Context, volumeID, snapshotType string) (*UsageSnapshot, error)
	Get7DayTrend(ctx context.Context, volumeID string) (*TrendData, error)
	Get30DayTrend(ctx context.Context, volumeID string) (*TrendData, error)
	GetGrowthDeltas(ctx context.Context, params GetGrowthDeltasParams) (*GrowthDeltasResult, error)
	GetVolumeStepSeries(ctx context.Context, params GetVolumeStepSeriesParams) ([]*StepSeriesPoint, error)
	GetTrendSlope(ctx context.Context, params GetTrendSlopeParams) (*TrendSlopeResult, error)
}