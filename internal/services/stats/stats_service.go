package stats

import (
	"context"
	"fmt"
	"log"
	"time"

	"github.com/mantonx/volumeviz/internal/interfaces"
	"github.com/mantonx/volumeviz/internal/models"
	"github.com/mantonx/volumeviz/internal/repo"
)

// StatsService handles daily statistics computation and management
type StatsService struct {
	statsRepo *repo.StatsRepo
	metrics   interfaces.MetricsCollector
	logger    *log.Logger
}

// NewStatsService creates a new stats service
func NewStatsService(statsRepo *repo.StatsRepo, metrics interfaces.MetricsCollector, logger *log.Logger) *StatsService {
	service := &StatsService{
		statsRepo: statsRepo,
		metrics:   metrics,
		logger:    logger,
	}
	
	// Report service status to metrics
	if metrics != nil {
		metrics.SetStatsServiceStatus(true)
	}
	
	return service
}

// OnScanCompleted is called when a volume scan completes
// This triggers daily stats computation for the current date
func (s *StatsService) OnScanCompleted(ctx context.Context, volumeID string, scanID *string) error {
	if s.logger != nil {
		s.logger.Printf("Computing daily stats for volume %s after scan completion", volumeID)
	}

	startTime := time.Now()
	today := time.Now().Truncate(24 * time.Hour)
	
	// Report job start to metrics
	if s.metrics != nil {
		s.metrics.StatsJobStarted("scan_completion", volumeID)
	}
	
	// Create job record
	jobID, err := s.statsRepo.CreateStatsJob(ctx, "scan_completion", volumeID, startTime, "running")
	if err != nil {
		if s.logger != nil {
			s.logger.Printf("Failed to create stats job for volume %s: %v", volumeID, err)
		}
		if s.metrics != nil {
			s.metrics.StatsJobFailed("scan_completion", volumeID, time.Since(startTime), "job_creation_failed")
		}
		return fmt.Errorf("failed to create stats job: %w", err)
	}

	// Compute stats
	err = s.statsRepo.ComputeVolumeDailyStats(ctx, volumeID, today, scanID)
	duration := time.Since(startTime)
	
	// Update job record
	var status string
	var errorMessage *string
	var processedDates int32 = 1
	var recordsCreated int32 = 0 // We don't track individual records in the bulk operation
	
	if err != nil {
		status = "failed"
		errMsg := err.Error()
		errorMessage = &errMsg
		if s.logger != nil {
			s.logger.Printf("Failed to compute daily stats for volume %s: %v", volumeID, err)
		}
		if s.metrics != nil {
			s.metrics.StatsJobFailed("scan_completion", volumeID, duration, "computation_failed")
		}
	} else {
		status = "completed"
		if s.logger != nil {
			s.logger.Printf("Successfully computed daily stats for volume %s (duration: %v)", volumeID, duration)
		}
		if s.metrics != nil {
			s.metrics.StatsJobCompleted("scan_completion", volumeID, duration, int(processedDates))
		}
	}
	
	completedAt := time.Now()
	durationMs := duration.Milliseconds()
	
	updateErr := s.statsRepo.UpdateStatsJob(ctx, models.UpdateStatsJobParams{
		ID:             jobID,
		CompletedAt:    &completedAt,
		DurationMs:     &durationMs,
		Status:         status,
		ErrorMessage:   errorMessage,
		ProcessedDates: &processedDates,
		RecordsCreated: &recordsCreated,
		RecordsUpdated: &recordsCreated, // Same as created for bulk operations
	})
	
	if updateErr != nil && s.logger != nil {
		s.logger.Printf("Failed to update stats job %d: %v", jobID, updateErr)
	}

	return err
}

// ComputeHistoricalStats computes stats for a date range (used by nightly reconciliation)
func (s *StatsService) ComputeHistoricalStats(ctx context.Context, volumeID string, startDate, endDate time.Time) error {
	if s.logger != nil {
		s.logger.Printf("Computing historical stats for volume %s from %v to %v", volumeID, startDate, endDate)
	}

	jobStartTime := time.Now()
	
	// Report job start to metrics
	if s.metrics != nil {
		s.metrics.StatsJobStarted("historical_compute", volumeID)
	}
	
	// Create job record  
	jobID, err := s.statsRepo.CreateStatsJob(ctx, "historical_compute", volumeID, jobStartTime, "running")
	if err != nil {
		if s.metrics != nil {
			s.metrics.StatsJobFailed("historical_compute", volumeID, time.Since(jobStartTime), "job_creation_failed")
		}
		return fmt.Errorf("failed to create historical stats job: %w", err)
	}

	var processedDates int32 = 0
	var lastError error
	
	// Process each date
	for date := startDate; !date.After(endDate); date = date.AddDate(0, 0, 1) {
		err := s.statsRepo.ComputeVolumeDailyStats(ctx, volumeID, date, nil)
		if err != nil {
			lastError = err
			if s.logger != nil {
				s.logger.Printf("Failed to compute stats for volume %s on date %v: %v", volumeID, date, err)
			}
		} else {
			processedDates++
		}
	}
	
	// Update job record
	duration := time.Since(jobStartTime)
	completedAt := time.Now()
	durationMs := duration.Milliseconds()
	
	var status string
	var errorMessage *string
	if lastError != nil {
		status = "completed_with_errors"
		errMsg := fmt.Sprintf("Processed %d dates, last error: %v", processedDates, lastError)
		errorMessage = &errMsg
		if s.metrics != nil {
			s.metrics.StatsJobFailed("historical_compute", volumeID, duration, "partial_failure")
		}
	} else {
		status = "completed"
		if s.metrics != nil {
			s.metrics.StatsJobCompleted("historical_compute", volumeID, duration, int(processedDates))
		}
	}
	
	updateErr := s.statsRepo.UpdateStatsJob(ctx, models.UpdateStatsJobParams{
		ID:             jobID,
		CompletedAt:    &completedAt,
		DurationMs:     &durationMs,
		Status:         status,
		ErrorMessage:   errorMessage,
		ProcessedDates: &processedDates,
		RecordsCreated: &processedDates, // Approximate
		RecordsUpdated: &processedDates,
	})
	
	if updateErr != nil && s.logger != nil {
		s.logger.Printf("Failed to update historical stats job %d: %v", jobID, updateErr)
	}

	if s.logger != nil {
		s.logger.Printf("Historical stats computation completed for volume %s: processed %d dates (duration: %v)", 
			volumeID, processedDates, duration)
	}

	return lastError
}

// GetMissingStatsDateRange finds date ranges that need stats computation
func (s *StatsService) GetMissingStatsDateRange(ctx context.Context, volumeID string, lookbackDays int) ([]time.Time, error) {
	endDate := time.Now().Truncate(24 * time.Hour)
	startDate := endDate.AddDate(0, 0, -lookbackDays)
	
	return s.statsRepo.GetMissingStatsDates(ctx, volumeID, startDate, endDate)
}

// RefreshMaterializedViews refreshes the materialized views for better query performance
func (s *StatsService) RefreshMaterializedViews(ctx context.Context) error {
	if s.logger != nil {
		s.logger.Printf("Refreshing daily stats materialized views")
	}
	
	startTime := time.Now()
	err := s.statsRepo.RefreshDailySummaryView(ctx)
	duration := time.Since(startTime)
	
	if err != nil {
		if s.logger != nil {
			s.logger.Printf("Failed to refresh materialized views: %v", err)
		}
		return err
	}
	
	if s.logger != nil {
		s.logger.Printf("Successfully refreshed materialized views (duration: %v)", duration)
	}
	
	return nil
}

// GetStatsJobStatus retrieves the status of a stats job
func (s *StatsService) GetStatsJobStatus(ctx context.Context, jobID int64) (*models.StatsJob, error) {
	return s.statsRepo.GetJobStatus(ctx, jobID)
}

// GetRecentJobs retrieves recent stats jobs for monitoring
func (s *StatsService) GetRecentJobs(ctx context.Context, jobType string, volumeID *string, limit int32) ([]*models.StatsJob, error) {
	return s.statsRepo.GetRecentJobs(ctx, jobType, volumeID, limit)
}

// GetJobMetrics retrieves aggregated job performance metrics
func (s *StatsService) GetJobMetrics(ctx context.Context, jobType string, sinceDays int) (*models.JobMetrics, error) {
	since := time.Now().AddDate(0, 0, -sinceDays)
	return s.statsRepo.GetJobMetrics(ctx, jobType, since)
}

// GetLatestVolumeStats retrieves the most recent stats for a volume
func (s *StatsService) GetLatestVolumeStats(ctx context.Context, volumeID string) (*models.DailyStat, error) {
	return s.statsRepo.GetLatestVolumeStats(ctx, volumeID)
}

// GetVolumeStatsHistory retrieves volume stats history for a date range
func (s *StatsService) GetVolumeStatsHistory(ctx context.Context, volumeID string, startDate, endDate time.Time) ([]*models.DailyStat, error) {
	return s.statsRepo.GetVolumeStatsHistory(ctx, volumeID, startDate, endDate)
}

// GetFolderGrowthTrends retrieves folder growth trends
func (s *StatsService) GetFolderGrowthTrends(ctx context.Context, volumeID string, sinceDays int, limit int32) ([]*models.FolderGrowthTrend, error) {
	since := time.Now().AddDate(0, 0, -sinceDays)
	return s.statsRepo.GetFolderGrowthTrends(ctx, volumeID, since, limit)
}

// GetTopGrowingFolders retrieves the top growing folders in a time period
func (s *StatsService) GetTopGrowingFolders(ctx context.Context, volumeID string, sinceDays int, limit int32) ([]*models.TopGrowingFolder, error) {
	since := time.Now().AddDate(0, 0, -sinceDays)
	return s.statsRepo.GetTopGrowingFolders(ctx, volumeID, since, limit)
}

// GetMediaKindComposition retrieves media type composition over time
func (s *StatsService) GetMediaKindComposition(ctx context.Context, volumeID string, startDate, endDate time.Time) ([]*models.MediaKindComposition, error) {
	return s.statsRepo.GetMediaKindComposition(ctx, volumeID, startDate, endDate)
}

// GetTrendAnalysis retrieves comprehensive trend analysis data
func (s *StatsService) GetTrendAnalysis(ctx context.Context, volumeID string, startDate, endDate time.Time) ([]*models.TrendAnalysis, error) {
	return s.statsRepo.GetTrendAnalysis(ctx, volumeID, startDate, endDate)
}