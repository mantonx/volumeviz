package repo

import (
	"context"
	"fmt"
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
	return &StatsRepo{queries: queries}
}

// NewSQLiteStatsRepo creates a new SQLite stats repository
func NewSQLiteStatsRepo(queries interface{}) *StatsRepo {
	// TODO: Implement SQLite-specific version
	return &StatsRepo{queries: nil}
}

// CreateDailyStat creates a daily stat entry
func (r *StatsRepo) CreateDailyStat(ctx context.Context, volumeID string, date time.Time, totalFiles, newFiles, deletedFiles, modifiedFiles int64, totalSize, sizeChange int64, growthPercent float64) (*models.DailyStat, error) {
	row, err := r.queries.CreateDailyStat(ctx, sqlc.CreateDailyStatParams{
		VolumeID:        volumeID,
		Date:            timeToPgDate(date),
		TotalSizeBytes:  int64PtrToPgInt8(&totalSize),
		SizeChangeBytes: int64PtrToPgInt8(&sizeChange),
		GrowthPercent:   float64PtrToPgNumeric(&growthPercent),
		TotalFiles:      int64PtrToPgInt8(&totalFiles),
		NewFiles:        int64PtrToPgInt8(&newFiles),
		DeletedFiles:    int64PtrToPgInt8(&deletedFiles),
		ModifiedFiles:   int64PtrToPgInt8(&modifiedFiles),
	})
	if err != nil {
		return nil, err
	}

	return &models.DailyStat{
		ID:         row.ID,
		ComputedAt: row.CreatedAt,
	}, nil
}

// Legacy Analytics Compatibility Methods
// These methods provide backward compatibility for the scheduler
// which still uses DirRollup models until migration is complete

// StoreScanResult stores a scan result in the volume_sizes table
func (r *StatsRepo) StoreScanResult(ctx context.Context, scanResult *interfaces.ScanResult) error {
	// Invalidate previous results (soft delete by making them old)
	err := r.queries.InvalidatePreviousVolumeSizes(ctx, scanResult.VolumeID)
	if err != nil {
		// Log warning but continue - this is not critical
		// Old entries will be ignored anyway due to is_valid=false check
		fmt.Printf("[WARN] Failed to invalidate previous volume sizes for %s: %v\n", scanResult.VolumeID, err)
	}

	// Compute comprehensive file statistics from the files table
	stats, err := r.queries.ComputeVolumeFileStatistics(ctx, scanResult.VolumeID)
	if err != nil {
		// If stats computation fails, fall back to basic info from ScanResult
		fmt.Printf("[WARN] Failed to compute file statistics for %s, using basic scan data: %v\n", scanResult.VolumeID, err)

		params := sqlc.InsertVolumeSizeParams{
			VolumeID:              scanResult.VolumeID,
			TotalSize:             scanResult.TotalSize,
			FileCount:             int64(scanResult.FileCount),
			DirectoryCount:        int64(scanResult.DirectoryCount),
			LargestFileSize:       pgtype.Int8{Int64: scanResult.LargestFile, Valid: scanResult.LargestFile > 0},
			SmallestFileSize:      pgtype.Int8{Valid: false},
			AverageFileSize:       pgtype.Int8{Valid: false},
			MedianFileSize:        pgtype.Int8{Valid: false},
			TypeDistribution:      []byte("{}"),
			ExtensionDistribution: []byte("{}"),
			CalculatedAt:          pgtype.Timestamptz{Time: time.Now(), Valid: true},
		}
		return r.queries.InsertVolumeSize(ctx, params)
	}

	// Use computed statistics from files table
	// Convert interface{} types safely
	var totalSize, directoryCount int64

	if stats.TotalSize != nil {
		if val, ok := stats.TotalSize.(int64); ok {
			totalSize = val
		}
	}

	if stats.DirectoryCount != nil {
		if val, ok := stats.DirectoryCount.(int64); ok {
			directoryCount = val
		}
	}

	smallestFileSize := pgtype.Int8{Valid: false}
	if stats.SmallestFileSize != nil {
		if val, ok := stats.SmallestFileSize.(int64); ok {
			smallestFileSize = pgtype.Int8{Int64: val, Valid: true}
		}
	}

	largestFileSize := pgtype.Int8{Valid: false}
	if stats.LargestFileSize != nil {
		if val, ok := stats.LargestFileSize.(int64); ok {
			largestFileSize = pgtype.Int8{Int64: val, Valid: true}
		}
	}

	params := sqlc.InsertVolumeSizeParams{
		VolumeID:              scanResult.VolumeID,
		TotalSize:             totalSize,
		FileCount:             stats.FileCount,
		DirectoryCount:        directoryCount,
		LargestFileSize:       largestFileSize,
		SmallestFileSize:      smallestFileSize,
		AverageFileSize:       pgtype.Int8{Int64: stats.AverageFileSize, Valid: stats.AverageFileSize > 0},
		MedianFileSize:        pgtype.Int8{Int64: stats.MedianFileSize, Valid: stats.MedianFileSize > 0},
		TypeDistribution:      stats.TypeDistribution,
		ExtensionDistribution: stats.ExtensionDistribution,
		CalculatedAt:          pgtype.Timestamptz{Time: time.Now(), Valid: true},
	}

	// Insert the computed statistics
	err = r.queries.InsertVolumeSize(ctx, params)
	return err
}

// GetVolumeFilesystemCapacity retrieves the latest filesystem capacity information for a volume
func (r *StatsRepo) GetVolumeFilesystemCapacity(ctx context.Context, volumeID string) (*interfaces.FilesystemInfo, error) {
	volumeSize, err := r.queries.GetLatestVolumeSize(ctx, volumeID)
	if err != nil {
		return nil, err
	}

	// Return basic filesystem info based on available data
	// Note: The current schema doesn't include filesystem capacity fields,
	// so we provide basic information based on file count and total size
	fsInfo := &interfaces.FilesystemInfo{
		TotalBytes:     volumeSize.TotalSize,
		AvailableBytes: 0, // Not available in current schema
		UsedBytes:      volumeSize.TotalSize,
		BlockSize:      4096, // Default block size assumption
		TotalBlocks:    uint64(volumeSize.TotalSize / 4096),
		FreeBlocks:     0, // Not available in current schema
		UsagePercent:   0.0, // Not available in current schema
	}

	return fsInfo, nil
}

// GetLatestVolumeTotalSize retrieves the latest volume scan size from the database
func (r *StatsRepo) GetLatestVolumeTotalSize(ctx context.Context, volumeID string) (*int64, error) {
	// First try to get from volume_sizes table (legacy scan results)
	volumeSize, err := r.queries.GetLatestVolumeSize(ctx, volumeID)
	if err == nil && volumeSize.TotalSize > 0 {
		return &volumeSize.TotalSize, nil
	}

	// If not in volume_sizes, try the volumes table (new scan results)
	// Use system-level query since we don't have organization context here
	volume, err := r.queries.GetVolumeSystemLevel(ctx, volumeID)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}

	if !volume.TotalSizeBytes.Valid || volume.TotalSizeBytes.Int64 == 0 {
		return nil, nil
	}

	return &volume.TotalSizeBytes.Int64, nil
}

// GetVolumeGrowthInfo retrieves volume size growth information
func (r *StatsRepo) GetVolumeGrowthInfo(ctx context.Context, volumeID string) (*models.StatsSummary, error) {
	// This is a simple implementation that returns basic info
	// TODO: Implement proper growth calculation based on historical data
	volumeSize, err := r.queries.GetLatestVolumeSize(ctx, volumeID)
	if err != nil {
		if err == pgx.ErrNoRows {
			return &models.StatsSummary{
				VolumeID:     volumeID,
				TotalBytes:   0,
				TotalFiles:   0,
				LatestDate:   time.Now(),
			}, nil
		}
		return nil, err
	}

	return &models.StatsSummary{
		VolumeID:     volumeID,
		TotalBytes:   volumeSize.TotalSize,
		TotalFiles:   volumeSize.FileCount,
		LatestDate:   time.Now(),
	}, nil
}

// GetDailyStats retrieves daily stats for a volume within a date range
func (r *StatsRepo) GetDailyStats(ctx context.Context, volumeID string, startDate, endDate time.Time) ([]*models.DailyStat, error) {
	return r.GetVolumeStatsHistory(ctx, volumeID, startDate, endDate)
}

// UpdateDailyStatsDiskCapacity records the host filesystem capacity observed
// for a volume's mount at scan time, on that day's daily_stats row
func (r *StatsRepo) UpdateDailyStatsDiskCapacity(ctx context.Context, volumeID string, date time.Time, totalBytes, availableBytes int64) error {
	return r.queries.UpdateDailyStatsDiskCapacity(ctx, sqlc.UpdateDailyStatsDiskCapacityParams{
		VolumeID:           volumeID,
		Date:               timeToPgDate(date),
		DiskTotalBytes:     int64PtrToPgInt8(&totalBytes),
		DiskAvailableBytes: int64PtrToPgInt8(&availableBytes),
	})
}

// GetVolumeStatsHistory retrieves volume-level stats history
func (r *StatsRepo) GetVolumeStatsHistory(ctx context.Context, volumeID string, startDate, endDate time.Time) ([]*models.DailyStat, error) {
	rows, err := r.queries.GetVolumeStatsHistory(ctx, sqlc.GetVolumeStatsHistoryParams{
		VolumeID:     volumeID,
		DateFrom:     timeToPgDate(startDate),
		DateTo:       timeToPgDate(endDate),
		ResultOffset: 0,
		ResultLimit:  1000, // Default limit
	})
	if err != nil {
		return nil, err
	}

	stats := make([]*models.DailyStat, len(rows))
	for i, row := range rows {
		stats[i] = dailyStatsRowToModel(row)
	}

	return stats, nil
}

// dailyStatsRowToModel converts a sqlc DailyStats row into the domain DailyStat model
func dailyStatsRowToModel(row sqlc.DailyStats) *models.DailyStat {
	sizeChange := pgInt8ToInt64(row.SizeChangeBytes)
	var addedBytes, removedBytes int64
	if sizeChange > 0 {
		addedBytes = sizeChange
	} else {
		removedBytes = -sizeChange
	}

	return &models.DailyStat{
		ID:                 row.ID,
		VolumeID:           row.VolumeID,
		Date:               pgDateToTime(row.Date),
		ComputedAt:         row.CreatedAt,
		TotalBytes:         pgInt8ToInt64(row.TotalSizeBytes),
		AddedBytes:         addedBytes,
		RemovedBytes:       removedBytes,
		FilesCount:         pgInt8ToInt64(row.TotalFiles),
		AddedFiles:         pgInt8ToInt64(row.NewFiles),
		RemovedFiles:       pgInt8ToInt64(row.DeletedFiles),
		DiskTotalBytes:     pgInt8ToInt64Ptr(row.DiskTotalBytes),
		DiskAvailableBytes: pgInt8ToInt64Ptr(row.DiskAvailableBytes),
	}
}

// Stub implementations for missing SQLC methods

// GetFolderGrowthTrends retrieves folder growth trends
func (r *StatsRepo) GetFolderGrowthTrends(ctx context.Context, volumeID string, since time.Time, limit int32) ([]*models.FolderGrowthTrend, error) {
	rows, err := r.queries.GetFolderGrowthTrends(ctx, sqlc.GetFolderGrowthTrendsParams{
		VolumeID:   volumeID,
		ModifiedAt: pgtype.Timestamptz{Time: since, Valid: true},
		Limit:      limit,
	})
	if err != nil {
		return nil, err
	}

	trends := make([]*models.FolderGrowthTrend, len(rows))
	for i, row := range rows {
		trends[i] = &models.FolderGrowthTrend{
			FolderID:     &row.ID,
			FolderPath:   row.Path,
			Date:         row.UpdatedAt.Time,
			TotalBytes:   row.TotalSize.Int64,
			FilesCount:   int64(row.FileCount.Int32),
			AddedBytes:   int64(row.SizeChange),
			RemovedBytes: 0, // Not tracked in this query
		}
	}

	return trends, nil
}

// GetTopGrowingFolders retrieves top growing folders in a time period
func (r *StatsRepo) GetTopGrowingFolders(ctx context.Context, volumeID string, since time.Time, limit int32) ([]*models.TopGrowingFolder, error) {
	rows, err := r.queries.GetTopGrowingFolders(ctx, sqlc.GetTopGrowingFoldersParams{
		VolumeID:   volumeID,
		ModifiedAt: pgtype.Timestamptz{Time: since, Valid: true},
		Limit:      limit,
	})
	if err != nil {
		return nil, err
	}

	folders := make([]*models.TopGrowingFolder, len(rows))
	for i, row := range rows {
		folders[i] = &models.TopGrowingFolder{
			FolderID:        &row.ID,
			FolderPath:      row.Path,
			TotalAddedBytes: int64(row.SizeChange),
			TotalAddedFiles: 0, // Not tracked in this query
			DaysTracked:     1, // Simple implementation
		}
	}

	return folders, nil
}

// GetMediaKindComposition retrieves media kind composition for a volume
func (r *StatsRepo) GetMediaKindComposition(ctx context.Context, volumeID string) ([]*models.MediaKindComposition, error) {
	rows, err := r.queries.GetMediaKindComposition(ctx, volumeID)
	if err != nil {
		return nil, err
	}

	compositions := make([]*models.MediaKindComposition, len(rows))
	for i, row := range rows {
		mediaKind := ""
		if mk, ok := row.MediaKind.(string); ok {
			mediaKind = mk
		}

		compositions[i] = &models.MediaKindComposition{
			MediaKind:  &mediaKind,
			Date:       time.Now(),
			FilesCount: row.FileCount,
			TotalBytes: row.TotalBytes,
		}
	}

	return compositions, nil
}

// GetTrendAnalysis retrieves trend analysis for a volume
func (r *StatsRepo) GetTrendAnalysis(ctx context.Context, volumeID string, days int) (*models.TrendAnalysis, error) {
	row, err := r.queries.GetTrendAnalysis(ctx, sqlc.GetTrendAnalysisParams{
		VolumeID: volumeID,
		Column2:  int32(days),
	})
	if err != nil {
		if err == pgx.ErrNoRows {
			return &models.TrendAnalysis{
				VolumeID:   volumeID,
				Date:       time.Now(),
				FilesCount: 0,
				TotalBytes: 0,
				ComputedAt: time.Now(),
			}, nil
		}
		return nil, err
	}

	latestDate := time.Now()
	if ld, ok := row.LatestDate.(time.Time); ok {
		latestDate = ld
	}

	var filesCount int64
	if fc, ok := row.TotalFiles.(int64); ok {
		filesCount = fc
	}

	var totalBytes int64
	if tb, ok := row.TotalBytes.(int64); ok {
		totalBytes = tb
	}

	return &models.TrendAnalysis{
		VolumeID:   volumeID,
		Date:       latestDate,
		FilesCount: filesCount,
		TotalBytes: totalBytes,
		ComputedAt: time.Now(),
	}, nil
}

// Batch Processing and Advanced Analytics Methods

// GetLatestVolumeStats retrieves the latest volume statistics
func (r *StatsRepo) GetLatestVolumeStats(ctx context.Context, volumeID string) (*models.VolumeStats, error) {
	row, err := r.queries.GetLatestVolumeStats(ctx, volumeID)
	if err != nil {
		return nil, err
	}

	totalBytes := int64(0)
	if tb, ok := row.TotalBytes.(int64); ok {
		totalBytes = tb
	}

	totalFiles := int64(0)
	if tf, ok := row.TotalFiles.(int64); ok {
		totalFiles = tf
	}

	return &models.VolumeStats{
		TotalVolumes:   row.TotalVolumes,
		ActiveVolumes:  row.ActiveVolumes,
		ScannedVolumes: row.ScannedVolumes,
		TotalBytes:     totalBytes,
		TotalFiles:     totalFiles,
	}, nil
}

// ComputeVolumeDailyStats computes daily statistics for a volume
func (r *StatsRepo) ComputeVolumeDailyStats(ctx context.Context, volumeID string, date time.Time) error {
	return r.queries.ComputeVolumeDailyStats(ctx, sqlc.ComputeVolumeDailyStatsParams{
		Column1: volumeID,
		Column2: pgtype.Date{Time: date, Valid: true},
	})
}

// GetMissingStatsDates retrieves dates where stats are missing
func (r *StatsRepo) GetMissingStatsDates(ctx context.Context, volumeID string, startDate, endDate time.Time) ([]time.Time, error) {
	dates, err := r.queries.GetMissingStatsDates(ctx, sqlc.GetMissingStatsDatesParams{
		VolumeID: volumeID,
		Column2:  pgtype.Date{Time: startDate, Valid: true},
		Column3:  pgtype.Date{Time: endDate, Valid: true},
	})
	if err != nil {
		return nil, err
	}

	times := make([]time.Time, len(dates))
	for i, date := range dates {
		times[i] = date.Time
	}

	return times, nil
}

// DeleteStatsForDate deletes statistics for a specific date
func (r *StatsRepo) DeleteStatsForDate(ctx context.Context, volumeID string, date time.Time) error {
	return r.queries.DeleteStatsForDate(ctx, sqlc.DeleteStatsForDateParams{
		VolumeID: volumeID,
		Date:     pgtype.Date{Time: date, Valid: true},
	})
}

// RefreshDailySummaryView refreshes the daily summary materialized view
func (r *StatsRepo) RefreshDailySummaryView(ctx context.Context) error {
	return r.queries.RefreshDailySummaryView(ctx)
}

// Job Management Methods

// CreateStatsJob creates a new statistics job
func (r *StatsRepo) CreateStatsJob(ctx context.Context, jobType, volumeID string, organizationID int64) (string, error) {
	jobID := fmt.Sprintf("job-%d-%s", time.Now().UnixNano(), jobType)

	_, err := r.queries.CreateStatsJob(ctx, sqlc.CreateStatsJobParams{
		JobID:          jobID,
		JobType:        jobType,
		VolumeID:       pgtype.Text{String: volumeID, Valid: volumeID != ""},
		OrganizationID: pgtype.Int8{Int64: organizationID, Valid: true},
	})
	if err != nil {
		return "", err
	}

	return jobID, nil
}

// UpdateStatsJob updates a statistics job status
func (r *StatsRepo) UpdateStatsJob(ctx context.Context, jobID string, status string, progress int, errorMsg string) error {
	return r.queries.UpdateStatsJob(ctx, sqlc.UpdateStatsJobParams{
		JobID:        jobID,
		Status:       status,
		Progress:     pgtype.Int4{Int32: int32(progress), Valid: true},
		ErrorMessage: pgtype.Text{String: errorMsg, Valid: errorMsg != ""},
	})
}

// GetJobStatus retrieves the status of a statistics job
func (r *StatsRepo) GetJobStatus(ctx context.Context, jobID string) (*models.StatsJob, error) {
	row, err := r.queries.GetJobStatus(ctx, jobID)
	if err != nil {
		return nil, err
	}

	return convertStatsJobToModel(&row), nil
}

// GetRecentJobs retrieves recent statistics jobs
func (r *StatsRepo) GetRecentJobs(ctx context.Context, limit int) ([]*models.StatsJob, error) {
	rows, err := r.queries.GetRecentJobs(ctx, int32(limit))
	if err != nil {
		return nil, err
	}

	jobs := make([]*models.StatsJob, len(rows))
	for i, row := range rows {
		jobs[i] = convertStatsJobToModel(&row)
	}

	return jobs, nil
}

// GetJobMetrics retrieves metrics for completed jobs
func (r *StatsRepo) GetJobMetrics(ctx context.Context, jobType string, sinceDays int) (*models.JobMetrics, error) {
	row, err := r.queries.GetJobMetrics(ctx, sqlc.GetJobMetricsParams{
		JobType: jobType,
		Column2: pgtype.Text{String: fmt.Sprintf("%d", sinceDays), Valid: true},
	})
	if err != nil {
		return nil, err
	}

	metrics := &models.JobMetrics{
		TotalJobs:      row.TotalJobs,
		SuccessfulJobs: row.SuccessfulJobs,
		FailedJobs:     row.FailedJobs,
	}

	if row.AvgDurationMs > 0 {
		avgDurationStr := fmt.Sprintf("%d", row.AvgDurationMs)
		metrics.AvgDurationMs = &avgDurationStr
	}

	return metrics, nil
}

// InsertVolumeStats inserts per-directory size rollups. Not yet implemented:
// there's no backing table/query for DirRollup in the schema, and (unlike
// InsertScanResult) nothing in the codebase calls this today, so this stays
// a genuine no-op rather than writing to the wrong place.
func (r *StatsRepo) InsertVolumeStats(ctx context.Context, stats *models.DirRollup) error {
	return nil
}

// InsertScanResult persists a completed scan's total size against the
// volume it scanned. This is what makes a user-triggered "Scan" actually
// show up afterward: the scanner package (diskus/du/native) computes a
// correct result, but until this existed it was returned in the HTTP
// response and then discarded — the volume list only ever reflected
// whatever the separate SizeCalculator background sweep last wrote via
// UpdateVolumeStats. Mirrors that same query/params shape so both paths
// agree on where a volume's size lives.
func (r *StatsRepo) InsertScanResult(ctx context.Context, scanResult *interfaces.ScanResult) error {
	if r.queries == nil {
		return fmt.Errorf("database queries not available")
	}

	organizationID := int64(1) // Default fallback, matches the established
	// pattern elsewhere in this single-org deployment (see
	// internal/services/scanner/filesystem_integration.go).
	if volume, err := r.queries.GetVolumeSystemLevel(ctx, scanResult.VolumeID); err == nil {
		if volume.OrganizationID.Valid {
			organizationID = volume.OrganizationID.Int64
		}
	}

	_, err := r.queries.UpdateVolumeStats(ctx, sqlc.UpdateVolumeStatsParams{
		VolumeID:       scanResult.VolumeID,
		TotalSizeBytes: pgtype.Int8{Int64: scanResult.TotalSize, Valid: true},
		// Used/free size aren't known from a plain size scan (only Docker's
		// own usage-data API or filesystem capacity stats provide that
		// breakdown) — left unset here, matching SizeCalculator's own
		// filesystem-walk fallback, which does the same when it lacks that
		// data.
		UsedSizeBytes:  pgtype.Int8{Valid: false},
		FreeSizeBytes:  pgtype.Int8{Valid: false},
		OrganizationID: pgtype.Int8{Int64: organizationID, Valid: true},
	})
	if err != nil {
		return fmt.Errorf("failed to update volume stats: %w", err)
	}

	return nil
}

// GetVolumeStatsByName retrieves volume statistics by name
func (r *StatsRepo) GetVolumeStatsByName(ctx context.Context, volumeName string, limit int) ([]*models.DirRollup, error) {
	// TODO: Implement using appropriate SQLC method when available
	return []*models.DirRollup{}, nil
}

// GetLatestVolumeStatsLegacy retrieves latest volume statistics using legacy method
func (r *StatsRepo) GetLatestVolumeStatsLegacy(ctx context.Context, volumeName string) (*models.DirRollup, error) {
	// TODO: Implement using appropriate SQLC method when available
	return &models.DirRollup{}, nil
}

// Helper Functions

// convertStatsJobToModel converts a SQLC StatsJobs row to a models.StatsJob
func convertStatsJobToModel(row *sqlc.StatsJobs) *models.StatsJob {
	job := &models.StatsJob{
		ID:        row.ID,
		JobType:   row.JobType,
		Status:    row.Status,
		StartedAt: row.StartedAt.Time,
	}

	if row.VolumeID.Valid {
		job.VolumeID = &row.VolumeID.String
	}

	if row.CompletedAt.Valid {
		job.CompletedAt = &row.CompletedAt.Time
	}

	if row.DurationMs.Valid {
		job.DurationMs = &row.DurationMs.Int64
	}

	if row.ErrorMessage.Valid {
		job.ErrorMessage = &row.ErrorMessage.String
	}

	if row.RecordsProcessed.Valid {
		recordsProcessed := int32(row.RecordsProcessed.Int64)
		job.ProcessedDates = &recordsProcessed
	}

	return job
}

