package snapshots

import (
	"context"
	"log"
	"sync"
	"time"

	"github.com/mantonx/volumeviz/internal/store"
)

// NightlyScheduler manages nightly snapshot creation and retention tasks
type NightlyScheduler struct {
	snapshotService  *SnapshotService
	retentionService *RetentionService
	volumeProvider   VolumeProvider
	store            store.Store

	// Scheduler state
	running     bool
	ctx         context.Context
	cancel      context.CancelFunc
	schedulerWG sync.WaitGroup
	mutex       sync.RWMutex

	// Configuration
	config *NightlyConfig
}

// VolumeProvider interface for getting volumes (matches scheduler pattern)
type VolumeProvider interface {
	ListVolumes(ctx context.Context) ([]VolumeInfo, error)
}

// VolumeInfo represents basic volume information
type VolumeInfo struct {
	Name       string
	Mountpoint string
	Driver     string
}

// NightlyConfig holds configuration for the nightly scheduler
type NightlyConfig struct {
	Enabled              bool          `json:"enabled"`
	SnapshotTime         string        `json:"snapshot_time"`  // Format: "02:30" for 2:30 AM
	RetentionTime        string        `json:"retention_time"` // Format: "03:00" for 3:00 AM
	Timezone             string        `json:"timezone"`       // Default: "UTC"
	ScanTimeoutPerVolume time.Duration `json:"scan_timeout_per_volume"`
	MaxConcurrentScans   int           `json:"max_concurrent_scans"`
	SkipEmptyVolumes     bool          `json:"skip_empty_volumes"`
}

// DefaultNightlyConfig returns default configuration
func DefaultNightlyConfig() *NightlyConfig {
	return &NightlyConfig{
		Enabled:              true,
		SnapshotTime:         "02:30",
		RetentionTime:        "03:00",
		Timezone:             "UTC",
		ScanTimeoutPerVolume: 30 * time.Minute,
		MaxConcurrentScans:   3,
		SkipEmptyVolumes:     true,
	}
}

// NewNightlyScheduler creates a new nightly scheduler
func NewNightlyScheduler(
	store store.Store,
	volumeProvider VolumeProvider,
	config *NightlyConfig,
) *NightlyScheduler {
	if config == nil {
		config = DefaultNightlyConfig()
	}

	return &NightlyScheduler{
		snapshotService:  NewSnapshotService(store),
		retentionService: NewRetentionService(store),
		volumeProvider:   volumeProvider,
		store:            store,
		config:           config,
	}
}

// Start starts the nightly scheduler
func (ns *NightlyScheduler) Start(ctx context.Context) error {
	if !ns.config.Enabled {
		log.Printf("[INFO] Nightly snapshot scheduler disabled")
		return nil
	}

	ns.mutex.Lock()
	if ns.running {
		ns.mutex.Unlock()
		return nil
	}
	ns.running = true
	ns.mutex.Unlock()

	ns.ctx, ns.cancel = context.WithCancel(ctx)

	log.Printf("[INFO] Starting nightly snapshot scheduler (snapshots: %s, retention: %s, timezone: %s)",
		ns.config.SnapshotTime, ns.config.RetentionTime, ns.config.Timezone)

	// Start the scheduler loop
	ns.schedulerWG.Add(1)
	go ns.runScheduler()

	return nil
}

// Stop stops the nightly scheduler
func (ns *NightlyScheduler) Stop(ctx context.Context) error {
	ns.mutex.Lock()
	if !ns.running {
		ns.mutex.Unlock()
		return nil
	}
	ns.running = false
	ns.mutex.Unlock()

	log.Printf("[INFO] Stopping nightly snapshot scheduler...")

	if ns.cancel != nil {
		ns.cancel()
	}

	// Wait for scheduler to finish with timeout
	done := make(chan struct{})
	go func() {
		ns.schedulerWG.Wait()
		close(done)
	}()

	select {
	case <-done:
		log.Printf("[INFO] Nightly snapshot scheduler stopped")
	case <-ctx.Done():
		log.Printf("[WARN] Nightly snapshot scheduler stop timeout")
	}

	return nil
}

// IsRunning returns whether the scheduler is running
func (ns *NightlyScheduler) IsRunning() bool {
	ns.mutex.RLock()
	defer ns.mutex.RUnlock()
	return ns.running
}

// runScheduler runs the main scheduling loop
func (ns *NightlyScheduler) runScheduler() {
	defer ns.schedulerWG.Done()

	// Load timezone
	loc, err := time.LoadLocation(ns.config.Timezone)
	if err != nil {
		log.Printf("[ERROR] Invalid timezone %s, using UTC: %v", ns.config.Timezone, err)
		loc = time.UTC
	}

	log.Printf("[INFO] Nightly scheduler started")

	for {
		select {
		case <-ns.ctx.Done():
			return
		case <-time.After(ns.calculateNextScheduleDelay(loc)):
			ns.runNightlyTasks(loc)
		}
	}
}

// calculateNextScheduleDelay calculates how long to wait until the next scheduled time
func (ns *NightlyScheduler) calculateNextScheduleDelay(loc *time.Location) time.Duration {
	now := time.Now().In(loc)

	// Check if it's time for snapshots
	snapshotTarget := ns.parseTimeToday(ns.config.SnapshotTime, loc)
	if now.Before(snapshotTarget) {
		return snapshotTarget.Sub(now)
	}

	// Check if it's time for retention
	retentionTarget := ns.parseTimeToday(ns.config.RetentionTime, loc)
	if now.Before(retentionTarget) {
		return retentionTarget.Sub(now)
	}

	// Both times have passed today, schedule for tomorrow's snapshot time
	tomorrow := now.AddDate(0, 0, 1)
	tomorrowTarget := ns.parseTime(ns.config.SnapshotTime, tomorrow, loc)
	return tomorrowTarget.Sub(now)
}

// parseTimeToday parses a time string (HH:MM) for today
func (ns *NightlyScheduler) parseTimeToday(timeStr string, loc *time.Location) time.Time {
	now := time.Now().In(loc)
	return ns.parseTime(timeStr, now, loc)
}

// parseTime parses a time string (HH:MM) for a specific date
func (ns *NightlyScheduler) parseTime(timeStr string, date time.Time, loc *time.Location) time.Time {
	t, err := time.Parse("15:04", timeStr)
	if err != nil {
		log.Printf("[ERROR] Invalid time format %s, using 02:30: %v", timeStr, err)
		t, _ = time.Parse("15:04", "02:30")
	}

	return time.Date(
		date.Year(), date.Month(), date.Day(),
		t.Hour(), t.Minute(), 0, 0, loc,
	)
}

// runNightlyTasks determines which task to run based on current time
func (ns *NightlyScheduler) runNightlyTasks(loc *time.Location) {
	now := time.Now().In(loc)

	snapshotTime := ns.parseTimeToday(ns.config.SnapshotTime, loc)
	retentionTime := ns.parseTimeToday(ns.config.RetentionTime, loc)

	// Check if we're within 30 minutes of snapshot time
	if ns.withinWindow(now, snapshotTime, 30*time.Minute) {
		go ns.createDailySnapshots()
	}

	// Check if we're within 30 minutes of retention time
	if ns.withinWindow(now, retentionTime, 30*time.Minute) {
		go ns.runRetentionTasks()
	}
}

// withinWindow checks if current time is within a window of target time
func (ns *NightlyScheduler) withinWindow(current, target time.Time, window time.Duration) bool {
	return current.After(target.Add(-window/2)) && current.Before(target.Add(window/2))
}

// createDailySnapshots creates snapshots for all volumes
func (ns *NightlyScheduler) createDailySnapshots() {
	log.Printf("[INFO] Starting nightly snapshot creation")
	start := time.Now()

	volumes, err := ns.volumeProvider.ListVolumes(ns.ctx)
	if err != nil {
		log.Printf("[ERROR] Failed to list volumes for snapshots: %v", err)
		return
	}

	log.Printf("[INFO] Creating snapshots for %d volumes", len(volumes))

	// Use semaphore for concurrency control
	semaphore := make(chan struct{}, ns.config.MaxConcurrentScans)
	var wg sync.WaitGroup

	successCount := 0
	errorCount := 0
	var mutex sync.Mutex

	for _, volume := range volumes {
		wg.Add(1)
		go func(vol VolumeInfo) {
			defer wg.Done()

			// Acquire semaphore
			semaphore <- struct{}{}
			defer func() { <-semaphore }()

			if err := ns.createVolumeSnapshot(vol); err != nil {
				log.Printf("[ERROR] Failed to create snapshot for volume %s: %v", vol.Name, err)
				mutex.Lock()
				errorCount++
				mutex.Unlock()
			} else {
				mutex.Lock()
				successCount++
				mutex.Unlock()
			}
		}(volume)
	}

	wg.Wait()
	duration := time.Since(start)

	log.Printf("[INFO] Nightly snapshot creation completed in %v: %d successful, %d errors",
		duration, successCount, errorCount)
}

// createVolumeSnapshot creates a snapshot for a single volume
func (ns *NightlyScheduler) createVolumeSnapshot(volume VolumeInfo) error {
	ctx, cancel := context.WithTimeout(ns.ctx, ns.config.ScanTimeoutPerVolume)
	defer cancel()

	// For now, we'll use mock data since we don't have scanner integration
	// In a real implementation, this would scan the volume using the scanner
	params := CreateSnapshotParams{
		VolumeID:       volume.Name,
		TotalSize:      0, // Would be populated by scanner
		FileCount:      0, // Would be populated by scanner
		DirectoryCount: 0, // Would be populated by scanner
		LargestFile:    0, // Would be populated by scanner
		ScanMethod:     "nightly",
		ScanDurationMs: 0, // Would be measured during scan
	}

	_, err := ns.snapshotService.CreateDailySnapshot(ctx, params)
	return err
}

// runRetentionTasks runs the retention and compaction process
func (ns *NightlyScheduler) runRetentionTasks() {
	log.Printf("[INFO] Starting nightly retention tasks")
	start := time.Now()

	if err := ns.retentionService.CompactAndCleanup(ns.ctx); err != nil {
		log.Printf("[ERROR] Nightly retention tasks failed: %v", err)
		return
	}

	duration := time.Since(start)
	log.Printf("[INFO] Nightly retention tasks completed in %v", duration)
}
