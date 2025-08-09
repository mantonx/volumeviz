package scheduler

import (
	"context"
	"time"

	"github.com/mantonx/volumeviz/internal/config"
	"github.com/mantonx/volumeviz/internal/database"
)

// ScanScheduler defines the interface for the scan scheduling system
type ScanScheduler interface {
	Start(ctx context.Context) error
	Stop(ctx context.Context) error
	IsRunning() bool
	GetStatus() *SchedulerStatus
	GetMetrics() *SchedulerMetrics
	EnqueueVolume(volumeName string) (string, error)
	EnqueueAllVolumes() (string, error)
	GetScanStatus(scanID string) (*ScanStatus, error)
}

// ScanRepository defines database operations for scan persistence
type ScanRepository interface {
	// Volume stats operations
	InsertVolumeStats(ctx context.Context, stats *database.VolumeScanStats) error
	GetVolumeStatsByName(ctx context.Context, volumeName string, limit int) ([]*database.VolumeScanStats, error)
	GetLatestVolumeStats(ctx context.Context, volumeName string) (*database.VolumeScanStats, error)
	
	// Scan runs operations
	InsertScanRun(ctx context.Context, run *database.ScanJob) error
	UpdateScanRun(ctx context.Context, run *database.ScanJob) error
	GetScanRunByID(ctx context.Context, scanID string) (*database.ScanJob, error)
	GetActiveScanRuns(ctx context.Context) ([]*database.ScanJob, error)
	
	// Volume operations
	ListVolumes(ctx context.Context) ([]*database.Volume, error)
	UpsertVolume(ctx context.Context, volume *database.Volume) error
}

// VolumeProvider defines interface for getting volume information
type VolumeProvider interface {
	ListVolumes(ctx context.Context) ([]*database.Volume, error)
	GetVolume(ctx context.Context, volumeName string) (*database.Volume, error)
}

// ScanTask represents a scan task in the queue
type ScanTask struct {
	ScanID     string
	VolumeName string
	Method     string
	Priority   int
	CreatedAt  time.Time
	Timeout    time.Duration
	Retries    int
	MaxRetries int
}

// ScanResult represents the result of a completed scan
type ScanResult struct {
	ScanID       string
	VolumeName   string
	Success      bool
	SizeBytes    int64
	FileCount    *int
	Method       string
	Duration     time.Duration
	Error        string
	CompletedAt  time.Time
}

// SchedulerStatus represents the current status of the scheduler
type SchedulerStatus struct {
	Running         bool      `json:"running"`
	LastRunAt       *time.Time `json:"last_run_at,omitempty"`
	NextRunAt       *time.Time `json:"next_run_at,omitempty"`
	ActiveScans     int       `json:"active_scans"`
	QueueDepth      int       `json:"queue_depth"`
	WorkerCount     int       `json:"worker_count"`
	TotalCompleted  int64     `json:"total_completed"`
	TotalFailed     int64     `json:"total_failed"`
}

// SchedulerMetrics represents metrics for Prometheus
type SchedulerMetrics struct {
	QueueDepth        int                    `json:"queue_depth"`
	ActiveScans       int                    `json:"active_scans"`
	CompletedScans    map[string]int64       `json:"completed_scans"`    // by status
	ScanDurations     map[string]float64     `json:"scan_durations"`     // by method (avg seconds)
	ErrorCounts       map[string]int64       `json:"error_counts"`       // by reason
	WorkerUtilization float64                `json:"worker_utilization"` // percentage
}

// ScanStatus represents the status of a specific scan
type ScanStatus struct {
	ScanID      string     `json:"scan_id"`
	VolumeName  string     `json:"volume_name"`
	Status      string     `json:"status"` // queued, running, completed, failed, timeout
	Method      string     `json:"method"`
	Progress    int        `json:"progress"`
	StartedAt   *time.Time `json:"started_at,omitempty"`
	CompletedAt *time.Time `json:"completed_at,omitempty"`
	Duration    *time.Duration `json:"duration,omitempty"`
	SizeBytes   *int64     `json:"size_bytes,omitempty"`
	FileCount   *int       `json:"file_count,omitempty"`
	Error       string     `json:"error,omitempty"`
}

// SchedulerConfig wraps the config.ScanConfig with additional runtime settings
type SchedulerConfig struct {
	*config.ScanConfig
	QueueSize    int // Internal queue size (defaults to 10x concurrency)
}

// NewSchedulerConfig creates a scheduler config from scan config
func NewSchedulerConfig(scanConfig *config.ScanConfig) *SchedulerConfig {
	queueSize := scanConfig.Concurrency * 10
	if queueSize < 100 {
		queueSize = 100
	}
	
	return &SchedulerConfig{
		ScanConfig: scanConfig,
		QueueSize:  queueSize,
	}
}