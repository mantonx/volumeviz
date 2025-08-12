package lifecycle

import (
	"context"
	"log"
	"time"

	"github.com/mantonx/volumeviz/internal/store"
)

// Config controls retention and rollup behaviors
type Config struct {
	Enabled        bool          // master switch
	MetricsTTLDays int           // TTL for volume_metrics in days
	SizesTTLDays   int           // TTL for volume_sizes in days
	RollupEnabled  bool          // whether to create daily rollups
	Interval       time.Duration // how often to run the job
	InitialDelay   time.Duration // delay before first run
}

// Service runs background lifecycle maintenance
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

	if s.cfg.MetricsTTLDays > 0 {
		if n, err := retention.PruneVolumeMetrics(ctx, s.cfg.MetricsTTLDays); err != nil {
			log.Printf("retention: prune volume_metrics failed: %v", err)
		} else if n > 0 {
			log.Printf("retention: pruned %d rows from volume_metrics", n)
		}
	}
	if s.cfg.SizesTTLDays > 0 {
		if n, err := retention.PruneVolumeSizes(ctx, s.cfg.SizesTTLDays); err != nil {
			log.Printf("retention: prune volume_sizes failed: %v", err)
		} else if n > 0 {
			log.Printf("retention: pruned %d rows from volume_sizes", n)
		}
	}

	// Prune old scan_jobs entries (scan job history) - keep only completed/failed runs older than TTL
	if s.cfg.SizesTTLDays > 0 {
		if n, err := retention.PruneScanJobs(ctx, s.cfg.SizesTTLDays); err != nil {
			log.Printf("retention: prune scan_jobs failed: %v", err)
		} else if n > 0 {
			log.Printf("retention: pruned %d rows from scan_jobs", n)
		}
	}

	if s.cfg.RollupEnabled {
		// Ensure table exists
		if err := retention.CreateDailyRollupTable(ctx); err != nil {
			log.Printf("retention: create rollup table failed: %v", err)
			return
		}
		// Perform rollup
		if err := retention.RollupDailyMetrics(ctx); err != nil {
			log.Printf("retention: rollup failed: %v", err)
		}
	}
}
