package lifecycle

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"time"
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
	db     *sql.DB
	cfg    Config
	stopCh chan struct{}
	doneCh chan struct{}
}

func New(db *sql.DB, cfg Config) *Service {
	return &Service{db: db, cfg: cfg, stopCh: make(chan struct{}), doneCh: make(chan struct{})}
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

	if s.cfg.MetricsTTLDays > 0 {
		if n, err := s.pruneOlderThan(ctx, "volume_metrics", "metric_timestamp", s.cfg.MetricsTTLDays); err != nil {
			log.Printf("retention: prune volume_metrics failed: %v", err)
		} else if n > 0 {
			log.Printf("retention: pruned %d rows from volume_metrics", n)
		}
	}
	if s.cfg.SizesTTLDays > 0 {
		if n, err := s.pruneOlderThan(ctx, "volume_sizes", "created_at", s.cfg.SizesTTLDays); err != nil {
			log.Printf("retention: prune volume_sizes failed: %v", err)
		} else if n > 0 {
			log.Printf("retention: pruned %d rows from volume_sizes", n)
		}
	}

	if s.cfg.RollupEnabled {
		if err := s.rollupDaily(ctx); err != nil {
			log.Printf("retention: rollup failed: %v", err)
		}
	}
}

func (s *Service) pruneOlderThan(ctx context.Context, table, tsCol string, ttlDays int) (int64, error) {
	// Different SQL dialects for Postgres vs SQLite
	// Use CURRENT_TIMESTAMP - interval in Postgres; datetime('now', ...) for SQLite
	// Try Postgres first; if it fails due to syntax, fallback to SQLite form
	pg := fmt.Sprintf("DELETE FROM %s WHERE %s < (CURRENT_TIMESTAMP - INTERVAL '%d days')", table, tsCol, ttlDays)
	res, err := s.db.ExecContext(ctx, pg)
	if err != nil {
		// likely SQLite
		sqlite := fmt.Sprintf("DELETE FROM %s WHERE %s < datetime('now', '-%d days')", table, tsCol, ttlDays)
		res, err = s.db.ExecContext(ctx, sqlite)
		if err != nil {
			return 0, err
		}
	}
	if res == nil {
		return 0, nil
	}
	if n, err := res.RowsAffected(); err != nil {
		return 0, err
	} else {
		return n, nil
	}
}

// rollupDaily maintains a simple daily aggregate table volume_metrics_daily
func (s *Service) rollupDaily(ctx context.Context) error {
	// create table if not exists (portable-ish)
	create := `
CREATE TABLE IF NOT EXISTS volume_metrics_daily (
	id INTEGER PRIMARY KEY,
	volume_id VARCHAR(255) NOT NULL,
	day DATE NOT NULL,
	total_size_avg BIGINT,
	file_count_avg BIGINT,
	directory_count_avg BIGINT,
	created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
	UNIQUE(volume_id, day)
);`
	if _, err := s.db.ExecContext(ctx, create); err != nil {
		return err
	}

	// Upsert daily aggregates for the last 7 days
	// We attempt Postgres syntax first, then fallback to SQLite
	upsertPG := `
INSERT INTO volume_metrics_daily (volume_id, day, total_size_avg, file_count_avg, directory_count_avg)
SELECT volume_id,
       DATE(metric_timestamp) AS day,
       AVG(total_size)::BIGINT,
       AVG(file_count)::BIGINT,
       AVG(directory_count)::BIGINT
FROM volume_metrics
WHERE metric_timestamp >= (CURRENT_DATE - INTERVAL '7 days')
GROUP BY volume_id, DATE(metric_timestamp)
ON CONFLICT (volume_id, day) DO UPDATE SET
  total_size_avg = EXCLUDED.total_size_avg,
  file_count_avg = EXCLUDED.file_count_avg,
  directory_count_avg = EXCLUDED.directory_count_avg;`
	if _, err := s.db.ExecContext(ctx, upsertPG); err != nil {
		upsertSQLite := `
INSERT INTO volume_metrics_daily (volume_id, day, total_size_avg, file_count_avg, directory_count_avg)
SELECT volume_id,
       DATE(metric_timestamp) AS day,
       CAST(AVG(total_size) AS INTEGER),
       CAST(AVG(file_count) AS INTEGER),
       CAST(AVG(directory_count) AS INTEGER)
FROM volume_metrics
WHERE metric_timestamp >= DATE('now', '-7 days')
GROUP BY volume_id, DATE(metric_timestamp)
ON CONFLICT(volume_id, day) DO UPDATE SET
  total_size_avg = excluded.total_size_avg,
  file_count_avg = excluded.file_count_avg,
  directory_count_avg = excluded.directory_count_avg;`
		if _, err2 := s.db.ExecContext(ctx, upsertSQLite); err2 != nil {
			return err2
		}
	}
	return nil
}
