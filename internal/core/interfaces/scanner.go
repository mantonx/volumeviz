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
}

// ScanProgress represents the progress of an ongoing scan
type ScanProgress struct {
	ScanID             string        `json:"scan_id"`
	VolumeID           string        `json:"volume_id"`
	Status             string        `json:"status"`   // "running", "completed", "failed", "canceled"
	Progress           float64       `json:"progress"` // 0.0 to 1.0
	FilesScanned       int           `json:"files_scanned"`
	CurrentPath        string        `json:"current_path"`
	EstimatedRemaining time.Duration `json:"estimated_remaining"`
	Method             string        `json:"method"`
	StartedAt          time.Time     `json:"started_at"`
	Error              string        `json:"error,omitempty"`
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
