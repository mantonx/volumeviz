package repo

import (
	"context"
	"fmt"
	"math/big"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/mantonx/volumeviz/internal/db/sqlc"
	"github.com/mantonx/volumeviz/internal/interfaces"
	"github.com/mantonx/volumeviz/internal/models"
)

// StatsRepo handles daily statistics operations
type StatsRepo struct {
	queries *sqlc.Queries
}

// NewStatsRepo creates a new stats repository
func NewStatsRepo(queries *sqlc.Queries) *StatsRepo {
	return &StatsRepo{
		queries: queries,
	}
}

// CreateDailyStat creates or updates a daily stat record
func (r *StatsRepo) CreateDailyStat(ctx context.Context, params models.CreateDailyStatParams) (*models.DailyStat, error) {
	row, err := r.queries.CreateDailyStat(ctx, sqlc.CreateDailyStatParams{
		Date:          timeToPgDate(params.Date),
		VolumeID:      params.VolumeID,
		FolderID:      int64PtrToPgInt8(params.FolderID),
		MediaKind:     stringPtrToPgText(params.MediaKind),
		FilesCount:    params.FilesCount,
		TotalBytes:    params.TotalBytes,
		AddedBytes:    params.AddedBytes,
		RemovedBytes:  params.RemovedBytes,
		AddedFiles:    params.AddedFiles,
		RemovedFiles:  params.RemovedFiles,
		ComputedAt:    params.ComputedAt,
		ScanID:        stringPtrToPgText(params.ScanID),
		JobDurationMs: int64PtrToPgInt8(params.JobDurationMs),
	})
	if err != nil {
		return nil, err
	}

	return &models.DailyStat{
		ID:         row.ID,
		ComputedAt: row.ComputedAt,
	}, nil
}

// Legacy Analytics Compatibility Methods
// These methods provide backward compatibility for the scheduler
// which still uses DirRollup models until migration is complete

// InsertVolumeStats inserts legacy volume statistics (compatibility method)
func (r *StatsRepo) InsertVolumeStats(ctx context.Context, stats *models.DirRollup) error {
	// DEPRECATED: This method has a bug - it doesn't have access to volume ID
	// For now, skip inserting stats to avoid foreign key constraint violations
	// TODO: Migrate scheduler to use proper volume-aware stats insertion
	return nil
}

// InsertScanResult inserts complete scan result including filesystem capacity
func (r *StatsRepo) InsertScanResult(ctx context.Context, scanResult *interfaces.ScanResult) error {
	// Convert ScanResult to InsertVolumeSizeParams
	params := sqlc.InsertVolumeSizeParams{
		VolumeID:        scanResult.VolumeID,
		TotalSize:       scanResult.TotalSize,
		FileCount:       int64(scanResult.FileCount),
		DirectoryCount:  int64(scanResult.DirectoryCount),
		LargestFile:     scanResult.LargestFile,
		ScanMethod:      scanResult.Method,
		ScanDuration:    scanResult.Duration.Nanoseconds(),
		FilesystemType:  pgtype.Text{String: scanResult.FilesystemType, Valid: scanResult.FilesystemType != ""},
		ChecksumMd5:     pgtype.Text{}, // TODO: Add checksum to ScanResult if needed
		IsValid:         pgtype.Bool{Bool: true, Valid: true},
		ErrorMessage:    pgtype.Text{}, // No error for successful scans
	}

	// Add filesystem capacity if available
	if scanResult.FilesystemCapacity != nil {
		params.FsTotalBytes = pgtype.Int8{Int64: scanResult.FilesystemCapacity.TotalBytes, Valid: true}
		params.FsAvailableBytes = pgtype.Int8{Int64: scanResult.FilesystemCapacity.AvailableBytes, Valid: true}
		params.FsUsedBytes = pgtype.Int8{Int64: scanResult.FilesystemCapacity.UsedBytes, Valid: true}
		params.FsUsagePercent = pgtype.Numeric{
			Int:   big.NewInt(int64(scanResult.FilesystemCapacity.UsagePercent * 100)), // Convert to basis points
			Exp:   -2, // Two decimal places
			Valid: true,
		}
		params.FsBlockSize = pgtype.Int8{Int64: int64(scanResult.FilesystemCapacity.BlockSize), Valid: true}
		params.FsTotalBlocks = pgtype.Int8{Int64: int64(scanResult.FilesystemCapacity.TotalBlocks), Valid: true}
		params.FsFreeBlocks = pgtype.Int8{Int64: int64(scanResult.FilesystemCapacity.FreeBlocks), Valid: true}
	}

	// Insert the scan result
	_, err := r.queries.InsertVolumeSize(ctx, params)
	return err
}

// GetVolumeFilesystemCapacity retrieves the latest filesystem capacity information for a volume
func (r *StatsRepo) GetVolumeFilesystemCapacity(ctx context.Context, volumeID string) (*interfaces.FilesystemInfo, error) {
	volumeSize, err := r.queries.GetLatestVolumeSize(ctx, volumeID)
	if err != nil {
		return nil, err
	}

	// Return nil if no filesystem capacity data is available
	if !volumeSize.FsTotalBytes.Valid {
		return nil, nil
	}

	// Convert pgtype values to FilesystemInfo
	fsInfo := &interfaces.FilesystemInfo{
		TotalBytes:     volumeSize.FsTotalBytes.Int64,
		AvailableBytes: volumeSize.FsAvailableBytes.Int64,
		UsedBytes:      volumeSize.FsUsedBytes.Int64,
		BlockSize:      volumeSize.FsBlockSize.Int64,
		TotalBlocks:    uint64(volumeSize.FsTotalBlocks.Int64),
		FreeBlocks:     uint64(volumeSize.FsFreeBlocks.Int64),
	}

	// Convert usage percentage from numeric to float64
	if volumeSize.FsUsagePercent.Valid {
		// Convert from basis points back to percentage
		fsInfo.UsagePercent = float64(volumeSize.FsUsagePercent.Int.Int64()) / 100.0
	}

	return fsInfo, nil
}

// InsertVolumeStatsWithVolumeID inserts volume statistics with proper volume ID
func (r *StatsRepo) InsertVolumeStatsWithVolumeID(ctx context.Context, volumeID string, stats *models.DirRollup) error {
	// Convert DirRollup to DailyStat for storage
	// This is a compatibility shim until scheduler is migrated
	params := models.CreateDailyStatParams{
		Date:          stats.ComputedAt.Truncate(24 * time.Hour), // Use computed date as the stat date
		VolumeID:      volumeID,                                  // Now properly provided
		FolderID:      nil,                                       // Root level stats (no specific folder)
		MediaKind:     nil,                                       // All media kinds combined
		FilesCount:    stats.FileCount,
		TotalBytes:    stats.SizeBytes,
		AddedBytes:    0, // Legacy stats don't track deltas
		RemovedBytes:  0,
		AddedFiles:    0,
		RemovedFiles:  0,
		ComputedAt:    time.Now(),
		ScanID:        nil, // Legacy stats don't track scan ID
		JobDurationMs: nil, // DirRollup doesn't have duration
	}

	_, err := r.CreateDailyStat(ctx, params)
	return err
}

// GetVolumeStatsByName retrieves legacy volume statistics (compatibility method)
func (r *StatsRepo) GetVolumeStatsByName(ctx context.Context, volumeName string, limit int) ([]*models.DirRollup, error) {
	// This is a compatibility method - for now return empty results
	// In a full migration, this would query DailyStat and convert to DirRollup
	return []*models.DirRollup{}, nil
}

// GetLatestVolumeStatsLegacy retrieves the latest legacy volume statistics (compatibility method)
func (r *StatsRepo) GetLatestVolumeStatsLegacy(ctx context.Context, volumeName string) (*models.DirRollup, error) {
	// This is a compatibility method - for now return empty result
	// In a full migration, this would query DailyStat and convert to DirRollup
	return &models.DirRollup{}, nil
}

// GetDailyStatsForDate retrieves all stats for a volume on a specific date
func (r *StatsRepo) GetDailyStatsForDate(ctx context.Context, volumeID string, date time.Time) ([]*models.DailyStat, error) {
	rows, err := r.queries.GetDailyStatsForDate(ctx, sqlc.GetDailyStatsForDateParams{
		VolumeID: volumeID,
		Date:     timeToPgDate(date),
	})
	if err != nil {
		return nil, err
	}

	stats := make([]*models.DailyStat, len(rows))
	for i, row := range rows {
		stats[i] = r.convertToDailyStat(row)
	}

	return stats, nil
}

// GetVolumeStatsHistory retrieves volume-level stats history
func (r *StatsRepo) GetVolumeStatsHistory(ctx context.Context, volumeID string, startDate, endDate time.Time) ([]*models.DailyStat, error) {
	rows, err := r.queries.GetVolumeStatsHistory(ctx, sqlc.GetVolumeStatsHistoryParams{
		VolumeID: volumeID,
		Date:     timeToPgDate(startDate),
		Date_2:   timeToPgDate(endDate),
	})
	if err != nil {
		return nil, err
	}

	stats := make([]*models.DailyStat, len(rows))
	for i, row := range rows {
		stats[i] = r.convertToDailyStat(row)
	}

	return stats, nil
}

// GetFolderGrowthTrends retrieves folder growth trends
func (r *StatsRepo) GetFolderGrowthTrends(ctx context.Context, volumeID string, since time.Time, limit int32) ([]*models.FolderGrowthTrend, error) {
	rows, err := r.queries.GetFolderGrowthTrends(ctx, sqlc.GetFolderGrowthTrendsParams{
		VolumeID: volumeID,
		Date:     timeToPgDate(since),
		Limit:    limit,
	})
	if err != nil {
		return nil, err
	}

	trends := make([]*models.FolderGrowthTrend, len(rows))
	for i, row := range rows {
		trends[i] = &models.FolderGrowthTrend{
			FolderID:     pgInt8ToInt64Ptr(row.FolderID),
			FolderName:   row.FolderName,
			FolderPath:   row.FolderPath,
			Date:         pgDateToTime(row.Date),
			TotalBytes:   row.TotalBytes,
			FilesCount:   row.FilesCount,
			AddedBytes:   row.AddedBytes,
			RemovedBytes: row.RemovedBytes,
			AddedFiles:   row.AddedFiles,
			RemovedFiles: row.RemovedFiles,
		}
	}

	return trends, nil
}

// GetTopGrowingFolders retrieves top growing folders in a time period
func (r *StatsRepo) GetTopGrowingFolders(ctx context.Context, volumeID string, since time.Time, limit int32) ([]*models.TopGrowingFolder, error) {
	rows, err := r.queries.GetTopGrowingFolders(ctx, sqlc.GetTopGrowingFoldersParams{
		VolumeID: volumeID,
		Date:     timeToPgDate(since),
		Limit:    limit,
	})
	if err != nil {
		return nil, err
	}

	folders := make([]*models.TopGrowingFolder, len(rows))
	for i, row := range rows {
		avgDailyStr := ""
		if row.AvgDailyAddedBytes > 0 {
			avgDailyStr = fmt.Sprintf("%.2f", row.AvgDailyAddedBytes)
		}
		folders[i] = &models.TopGrowingFolder{
			FolderID:           pgInt8ToInt64Ptr(row.FolderID),
			FolderName:         row.FolderName,
			FolderPath:         row.FolderPath,
			TotalAddedBytes:    row.TotalAddedBytes,
			TotalAddedFiles:    row.TotalAddedFiles,
			AvgDailyAddedBytes: &avgDailyStr,
			DaysTracked:        row.DaysTracked,
		}
	}

	return folders, nil
}

// GetMediaKindComposition retrieves media composition breakdown over time
func (r *StatsRepo) GetMediaKindComposition(ctx context.Context, volumeID string, startDate, endDate time.Time) ([]*models.MediaKindComposition, error) {
	rows, err := r.queries.GetMediaKindComposition(ctx, sqlc.GetMediaKindCompositionParams{
		VolumeID: volumeID,
		Date:     timeToPgDate(startDate),
		Date_2:   timeToPgDate(endDate),
	})
	if err != nil {
		return nil, err
	}

	composition := make([]*models.MediaKindComposition, len(rows))
	for i, row := range rows {
		composition[i] = &models.MediaKindComposition{
			MediaKind:       pgTextToStringPtr(row.MediaKind),
			Date:            pgDateToTime(row.Date),
			FilesCount:      row.FilesCount,
			TotalBytes:      row.TotalBytes,
			PercentOfVolume: pgNumericToStringPtr(row.PercentOfVolume),
		}
	}

	return composition, nil
}

// GetTrendAnalysis retrieves trend analysis data from the materialized view
func (r *StatsRepo) GetTrendAnalysis(ctx context.Context, volumeID string, startDate, endDate time.Time) ([]*models.TrendAnalysis, error) {
	rows, err := r.queries.GetTrendAnalysis(ctx, sqlc.GetTrendAnalysisParams{
		VolumeID: volumeID,
		Date:     timeToPgDate(startDate),
		Date_2:   timeToPgDate(endDate),
	})
	if err != nil {
		return nil, err
	}

	trends := make([]*models.TrendAnalysis, len(rows))
	for i, row := range rows {
		// Convert interface{} growth rates to strings
		var growthRate7d, growthRate30d *string
		if row.BytesGrowthRate7d != nil {
			if rate, ok := row.BytesGrowthRate7d.(string); ok {
				growthRate7d = &rate
			}
		}
		if row.BytesGrowthRate30d != nil {
			if rate, ok := row.BytesGrowthRate30d.(string); ok {
				growthRate30d = &rate
			}
		}

		// Convert int32 to int64 pointers
		bytesChange7d := int64(row.BytesChange7d)
		filesChange7d := int64(row.FilesChange7d)
		bytesChange30d := int64(row.BytesChange30d)
		filesChange30d := int64(row.FilesChange30d)

		trends[i] = &models.TrendAnalysis{
			Date:               pgDateToTime(row.Date),
			VolumeID:           row.VolumeID,
			FolderID:           pgInt8ToInt64Ptr(row.FolderID),
			MediaKind:          pgTextToStringPtr(row.MediaKind),
			FilesCount:         row.FilesCount,
			TotalBytes:         row.TotalBytes,
			AddedBytes:         row.AddedBytes,
			RemovedBytes:       row.RemovedBytes,
			BytesChange7d:      &bytesChange7d,
			FilesChange7d:      &filesChange7d,
			BytesChange30d:     &bytesChange30d,
			FilesChange30d:     &filesChange30d,
			BytesGrowthRate7d:  growthRate7d,
			BytesGrowthRate30d: growthRate30d,
			ComputedAt:         row.ComputedAt,
		}
	}

	return trends, nil
}

// GetLatestVolumeStats retrieves the most recent volume-level stats
func (r *StatsRepo) GetLatestVolumeStats(ctx context.Context, volumeID string) (*models.DailyStat, error) {
	row, err := r.queries.GetLatestVolumeStats(ctx, volumeID)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}

	return r.convertToDailyStat(row), nil
}

// ComputeVolumeDailyStats computes and stores daily aggregates for a volume
func (r *StatsRepo) ComputeVolumeDailyStats(ctx context.Context, volumeID string, date time.Time, scanID *string) error {
	return r.queries.ComputeVolumeDailyStats(ctx, sqlc.ComputeVolumeDailyStatsParams{
		VolumeID: volumeID,
		Column2:  timeToPgDate(date),
		ScanID:   stringPtrToPgText(scanID),
	})
}

// GetMissingStatsDates finds dates that are missing stats for a volume
func (r *StatsRepo) GetMissingStatsDates(ctx context.Context, volumeID string, startDate, endDate time.Time) ([]time.Time, error) {
	rows, err := r.queries.GetMissingStatsDates(ctx, sqlc.GetMissingStatsDatesParams{
		VolumeID: volumeID,
		Column2:  timeToPgDate(startDate),
		Column3:  timeToPgDate(endDate),
	})
	if err != nil {
		return nil, err
	}

	dates := make([]time.Time, len(rows))
	for i, row := range rows {
		dates[i] = pgDateToTime(row)
	}

	return dates, nil
}

// DeleteStatsForDate removes all stats for a volume on a specific date
func (r *StatsRepo) DeleteStatsForDate(ctx context.Context, volumeID string, date time.Time) error {
	return r.queries.DeleteStatsForDate(ctx, sqlc.DeleteStatsForDateParams{
		VolumeID: volumeID,
		Date:     timeToPgDate(date),
	})
}

// RefreshDailySummaryView refreshes the materialized view for performance
func (r *StatsRepo) RefreshDailySummaryView(ctx context.Context) error {
	return r.queries.RefreshDailySummaryView(ctx)
}

// Job tracking methods

// CreateStatsJob creates a new stats job record
func (r *StatsRepo) CreateStatsJob(ctx context.Context, jobType, volumeID string, startedAt time.Time, status string) (int64, error) {
	return r.queries.CreateStatsJob(ctx, sqlc.CreateStatsJobParams{
		JobType:   jobType,
		VolumeID:  stringPtrToPgText(&volumeID),
		StartedAt: timeToPgTimestamptz(startedAt),
		Status:    status,
	})
}

// UpdateStatsJob updates a stats job with completion information
func (r *StatsRepo) UpdateStatsJob(ctx context.Context, params models.UpdateStatsJobParams) error {
	return r.queries.UpdateStatsJob(ctx, sqlc.UpdateStatsJobParams{
		ID:             params.ID,
		CompletedAt:    timePtrToPgTimestamptz(params.CompletedAt),
		DurationMs:     int64PtrToPgInt8(params.DurationMs),
		Status:         params.Status,
		ErrorMessage:   stringPtrToPgText(params.ErrorMessage),
		ProcessedDates: int32PtrToPgInt4(params.ProcessedDates),
		RecordsCreated: int32PtrToPgInt4(params.RecordsCreated),
		RecordsUpdated: int32PtrToPgInt4(params.RecordsUpdated),
	})
}

// GetJobStatus retrieves the status of a specific job
func (r *StatsRepo) GetJobStatus(ctx context.Context, jobID int64) (*models.StatsJob, error) {
	row, err := r.queries.GetJobStatus(ctx, jobID)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}

	return r.convertToStatsJob(row), nil
}

// GetRecentJobs retrieves recent jobs of a specific type
func (r *StatsRepo) GetRecentJobs(ctx context.Context, jobType string, volumeID *string, limit int32) ([]*models.StatsJob, error) {
	volumeIDStr := ""
	if volumeID != nil {
		volumeIDStr = *volumeID
	}
	rows, err := r.queries.GetRecentJobs(ctx, sqlc.GetRecentJobsParams{
		JobType: jobType,
		Column2: volumeIDStr,
		Limit:   limit,
	})
	if err != nil {
		return nil, err
	}

	jobs := make([]*models.StatsJob, len(rows))
	for i, row := range rows {
		jobs[i] = r.convertToStatsJob(row)
	}

	return jobs, nil
}

// GetJobMetrics retrieves aggregated job metrics
func (r *StatsRepo) GetJobMetrics(ctx context.Context, jobType string, since time.Time) (*models.JobMetrics, error) {
	row, err := r.queries.GetJobMetrics(ctx, sqlc.GetJobMetricsParams{
		JobType:   jobType,
		StartedAt: timeToPgTimestamptz(since),
	})
	if err != nil {
		return nil, err
	}

	// Handle interface{} conversions for nullable timestamps
	var lastJobStarted *time.Time
	if row.LastJobStarted != nil {
		if ts, ok := row.LastJobStarted.(time.Time); ok {
			lastJobStarted = &ts
		}
	}

	var lastSuccess *time.Time
	if row.LastSuccess != nil {
		if ts, ok := row.LastSuccess.(time.Time); ok {
			lastSuccess = &ts
		}
	}

	// Convert float64 to string for compatibility
	avgDuration := ""
	if row.AvgDurationMs > 0 {
		avgDuration = fmt.Sprintf("%.2f", row.AvgDurationMs)
	}

	return &models.JobMetrics{
		TotalJobs:      row.TotalJobs,
		SuccessfulJobs: row.SuccessfulJobs,
		FailedJobs:     row.FailedJobs,
		AvgDurationMs:  &avgDuration,
		LastJobStarted: lastJobStarted,
		LastSuccess:    lastSuccess,
	}, nil
}

// Helper conversion functions

func (r *StatsRepo) convertToDailyStat(row sqlc.StatsDaily) *models.DailyStat {
	return &models.DailyStat{
		ID:            row.ID,
		Date:          pgDateToTime(row.Date),
		VolumeID:      row.VolumeID,
		FolderID:      pgInt8ToInt64Ptr(row.FolderID),
		MediaKind:     pgTextToStringPtr(row.MediaKind),
		FilesCount:    row.FilesCount,
		TotalBytes:    row.TotalBytes,
		AddedBytes:    row.AddedBytes,
		RemovedBytes:  row.RemovedBytes,
		AddedFiles:    row.AddedFiles,
		RemovedFiles:  row.RemovedFiles,
		ComputedAt:    row.ComputedAt,
		ScanID:        pgTextToStringPtr(row.ScanID),
		JobDurationMs: pgInt8ToInt64Ptr(row.JobDurationMs),
	}
}

func (r *StatsRepo) convertToStatsJob(row sqlc.StatsJobs) *models.StatsJob {
	return &models.StatsJob{
		ID:             row.ID,
		JobType:        row.JobType,
		VolumeID:       pgTextToStringPtr(row.VolumeID),
		StartedAt:      pgTimestamptzToTime(row.StartedAt),
		CompletedAt:    pgTimestamptzToTimePtr(row.CompletedAt),
		DurationMs:     pgInt8ToInt64Ptr(row.DurationMs),
		Status:         row.Status,
		ErrorMessage:   pgTextToStringPtr(row.ErrorMessage),
		ProcessedDates: pgInt4ToInt32Ptr(row.ProcessedDates),
		RecordsCreated: pgInt4ToInt32Ptr(row.RecordsCreated),
		RecordsUpdated: pgInt4ToInt32Ptr(row.RecordsUpdated),
	}
}
