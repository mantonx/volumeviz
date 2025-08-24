package filesystem

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/mantonx/volumeviz/internal/models"
	"github.com/mantonx/volumeviz/internal/store"
	"github.com/mantonx/volumeviz/internal/websocket"
)

// ProgressThrottler manages throttled progress updates to prevent database flooding
// It ensures updates are sent at most once per update interval, batching rapid changes
type ProgressThrottler struct {
	store          store.Store
	updateInterval time.Duration
	mu             sync.Mutex
	wsBroadcaster  *websocket.ProgressBroadcaster

	// Tracking for each scan
	scanTrackers map[string]*scanProgressTracker
}

// scanProgressTracker tracks progress for a single scan
type scanProgressTracker struct {
	scanID          string
	lastUpdate      time.Time
	pendingUpdate   *models.UpdateScanPhaseParams
	forceNextUpdate bool
	updateCount     int64
	throttledCount  int64
}

// NewProgressThrottler creates a new progress throttler
func NewProgressThrottler(store store.Store, updateInterval time.Duration, wsBroadcaster *websocket.ProgressBroadcaster) *ProgressThrottler {
	if updateInterval < 100*time.Millisecond {
		updateInterval = 2 * time.Second // Default to 2 seconds
	}

	return &ProgressThrottler{
		store:          store,
		updateInterval: updateInterval,
		scanTrackers:   make(map[string]*scanProgressTracker),
		wsBroadcaster:  wsBroadcaster,
	}
}

// QueueUpdate queues a progress update for throttled delivery
func (pt *ProgressThrottler) QueueUpdate(ctx context.Context, scanID string, update models.UpdateScanPhaseParams) error {
	pt.mu.Lock()
	defer pt.mu.Unlock()

	// Get or create tracker for this scan
	tracker, exists := pt.scanTrackers[scanID]
	if !exists {
		tracker = &scanProgressTracker{
			scanID:     scanID,
			lastUpdate: time.Time{}, // Zero time ensures first update goes through
		}
		pt.scanTrackers[scanID] = tracker
	}

	// Store the pending update (overwrites previous pending)
	tracker.pendingUpdate = &update
	tracker.updateCount++

	// Check if we should send the update now
	if pt.shouldSendUpdate(tracker) {
		return pt.sendUpdateLocked(ctx, tracker)
	}

	// Update is queued for later
	tracker.throttledCount++
	return nil
}

// ForceUpdate forces an immediate update (use for phase completions, errors, etc.)
func (pt *ProgressThrottler) ForceUpdate(ctx context.Context, scanID string, update models.UpdateScanPhaseParams) error {
	pt.mu.Lock()
	defer pt.mu.Unlock()

	tracker, exists := pt.scanTrackers[scanID]
	if !exists {
		tracker = &scanProgressTracker{
			scanID:     scanID,
			lastUpdate: time.Time{},
		}
		pt.scanTrackers[scanID] = tracker
	}

	tracker.pendingUpdate = &update
	tracker.forceNextUpdate = true

	return pt.sendUpdateLocked(ctx, tracker)
}

// FlushPending sends any pending updates for a scan
func (pt *ProgressThrottler) FlushPending(ctx context.Context, scanID string) error {
	pt.mu.Lock()
	defer pt.mu.Unlock()

	tracker, exists := pt.scanTrackers[scanID]
	if !exists || tracker.pendingUpdate == nil {
		return nil
	}

	return pt.sendUpdateLocked(ctx, tracker)
}

// FlushAll sends all pending updates for all scans
func (pt *ProgressThrottler) FlushAll(ctx context.Context) error {
	pt.mu.Lock()
	defer pt.mu.Unlock()

	var lastErr error
	for _, tracker := range pt.scanTrackers {
		if tracker.pendingUpdate != nil {
			if err := pt.sendUpdateLocked(ctx, tracker); err != nil {
				lastErr = err
			}
		}
	}

	return lastErr
}

// Cleanup removes tracking for a completed scan
func (pt *ProgressThrottler) Cleanup(scanID string) {
	pt.mu.Lock()
	defer pt.mu.Unlock()

	if tracker, exists := pt.scanTrackers[scanID]; exists {
		if tracker.throttledCount > 0 {
			throttleRate := float64(tracker.throttledCount) / float64(tracker.updateCount) * 100
			fmt.Printf("[ProgressThrottler] Scan %s complete - Updates: %d, Throttled: %d (%.1f%% reduction)\n",
				scanID, tracker.updateCount, tracker.throttledCount, throttleRate)
		}
	}

	delete(pt.scanTrackers, scanID)
}

// GetStats returns throttling statistics for monitoring
func (pt *ProgressThrottler) GetStats(scanID string) (updates int64, throttled int64) {
	pt.mu.Lock()
	defer pt.mu.Unlock()

	if tracker, exists := pt.scanTrackers[scanID]; exists {
		return tracker.updateCount, tracker.throttledCount
	}
	return 0, 0
}

// StartPeriodicFlush starts a background goroutine that periodically flushes pending updates
func (pt *ProgressThrottler) StartPeriodicFlush(ctx context.Context) {
	go func() {
		ticker := time.NewTicker(pt.updateInterval / 2) // Check at half the interval
		defer ticker.Stop()

		for {
			select {
			case <-ctx.Done():
				// Final flush before shutdown
				pt.FlushAll(context.Background())
				return
			case <-ticker.C:
				pt.flushStaleUpdates(context.Background())
			}
		}
	}()
}

// Private methods

func (pt *ProgressThrottler) shouldSendUpdate(tracker *scanProgressTracker) bool {
	// Always send if forced
	if tracker.forceNextUpdate {
		return true
	}

	// Send if enough time has passed since last update
	return time.Since(tracker.lastUpdate) >= pt.updateInterval
}

func (pt *ProgressThrottler) sendUpdateLocked(ctx context.Context, tracker *scanProgressTracker) error {
	if tracker.pendingUpdate == nil {
		return nil
	}

	// Send the update to the database
	scanProgressRepo := pt.store.ScanProgress()
	if scanProgressRepo == nil {
		return fmt.Errorf("scan progress repository not available")
	}

	err := scanProgressRepo.UpdateScanPhaseProgress(ctx, *tracker.pendingUpdate)
	if err != nil {
		return fmt.Errorf("failed to update scan phase progress: %w", err)
	}

	// Broadcast progress update via WebSocket after successful database update
	if pt.wsBroadcaster != nil {
		// Get updated phase data to broadcast
		phase, wsErr := scanProgressRepo.GetScanPhase(ctx, tracker.pendingUpdate.ScanID, tracker.pendingUpdate.PhaseName)
		if wsErr == nil && phase != nil {
			pt.wsBroadcaster.BroadcastProgress(ctx, tracker.pendingUpdate.ScanID, phase)
		}
	}

	// Clear pending update and update tracking
	tracker.pendingUpdate = nil
	tracker.lastUpdate = time.Now()
	tracker.forceNextUpdate = false

	return nil
}

func (pt *ProgressThrottler) flushStaleUpdates(ctx context.Context) {
	pt.mu.Lock()
	defer pt.mu.Unlock()

	now := time.Now()
	for _, tracker := range pt.scanTrackers {
		if tracker.pendingUpdate != nil {
			// Flush if update has been pending for more than the interval
			if now.Sub(tracker.lastUpdate) >= pt.updateInterval {
				if err := pt.sendUpdateLocked(ctx, tracker); err != nil {
					fmt.Printf("[ProgressThrottler] Failed to flush stale update for scan %s: %v\n",
						tracker.scanID, err)
				}
			}
		}
	}
}

// SetWebSocketBroadcaster sets the WebSocket broadcaster for progress updates
func (pt *ProgressThrottler) SetWebSocketBroadcaster(broadcaster *websocket.ProgressBroadcaster) {
	pt.mu.Lock()
	defer pt.mu.Unlock()
	pt.wsBroadcaster = broadcaster
}
