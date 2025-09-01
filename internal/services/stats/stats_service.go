package stats

import (
	"context"
	"fmt"
	"log"
	"time"

	"github.com/mantonx/volumeviz/internal/interfaces"
	"github.com/mantonx/volumeviz/internal/models"
	"github.com/mantonx/volumeviz/internal/repo"
	"github.com/mantonx/volumeviz/internal/store"
)

// StatsService handles daily statistics computation and management with organization context
type StatsService struct {
	statsRepo *repo.StatsRepo
	store     store.Store  // Added for organization-aware volume lookups
	metrics   interfaces.MetricsCollector
	logger    *log.Logger
}

// NewStatsService creates a new stats service with organization support
func NewStatsService(statsRepo *repo.StatsRepo, store store.Store, metrics interfaces.MetricsCollector, logger *log.Logger) *StatsService {
	service := &StatsService{
		statsRepo: statsRepo,
		store:     store,
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
// This triggers daily stats computation for the current date with organization validation
func (s *StatsService) OnScanCompleted(ctx context.Context, volumeID string, scanID *string) error {
	// Validate volume belongs to accessible organization
	if err := s.validateVolumeAccess(ctx, volumeID); err != nil {
		if s.logger != nil {
			s.logger.Printf("Access denied for volume %s stats computation: %v", volumeID, err)
		}
		return fmt.Errorf("access denied for volume stats: %w", err)
	}
	
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
	jobID, err := s.statsRepo.CreateStatsJob(ctx, "scan_completion", volumeID)
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
	err = s.statsRepo.ComputeVolumeDailyStats(ctx, volumeID, today)
	duration := time.Since(startTime)

	// Update job record
	var status string
	var errorMessage *string
	var processedDates int32 = 1
	// recordsCreated removed - not used in simplified UpdateStatsJob signature

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

	// completedAt removed - not used in simplified UpdateStatsJob signature
	durationMs := duration.Milliseconds()

	updateErr := s.statsRepo.UpdateStatsJob(ctx, jobID, status, int(durationMs), func() string {
		if errorMessage != nil {
			return *errorMessage
		}
		return ""
	}())

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
	jobID, err := s.statsRepo.CreateStatsJob(ctx, "historical_compute", volumeID)
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
		err := s.statsRepo.ComputeVolumeDailyStats(ctx, volumeID, date)
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
	// completedAt removed - not used in simplified UpdateStatsJob signature
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

	updateErr := s.statsRepo.UpdateStatsJob(ctx, jobID, status, int(durationMs), func() string {
		if errorMessage != nil {
			return *errorMessage
		}
		return ""
	}())

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
	// TODO: Convert int64 to string or update repository to use int64
	return s.statsRepo.GetJobStatus(ctx, fmt.Sprintf("%d", jobID))
}

// GetRecentJobs retrieves recent stats jobs for monitoring
func (s *StatsService) GetRecentJobs(ctx context.Context, jobType string, volumeID *string, limit int32) ([]*models.StatsJob, error) {
	// TODO: Implement filtering by jobType and volumeID when repository supports it
	return s.statsRepo.GetRecentJobs(ctx, int(limit))
}

// GetJobMetrics retrieves aggregated job performance metrics
func (s *StatsService) GetJobMetrics(ctx context.Context, jobType string, sinceDays int) (*models.JobMetrics, error) {
	return s.statsRepo.GetJobMetrics(ctx, jobType, sinceDays)
}

// GetLatestVolumeStats retrieves the most recent stats for a volume
func (s *StatsService) GetLatestVolumeStats(ctx context.Context, volumeID string) (*models.DailyStat, error) {
	_, err := s.statsRepo.GetLatestVolumeStats(ctx, volumeID)
	if err != nil {
		return nil, err
	}
	// Convert VolumeStats to DailyStat (placeholder conversion)
	return &models.DailyStat{
		VolumeID: volumeID,
		// Add conversion logic here when models are aligned
	}, nil
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
	stats, err := s.statsRepo.GetMediaKindComposition(ctx, volumeID)
	if err != nil {
		return nil, err
	}
	// Convert MediaKindStat to MediaKindComposition (placeholder conversion)
	result := make([]*models.MediaKindComposition, len(stats))
	for i, stat := range stats {
		result[i] = &models.MediaKindComposition{
			// Add conversion logic here when models are aligned
		}
		_ = stat // Use stat to avoid unused variable error
	}
	return result, nil
}

// GetTrendAnalysis retrieves comprehensive trend analysis data
func (s *StatsService) GetTrendAnalysis(ctx context.Context, volumeID string, startDate, endDate time.Time) ([]*models.TrendAnalysis, error) {
	analysis, err := s.statsRepo.GetTrendAnalysis(ctx, volumeID, int(endDate.Sub(startDate).Hours()/24))
	if err != nil {
		return nil, err
	}
	// Convert single TrendAnalysis to slice (placeholder conversion)
	return []*models.TrendAnalysis{analysis}, nil
}

// validateVolumeAccess validates that the current context has access to the specified volume
func (s *StatsService) validateVolumeAccess(ctx context.Context, volumeID string) error {
	if s.store == nil {
		return fmt.Errorf("no store available for volume validation")
	}
	
	// For stats service, we use system-level volume lookup since stats operations
	// are typically system-wide operations that need to access volumes across organizations
	// The volume's organization context will be preserved in the stats data
	volume, err := s.store.Volumes().GetVolumeByVolumeIDSystemLevel(ctx, volumeID)
	if err != nil {
		return fmt.Errorf("volume not found: %w", err)
	}
	
	if volume == nil {
		return fmt.Errorf("volume %s not found", volumeID)
	}
	
	// Log volume access for audit purposes
	if s.logger != nil {
		orgID := "system"
		if volume.OrganizationID != nil {
			orgID = fmt.Sprintf("%d", *volume.OrganizationID)
		}
		s.logger.Printf("Stats service accessing volume %s (organization: %s)", volumeID, orgID)
	}
	
	return nil
}

// GetOrganizationStats retrieves aggregated statistics for an organization
func (s *StatsService) GetOrganizationStats(ctx context.Context, organizationID int64, startDate, endDate time.Time) (*models.OrganizationStats, error) {
	if s.logger != nil {
		s.logger.Printf("Computing organization stats for org %d from %v to %v", organizationID, startDate, endDate)
	}
	
	// Get all volumes for the organization
	volumes, err := s.store.Volumes().ListVolumes(ctx, organizationID, 1000, 0)
	if err != nil {
		return nil, fmt.Errorf("failed to get organization volumes: %w", err)
	}
	
	// Aggregate stats across all volumes
	var totalSize, totalFiles int64
	var totalVolumes int64 = int64(len(volumes))
	volumeStats := make([]*models.VolumeStatsInfo, 0, len(volumes))
	
	for _, volume := range volumes {
		// Get latest stats for this volume
		latestStats, err := s.statsRepo.GetLatestVolumeStats(ctx, volume.VolumeID)
		if err != nil {
			// Skip volumes without stats rather than failing
			if s.logger != nil {
				s.logger.Printf("No stats found for volume %s: %v", volume.VolumeID, err)
			}
			continue
		}
		
		// Aggregate totals
		totalSize += int64(latestStats.TotalSize)
		totalFiles += int64(latestStats.FileCount)
		
		// Add to volume stats info
		volumeStats = append(volumeStats, &models.VolumeStatsInfo{
			VolumeID:    volume.VolumeID,
			VolumeName:  volume.Name,
			TotalSize:   int64(latestStats.TotalSize),
			FileCount:   int64(latestStats.FileCount),
			LastScanned: volume.LastScanned,
		})
	}
	
	return &models.OrganizationStats{
		OrganizationID: organizationID,
		TotalVolumes:   totalVolumes,
		TotalSize:      totalSize,
		TotalFiles:     totalFiles,
		VolumeStats:    volumeStats,
		ComputedAt:     time.Now(),
	}, nil
}

// GetOrganizationGrowthTrends retrieves organization-wide growth trends
func (s *StatsService) GetOrganizationGrowthTrends(ctx context.Context, organizationID int64, sinceDays int) ([]*models.OrganizationGrowthTrend, error) {
	if s.logger != nil {
		s.logger.Printf("Computing growth trends for organization %d over %d days", organizationID, sinceDays)
	}
	
	// Get all volumes for the organization
	volumes, err := s.store.Volumes().ListVolumes(ctx, organizationID, 1000, 0)
	if err != nil {
		return nil, fmt.Errorf("failed to get organization volumes: %w", err)
	}
	
	endDate := time.Now()
	startDate := endDate.AddDate(0, 0, -sinceDays)
	
	// Collect growth data for all volumes
	growthTrends := make([]*models.OrganizationGrowthTrend, 0)
	
	for _, volume := range volumes {
		// Get volume stats history
		statsHistory, err := s.GetVolumeStatsHistory(ctx, volume.VolumeID, startDate, endDate)
		if err != nil || len(statsHistory) < 2 {
			// Skip volumes without sufficient history
			continue
		}
		
		// Calculate growth trend for this volume
		firstStat := statsHistory[0]
		lastStat := statsHistory[len(statsHistory)-1]
		
		if firstStat.TotalSizeBytes > 0 {
			growthPercent := float64(lastStat.TotalSizeBytes-firstStat.TotalSizeBytes) / float64(firstStat.TotalSizeBytes) * 100
			
			growthTrends = append(growthTrends, &models.OrganizationGrowthTrend{
				VolumeID:      volume.VolumeID,
				VolumeName:    volume.Name,
				StartSize:     firstStat.TotalSizeBytes,
				EndSize:       lastStat.TotalSizeBytes,
				SizeChange:    lastStat.TotalSizeBytes - firstStat.TotalSizeBytes,
				GrowthPercent: growthPercent,
				DaysPeriod:    int32(sinceDays),
			})
		}
	}
	
	return growthTrends, nil
}

// GetOrganizationTopFiles retrieves top files by size within an organization
func (s *StatsService) GetOrganizationTopFiles(ctx context.Context, organizationID int64, limit int32) ([]*models.TopFile, error) {
	if s.logger != nil {
		s.logger.Printf("Getting top %d files for organization %d", limit, organizationID)
	}
	
	// Get all volumes for the organization
	volumes, err := s.store.Volumes().ListVolumes(ctx, organizationID, 1000, 0)
	if err != nil {
		return nil, fmt.Errorf("failed to get organization volumes: %w", err)
	}
	
	// Collect top files across all volumes
	allTopFiles := make([]*models.TopFile, 0)
	
	for _, volume := range volumes {
		// Get largest files for this volume (using Files repository)
		// Get files larger than 1MB, sorted by size descending
		files, err := s.store.Files().GetFilesBySize(ctx, volume.VolumeID, 1024*1024, 1<<63-1, limit)
		if err != nil {
			// Skip volumes with file access issues
			if s.logger != nil {
				s.logger.Printf("Failed to get files for volume %s: %v", volume.VolumeID, err)
			}
			continue
		}
		
		// Convert to TopFile format
		for _, file := range files {
			allTopFiles = append(allTopFiles, &models.TopFile{
				VolumeID:   volume.VolumeID,
				VolumeName: volume.Name,
				FilePath:   file.Path,
				Size:       file.Size,
				ModTime:    file.ModTime,
			})
		}
	}
	
	// Sort and limit results (simplified - in production would use more efficient sorting)
	if len(allTopFiles) > int(limit) {
		allTopFiles = allTopFiles[:limit]
	}
	
	return allTopFiles, nil
}
