package lifecycle

import (
	"context"
	"fmt"
	"log"
	"time"

	"github.com/mantonx/volumeviz/internal/repo"
	"github.com/mantonx/volumeviz/internal/store"
)

// Config controls retention and rollup behaviors with organization support
type Config struct {
	Enabled                   bool                         // master switch
	MetricsTTLDays           int                          // TTL for volume_metrics in days
	SizesTTLDays             int                          // TTL for volume_sizes in days
	RollupEnabled            bool                         // whether to create daily rollups
	Interval                 time.Duration                // how often to run the job
	InitialDelay             time.Duration                // delay before first run
	OrganizationPolicies     map[int64]OrganizationPolicy // organization-specific policies
	EnforceOrganizationScope bool                         // enforce organization-scoped retention
}

// OrganizationPolicy defines retention policy for a specific organization
type OrganizationPolicy struct {
	OrganizationID    int64 `json:"organization_id"`
	MetricsTTLDays    int   `json:"metrics_ttl_days"`    // Override global metrics TTL
	SizesTTLDays      int   `json:"sizes_ttl_days"`      // Override global sizes TTL
	DailyStatsTTLDays int   `json:"daily_stats_ttl_days"` // TTL for daily stats
	ScanJobsTTLDays   int   `json:"scan_jobs_ttl_days"`   // TTL for scan job history
	Enabled           bool  `json:"enabled"`              // Enable/disable retention for this org
}

// Service runs background lifecycle maintenance with organization-aware policies
type Service struct {
	store  store.Store
	cfg    Config
	stopCh chan struct{}
	doneCh chan struct{}
}

func New(store store.Store, cfg Config) *Service {
	return &Service{store: store, cfg: cfg, stopCh: make(chan struct{}), doneCh: make(chan struct{})}
}

// Start begins the background ticker
func (s *Service) Start() {
	if !s.cfg.Enabled {
		close(s.doneCh)
		return
	}
	go func() {
		defer close(s.doneCh)
		if s.cfg.InitialDelay > 0 {
			select {
			case <-time.After(s.cfg.InitialDelay):
			case <-s.stopCh:
				return
			}
		}
		ticker := time.NewTicker(s.cfg.Interval)
		defer ticker.Stop()
		// run once on start
		s.runOnce(context.Background())
		for {
			select {
			case <-ticker.C:
				s.runOnce(context.Background())
			case <-s.stopCh:
				return
			}
		}
	}()
}

// Stop signals the service to stop and waits for completion
func (s *Service) Stop() {
	close(s.stopCh)
	<-s.doneCh
}

func (s *Service) runOnce(ctx context.Context) {
	ctx, cancel := context.WithTimeout(ctx, 2*time.Minute)
	defer cancel()

	retention := s.store.Retention()

	// Run organization-aware retention if enabled
	if s.cfg.EnforceOrganizationScope {
		if err := s.runOrganizationAwareRetention(ctx, retention); err != nil {
			log.Printf("retention: organization-aware retention failed: %v", err)
		}
	} else {
		// Legacy global retention mode
		if err := s.runGlobalRetention(ctx, retention); err != nil {
			log.Printf("retention: global retention failed: %v", err)
		}
	}

	// Rollup operations (organization-aware)
	if s.cfg.RollupEnabled {
		if err := s.runRollupOperations(ctx, retention); err != nil {
			log.Printf("retention: rollup operations failed: %v", err)
		}
	}
}

// runGlobalRetention runs traditional global retention (legacy mode)
func (s *Service) runGlobalRetention(ctx context.Context, retention repo.RetentionRepo) error {
	log.Printf("retention: Running global retention mode")

	if s.cfg.MetricsTTLDays > 0 {
		retentionPeriod := time.Duration(s.cfg.MetricsTTLDays) * 24 * time.Hour
		if result, err := retention.PruneVolumeMetrics(ctx, retentionPeriod); err != nil {
			log.Printf("retention: prune volume_metrics failed: %v", err)
		} else if result != nil && result.RecordsDeleted > 0 {
			log.Printf("retention: pruned %d rows from volume_metrics", result.RecordsDeleted)
		}
	}
	if s.cfg.SizesTTLDays > 0 {
		// TODO: PruneVolumeSizes method not implemented in retention repo
		log.Printf("retention: PruneVolumeSizes not yet implemented")
	}

	// Prune old scan_jobs entries (scan job history) - keep only completed/failed runs older than TTL
	if s.cfg.SizesTTLDays > 0 {
		retentionPeriod := time.Duration(s.cfg.SizesTTLDays) * 24 * time.Hour
		if result, err := retention.PruneScanJobs(ctx, retentionPeriod); err != nil {
			log.Printf("retention: prune scan_jobs failed: %v", err)
		} else if result != nil && result.RecordsDeleted > 0 {
			log.Printf("retention: pruned %d rows from scan_jobs", result.RecordsDeleted)
		}
	}

	// Prune old scan_jobs entries
	if s.cfg.SizesTTLDays > 0 {
		retentionPeriod := time.Duration(s.cfg.SizesTTLDays) * 24 * time.Hour
		if result, err := retention.PruneScanJobs(ctx, retentionPeriod); err != nil {
			log.Printf("retention: prune scan_jobs failed: %v", err)
		} else if result != nil && result.RecordsDeleted > 0 {
			log.Printf("retention: pruned %d rows from scan_jobs", result.RecordsDeleted)
		}
	}

	return nil
}

// runOrganizationAwareRetention runs retention policies per organization
func (s *Service) runOrganizationAwareRetention(ctx context.Context, retention repo.RetentionRepo) error {
	log.Printf("retention: Running organization-aware retention mode")

	// Get all organizations from the system
	organizations, err := s.store.Organizations().ListOrganizations(ctx, 1000, 0)
	if err != nil {
		return fmt.Errorf("failed to get organizations: %w", err)
	}

	for _, org := range organizations {
		orgID := org.ID
		policy := s.getOrganizationPolicy(orgID)

		if !policy.Enabled {
			log.Printf("retention: Skipping disabled organization %d", orgID)
			continue
		}

		log.Printf("retention: Processing organization %d with custom policy", orgID)

		// Set organization context for retention operations
		orgCtx := context.WithValue(ctx, "organization_id", orgID)

		// Prune volume metrics with organization policy
		if policy.MetricsTTLDays > 0 {
			retentionPeriod := time.Duration(policy.MetricsTTLDays) * 24 * time.Hour
			if result, err := s.pruneOrganizationVolumeMetrics(orgCtx, retention, orgID, retentionPeriod); err != nil {
				log.Printf("retention: org %d prune volume_metrics failed: %v", orgID, err)
			} else if result != nil && result.RecordsDeleted > 0 {
				log.Printf("retention: org %d pruned %d rows from volume_metrics", orgID, result.RecordsDeleted)
			}
		}

		// Prune daily stats with organization policy
		if policy.DailyStatsTTLDays > 0 {
			retentionPeriod := time.Duration(policy.DailyStatsTTLDays) * 24 * time.Hour
			if result, err := s.pruneOrganizationDailyStats(orgCtx, retention, orgID, retentionPeriod); err != nil {
				log.Printf("retention: org %d prune daily_stats failed: %v", orgID, err)
			} else if result != nil && result.RecordsDeleted > 0 {
				log.Printf("retention: org %d pruned %d rows from daily_stats", orgID, result.RecordsDeleted)
			}
		}

		// Prune scan jobs with organization policy
		if policy.ScanJobsTTLDays > 0 {
			retentionPeriod := time.Duration(policy.ScanJobsTTLDays) * 24 * time.Hour
			if result, err := s.pruneOrganizationScanJobs(orgCtx, retention, orgID, retentionPeriod); err != nil {
				log.Printf("retention: org %d prune scan_jobs failed: %v", orgID, err)
			} else if result != nil && result.RecordsDeleted > 0 {
				log.Printf("retention: org %d pruned %d rows from scan_jobs", orgID, result.RecordsDeleted)
			}
		}
	}

	return nil
}

// runRollupOperations runs rollup operations (organization-aware)
func (s *Service) runRollupOperations(ctx context.Context, retention repo.RetentionRepo) error {
	log.Printf("retention: Running rollup operations")

	// Ensure table exists
	if err := retention.CreateDailyRollupTable(ctx); err != nil {
		return fmt.Errorf("create rollup table failed: %w", err)
	}

	// Perform rollup
	if err := retention.RollupDailyMetrics(ctx); err != nil {
		return fmt.Errorf("rollup failed: %w", err)
	}

	return nil
}

// Helper methods for organization-specific retention operations

// getOrganizationPolicy returns the retention policy for an organization
func (s *Service) getOrganizationPolicy(organizationID int64) OrganizationPolicy {
	// Check if organization has custom policy
	if policy, exists := s.cfg.OrganizationPolicies[organizationID]; exists {
		return policy
	}

	// Return default policy based on global config
	return OrganizationPolicy{
		OrganizationID:    organizationID,
		MetricsTTLDays:    s.cfg.MetricsTTLDays,
		SizesTTLDays:      s.cfg.SizesTTLDays,
		DailyStatsTTLDays: s.cfg.MetricsTTLDays, // Use metrics TTL as default
		ScanJobsTTLDays:   s.cfg.SizesTTLDays,   // Use sizes TTL as default
		Enabled:           true,
	}
}

// pruneOrganizationVolumeMetrics prunes volume metrics for a specific organization
func (s *Service) pruneOrganizationVolumeMetrics(ctx context.Context, retention repo.RetentionRepo, organizationID int64, retentionPeriod time.Duration) (*repo.RetentionResult, error) {
	// TODO: Implement organization-specific volume metrics pruning
	// For now, use global pruning with organization context logging
	log.Printf("retention: Pruning volume metrics for organization %d (period: %v)", organizationID, retentionPeriod)
	return retention.PruneVolumeMetrics(ctx, retentionPeriod)
}

// pruneOrganizationDailyStats prunes daily stats for a specific organization  
func (s *Service) pruneOrganizationDailyStats(ctx context.Context, retention repo.RetentionRepo, organizationID int64, retentionPeriod time.Duration) (*repo.RetentionResult, error) {
	// TODO: Implement organization-specific daily stats pruning
	// For now, use global pruning with organization context logging
	log.Printf("retention: Pruning daily stats for organization %d (period: %v)", organizationID, retentionPeriod)
	return retention.PruneDailyStats(ctx, retentionPeriod)
}

// pruneOrganizationScanJobs prunes scan jobs for a specific organization
func (s *Service) pruneOrganizationScanJobs(ctx context.Context, retention repo.RetentionRepo, organizationID int64, retentionPeriod time.Duration) (*repo.RetentionResult, error) {
	// TODO: Implement organization-specific scan jobs pruning
	// For now, use global pruning with organization context logging
	log.Printf("retention: Pruning scan jobs for organization %d (period: %v)", organizationID, retentionPeriod)
	return retention.PruneScanJobs(ctx, retentionPeriod)
}

// GetOrganizationRetentionStats returns retention statistics for an organization
func (s *Service) GetOrganizationRetentionStats(ctx context.Context, organizationID int64) (map[string]interface{}, error) {
	policy := s.getOrganizationPolicy(organizationID)
	
	// Get global retention stats (TODO: make organization-specific)
	globalStats, err := s.store.Retention().GetRetentionStats(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to get retention stats: %w", err)
	}

	return map[string]interface{}{
		"organization_id": organizationID,
		"policy":          policy,
		"global_stats":    globalStats,
		"organization_mode": s.cfg.EnforceOrganizationScope,
	}, nil
}

// SetOrganizationPolicy sets a custom retention policy for an organization
func (s *Service) SetOrganizationPolicy(organizationID int64, policy OrganizationPolicy) {
	if s.cfg.OrganizationPolicies == nil {
		s.cfg.OrganizationPolicies = make(map[int64]OrganizationPolicy)
	}
	policy.OrganizationID = organizationID
	s.cfg.OrganizationPolicies[organizationID] = policy
	log.Printf("retention: Set custom policy for organization %d", organizationID)
}

// RemoveOrganizationPolicy removes a custom retention policy for an organization
func (s *Service) RemoveOrganizationPolicy(organizationID int64) {
	if s.cfg.OrganizationPolicies != nil {
		delete(s.cfg.OrganizationPolicies, organizationID)
		log.Printf("retention: Removed custom policy for organization %d", organizationID)
	}
}
