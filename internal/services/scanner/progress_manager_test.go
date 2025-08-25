package scanner

import (
	"testing"
	"time"

	"github.com/mantonx/volumeviz/internal/models"
	"github.com/stretchr/testify/assert"
)

func TestNewProgressManager(t *testing.T) {
	// Test with nil broadcaster
	pm := NewProgressManager(nil)
	assert.NotNil(t, pm)
	assert.Nil(t, pm.broadcaster)
	assert.NotNil(t, pm.activeScans)
	assert.NotNil(t, pm.volumeToScan)
	assert.Equal(t, 1*time.Second, pm.updateInterval) // Default is 1 second
}

func TestProgressManagerStartScan(t *testing.T) {
	pm := NewProgressManager(nil)

	scanID := "test-scan-123"
	volumeID := "test-volume"

	// Start a new scan
	pm.StartScan(scanID, volumeID)

	// Verify scan was created
	pm.mutex.RLock()
	progress, exists := pm.activeScans[scanID]
	volumeMapping, volumeExists := pm.volumeToScan[volumeID]
	pm.mutex.RUnlock()

	assert.True(t, exists)
	assert.True(t, volumeExists)
	assert.Equal(t, scanID, volumeMapping)
	assert.NotNil(t, progress)
	assert.Equal(t, scanID, progress.ScanID)
	assert.Equal(t, volumeID, progress.VolumeID)
	assert.Equal(t, models.ScanStatusRunning, progress.Status)
	assert.NotNil(t, progress.Phases)
}

func TestProgressManagerGetProgress(t *testing.T) {
	pm := NewProgressManager(nil)

	scanID := "test-scan-123"
	volumeID := "test-volume"

	// Test non-existent scan
	progress, err := pm.GetProgress(scanID)
	assert.Error(t, err)
	assert.Nil(t, progress)

	// Start scan and test retrieval
	pm.StartScan(scanID, volumeID)
	progress, err = pm.GetProgress(scanID)
	assert.NoError(t, err)
	assert.NotNil(t, progress)
	assert.Equal(t, scanID, progress.ScanID)
	assert.Equal(t, volumeID, progress.VolumeID)
}

func TestProgressManagerUpdateProgress(t *testing.T) {
	pm := NewProgressManager(nil)

	scanID := "test-scan-123"
	volumeID := "test-volume"

	// Start scan
	pm.StartScan(scanID, volumeID)

	// Update volume scan progress
	update := ProgressUpdate{
		Type:           "volume_scan",
		Progress:       0.5,
		ItemsProcessed: 100,
		CurrentPath:    "/test/path",
	}

	pm.UpdateProgress(scanID, update)

	// Verify update
	progress, err := pm.GetProgress(scanID)
	assert.NoError(t, err)
	assert.NotNil(t, progress)

	phase, exists := progress.Phases["volume_scan"]
	assert.True(t, exists)
	assert.Equal(t, 0.5, phase.Progress)
	assert.Equal(t, int64(100), phase.ItemsProcessed)
	assert.Equal(t, "/test/path", progress.CurrentPath)
}

func TestProgressManagerFinishPhase(t *testing.T) {
	pm := NewProgressManager(nil)

	scanID := "test-scan-123"
	volumeID := "test-volume"

	// Start scan
	pm.StartScan(scanID, volumeID)

	// Finish volume scan phase successfully
	pm.FinishPhase(scanID, "volume_scan", true, "")

	progress, err := pm.GetProgress(scanID)
	assert.NoError(t, err)
	assert.NotNil(t, progress)

	phase, exists := progress.Phases["volume_scan"]
	assert.True(t, exists)
	assert.Equal(t, models.ScanStatusCompleted, phase.Status)
	assert.Equal(t, 1.0, phase.Progress)
	assert.NotNil(t, phase.CompletedAt)

	// Start and finish another phase with error
	pm.UpdateProgress(scanID, ProgressUpdate{
		Type:     "filesystem_indexing",
		Progress: 0.3,
	})
	pm.FinishPhase(scanID, "filesystem_indexing", false, "test error")

	progress, err = pm.GetProgress(scanID) // Re-fetch progress
	assert.NoError(t, err)
	phase, exists = progress.Phases["filesystem_indexing"]
	assert.True(t, exists)
	assert.Equal(t, models.ScanStatusFailed, phase.Status)
	assert.Equal(t, "test error", phase.Error)
}

func TestProgressManagerFinishPhaseSuccess(t *testing.T) {
	pm := NewProgressManager(nil)

	scanID := "test-scan-123"
	volumeID := "test-volume"

	// Start scan
	pm.StartScan(scanID, volumeID)

	// Test phase completion - this method exists
	pm.FinishPhase(scanID, "volume_scan", true, "")

	progress, err := pm.GetProgress(scanID)
	assert.NoError(t, err)
	assert.NotNil(t, progress)

	phase, exists := progress.Phases["volume_scan"]
	assert.True(t, exists)
	assert.Equal(t, models.ScanStatusCompleted, phase.Status)
}

func TestProgressManagerCleanup(t *testing.T) {
	pm := NewProgressManager(nil)

	scanID := "test-scan-123"
	volumeID := "test-volume"

	// Start scan
	pm.StartScan(scanID, volumeID)

	// Verify scan exists
	progress, err := pm.GetProgress(scanID)
	assert.NoError(t, err)
	assert.NotNil(t, progress)

	// Cleanup using the correct method name
	pm.CleanupScan(scanID)

	// Verify scan is removed
	progress, err = pm.GetProgress(scanID)
	assert.Error(t, err)
	assert.Nil(t, progress)

	// Verify volume mapping is removed
	pm.mutex.RLock()
	_, exists := pm.volumeToScan[volumeID]
	pm.mutex.RUnlock()
	assert.False(t, exists)
}

func TestProgressUpdateTypes(t *testing.T) {
	pm := NewProgressManager(nil)

	scanID := "test-scan-123"
	volumeID := "test-volume"
	pm.StartScan(scanID, volumeID)

	// Test different update types
	testCases := []struct {
		updateType string
		progress   float64
	}{
		{"volume_scan", 0.3},
		{"filesystem_indexing", 0.7},
		{"media_enrichment", 0.9},
	}

	for _, tc := range testCases {
		update := ProgressUpdate{
			Type:     tc.updateType,
			Progress: tc.progress,
		}

		pm.UpdateProgress(scanID, update)

		progress, err := pm.GetProgress(scanID)
		assert.NoError(t, err)
		phase, exists := progress.Phases[tc.updateType]

		assert.True(t, exists, "Phase %s should exist", tc.updateType)
		assert.Equal(t, tc.progress, phase.Progress, "Progress for %s should match", tc.updateType)
	}
}

func TestProgressManagerConcurrency(t *testing.T) {
	pm := NewProgressManager(nil)

	// Test concurrent access to progress manager
	scanID := "test-scan-123"
	volumeID := "test-volume"

	// Start scan
	pm.StartScan(scanID, volumeID)

	// Concurrent updates (simple test)
	done := make(chan bool, 2)

	go func() {
		for i := 0; i < 10; i++ {
			update := ProgressUpdate{
				Type:           "volume_scan",
				Progress:       float64(i) / 10.0,
				ItemsProcessed: int64(i * 10),
			}
			pm.UpdateProgress(scanID, update)
			time.Sleep(time.Millisecond)
		}
		done <- true
	}()

	go func() {
		for i := 0; i < 10; i++ {
			progress, err := pm.GetProgress(scanID)
			assert.NoError(t, err)
			assert.NotNil(t, progress)
			time.Sleep(time.Millisecond)
		}
		done <- true
	}()

	// Wait for both goroutines
	<-done
	<-done

	// Final verification
	progress, err := pm.GetProgress(scanID)
	assert.NoError(t, err)
	assert.NotNil(t, progress)
	assert.Equal(t, scanID, progress.ScanID)
}
