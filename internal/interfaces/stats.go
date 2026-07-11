package interfaces

import (
	"context"
	"time"

	"github.com/mantonx/volumeviz/internal/models"
)

// StatsService defines the interface for daily statistics management
type StatsService interface {
	// OnScanCompleted is called when a volume scan completes
	// This triggers daily stats computation for the current date. fsInfo is
	// the host filesystem capacity observed during the scan (nil if unavailable)
	// and is persisted alongside the computed daily stats for capacity forecasting.
	OnScanCompleted(ctx context.Context, volumeID string, scanID *string, fsInfo *FilesystemInfo) error

	// ComputeHistoricalStats computes stats for a date range (used by nightly reconciliation)
	ComputeHistoricalStats(ctx context.Context, volumeID string, startDate, endDate time.Time) error

	// GetMissingStatsDateRange finds date ranges that need stats computation
	GetMissingStatsDateRange(ctx context.Context, volumeID string, lookbackDays int) ([]time.Time, error)

	// RefreshMaterializedViews refreshes the materialized views for better query performance
	RefreshMaterializedViews(ctx context.Context) error

	// Job monitoring methods
	GetStatsJobStatus(ctx context.Context, jobID int64) (*models.StatsJob, error)
	GetRecentJobs(ctx context.Context, jobType string, volumeID *string, limit int32) ([]*models.StatsJob, error)
	GetJobMetrics(ctx context.Context, jobType string, sinceDays int) (*models.JobMetrics, error)

	// Statistics retrieval methods
	GetLatestVolumeStats(ctx context.Context, volumeID string) (*models.DailyStat, error)
	GetVolumeStatsHistory(ctx context.Context, volumeID string, startDate, endDate time.Time) ([]*models.DailyStat, error)
	GetFolderGrowthTrends(ctx context.Context, volumeID string, sinceDays int, limit int32) ([]*models.FolderGrowthTrend, error)
	GetTopGrowingFolders(ctx context.Context, volumeID string, sinceDays int, limit int32) ([]*models.TopGrowingFolder, error)
	GetMediaKindComposition(ctx context.Context, volumeID string, startDate, endDate time.Time) ([]*models.MediaKindComposition, error)
	GetTrendAnalysis(ctx context.Context, volumeID string, startDate, endDate time.Time) ([]*models.TrendAnalysis, error)
}
