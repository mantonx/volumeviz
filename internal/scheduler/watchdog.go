package scheduler

import (
	"context"
	"log"
	"strings"
	"sync"
	"time"

	"github.com/mantonx/volumeviz/internal/store"
)

// Watchdog monitors scan jobs for staleness and marks them as failed
type Watchdog struct {
	config HardenedScanConfig
	store  store.Store

	// State management
	ctx    context.Context
	cancel context.CancelFunc
	wg     sync.WaitGroup

	// Metrics
	checkedCount int64
	markedCount  int64
	errorCount   int64
	metricsMutex sync.RWMutex
}

// NewWatchdog creates a new watchdog instance
func NewWatchdog(config HardenedScanConfig, store store.Store) *Watchdog {
	ctx, cancel := context.WithCancel(context.Background())

	return &Watchdog{
		config: config,
		store:  store,
		ctx:    ctx,
		cancel: cancel,
	}
}

// Start starts the watchdog monitoring
func (w *Watchdog) Start() {
	w.wg.Add(1)
	go w.runWatchdogLoop()

	log.Printf("[INFO] Scan watchdog started (interval: %v, timeout: %v)",
		w.config.WatchdogInterval, w.config.ScanTimeout)
}

// Stop gracefully stops the watchdog
func (w *Watchdog) Stop() {
	log.Printf("[INFO] Stopping scan watchdog")

	w.cancel()
	w.wg.Wait()

	log.Printf("[INFO] Scan watchdog stopped")
}

// GetStats returns watchdog statistics
func (w *Watchdog) GetStats() WatchdogStats {
	w.metricsMutex.RLock()
	defer w.metricsMutex.RUnlock()

	return WatchdogStats{
		CheckedCount: w.checkedCount,
		MarkedCount:  w.markedCount,
		ErrorCount:   w.errorCount,
		LastCheck:    time.Now(), // TODO: Track actual last check time
	}
}

// runWatchdogLoop is the main watchdog monitoring loop
func (w *Watchdog) runWatchdogLoop() {
	defer w.wg.Done()

	ticker := time.NewTicker(w.config.WatchdogInterval)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			w.checkStaleScanJobs()
		case <-w.ctx.Done():
			return
		}
	}
}

// checkStaleScanJobs checks for stale scan jobs and marks them as failed
func (w *Watchdog) checkStaleScanJobs() {
	w.incrementCheckedCount()

	// Calculate timeout in seconds
	timeoutSeconds := int(w.config.ScanTimeout.Seconds())

	// Mark stale scan jobs as failed
	staleScanIDs, err := w.store.Scans().MarkStaleScanJobsAsFailed(w.ctx, timeoutSeconds)
	if err != nil {
		log.Printf("[ERROR] Watchdog failed to mark stale scan jobs as failed: %v", err)
		w.incrementErrorCount()
		return
	}

	if len(staleScanIDs) > 0 {
		log.Printf("[WARN] Watchdog marked %d stale scan jobs as failed: %v", len(staleScanIDs), staleScanIDs)
		w.addMarkedCount(int64(len(staleScanIDs)))
	}
}

// MarkInFlightJobsAsPaused marks all running scan jobs as paused (for graceful restart)
func (w *Watchdog) MarkInFlightJobsAsPaused(reason string) error {
	log.Printf("[INFO] Marking all in-flight scan jobs as paused: %s", reason)

	pausedScanIDs, err := w.store.Scans().MarkInFlightJobsAsPaused(w.ctx, reason)
	if err != nil {
		log.Printf("[ERROR] Failed to mark in-flight scan jobs as paused: %v", err)
		w.incrementErrorCount()
		return err
	}

	if len(pausedScanIDs) > 0 {
		log.Printf("[INFO] Marked %d in-flight scan jobs as paused: %v", len(pausedScanIDs), pausedScanIDs)
		w.addMarkedCount(int64(len(pausedScanIDs)))
	}

	return nil
}

// MarkInFlightJobsAsFailed marks all running scan jobs as failed (for actual failures)
func (w *Watchdog) MarkInFlightJobsAsFailed(reason string) error {
	// Check if this is a graceful restart/shutdown - mark as paused instead
	lowerReason := strings.ToLower(reason)
	if strings.Contains(lowerReason, "restart") ||
		strings.Contains(lowerReason, "shutdown") ||
		strings.Contains(lowerReason, "graceful") {
		return w.MarkInFlightJobsAsPaused(reason)
	}

	log.Printf("[INFO] Marking all in-flight scan jobs as failed: %s", reason)

	failedScanIDs, err := w.store.Scans().MarkInFlightJobsAsFailed(w.ctx, reason)
	if err != nil {
		log.Printf("[ERROR] Failed to mark in-flight scan jobs as failed: %v", err)
		w.incrementErrorCount()
		return err
	}

	if len(failedScanIDs) > 0 {
		log.Printf("[INFO] Marked %d in-flight scan jobs as failed: %v", len(failedScanIDs), failedScanIDs)
		w.addMarkedCount(int64(len(failedScanIDs)))

		// Recovery: Check if any of the failed jobs actually have all phases completed
		// If so, update the job status back to 'completed'
		recoveredCount := 0
		for _, scanID := range failedScanIDs {
			if err := w.recoverCompletedScan(scanID); err != nil {
				log.Printf("[WARN] Failed to recover potentially completed scan %s: %v", scanID, err)
			} else {
				recoveredCount++
			}
		}

		if recoveredCount > 0 {
			log.Printf("[INFO] Recovered %d scans that were actually completed", recoveredCount)
		}
	}

	return nil
}

// recoverCompletedScan checks if a scan marked as failed actually has all phases completed
// and if so, updates the scan status back to 'completed'
func (w *Watchdog) recoverCompletedScan(scanID string) error {
	// Check if scan progress tracking is available
	if w.store.ScanProgress() == nil {
		return nil // No recovery possible without progress tracking
	}

	// Get all phases for this scan
	phases, err := w.store.ScanProgress().GetScanPhases(w.ctx, scanID)
	if err != nil {
		return err
	}

	if len(phases) == 0 {
		return nil // No phases to check
	}

	// Check if all phases are completed
	allCompleted := true
	for _, phase := range phases {
		if phase.Status != "completed" {
			allCompleted = false
			break
		}
	}

	// If all phases are completed, update the main scan job status
	if allCompleted {
		log.Printf("[INFO] Recovering scan %s - all phases completed", scanID)

		// Mark the scan job as completed
		if err := w.store.Scans().CompletesScanJob(w.ctx, scanID); err != nil {
			return err
		}

		log.Printf("[INFO] Successfully recovered scan %s status to 'completed'", scanID)
	}

	return nil
}

// Helper methods for thread-safe metrics

func (w *Watchdog) incrementCheckedCount() {
	w.metricsMutex.Lock()
	w.checkedCount++
	w.metricsMutex.Unlock()
}

func (w *Watchdog) addMarkedCount(count int64) {
	w.metricsMutex.Lock()
	w.markedCount += count
	w.metricsMutex.Unlock()
}

func (w *Watchdog) incrementErrorCount() {
	w.metricsMutex.Lock()
	w.errorCount++
	w.metricsMutex.Unlock()
}
