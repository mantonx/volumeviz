package realtime

import "context"

// BroadcasterInterface defines the interface for broadcasting real-time updates
type BroadcasterInterface interface {
	// Existing scan broadcasting methods
	BroadcastScanStarted(scanID, volumeID string)
	BroadcastScanProgress(volumeID, scanID string, data interface{}) // Direct broadcast without DB lookup
	BroadcastComprehensiveScanProgress(ctx context.Context, scanID, volumeID string) error
	BroadcastScanComplete(scanID, volumeID string)
	BroadcastScanError(scanID, volumeID string, errorMsg string, errorCode string)
	
	// Comprehensive real-time broadcasting methods
	BroadcastHistoricalDataUpdate(data HistoricalDataUpdate)
	BroadcastStatisticsUpdate(data StatisticsUpdate)
	BroadcastSystemHealth(data SystemHealthUpdate)
	BroadcastError(errorEvent ErrorEvent)
	
	// Convenience methods for common scenarios
	BroadcastScanHistoricalUpdate(volumeID, scanID string, scanResult interface{})
	BroadcastUsageSnapshot(volumeID string, snapshot interface{})
	BroadcastCapacityAlert(volumeID string, severity string, message string)
}

// Ensure our implementations satisfy the interface
var _ BroadcasterInterface = (*Broadcaster)(nil)