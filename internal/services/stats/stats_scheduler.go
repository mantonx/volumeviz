package stats

import (
	"context"
	"fmt"
	"log"
	"sync"
	"time"

	"github.com/mantonx/volumeviz/internal/interfaces"
	coreInterfaces "github.com/mantonx/volumeviz/internal/interfaces"
)

// StatsSchedulerConfig holds configuration for the stats scheduler
type StatsSchedulerConfig struct {
	// ReconciliationInterval defines how often to run nightly reconciliation
	ReconciliationInterval time.Duration

	// BackfillLookbackDays defines how many days back to check for missing stats
	BackfillLookbackDays int

	// MaterializedViewRefreshInterval defines how often to refresh materialized views
	MaterializedViewRefreshInterval time.Duration

	// Enabled controls whether the scheduler is active
	Enabled bool

	// MaxConcurrentJobs limits parallel stats job execution
	MaxConcurrentJobs int
}

// DefaultStatsSchedulerConfig provides sensible defaults
func DefaultStatsSchedulerConfig() StatsSchedulerConfig {
	return StatsSchedulerConfig{
		ReconciliationInterval:          12 * time.Hour, // Run twice daily
		BackfillLookbackDays:            7,              // Check past week
		MaterializedViewRefreshInterval: 2 * time.Hour,  // Refresh views every 2 hours
		Enabled:                         true,
		MaxConcurrentJobs:               3,
	}
}

// StatsScheduler manages periodic stats computation and maintenance tasks
type StatsScheduler struct {
	config        StatsSchedulerConfig
	statsService  coreInterfaces.StatsService
	dockerService interfaces.DockerService // For getting volume list
	metrics       coreInterfaces.MetricsCollector
	logger        *log.Logger

	// Control channels
	stopChan  chan struct{}
	doneChan  chan struct{}
	semaphore chan struct{} // Limit concurrent jobs

	// State tracking
	running         bool
	lastReconcile   time.Time
	lastViewRefresh time.Time
	mutex           sync.RWMutex
}

// NewStatsScheduler creates a new stats scheduler
func NewStatsScheduler(
	config StatsSchedulerConfig,
	statsService coreInterfaces.StatsService,
	dockerService interfaces.DockerService,
	metrics coreInterfaces.MetricsCollector,
	logger *log.Logger,
) *StatsScheduler {
	return &StatsScheduler{
		config:        config,
		statsService:  statsService,
		dockerService: dockerService,
		metrics:       metrics,
		logger:        logger,
		stopChan:      make(chan struct{}),
		doneChan:      make(chan struct{}),
		semaphore:     make(chan struct{}, config.MaxConcurrentJobs),
	}
}

// Start begins the scheduler's periodic tasks
func (s *StatsScheduler) Start(ctx context.Context) error {
	if !s.config.Enabled {
		if s.logger != nil {
			s.logger.Printf("Stats scheduler is disabled")
		}
		return nil
	}

	s.mutex.Lock()
	if s.running {
		s.mutex.Unlock()
		return fmt.Errorf("stats scheduler is already running")
	}
	s.running = true
	s.mutex.Unlock()

	// Report scheduler status to metrics
	if s.metrics != nil {
		s.metrics.SetSchedulerRunningStatus(true)
	}

	if s.logger != nil {
		s.logger.Printf("Starting stats scheduler (reconciliation: %v, view refresh: %v)",
			s.config.ReconciliationInterval, s.config.MaterializedViewRefreshInterval)
	}

	// Create tickers for periodic tasks
	reconcileTicker := time.NewTicker(s.config.ReconciliationInterval)
	viewRefreshTicker := time.NewTicker(s.config.MaterializedViewRefreshInterval)

	go func() {
		defer close(s.doneChan)
		defer reconcileTicker.Stop()
		defer viewRefreshTicker.Stop()

		// Run initial tasks
		s.runReconciliation(ctx)
		s.runViewRefresh(ctx)

		for {
			select {
			case <-s.stopChan:
				if s.logger != nil {
					s.logger.Printf("Stats scheduler stopped")
				}
				return

			case <-reconcileTicker.C:
				s.runReconciliation(ctx)

			case <-viewRefreshTicker.C:
				s.runViewRefresh(ctx)

			case <-ctx.Done():
				if s.logger != nil {
					s.logger.Printf("Stats scheduler context cancelled")
				}
				return
			}
		}
	}()

	return nil
}

// Stop gracefully shuts down the scheduler
func (s *StatsScheduler) Stop() error {
	s.mutex.Lock()
	defer s.mutex.Unlock()

	if !s.running {
		return nil
	}

	if s.logger != nil {
		s.logger.Printf("Stopping stats scheduler...")
	}

	close(s.stopChan)

	// Wait for graceful shutdown with timeout
	select {
	case <-s.doneChan:
		if s.logger != nil {
			s.logger.Printf("Stats scheduler stopped gracefully")
		}
	case <-time.After(30 * time.Second):
		if s.logger != nil {
			s.logger.Printf("Stats scheduler stop timeout - forcing shutdown")
		}
	}

	s.running = false

	// Report scheduler status to metrics
	if s.metrics != nil {
		s.metrics.SetSchedulerRunningStatus(false)
	}

	return nil
}

// IsRunning returns whether the scheduler is currently active
func (s *StatsScheduler) IsRunning() bool {
	s.mutex.RLock()
	defer s.mutex.RUnlock()
	return s.running
}

// GetLastReconcileTime returns when reconciliation last ran
func (s *StatsScheduler) GetLastReconcileTime() time.Time {
	s.mutex.RLock()
	defer s.mutex.RUnlock()
	return s.lastReconcile
}

// GetLastViewRefreshTime returns when materialized views were last refreshed
func (s *StatsScheduler) GetLastViewRefreshTime() time.Time {
	s.mutex.RLock()
	defer s.mutex.RUnlock()
	return s.lastViewRefresh
}

// runReconciliation performs nightly reconciliation for all volumes
func (s *StatsScheduler) runReconciliation(ctx context.Context) {
	if s.logger != nil {
		s.logger.Printf("Starting nightly stats reconciliation")
	}

	startTime := time.Now()

	s.mutex.Lock()
	s.lastReconcile = startTime
	s.mutex.Unlock()

	// Get all volumes from Docker
	volumes, err := s.dockerService.ListVolumes(ctx)
	if err != nil {
		if s.logger != nil {
			s.logger.Printf("Failed to list volumes for reconciliation: %v", err)
		}
		return
	}

	var wg sync.WaitGroup
	processedVolumes := 0
	errors := 0

	// Process each volume
	for _, volume := range volumes {
		wg.Add(1)

		// Acquire semaphore for concurrency control
		go func(volumeID string) {
			defer wg.Done()

			select {
			case s.semaphore <- struct{}{}:
				defer func() { <-s.semaphore }()
			case <-ctx.Done():
				return
			}

			// Check for missing stats dates
			missingDates, err := s.statsService.GetMissingStatsDateRange(ctx, volumeID, s.config.BackfillLookbackDays)
			if err != nil {
				if s.logger != nil {
					s.logger.Printf("Failed to get missing stats for volume %s: %v", volumeID, err)
				}
				errors++
				return
			}

			// If there are missing dates, compute historical stats
			if len(missingDates) > 0 {
				if s.logger != nil {
					s.logger.Printf("Computing stats for volume %s: %d missing dates", volumeID, len(missingDates))
				}

				// Find date range bounds
				if len(missingDates) > 0 {
					startDate := missingDates[0]
					endDate := missingDates[len(missingDates)-1]

					err := s.statsService.ComputeHistoricalStats(ctx, volumeID, startDate, endDate)
					if err != nil {
						if s.logger != nil {
							s.logger.Printf("Failed to compute historical stats for volume %s: %v", volumeID, err)
						}
						errors++
					} else {
						processedVolumes++
					}
				}
			} else {
				processedVolumes++
			}
		}(volume.VolumeID)
	}

	// Wait for all volumes to be processed
	wg.Wait()

	duration := time.Since(startTime)
	if s.logger != nil {
		s.logger.Printf("Nightly reconciliation completed: %d volumes processed, %d errors (duration: %v)",
			processedVolumes, errors, duration)
	}
}

// runViewRefresh refreshes materialized views for better query performance
func (s *StatsScheduler) runViewRefresh(ctx context.Context) {
	if s.logger != nil {
		s.logger.Printf("Refreshing stats materialized views")
	}

	startTime := time.Now()

	s.mutex.Lock()
	s.lastViewRefresh = startTime
	s.mutex.Unlock()

	err := s.statsService.RefreshMaterializedViews(ctx)
	duration := time.Since(startTime)

	if err != nil {
		if s.logger != nil {
			s.logger.Printf("Failed to refresh materialized views: %v (duration: %v)", err, duration)
		}
	} else {
		if s.logger != nil {
			s.logger.Printf("Successfully refreshed materialized views (duration: %v)", duration)
		}
	}
}

// TriggerReconciliation manually triggers a reconciliation run
func (s *StatsScheduler) TriggerReconciliation(ctx context.Context) {
	if s.logger != nil {
		s.logger.Printf("Manual reconciliation triggered")
	}
	go s.runReconciliation(ctx)
}

// TriggerViewRefresh manually triggers a view refresh
func (s *StatsScheduler) TriggerViewRefresh(ctx context.Context) {
	if s.logger != nil {
		s.logger.Printf("Manual view refresh triggered")
	}
	go s.runViewRefresh(ctx)
}

// GetStatus returns current scheduler status
func (s *StatsScheduler) GetStatus() map[string]interface{} {
	s.mutex.RLock()
	defer s.mutex.RUnlock()

	return map[string]interface{}{
		"running":           s.running,
		"last_reconcile":    s.lastReconcile,
		"last_view_refresh": s.lastViewRefresh,
		"config": map[string]interface{}{
			"reconciliation_interval":            s.config.ReconciliationInterval.String(),
			"backfill_lookback_days":             s.config.BackfillLookbackDays,
			"materialized_view_refresh_interval": s.config.MaterializedViewRefreshInterval.String(),
			"enabled":                            s.config.Enabled,
			"max_concurrent_jobs":                s.config.MaxConcurrentJobs,
		},
	}
}
