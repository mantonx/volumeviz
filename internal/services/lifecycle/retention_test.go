package lifecycle

import (
	"context"
	"database/sql"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	_ "modernc.org/sqlite"
)

func setupTestDB(t *testing.T) *sql.DB {
	db, err := sql.Open("sqlite", ":memory:")
	require.NoError(t, err)

	// Create test tables
	_, err = db.Exec(`
		CREATE TABLE volume_metrics (
			id INTEGER PRIMARY KEY,
			volume_id VARCHAR(255),
			total_size BIGINT,
			file_count INTEGER,
			directory_count INTEGER,
			metric_timestamp TIMESTAMP
		);
		CREATE TABLE volume_sizes (
			id INTEGER PRIMARY KEY,
			volume_id VARCHAR(255),
			size BIGINT,
			created_at TIMESTAMP
		);
		CREATE TABLE volume_stats (
			id INTEGER PRIMARY KEY,
			volume_id VARCHAR(255),
			size BIGINT,
			ts TIMESTAMP
		);
		CREATE TABLE scan_runs (
			id INTEGER PRIMARY KEY,
			volume_id VARCHAR(255),
			status VARCHAR(50),
			created_at TIMESTAMP
		);
	`)
	require.NoError(t, err)

	return db
}

func TestNew(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()

	cfg := Config{
		Enabled:        true,
		MetricsTTLDays: 30,
		SizesTTLDays:   60,
		RollupEnabled:  true,
		Interval:       time.Hour,
		InitialDelay:   time.Second,
	}

	service := New(db, cfg)

	assert.NotNil(t, service)
	assert.Equal(t, db, service.db)
	assert.Equal(t, cfg, service.cfg)
	assert.NotNil(t, service.stopCh)
	assert.NotNil(t, service.doneCh)
}

func TestService_StartStop_Disabled(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()

	cfg := Config{
		Enabled: false, // Disabled service
	}

	service := New(db, cfg)

	// Start should return immediately for disabled service
	service.Start()

	// Stop should not hang
	done := make(chan struct{})
	go func() {
		service.Stop()
		close(done)
	}()

	select {
	case <-done:
		// Expected
	case <-time.After(100 * time.Millisecond):
		t.Error("Stop() should return immediately for disabled service")
	}
}

func TestService_StartStop_Enabled(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()

	cfg := Config{
		Enabled:        true,
		MetricsTTLDays: 1,
		SizesTTLDays:   1,
		RollupEnabled:  false, // Disable rollup for simpler test
		Interval:       100 * time.Millisecond,
		InitialDelay:   50 * time.Millisecond,
	}

	service := New(db, cfg)

	// Start service
	service.Start()

	// Let it run for a short time
	time.Sleep(200 * time.Millisecond)

	// Stop should complete
	done := make(chan struct{})
	go func() {
		service.Stop()
		close(done)
	}()

	select {
	case <-done:
		// Expected
	case <-time.After(time.Second):
		t.Error("Stop() took too long")
	}
}

func TestService_PruneOlderThan(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()

	cfg := Config{Enabled: true}
	service := New(db, cfg)

	// Insert test data - some old, some recent
	now := time.Now()
	oldTime := now.AddDate(0, 0, -10)   // 10 days ago
	recentTime := now.AddDate(0, 0, -1) // 1 day ago

	// Insert old records
	_, err := db.Exec("INSERT INTO volume_metrics (volume_id, total_size, metric_timestamp) VALUES (?, ?, ?)",
		"vol1", 1000, oldTime)
	require.NoError(t, err)
	_, err = db.Exec("INSERT INTO volume_metrics (volume_id, total_size, metric_timestamp) VALUES (?, ?, ?)",
		"vol2", 2000, oldTime)
	require.NoError(t, err)

	// Insert recent records
	_, err = db.Exec("INSERT INTO volume_metrics (volume_id, total_size, metric_timestamp) VALUES (?, ?, ?)",
		"vol1", 1500, recentTime)
	require.NoError(t, err)

	// Prune records older than 5 days
	ctx := context.Background()
	affected, err := service.pruneOlderThan(ctx, "volume_metrics", "metric_timestamp", 5)

	assert.NoError(t, err)
	assert.Equal(t, int64(2), affected) // Should delete 2 old records

	// Verify only recent record remains
	var count int
	err = db.QueryRow("SELECT COUNT(*) FROM volume_metrics").Scan(&count)
	require.NoError(t, err)
	assert.Equal(t, 1, count)

	// Verify the remaining record is the recent one
	var volumeID string
	var size int64
	err = db.QueryRow("SELECT volume_id, total_size FROM volume_metrics").Scan(&volumeID, &size)
	require.NoError(t, err)
	assert.Equal(t, "vol1", volumeID)
	assert.Equal(t, int64(1500), size)
}

func TestService_PruneOlderThanWithCondition(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()

	cfg := Config{Enabled: true}
	service := New(db, cfg)

	// Insert test data with different statuses
	now := time.Now()
	oldTime := now.AddDate(0, 0, -10)

	// Old completed and failed runs (should be deleted)
	_, err := db.Exec("INSERT INTO scan_runs (volume_id, status, created_at) VALUES (?, ?, ?)",
		"vol1", "completed", oldTime)
	require.NoError(t, err)
	_, err = db.Exec("INSERT INTO scan_runs (volume_id, status, created_at) VALUES (?, ?, ?)",
		"vol2", "failed", oldTime)
	require.NoError(t, err)

	// Old running run (should NOT be deleted)
	_, err = db.Exec("INSERT INTO scan_runs (volume_id, status, created_at) VALUES (?, ?, ?)",
		"vol3", "running", oldTime)
	require.NoError(t, err)

	// Recent completed run (should NOT be deleted)
	recentTime := now.AddDate(0, 0, -1)
	_, err = db.Exec("INSERT INTO scan_runs (volume_id, status, created_at) VALUES (?, ?, ?)",
		"vol4", "completed", recentTime)
	require.NoError(t, err)

	// Prune old completed/failed runs only
	ctx := context.Background()
	affected, err := service.pruneOlderThanWithCondition(ctx, "scan_runs", "created_at", 5,
		"status IN ('completed', 'failed', 'canceled')")

	assert.NoError(t, err)
	assert.Equal(t, int64(2), affected) // Should delete 2 old completed/failed records

	// Verify 2 records remain (old running + recent completed)
	var count int
	err = db.QueryRow("SELECT COUNT(*) FROM scan_runs").Scan(&count)
	require.NoError(t, err)
	assert.Equal(t, 2, count)
}

func TestService_RollupDaily(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()

	cfg := Config{Enabled: true, RollupEnabled: true}
	service := New(db, cfg)

	// Insert test metrics data
	now := time.Now()
	today := now.Format("2006-01-02")
	yesterday := now.AddDate(0, 0, -1).Format("2006-01-02")

	// Insert multiple records for the same day to test aggregation
	_, err := db.Exec("INSERT INTO volume_metrics (volume_id, total_size, file_count, directory_count, metric_timestamp) VALUES (?, ?, ?, ?, ?)",
		"vol1", 1000, 10, 5, today+" 10:00:00")
	require.NoError(t, err)
	_, err = db.Exec("INSERT INTO volume_metrics (volume_id, total_size, file_count, directory_count, metric_timestamp) VALUES (?, ?, ?, ?, ?)",
		"vol1", 2000, 20, 15, today+" 14:00:00")
	require.NoError(t, err)

	// Insert records for yesterday
	_, err = db.Exec("INSERT INTO volume_metrics (volume_id, total_size, file_count, directory_count, metric_timestamp) VALUES (?, ?, ?, ?, ?)",
		"vol1", 500, 5, 3, yesterday+" 12:00:00")
	require.NoError(t, err)

	// Run rollup
	ctx := context.Background()
	err = service.rollupDaily(ctx)
	assert.NoError(t, err)

	// Verify daily rollup table was created and populated
	var count int
	err = db.QueryRow("SELECT COUNT(*) FROM volume_metrics_daily").Scan(&count)
	require.NoError(t, err)
	assert.Equal(t, 2, count) // Should have 2 days of data

	// Verify aggregation for today (average of 1000 and 2000 = 1500)
	var avgSize, avgFiles, avgDirs int64
	err = db.QueryRow("SELECT total_size_avg, file_count_avg, directory_count_avg FROM volume_metrics_daily WHERE volume_id = ? AND day = ?",
		"vol1", today).Scan(&avgSize, &avgFiles, &avgDirs)
	require.NoError(t, err)
	assert.Equal(t, int64(1500), avgSize) // (1000 + 2000) / 2
	assert.Equal(t, int64(15), avgFiles)  // (10 + 20) / 2
	assert.Equal(t, int64(10), avgDirs)   // (5 + 15) / 2
}

func TestService_RunOnce(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()

	cfg := Config{
		Enabled:        true,
		MetricsTTLDays: 5,
		SizesTTLDays:   7,
		RollupEnabled:  true,
	}
	service := New(db, cfg)

	// Insert old test data
	oldTime := time.Now().AddDate(0, 0, -10)
	_, err := db.Exec("INSERT INTO volume_metrics (volume_id, total_size, metric_timestamp) VALUES (?, ?, ?)",
		"vol1", 1000, oldTime)
	require.NoError(t, err)
	_, err = db.Exec("INSERT INTO volume_sizes (volume_id, size, created_at) VALUES (?, ?, ?)",
		"vol1", 1000, oldTime)
	require.NoError(t, err)

	// Run lifecycle maintenance
	service.runOnce(context.Background())

	// Verify old data was pruned
	var metricsCount, sizesCount int
	err = db.QueryRow("SELECT COUNT(*) FROM volume_metrics").Scan(&metricsCount)
	require.NoError(t, err)
	err = db.QueryRow("SELECT COUNT(*) FROM volume_sizes").Scan(&sizesCount)
	require.NoError(t, err)

	assert.Equal(t, 0, metricsCount) // Should be pruned (older than 5 days)
	assert.Equal(t, 0, sizesCount)   // Should be pruned (older than 7 days)

	// Verify rollup table was created
	var rollupExists bool
	err = db.QueryRow("SELECT COUNT(*) > 0 FROM sqlite_master WHERE type='table' AND name='volume_metrics_daily'").Scan(&rollupExists)
	require.NoError(t, err)
	assert.True(t, rollupExists)
}

func TestConfig_Validation(t *testing.T) {
	tests := []struct {
		name   string
		config Config
		valid  bool
	}{
		{
			name: "valid config",
			config: Config{
				Enabled:        true,
				MetricsTTLDays: 30,
				SizesTTLDays:   60,
				RollupEnabled:  true,
				Interval:       time.Hour,
				InitialDelay:   time.Minute,
			},
			valid: true,
		},
		{
			name: "disabled config",
			config: Config{
				Enabled: false,
			},
			valid: true,
		},
		{
			name: "zero TTL values",
			config: Config{
				Enabled:        true,
				MetricsTTLDays: 0, // Should be handled gracefully
				SizesTTLDays:   0, // Should be handled gracefully
				RollupEnabled:  false,
				Interval:       time.Hour,
			},
			valid: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			db := setupTestDB(t)
			defer db.Close()

			service := New(db, tt.config)
			assert.NotNil(t, service)

			// Service should not panic during creation
			service.Start()
			time.Sleep(10 * time.Millisecond) // Brief pause
			service.Stop()
		})
	}
}
