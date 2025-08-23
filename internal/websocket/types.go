package websocket

import (
	"time"
)

// MessageType defines the type of WebSocket message
type MessageType string

const (
	// Client to Server - Control Messages
	MessageTypePing       MessageType = "ping"
	MessageTypeSubscribe  MessageType = "subscribe"
	MessageTypeUnsubscribe MessageType = "unsubscribe"

	// Server to Client - Control Messages
	MessageTypePong           MessageType = "pong"
	MessageTypeSubscribed     MessageType = "subscribed"
	MessageTypeUnsubscribed   MessageType = "unsubscribed"
	MessageTypeError          MessageType = "error"

	// Server to Client - Data Updates
	MessageTypeVolumeUpdate     MessageType = "volume_update"
	MessageTypeVolumeListUpdate MessageType = "volume_list_update"
	
	// Scan Progress Events
	MessageTypeScanProgress       MessageType = "scan_progress_update"
	MessageTypeScanPhaseUpdate    MessageType = "scan_phase_update" 
	MessageTypeScanComplete       MessageType = "scan_complete"
	MessageTypeScanError          MessageType = "scan_error"
	MessageTypeScanStarted        MessageType = "scan_started"
	
	// File/Container Events
	MessageTypeFileUpdate       MessageType = "file_update"
	MessageTypeContainerUpdate  MessageType = "container_update"
	
	// System Events
	MessageTypeSystemStats      MessageType = "system_stats"
	MessageTypeHealthUpdate     MessageType = "health_update"
)

// Message represents a WebSocket message
type Message struct {
	Type      MessageType `json:"type"`
	Data      any         `json:"data,omitempty"`
	VolumeID  string      `json:"volume_id,omitempty"`
	Timestamp time.Time   `json:"timestamp"`
}

// VolumeData represents volume information for updates
type VolumeData struct {
	ID         string    `json:"id"`
	Name       string    `json:"name"`
	Driver     string    `json:"driver"`
	Mountpoint string    `json:"mountpoint"`
	CreatedAt  time.Time `json:"created_at"`
}

// ScanProgressData represents scan progress information
type ScanProgressData struct {
	Progress       int   `json:"progress"`
	CurrentSize    int64 `json:"current_size"`
	FilesProcessed int   `json:"files_processed"`
}

// ScanCompleteData represents scan completion information
type ScanCompleteData struct {
	VolumeID string     `json:"volume_id"`
	Result   ScanResult `json:"result"`
}

// ScanResult represents the result of a volume scan
type ScanResult struct {
	TotalSize      int64         `json:"total_size"`
	FileCount      int           `json:"file_count"`
	DirectoryCount int           `json:"directory_count"`
	ScannedAt      time.Time     `json:"scanned_at"`
	Method         string        `json:"method"`
	Duration       time.Duration `json:"duration"`
}

// ScanErrorData represents scan error information
type ScanErrorData struct {
	Error string `json:"error"`
	Code  string `json:"code"`
}

// =======================================
// Subscription and Control Data Types
// =======================================

// SubscriptionData represents subscription request data
type SubscriptionData struct {
	Event    string            `json:"event"`    // scan_progress, volume_updates, etc.
	Filters  map[string]string `json:"filters"`  // volume_id, scan_id, etc.
	ClientID string            `json:"client_id,omitempty"`
}

// ErrorData represents WebSocket error information
type ErrorData struct {
	Message string `json:"message"`
	Code    string `json:"code"`
	Details any    `json:"details,omitempty"`
}

// =======================================
// Enhanced Progress Data Types  
// =======================================

// ComprehensiveScanProgress represents complete scan progress with all phases
type ComprehensiveScanProgress struct {
	ScanID           string                `json:"scan_id"`
	VolumeID         string                `json:"volume_id"`
	OverallStatus    string                `json:"overall_status"` // running, completed, failed
	OverallProgress  int                   `json:"overall_progress"` // 0-100
	StartedAt        *time.Time            `json:"started_at,omitempty"`
	CompletedAt      *time.Time            `json:"completed_at,omitempty"`
	EstimatedEndTime *time.Time            `json:"estimated_end_time,omitempty"`
	Phases           []ScanPhaseProgress   `json:"phases"`
	RecentErrors     []ScanProgressError   `json:"recent_errors,omitempty"`
	PerformanceStats *ScanPerformanceStats `json:"performance_stats,omitempty"`
}

// ScanPhaseProgress represents progress of an individual scan phase
type ScanPhaseProgress struct {
	PhaseName        string     `json:"phase_name"` // volume_scan, filesystem_indexing, media_enrichment
	PhaseOrder       int        `json:"phase_order"`
	Status           string     `json:"status"` // pending, running, completed, failed, skipped
	Progress         int        `json:"progress"` // 0-100
	ItemsProcessed   int64      `json:"items_processed"`
	ItemsTotal       int64      `json:"items_total"`
	ItemsSuccessful  int64      `json:"items_successful"`
	ItemsFailed      int64      `json:"items_failed"`
	BytesProcessed   int64      `json:"bytes_processed"`
	BytesTotal       int64      `json:"bytes_total"`
	ItemsPerSecond   float64    `json:"items_per_second"`
	BytesPerSecond   int64      `json:"bytes_per_second"`
	CurrentItem      string     `json:"current_item,omitempty"`
	CurrentDepth     int        `json:"current_depth,omitempty"`
	StartedAt        *time.Time `json:"started_at,omitempty"`
	CompletedAt      *time.Time `json:"completed_at,omitempty"`
	EstimatedEndTime *time.Time `json:"estimated_end_time,omitempty"`
	ErrorMessage     string     `json:"error_message,omitempty"`
	ErrorCount       int64      `json:"error_count"`
}

// ScanProgressError represents a detailed scan error
type ScanProgressError struct {
	ErrorType        string    `json:"error_type"`
	ErrorCategory    string    `json:"error_category"`
	Severity         string    `json:"severity"`
	Component        string    `json:"component"`
	Operation        string    `json:"operation"`
	ItemPath         string    `json:"item_path"`
	ItemName         string    `json:"item_name"`
	ErrorMessage     string    `json:"error_message"`
	TechnicalDetails string    `json:"technical_details,omitempty"`
	OccurredAt       time.Time `json:"occurred_at"`
	RetryCount       int       `json:"retry_count"`
}

// ScanPerformanceStats represents performance metrics for the scan
type ScanPerformanceStats struct {
	ElapsedSeconds        int     `json:"elapsed_seconds"`
	EstimatedRemainingSeconds int `json:"estimated_remaining_seconds"`
	OverallItemsPerSecond float64 `json:"overall_items_per_second"`
	OverallBytesPerSecond int64   `json:"overall_bytes_per_second"`
	ErrorRate             float64 `json:"error_rate"` // errors per minute
	MemoryUsageBytes      int64   `json:"memory_usage_bytes,omitempty"`
	CPUUsagePercent       float64 `json:"cpu_usage_percent,omitempty"`
}

// =======================================
// Volume and System Data Types
// =======================================

// VolumeListUpdate represents updates to the volume list
type VolumeListUpdate struct {
	Action    string      `json:"action"` // added, removed, updated, refreshed
	Volume    *VolumeData `json:"volume,omitempty"`
	Volumes   []VolumeData `json:"volumes,omitempty"` // for bulk updates
	Timestamp time.Time   `json:"timestamp"`
}

// EnhancedVolumeData represents enhanced volume information
type EnhancedVolumeData struct {
	VolumeData
	SizeBytes         int64                      `json:"size_bytes,omitempty"`
	FileCount         int64                      `json:"file_count,omitempty"`
	LastScanned       *time.Time                 `json:"last_scanned,omitempty"`
	ScanStatus        string                     `json:"scan_status,omitempty"`
	ActiveScan        *ComprehensiveScanProgress `json:"active_scan,omitempty"`
	ContainerCount    int                        `json:"container_count,omitempty"`
	AttachedContainers []string                  `json:"attached_containers,omitempty"`
	HealthStatus      string                     `json:"health_status,omitempty"`
}

// ContainerUpdate represents container attachment changes
type ContainerUpdate struct {
	Action      string    `json:"action"` // attached, detached, updated
	ContainerID string    `json:"container_id"`
	VolumeID    string    `json:"volume_id"`
	Status      string    `json:"status"`
	Timestamp   time.Time `json:"timestamp"`
}

// SystemStats represents system-wide statistics
type SystemStats struct {
	TotalVolumes     int       `json:"total_volumes"`
	ActiveScans      int       `json:"active_scans"`
	TotalSizeBytes   int64     `json:"total_size_bytes"`
	MemoryUsageBytes int64     `json:"memory_usage_bytes"`
	CPUUsagePercent  float64   `json:"cpu_usage_percent"`
	Timestamp        time.Time `json:"timestamp"`
}
