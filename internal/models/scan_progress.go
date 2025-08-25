package models

import (
	"time"
)

// =============================================================================
// SCAN PHASE MODELS
// =============================================================================

// ScanPhase represents a single phase of a scan operation (volume_scan, filesystem_indexing, media_enrichment)
type ScanPhase struct {
	ID         int64  `json:"id"`
	ScanID     string `json:"scan_id"`
	PhaseName  string `json:"phase_name"`
	PhaseOrder int    `json:"phase_order"`
	Status     string `json:"status"` // pending, running, completed, failed, skipped
	Progress   int    `json:"progress"`

	// Counts and metrics
	ItemsTotal      int64 `json:"items_total"`
	ItemsProcessed  int64 `json:"items_processed"`
	ItemsSuccessful int64 `json:"items_successful"`
	ItemsFailed     int64 `json:"items_failed"`
	ItemsSkipped    int64 `json:"items_skipped"`

	// Size tracking (in bytes)
	BytesTotal     int64 `json:"bytes_total"`
	BytesProcessed int64 `json:"bytes_processed"`

	// Performance metrics
	ItemsPerSecond float64 `json:"items_per_second"`
	BytesPerSecond int64   `json:"bytes_per_second"`

	// Timing
	StartedAt             *time.Time `json:"started_at,omitempty"`
	CompletedAt           *time.Time `json:"completed_at,omitempty"`
	EstimatedCompletionAt *time.Time `json:"estimated_completion_at,omitempty"`
	DurationMs            int64      `json:"duration_ms"`

	// Current processing info
	CurrentItem  string `json:"current_item"`
	CurrentDepth int    `json:"current_depth"`
	
	// Sub-phase progress fields
	SubPhase         string `json:"sub_phase,omitempty"`          // "preparation", "database_reconciliation", "filesystem_walking"
	SubPhaseProgress int    `json:"sub_phase_progress,omitempty"` // 0-100 progress within sub-phase
	CurrentOperation string `json:"current_operation,omitempty"`  // "Checking existing files (2,451/28,308)"
	
	// Time estimation confidence
	EstimationConfidence string `json:"estimation_confidence,omitempty"` // "low", "medium", "high"

	// Error tracking
	ErrorMessage string     `json:"error_message"`
	ErrorCount   int64      `json:"error_count"`
	LastErrorAt  *time.Time `json:"last_error_at,omitempty"`

	// Metadata
	Metadata string `json:"metadata"`

	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// CreateScanPhaseParams represents parameters for creating a scan phase
type CreateScanPhaseParams struct {
	ScanID       string     `json:"scan_id"`
	PhaseName    string     `json:"phase_name"`
	PhaseOrder   int        `json:"phase_order"`
	Status       string     `json:"status"`
	ItemsTotal   int64      `json:"items_total,omitempty"`
	CurrentDepth int        `json:"current_depth,omitempty"`
	Metadata     string     `json:"metadata,omitempty"`
	StartedAt    *time.Time `json:"started_at,omitempty"`
}

// UpdateScanPhaseParams represents parameters for updating a scan phase
type UpdateScanPhaseParams struct {
	ScanID                string     `json:"scan_id"`
	PhaseName             string     `json:"phase_name"`
	Status                *string    `json:"status,omitempty"`
	Progress              *int       `json:"progress,omitempty"`
	ItemsProcessed        *int64     `json:"items_processed,omitempty"`
	ItemsTotal            *int64     `json:"items_total,omitempty"`
	ItemsSuccessful       *int64     `json:"items_successful,omitempty"`
	ItemsFailed           *int64     `json:"items_failed,omitempty"`
	CurrentItem           *string    `json:"current_item,omitempty"`
	ItemsPerSecond        *float64   `json:"items_per_second,omitempty"`
	BytesPerSecond        *int64     `json:"bytes_per_second,omitempty"`
	EstimatedCompletionAt *time.Time `json:"estimated_completion_at,omitempty"`
	
	// Sub-phase progress fields
	SubPhase             *string `json:"sub_phase,omitempty"`
	SubPhaseProgress     *int    `json:"sub_phase_progress,omitempty"`
	CurrentOperation     *string `json:"current_operation,omitempty"`
	EstimationConfidence *string `json:"estimation_confidence,omitempty"`
}

// =============================================================================
// SCAN PROGRESS ITEM MODELS
// =============================================================================

// ScanProgressItem represents an individual item being processed in a scan phase
type ScanProgressItem struct {
	ID        int64  `json:"id"`
	ScanID    string `json:"scan_id"`
	PhaseName string `json:"phase_name"`
	ItemType  string `json:"item_type"` // file, directory, volume, media_file
	ItemPath  string `json:"item_path"`
	ItemName  string `json:"item_name"`
	ItemSize  int64  `json:"item_size"`

	Status   string `json:"status"` // pending, processing, completed, failed, skipped
	Progress int    `json:"progress"`

	// Processing details
	StartedAt   *time.Time `json:"started_at,omitempty"`
	CompletedAt *time.Time `json:"completed_at,omitempty"`
	DurationMs  int64      `json:"duration_ms"`

	// Results
	ResultData   string `json:"result_data"`
	ErrorMessage string `json:"error_message"`
	ErrorDetails string `json:"error_details"`

	// Metadata
	Metadata string `json:"metadata"`

	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// CreateProgressItemParams represents parameters for creating a progress item
type CreateProgressItemParams struct {
	ScanID    string     `json:"scan_id"`
	PhaseName string     `json:"phase_name"`
	ItemType  string     `json:"item_type"`
	ItemPath  string     `json:"item_path"`
	ItemName  string     `json:"item_name,omitempty"`
	ItemSize  int64      `json:"item_size,omitempty"`
	Status    string     `json:"status"`
	Metadata  string     `json:"metadata,omitempty"`
	StartedAt *time.Time `json:"started_at,omitempty"`
}

// UpdateProgressItemParams represents parameters for updating a progress item
type UpdateProgressItemParams struct {
	ScanID       string     `json:"scan_id"`
	ItemPath     string     `json:"item_path"`
	Status       *string    `json:"status,omitempty"`
	Progress     *int       `json:"progress,omitempty"`
	CompletedAt  *time.Time `json:"completed_at,omitempty"`
	DurationMs   *int64     `json:"duration_ms,omitempty"`
	ResultData   *string    `json:"result_data,omitempty"`
	ErrorMessage *string    `json:"error_message,omitempty"`
	ErrorDetails *string    `json:"error_details,omitempty"`
}

// =============================================================================
// SCAN ERROR MODELS
// =============================================================================

// ScanProgressError represents a detailed error that occurred during scanning
type ScanProgressError struct {
	ID        int64  `json:"id"`
	ScanID    string `json:"scan_id"`
	PhaseName string `json:"phase_name"`

	// Error classification
	ErrorType     string `json:"error_type"`     // ffprobe_failed, permission_denied, file_not_found, timeout, etc.
	ErrorCategory string `json:"error_category"` // system, tool, file, network, timeout, permission
	Severity      string `json:"severity"`       // warning, error, critical

	// Error context
	Component string `json:"component"` // ffprobe, exiftool, filesystem_indexer, volume_scanner
	Operation string `json:"operation"` // scan_volume, index_file, enrich_media, extract_metadata

	// Item that failed
	ItemPath string `json:"item_path"`
	ItemName string `json:"item_name"`
	ItemType string `json:"item_type"`
	ItemSize int64  `json:"item_size"`

	// Error details
	ErrorMessage     string `json:"error_message"`
	ErrorCode        string `json:"error_code"`
	StackTrace       string `json:"stack_trace"`
	TechnicalDetails string `json:"technical_details"` // JSON encoded details

	// Timing
	OccurredAt time.Time `json:"occurred_at"`

	// Context (JSON encoded context)
	Context string `json:"context"`

	// Recovery attempts
	RetryCount int        `json:"retry_count"`
	MaxRetries int        `json:"max_retries"`
	RetryAfter *time.Time `json:"retry_after,omitempty"`

	CreatedAt time.Time `json:"created_at"`
}

// RecordScanErrorParams represents parameters for recording a scan error
type RecordScanErrorParams struct {
	ScanID           string `json:"scan_id"`
	PhaseName        string `json:"phase_name"`
	ErrorType        string `json:"error_type"`
	ErrorCategory    string `json:"error_category"`
	Severity         string `json:"severity"`
	Component        string `json:"component"`
	Operation        string `json:"operation"`
	ItemPath         string `json:"item_path"`
	ItemName         string `json:"item_name,omitempty"`
	ItemType         string `json:"item_type,omitempty"`
	ItemSize         int64  `json:"item_size,omitempty"`
	ErrorMessage     string `json:"error_message"`
	ErrorCode        string `json:"error_code,omitempty"`
	TechnicalDetails string `json:"technical_details,omitempty"`
	Context          string `json:"context,omitempty"`
	RetryCount       int    `json:"retry_count,omitempty"`
	MaxRetries       int    `json:"max_retries,omitempty"`
}

// =============================================================================
// SCAN PERFORMANCE METRICS MODELS
// =============================================================================

// ScanPerformanceMetrics represents performance metrics for a scan phase
type ScanPerformanceMetrics struct {
	ID        int64  `json:"id"`
	ScanID    string `json:"scan_id"`
	PhaseName string `json:"phase_name"`

	// Snapshot timing
	MeasuredAt     time.Time `json:"measured_at"`
	ElapsedSeconds int       `json:"elapsed_seconds"`

	// Current rates
	ItemsPerSecond  float64 `json:"items_per_second"`
	BytesPerSecond  int64   `json:"bytes_per_second"`
	ErrorsPerMinute float64 `json:"errors_per_minute"`

	// Cumulative counts
	ItemsProcessed int64 `json:"items_processed"`
	BytesProcessed int64 `json:"bytes_processed"`
	ErrorsCount    int64 `json:"errors_count"`

	// System metrics
	CpuUsagePercent  float64 `json:"cpu_usage_percent"`
	MemoryUsageBytes int64   `json:"memory_usage_bytes"`
	DiskIoReadBytes  int64   `json:"disk_io_read_bytes"`
	DiskIoWriteBytes int64   `json:"disk_io_write_bytes"`

	// Queue metrics
	QueueDepth    int `json:"queue_depth"`
	ActiveWorkers int `json:"active_workers"`

	// Progress estimation
	EstimatedRemainingSeconds int        `json:"estimated_remaining_seconds"`
	EstimatedCompletionAt     *time.Time `json:"estimated_completion_at,omitempty"`

	CreatedAt time.Time `json:"created_at"`
}

// RecordPerformanceMetricsParams represents parameters for recording performance metrics
type RecordPerformanceMetricsParams struct {
	ScanID                    string     `json:"scan_id"`
	PhaseName                 string     `json:"phase_name"`
	ElapsedSeconds            int        `json:"elapsed_seconds"`
	ItemsPerSecond            float64    `json:"items_per_second"`
	BytesPerSecond            int64      `json:"bytes_per_second"`
	ErrorsPerMinute           float64    `json:"errors_per_minute"`
	ItemsProcessed            int64      `json:"items_processed"`
	BytesProcessed            int64      `json:"bytes_processed"`
	ErrorsCount               int64      `json:"errors_count"`
	CpuUsagePercent           float64    `json:"cpu_usage_percent,omitempty"`
	MemoryUsageBytes          int64      `json:"memory_usage_bytes,omitempty"`
	QueueDepth                int        `json:"queue_depth,omitempty"`
	ActiveWorkers             int        `json:"active_workers,omitempty"`
	EstimatedRemainingSeconds int        `json:"estimated_remaining_seconds,omitempty"`
	EstimatedCompletionAt     *time.Time `json:"estimated_completion_at,omitempty"`
}

// Parameters for filtering scan errors
type ScanErrorFilterParams struct {
	ScanID    string
	PhaseName string
	ErrorType string
	Limit     int
	Offset    int
}

// Parameters for getting recent errors
type RecentErrorsParams struct {
	HoursBack int
	ErrorType string
	PhaseName string
	Limit     int
}

// =============================================================================
// SUMMARY AND OVERVIEW MODELS
// =============================================================================

// ActiveScanSummary represents a summary of an active scan (from active_scans view)
type ActiveScanSummary struct {
	ScanID                string     `json:"scan_id"`
	VolumeID              string     `json:"volume_id"`
	JobStatus             string     `json:"job_status"`
	CurrentPhase          string     `json:"current_phase"`
	OverallProgress       int        `json:"overall_progress"`
	JobStartedAt          time.Time  `json:"job_started_at"`
	PhaseName             string     `json:"phase_name"`
	PhaseStatus           string     `json:"phase_status"`
	PhaseProgress         int        `json:"phase_progress"`
	ItemsProcessed        int64      `json:"items_processed"`
	ItemsTotal            int64      `json:"items_total"`
	CurrentItem           string     `json:"current_item"`
	ItemsPerSecond        float64    `json:"items_per_second"`
	EstimatedCompletionAt *time.Time `json:"estimated_completion_at,omitempty"`
	PhaseErrors           int64      `json:"phase_errors"`
	ElapsedSeconds        int        `json:"elapsed_seconds"`
}

// ScanProgressSummary represents a summary of scan progress (from scan_progress_summary view)
type ScanProgressSummary struct {
	ScanID          string     `json:"scan_id"`
	VolumeID        string     `json:"volume_id"`
	JobStatus       string     `json:"job_status"`
	CurrentPhase    string     `json:"current_phase"`
	OverallProgress int        `json:"overall_progress"`
	StartedAt       time.Time  `json:"started_at"`
	TotalPhases     int        `json:"total_phases"`
	CompletedPhases int        `json:"completed_phases"`
	RunningPhases   int        `json:"running_phases"`
	FailedPhases    int        `json:"failed_phases"`
	TotalItems      int64      `json:"total_items"`
	ProcessedItems  int64      `json:"processed_items"`
	SuccessfulItems int64      `json:"successful_items"`
	FailedItems     int64      `json:"failed_items"`
	TotalErrors     int64      `json:"total_errors"`
	LastActivity    *time.Time `json:"last_activity,omitempty"`
}

// RecentErrorSummary represents a summary of recent errors (from recent_scan_errors view)
type RecentErrorSummary struct {
	ScanID        string    `json:"scan_id"`
	VolumeID      string    `json:"volume_id"`
	PhaseName     string    `json:"phase_name"`
	ErrorType     string    `json:"error_type"`
	ErrorCategory string    `json:"error_category"`
	Severity      string    `json:"severity"`
	Component     string    `json:"component"`
	ItemPath      string    `json:"item_path"`
	ErrorMessage  string    `json:"error_message"`
	OccurredAt    time.Time `json:"occurred_at"`
	RetryCount    int       `json:"retry_count"`
}
