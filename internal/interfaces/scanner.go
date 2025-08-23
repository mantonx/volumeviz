package interfaces

import (
	"context"
	"time"
)

// VolumeScanner defines the main interface for volume scanning operations
type VolumeScanner interface {
	ScanVolume(ctx context.Context, volumeID string) (*ScanResult, error)
	ScanVolumeAsync(ctx context.Context, volumeID string) (string, error)
	GetScanProgress(scanID string) (*ScanProgress, error)
	GetAvailableMethods() []MethodInfo
	ClearCache(volumeID string) error
	TriggerFilesystemIndexingWithScanID(ctx context.Context, volumeID string, deltaMode bool, scanID string) error
}

// ScanMethod defines the interface for specific scanning implementations
type ScanMethod interface {
	Name() string
	Available() bool
	EstimatedDuration(path string) time.Duration
	Scan(ctx context.Context, path string) (*ScanResult, error)
	SupportsProgress() bool
}

// Cache defines the interface for scan result caching
type Cache interface {
	Get(key string) *ScanResult
	Set(key string, result *ScanResult, ttl time.Duration) error
	Delete(key string) error
	Clear() error
}

// MetricsCollector defines the interface for metrics collection
type MetricsCollector interface {
	// Basic metrics (existing)
	CacheHit(volumeID string)
	CacheMiss(volumeID string)
	ScanCompleted(volumeID, method string, duration time.Duration, size int64)
	RecordScanAttempt(method string, duration time.Duration, success bool)
	ScanQueueDepth(depth int)

	// Enhanced metrics for production monitoring
	RecordScanFailure(method, errorCode string)
	UpdateVolumeMetrics(volumeID, volumeName, driver, filesystemType string, size int64, fileCount int, scanMethod string)
	SetDockerConnectionStatus(connected bool)
	SetCacheSize(size int)
	SetActiveScanners(count int)
	ScanStarted(method string)
	ScanFinished(method string)

	// Scheduler-specific metrics
	SetSchedulerRunningStatus(running bool)
	UpdateSchedulerQueueDepth(depth int)
	UpdateSchedulerWorkerUtilization(utilization float64)

	// Stats job monitoring metrics
	StatsJobStarted(jobType string, volumeID string)
	StatsJobCompleted(jobType string, volumeID string, duration time.Duration, recordsProcessed int)
	StatsJobFailed(jobType string, volumeID string, duration time.Duration, errorType string)
	UpdateStatsJobQueueDepth(depth int)
	SetStatsServiceStatus(enabled bool)
}

// ScanResult represents the result of a volume scan
type ScanResult struct {
	VolumeID       string        `json:"volume_id"`
	TotalSize      int64         `json:"total_size"`
	FileCount      int           `json:"file_count"`
	DirectoryCount int           `json:"directory_count"`
	LargestFile    int64         `json:"largest_file"`
	Method         string        `json:"method"`
	ScannedAt      time.Time     `json:"scanned_at"`
	Duration       time.Duration `json:"duration"`
	CacheHit       bool          `json:"cache_hit"`
	FilesystemType string        `json:"filesystem_type"`

	// Filesystem capacity information (optional - may be nil if unavailable)
	FilesystemCapacity *FilesystemInfo `json:"filesystem_capacity,omitempty"`
}

// FilesystemInfo represents filesystem capacity and usage information
type FilesystemInfo struct {
	TotalBytes     int64   `json:"total_bytes"`     // Total filesystem capacity
	AvailableBytes int64   `json:"available_bytes"` // Available space for users
	UsedBytes      int64   `json:"used_bytes"`      // Used space
	UsagePercent   float64 `json:"usage_percent"`   // Usage percentage (0-100)
	BlockSize      int64   `json:"block_size"`      // Filesystem block size
	TotalBlocks    uint64  `json:"total_blocks"`    // Total blocks
	FreeBlocks     uint64  `json:"free_blocks"`     // Free blocks available to users
}

// ScanProgress represents the progress of an ongoing scan
type ScanProgress struct {
	ScanID   string `json:"scan_id"`
	VolumeID string `json:"volume_id"`
	Status   string `json:"status"` // "running", "completed", "failed", "canceled"

	// Current phase information
	Phase         string  `json:"phase"`          // "volume_scan", "filesystem_indexing", "media_enrichment", "preview_generation"
	Progress      float64 `json:"progress"`       // Overall 0.0 to 1.0
	PhaseProgress float64 `json:"phase_progress"` // Current phase 0.0 to 1.0

	// File/directory tracking
	FilesScanned   int64  `json:"files_scanned"`
	FoldersScanned int64  `json:"folders_scanned"`
	TotalEstimated int64  `json:"total_estimated,omitempty"`
	CurrentPath    string `json:"current_path"`
	CurrentDepth   int    `json:"current_depth,omitempty"`

	// Byte tracking
	BytesProcessed int64 `json:"bytes_processed"`
	TotalBytes     int64 `json:"total_bytes,omitempty"`

	// Timing information
	StartedAt          time.Time     `json:"started_at"`
	LastUpdate         time.Time     `json:"last_update"`
	EstimatedRemaining time.Duration `json:"estimated_remaining"`
	ElapsedSeconds     int64         `json:"elapsed_seconds"`

	// Performance metrics
	FilesPerSecond   float64 `json:"files_per_second,omitempty"`
	FoldersPerSecond float64 `json:"folders_per_second,omitempty"`
	BytesPerSecond   int64   `json:"bytes_per_second,omitempty"`

	// Phase breakdown
	Phases map[string]*PhaseInfo `json:"phases,omitempty"`

	// Error tracking
	ErrorsCount int64    `json:"errors_count,omitempty"`
	Errors      []string `json:"errors,omitempty"`
	LastError   string   `json:"last_error,omitempty"`

	// Legacy fields (for backward compatibility)
	Method string `json:"method"`
	Error  string `json:"error,omitempty"`
}

// PhaseInfo represents information about a specific scan phase
type PhaseInfo struct {
	Status         string        `json:"status"` // "pending", "running", "completed", "failed", "skipped"
	StartedAt      *time.Time    `json:"started_at,omitempty"`
	CompletedAt    *time.Time    `json:"completed_at,omitempty"`
	Duration       time.Duration `json:"duration,omitempty"`
	Progress       float64       `json:"progress"` // 0.0 to 1.0
	ItemsProcessed int64         `json:"items_processed,omitempty"`
	Error          string        `json:"error,omitempty"`
}

// MethodInfo provides information about available scan methods
type MethodInfo struct {
	Name        string   `json:"name"`
	Available   bool     `json:"available"`
	Description string   `json:"description"`
	Performance string   `json:"performance"` // "fast", "medium", "slow"
	Accuracy    string   `json:"accuracy"`    // "high", "medium", "basic"
	Features    []string `json:"features"`
}

// ProgressUpdate represents a progress update during scanning
type ProgressUpdate struct {
	FilesScanned int
	CurrentPath  string
	ElapsedTime  time.Duration
}
