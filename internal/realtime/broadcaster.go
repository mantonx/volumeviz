package realtime

import (
	"context"
	"log"
	"sync"
	"time"

	"github.com/mantonx/volumeviz/internal/store"
)

// Broadcaster handles real-time broadcasting with WebSocket architecture
type Broadcaster struct {
	service              *RealtimeService
	store                store.Store
	lastBroadcastByScan  map[string]time.Time // Track last broadcast per scanID
	broadcastMutex       sync.Mutex           // Protect lastBroadcastByScan
	broadcastMinInterval time.Duration        // Minimum interval between broadcasts (default: 1 second)
}

// NewBroadcaster creates a new progress broadcaster
func NewBroadcaster(service *RealtimeService, store store.Store) *Broadcaster {
	return &Broadcaster{
		service:              service,
		store:                store,
		lastBroadcastByScan:  make(map[string]time.Time),
		broadcastMinInterval: 1 * time.Second, // Throttle to max 1 broadcast per second per scan
	}
}

// ComprehensiveScanProgress represents comprehensive scan progress information
type ComprehensiveScanProgress struct {
	ScanID           string                 `json:"scan_id"`
	VolumeID         string                 `json:"volume_id"`
	OverallStatus    string                 `json:"overall_status"`
	OverallProgress  int                    `json:"overall_progress"`
	Phases           []ScanPhaseProgress    `json:"phases"`
	RecentErrors     []ScanError            `json:"recent_errors,omitempty"`
	PerformanceStats *PerformanceStats      `json:"performance_stats,omitempty"`
	StartedAt        *time.Time             `json:"started_at,omitempty"`
	CompletedAt      *time.Time             `json:"completed_at,omitempty"`
	Metadata         map[string]interface{} `json:"metadata,omitempty"`
}

// ScanPhaseProgress represents individual scan phase information
type ScanPhaseProgress struct {
	PhaseName        string     `json:"phase_name"`
	PhaseOrder       int        `json:"phase_order"`
	Status           string     `json:"status"`
	Progress         int        `json:"progress"`
	ItemsProcessed   int64      `json:"items_processed"`
	ItemsTotal       int64      `json:"items_total"`
	ItemsSuccessful  int64      `json:"items_successful"`
	ItemsFailed      int64      `json:"items_failed"`
	BytesProcessed   int64      `json:"bytes_processed"`
	BytesTotal       int64      `json:"bytes_total"`
	ItemsPerSecond   float64    `json:"items_per_second"`
	BytesPerSecond   int64      `json:"bytes_per_second"`
	CurrentItem      string     `json:"current_item,omitempty"`
	CurrentDepth     int        `json:"current_depth"`
	StartedAt        *time.Time `json:"started_at,omitempty"`
	CompletedAt      *time.Time `json:"completed_at,omitempty"`
	EstimatedEndTime *time.Time `json:"estimated_end_time,omitempty"`
	ErrorMessage     string     `json:"error_message,omitempty"`
	ErrorCount       int        `json:"error_count"`
}

// ScanError represents scan error information
type ScanError struct {
	ErrorType        string    `json:"error_type"`
	ErrorCategory    string    `json:"error_category"`
	Severity         string    `json:"severity"`
	Component        string    `json:"component"`
	Operation        string    `json:"operation"`
	ItemPath         string    `json:"item_path,omitempty"`
	ItemName         string    `json:"item_name,omitempty"`
	ErrorMessage     string    `json:"error_message"`
	TechnicalDetails string    `json:"technical_details,omitempty"`
	OccurredAt       time.Time `json:"occurred_at"`
	RetryCount       int       `json:"retry_count"`
}

// PerformanceStats represents performance statistics
type PerformanceStats struct {
	ElapsedSeconds            int     `json:"elapsed_seconds"`
	EstimatedRemainingSeconds int     `json:"estimated_remaining_seconds"`
	EstimationConfidence      string  `json:"estimation_confidence"`
	OverallItemsPerSecond     float64 `json:"overall_items_per_second"`
	OverallBytesPerSecond     int64   `json:"overall_bytes_per_second"`
	ErrorRate                 float64 `json:"error_rate"`
}

// Legacy type aliases for compatibility with existing code
type ScanProgressData struct {
	ScanID         string     `json:"scan_id"`
	VolumeID       string     `json:"volume_id"`
	Progress       int        `json:"progress"`
	Status         string     `json:"status"`
	EstimatedETA   *string    `json:"estimated_eta,omitempty"`
	CurrentSize    int64      `json:"current_size,omitempty"`
	FilesProcessed int64      `json:"files_processed,omitempty"`
	Method         string     `json:"method,omitempty"`
	StartedAt      time.Time  `json:"started_at,omitempty"`
}

type ScanCompleteData struct {
	ScanID         string        `json:"scan_id"`
	VolumeID       string        `json:"volume_id"`
	Success        bool          `json:"success"`
	Duration       time.Duration `json:"duration"`
	TotalSize      int64         `json:"total_size"`
	FileCount      int           `json:"file_count"`
	DirectoryCount int           `json:"directory_count"`
	Method         string        `json:"method"`
	ScannedAt      time.Time     `json:"scanned_at"`
}

type VolumeUpdateData struct {
	VolumeID     string                 `json:"volume_id"`
	VolumeName   string                 `json:"volume_name"`
	UpdateType   string                 `json:"update_type"`
	Action       string                 `json:"action"`
	ContainerID  string                 `json:"container_id,omitempty"`
	Details      map[string]interface{} `json:"details,omitempty"`
	Data         interface{}            `json:"data"`
}

// BroadcastScanStarted broadcasts when a scan starts
func (eb *Broadcaster) BroadcastScanStarted(scanID, volumeID string) {
	if eb.service == nil {
		return
	}

	data := map[string]interface{}{
		"scan_id":   scanID,
		"volume_id": volumeID,
		"status":    "started",
		"timestamp": time.Now().Unix(),
	}

	eb.service.BroadcastScanEvent("started", volumeID, scanID, data)
	log.Printf("Broadcast scan started: %s (volume: %s)", scanID, volumeID)
}

// BroadcastScanProgress broadcasts scan progress directly (without database lookup)
func (eb *Broadcaster) BroadcastScanProgress(volumeID, scanID string, data interface{}) {
	if eb.service == nil {
		return
	}
	
	eb.service.BroadcastScanProgress(volumeID, scanID, data)
}

// BroadcastComprehensiveScanProgress broadcasts comprehensive progress from database
func (eb *Broadcaster) BroadcastComprehensiveScanProgress(ctx context.Context, scanID, volumeID string) error {
	if eb.service == nil || eb.store == nil {
		return nil
	}

	// Centralized throttling - prevent broadcast spam from ANY source
	eb.broadcastMutex.Lock()
	lastBroadcast, exists := eb.lastBroadcastByScan[scanID]
	now := time.Now()
	shouldBroadcast := !exists || now.Sub(lastBroadcast) >= eb.broadcastMinInterval
	if shouldBroadcast {
		eb.lastBroadcastByScan[scanID] = now
	}
	eb.broadcastMutex.Unlock()

	// Throttle: skip this broadcast if called too soon
	if !shouldBroadcast {
		return nil // Silently skip - not an error
	}

	scanProgressRepo := eb.store.ScanProgress()

	// Get scan phases
	phases, err := scanProgressRepo.GetScanPhases(ctx, scanID)
	if err != nil {
		log.Printf("Failed to get scan phases for broadcast: %v", err)
		return err
	}

	// Skip broadcasting if no phases exist (scan completed or not started)
	if len(phases) == 0 {
		return nil // Silently skip - no active scan to broadcast
	}

	// Convert to enhanced data types
	wsPhases := make([]ScanPhaseProgress, len(phases))
	overallProgress := 0
	completedPhases := 0
	overallStatus := "pending"

	for i, phase := range phases {
		wsPhases[i] = ScanPhaseProgress{
			PhaseName:        phase.PhaseName,
			PhaseOrder:       phase.PhaseOrder,
			Status:           phase.Status,
			Progress:         phase.Progress,
			ItemsProcessed:   phase.ItemsProcessed,
			ItemsTotal:       phase.ItemsTotal,
			ItemsSuccessful:  phase.ItemsSuccessful,
			ItemsFailed:      phase.ItemsFailed,
			BytesProcessed:   phase.BytesProcessed,
			BytesTotal:       phase.BytesTotal,
			ItemsPerSecond:   phase.ItemsPerSecond,
			BytesPerSecond:   phase.BytesPerSecond,
			CurrentItem:      phase.CurrentItem,
			CurrentDepth:     phase.CurrentDepth,
			StartedAt:        phase.StartedAt,
			CompletedAt:      phase.CompletedAt,
			EstimatedEndTime: phase.EstimatedCompletionAt,
			ErrorMessage:     phase.ErrorMessage,
			ErrorCount:       int(phase.ErrorCount),
		}

		// Calculate overall progress
		overallProgress += phase.Progress
		if phase.Status == "completed" {
			completedPhases++
		}
		if phase.Status == "running" {
			overallStatus = "running"
		} else if phase.Status == "failed" && overallStatus != "running" {
			overallStatus = "failed"
		}
	}

	// Calculate weighted overall progress
	if len(phases) > 0 {
		overallProgress = overallProgress / len(phases)
	}

	if completedPhases == len(phases) && len(phases) > 0 {
		overallStatus = "completed"
		overallProgress = 100
	}

	// Get recent errors
	recentErrors, err := scanProgressRepo.GetScanErrors(ctx, scanID, "", 10, 0)
	if err != nil {
		log.Printf("Failed to get scan errors for broadcast: %v", err)
		// Continue without errors - not critical
	}

	wsErrors := make([]ScanError, len(recentErrors))
	for i, err := range recentErrors {
		wsErrors[i] = ScanError{
			ErrorType:        err.ErrorType,
			ErrorCategory:    err.ErrorCategory,
			Severity:         err.Severity,
			Component:        err.Component,
			Operation:        err.Operation,
			ItemPath:         err.ItemPath,
			ItemName:         err.ItemName,
			ErrorMessage:     err.ErrorMessage,
			TechnicalDetails: err.TechnicalDetails,
			OccurredAt:       err.OccurredAt,
			RetryCount:       err.RetryCount,
		}
	}

	// Calculate performance statistics
	var performanceStats *PerformanceStats
	if len(phases) > 0 {
		var startedAt *time.Time
		var completedAt *time.Time
		
		// Find earliest start time and latest completion time
		for _, phase := range phases {
			if phase.StartedAt != nil && (startedAt == nil || phase.StartedAt.Before(*startedAt)) {
				startedAt = phase.StartedAt
			}
			if phase.CompletedAt != nil && (completedAt == nil || phase.CompletedAt.After(*completedAt)) {
				completedAt = phase.CompletedAt
			}
		}
		
		if startedAt != nil {
			var elapsedSeconds int
			var estimatedRemainingSeconds int
			
			if overallStatus == "completed" && completedAt != nil {
				elapsedSeconds = int(completedAt.Sub(*startedAt).Seconds())
			} else {
				elapsedSeconds = int(time.Since(*startedAt).Seconds())
			}
			
			// Calculate estimated remaining time based on progress
			if overallProgress > 0 && overallStatus == "running" {
				totalEstimatedSeconds := float64(elapsedSeconds) * 100.0 / float64(overallProgress)
				estimatedRemainingSeconds = int(totalEstimatedSeconds) - elapsedSeconds
				if estimatedRemainingSeconds < 0 {
					estimatedRemainingSeconds = 0
				}
			}
			
			// Calculate aggregate performance metrics
			var totalItemsPerSecond float64
			var totalBytesPerSecond int64
			var errorCount int64
			
			for _, phase := range phases {
				totalItemsPerSecond += phase.ItemsPerSecond
				totalBytesPerSecond += phase.BytesPerSecond
				errorCount += int64(phase.ErrorCount)
			}
			
			// Calculate error rate (errors per minute)
			errorRate := 0.0
			if elapsedSeconds > 0 {
				errorRate = float64(errorCount) * 60.0 / float64(elapsedSeconds)
			}
			
			// Calculate confidence
			confidence := "low"
			if overallProgress > 0 && elapsedSeconds > 30 {
				timeStability := 1.0
				if elapsedSeconds > 300 { // 5 minutes
					timeStability = 0.8
				}
				
				progressFactor := float64(overallProgress) / 100.0
				confidenceScore := progressFactor * timeStability
				
				if confidenceScore > 0.7 {
					confidence = "high"
				} else if confidenceScore > 0.3 {
					confidence = "medium"
				}
			}
			
			performanceStats = &PerformanceStats{
				ElapsedSeconds:            elapsedSeconds,
				EstimatedRemainingSeconds: estimatedRemainingSeconds,
				EstimationConfidence:      confidence,
				OverallItemsPerSecond:     totalItemsPerSecond,
				OverallBytesPerSecond:     totalBytesPerSecond,
				ErrorRate:                 errorRate,
			}
		}
	}

	// Create comprehensive progress data
	progress := ComprehensiveScanProgress{
		ScanID:           scanID,
		VolumeID:         volumeID,
		OverallStatus:    overallStatus,
		OverallProgress:  overallProgress,
		Phases:           wsPhases,
		RecentErrors:     wsErrors,
		PerformanceStats: performanceStats,
	}
	
	// Add timing information from phases
	if len(phases) > 0 {
		// Use earliest start time
		for _, phase := range phases {
			if phase.StartedAt != nil && (progress.StartedAt == nil || phase.StartedAt.Before(*progress.StartedAt)) {
				progress.StartedAt = phase.StartedAt
			}
		}
		// Use latest completion time
		for _, phase := range phases {
			if phase.CompletedAt != nil && (progress.CompletedAt == nil || phase.CompletedAt.After(*progress.CompletedAt)) {
				progress.CompletedAt = phase.CompletedAt
			}
		}
	}

	// Broadcast the comprehensive progress
	eb.service.BroadcastScanProgress(volumeID, scanID, progress)
	log.Printf("Broadcasted comprehensive scan progress for scan %s, volume %s (phases: %d, overall: %d%%)", 
		scanID, volumeID, len(progress.Phases), progress.OverallProgress)
	return nil
}

// BroadcastScanComplete broadcasts scan completion
func (eb *Broadcaster) BroadcastScanComplete(scanID, volumeID string) {
	if eb.service == nil {
		return
	}

	data := map[string]interface{}{
		"scan_id":   scanID,
		"volume_id": volumeID,
		"status":    "completed",
		"timestamp": time.Now().Unix(),
	}

	eb.service.BroadcastScanEvent("completed", volumeID, scanID, data)
	log.Printf("Broadcast scan completed: %s (volume: %s)", scanID, volumeID)
}

// BroadcastScanError broadcasts scan errors
func (eb *Broadcaster) BroadcastScanError(scanID, volumeID string, errorMsg string, errorCode string) {
	if eb.service == nil {
		return
	}

	data := map[string]interface{}{
		"scan_id":     scanID,
		"volume_id":   volumeID,
		"status":      "error",
		"error":       errorMsg,
		"error_code":  errorCode,
		"timestamp":   time.Now().Unix(),
	}

	eb.service.BroadcastScanEvent("failed", volumeID, scanID, data)
	log.Printf("Broadcast scan error: %s (volume: %s, error: %s)", scanID, volumeID, errorMsg)
}

// PublishVolumeUpdate publishes volume update events
func (eb *Broadcaster) PublishVolumeUpdate(updateData VolumeUpdateData) {
	if eb.service == nil {
		return
	}

	eb.service.BroadcastVolumeUpdate(updateData)
}

// PublishScanProgress publishes scan progress events  
func (eb *Broadcaster) PublishScanProgress(progressData ScanProgressData) {
	if eb.service == nil {
		return
	}

	eb.service.BroadcastScanProgress(progressData.VolumeID, progressData.ScanID, progressData)
}

// PublishScanError publishes scan error events
func (eb *Broadcaster) PublishScanError(volumeID string, err error, method string) {
	if eb.service == nil {
		return
	}

	errorMsg := err.Error()
	scanID := "" // TODO: Extract scan ID if available
	eb.BroadcastScanError(scanID, volumeID, errorMsg, method)
}

// PublishScanComplete publishes scan completion events
func (eb *Broadcaster) PublishScanComplete(completeData ScanCompleteData) {
	if eb.service == nil {
		return
	}

	eb.BroadcastScanComplete(completeData.ScanID, completeData.VolumeID)
}

// =============================================================================
// COMPREHENSIVE REAL-TIME BROADCASTING SYSTEM
// =============================================================================

// Historical Data Broadcasting
// =============================================================================

// HistoricalDataUpdate represents historical scan data updates
type HistoricalDataUpdate struct {
	VolumeID        string    `json:"volume_id"`
	ScanID          string    `json:"scan_id"`
	UpdateType      string    `json:"update_type"` // "scan_completed", "data_archived", "trends_updated"
	TotalSize       int64     `json:"total_size"`
	FileCount       int       `json:"file_count"`
	DirectoryCount  int       `json:"directory_count"`
	ScanDuration    int64     `json:"scan_duration_ms"`
	Method          string    `json:"method"`
	CompletedAt     time.Time `json:"completed_at"`
	TrendData       *TrendData `json:"trend_data,omitempty"`
}

type TrendData struct {
	GrowthRate       float64   `json:"growth_rate_percent"`
	SizeChange       int64     `json:"size_change_bytes"`
	FileCountChange  int       `json:"file_count_change"`
	LastComparedScan time.Time `json:"last_compared_scan"`
	TrendDirection   string    `json:"trend_direction"` // "growing", "shrinking", "stable"
}

// BroadcastHistoricalDataUpdate broadcasts when historical scan data is updated
func (eb *Broadcaster) BroadcastHistoricalDataUpdate(data HistoricalDataUpdate) {
	if eb.service == nil {
		return
	}

	eb.service.BroadcastToRoom("historical_data", "historical.updated", data)
	eb.service.BroadcastToRoom("volume_"+data.VolumeID, "historical.updated", data)
	
	log.Printf("Broadcasted historical data update: %s for volume %s (type: %s)", 
		data.ScanID, data.VolumeID, data.UpdateType)
}

// Statistics and Analytics Broadcasting
// =============================================================================

// StatisticsUpdate represents system statistics updates
type StatisticsUpdate struct {
	UpdateType      string                 `json:"update_type"` // "usage_snapshot", "performance_metrics", "capacity_alert"
	Timestamp       time.Time              `json:"timestamp"`
	SystemStats     *SystemStatistics      `json:"system_stats,omitempty"`
	VolumeStats     *VolumeStatistics      `json:"volume_stats,omitempty"`
	PerformanceData *PerformanceMetrics    `json:"performance_data,omitempty"`
	AlertData       *AlertInformation      `json:"alert_data,omitempty"`
}

type SystemStatistics struct {
	TotalVolumes        int   `json:"total_volumes"`
	ActiveScans         int   `json:"active_scans"`
	TotalStorageBytes   int64 `json:"total_storage_bytes"`
	TotalFiles          int64 `json:"total_files"`
	TotalDirectories    int64 `json:"total_directories"`
	AverageGrowthRate   float64 `json:"average_growth_rate"`
	SystemHealthScore   float64 `json:"system_health_score"`
}

type VolumeStatistics struct {
	VolumeID            string    `json:"volume_id"`
	CurrentSize         int64     `json:"current_size"`
	FileCount           int       `json:"file_count"`
	DirectoryCount      int       `json:"directory_count"`
	GrowthRate          float64   `json:"growth_rate_percent"`
	LastScanTime        time.Time `json:"last_scan_time"`
	ScanFrequency       string    `json:"scan_frequency"`
	HealthStatus        string    `json:"health_status"`
}

type PerformanceMetrics struct {
	AverageScanDuration   int64   `json:"average_scan_duration_ms"`
	ScansPerHour          float64 `json:"scans_per_hour"`
	SystemLoad            float64 `json:"system_load"`
	MemoryUsage           float64 `json:"memory_usage_percent"`
	DiskIORate            float64 `json:"disk_io_rate_mbps"`
	NetworkLatency        float64 `json:"network_latency_ms"`
	ErrorRate             float64 `json:"error_rate_percent"`
}

type AlertInformation struct {
	AlertID       string    `json:"alert_id"`
	AlertType     string    `json:"alert_type"` // "capacity", "performance", "error", "system"
	Severity      string    `json:"severity"` // "low", "medium", "high", "critical"
	VolumeID      string    `json:"volume_id,omitempty"`
	Title         string    `json:"title"`
	Message       string    `json:"message"`
	ActionRequired bool     `json:"action_required"`
	CreatedAt     time.Time `json:"created_at"`
}

// BroadcastStatisticsUpdate broadcasts system statistics updates
func (eb *Broadcaster) BroadcastStatisticsUpdate(data StatisticsUpdate) {
	if eb.service == nil {
		return
	}

	// Broadcast to different rooms based on update type
	switch data.UpdateType {
	case "usage_snapshot":
		eb.service.BroadcastToRoom("system_stats", "statistics.usage_updated", data)
		if data.VolumeStats != nil {
			eb.service.BroadcastToRoom("volume_"+data.VolumeStats.VolumeID, "statistics.usage_updated", data)
		}
	case "performance_metrics":
		eb.service.BroadcastToRoom("system_stats", "statistics.performance_updated", data)
		eb.service.BroadcastToRoom("performance_monitoring", "statistics.performance_updated", data)
	case "capacity_alert":
		eb.service.BroadcastToRoom("alerts", "statistics.alert", data)
		eb.service.BroadcastToRoom("system_stats", "statistics.alert", data)
		if data.VolumeStats != nil {
			eb.service.BroadcastToRoom("volume_"+data.VolumeStats.VolumeID, "statistics.alert", data)
		}
	}
	
	log.Printf("Broadcasted statistics update: %s (type: %s)", data.UpdateType, data.UpdateType)
}

// System Health Broadcasting
// =============================================================================

// SystemHealthUpdate represents system health status changes
type SystemHealthUpdate struct {
	Timestamp         time.Time            `json:"timestamp"`
	OverallHealth     string               `json:"overall_health"` // "healthy", "degraded", "critical"
	HealthScore       float64              `json:"health_score"` // 0.0 - 1.0
	Components        []ComponentHealth    `json:"components"`
	RecentEvents      []SystemEvent        `json:"recent_events"`
	Recommendations   []string             `json:"recommendations,omitempty"`
}

type ComponentHealth struct {
	ComponentName   string    `json:"component_name"` // "scanner", "database", "websocket", "storage"
	Status          string    `json:"status"` // "healthy", "warning", "error"
	LastChecked     time.Time `json:"last_checked"`
	ResponseTime    int64     `json:"response_time_ms,omitempty"`
	ErrorCount      int       `json:"error_count"`
	Details         string    `json:"details,omitempty"`
}

type SystemEvent struct {
	EventID     string    `json:"event_id"`
	EventType   string    `json:"event_type"` // "startup", "shutdown", "error", "recovery", "maintenance"
	Severity    string    `json:"severity"` // "info", "warning", "error", "critical"
	Component   string    `json:"component"`
	Message     string    `json:"message"`
	Timestamp   time.Time `json:"timestamp"`
	Resolved    bool      `json:"resolved"`
}

// BroadcastSystemHealth broadcasts system health updates
func (eb *Broadcaster) BroadcastSystemHealth(data SystemHealthUpdate) {
	if eb.service == nil {
		return
	}

	eb.service.BroadcastToRoom("system_health", "health.updated", data)
	eb.service.BroadcastToRoom("system_stats", "health.updated", data)
	
	// Broadcast critical health issues to all connected clients
	if data.OverallHealth == "critical" || data.HealthScore < 0.3 {
		eb.service.BroadcastToRoom("global_notifications", "health.critical", data)
	}
	
	log.Printf("Broadcasted system health update: %s (score: %.2f)", 
		data.OverallHealth, data.HealthScore)
}

// Real-time Error and Event Broadcasting
// =============================================================================

// ErrorEvent represents detailed error information
type ErrorEvent struct {
	ErrorID         string                 `json:"error_id"`
	Timestamp       time.Time              `json:"timestamp"`
	ErrorType       string                 `json:"error_type"` // "scan_error", "system_error", "network_error", "database_error"
	Severity        string                 `json:"severity"` // "low", "medium", "high", "critical"
	Component       string                 `json:"component"`
	VolumeID        string                 `json:"volume_id,omitempty"`
	ScanID          string                 `json:"scan_id,omitempty"`
	ErrorMessage    string                 `json:"error_message"`
	TechnicalDetails string                `json:"technical_details"`
	UserImpact      string                 `json:"user_impact"`
	Resolution      string                 `json:"resolution,omitempty"`
	Context         map[string]interface{} `json:"context,omitempty"`
}

// BroadcastError broadcasts detailed error information
func (eb *Broadcaster) BroadcastError(errorEvent ErrorEvent) {
	if eb.service == nil {
		return
	}

	// Broadcast to error monitoring room
	eb.service.BroadcastToRoom("error_monitoring", "error.occurred", errorEvent)
	
	// Broadcast to relevant volume/scan rooms if applicable
	if errorEvent.VolumeID != "" {
		eb.service.BroadcastToRoom("volume_"+errorEvent.VolumeID, "error.occurred", errorEvent)
	}
	if errorEvent.ScanID != "" {
		eb.service.BroadcastToRoom("scan_"+errorEvent.ScanID, "error.occurred", errorEvent)
	}
	
	// Broadcast critical errors to all clients
	if errorEvent.Severity == "critical" {
		eb.service.BroadcastToRoom("global_notifications", "error.critical", errorEvent)
	}
	
	log.Printf("Broadcasted error event: %s (%s severity, component: %s)", 
		errorEvent.ErrorID, errorEvent.Severity, errorEvent.Component)
}

// Convenience Methods for Common Broadcasting Scenarios
// =============================================================================

// BroadcastScanHistoricalUpdate broadcasts when a scan result is saved to history
func (eb *Broadcaster) BroadcastScanHistoricalUpdate(volumeID, scanID string, scanResult interface{}) {
	// This would be called after a scan completes and data is saved to history
	// TODO: Extract actual scan result data
	update := HistoricalDataUpdate{
		VolumeID:    volumeID,
		ScanID:      scanID,
		UpdateType:  "scan_completed",
		CompletedAt: time.Now(),
		// TODO: Populate with actual scan result data
	}
	eb.BroadcastHistoricalDataUpdate(update)
}

// BroadcastUsageSnapshot broadcasts when a new usage snapshot is created
func (eb *Broadcaster) BroadcastUsageSnapshot(volumeID string, snapshot interface{}) {
	// TODO: Extract actual snapshot data
	statsUpdate := StatisticsUpdate{
		UpdateType: "usage_snapshot",
		Timestamp:  time.Now(),
		VolumeStats: &VolumeStatistics{
			VolumeID: volumeID,
			// TODO: Populate with actual snapshot data
		},
	}
	eb.BroadcastStatisticsUpdate(statsUpdate)
}

// BroadcastCapacityAlert broadcasts capacity-related alerts
func (eb *Broadcaster) BroadcastCapacityAlert(volumeID string, severity string, message string) {
	alert := AlertInformation{
		AlertID:        generateAlertID(),
		AlertType:      "capacity",
		Severity:       severity,
		VolumeID:       volumeID,
		Title:          "Volume Capacity Alert",
		Message:        message,
		ActionRequired: severity == "high" || severity == "critical",
		CreatedAt:      time.Now(),
	}
	
	statsUpdate := StatisticsUpdate{
		UpdateType: "capacity_alert",
		Timestamp:  time.Now(),
		AlertData:  &alert,
	}
	eb.BroadcastStatisticsUpdate(statsUpdate)
}

// Helper function to generate alert IDs
func generateAlertID() string {
	return "alert_" + time.Now().Format("20060102150405")
}